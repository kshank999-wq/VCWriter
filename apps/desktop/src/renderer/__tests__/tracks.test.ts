import { describe, expect, it } from 'vitest';
import {
  addTrack,
  addUnit,
  beatsForUnit,
  createProjectFile,
  findUnit,
  unitsForTrack,
  type ProjectFile,
} from '@vcwriter/domain';
import { addBeatAfter, addSceneAfter, type Selection } from '../structure';

/**
 * Where a new chapter and a new beat land (addendum 02 §4).
 *
 * The rule is "the thing you clicked into": a chapter goes in the track you
 * last clicked, a beat in the chapter you last clicked — including a chapter
 * with nothing in it, which is exactly the one you select before adding the
 * first beat and which has no beat to be found by.
 */

const nothing: Selection = { trackId: null, unitId: null, beat: null };

/** A project with two plots, each holding one chapter. */
const twoTracks = (): {
  file: ProjectFile;
  main: ReturnType<typeof addTrack>['track'];
  subplot: ReturnType<typeof addTrack>['track'];
} => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'novel' });
  const main = file.tracks[0]!;
  const made = addTrack(file, { name: 'The subplot' });
  file = addUnit(made.file, { trackId: made.track.id, title: 'Subplot one' }).file;
  return { file, main, subplot: made.track };
};

describe('adding a chapter', () => {
  it('puts it in the track last clicked into', () => {
    const { file, main, subplot } = twoTracks();
    const before = unitsForTrack(file, subplot.id).length;

    const made = addSceneAfter(file, { ...nothing, trackId: subplot.id });
    expect(made).not.toBeNull();
    expect(unitsForTrack(made!.file, subplot.id)).toHaveLength(before + 1);
    // And not in the other one, which is where it used to go.
    expect(unitsForTrack(made!.file, main.id)).toHaveLength(unitsForTrack(file, main.id).length);
    expect(findUnit(made!.file, made!.unitId)?.trackId).toBe(subplot.id);
  });

  it('follows the chapter clicked into when no track was named', () => {
    const { file, subplot } = twoTracks();
    const theirs = unitsForTrack(file, subplot.id)[0]!;
    const made = addSceneAfter(file, { ...nothing, unitId: theirs.id });
    expect(findUnit(made!.file, made!.unitId)?.trackId).toBe(subplot.id);
  });

  it('does not put a chapter in one track because a beat in another is selected', () => {
    const { file, main, subplot } = twoTracks();
    // Writing in the main plot, but the subplot is the track in hand.
    const beat = file.beats.find((candidate) => findUnit(file, candidate.unitId)?.trackId === main.id) ?? null;
    const made = addSceneAfter(file, { trackId: subplot.id, unitId: null, beat });
    expect(findUnit(made!.file, made!.unitId)?.trackId).toBe(subplot.id);
  });

  it('still works with nothing selected at all', () => {
    const { file, main } = twoTracks();
    const made = addSceneAfter(file, nothing);
    expect(findUnit(made!.file, made!.unitId)?.trackId).toBe(main.id);
  });
});

describe('adding a beat', () => {
  it('puts it in the chapter last clicked into, even when that chapter is empty', () => {
    const { file, subplot } = twoTracks();
    const empty = unitsForTrack(file, subplot.id)[0]!;
    expect(beatsForUnit(file, empty.id)).toHaveLength(0);

    const made = addBeatAfter(file, { ...nothing, unitId: empty.id });
    expect(made).not.toBeNull();
    expect(beatsForUnit(made!.file, empty.id)).toHaveLength(1);
  });

  it('puts it straight after the selected beat when that beat is in the chapter', () => {
    const { file } = twoTracks();
    const beat = file.beats[0]!;
    const made = addBeatAfter(file, { ...nothing, unitId: beat.unitId, beat });
    const order = beatsForUnit(made!.file, beat.unitId).map((candidate) => candidate.id);
    expect(order[0]).toBe(beat.id);
    expect(order[1]).toBe(made!.beatId);
  });

  it('puts it at the end when the selected beat belongs to another chapter', () => {
    const { file, subplot } = twoTracks();
    const elsewhere = file.beats[0]!;
    const empty = unitsForTrack(file, subplot.id)[0]!;
    const made = addBeatAfter(file, { trackId: null, unitId: empty.id, beat: elsewhere });
    // In the chapter that was clicked, not the one being written in.
    expect(beatsForUnit(made!.file, empty.id).map((beat) => beat.id)).toEqual([made!.beatId]);
    expect(beatsForUnit(made!.file, elsewhere.unitId)).toHaveLength(1);
  });

  it('has nowhere to put one when nothing at all is selected', () => {
    const file = createProjectFile({ title: 'Empty', format: 'novel' });
    expect(addBeatAfter({ ...file, units: [], beats: [] }, nothing)).toBeNull();
  });
});
