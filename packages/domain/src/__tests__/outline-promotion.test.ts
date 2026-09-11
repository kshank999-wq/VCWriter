import { describe, expect, it } from 'vitest';
import {
  addItem,
  addResearchItem,
  addResearchRow,
  beatsForUnit,
  bindRow,
  canPromote,
  createOutline,
  createProjectFile,
  findOutline,
  findOutlineItem,
  followOutline,
  isPromoted,
  moveItem,
  nudgeItem,
  promotableUnits,
  promoteRow,
  promotedOf,
  removeBeat,
  removeItem,
  removeUnit,
  rowOutOfStep,
  unitsInStoryOrder,
  unpromoteRow,
  updateItem,
  updateUnit,
  type Outline,
  type OutlineItemId,
  type ProjectFile,
} from '../index.js';

/**
 * Promotion: the outline into the script (addendum 06 §6), stage 5.
 *
 * **The point of the whole thing.** Everything before this is arranging, and
 * this is where the arrangement becomes the script — so most of what is worth
 * testing is what promotion is *not* allowed to do: lose the planning, make
 * the same scene twice, or move anything already written.
 */

const live = (file: ProjectFile, outline: Outline): Outline => findOutline(file, outline.id) as Outline;

/** A scene with two beats and a supporting row under the first. */
const planned = (): {
  file: ProjectFile;
  outline: Outline;
  scene: OutlineItemId;
  enters: OutlineItemId;
  finds: OutlineItemId;
  idea: OutlineItemId;
} => {
  const made = createOutline(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  const id = made.outline.id;
  const scene = addItem(made.file, id, { kind: 'scene', title: 'Warehouse Confrontation' });
  const enters = addItem(scene.file, id, { parentId: scene.itemId, kind: 'beat', title: 'Mara enters.' });
  const finds = addItem(enters.file, id, { parentId: scene.itemId, kind: 'beat', title: 'She finds the case.' });
  const idea = addItem(finds.file, id, { parentId: enters.itemId, kind: 'idea', title: 'Movement upstairs.' });
  return {
    file: idea.file,
    outline: made.outline,
    scene: scene.itemId as OutlineItemId,
    enters: enters.itemId as OutlineItemId,
    finds: finds.itemId as OutlineItemId,
    idea: idea.itemId as OutlineItemId,
  };
};

describe('what can go into the script', () => {
  it('is scenes and beats, and nothing else', () => {
    const { file, outline, scene, enters, idea } = planned();
    const back = live(file, outline);
    expect(canPromote(file, back, findOutlineItem(back, scene)!)).toBeNull();
    expect(canPromote(file, back, findOutlineItem(back, idea)!)).toBe('nothing to promote');
    // A beat whose scene is still a plan has nowhere to go: a beat lives
    // inside a scene and never floats in a lane.
    expect(canPromote(file, back, findOutlineItem(back, enters)!)).toBe('its scene is still a plan');
  });

  it('refuses a row that is already there', () => {
    const { file, outline, scene } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const back = live(sent.file, outline);
    expect(canPromote(sent.file, back, findOutlineItem(back, scene)!)).toBe('already in the script');
  });
});

describe('sending a scene', () => {
  it('makes the scene and its beats, in the order the outline has them', () => {
    const { file, outline, scene } = planned();
    const sent = promoteRow(file, outline.id, scene);

    expect(sent.unitId).not.toBeNull();
    expect(sent.beats).toHaveLength(2);
    expect(beatsForUnit(sent.file, sent.unitId!).map((beat) => beat.title)).toEqual([
      'Mara enters.',
      'She finds the case.',
    ]);
  });

  it('leaves the supporting rows in the outline, where they can be read', () => {
    const { file, outline, scene, idea } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const back = live(sent.file, outline);

    expect(findOutlineItem(back, idea)?.title).toBe('Movement upstairs.');
    expect(isPromoted(findOutlineItem(back, idea)!)).toBe(false);
    // Nothing was made in the script for it, because there is nothing for a
    // planning note to become.
    expect(sent.file.beats.map((beat) => beat.title)).not.toContain('Movement upstairs.');
  });

  it('keeps the outline and the script joined, both ways', () => {
    const { file, outline, scene } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const back = live(sent.file, outline);

    expect(promotedOf(sent.file, findOutlineItem(back, scene)!)).toMatchObject({ kind: 'unit' });

    // Renamed in the script, renamed in the outline.
    const fromScript = updateUnit(sent.file, sent.unitId!, { title: 'The warehouse' });
    expect(findOutlineItem(live(fromScript, outline), scene)?.title).toBe('The warehouse');

    // Renamed in the outline, renamed in the script.
    const fromOutline = updateItem(fromScript, outline.id, scene, { title: 'The warehouse, at night' });
    expect(fromOutline.units.find((unit) => unit.id === sent.unitId)?.title).toBe('The warehouse, at night');
  });

  it('moves nothing that was already in the script', () => {
    const { file, outline, scene } = planned();
    const before = unitsInStoryOrder(file).map((unit) => unit.id);
    const sent = promoteRow(file, outline.id, scene);
    const after = unitsInStoryOrder(sent.file).map((unit) => unit.id);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('lands a second scene after the first, because that is the order in the outline', () => {
    const { file, outline, scene } = planned();
    const two = addItem(file, outline.id, { kind: 'scene', title: 'The hospital' });
    const one = promoteRow(two.file, outline.id, scene);
    const next = promoteRow(one.file, outline.id, two.itemId!);

    const order = unitsInStoryOrder(next.file).map((unit) => unit.id);
    expect(order.indexOf(next.unitId!)).toBe(order.indexOf(one.unitId!) + 1);
  });

  it('promotes the rest and leaves alone the beat that is already real', () => {
    const { file, outline, scene, enters } = planned();
    const first = promoteRow(file, outline.id, scene);
    // Put the scene's first beat back in the outline only, then send again.
    const loosened = unpromoteRow(first.file, outline.id, enters);
    const again = promoteRow(loosened, outline.id, scene);

    // The scene was already there, so nothing at all happened: it is refused
    // rather than made twice.
    expect(again.unitId).toBeNull();
    expect(unitsInStoryOrder(again.file)).toHaveLength(unitsInStoryOrder(first.file).length);
  });

  it('carries the research links over, because they were never carried at all', () => {
    const made = createOutline(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
    const characters = made.file.researchCategories.find((category) => category.systemKey === 'characters')!;
    const shelf = addResearchItem(made.file, { categoryId: characters.id, title: 'Mara Kessler' });
    const mara = shelf.researchItems[shelf.researchItems.length - 1]!.id;

    const scene = addItem(shelf, made.outline.id, { kind: 'scene', title: 'Warehouse' });
    const beat = addItem(scene.file, made.outline.id, { parentId: scene.itemId, kind: 'beat', title: 'She enters' });
    const row = addResearchRow(beat.file, made.outline.id, mara, { parentId: beat.itemId });

    const sent = promoteRow(row.file, made.outline.id, scene.itemId!);
    const back = live(sent.file, made.outline);
    expect(findOutlineItem(back, row.itemId!)?.source).toEqual({ type: 'research_item', id: mara });
  });
});

describe('a scene that already exists', () => {
  it('is offered, and taken', () => {
    const { file, outline, scene } = planned();
    const existing = unitsInStoryOrder(file)[0]!;
    expect(promotableUnits(file).map((unit) => unit.id)).toContain(existing.id);

    const bound = bindRow(file, outline.id, scene, existing.id);
    expect(findOutlineItem(live(bound, outline), scene)?.boundUnitId).toBe(existing.id);
    expect(bound.units.find((unit) => unit.id === existing.id)?.title).toBe('Warehouse Confrontation');
  });

  it('is never offered twice, on this board or any other', () => {
    const { file, outline, scene } = planned();
    const two = addItem(file, outline.id, { kind: 'scene', title: 'The hospital' });
    const existing = unitsInStoryOrder(two.file)[0]!;
    const bound = bindRow(two.file, outline.id, scene, existing.id);

    expect(promotableUnits(bound, two.itemId!).map((unit) => unit.id)).not.toContain(existing.id);
    // …and the row that holds it still sees it, or it could not stay bound.
    expect(promotableUnits(bound, scene).map((unit) => unit.id)).toContain(existing.id);

    const twice = bindRow(bound, outline.id, two.itemId!, existing.id);
    expect(findOutlineItem(live(twice, outline), two.itemId!)?.boundUnitId).toBeNull();
  });
});

describe('coming apart', () => {
  it('unpromotes without touching either', () => {
    const { file, outline, scene } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const loose = unpromoteRow(sent.file, outline.id, scene);

    expect(isPromoted(findOutlineItem(live(loose, outline), scene)!)).toBe(false);
    expect(loose.units.some((unit) => unit.id === sent.unitId)).toBe(true);
  });

  it('leaves the scene in the script when the row is taken out of the outline', () => {
    const { file, outline, scene } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const gone = removeItem(sent.file, outline.id, scene);

    expect(findOutlineItem(live(gone, outline), scene)).toBeNull();
    expect(gone.units.find((unit) => unit.id === sent.unitId)?.title).toBe('Warehouse Confrontation');
    expect(beatsForUnit(gone, sent.unitId!)).toHaveLength(2);
  });

  it('turns the row back into a plan when the scene leaves the script', () => {
    const { file, outline, scene, enters } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const gone = removeUnit(sent.file, sent.unitId!);
    const back = live(gone, outline);

    expect(findOutlineItem(back, scene)?.title).toBe('Warehouse Confrontation');
    expect(isPromoted(findOutlineItem(back, scene)!)).toBe(false);
    // The beats went with the scene, so their rows are plans again too.
    expect(isPromoted(findOutlineItem(back, enters)!)).toBe(false);
  });

  it('does the same when one beat leaves', () => {
    const { file, outline, scene, enters, finds } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const gone = removeBeat(sent.file, sent.beats[0]!);
    const back = live(gone, outline);

    expect(isPromoted(findOutlineItem(back, enters)!)).toBe(false);
    expect(isPromoted(findOutlineItem(back, finds)!)).toBe(true);
  });
});

describe('when the outline and the script disagree', () => {
  it('says nothing while they agree', () => {
    const { file, outline, scene } = planned();
    const sent = promoteRow(file, outline.id, scene);
    expect(rowOutOfStep(sent.file, live(sent.file, outline), scene)).toBeNull();
  });

  it('says so when a promoted row is moved past a promoted one', () => {
    const { file, outline, scene, finds } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const moved = nudgeItem(sent.file, outline.id, finds, -1);

    const said = rowOutOfStep(moved, live(moved, outline), finds);
    expect(said).not.toBeNull();
    expect(said?.otherTitle).toBe('Mara enters.');
  });

  it('moves nothing in the script until it is asked to', () => {
    const { file, outline, scene, finds } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const before = beatsForUnit(sent.file, sent.unitId!).map((beat) => beat.id);
    const moved = nudgeItem(sent.file, outline.id, finds, -1);
    expect(beatsForUnit(moved, sent.unitId!).map((beat) => beat.id)).toEqual(before);
  });

  it('follows the outline when it is, and then agrees again', () => {
    const { file, outline, scene, finds } = planned();
    const sent = promoteRow(file, outline.id, scene);
    const moved = nudgeItem(sent.file, outline.id, finds, -1);
    const followed = followOutline(moved, outline.id, finds);

    expect(beatsForUnit(followed, sent.unitId!).map((beat) => beat.title)).toEqual([
      'She finds the case.',
      'Mara enters.',
    ]);
    expect(rowOutOfStep(followed, live(followed, outline), finds)).toBeNull();
  });

  it('reorders scenes the same way', () => {
    const { file, outline, scene } = planned();
    const two = addItem(file, outline.id, { kind: 'scene', title: 'The hospital' });
    const one = promoteRow(two.file, outline.id, scene);
    const next = promoteRow(one.file, outline.id, two.itemId!);

    const moved = moveItem(next.file, outline.id, two.itemId!, { parentId: null, beforeId: scene });
    expect(rowOutOfStep(moved, live(moved, outline), two.itemId!)).not.toBeNull();

    const followed = followOutline(moved, outline.id, two.itemId!);
    const order = unitsInStoryOrder(followed).map((unit) => unit.id);
    expect(order.indexOf(next.unitId!)).toBeLessThan(order.indexOf(one.unitId!));
  });
});
