import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addUnit,
  bookDocxParts,
  bookSettingsOf,
  bookSettingsSchema,
  createProjectFile,
  fillHeadFields,
  fillPageFields,
  geometryOf,
  layPages,
  renderBookPage,
  sectionIdOf,
  setBookSettings,
  setSectionLayout,
  titlePageOf,
  chapterPageStyleOf,
  bookNames,
  updateBeat,
  type BookBlock,
  type BookPage,
  type BookRenderContext,
  type BookSettings,
  type ManuscriptElementId,
  type Measured,
  type ProjectFile,
  type SectionLayout,
} from '../index.js';

/**
 * Headers and footers by division (addendum 43 §10, phase 4; Ken's citations
 * spec §6): the fields a head or foot may carry, a running foot, a division's
 * own heads, its opening page carrying them or standing clear, and page
 * numbers restarting or turning roman where a division says — in the Layout
 * room and in Word.
 */

const names = { title: 'The Sea', author: 'R. Jones' };

const make = (input: Partial<BookBlock> & Pick<BookBlock, 'id' | 'kind'>): BookBlock => ({
  numbering: 'arabic',
  starts: 'none',
  display: false,
  folio: true,
  keepWithNext: false,
  unbreakable: false,
  text: '',
  spans: [],
  chapterTitle: '',
  ...input,
});

const chapter = (n: number, title: string): BookBlock[] => [
  make({
    id: `ch${n}`,
    kind: 'chapter_opening',
    starts: 'recto',
    keepWithNext: true,
    unbreakable: true,
    chapterTitle: title,
    chapter: { label: `Chapter ${n}`, title, epigraph: '', summary: '', image: null, align: 'center', template: 'graphic_middle' },
    leaf: false,
  }),
  make({ id: `ch${n}p`, kind: 'paragraph', chapterTitle: title }),
];

const sections = (...layouts: Partial<SectionLayout>[]): BookSettings =>
  bookSettingsSchema.parse({ trim: { width: 6, height: 9 }, sections: layouts });

const lay = (settings: BookSettings, blocks: BookBlock[], measured: Record<string, number>) =>
  layPages(blocks, new Map(Object.entries(measured)) as Measured, geometryOf(settings, 'instructional', 100), settings, names);

const BLOCKS = [...chapter(1, 'The Pull'), ...chapter(2, 'The Turn')];
const LONG = { ch1: 6, ch1p: 150, ch2: 6, ch2p: 150 };

/** Where each chapter's opening page landed, and the pages after it. */
const from = (pages: BookPage[], id: string): BookPage[] => pages.slice(pages.findIndex((page) => page.pieces[0]?.blockId === id && page.pieces[0].from === 0));

describe('the fields', () => {
  it('fills the titles and the author when the book is laid, and the page’s own when it is drawn', () => {
    const text = '{title} · {chapter} · {author} — page {page} of {pages}, {date}';
    const laid = fillHeadFields(text, names, 'The Pull');
    expect(laid).toBe('The Sea · The Pull · R. Jones — page {page} of {pages}, {date}');
    expect(fillPageFields(laid, { page: 'iv', pages: 212, date: '22 October 2026' })).toBe('The Sea · The Pull · R. Jones — page iv of 212, 22 October 2026');
  });
});

describe('a division of its own', () => {
  it('keys a division by its record: a chapter’s marker, a part, a heading’s unit', () => {
    expect(sectionIdOf(BLOCKS[0]!)).toBe('ch1');
    expect(sectionIdOf(make({ id: 'p:0', kind: 'part_opening', partId: 'part-1' }))).toBe('part-1');
    expect(sectionIdOf(make({ id: 'h', kind: 'heading', starts: 'page', unitId: 'unit-9' }))).toBe('unit-9');
    expect(sectionIdOf(make({ id: 'h', kind: 'heading' }))).toBeNull();
  });

  it('restarts the page numbers where it says, in roman where it says', () => {
    const plain = lay(sections(), BLOCKS, LONG);
    const second = from(plain.pages, 'ch2');
    expect(Number(second[0]!.counted)).toBeGreaterThan(1);

    const restarted = lay(sections({ id: 'ch2', restart: true }), BLOCKS, LONG);
    expect(from(restarted.pages, 'ch2').slice(0, 3).map((page) => page.counted)).toEqual(['1', '2', '3']);
    expect(restarted.where.get('ch2')).toEqual({ numbering: 'arabic', number: 1 });

    const roman = lay(sections({ id: 'ch2', restart: true, numbering: 'roman' }), BLOCKS, LONG);
    expect(from(roman.pages, 'ch2').slice(0, 3).map((page) => page.counted)).toEqual(['i', 'ii', 'iii']);
  });

  it('gives its pages its own heads and foot, and the book’s back after it', () => {
    const settings = sections({ id: 'ch1', verso: 'Part One', recto: '{chapter}, continued', foot: '{title}' });
    const laid = lay(settings, BLOCKS, LONG);
    const first = from(laid.pages, 'ch1');
    const verso = first.find((page) => page.side === 'verso' && !page.opens)!;
    const recto = first.find((page) => page.side === 'recto' && !page.opens && page.runningHead)!;
    expect(verso.runningHead).toBe('Part One');
    expect(recto.runningHead).toBe('The Pull, continued');
    expect(recto.runningFoot).toBe('The Sea');
    const next = from(laid.pages, 'ch2').find((page) => page.side === 'recto' && !page.opens)!;
    expect(next.runningHead).toBe('The Turn');
    expect(next.runningFoot).toBe('');
  });

  it('stands its opening page clear of the heads and the foot, unless it asks for them', () => {
    const book = { ...sections(), runningHeads: { ...sections().runningHeads, foot: 'Page {page}' } };
    const clear = from(lay(book, BLOCKS, LONG).pages, 'ch1')[0]!;
    expect(clear.opens).toBe(true);
    expect([clear.runningHead, clear.runningFoot]).toEqual(['', '']);

    const carried = from(lay({ ...book, sections: [{ id: 'ch1', verso: null, recto: null, foot: null, headsOnOpening: true, restart: false, numbering: null }] }, BLOCKS, LONG).pages, 'ch1')[0]!;
    expect(carried.runningHead).toBe('The Pull');
    expect(carried.runningFoot).toBe('Page {page}');
  });
});

