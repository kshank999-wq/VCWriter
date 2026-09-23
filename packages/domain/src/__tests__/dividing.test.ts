import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addUnit,
  beatIntoNewUnit,
  beatsJoin,
  joinBeats,
  unitsJoin,
  joinUnits,
  beatsForUnit,
  carveBeat,
  carveUnit,
  contentsDivisions,
  createProjectFile,
  manuscriptElementsOf,
  manuscriptSequence,
  splitBeatBefore,
  splitUnitBefore,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * Dividing a manuscript where the writer points (addendum 21 §10): a
 * stretch of paragraphs becomes a chapter or a passage of its own, and the
 * words read exactly as before.
 */

const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });

/** The whole manuscript's element ids in reading order: what every cut must keep. */
const reading = (file: ProjectFile): string[] => manuscriptSequence(file).map((place) => place.beat.manuscript.elements[place.index]!.id as string);

/** One chapter, two passages, eight paragraphs a–h. */
const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel' });
  const unit = file.units[0]!;
  file = addMarker(file, { unitId: unit.id, kind: 'chapter', title: 'One' }).file;
  // The project's own first beat holds a–d; a second holds e–h.
  const first = file.beats.find((beat) => beat.unitId === unit.id)!;
  file = updateBeat(file, first.id, { title: 'first', manuscript: { elements: ['a', 'b', 'c', 'd'].map((id) => para(id, `Paragraph ${id}.`)) } });
  const second = addBeat(file, { unitId: unit.id, title: 'second' });
  file = updateBeat(second.file, second.beat.id, { manuscript: { elements: ['e', 'f', 'g', 'h'].map((id) => para(id, `Paragraph ${id}.`)) } });
  return file;
};

