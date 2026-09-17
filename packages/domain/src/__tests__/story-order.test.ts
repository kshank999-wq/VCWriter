import { describe, expect, it } from 'vitest';
import { createProjectFile, migrateProjectFile, parseProjectFile, PROJECT_FORMAT_VERSION } from '../project-file.js';
import {
  addBeat,
  addTrack,
  addMarker,
  addUnit,
  moveUnit,
  removeTrack,
  removeMarker,
  removeUnit,
  updateBeat,
  updateMarker,
} from '../mutations.js';
import { markersInStoryOrder, unitsForTrack, unitsInStoryOrder } from '../selectors.js';
import { pagesForUnit, spanWidth, storyLayout, timelineArcs } from '../story-layout.js';
import { addSetupPayoff, addSetupPoint, linkEntities, recordPayoff } from '../mutations.js';
import { ref } from '../entities/links.js';
import { paginateProject } from '../pagination.js';
import { toRows, fromRows } from '../sync-mapping.js';
import { mergeProjects } from '../sync-merge.js';

/**
 * Addendum 02 §8–§9: scenes have one order across the project, and act
 * markers ride on that order.
 */

const twoTracks = () => {
  let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  const main = file.tracks[0]!;
  const subplot = addTrack(file, { name: 'Subplot', kind: 'subplot' });
  file = subplot.file;
  return { file, main, subplot: subplot.track };
};

const titles = (file: ReturnType<typeof createProjectFile>) => unitsInStoryOrder(file).map((unit) => unit.title);

describe('global story order', () => {
  it('interleaves scenes from different tracks by position, not by track', () => {
    let { file, main, subplot } = twoTracks();
    file = addUnit(file, { trackId: main.id, title: 'Main 2' }).file;
    // "After the first scene", whatever track it is in: index counts every scene.
    file = addUnit(file, { trackId: subplot.id, title: 'Sub 1', index: 1 }).file;

    expect(titles(file)).toEqual(['Opening Scene', 'Sub 1', 'Main 2']);
    expect(unitsForTrack(file, subplot.id).map((unit) => unit.title)).toEqual(['Sub 1']);
  });

  it('prints in story order, so a subplot scene lands between main-plot scenes', () => {
    let { file, main, subplot } = twoTracks();
    const write = (unitTitle: string, line: string) => {
      const unit = file.units.find((candidate) => candidate.title === unitTitle)!;
      const created = addBeat(file, { unitId: unit.id, title: line });
      file = updateBeat(created.file, created.beat.id, {
        manuscript: { elements: [{ id: crypto.randomUUID() as never, type: 'action', text: line, characterId: null, attributes: {} }] },
      });
    };
    file = addUnit(file, { trackId: main.id, title: 'Main 2' }).file;
    file = addUnit(file, { trackId: subplot.id, title: 'Sub 1', index: 1 }).file;
    write('Opening Scene', 'ONE');
    write('Sub 1', 'TWO');
    write('Main 2', 'THREE');

    const text = paginateProject(file)
      .flatMap((page) => page.lines)
      .map((line) => line.text)
      .filter((line) => line.length > 0);
    expect(text).toEqual(['ONE', 'TWO', 'THREE']);
  });

  it('moves a scene to another track without changing its place in the story', () => {
    let { file, main, subplot } = twoTracks();
    file = addUnit(file, { trackId: main.id, title: 'Main 2' }).file;
    file = addUnit(file, { trackId: main.id, title: 'Main 3' }).file;
    const middle = file.units.find((unit) => unit.title === 'Main 2')!;

    file = moveUnit(file, { unitId: middle.id, toTrackId: subplot.id, keepPosition: true });

    expect(titles(file)).toEqual(['Opening Scene', 'Main 2', 'Main 3']);
    expect(unitsForTrack(file, subplot.id).map((unit) => unit.title)).toEqual(['Main 2']);
  });

  it('moves a scene along the story axis with an index that counts every other scene', () => {
    let { file, main } = twoTracks();
    file = addUnit(file, { trackId: main.id, title: 'Main 2' }).file;
    file = addUnit(file, { trackId: main.id, title: 'Main 3' }).file;
    const last = file.units.find((unit) => unit.title === 'Main 3')!;

    file = moveUnit(file, { unitId: last.id, toTrackId: main.id, index: 0 });
    expect(titles(file)).toEqual(['Main 3', 'Opening Scene', 'Main 2']);
  });
});

