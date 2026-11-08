import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addPart,
  addReference,
  addUnit,
  bibliographyLines,
  bookBlocks,
  bookCitationsOf,
  bookNames,
  bookSettingsOf,
  bookSettingsSchema,
  chapterPageStyleOf,
  createProjectFile,
  geometryOf,
  insertCitation,
  layPages,
  noteLines,
  partParagraphs,
  partsOf,
  renderBookPage,
  setCitationSettings,
  titlePageOf,
  updateBeat,
  updatePart,
  type BookBlock,
  type BookPage,
  type BookRenderContext,
  type ManuscriptElementId,
  type NotePlacements,
  type ProjectFile,
} from '../index.js';

/**
 * Citations in the printed book (addendum 43 §8, phase 2): the marker raised
 * in the line, the note at the foot of the page its marker falls on, the room
 * the cutter keeps for it, and the bibliography page made from the library.
 */

// ------------------------------------------------------------- the cutter

const settings = bookSettingsSchema.parse({ trim: { width: 6, height: 9 } });
const geometry = geometryOf(settings, 'novel', 200);
const LINES = geometry.linesPerPage;
const names = { title: 'Tides', author: 'R. Jones' };

const para = (id: string): BookBlock => ({
  id,
  kind: 'paragraph',
  numbering: 'arabic',
  starts: 'none',
  display: false,
  folio: true,
  keepWithNext: false,
  unbreakable: false,
  text: '',
  spans: [],
  chapterTitle: '',
});

const notes = (anchors: Record<string, { key: string; line: number }[]>, heights: Record<string, number>): NotePlacements => ({
  anchors: new Map(Object.entries(anchors)),
  heights: new Map(Object.entries(heights)),
});

const pageOf = (pages: BookPage[], key: string) => pages.findIndex((page) => page.notes.includes(key));
const textLines = (page: BookPage) => page.pieces.reduce((sum, piece) => sum + piece.to - piece.from, 0);

describe('the notes at the foot of the page', () => {
  it('counts a page’s notes together, rule and all, before rounding to whole lines', () => {
    const placed = notes({}, { a: 0.8, b: 0.8, c: 2.1 });
    expect(noteLines(placed, [])).toBe(0);
    // 0.6 for the rule, and two short notes share their lines.
    expect(noteLines(placed, ['a', 'b'])).toBe(3);
    expect(noteLines(placed, ['c'])).toBe(3);
  });

  it('keeps the lines a page’s notes need, so the text stops short of them', () => {
    const blocks = [para('p')];
    const laid = layPages(blocks, new Map([['p', LINES * 2]]), geometry, settings, names, undefined, notes({ p: [{ key: 'a', line: 3 }] }, { a: 1.9 }));
    const [first, second] = laid.pages;
    expect(first!.notes).toEqual(['a']);
    // 0.6 + 1.9 is three lines, taken from the text.
    expect(textLines(first!)).toBe(LINES - 3);
    expect(first!.depth).toBe(LINES);
    expect(second!.notes).toEqual([]);
  });

  it('puts a note on the page its marker reaches, following the line as the page breaks move', () => {
    const blocks = [para('p')];
    const late = LINES + 4;
    const laid = layPages(blocks, new Map([['p', LINES * 3]]), geometry, settings, names, undefined, notes({ p: [{ key: 'a', line: late }] }, { a: 1 }));
    // Line LINES+4 of the paragraph is on the second page, not the first.
    expect(pageOf(laid.pages, 'a')).toBe(1);
    expect(laid.pages[0]!.notes).toEqual([]);
    const second = laid.pages[1]!;
    const piece = second.pieces[0]!;
    expect(piece.from).toBeLessThanOrEqual(late);
    expect(piece.to).toBeGreaterThan(late);
  });

  it('sends the marker’s line over with its note when the note will not fit under it', () => {
    // A note five lines tall on the page's last line: the line goes over, and the note with it.
    const blocks = [para('p')];
    const last = LINES - 1;
    const laid = layPages(blocks, new Map([['p', LINES * 2]]), geometry, settings, names, undefined, notes({ p: [{ key: 'a', line: last }] }, { a: 5 }));
    const first = laid.pages[0]!;
    expect(first.notes).toEqual([]);
    expect(first.pieces[0]!.to).toBeLessThanOrEqual(last);
    expect(pageOf(laid.pages, 'a')).toBe(1);
  });

  it('never strands the cutter on a note taller than a page', () => {
    const blocks = [para('p'), para('q')];
    const laid = layPages(blocks, new Map([['p', 3], ['q', 3]]), geometry, settings, names, undefined, notes({ p: [{ key: 'a', line: 0 }] }, { a: LINES * 2 }));
    expect(laid.pages.length).toBeLessThan(5);
    expect(pageOf(laid.pages, 'a')).toBe(0);
    expect(laid.pages.flatMap((page) => page.pieces.map((piece) => piece.blockId))).toEqual(expect.arrayContaining(['p', 'q']));
  });

  it('lays a book with no citations exactly as before', () => {
    const blocks = [para('p'), para('q')];
    const measured = new Map([['p', LINES + 5], ['q', 9]]);
    const plain = layPages(blocks, measured, geometry, settings, names);
    const none = layPages(blocks, measured, geometry, settings, names, undefined, notes({}, {}));
    expect(none.pages.map((page) => page.pieces)).toEqual(plain.pages.map((page) => page.pieces));
  });
});

