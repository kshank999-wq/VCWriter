import { describe, expect, it } from 'vitest';
import {
  appendImportedStory,
  buildProjectFromImport,
  storiesOf,
  storyHeadings,
  textToProse,
  unplacedSections,
  type ImportedScript,
} from '../index.js';

/**
 * **Importing several stories at once** (addendum 22 §8, from Ken: *I
 * imported three stories and in the layout under stories only two of them
 * show up… it seems to have merged two stories that were imported at the
 * same time, naming it with the second*).
 *
 * The first document was read by a control the rest never saw — *one story or
 * many*, asked of **the first document** — so a collection whose divisions are
 * numerals came in as a run of nameless stories, or as none at all, while
 * every file after it arrived as one whole, named story. Its sections then
 * stood in front of every story, which nothing lists and which the book draws
 * under whatever division follows them.
 */

/** A read document, the way the dialog hands one to the builder. */
const script = (title: string, scenes: ReadonlyArray<[string, string]>): ImportedScript => ({
  source: 'docx',
  title,
  author: '',
  scenes: scenes.map(([heading, text]) => ({
    heading,
    elements: text ? [{ type: 'paragraph' as const, text }] : [],
  })),
  characters: [],
  locations: [],
  warnings: [],
});

/** A short story as a manuscript divides one: numerals, and nothing named. */
const HARBOUR = script('The Harbour', [
  ['I', 'Rain moved across the harbour in sheets.'],
  ['II', 'The boat was gone by six.'],
]);
const POUND = script('In For A Pound', [
  ['I', 'He counted the coins twice.'],
  ['II', 'Then once more, for luck.'],
]);
/** A collection in one file: headings that really do name stories. */
const BOTH = script('Collected Stories', [
  ['The Harbour', 'Rain moved across the harbour in sheets.'],
  ['In For A Pound', 'He counted the coins twice.'],
]);
/** The same, opening on front matter that no heading names. */
const WITH_FRONT = script('Collected Stories', [
  ['', 'For the keeper, who stayed.'],
  ['The Harbour', 'Rain moved across the harbour in sheets.'],
  ['In For A Pound', 'He counted the coins twice.'],
]);

const collection = (one: ImportedScript, stories: 'one' | 'many') =>
  buildProjectFromImport(one, { format: 'short_story', stories }).file;

describe('which headings begin a story', () => {
  it('counts a named heading and never a bare numeral', () => {
    // A numeral is how a short story divides inside itself (addendum 21 §10),
    // and a numeral made a story carries no name at all — a collection
    // numbers nothing, so there is no label either, and the writer is handed
    // a row with nothing on it.
    expect(storyHeadings(HARBOUR)).toEqual([]);
    expect(storyHeadings(BOTH)).toEqual(['The Harbour', 'In For A Pound']);
    // Plain text names no headings at all: a line divides by what it says
    // (addendum 22 §6), so nothing in one can begin a story.
    expect(storyHeadings(textToProse('The Harbour\n\nI\n\nRain.\n', { title: 'ken' }))).toEqual([]);
  });
});

describe('a collection read as a collection', () => {
  it('keeps a document divided at numerals as one named story, with the numerals in the words', () => {
    // What *a collection — each heading begins a story* used to make of it:
    // nameless stories, or none at all, with nothing saying why.
    const file = collection(HARBOUR, 'many');
    const stories = storiesOf(file);
    expect(stories).toHaveLength(1);
    expect(stories[0]?.placed.marker.title).toBe('The Harbour');
    expect(unplacedSections(file)).toHaveLength(0);
    // Not a word is lost to the reading: the numerals are still in the
    // manuscript, where §6 draws them as the chapters of the story.
    const headings = file.beats.flatMap((beat) =>
      beat.manuscript.elements.filter((element) => element.type === 'heading').map((element) => element.text),
    );
    expect(headings).toEqual(['I', 'II']);
  });

  it('makes a story of each named heading, each with its own name', () => {
    const file = collection(BOTH, 'many');
    expect(storiesOf(file).map((one) => one.placed.marker.title)).toEqual(['The Harbour', 'In For A Pound']);
    expect(unplacedSections(file)).toHaveLength(0);
  });

  it('takes the words in front of the first story into it rather than leaving them outside every story', () => {
    const file = collection(WITH_FRONT, 'many');
    expect(unplacedSections(file)).toHaveLength(0);
    // The marker moved back rather than a story being invented: still two
    // stories, still their own names, the first now holding what opened it.
    const stories = storiesOf(file);
    expect(stories.map((one) => one.placed.marker.title)).toEqual(['The Harbour', 'In For A Pound']);
    expect(stories[0]?.sections).toHaveLength(2);
    expect(stories[0]?.words).toBeGreaterThan(0);
  });
});

describe('several documents at once', () => {
  it('gives a story per document, each named, with nothing standing outside one', () => {
    // Ken's own sequence: two chosen together, then a third separately. What
    // he got was two stories for three files, the first swallowed by the
    // second — so what is asserted is one story per file, in the order given.
    let file = collection(HARBOUR, 'one');
    for (const next of [POUND, script('Falling', [['I', 'The ladder gave way.']])]) {
      const added = appendImportedStory(file, next, { title: next.title });
      if (added) file = added.file;
    }
    expect(storiesOf(file).map((one) => one.placed.marker.title)).toEqual([
      'The Harbour',
      'In For A Pound',
      'Falling',
    ]);
    expect(unplacedSections(file)).toHaveLength(0);
    // Each keeps its own sections, so nothing of one is read under another.
    expect(storiesOf(file).map((one) => one.sections.length)).toEqual([2, 2, 1]);
  });
});
