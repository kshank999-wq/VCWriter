import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addUnit,
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
