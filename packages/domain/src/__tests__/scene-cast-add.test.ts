import { describe, expect, it } from 'vitest';
import { addBeat, addUnit, bringIntoScene, createProjectFile, cueOffer, sceneCast, type ProjectFile } from '../index.js';

/**
 * Putting somebody in a scene (addendum 02 §4b, from Ken: *wire them to the
 * cue*).
 *
 * What these pin is the one thing that makes the act honest: it **writes a
 * cue** and keeps no list of its own, so `sceneCast` — which reads the
 * manuscript — is what says who is in the scene, before and after. A second
 * list would go on naming her after the speech was cut.
 */

const script = (withBeat = true) => {
  let file: ProjectFile = createProjectFile({ title: 'The Drowned Bell', format: 'screenplay' });
  const trackId = file.tracks[0]!.id;
  const scene = addUnit(file, { trackId, title: 'Opening Scene' });
  file = scene.file;
  if (withBeat) file = addBeat(file, { unitId: scene.unit.id, title: 'a beat' }).file;
  return { file, unitId: scene.unit.id };
};

describe('bringing somebody into a scene', () => {
  it('says what a press would do, and then does exactly that', () => {
    const { file, unitId } = script();
    const offer = cueOffer(file, unitId, 'mara');
    expect(offer.refusal).toBeNull();
    // The name is said in the cue's own case, because that is what is written.
    expect(offer.sentence).toContain('MARA');

    const next = bringIntoScene(file, unitId, 'mara');
    // The reading is the proof: nothing else was told she is here.
    expect(sceneCast(next, unitId)).toEqual(['MARA']);
  });

  it('writes a cue and an empty speech, at the end of the scene’s writing', () => {
    const { file, unitId } = script();
    const next = bringIntoScene(file, unitId, 'Mara');
    const elements = next.beats[next.beats.length - 1]!.manuscript.elements;
    expect(elements.map((one) => one.type)).toEqual(['character', 'dialogue']);
    expect(elements[0]!.text).toBe('MARA');
    // Empty, so the writing screen opens where the words go.
    expect(elements[1]!.text).toBe('');
  });

  it('refuses a name already speaking, and the act refuses it again', () => {
    const { file, unitId } = script();
    const once = bringIntoScene(file, unitId, 'MARA');
    expect(cueOffer(once, unitId, 'MARA').refusal).toContain('already speaks');
    // A caller cannot get past the reading by not reading it.
    const twice = bringIntoScene(once, unitId, 'MARA');
    expect(sceneCast(twice, unitId)).toEqual(['MARA']);
  });

  it('refuses a scene with nothing written in it, there being no beat to put a cue in', () => {
    const { file, unitId } = script(false);
    expect(cueOffer(file, unitId, 'MARA').refusal).toContain('nothing written');
    expect(bringIntoScene(file, unitId, 'MARA')).toBe(file);
  });

  it('refuses a novel, where there is no such thing as a cue', () => {
    let file: ProjectFile = createProjectFile({ title: 'The Lamp', format: 'novel' });
    const chapter = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' });
    file = addBeat(chapter.file, { unitId: chapter.unit.id, title: 'a passage' }).file;
    expect(cueOffer(file, chapter.unit.id, 'MARA').refusal).toContain('no character cues');
    expect(bringIntoScene(file, chapter.unit.id, 'MARA')).toBe(file);
  });

  it('refuses a name that is nothing but space', () => {
    const { file, unitId } = script();
    expect(cueOffer(file, unitId, '   ').refusal).toContain('Nobody is named');
  });
});
