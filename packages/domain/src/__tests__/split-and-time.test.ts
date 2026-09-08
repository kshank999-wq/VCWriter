import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addBeat, addLane, addResearchItem, addUnit, linkEntities, splitUnit, updateBeat } from '../mutations.js';
import { beatsForUnit, unitsInStoryOrder } from '../selectors.js';
import { manuscriptElements } from '../pagination.js';
import { spanWidth, storyLayout, timecode } from '../story-layout.js';
import { threadLayout } from '../story-threads.js';
import { ref } from '../entities/links.js';
import { newId } from '../ids.js';
import type { ManuscriptElement, ManuscriptElementType } from '../entities/manuscript.js';
import type { ManuscriptElementId } from '../ids.js';

const el = (type: ManuscriptElementType, text: string): ManuscriptElement => ({
  id: newId<ManuscriptElementId>(),
  type,
  text,
  characterId: null,
  attributes: {},
});

/** One scene of three beats, each with a line, in a project with two lanes. */
const threeBeats = () => {
  let file = createProjectFile({ title: 'T', format: 'screenplay' });
  file = addLane(file, { name: 'Subplot' }).file;
  const unitId = file.units[0]!.id;
  file = updateBeat(file, file.beats[0]!.id, { title: 'One', manuscript: { elements: [el('action', 'ONE')] } });
  const second = addBeat(file, { unitId, title: 'Two' });
  file = updateBeat(second.file, second.beat.id, { manuscript: { elements: [el('action', 'TWO')] } });
  const third = addBeat(file, { unitId, title: 'Three' });
  file = updateBeat(third.file, third.beat.id, { manuscript: { elements: [el('action', 'THREE')] } });
  return { file, unitId, beats: [file.beats[0]!.id, second.beat.id, third.beat.id] as const };
};

describe('splitting a scene', () => {
  it('cuts at the beat, puts the rest in a new scene straight after, and leaves the script alone', () => {
    const { file, unitId, beats } = threeBeats();
    const before = manuscriptElements(file).map((element) => element.text);

    const split = splitUnit(file, unitId, beats[1]);

    // Two scenes, in that order, in the same lane.
    const order = unitsInStoryOrder(split.file);
    expect(order.map((unit) => unit.id)).toEqual([unitId, split.unit.id]);
    expect(split.unit.laneId).toBe(file.units[0]!.laneId);
    expect(split.unit.title).toBe('');

    // The beats went where they were told.
    expect(beatsForUnit(split.file, unitId).map((beat) => beat.title)).toEqual(['One']);
    expect(beatsForUnit(split.file, split.unit.id).map((beat) => beat.title)).toEqual(['Two', 'Three']);

    // And the manuscript reads exactly as it did: a cut is not a rewrite.
    expect(manuscriptElements(split.file).map((element) => element.text)).toEqual(before);
  });

  it('scoots the scenes after it along, rather than landing at the end', () => {
    const { file, unitId, beats } = threeBeats();
    const later = addUnit(file, { laneId: file.lanes[1]!.id, title: 'Later' });
    const split = splitUnit(later.file, unitId, beats[2]);
    expect(unitsInStoryOrder(split.file).map((unit) => unit.title)).toEqual(['Opening Scene', '', 'Later']);
  });

  it('refuses to split at the first beat, and at a beat that is not in the scene', () => {
    const { file, unitId, beats } = threeBeats();
    expect(() => splitUnit(file, unitId, beats[0])).toThrow(/first beat/);
    const other = addUnit(file, { laneId: file.lanes[0]!.id });
    const stray = addBeat(other.file, { unitId: other.unit.id });
    expect(() => splitUnit(stray.file, unitId, stray.beat.id)).toThrow(/not in/);
  });
});

describe('a page is a minute', () => {
  it('reads the page axis as a running time', () => {
    expect(timecode(0)).toBe('0:00');
    expect(timecode(1)).toBe('1:00');
    expect(timecode(2.5)).toBe('2:30');
    expect(timecode(95)).toBe('1:35:00');
  });

  it('gives every scene a width that answers the zoom', () => {
    const { file } = threeBeats();
    const [span] = storyLayout(file).spans;
    // The same short scene, at three zoom levels: three different widths.
    const widths = [80, 200, 400].map((zoom) => spanWidth(span!, zoom));
    expect(new Set(widths).size).toBe(3);
    expect(widths[0]).toBeLessThan(widths[2] as number);
  });
});

describe('themes on the timeline', () => {
  it('runs a theme through the scenes it is linked to', () => {
    const { file, unitId } = threeBeats();
    const themes = file.researchCategories.find((category) => category.systemKey === 'themes')!;
    let next = addResearchItem(file, { categoryId: themes.id, title: 'Faith and doubt' });
    const item = next.researchItems[next.researchItems.length - 1]!;
    next = linkEntities(next, { from: ref('research_item', item.id), to: ref('unit', unitId), type: 'relates_to' });

    const [thread] = threadLayout(next).themes;
    expect(thread?.name).toBe('Faith and doubt');
    expect(thread?.appearances.map((appearance) => appearance.index)).toEqual([0]);

    // A theme nobody has linked to anything is not a thread yet.
    expect(threadLayout(file).themes).toEqual([]);
  });
});
