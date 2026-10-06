import { describe, expect, it } from 'vitest';
import {
  ALL_CHAPTER_MARKS,
  CHAPTER_MARKS,
  defaultSplit,
  describeMarks,
  formatForKind,
  buildProjectFromImport,
  docxToProse,
  importChoices,
  landsInLayout,
  NO_CHAPTER_MARKS,
  opensChapter,
  type ChapterMarks,
} from '../index.js';

/**
 * What there is to import (addendum 33).
 *
 * What is pinned here is the half a screen cannot be trusted with: **which
 * rows are offered where**, since a row that can only refuse is the fault
 * this room has removed a dozen times, and **that turning every mark off
 * really does stop the document dividing** — the one option whose effect is
 * invisible until a four-hundred-page manuscript arrives in four hundred
 * pieces.
 */

/** A paragraph as the Word reader hands one over. */
const PARA = {
  text: '',
  plain: '',
  styleId: '',
  styleName: '',
  outline: null,
  align: 'left' as const,
  indentLeft: 0,
  firstLine: 0,
  face: null,
  size: null,
  caps: false,
  pageBreakBefore: false,
  list: false,
  pictures: [],
};

const line = (over: Partial<Parameters<typeof opensChapter>[0]> = {}) => ({
  text: '',
  plain: '',
  styleId: '',
  styleName: '',
  outline: null,
  align: 'left' as const,
  indentLeft: 0,
  firstLine: 0,
  face: null,
  size: null,
  caps: false,
  pageBreakBefore: false,
  list: false,
  pictures: [],
  ...over,
});

describe('what the chooser offers', () => {
  const kinds = (format: Parameters<typeof importChoices>[0]) =>
    importChoices(format).map((choice) => choice.kind);

  it('offers the four that make a project with nothing open', () => {
    expect(kinds(null)).toEqual(['script', 'novel', 'instructional', 'collection']);
  });

  it('offers notes only once there is a project to put them in', () => {
    expect(kinds(null)).not.toContain('notes');
    expect(kinds('screenplay')).toContain('notes');
  });

  it('offers graphics only where there is a library to land in', () => {
    // Research ▸ Graphics is every prose format's and no script's, so the row
    // would route to a shelf the menu does not draw.
    expect(kinds(null)).not.toContain('graphics');
    expect(kinds('screenplay')).not.toContain('graphics');
    expect(kinds('short_form')).not.toContain('graphics');
    expect(kinds('novel')).toContain('graphics');
    expect(kinds('instructional')).toContain('graphics');
    expect(kinds('short_story')).toContain('graphics');
  });

  it('offers more stories only in a collection and more episodes only in a series', () => {
    expect(kinds('short_story')).toContain('stories');
    expect(kinds('short_story')).not.toContain('episodes');
    expect(kinds('series')).toContain('episodes');
    expect(kinds('series')).not.toContain('stories');
    expect(kinds('novel')).not.toContain('stories');
    expect(kinds('novel')).not.toContain('episodes');
  });

  it('says on the row whether it replaces what is open or goes into it', () => {
    // The question the old two-item menu answered only by being pressed.
    const open = importChoices('short_story');
    expect(open.find((one) => one.kind === 'novel')?.landing).toBe('project');
    expect(open.find((one) => one.kind === 'stories')?.landing).toBe('here');
    expect(open.find((one) => one.kind === 'notes')?.landing).toBe('here');
  });

  it('every row says what it does', () => {
    for (const choice of importChoices('series')) {
      expect(choice.label.length).toBeGreaterThan(0);
      expect(choice.note.length).toBeGreaterThan(0);
    }
  });

  it('leaves where it lands to the heading, and says it in the note', () => {
    // From Ken, of the graphics row: *just call it graphics*. The heading
    // *Into this project* stands once above all four, so a label repeating it
    // is the fact said twice; where each one actually goes is in its note.
    for (const choice of importChoices('short_story').filter((one) => one.landing === 'here')) {
      expect(choice.label).not.toMatch(/\binto\b/i);
    }
    expect(importChoices('novel').find((one) => one.kind === 'graphics')?.label).toBe('Graphics');
    expect(importChoices('novel').find((one) => one.kind === 'notes')?.label).toBe('Notes');
  });

  it('names the format each project-making kind makes, and none for the rest', () => {
    expect(formatForKind('novel')).toBe('novel');
    expect(formatForKind('instructional')).toBe('instructional');
    expect(formatForKind('collection')).toBe('short_story');
    expect(formatForKind('script')).toBe('screenplay');
    expect(formatForKind('notes')).toBeNull();
    expect(formatForKind('graphics')).toBeNull();
    expect(formatForKind('stories')).toBeNull();
  });
});

