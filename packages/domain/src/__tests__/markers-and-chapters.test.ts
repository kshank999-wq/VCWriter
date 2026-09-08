import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addUnit,
  chapterPagesFor,
  createProjectFile,
  defaultMarkerNumbering,
  markerNumber,
  markerNumbering,
  paginateProject,
  placedMarkers,
  renderPrintDocumentHtml,
  setChapterPage,
  toLetters,
  toRoman,
  toWords,
  updateBeat,
  type ProjectFile,
  type ProjectFormat,
} from '../index.js';

/**
 * Markers, and the leaves a book puts between its chapters (addendum 02 §11).
 *
 * Every format has markers and every format means something different by
 * them: acts in a script, chapters in a book. What is tested here is the part
 * that would be wrong in a way nobody notices until it prints — the
 * numbering, and that a chapter page is a page of its own without disturbing
 * a word of the manuscript around it.
 */

/** A book of `chapters` chapters, each a unit with a page of prose in it. */
const book = (chapters: number, format: ProjectFormat = 'novel'): ProjectFile => {
  let file = createProjectFile({ title: 'The Lighthouse', format });
  const laneId = file.lanes[0]!.id;

  const fill = (unitId: string) => {
    const beat = file.beats.find((candidate) => (candidate.unitId as string) === unitId)!;
    file = updateBeat(file, beat.id, {
      manuscript: {
        elements: Array.from({ length: 6 }, (_, index) => ({
          id: `${unitId}-${index}` as never,
          type: 'paragraph' as const,
          text: `Paragraph ${index}. ${'The lamp turned and the sea answered. '.repeat(3)}`,
          characterId: null,
          attributes: {},
        })),
      },
    });
  };

  fill(file.units[0]!.id as string);
  for (let n = 1; n < chapters; n += 1) {
    const made = addUnit(file, { laneId, title: `Chapter ${n + 1}` });
    // A new unit has no beats; the prose needs one to live in.
    file = addBeat(made.file, { unitId: made.unit.id }).file;
    fill(made.unit.id as string);
  }
  return file;
};

const markAll = (file: ProjectFile): ProjectFile => {
  let next = file;
  for (const unit of next.units) {
    next = addMarker(next, { unitId: unit.id, title: '', kind: 'chapter' }).file;
  }
  return next;
};

describe('numbering', () => {
  it('counts in the schemes a book or a script actually uses', () => {
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(1994)).toBe('MCMXCIV');
    expect(toLetters(1)).toBe('A');
    expect(toLetters(27)).toBe('AA');
    expect(toWords(32)).toBe('Thirty-Two');
    expect(toWords(115)).toBe('One Hundred Fifteen');
    expect(markerNumber(3, 'symbol', '❦')).toBe('❦');
    expect(markerNumber(3, 'none')).toBe('');
  });

  it('gives each format the numbering it is written in, until told otherwise', () => {
    // A short story's sections are I, II, III; a novel counts its chapters.
    expect(defaultMarkerNumbering('short_story')).toBe('roman');
    expect(defaultMarkerNumbering('novel')).toBe('numeric');
    expect(defaultMarkerNumbering('screenplay')).toBe('roman');

    const story = markAll(book(3, 'short_story'));
    expect(placedMarkers(story).map((placed) => placed.label)).toEqual(['Chapter I', 'Chapter II', 'Chapter III']);

    // …and the writer can change it to anything, for the whole project at once.
    const numbered: ProjectFile = { ...story, settings: { ...story.settings, markerNumbering: 'words' } };
    expect(markerNumbering(numbered)).toBe('words');
    expect(placedMarkers(numbered).map((placed) => placed.label)).toEqual([
      'Chapter One',
      'Chapter Two',
      'Chapter Three',
    ]);
  });

  it('numbers a screenplay’s acts in capitals, as a script prints them', () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = addMarker(file, { unitId: file.units[0]!.id, title: 'The arrival', kind: 'act' }).file;
    expect(placedMarkers(file)[0]?.label).toBe('ACT I');
    // The writer's own title is beside the number, not instead of it.
    expect(placedMarkers(file)[0]?.marker.title).toBe('The arrival');
  });

  it('numbers each kind on its own count, so parts do not disturb chapters', () => {
    let file = book(3);
    const [first, second, third] = file.units;
    file = addMarker(file, { unitId: first!.id, title: '', kind: 'part' }).file;
    file = addMarker(file, { unitId: second!.id, title: '', kind: 'chapter' }).file;
    file = addMarker(file, { unitId: third!.id, title: '', kind: 'chapter' }).file;
    expect(placedMarkers(file).map((placed) => placed.label)).toEqual(['Part 1', 'Chapter 1', 'Chapter 2']);
  });
});