// ---------------------------------------------------------- a real book

const para = (text: string) => ({ id: crypto.randomUUID() as ManuscriptElementId, type: 'paragraph' as const, text, characterId: null, attributes: {} });

const book = (): { file: ProjectFile; markers: string[] } => {
  let file: ProjectFile = createProjectFile({ title: 'The Sea', format: 'instructional', author: 'R. Jones' });
  const markers: string[] = [];
  for (const title of ['The Pull', 'The Turn']) {
    const unit = addUnit(file, { trackId: file.tracks[0]!.id, title });
    const marked = addMarker(unit.file, { unitId: unit.unit.id, kind: 'chapter', title });
    file = marked.file;
    markers.push(marked.marker.id);
    const beat = addBeat(file, { unitId: unit.unit.id });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [para(`On ${title.toLowerCase()}.`)] } });
  }
  return { file, markers };
};

describe('drawing the page', () => {
  it('prints the running foot with the page’s number, the count and the date', () => {
    const { file } = book();
    const settings = bookSettingsOf(file);
    const context: BookRenderContext = {
      settings,
      geometry: { ...geometryOf(settings, 'instructional', 100), pages: 212 },
      chapterStyle: chapterPageStyleOf(file),
      paragraphStyle: 'indented',
      pictures: new Map(),
      names: bookNames(file),
      titlePage: titlePageOf(file.project, file.settings),
      contents: [],
      index: null,
      today: '22 October 2026',
    };
    const page: BookPage = {
      sheet: 8, side: 'recto', numbering: 'arabic', number: 7, folio: '7', counted: '7', runningHead: '{chapter}', runningFoot: 'Page {page} of {pages} · {date}',
      chapterTitle: 'The Pull', display: false, blank: false, opens: false, pieces: [], notes: [], depth: 0, target: 30,
    };
    const html = renderBookPage(page, new Map(), context);
    expect(html).toContain('<div class="bk-running-foot recto centre">Page 7 of 212 · 22 October 2026</div>');
  });
});

describe('the book in Word', () => {
  it('makes each division a section with its own left- and right-hand headers and a clear first page', () => {
    const { file } = book();
    const named = setBookSettings(file, { runningHeads: { ...bookSettingsOf(file).runningHeads, verso: 'title', recto: 'chapter', foot: 'Page {page} of {pages}' } });
    const { document, bands } = bookDocxParts(named);
    const headers = bands.filter((band) => band.kind === 'header').map((band) => band.xml);
    expect(headers.some((xml) => xml.includes('>The Pull<') && xml.includes('w:val="center"'))).toBe(true);
    expect(headers.some((xml) => xml.includes('>The Turn<'))).toBe(true);
    expect(headers.some((xml) => xml.includes('>The Sea<'))).toBe(true);
    const footers = bands.filter((band) => band.kind === 'footer').map((band) => band.xml);
    expect(footers.some((xml) => xml.includes(' NUMPAGES ') && xml.includes('Page '))).toBe(true);
    expect(document).toContain('<w:headerReference w:type="even"');
    expect(document).toContain('<w:titlePg/>');
  });

  it('restarts a division’s numbers in roman, and lets it carry its heads on its first page', () => {
    const { file, markers } = book();
    const second = markers[1]!;
    const changed = setSectionLayout(file, second, { restart: true, numbering: 'roman', headsOnOpening: true, recto: 'Appendix' });
    const { document, bands } = bookDocxParts(changed);
    // The section the second chapter ends with.
    const at = document.indexOf('On the turn.');
    const last = document.slice(document.indexOf('<w:sectPr>', at), document.indexOf('</w:sectPr>', at));
    expect(last).toContain('<w:pgNumType w:fmt="lowerRoman" w:start="1"/>');
    expect(last).not.toContain('<w:titlePg/>');
    expect(bands.some((band) => band.xml.includes('>Appendix<'))).toBe(true);
  });

  it('forgets a division put back to the book’s in every respect', () => {
    const { file, markers } = book();
    const set = setSectionLayout(file, markers[0]!, { restart: true });
    expect(bookSettingsOf(set).sections).toHaveLength(1);
    expect(bookSettingsOf(setSectionLayout(set, markers[0]!, { restart: false })).sections).toEqual([]);
  });
});
