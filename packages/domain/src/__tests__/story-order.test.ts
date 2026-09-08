import { describe, expect, it } from 'vitest';
import { createProjectFile, migrateProjectFile, parseProjectFile, PROJECT_FORMAT_VERSION } from '../project-file.js';
import {
  addBeat,
  addLane,
  addMarker,
  addUnit,
  moveUnit,
  removeLane,
  removeMarker,
  removeUnit,
  updateBeat,
  updateMarker,
} from '../mutations.js';
import { markersInStoryOrder, unitsForLane, unitsInStoryOrder } from '../selectors.js';
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

const twoLanes = () => {
  let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  const main = file.lanes[0]!;
  const subplot = addLane(file, { name: 'Subplot', kind: 'subplot' });
  file = subplot.file;
  return { file, main, subplot: subplot.lane };
};

const titles = (file: ReturnType<typeof createProjectFile>) => unitsInStoryOrder(file).map((unit) => unit.title);

describe('global story order', () => {
  it('interleaves scenes from different lanes by position, not by lane', () => {
    let { file, main, subplot } = twoLanes();
    file = addUnit(file, { laneId: main.id, title: 'Main 2' }).file;
    // "After the first scene", whatever lane it is in: index counts every scene.
    file = addUnit(file, { laneId: subplot.id, title: 'Sub 1', index: 1 }).file;

    expect(titles(file)).toEqual(['Opening Scene', 'Sub 1', 'Main 2']);
    expect(unitsForLane(file, subplot.id).map((unit) => unit.title)).toEqual(['Sub 1']);
  });

  it('prints in story order, so a subplot scene lands between main-plot scenes', () => {
    let { file, main, subplot } = twoLanes();
    const write = (unitTitle: string, line: string) => {
      const unit = file.units.find((candidate) => candidate.title === unitTitle)!;
      const created = addBeat(file, { unitId: unit.id, title: line });
      file = updateBeat(created.file, created.beat.id, {
        manuscript: { elements: [{ id: crypto.randomUUID() as never, type: 'action', text: line, characterId: null, attributes: {} }] },
      });
    };
    file = addUnit(file, { laneId: main.id, title: 'Main 2' }).file;
    file = addUnit(file, { laneId: subplot.id, title: 'Sub 1', index: 1 }).file;
    write('Opening Scene', 'ONE');
    write('Sub 1', 'TWO');
    write('Main 2', 'THREE');

    const text = paginateProject(file)
      .flatMap((page) => page.lines)
      .map((line) => line.text)
      .filter((line) => line.length > 0);
    expect(text).toEqual(['ONE', 'TWO', 'THREE']);
  });

  it('moves a scene to another lane without changing its place in the story', () => {
    let { file, main, subplot } = twoLanes();
    file = addUnit(file, { laneId: main.id, title: 'Main 2' }).file;
    file = addUnit(file, { laneId: main.id, title: 'Main 3' }).file;
    const middle = file.units.find((unit) => unit.title === 'Main 2')!;

    file = moveUnit(file, { unitId: middle.id, toLaneId: subplot.id, keepPosition: true });

    expect(titles(file)).toEqual(['Opening Scene', 'Main 2', 'Main 3']);
    expect(unitsForLane(file, subplot.id).map((unit) => unit.title)).toEqual(['Main 2']);
  });

  it('moves a scene along the story axis with an index that counts every other scene', () => {
    let { file, main } = twoLanes();
    file = addUnit(file, { laneId: main.id, title: 'Main 2' }).file;
    file = addUnit(file, { laneId: main.id, title: 'Main 3' }).file;
    const last = file.units.find((unit) => unit.title === 'Main 3')!;

    file = moveUnit(file, { unitId: last.id, toLaneId: main.id, index: 0 });
    expect(titles(file)).toEqual(['Main 3', 'Opening Scene', 'Main 2']);
  });
});

