import { describe, expect, it } from 'vitest';
import {
  BEAT_UNITS,
  REGION_HEAD_UNITS,
  REGION_MIN_UNITS,
  SCENE_UNITS,
  addBeat,
  addLane,
  addSceneToRegion,
  addStructurePoint,
  addUnit,
  createProjectFile,
  moveStructurePoint,
  removeMarker,
  sculptorSpine,
  structurePointKinds,
  unitsInStoryOrder,
  updateBeat,
  updateMarker,
  type ProjectFile,
} from '../index.js';

/**
 * Story Sculptor, stage one (addendum 03 §§2–4): the spine of the canvas.
 *
 * The story from beginning to end, cut into regions by the structure points
 * the writer has put in — and a region is a **span**, not a container, so
 * everything here is read off the story order rather than stored beside it.
 */

const project = (): ProjectFile => createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });

/** A scene at the end of the story, with a line in it so it takes room. */
const scene = (file: ProjectFile, text: string): ProjectFile => {
  const made = addUnit(file, { laneId: file.lanes[0]!.id });
  const beat = addBeat(made.file, { unitId: made.unit.id });
  return updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [{ id: `${beat.beat.id}-a` as never, type: 'action', text, characterId: null, attributes: {} }],
    },
  });
};

describe('the spine', () => {
  it('is the opening alone before anything is marked', () => {
    const spine = sculptorSpine(project());
    // A project is made with one scene, so there is an opening and no more.
    expect(spine.regions.map((region) => region.label)).toEqual(['Opening']);
    expect(spine.regions[0]?.marker).toBeNull();
    expect(spine.units).toBe(1);
  });

  it('cuts the story where the structure points are', () => {
    let file = project();
    file = scene(file, 'She climbs.');
    file = scene(file, 'Rain on the water.');
    file = addStructurePoint(file, { title: 'The arrival', index: 1 }).file;
    file = addStructurePoint(file, { title: 'The midpoint', index: 3 }).file;

    const spine = sculptorSpine(file);
    expect(spine.regions.map((region) => region.label)).toEqual(['Opening', 'ACT I', 'ACT II']);
    // The opening is what came before the first point; each region runs to
    // the next one, and the last runs to the end of the story.
    expect(spine.regions.map((region) => region.units.length)).toEqual([1, 2, 2]);
    expect(spine.regions[1]?.marker?.title).toBe('The arrival');
  });

  it('takes its height from the manuscript under it, not from a stored number', () => {
    let file = project();
    file = addStructurePoint(file, { title: 'One', index: 1 }).file;
    const before = sculptorSpine(file).regions.at(-1)!;
    expect(before.pages).toBe(0);

    // Writing in the region's scene makes the region taller. Nothing else
    // was touched: the size is read off the story, not kept beside it.
    const unit = before.units[0]!;
    const beat = file.beats.find((candidate) => candidate.unitId === unit.id)!;
    file = updateBeat(file, beat.id, {
      manuscript: {
        elements: [{ id: 'a' as never, type: 'action', text: 'The lamp turns. '.repeat(40), characterId: null, attributes: {} }],
      },
    });
    expect(sculptorSpine(file).regions.at(-1)!.pages).toBeGreaterThan(before.pages);
  });

  it('moves a scene into the next region by moving the scene, and nothing else', () => {
    let file = project();
    file = scene(file, 'She climbs.');
    file = addStructurePoint(file, { title: 'Two', index: 2 }).file;
    expect(sculptorSpine(file).regions.map((region) => region.units.length)).toEqual([2, 1]);

    // The second scene is dragged past the structure point. No region was
    // edited; the story order was, and the regions follow it.
    const order = unitsInStoryOrder(file);
    const moved = { ...file, units: file.units.map((unit) => unit) };
    const second = order[1]!;
    const point = order[2]!;
    file = {
      ...moved,
      units: moved.units.map((unit) =>
        unit.id === second.id ? { ...unit, orderKey: `${point.orderKey}z` } : unit,
      ),
    };
    expect(sculptorSpine(file).regions.map((region) => region.units.length)).toEqual([1, 2]);
  });
});