describe('the two primitives', () => {
  it('splits a beat before an element, and hands the beat back untouched before its first', () => {
    const file = novel();
    expect(reading(file)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const cut = splitBeatBefore(file, 'c');
    const beats = beatsForUnit(cut.file, file.units[0]!.id);
    expect(beats.map((beat) => beat.manuscript.elements.map((element) => element.id))).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f', 'g', 'h']]);
    expect(beats[1]?.id).toBe(cut.beatId);
    expect(reading(cut.file)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const same = splitBeatBefore(file, 'a');
    expect(same.file).toBe(file);
  });

  it('splits a unit before an element, the rest becoming the next unit in the story', () => {
    const file = novel();
    const cut = splitUnitBefore(file, 'f');
    const order = unitsInStoryOrder(cut.file);
    expect(order).toHaveLength(2);
    expect(order[1]?.id).toBe(cut.unitId);
    expect(manuscriptElementsOf(cut.file, order[0]!.id).map((element) => element.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(manuscriptElementsOf(cut.file, cut.unitId).map((element) => element.id)).toEqual(['f', 'g', 'h']);
    expect(reading(cut.file)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(splitUnitBefore(file, 'a').file).toBe(file);
  });
});

describe('a chapter from a start and an end', () => {
  it('cuts the stretch into a unit of its own with a marker, the rest before and after it', () => {
    const file = novel();
    const made = carveUnit(file, 'c', 'f', { title: 'The Middle' });
    expect(typeof made).not.toBe('string');
    const { file: next, unitId, markerId, elements } = made as Exclude<typeof made, string>;
    expect(elements).toBe(4);
    const order = unitsInStoryOrder(next);
    expect(order.map((unit) => manuscriptElementsOf(next, unit.id).map((element) => element.id))).toEqual([['a', 'b'], ['c', 'd', 'e', 'f'], ['g', 'h']]);
    expect(order[1]?.id).toBe(unitId);
    expect(next.markers.find((marker) => marker.id === markerId)).toMatchObject({ unitId, title: 'The Middle', kind: 'chapter' });
    // The chapter before keeps its marker; the tail after has none and runs on under the new chapter.
    expect(contentsDivisions(next).map((placed) => placed.marker.title)).toEqual(['One', 'The Middle']);
    expect(reading(next)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('takes the ends either way round, and a range from the very first paragraph keeps that unit’s marker', () => {
    const file = novel();
    const made = carveUnit(file, 'd', 'a') as Exclude<ReturnType<typeof carveUnit>, string>;
    expect(unitsInStoryOrder(made.file).map((unit) => manuscriptElementsOf(made.file, unit.id).map((element) => element.id))).toEqual([['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]);
    expect(made.file.markers).toHaveLength(1);
    expect(made.markerId).toBe(file.markers[0]?.id);
  });

  it('swallows whole units in between, and their markers with them', () => {
    let file = novel();
    const first = file.units[0]!;
    const two = addUnit(file, { trackId: first.trackId, title: 'Two', index: 1 });
    file = two.file;
    file = addMarker(file, { unitId: two.unit.id, kind: 'chapter', title: 'Two' }).file;
    const beat = addBeat(file, { unitId: two.unit.id });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: ['i', 'j'].map((id) => para(id, `Paragraph ${id}.`)) } });
    const three = addUnit(file, { trackId: first.trackId, title: 'Three', index: 2 });
    file = three.file;
    const beat3 = addBeat(file, { unitId: three.unit.id });
    file = updateBeat(beat3.file, beat3.beat.id, { manuscript: { elements: ['k', 'l'].map((id) => para(id, `Paragraph ${id}.`)) } });
    expect(reading(file)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);

    const made = carveUnit(file, 'g', 'k', { title: 'Across' }) as Exclude<ReturnType<typeof carveUnit>, string>;
    expect(unitsInStoryOrder(made.file).map((unit) => manuscriptElementsOf(made.file, unit.id).map((element) => element.id))).toEqual([
      ['a', 'b', 'c', 'd', 'e', 'f'],
      ['g', 'h', 'i', 'j', 'k'],
      ['l'],
    ]);
    expect(contentsDivisions(made.file).map((placed) => placed.marker.title)).toEqual(['One', 'Across']);
    expect(reading(made.file)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
  });

  it('refuses a paragraph that has gone', () => {
    expect(carveUnit(novel(), 'a', 'zz')).toBe('That paragraph is no longer in the manuscript.');
  });
});

describe('a passage from a start and an end', () => {
  it('cuts the stretch into a beat of its own inside its chapter, joining across the passages between', () => {
    const file = novel();
    const made = carveBeat(file, 'b', 'f', { title: 'The lamp goes out' }) as Exclude<ReturnType<typeof carveBeat>, string>;
    expect(made.elements).toBe(5);
    const beats = beatsForUnit(made.file, file.units[0]!.id);
    expect(beats.map((beat) => beat.manuscript.elements.map((element) => element.id))).toEqual([['a'], ['b', 'c', 'd', 'e', 'f'], ['g', 'h']]);
    expect(beats[1]).toMatchObject({ id: made.beatId, title: 'The lamp goes out' });
    expect(unitsInStoryOrder(made.file)).toHaveLength(1);
    expect(reading(made.file)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('will not cross a chapter', () => {
    const cut = splitUnitBefore(novel(), 'e').file;
    expect(carveBeat(cut, 'c', 'f')).toMatch(/cannot cross/);
  });
});

describe('a beat carried into a scene of its own', () => {
  it('makes a new unit right after the beat’s, on its track, holding only that beat', () => {
    const file = novel();
    const second = beatsForUnit(file, file.units[0]!.id)[1]!;
    const made = beatIntoNewUnit(file, second.id, { title: 'Later' });
    const order = unitsInStoryOrder(made.file);
    expect(order.map((unit) => unit.id)).toEqual([file.units[0]!.id, made.unitId]);
    expect(order[1]?.trackId).toBe(file.units[0]!.trackId);
    expect(order[1]?.title).toBe('Later');
    expect(beatsForUnit(made.file, made.unitId).map((beat) => beat.id)).toEqual([second.id]);
    expect(beatsForUnit(made.file, file.units[0]!.id)).toHaveLength(1);
    expect(reading(made.file)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('lands on the track asked for, and leaves an emptied unit standing', () => {
    let file = novel();
    const track = addUnit(file, { trackId: file.tracks[0]!.id }).file;
    file = track;
    const only = addBeat(file, { unitId: unitsInStoryOrder(file)[1]!.id, title: 'alone' });
    file = only.file;
    const made = beatIntoNewUnit(file, only.beat.id, { trackId: file.tracks[0]!.id });
    expect(unitsInStoryOrder(made.file)).toHaveLength(3);
    expect(beatsForUnit(made.file, unitsInStoryOrder(made.file)[1]!.id)).toHaveLength(0);
    expect(beatsForUnit(made.file, made.unitId).map((beat) => beat.title)).toEqual(['alone']);
  });
});

/**
 * Joining several into one (addendum 02 §6b, from Ken: *you should be able to
 * shift click several beats… and in this one it'll be merge*).
 *
 * What is protected is the same thing the cuts protect: **not a word moves**.
 * The reading refuses before the act can be asked for, and the sentence it
 * refuses with is one a writer can act on.
 */
describe('joining', () => {
  /** Three passages in one scene: a–b, c–d, e–h. */
  const three = (): ProjectFile => {
    let file = novel();
    const unit = file.units[0]!;
    const cut = splitBeatBefore(file, 'c');
    file = cut.file;
    return updateBeat(file, beatsForUnit(file, unit.id)[0]!.id, { title: 'first' });
  };

  it('joins a run of beats into the first, keeping its name and every word', () => {
    const file = three();
    const unit = file.units[0]!;
    const beats = beatsForUnit(file, unit.id);
    expect(beats.map((beat) => beat.manuscript.elements.map((element) => element.id))).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f', 'g', 'h']]);

    const offer = beatsJoin(file, [beats[0]!.id, beats[1]!.id], 'passage');
    expect(offer.may).toBe(true);
    if (offer.may) {
      expect(offer.says).toContain('2 passages become one');
      expect(offer.says).toContain('called first');
      expect(offer.says).toContain('Not a word is cut');
    }

    const joined = joinBeats(file, [beats[0]!.id, beats[1]!.id]);
    expect(typeof joined).not.toBe('string');
    if (typeof joined === 'string') return;
    const after = beatsForUnit(joined, unit.id);
    expect(after).toHaveLength(2);
    expect(after[0]!.title).toBe('first');
    expect(after.map((beat) => beat.manuscript.elements.map((element) => element.id))).toEqual([['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]);
    // The whole manuscript reads exactly as it did, which is the promise.
    expect(reading(joined)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('refuses in a sentence rather than reordering anybody’s writing', () => {
    const file = three();
    const beats = beatsForUnit(file, file.units[0]!.id);
    const one = beatsJoin(file, [beats[0]!.id]);
    expect(one).toEqual({ may: false, why: 'Choose two or more to join them.' });
    // The first and the third would have to carry the second's words with
    // them, which is a reordering nobody asked for.
    const apart = beatsJoin(file, [beats[0]!.id, beats[2]!.id]);
    expect(apart).toEqual({ may: false, why: 'They do not follow one another.' });
    expect(joinBeats(file, [beats[0]!.id, beats[2]!.id])).toBe('They do not follow one another.');

    // And two in different scenes are two scenes' business.
    const made = addUnit(file, { trackId: file.units[0]!.trackId, title: 'Elsewhere' });
    const other = addBeat(made.file, { unitId: made.unit.id, title: 'over there' });
    expect(beatsJoin(other.file, [beats[0]!.id, other.beat.id])).toEqual({
      may: false,
      why: 'They are in different ones. Join what is in one at a time.',
    });
  });

  /** The same act one level up — a script's scenes, a textbook's sections. */
  it('joins units, and says when a break goes with them', () => {
    let file = novel();
    const cut = splitUnitBefore(file, 'f');
    file = cut.file;
    const order = unitsInStoryOrder(file);
    expect(order).toHaveLength(2);
    // A break on the second one is the thing a writer would not guess at.
    file = addMarker(file, { unitId: order[1]!.id, kind: 'chapter', title: 'Two' }).file;

    const offer = unitsJoin(file, [order[0]!.id, order[1]!.id], 'section');
    expect(offer.may).toBe(true);
    if (offer.may) {
      expect(offer.says).toContain('2 sections become one');
      expect(offer.says).toContain('One break goes with them');
    }

    const joined = joinUnits(file, [order[0]!.id, order[1]!.id]);
    expect(typeof joined).not.toBe('string');
    if (typeof joined === 'string') return;
    expect(unitsInStoryOrder(joined)).toHaveLength(1);
    expect(reading(joined)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    // The break the second carried is gone; the first's is untouched.
    expect(contentsDivisions(joined)).toHaveLength(1);
  });
});