// ------------------------------------------------------------ the drawing

const book = (lines: string[]) => {
  let file: ProjectFile = createProjectFile({ title: 'The Sea', format: 'instructional' });
  const unit = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' });
  const beat = addBeat(unit.file, { unitId: unit.unit.id, title: 'a beat' });
  file = beat.file;
  const made = addReference(file, { title: 'On Tides', authors: ['Jones, Robert'], date: '2019', publisher: 'Sea Press', place: 'Boston' });
  file = made.file;
  const tokens: string[] = [];
  for (let at = 0; at < lines.filter((line) => line.includes('@')).length; at += 1) {
    const cited = insertCitation(file, { referenceId: made.reference.id, locator: String(12 + at) });
    file = cited.file;
    tokens.push(cited.token);
  }
  let next = 0;
  const elements = lines.map((line) => ({
    id: crypto.randomUUID() as ManuscriptElementId,
    type: 'paragraph' as const,
    text: line.replace('@', () => tokens[next++]!),
    characterId: null,
    attributes: {},
  }));
  return { file: updateBeat(file, beat.beat.id, { manuscript: { elements } }), elements };
};

const contextOf = (file: ProjectFile): BookRenderContext => {
  const own = bookSettingsOf(file);
  return {
    settings: own,
    geometry: geometryOf(own, file.project.format, 100),
    chapterStyle: chapterPageStyleOf(file),
    paragraphStyle: 'indented',
    pictures: new Map(),
    names: bookNames(file),
    titlePage: titlePageOf(file.project, file.settings),
    contents: [],
    index: null,
    citations: bookCitationsOf(file),
  };
};

const pageWith = (blockId: string, keys: string[]): BookPage => ({
  sheet: 3,
  side: 'recto',
  numbering: 'arabic',
  number: 1,
  folio: '1',
  counted: '1',
  runningHead: '',
  chapterTitle: '',
  display: false,
  blank: false,
  opens: false,
  pieces: [{ blockId, from: 0, to: 3 }],
  notes: keys,
  noteParts: [],
  depth: 3,
  target: 30,
});