describe('the leaf a chapter opens with', () => {
  it('is a page of its own, and leaves the manuscript exactly as it was', () => {
    const plain = markAll(book(3));
    const before = paginateProject(plain);
    // Nothing is switched on yet, so nothing has changed.
    expect(before.some((page) => page.chapter)).toBe(false);

    let file = plain;
    for (const marker of file.markers) {
      file = setChapterPage(file, marker.id, { include: true, epigraph: 'The sea does not forgive.' });
    }
    const after = paginateProject(file);

    // Three more pages, each of them a leaf, and the manuscript's own pages
    // are the same pages with the same lines on them.
    expect(after.filter((page) => page.chapter)).toHaveLength(3);
    expect(after.length).toBe(before.length + 3);
    const prose = (pages: typeof after) => pages.filter((page) => !page.chapter).map((page) => page.lines);
    expect(prose(after)).toEqual(prose(before));

    // And they are numbered straight through, as a book is.
    expect(after.map((page) => page.number)).toEqual(after.map((_, index) => index + 1));
  });

  it('opens the chapter it belongs to, not the one before it', () => {
    let file = markAll(book(2));
    for (const marker of file.markers) file = setChapterPage(file, marker.id, { include: true });
    const pages = paginateProject(file);
    // The first page of the book is the first chapter's leaf.
    expect(pages[0]?.chapter).toBeDefined();
    // The second chapter's leaf comes after the first chapter's prose.
    const leaves = pages.map((page, index) => (page.chapter ? index : -1)).filter((index) => index >= 0);
    expect(leaves[0]).toBe(0);
    expect(leaves[1]).toBeGreaterThan(1);
  });

  it('is left out when the printing asks for it to be, without losing the design', () => {
    let file = markAll(book(2));
    for (const marker of file.markers) {
      file = setChapterPage(file, marker.id, { include: true, epigraph: 'Kept.' });
    }
    expect(chapterPagesFor(file)).toHaveLength(2);
    expect(chapterPagesFor(file, { includeChapterPages: false })).toHaveLength(0);
    expect(paginateProject(file, { includeChapterPages: false }).some((page) => page.chapter)).toBe(false);
    // The epigraph is still there for the next printing that wants it.
    expect(file.markers[0]?.page.epigraph).toBe('Kept.');
  });

  it('is not a thing a screenplay has', () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = addMarker(file, { unitId: file.units[0]!.id, title: 'Act one', kind: 'act' }).file;
    file = setChapterPage(file, file.markers[0]!.id, { include: true });
    expect(chapterPagesFor(file)).toHaveLength(0);
    expect(paginateProject(file).some((page) => page.chapter)).toBe(false);
  });

  it('keeps what was designed on it when it is switched off and on again', () => {
    let file = markAll(book(1));
    const markerId = file.markers[0]!.id;
    file = setChapterPage(file, markerId, { include: true, epigraph: 'A line.', align: 'left' });
    file = setChapterPage(file, markerId, { include: false });
    expect(file.markers[0]?.page.epigraph).toBe('A line.');
    file = setChapterPage(file, markerId, { include: true });
    expect(file.markers[0]?.page).toMatchObject({ include: true, epigraph: 'A line.', align: 'left' });
  });

  it('prints the number, the name and the epigraph, and escapes what it is given', () => {
    let file = markAll(book(1));
    file = { ...file, markers: file.markers.map((marker) => ({ ...marker, title: 'Salt & <b>smoke</b>' })) };
    file = setChapterPage(file, file.markers[0]!.id, { include: true, epigraph: 'The sea does not forgive.' });
    const html = renderPrintDocumentHtml(file);

    expect(html).toContain('chapter-page');
    expect(html).toContain('Chapter 1');
    expect(html).toContain('The sea does not forgive.');
    // The writer's own text is text, whatever it looks like.
    expect(html).toContain('Salt &amp; &lt;b&gt;smoke&lt;/b&gt;');
    expect(html).not.toContain('<b>smoke</b>');
  });
});