describe('putting a structure point in', () => {
  it('gives it the scene it begins at, with somewhere to write', () => {
    const made = addStructurePoint(project(), { title: 'The arrival' });
    expect(made.marker.title).toBe('The arrival');
    expect(made.file.units).toHaveLength(2);
    // The scene it made is the last one, and it has a beat to write in.
    expect(unitsInStoryOrder(made.file).at(-1)?.id).toBe(made.unit.id);
    expect(made.file.beats.filter((beat) => beat.unitId === made.unit.id)).toHaveLength(1);
    expect(made.beatId).toBe(made.file.beats.at(-1)?.id);
  });

  it('puts it where it was asked for, not always at the end', () => {
    let file = project();
    file = scene(file, 'She climbs.');
    const made = addStructurePoint(file, { title: 'First', index: 0 });
    expect(unitsInStoryOrder(made.file)[0]?.id).toBe(made.unit.id);
    expect(sculptorSpine(made.file).regions.map((region) => region.label)).toEqual(['ACT I']);
  });

  it('offers the kinds the format is written in, and a milestone of one’s own', () => {
    expect(structurePointKinds(project())).toEqual(['act', 'sequence', 'note']);
    expect(structurePointKinds(createProjectFile({ title: 'B', format: 'novel' }))).toEqual([
      'part',
      'chapter',
      'note',
    ]);
    expect(structurePointKinds(createProjectFile({ title: 'S', format: 'series' }))[0]).toBe('episode');
  });

  it('takes the writer’s own words where no paradigm is named', () => {
    // A `note` marker has no noun of its own, so what it says is what the
    // writer typed — §2's "no named paradigm at all".
    const made = addStructurePoint(project(), { title: 'The lamp goes out', kind: 'note' });
    expect(sculptorSpine(made.file).regions.at(-1)?.label).toBe('The lamp goes out');
  });
});

describe('moving a structure point', () => {
  /** Three points, each with a scene of its own, in order. */
  const three = (): ProjectFile => {
    let file = project();
    for (const title of ['One', 'Two', 'Three']) {
      file = addStructurePoint(file, { title }).file;
    }
    return file;
  };

  const titles = (file: ProjectFile) =>
    sculptorSpine(file)
      .regions.filter((region) => region.marker)
      .map((region) => region.marker?.title);

  it('takes its region with it rather than sliding off its material', () => {
    let file = three();
    expect(titles(file)).toEqual(['One', 'Two', 'Three']);

    file = moveStructurePoint(file, sculptorSpine(file).regions[3]!.marker!.id, 0);
    expect(titles(file)).toEqual(['Three', 'One', 'Two']);

    // And the scene that came with it is still under it.
    const first = sculptorSpine(file).regions.find((region) => region.marker?.title === 'Three');
    expect(first?.units).toHaveLength(1);
  });

  it('moves one later as readily as earlier, and leaves a no-op alone', () => {
    let file = three();
    const one = sculptorSpine(file).regions[1]!.marker!.id;
    file = moveStructurePoint(file, one, 2);
    expect(titles(file)).toEqual(['Two', 'Three', 'One']);

    const same = moveStructurePoint(file, one, 2);
    expect(titles(same)).toEqual(['Two', 'Three', 'One']);
  });

  it('refuses a point that is not in the story', () => {
    expect(() => moveStructurePoint(three(), 'nope' as never, 0)).toThrow(/not in the story/);
  });
});

describe('what the canvas does not own', () => {
  it('has no Beginning or End to lose: they are the ends of the story', () => {
    // Nothing in the file is a beginning node, so nothing can delete one.
    const file = addStructurePoint(project(), { title: 'One' }).file;
    expect(file.markers.map((marker) => marker.title)).toEqual(['One']);
    expect(sculptorSpine(file).regions[0]?.marker).toBeNull();
  });

  it('renames and removes a point through the markers it already is', () => {
    const made = addStructurePoint(project(), { title: 'The arrival' });
    const renamed = updateMarker(made.file, made.marker.id, { title: 'The wreck' });
    expect(sculptorSpine(renamed).regions.at(-1)?.marker?.title).toBe('The wreck');

    // Removing the point leaves its scene where it was: the writing stays.
    const removed = removeMarker(renamed, made.marker.id);
    expect(removed.units).toHaveLength(2);
    expect(sculptorSpine(removed).regions.map((region) => region.label)).toEqual(['Opening']);
  });
});

/**
 * Stage two (addendum 03 §4): a region is as tall as what is inside it.
 *
 * The canvas is a diagram of the structure, not a bar chart of the word
 * count — so the room a node needs is a **sum of its children**, worked out
 * every time, never a size anybody set.
 */