describe('a note too long for its page (§12)', () => {
  /** Note lines from each page's parts of one note. */
  const partsOf = (pages: BookPage[], key: string) =>
    pages.flatMap((page, at) => page.noteParts.filter((part) => part.key === key).map((part) => ({ at, from: part.from, to: part.to })));

  it('breaks: at least two lines under its marker, the rest carried to the head of the next page’s notes', () => {
    const marker = LINES - 5;
    const laid = layPages([para('p')], new Map([['p', LINES * 2]]), geometry, settings, names, undefined, notes({ p: [{ key: 'a', line: marker }] }, { a: 12 }));
    const [first, second] = laid.pages;
    // The marker's line stays on the first page, with the text under it.
    expect(first!.pieces[0]!.to).toBeGreaterThan(marker);
    const parts = partsOf(laid.pages, 'a');
    expect(parts[0]).toMatchObject({ at: 0, from: 0 });
    expect(parts[0]!.to).toBeGreaterThanOrEqual(2);
    expect(parts[1]).toMatchObject({ at: 1, from: parts[0]!.to, to: 12 });
    // Every line of the note is set once.
    expect(parts.reduce((sum, part) => sum + part.to - part.from, 0)).toBe(12);
    // Each page is full and no fuller: text and notes, rule and all.
    for (const page of [first!, second!]) {
      const text = page.pieces.reduce((sum, piece) => sum + piece.to - piece.from, 0);
      expect(text + Math.ceil(0.6 + page.noteParts.reduce((sum, part) => sum + part.to - part.from, 0) - 0.02)).toBeLessThanOrEqual(LINES);
    }
  });

  it('keeps a short note whole: its line goes over with it', () => {
    const last = LINES - 1;
    const laid = layPages([para('p')], new Map([['p', LINES * 2]]), geometry, settings, names, undefined, notes({ p: [{ key: 'a', line: last }] }, { a: 4 }));
    expect(partsOf(laid.pages, 'a')).toEqual([{ at: 1, from: 0, to: 4 }]);
  });

  it('keeps the notes in order: a later note waits until the broken one has finished', () => {
    const laid = layPages(
      [para('p')],
      new Map([['p', LINES * 4]]),
      geometry,
      settings,
      names,
      undefined,
      notes({ p: [{ key: 'a', line: 3 }, { key: 'b', line: 6 }] }, { a: LINES * 2, b: 2 }),
    );
    const a = partsOf(laid.pages, 'a');
    const b = partsOf(laid.pages, 'b');
    expect(a.length).toBeGreaterThan(2);
    expect(b).toHaveLength(1);
    expect(b[0]!.at).toBeGreaterThanOrEqual(a[a.length - 1]!.at);
    // And b's marker went over with it, past the page the note finished on.
    const page = laid.pages[b[0]!.at]!;
    expect(page.pieces.some((piece) => piece.from <= 6 && piece.to > 6)).toBe(true);
  });

  it('carries a note past the end of the text onto a page of its own', () => {
    const laid = layPages([para('p')], new Map([['p', 5]]), geometry, settings, names, undefined, notes({ p: [{ key: 'a', line: 1 }] }, { a: LINES + 10 }));
    const parts = partsOf(laid.pages, 'a');
    expect(parts.reduce((sum, part) => sum + part.to - part.from, 0)).toBe(LINES + 10);
    const lastPage = laid.pages[parts[parts.length - 1]!.at]!;
    expect(lastPage.pieces).toEqual([]);
  });

  it('carries on the blank left-hand page before a chapter that opens on the right', () => {
    const opening = (id: string): BookBlock => ({ ...para(id), kind: 'chapter_opening', starts: 'recto', unbreakable: true, keepWithNext: true });
    const blocks = [opening('c1'), para('p'), opening('c2'), para('q')];
    // Chapter one ends on its first page, a recto, with a note too long for it.
    const laid = layPages(blocks, new Map([['c1', 4], ['p', LINES - 10], ['c2', 4], ['q', 5]]), geometry, settings, names, undefined, notes({ p: [{ key: 'a', line: LINES - 12 }] }, { a: 20 }));
    const parts = partsOf(laid.pages, 'a');
    expect(parts.length).toBe(2);
    const verso = laid.pages[parts[1]!.at]!;
    expect(verso.side).toBe('verso');
    expect(verso.pieces).toEqual([]);
    expect(verso.blank).toBe(false);
    // And chapter two still opens on the recto after it.
    const next = laid.pages[parts[1]!.at + 1]!;
    expect(next.pieces[0]!.blockId).toBe('c2');
  });

  it('draws the rest under a rule the width of the measure, clipped to its lines', () => {
    const { file, elements } = book(['Tides follow@ the moon.']);
    const key = file.citations[0]!.key;
    const blocks = new Map(bookBlocks(file).map((block) => [block.id, block]));
    const page = { ...pageWith(elements[0]!.id, [key]), noteParts: [{ key, from: 2, to: 4, lines: 4 }] };
    const html = renderBookPage(page, blocks, contextOf(file));
    expect(html).toContain('<div class="bk-notes continues"><div class="bk-note-part" style="height:');
    expect(html).toMatch(/<div style="margin-top:-[\d.]+px"><p class="bk-note"/);
  });
});

