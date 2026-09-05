import { describe, expect, it } from 'vitest';
import { createProjectFile, projectFileSchema, type ProjectFile } from '../project-file.js';
import { fromRows, toRows } from '../sync-mapping.js';
import { describeMerge, mergeProjects } from '../sync-merge.js';
import { addBeat, addLane, addResearchItem, addUnit, linkEntities, updateBeat, updateUnit } from '../mutations.js';
import { beatsForUnit } from '../selectors.js';
import { ref } from '../entities/links.js';

const project = () => createProjectFile({ title: 'Lighthouse', format: 'screenplay', author: 'K. Shank' });

/**
 * Apply an edit and date it, standing in for "this happened on that device at
 * that moment". Records the edit did not touch keep the timestamps they had.
 */
const stamp = (file: ProjectFile, at: string, edit: (draft: ProjectFile) => ProjectFile): ProjectFile => {
  const next = edit(file);
  const dateChanged = <T extends { id: string; updatedAt: string }>(before: readonly T[], after: readonly T[]): T[] =>
    after.map((record) => {
      const original = before.find((candidate) => candidate.id === record.id);
      return original && original.updatedAt === record.updatedAt ? record : { ...record, updatedAt: at };
    });

  return projectFileSchema.parse({
    ...next,
    project:
      JSON.stringify({ ...file.project, updatedAt: '' }) === JSON.stringify({ ...next.project, updatedAt: '' })
        ? { ...next.project, updatedAt: file.project.updatedAt }
        : { ...next.project, updatedAt: at },
    beats: dateChanged(file.beats, next.beats),
    units: dateChanged(file.units, next.units),
    lanes: dateChanged(file.lanes, next.lanes),
    researchItems: dateChanged(file.researchItems, next.researchItems),
  });
};

const BEFORE = '2026-01-01T00:00:00.000Z';
const SYNCED = '2026-06-01T00:00:00.000Z';
const LATER = '2026-07-01T00:00:00.000Z';
const LATEST = '2026-08-01T00:00:00.000Z';

/** A project whose records all pre-date the last sync. */
const settled = (): ProjectFile => {
  const base = project();
  return projectFileSchema.parse({
    ...base,
    project: { ...base.project, createdAt: BEFORE, updatedAt: BEFORE },
    lanes: base.lanes.map((lane) => ({ ...lane, createdAt: BEFORE, updatedAt: BEFORE })),
    units: base.units.map((unit) => ({ ...unit, createdAt: BEFORE, updatedAt: BEFORE })),
    beats: base.beats.map((beat) => ({ ...beat, createdAt: BEFORE, updatedAt: BEFORE })),
    researchCategories: base.researchCategories.map((category) => ({
      ...category,
      createdAt: BEFORE,
      updatedAt: BEFORE,
    })),
  });
};

describe('row mapping', () => {
  it('round-trips a project through the database shape', () => {
    let file = project();
    const laneId = file.lanes[0]!.id;
    const created = addUnit(file, { laneId, title: 'Second scene' });
    file = addBeat(created.file, { unitId: created.unit.id, title: 'Turn' }).file;
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    file = addResearchItem(file, { categoryId: ideas.id, title: 'A revolver' });
    file = linkEntities(file, {
      from: ref('beat', file.beats[0]!.id),
      to: ref('research_item', file.researchItems[0]!.id),
      type: 'establishes',
    });

    const restored = fromRows(toRows(file));

    expect(restored.project.title).toBe('Lighthouse');
    expect(restored.project.author).toBe('K. Shank');
    expect(restored.lanes).toHaveLength(file.lanes.length);
    expect(restored.units).toHaveLength(file.units.length);
    expect(restored.beats.map((beat) => beat.title).sort()).toEqual(file.beats.map((beat) => beat.title).sort());
    expect(restored.researchItems[0]?.title).toBe('A revolver');
    expect(restored.links[0]?.type).toBe('establishes');
    expect(restored.settings).toEqual(file.settings);
  });

  it('carries a denormalised word count for the database without changing the document', () => {
    const file = project();
    const rows = toRows(file);
    expect(rows.beats[0]).toHaveProperty('word_count');
    expect(fromRows(rows).beats[0]).not.toHaveProperty('word_count');
  });
});

