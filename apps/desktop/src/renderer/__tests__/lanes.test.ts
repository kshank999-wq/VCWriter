import { describe, expect, it } from 'vitest';
import {
  addLane,
  addUnit,
  beatsForUnit,
  createProjectFile,
  findUnit,
  unitsForLane,
  type ProjectFile,
} from '@vcwriter/domain';
import { addBeatAfter, addSceneAfter, type Selection } from '../structure';

/**
 * Where a new chapter and a new beat land (addendum 02 §4).
 *
 * The rule is "the thing you clicked into": a chapter goes in the lane you
 * last clicked, a beat in the chapter you last clicked — including a chapter
 * with nothing in it, which is exactly the one you select before adding the
 * first beat and which has no beat to be found by.
 */

const nothing: Selection = { laneId: null, unitId: null, beat: null };

/** A project with two plots, each holding one chapter. */
const twoLanes = (): {
  file: ProjectFile;
  main: ReturnType<typeof addLane>['lane'];
  subplot: ReturnType<typeof addLane>['lane'];
} => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'novel' });
  const main = file.lanes[0]!;
  const made = addLane(file, { name: 'The subplot' });
  file = addUnit(made.file, { laneId: made.lane.id, title: 'Subplot one' }).file;
  return { file, main, subplot: made.lane };
};

describe('adding a chapter', () => {
  it('puts it in the lane last clicked into', () => {
    const { file, main, subplot } = twoLanes();
    const before = unitsForLane(file, subplot.id).length;

    const made = addSceneAfter(file, { ...nothing, laneId: subplot.id });
    expect(made).not.toBeNull();
    expect(unitsForLane(made!.file, subplot.id)).toHaveLength(before + 1);
    // And not in the other one, which is where it used to go.
    expect(unitsForLane(made!.file, main.id)).toHaveLength(unitsForLane(file, main.id).length);
    expect(findUnit(made!.file, made!.unitId)?.laneId).toBe(subplot.id);
  });

  it('follows the chapter clicked into when no lane was named', () => {
    const { file, subplot } = twoLanes();
    const theirs = unitsForLane(file, subplot.id)[0]!;
    const made = addSceneAfter(file, { ...nothing, unitId: theirs.id });
    expect(findUnit(made!.file, made!.unitId)?.laneId).toBe(subplot.id);
  });

  it('does not put a chapter in one lane because a beat in another is selected', () => {
    const { file, main, subplot } = twoLanes();
    // Writing in the main plot, but the subplot is the lane in hand.
    const beat = file.beats.find((candidate) => findUnit(file, candidate.unitId)?.laneId === main.id) ?? null;
    const made = addSceneAfter(file, { laneId: subplot.id, unitId: null, beat });
    expect(findUnit(made!.file, made!.unitId)?.laneId).toBe(subplot.id);
  });

  it('still works with nothing selected at all', () => {
    const { file, main } = twoLanes();
    const made = addSceneAfter(file, nothing);
    expect(findUnit(made!.file, made!.unitId)?.laneId).toBe(main.id);
  });
});

describe('adding a beat', () => {
  it('puts it in the chapter last clicked into, even when that chapter is empty', () => {
    const { file, subplot } = twoLanes();
    const empty = unitsForLane(file, subplot.id)[0]!;
    expect(beatsForUnit(file, empty.id)).toHaveLength(0);

    const made = addBeatAfter(file, { ...nothing, unitId: empty.id });
    expect(made).not.toBeNull();
    expect(beatsForUnit(made!.file, empty.id)).toHaveLength(1);
  });

  it('puts it straight after the selected beat when that beat is in the chapter', () => {
    const { file } = twoLanes();
    const beat = file.beats[0]!;
    const made = addBeatAfter(file, { ...nothing, unitId: beat.unitId, beat });
    const order = beatsForUnit(made!.file, beat.unitId).map((candidate) => candidate.id);
    expect(order[0]).toBe(beat.id);
    expect(order[1]).toBe(made!.beatId);
  });

  it('puts it at the end when the selected beat belongs to another chapter', () => {
    const { file, subplot } = twoLanes();
    const elsewhere = file.beats[0]!;
    const empty = unitsForLane(file, subplot.id)[0]!;
    const made = addBeatAfter(file, { laneId: null, unitId: empty.id, beat: elsewhere });
    // In the chapter that was clicked, not the one being written in.
    expect(beatsForUnit(made!.file, empty.id).map((beat) => beat.id)).toEqual([made!.beatId]);
    expect(beatsForUnit(made!.file, elsewhere.unitId)).toHaveLength(1);
  });

  it('has nowhere to put one when nothing at all is selected', () => {
    const file = createProjectFile({ title: 'Empty', format: 'novel' });
    expect(addBeatAfter({ ...file, units: [], beats: [] }, nothing)).toBeNull();
  });
});