describe('the citation on the page', () => {
  it('raises the marker in the line and sets its note at the foot, the first in full and the next short', () => {
    const { file, elements } = book(['Tides follow@ the moon.', 'And turn@ again.']);
    const blocks = new Map(bookBlocks(file).map((block) => [block.id, block]));
    const keys = file.citations.map((one) => one.key);
    const html = renderBookPage(pageWith(elements[0]!.id, keys), blocks, contextOf(file));
    expect(html).toContain(`Tides follow<sup class="bk-cite" data-cite="${keys[0]}">1</sup> the moon.`);
    expect(html).not.toContain('[^');
    expect(html).toContain('<div class="bk-notes">');
    expect(html).toContain('<span class="bk-note-mark">1.</span> Robert Jones, <i>On Tides</i> (Boston: Sea Press, 2019), 12.');
    expect(html).toContain('<span class="bk-note-mark">2.</span> Jones, <i>On Tides</i>, 13.');
  });

  it('sets APA’s parenthetical in the line, after a space, with no notes', () => {
    const start = book(['Tides follow@.']);
    const file = setCitationSettings(start.file, { style: 'apa' });
    const blocks = new Map(bookBlocks(file).map((block) => [block.id, block]));
    const html = renderBookPage(pageWith(start.elements[0]!.id, []), blocks, contextOf(file));
    expect(html).toContain('Tides follow <span class="bk-cite-text">(Jones, 2019, p. 12)</span>.');
    expect(bookCitationsOf(file)!.notes.size).toBe(0);
    expect(html).not.toContain('bk-notes');
  });

  it('prints symbols as the writer chose them, bare at the head of the note', () => {
    const start = book(['Tides follow@ the moon.']);
    const file = setCitationSettings(start.file, { markers: 'symbol' });
    const blocks = new Map(bookBlocks(file).map((block) => [block.id, block]));
    const html = renderBookPage(pageWith(start.elements[0]!.id, file.citations.map((one) => one.key)), blocks, contextOf(file));
    expect(html).toContain('>*</sup>');
    expect(html).toContain('<span class="bk-note-mark">*</span>');
  });
});

// ------------------------------------------------------- the bibliography

describe('the bibliography page, made from the library', () => {
  const withPage = () => {
    const start = book(['Tides follow@ the moon.']);
    const added = addPart(start.file, 'bibliography');
    return { file: added.file, partId: added.partId! };
  };
  const pageOfBook = (file: ProjectFile, partId: string) => bookBlocks(file).filter((block) => block.partId === partId);

  it('prints the library’s entries in the book’s style, with the style’s heading, as hanging sources', () => {
    const { file, partId } = withPage();
    const blocks = pageOfBook(file, partId);
    const sources = blocks.filter((block) => block.role === 'source');
    expect(sources.map((block) => block.text)).toEqual(['Jones, Robert. *On Tides*. Boston: Sea Press, 2019.']);
    expect(blocks.some((block) => block.title === 'Bibliography' || block.chapterTitle === 'Bibliography')).toBe(true);

    const apa = setCitationSettings(file, { style: 'apa' });
    const part = partsOf(apa).find((one) => one.id === partId)!;
    expect(bibliographyLines(part, apa)).toMatchObject({ fromLibrary: true, heading: 'References' });
    expect(pageOfBook(apa, partId).filter((block) => block.role === 'source')[0]!.text).toBe('Jones, R. (2019). *On Tides*. Sea Press.');
  });

  it('keeps current: a changed source changes the page', () => {
    const { file, partId } = withPage();
    const changed = { ...file, references: file.references.map((one) => ({ ...one, title: 'Of Tides' })) };
    expect(pageOfBook(changed, partId).find((block) => block.role === 'source')!.text).toContain('*Of Tides*');
  });

  it('prints the typed sources instead when told to, or when the library has nothing', () => {
    const { file, partId } = withPage();
    const typed = updatePart(file, partId, {
      about: { sources: [{ id: 's1', author: 'Moon, Ada', title: 'Night', city: '', publisher: '', year: '1990', raw: '' }], fromLibrary: false },
    });
    const part = partsOf(typed).find((one) => one.id === partId)!;
    expect(partParagraphs(part, typed)).toEqual(['Moon, Ada. Night. 1990.']);
    expect(bibliographyLines(part, typed).fromLibrary).toBe(false);

    const empty = { ...typed, citations: [], references: [] };
    const on = updatePart(empty, partId, { about: { ...part.about, fromLibrary: true } });
    expect(partParagraphs(partsOf(on).find((one) => one.id === partId)!, on)).toEqual(['Moon, Ada. Night. 1990.']);
  });
});
