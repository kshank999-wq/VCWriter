import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addUnit,
  createProjectFile,
  joinUnits,
  labelStyle,
  removeUnit,
  renumberSections,
  sectionLabel,
  unitsInStoryOrder,
  updateBeat,
  updateUnit,
  type ProjectFile,
} from '../index.js';

/**
 * **The numerals a chapter is headed with** (addendum 33 §11, from Ken: *I
 * merged two sections and made it one chapter. I would like it to
 * automatically update the title headings if they're Roman numerals… if you
 * rename it in the chapter portion, it should rename that heading also*).
 *
 * Two rules: a bare numeral is the program's counting and is kept in step,
 * and a name is typed once. What the second half of each test pins is the
 * refusal — a heading with words in it is the writer's, and nothing here
 * rewrites a manuscript on the strength of a count.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const head = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'heading' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A story divided at its numerals, the way an imported manuscript arrives. */
const story = (titles: readonly string[], project?: ProjectFile): ProjectFile => {
  let file = project ?? createProjectFile({ title: 'Harbour Tales', format: 'short_story' });
  const track = file.tracks[0]!.id;
  // The section a project is born with is not one of these (addendum 28 §4d),
  // and leaving it in would make every index here one out.
  const seed = project ? null : unitsInStoryOrder(file)[0]!.id;
  const made: string[] = [];
  for (const title of titles) {
    const unit = addUnit(file, { trackId: track, title });
    file = unit.file;
    made.push(unit.unit.id as string);
    const beat = addBeat(file, { unitId: unit.unit.id, title: `${title} beat` });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [head(title), para(`${title} — the words of it.`)] } as never,
    });
  }
  return seed ? removeUnit(file, seed) : file;
};

const headings = (file: ProjectFile): string[] =>
  unitsInStoryOrder(file)
    .map((unit) => file.beats.find((beat) => beat.unitId === unit.id)?.manuscript.elements[0])
    .filter((element) => element?.type === 'heading')
    .map((element) => element!.text);

describe('how a bare label is written', () => {
  it('is read back off the one that is there, never chosen here', () => {
    expect(labelStyle('IV.')).toEqual({ kind: 'roman', caps: true, dot: true });
    expect(labelStyle('iv')).toEqual({ kind: 'roman', caps: false, dot: false });
    expect(labelStyle('7.')).toEqual({ kind: 'arabic', caps: false, dot: true });
    expect(labelStyle('Three')).toEqual({ kind: 'word', caps: true, dot: false });
    // A heading with words in it is not a label at all.
    expect(labelStyle('The Lighthouse')).toBeNull();
    expect(labelStyle('')).toBeNull();
  });

  it('writes the position back in that same style', () => {
    expect(sectionLabel(4, { kind: 'roman', caps: true, dot: true })).toBe('IV.');
    expect(sectionLabel(4, { kind: 'roman', caps: false, dot: false })).toBe('iv');
    expect(sectionLabel(12, { kind: 'arabic', caps: false, dot: false })).toBe('12');
    expect(sectionLabel(3, { kind: 'word', caps: true, dot: true })).toBe('Three.');
  });
});

describe('merging two chapters', () => {
  it('puts the numerals after them back in order', () => {
    // Ken's own act, and the whole of the report.
    const file = story(['I.', 'II.', 'III.', 'IV.']);
    const order = unitsInStoryOrder(file);
    const joined = joinUnits(file, [order[0]!.id, order[1]!.id]);
    expect(typeof joined).not.toBe('string');
    expect(headings(joined as ProjectFile)).toEqual(['I.', 'II.', 'III.']);
  });

  it('counts each story from one, rather than straight on through the book', () => {
    // `divisionSpan`'s rule read over units: a marker starts the count again,
    // so chapter one of the second story is chapter one.
    let file = story(['I.', 'II.']);
    const first = unitsInStoryOrder(file)[0]!;
    file = addMarker(file, { kind: 'chapter', unitId: first.id as never, title: 'The Harbour' }).file;
    file = story(['I.', 'II.', 'III.'], file);
    const second = unitsInStoryOrder(file)[2]!;
    file = addMarker(file, { kind: 'chapter', unitId: second.id as never, title: 'In For A Pound' }).file;
    const order = unitsInStoryOrder(file);
    const joined = joinUnits(file, [order[2]!.id, order[3]!.id]) as ProjectFile;
    expect(headings(joined)).toEqual(['I.', 'II.', 'I.', 'II.']);
  });

  it('leaves a chapter the writer named alone', () => {
    // The refusal that matters: renumbering *The Lighthouse* would be this
    // program rewriting somebody's manuscript.
    const file = story(['The Harbour', 'The Lighthouse', 'The Wreck']);
    const order = unitsInStoryOrder(file);
    const joined = joinUnits(file, [order[0]!.id, order[1]!.id]) as ProjectFile;
    expect(headings(joined)).toEqual(['The Harbour', 'The Wreck']);
  });

  it('counts again when a chapter is removed, which is the other way the count changes', () => {
    const file = story(['I.', 'II.', 'III.']);
    const order = unitsInStoryOrder(file);
    expect(headings(removeUnit(file, order[0]!.id))).toEqual(['I.', 'II.']);
  });

  it('changes nothing where the numerals already run in order', () => {
    const file = story(['I.', 'II.', 'III.']);
    expect(headings(renumberSections(file))).toEqual(['I.', 'II.', 'III.']);
    // And the units are the same objects: nothing was rewritten to say what
    // it already said, which is what keeps a save from happening on a look.
    expect(renumberSections(file).beats).toBe(file.beats);
  });
});

describe('renaming a chapter', () => {
  it('renames the heading it opens with, so it is not typed twice', () => {
    // *If you rename it in the chapter portion, it should rename that heading
    // also. So you don't have to go to do it in two places.*
    const file = story(['I.', 'II.']);
    const first = unitsInStoryOrder(file)[0]!;
    const named = updateUnit(file, first.id, { title: 'The Lighthouse' });
    expect(headings(named)).toEqual(['The Lighthouse', 'II.']);
    expect(unitsInStoryOrder(named)[0]!.title).toBe('The Lighthouse');
  });

  it('leaves a heading the writer made differ exactly as it is', () => {
    // Two strings the writer has deliberately parted are theirs, and a rename
    // somewhere else is no reason to rewrite the page.
    let file = story(['I.']);
    const unit = unitsInStoryOrder(file)[0]!;
    file = {
      ...file,
      beats: file.beats.map((beat) =>
        beat.unitId === unit.id
          ? { ...beat, manuscript: { ...beat.manuscript, elements: [head('The Harbour at Dusk'), ...beat.manuscript.elements.slice(1)] } }
          : beat,
      ),
    };
    expect(headings(updateUnit(file, unit.id, { title: 'Chapter One' }))).toEqual(['The Harbour at Dusk']);
  });

  it('does nothing where the chapter has no heading of its own', () => {
    // §9l already stands the title in on the page; there is nothing to keep
    // in step and nothing is written into the manuscript to make one.
    let file: ProjectFile = createProjectFile({ title: 'Tales', format: 'short_story' });
    const unit = unitsInStoryOrder(file)[0]!;
    const beat = addBeat(file, { unitId: unit.id, title: 'b' });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [para('Rain on the water.')] } as never });
    const named = updateUnit(file, unit.id, { title: 'The Harbour' });
    expect(named.beats.flatMap((one) => one.manuscript.elements).every((element) => element.type === 'paragraph')).toBe(true);
  });
});