describe('format 1 migration', () => {
  it('re-keys scenes in the order they used to print, lane by lane', () => {
    // A format-1 document: two lanes, each with per-lane keys that overlap.
    const base = createProjectFile({ title: 'Old', format: 'screenplay' });
    const laneA = base.lanes[0]!;
    const laneB = { ...laneA, id: '22222222-2222-4222-8222-222222222222', name: 'Subplot', orderKey: 'b' };
    const unit = (id: string, laneId: string, title: string, orderKey: string) => ({
      ...base.units[0]!,
      id,
      laneId,
      title,
      orderKey,
    });
    const legacy = {
      ...base,
      formatVersion: 1,
      lanes: [{ ...laneA, orderKey: 'a' }, laneB],
      units: [
        unit('33333333-3333-4333-8333-333333333331', laneB.id, 'Sub 1', 'a'),
        unit('33333333-3333-4333-8333-333333333332', laneA.id, 'Main 2', 'b'),
        unit('33333333-3333-4333-8333-333333333333', laneA.id, 'Main 1', 'a'),
      ],
      beats: [],
    };
    delete (legacy as Record<string, unknown>)['markers'];

    const migrated = migrateProjectFile(legacy);
    expect(migrated['formatVersion']).toBe(PROJECT_FORMAT_VERSION);
    expect(migrated['markers']).toEqual([]);

    const file = parseProjectFile(legacy);
    // Format 1 printed lane A (Main 1, Main 2) then lane B (Sub 1).
    expect(titles(file)).toEqual(['Main 1', 'Main 2', 'Sub 1']);
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
    let { file, main } = twoLanes();
    const second = addUnit(file, { laneId: main.id, title: 'Main 2' });
    file = second.file;
    const first = file.units.find((unit) => unit.title === 'Opening Scene')!;

    file = addMarker(file, { unitId: second.unit.id, title: 'Act II' }).file;
    file = addMarker(file, { unitId: first.id, title: 'Act I' }).file;
    file = addMarker(file, { unitId: first.id, title: 'ACT ONE' }).file;

    expect(markersInStoryOrder(file).map((marker) => marker.title)).toEqual(['ACT ONE', 'Act II']);
    expect(file.markers).toHaveLength(2);
  });

  it('moves to the next scene when its scene is removed, and goes with the last one', () => {
    let { file, main } = twoLanes();
    const second = addUnit(file, { laneId: main.id, title: 'Main 2' });
    file = second.file;
    const third = addUnit(file, { laneId: main.id, title: 'Main 3' });
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
    let { file, main, subplot } = twoLanes();
    const second = addUnit(file, { laneId: subplot.id, title: 'Sub 1' });
    file = second.file;
    const third = addUnit(file, { laneId: main.id, title: 'Main 3' });
    file = third.file;
    file = addMarker(file, { unitId: second.unit.id, title: 'Act II' }).file;
    file = addMarker(file, { unitId: third.unit.id, title: 'Act III' }).file;

    file = removeLane(file, subplot.id);
    expect(file.markers.map((m) => m.title)).toEqual(['Act III']);
  });

  it('renames, re-anchors and removes', () => {
    let { file, main } = twoLanes();
    const second = addUnit(file, { laneId: main.id, title: 'Main 2' });
    file = second.file;
    const created = addMarker(file, { unitId: file.units[0]!.id, title: 'Act I' });
    file = created.file;

    file = updateMarker(file, created.marker.id, { title: 'Act One', unitId: second.unit.id });
    expect(file.markers[0]).toMatchObject({ title: 'Act One', unitId: second.unit.id });

    file = removeMarker(file, created.marker.id);
    expect(file.markers).toHaveLength(0);
  });

  it('round-trips through sync rows and is pruned when its scene is gone after a merge', () => {
    let { file, main } = twoLanes();
    file = addMarker(file, { unitId: file.units[0]!.id, title: 'Act I' }).file;
    expect(fromRows(toRows(file)).markers).toEqual(file.markers);

    const second = addUnit(file, { laneId: main.id, title: 'Main 2' });
    file = second.file;
    file = addMarker(file, { unitId: second.unit.id, title: 'Act II' }).file;
    const remote = { ...file, units: file.units.filter((unit) => unit.id !== second.unit.id) };
    const merged = mergeProjects(remote, remote, { lastSyncedAt: null }).merged;
    expect(merged.markers.map((m) => m.title)).toEqual(['Act I']);
  });
});

describe('story layout', () => {
  it('measures scenes in pages and places them end to end', () => {
    let { file, main, subplot } = twoLanes();
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
    file = addUnit(file, { laneId: subplot.id, title: 'Sub 1' }).file;
    file = addUnit(file, { laneId: main.id, title: 'Main 3' }).file;
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
    let { file, main } = twoLanes();
    const first = file.units[0]!;
    const fourth = addUnit(file, { laneId: main.id, title: 'Sc 4' });
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
    const { file } = twoLanes();
    const span = storyLayout(file).spans[0]!;
    expect(span.pages).toBe(0);
    expect(spanWidth(span, 120)).toBe(150);
    expect(spanWidth({ ...span, pages: 2.5 }, 120)).toBe(300);
  });
});