describe('format 1 migration', () => {
  it('re-keys scenes in the order they used to print, track by track', () => {
    // A format-1 document: two tracks, each with per-track keys that overlap.
    const base = createProjectFile({ title: 'Old', format: 'screenplay' });
    const trackA = base.tracks[0]!;
    const trackB = { ...trackA, id: '22222222-2222-4222-8222-222222222222', name: 'Subplot', orderKey: 'b' };
    const unit = (id: string, trackId: string, title: string, orderKey: string) => ({
      ...base.units[0]!,
      id,
      trackId,
      title,
      orderKey,
    });
    const legacy = {
      ...base,
      formatVersion: 1,
      tracks: [{ ...trackA, orderKey: 'a' }, trackB],
      units: [
        unit('33333333-3333-4333-8333-333333333331', trackB.id, 'Sub 1', 'a'),
        unit('33333333-3333-4333-8333-333333333332', trackA.id, 'Main 2', 'b'),
        unit('33333333-3333-4333-8333-333333333333', trackA.id, 'Main 1', 'a'),
      ],
      beats: [],
    };
    delete (legacy as Record<string, unknown>)['markers'];

    const migrated = migrateProjectFile(legacy);
    expect(migrated['formatVersion']).toBe(PROJECT_FORMAT_VERSION);
    expect(migrated['markers']).toEqual([]);

    const file = parseProjectFile(legacy);
    // Format 1 printed track A (Main 1, Main 2) then track B (Sub 1).
    expect(titles(file)).toEqual(['Main 1', 'Main 2', 'Sub 1']);
    // Re-keyed scenes count as edited, so the next sync pushes the global
    // keys instead of a stale per-track copy winning the merge.
    for (const unit of file.units) expect(unit.updatedAt >= base.units[0]!.updatedAt).toBe(true);
  });

  it('opens a current file without touching it', () => {
    const file = createProjectFile({ title: 'New', format: 'novel' });
    const reopened = parseProjectFile(JSON.parse(JSON.stringify(file)));
    expect(reopened.units[0]?.orderKey).toBe(file.units[0]?.orderKey);
    expect(reopened.formatVersion).toBe(PROJECT_FORMAT_VERSION);
  });
});

describe('act markers', () => {
  it('labels a scene, replaces rather than stacks, and lists in story order', () => {
    let { file, main } = twoTracks();
    const second = addUnit(file, { trackId: main.id, title: 'Main 2' });
    file = second.file;
    const first = file.units.find((unit) => unit.title === 'Opening Scene')!;

    file = addMarker(file, { unitId: second.unit.id, title: 'Act II' }).file;
    file = addMarker(file, { unitId: first.id, title: 'Act I' }).file;
    file = addMarker(file, { unitId: first.id, title: 'ACT ONE' }).file;

    expect(markersInStoryOrder(file).map((marker) => marker.title)).toEqual(['ACT ONE', 'Act II']);
    expect(file.markers).toHaveLength(2);
  });

  it('moves to the next scene when its scene is removed, and goes with the last one', () => {
    let { file, main } = twoTracks();
    const second = addUnit(file, { trackId: main.id, title: 'Main 2' });
    file = second.file;
    const third = addUnit(file, { trackId: main.id, title: 'Main 3' });
    file = third.file;
    const marker = addMarker(file, { unitId: second.unit.id, title: 'Act II' });
    file = marker.file;

    file = removeUnit(file, second.unit.id);
    expect(file.markers[0]?.unitId).toBe(third.unit.id);

    file = removeUnit(file, third.unit.id);
    expect(file.markers[0]?.unitId).toBe(file.units[0]?.id);

    file = removeUnit(file, file.units[0]!.id);
    expect(file.markers).toHaveLength(0);
  });

  it('drops a displaced marker rather than stacking two on one scene', () => {
    let { file, main, subplot } = twoTracks();
    const second = addUnit(file, { trackId: subplot.id, title: 'Sub 1' });
    file = second.file;
    const third = addUnit(file, { trackId: main.id, title: 'Main 3' });
    file = third.file;
    file = addMarker(file, { unitId: second.unit.id, title: 'Act II' }).file;
    file = addMarker(file, { unitId: third.unit.id, title: 'Act III' }).file;

    file = removeTrack(file, subplot.id);
    expect(file.markers.map((m) => m.title)).toEqual(['Act III']);
  });

  it('renames, re-anchors and removes', () => {
    let { file, main } = twoTracks();
    const second = addUnit(file, { trackId: main.id, title: 'Main 2' });
    file = second.file;
    const created = addMarker(file, { unitId: file.units[0]!.id, title: 'Act I' });
    file = created.file;

    file = updateMarker(file, created.marker.id, { title: 'Act One', unitId: second.unit.id });
    expect(file.markers[0]).toMatchObject({ title: 'Act One', unitId: second.unit.id });

    file = removeMarker(file, created.marker.id);
    expect(file.markers).toHaveLength(0);
  });

  it('round-trips through sync rows and is pruned when its scene is gone after a merge', () => {
    let { file, main } = twoTracks();
    file = addMarker(file, { unitId: file.units[0]!.id, title: 'Act I' }).file;
    expect(fromRows(toRows(file)).markers).toEqual(file.markers);

    const second = addUnit(file, { trackId: main.id, title: 'Main 2' });
    file = second.file;
    file = addMarker(file, { unitId: second.unit.id, title: 'Act II' }).file;
    const remote = { ...file, units: file.units.filter((unit) => unit.id !== second.unit.id) };
    const merged = mergeProjects(remote, remote, { lastSyncedAt: null }).merged;
    expect(merged.markers.map((m) => m.title)).toEqual(['Act I']);
  });

  it('keeps one marker per scene when two devices marked the same scene', () => {
    const { file } = twoTracks();
    const unitId = file.units[0]!.id;
    const mine = addMarker(file, { unitId, title: 'Act I' }).file;
    const theirs = addMarker(
      { ...file, markers: [] },
      { unitId, title: 'ACT ONE' },
    ).file;
    const later = {
      ...theirs,
      markers: theirs.markers.map((marker) => ({ ...marker, updatedAt: '2099-01-01T00:00:00.000Z' })),
    };
    const merged = mergeProjects(mine, later, { lastSyncedAt: null }).merged;
    expect(merged.markers).toHaveLength(1);
    expect(merged.markers[0]?.title).toBe('ACT ONE');
  });
});