describe('automatic vertical expansion', () => {
  it('gives an empty region its floor and no more', () => {
    const made = addStructurePoint(project(), { title: 'One' });
    const region = sculptorSpine(made.file).regions.at(-1)!;
    // Its own head, and the one scene it came with.
    expect(region.extent).toBe(REGION_HEAD_UNITS + SCENE_UNITS + BEAT_UNITS);
    expect(region.extent).toBeGreaterThanOrEqual(REGION_MIN_UNITS);
  });

  it('grows when a scene is put in it, and by exactly that scene', () => {
    const made = addStructurePoint(project(), { title: 'One' });
    const before = sculptorSpine(made.file).regions.at(-1)!;

    const added = addSceneToRegion(made.file, made.marker.id);
    const after = sculptorSpine(added.file).regions.at(-1)!;

    expect(after.units).toHaveLength(before.units.length + 1);
    // A scene with its one beat: nothing else moved, and nothing was set.
    expect(after.extent).toBe(before.extent + SCENE_UNITS + BEAT_UNITS);
  });

  it('grows when a beat is put in a scene, and pushes the region down with it', () => {
    const made = addStructurePoint(project(), { title: 'One' });
    const before = sculptorSpine(made.file).regions.at(-1)!;

    const file = addBeat(made.file, { unitId: made.unit.id }).file;
    const after = sculptorSpine(file).regions.at(-1)!;
    expect(after.extent).toBe(before.extent + BEAT_UNITS);
    expect(after.scenes[0]?.extent).toBe(SCENE_UNITS + 2 * BEAT_UNITS);
  });

  it('takes its height from its children and not from what is written in them', () => {
    const made = addStructurePoint(project(), { title: 'One' });
    const before = sculptorSpine(made.file).regions.at(-1)!;

    const beat = made.file.beats.find((candidate) => candidate.unitId === made.unit.id)!;
    const written = updateBeat(made.file, beat.id, {
      manuscript: {
        elements: [
          { id: 'a' as never, type: 'action', text: 'The lamp turns. '.repeat(500), characterId: null, attributes: {} },
        ],
      },
    });
    const after = sculptorSpine(written).regions.at(-1)!;

    // Pages of manuscript, and not one unit taller: a diagram of the shape.
    expect(after.pages).toBeGreaterThan(1);
    expect(after.extent).toBe(before.extent);
  });

  it('measures the whole canvas as the sum of its regions', () => {
    let file = project();
    file = addStructurePoint(file, { title: 'One' }).file;
    file = addStructurePoint(file, { title: 'Two' }).file;
    const spine = sculptorSpine(file);
    expect(spine.extent).toBe(spine.regions.reduce((total, region) => total + region.extent, 0));
  });
});

describe('putting a scene in a region', () => {
  it('puts it at the end of that region’s run, not at the end of the story', () => {
    let file = project();
    const first = addStructurePoint(file, { title: 'One' });
    file = addStructurePoint(first.file, { title: 'Two' }).file;

    const added = addSceneToRegion(file, first.marker.id, { title: 'The wreck' });
    const spine = sculptorSpine(added.file);
    // It landed in region one, ahead of the second structure point.
    expect(spine.regions[1]?.units.map((unit) => unit.title)).toEqual(['', 'The wreck']);
    expect(spine.regions[2]?.units).toHaveLength(1);
  });

  it('plots it in the lane its region is already in', () => {
    let file = project();
    const lane = addLane(file, { name: 'Subplot' });
    file = lane.file;
    const made = addStructurePoint(file, { title: 'One', laneId: lane.lane.id });
    const added = addSceneToRegion(made.file, made.marker.id);
    expect(added.unit.laneId).toBe(lane.lane.id);
  });

  it('takes scenes into the opening, which has no structure point', () => {
    const file = addStructurePoint(project(), { title: 'One' }).file;
    const added = addSceneToRegion(file, null, { title: 'Cold open' });
    const spine = sculptorSpine(added.file);
    expect(spine.regions[0]?.marker).toBeNull();
    expect(spine.regions[0]?.units.map((unit) => unit.title)).toContain('Cold open');
  });

  it('refuses a region that is not in the story', () => {
    expect(() => addSceneToRegion(project(), 'nope' as never)).toThrow(/not in the story/);
  });
});
