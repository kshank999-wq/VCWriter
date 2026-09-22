import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addBeat, addTrack, addUnit, removeTrack } from '../mutations.js';
import { dissolveTrack, trackRemoval } from '../tracks.js';
import { beatsForUnit, tracksInOrder, unitsForTrack, unitsInStoryOrder } from '../selectors.js';

/**
 * Removing a plot track (addendum 24 §5e).
 *
 * A track is not a research record and never goes to the graveyard — burying
 * one would have to bury its scenes — so the promise the rest of the room
 * keeps is kept here another way: **the plot goes and the writing stays**.
 */

const withSubplot = () => {
  let file = createProjectFile({ title: 'The Drowned Bell', format: 'screenplay' });
  const subplot = addTrack(file, { name: 'Subplot', kind: 'subplot' });
  file = subplot.file;
  for (const title of ['Her mother calls', 'The bell again']) {
    const scene = addUnit(file, { trackId: subplot.track.id, title });
    file = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' }).file;
  }
  return { file, trackId: subplot.track.id };
};

describe('removing a plot', () => {
  it('says what is on it, and where those scenes would go', () => {
    const { file, trackId } = withSubplot();
    const reading = trackRemoval(file, trackId);
    expect(reading.allowed).toBe(true);
    expect(reading.sceneCount).toBe(2);
    expect(reading.moveTo?.name).toBe('Main Plot');
    expect(reading.sentence).toContain('2 scenes are on it');
    expect(reading.sentence).toContain('Main Plot');
  });

  it('is plain about an empty one, which is the plot added by accident', () => {
    let file = createProjectFile({ title: 'A', format: 'screenplay' });
    const made = addTrack(file, { name: 'New plot', kind: 'subplot' });
    file = made.file;
    expect(trackRemoval(file, made.track.id).sentence).toBe('Nothing is on it.');
    expect(tracksInOrder(dissolveTrack(file, made.track.id))).toHaveLength(1);
  });

  it('refuses the last one rather than leaving the scenes nowhere to live', () => {
    const file = createProjectFile({ title: 'A', format: 'screenplay' });
    const reading = trackRemoval(file, file.tracks[0]!.id);
    expect(reading.allowed).toBe(false);
    expect(reading.sentence).toContain('one plot track');
  });

  it('keeps every scene, in its place, when the plot is dissolved', () => {
    const { file, trackId } = withSubplot();
    const before = unitsInStoryOrder(file).map((unit) => unit.title);
    const mainId = tracksInOrder(file)[0]!.id;

    const after = dissolveTrack(file, trackId);
    expect(tracksInOrder(after).map((track) => track.name)).toEqual(['Main Plot']);
    // Not a word cut, and the story reads in the order it did.
    expect(unitsInStoryOrder(after).map((unit) => unit.title)).toEqual(before);
    expect(unitsForTrack(after, mainId)).toHaveLength(3);
    for (const unit of unitsForTrack(after, mainId)) {
      expect(beatsForUnit(after, unit.id).length).toBeGreaterThan(0);
    }
  });

  it('still allows the whole subplot to be cut, which is the other offer', () => {
    const { file, trackId } = withSubplot();
    const after = removeTrack(file, trackId);
    expect(tracksInOrder(after)).toHaveLength(1);
    expect(unitsInStoryOrder(after).map((unit) => unit.title)).toEqual(['Opening Scene']);
    expect(after.beats).toHaveLength(1);
  });
});