describe('story layout', () => {
  it('measures scenes in pages and places them end to end', () => {
    let { file, main, subplot } = twoTracks();
    const first = file.units[0]!;
    const paragraph = 'The rain does not stop. '.repeat(40);
    const lines = Array.from({ length: 40 }, (_, index) => ({
      id: crypto.randomUUID() as never,
      type: 'action' as const,
      text: `${index} ${paragraph}`,
      characterId: null,
      attributes: {},
    }));
    file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: lines } });
    file = addUnit(file, { trackId: subplot.id, title: 'Sub 1' }).file;
    file = addUnit(file, { trackId: main.id, title: 'Main 3' }).file;
    file = addMarker(file, { unitId: first.id, title: 'Act I' }).file;

    const layout = storyLayout(file);
    expect(layout.spans.map((span) => span.unit.title)).toEqual(['Opening Scene', 'Sub 1', 'Main 3']);
    expect(layout.spans[0]!.pages).toBeGreaterThan(1);
    expect(layout.spans[0]!.pages).toBe(pagesForUnit(file, first.id));
    expect(layout.spans[1]!.startPage).toBe(layout.spans[0]!.pages);
    expect(layout.spans[1]!.pages).toBe(0);
    expect(layout.totalPages).toBe(layout.spans[0]!.pages);
    expect(layout.acts).toEqual([{ marker: file.markers[0], fromIndex: 0, toIndex: 2 }]);
  });

  it('draws a setup as a curve to its payoff, an unpaid one into the air, and a link between scenes', () => {
    let { file, main } = twoTracks();
    const first = file.units[0]!;
    const fourth = addUnit(file, { trackId: main.id, title: 'Sc 4' });
    file = fourth.file;
    const beatInFourth = addBeat(file, { unitId: fourth.unit.id, title: 'It fires' });
    file = beatInFourth.file;

    file = addSetupPayoff(file, { title: 'The revolver' });
    const revolver = file.setupsPayoffs[0]!;
    file = addSetupPoint(file, { setupPayoffId: revolver.id, description: 'In the drawer', location: ref('unit', first.id) });
    file = recordPayoff(file, { setupPayoffId: revolver.id, description: 'Fired', location: ref('beat', beatInFourth.beat.id) });

    file = addSetupPayoff(file, { title: 'The letter' });
    const letter = file.setupsPayoffs[1]!;
    file = addSetupPoint(file, { setupPayoffId: letter.id, description: 'Arrives', location: ref('unit', first.id) });

    file = linkEntities(file, { from: ref('unit', first.id), to: ref('unit', fourth.unit.id), type: 'relates_to', label: 'echo' });
    // Same scene both ends: nothing to bridge.
    file = linkEntities(file, { from: ref('beat', file.beats[0]!.id), to: ref('unit', first.id), type: 'appears_in' });

    expect(timelineArcs(file)).toEqual([
      expect.objectContaining({ kind: 'setup', label: 'The revolver', fromIndex: 0, toIndex: 1 }),
      expect.objectContaining({ kind: 'open', fromIndex: 0, toIndex: null }),
      expect.objectContaining({ kind: 'link', label: 'echo', fromIndex: 0, toIndex: 1 }),
    ]);
  });

  it('gives an empty scene a block you can still see', () => {
    const { file } = twoTracks();
    const span = storyLayout(file).spans[0]!;
    expect(span.pages).toBe(0);
    // A short scene keeps a readable minimum — and still answers the zoom.
    expect(spanWidth(span, 120)).toBe(60);
    expect(spanWidth(span, 400)).toBe(200);
    expect(spanWidth({ ...span, pages: 2.5 }, 120)).toBe(300);
  });
});