describe('where the chapters fall', () => {
  it('reads every mark when it is given none, which is what it always did', () => {
    expect(opensChapter(line({ outline: 0, plain: 'Anything' }))).toBe(true);
    expect(opensChapter(line({ plain: 'Chapter Seven' }))).toBe(true);
    expect(opensChapter(line({ plain: 'IV' }))).toBe(true);
    expect(opensChapter(line({ plain: 'THE ROAD', pageBreakBefore: true, caps: true }))).toBe(true);
  });

  it('reads each one only where it is left on', () => {
    const only = (id: keyof ChapterMarks): ChapterMarks => ({ ...NO_CHAPTER_MARKS, [id]: true });
    expect(opensChapter(line({ plain: 'IV' }), only('numeral'))).toBe(true);
    expect(opensChapter(line({ plain: 'IV' }), only('chapterLine'))).toBe(false);
    expect(opensChapter(line({ plain: 'Chapter Seven' }), only('chapterLine'))).toBe(true);
    expect(opensChapter(line({ plain: 'Chapter Seven' }), only('heading'))).toBe(false);
    expect(opensChapter(line({ outline: 0, plain: 'Anything' }), only('heading'))).toBe(true);
    expect(opensChapter(line({ outline: 0, plain: 'Anything' }), only('numeral'))).toBe(false);
  });

  it('divides at nothing with every mark off', () => {
    // The option whose whole point is that the manuscript arrives whole.
    for (const mark of CHAPTER_MARKS) {
      expect(ALL_CHAPTER_MARKS[mark.id]).toBe(true);
      expect(NO_CHAPTER_MARKS[mark.id]).toBe(false);
    }
    expect(opensChapter(line({ outline: 0, plain: 'Chapter One' }), NO_CHAPTER_MARKS)).toBe(false);
    expect(opensChapter(line({ plain: 'IV' }), NO_CHAPTER_MARKS)).toBe(false);
  });

  it('never reads a picture as a chapter, whatever is on', () => {
    const picture = line({ outline: 0, plain: 'Plate', pictures: [{ dataUrl: 'data:image/png;base64,x', width: 1, height: 1 }] as never });
    expect(opensChapter(picture)).toBe(false);
  });

  it('says what is in force, and what to do instead when nothing is', () => {
    expect(describeMarks(ALL_CHAPTER_MARKS, 9)).toContain('9 chapters');
    expect(describeMarks(NO_CHAPTER_MARKS, 1)).toContain('one chapter');
    // Where nothing divides it, the sentence has to name the way out.
    expect(describeMarks(NO_CHAPTER_MARKS, 1)).toContain('Chapter tool');
    expect(describeMarks({ ...NO_CHAPTER_MARKS, numeral: true }, 3)).toContain('a numeral on its own');
  });

  it('keeps the capital that is the whole of what a mark is', () => {
    // *the word chapter* is a different claim from *the word Chapter*, and
    // the capital is the thing the reader looks for.
    expect(describeMarks({ ...NO_CHAPTER_MARKS, chapterLine: true }, 2)).toContain('the word Chapter');
  });

  it('names the units the format names them, never the literal word', () => {
    // The sentence stands an inch under a figure that reads the noun table,
    // so *3 Sections* over *3 chapters here* is one count said two ways.
    expect(describeMarks(ALL_CHAPTER_MARKS, 3, 'short_story')).toContain('3 sections');
    expect(describeMarks(ALL_CHAPTER_MARKS, 3, 'instructional')).toContain('3 sections');
    expect(describeMarks(ALL_CHAPTER_MARKS, 3, 'novel')).toContain('3 chapters');
    expect(describeMarks(NO_CHAPTER_MARKS, 1, 'short_story')).toContain('Section tool');
  });
});