describe('merging local and remote copies', () => {
  it('does nothing when neither side has moved', () => {
    const base = settled();
    const result = mergeProjects(base, base, { lastSyncedAt: SYNCED });
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.beats).toHaveLength(base.beats.length);
    expect(describeMerge(result)).toBe('Already up to date');
  });

  it('takes a change made on the other side', () => {
    const base = settled();
    const remote = stamp(base, LATER, (draft) => updateBeat(draft, draft.beats[0]!.id, { title: 'From the phone' }));

    const result = mergeProjects(base, remote, { lastSyncedAt: SYNCED });

    expect(result.merged.beats[0]?.title).toBe('From the phone');
    expect(result.conflicts).toHaveLength(0);
    expect(result.summary.pulled).toBe(1);
  });

  it('keeps a local change the other side has not seen', () => {
    const base = settled();
    const local = stamp(base, LATER, (draft) => updateBeat(draft, draft.beats[0]!.id, { title: 'From the desk' }));

    const result = mergeProjects(local, base, { lastSyncedAt: SYNCED });

    expect(result.merged.beats[0]?.title).toBe('From the desk');
    expect(result.summary.pushed).toBe(1);
  });

  it('resolves a genuine conflict to the newer edit and reports it', () => {
    const base = settled();
    const local = stamp(base, LATER, (draft) => updateBeat(draft, draft.beats[0]!.id, { title: 'Desk version' }));
    const remote = stamp(base, LATEST, (draft) => updateBeat(draft, draft.beats[0]!.id, { title: 'Phone version' }));

    const result = mergeProjects(local, remote, { lastSyncedAt: SYNCED });

    expect(result.merged.beats[0]?.title).toBe('Phone version');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.kept).toBe('remote');
    expect(result.conflicts[0]?.collection).toBe('beats');
    expect(describeMerge(result)).toContain('1 conflict');
  });

  it('pulls records created elsewhere since the last sync', () => {
    const base = settled();
    const remote = addBeat(base, { unitId: base.units[0]!.id, title: 'Written on the train' }).file;

    const result = mergeProjects(base, remote, { lastSyncedAt: SYNCED });

    expect(result.merged.beats.map((beat) => beat.title)).toContain('Written on the train');
    expect(result.summary.pulled).toBe(1);
  });

  it('accepts a deletion made elsewhere when nothing here touched the record', () => {
    const base = settled();
    const doomed = base.beats[0]!.id;
    const remote = projectFileSchema.parse({ ...base, beats: [] });

    const result = mergeProjects(base, remote, { lastSyncedAt: SYNCED });

    expect(result.merged.beats.some((beat) => beat.id === doomed)).toBe(false);
    expect(result.summary.deletedLocally).toBe(1);
  });

  it('keeps a record that was edited here and deleted there', () => {
    // The safe direction: losing a scene someone was still writing is worse
    // than an unwanted record that takes one click to remove again.
    const base = settled();
    const local = stamp(base, LATER, (draft) =>
      updateBeat(draft, draft.beats[0]!.id, { title: 'Still working on this' }),
    );
    const remote = projectFileSchema.parse({ ...base, beats: [] });

    const result = mergeProjects(local, remote, { lastSyncedAt: SYNCED });

    expect(result.merged.beats[0]?.title).toBe('Still working on this');
    expect(result.summary.revivedByEdit).toBe(1);
    expect(describeMerge(result)).toContain('kept after an edit elsewhere');
  });

  it('never leaves a beat without the scene it belongs to', () => {
    const base = settled();
    const created = addUnit(base, { laneId: base.lanes[0]!.id, title: 'Doomed scene' });
    const withBeat = addBeat(created.file, { unitId: created.unit.id, title: 'Orphan' }).file;

    // The scene is gone remotely and untouched locally, so it goes — and the
    // beat inside it cannot survive on its own (§19).
    const remote = projectFileSchema.parse({
      ...withBeat,
      units: withBeat.units.filter((unit) => unit.id !== created.unit.id),
      beats: withBeat.beats.filter((beat) => beat.unitId !== created.unit.id),
    });
    const settledLocal = projectFileSchema.parse({
      ...withBeat,
      units: withBeat.units.map((unit) => ({ ...unit, createdAt: BEFORE, updatedAt: BEFORE })),
      beats: withBeat.beats.map((beat) => ({ ...beat, createdAt: BEFORE, updatedAt: BEFORE })),
    });

    const result = mergeProjects(settledLocal, remote, { lastSyncedAt: SYNCED });

    expect(result.merged.units.some((unit) => unit.id === created.unit.id)).toBe(false);
    expect(beatsForUnit(result.merged, created.unit.id)).toHaveLength(0);
    expect(result.merged.beats.every((beat) => result.merged.units.some((unit) => unit.id === beat.unitId))).toBe(
      true,
    );
  });

  it('treats a first sync as a merge of everything on both sides', () => {
    const local = project();
    const remote = addLane(project(), { name: 'From the other machine' }).file;

    const result = mergeProjects(local, remote, { lastSyncedAt: null });

    expect(result.merged.lanes.length).toBeGreaterThanOrEqual(local.lanes.length);
    expect(result.summary.deletedLocally).toBe(0);
  });

  it('merges the project record itself by the same rule', () => {
    const base = settled();
    const local = stamp(base, LATER, (draft) =>
      projectFileSchema.parse({ ...draft, project: { ...draft.project, logline: 'Desk logline' } }),
    );
    const remote = stamp(base, LATEST, (draft) =>
      projectFileSchema.parse({ ...draft, project: { ...draft.project, logline: 'Phone logline' } }),
    );

    const result = mergeProjects(local, remote, { lastSyncedAt: SYNCED });

    expect(result.merged.project.logline).toBe('Phone logline');
    expect(result.conflicts.some((conflict) => conflict.collection === 'project')).toBe(true);
  });

  it('keeps local snapshots out of the merge entirely', () => {
    const base = settled();
    const remote = stamp(base, LATER, (draft) => updateUnit(draft, draft.units[0]!.id, { title: 'Renamed' }));
    const result = mergeProjects(base, remote, { lastSyncedAt: SYNCED });
    expect(result.merged.snapshots).toEqual(base.snapshots);
  });
});
