import { describe, expect, it } from 'vitest';
import {
  appendImportedStory,
  bookBlocks,
  bookRows,
  buildProjectFromImport,
  paginateProject,
  removeBookRow,
  storiesOf,
  textToProse,
  whatGoesWithRow,
  type ProjectFile,
} from '../index.js';

/**
 * Chapters inside a story (addendum 22 §6), from Ken: *divide short stories
 * into chapters at the Roman numerals*.
 *
 * In a collection the chapter-kind marker is the **story**, so a chapter
 * within one is its section. Nothing new is stored: what makes a section
 * read as a chapter is that its heading opens a page, and the contents page
 * lists it under the story it falls in.
 */

const STORY = `The Lamp

The house stood at the end of the lane, and had been old when the church was new.

II

By the second winter nobody went past it after dark, and the lane was the poorer for it.

III

What happened in the spring is the part nobody in the village will repeat.
`;

const SECOND = `The bell rang across the water twice that morning, and nobody could say from where.

II

By the afternoon the harbour master had stopped pretending not to have heard it.
`;

describe('plain text divides at its headings', () => {
  it('reads Roman numerals as divisions rather than as paragraphs', () => {
    const script = textToProse(STORY, { title: 'The Lamp' });
    // Plain text carries no styles, so a line is a heading only by what it
    // says: the numerals divide, and the title line stays as it was written.
    expect(script.scenes.map((scene) => scene.heading)).toEqual(['', 'II', 'III']);
    // Not one undivided block, which is what it used to be.
    expect(script.scenes).toHaveLength(3);
    expect(script.scenes[1]!.elements[0]!.text).toMatch(/^By the second winter/);
  });

  it('reads Chapter One and a number word the same way', () => {
    const script = textToProse('Chapter One\n\nOne.\n\nSeven\n\nTwo.\n\nChapter 3: The Road\n\nThree.\n');
    expect(script.scenes.map((scene) => scene.heading)).toEqual(['Chapter One', 'Seven', 'Chapter 3: The Road']);
  });

  it('is not fooled by a sentence that opens with a numeral, or by typed page numbers', () => {
    const long = (n: number) => `${`Word${n} `.repeat(400)}`.trim();
    const script = textToProse(`II\n\n1\n\n${long(1)}\n\n2\n\n${long(2)}\n\n3\n\n${long(3)}\n`);
    // The counting-up bare numbers are the foot of each page, not chapters.
    expect(script.scenes.map((scene) => scene.heading)).toEqual(['II']);
  });

  it('keeps an undivided story whole rather than calling it a failure', () => {
    const script = textToProse('One.\n\nTwo.\n\nThree.\n');
    expect(script.scenes).toHaveLength(1);
    expect(script.scenes[0]!.elements).toHaveLength(3);
  });
});

/** A collection built from the story above, imported as one story. */
const collection = (): ProjectFile =>
  buildProjectFromImport(textToProse(STORY, { title: 'The Lamp' }), { format: 'short_story', title: 'The Lamp' }).file;

/** Two stories, so the book has a contents page to list them on. */
const twoStories = (): ProjectFile => {
  const file = collection();
  const added = appendImportedStory(file, textToProse(SECOND, { title: 'The Harbour' }), { title: 'The Harbour' });
  return added ? added.file : file;
};

describe('a story and its chapters', () => {
  it('stays one story, with the numerals as its sections', () => {
    const file = collection();
    const stories = storiesOf(file);
    expect(stories).toHaveLength(1);
    expect(stories[0]!.placed.marker.title).toBe('The Lamp');
    // The story opens with its own untitled section; the numerals title the rest.
    expect(stories[0]!.sections.map((unit) => unit.title)).toEqual(['', 'II', 'III']);
  });

  it('opens a new page at each chapter, the running head staying the story’s', () => {
    const blocks = bookBlocks(collection());
    const heads = blocks.filter((block) => block.kind === 'heading');
    expect(heads.map((block) => block.text)).toEqual(['II', 'III']);
    for (const head of heads) {
      // A new page, never a forced recto: a blank verso between every numeral
      // would be most of the paper in a ten-page story.
      expect(head.starts).toBe('page');
      expect(head.keepWithNext).toBe(true);
      // The head names the story, not the numeral: a reader turning the page
      // wants to know which story they are in.
      expect(head.chapterTitle).toBe('The Lamp');
    }
  });

  it('leaves a novel’s headings running on, a chapter there being a marker of its own', () => {
    const file = buildProjectFromImport(textToProse(STORY, { title: 'The Lamp' }), { format: 'novel', title: 'The Lamp' }).file;
    for (const block of bookBlocks(file).filter((one) => one.kind === 'heading')) {
      expect(block.starts).toBe('none');
    }
  });

  it('lists a story’s chapters under it on the contents page', () => {
    const contents = paginateProject(twoStories())[0]?.contents;
    expect(contents).toBeDefined();
    const entry = contents!.entries[0];
    expect(entry).toBeDefined();
    expect(entry!.title).toBe('The Lamp');
    // A collection numbers nothing, so the heading stands where a title
    // stands rather than out in the number's column.
    expect(entry!.sections.map((section) => section.title)).toEqual(['II', 'III']);
    expect(entry!.sections.every((section) => section.number === '')).toBe(true);
    // And the second story lists its own, not the first's.
    expect(contents!.entries[1]?.sections.map((section) => section.title)).toEqual(['II']);
  });
});

describe('the chapters on the Layout rail', () => {
  it('sits them under their story', () => {
    const rows = bookRows(collection()).filter((row) => row.kind === 'chapter' || row.kind === 'section');
    expect(rows.map((row) => `${'  '.repeat(row.depth)}${row.title}`)).toEqual(['The Lamp', '  II', '  III']);
  });

  it('takes a chapter break off without cutting a word', () => {
    const file = collection();
    const row = bookRows(file).find((one) => one.title === 'II')!;
    expect(whatGoesWithRow(file, row)).toContain('not a word is cut');
    const after = removeBookRow(file, row);
    expect(bookRows(after).some((one) => one.title === 'II')).toBe(false);
    expect(after.beats.flatMap((beat) => beat.manuscript.elements.map((element) => element.text)).join(' ')).toContain('By the second winter');
    // And the page stops opening there.
    expect(bookBlocks(after).filter((one) => one.kind === 'heading').map((one) => one.text)).toEqual(['III']);
  });
});