describe('where it lands', () => {
  it('opens the Layout room on a collection and nowhere else', () => {
    // Ken's own *in between, it will create the layout where you can reorder
    // how the stories are*. A novel and a book arrive as one document whose
    // order is the document's, so there is nothing there to rearrange.
    expect(landsInLayout('short_story')).toBe(true);
    expect(landsInLayout('novel')).toBe(false);
    expect(landsInLayout('instructional')).toBe(false);
    expect(landsInLayout('screenplay')).toBe(false);
    expect(landsInLayout('series')).toBe(false);
  });
});

describe('how much is in a beat', () => {
  it('brings a novel and a book in whole, and a collection a paragraph at a time', () => {
    expect(defaultSplit('novel')).toBe('chapter');
    expect(defaultSplit('instructional')).toBe('chapter');
    // Addendum 21 §10's own ask, which this does not take back.
    expect(defaultSplit('short_story')).toBe('paragraph');
  });
});

describe('what a novel brings in', () => {
  it('reads a byline a title page actually carries, so the front matter is not chapter one', () => {
    // Driven on a realistic manuscript (addendum 33 §8): *a novel by K. Shank*
    // was left standing, so it became an untitled first chapter and every
    // chapter after it printed one too high.
    for (const line of ['by K. Shank', 'written by K. Shank', 'a novel by K. Shank', 'A Novel by K. Shank', 'The story by K. Shank']) {
      const read = docxToProse({
        paragraphs: [
          { ...PARA, plain: 'The Lamp', text: 'The Lamp', styleName: 'title', align: 'center' },
          { ...PARA, plain: line, text: line, align: 'center' },
          { ...PARA, plain: 'Chapter One', text: 'Chapter One', outline: 0 },
          { ...PARA, plain: 'The lamp went out.', text: 'The lamp went out.' },
        ],
      } as never);
      expect(read.author, line).toBe('K. Shank');
      expect(read.scenes[0]?.heading, line).toBe('Chapter One');
    }
  });

  it('never takes a sentence for a byline', () => {
    const line = 'She had been working by the light of one lamp';
    const read = docxToProse({
      paragraphs: [{ ...PARA, plain: line, text: line }],
    } as never);
    expect(read.author).toBe('');
    expect(read.scenes[0]?.elements[0]?.text).toBe(line);
  });

  it('stores no chapter number, the number being read off where the chapter falls', () => {
    // Two answers on one screen: the markers row said CHAPTER 1 · THE ROAD
    // and the row under it said Chapter 2, from this stored string.
    const built = buildProjectFromImport(
      {
        title: 'The Lamp',
        author: '',
        source: 'docx',
        warnings: [],
        characters: [],
        locations: [],
        scenes: [
          { heading: 'Chapter One: The Road', elements: [{ type: 'paragraph', text: 'The lamp went out.' }] },
          { heading: 'Chapter Two', elements: [{ type: 'paragraph', text: 'Rain on the water.' }] },
        ],
      } as never,
      { format: 'novel' },
    );
    expect(built.file.units.map((unit) => unit.sequenceLabel)).toEqual(['', '']);
    // A screenplay's scene number is a convention nothing derives, so it stays.
    const script = buildProjectFromImport(
      {
        title: 'The Lamp',
        author: '',
        source: 'fdx',
        warnings: [],
        characters: [],
        locations: [],
        scenes: [{ heading: 'INT. HOUSE - DAY', elements: [] }],
      } as never,
      { format: 'screenplay' },
    );
    expect(script.file.units[0]?.sequenceLabel).toBe('Sc. 1');
  });
});
