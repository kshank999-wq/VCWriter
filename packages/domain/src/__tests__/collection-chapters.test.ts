import { describe, expect, it } from 'vitest';
import {
  appendImportedStory,
  bookBlocks,
  bookRows,
  buildProjectFromImport,
  paginateProject,
  chapterPageStyleSchema,
  geometryOf,
  removeBookRow,
  renderBookBlock,
  bookSettingsOf,
  storiesOf,
  textToProse,
  whatGoesWithRow,
  type BookRenderContext,
  type ProjectFile,
} from '../index.js';

/** Enough of a render context to set one block; the type is the book's own. */
const contextFor = (file: ProjectFile): BookRenderContext =>
  ({
    settings: bookSettingsOf(file),
    geometry: geometryOf(bookSettingsOf(file), file.project.format, 100),
    chapterStyle: chapterPageStyleSchema.parse({}),
    paragraphStyle: 'indented',
    pictures: new Map(),
    names: { title: 'The Lamp', author: '', imprint: '' },
    titlePage: { title: '', author: '', titleImage: '' },
    contents: [],
    index: null,
  }) as unknown as BookRenderContext;

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

  it('sets the numeral the way any chapter opening is set, down the page and centred', () => {
    const file = collection();
    const blocks = bookBlocks(file);
    const head = blocks.find((block) => block.kind === 'heading')!;
    const html = renderBookBlock(head, contextFor(file));
    // The chapter opening's own markup, not a second style beside it: the
    // drop down the page and the number's type come from the book.
    expect(html).toContain('class="bk-opening"');
    expect(html).toContain('text-align:center');
    expect(html).toContain('<p class="bk-chapter-label">II</p>');
    expect(html).not.toContain('bk-heading"');
    // A heading that runs on in the prose is left as it was.
    const running = { ...head, starts: 'none' as const };
    expect(renderBookBlock(running, contextFor(file))).toContain('<p class="bk-heading"');
  });

  it('leaves a novel alone: there a heading is a chapter marker of its own', () => {
    const file = buildProjectFromImport(textToProse(STORY, { title: 'The Lamp' }), { format: 'novel', title: 'The Lamp' }).file;
    // The numerals became chapter markers on the way in, so there is no
    // heading in the manuscript for this rule to reach at all.
    expect(bookBlocks(file).filter((one) => one.kind === 'heading')).toHaveLength(0);
    expect(bookBlocks(file).filter((one) => one.kind === 'chapter_opening').length).toBeGreaterThan(1);
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

  /**
   * Addendum 20 §9b, from Ken: *when you select the Roman numeral under the
   * story, it needs to pop to that page like the other pages do*.
   *
   * The rail lists a chapter inside a story by its **unit**, while the block
   * that opens it carried the **heading element's** id — so nothing on a laid
   * page held the row's id, and the row could neither show its page nor turn
   * to it. `unitId` on the first block of each unit is what joins them, the
   * way `partId` already joins a part's row to its page.
   */
  it('gives every chapter row a block on the page it opens', () => {
    const file = collection();
    const blocks = bookBlocks(file);
    const rows = bookRows(file).filter((row) => row.kind === 'section');
    expect(rows.map((row) => row.title)).toEqual(['II', 'III']);

    for (const row of rows) {
      const opener = blocks.find((block) => block.unitId === row.id);
      expect(opener, `${row.title} has no block carrying its unit`).toBeDefined();
      // It is the numeral itself, which is what opens the page.
      expect(opener!.text).toBe(row.title);
      expect(opener!.starts).toBe('page');
    }

    // One block per unit and never more, or the rail would find whichever
    // page `find` reached first rather than the one it opens on.
    const stamped = blocks.filter((block) => block.unitId !== undefined).map((block) => block.unitId);
    expect(new Set(stamped).size).toBe(stamped.length);
  });

  it('gives a section with no heading one too, so its row still finds a page', () => {
    const file = collection();
    // The story's own first section is untitled and carries no numeral.
    const first = storiesOf(file)[0]!.sections[0]!;
    const opener = bookBlocks(file).find((block) => block.unitId === (first.id as string));
    expect(opener).toBeDefined();
    expect(opener!.kind).toBe('paragraph');
  });
});
