import { describe, expect, it } from 'vitest';
import {
  addIndexRef,
  bookIndex,
  bookIndexOf,
  elementPages,
  marksUnder,
  paginateProject,
  collapseRuns,
  createProjectFile,
  describeIndex,
  findForIndex,
  hasBookIndex,
  markForIndex,
  renameHeading,
  runsText,
  unmarkIndex,
  updateIndexMark,
  addBeat,
  addUnit,
  updateBeat,
  type ManuscriptElementId,
  type ProjectFile,
} from '../index.js';

/**
 * The back-of-book index (addendum 10).
 *
 * A contents page and an index are not the same thing twice: a contents page
 * lists the divisions in the order they happen, and an index lists what the
 * book is *about*, alphabetically, wherever it is discussed.
 *
 * The claims worth defending are the two the whole design rests on: **a mark
 * is an anchor the writer places and never a search**, and **no page number is
 * ever stored** — the index is read off the pagination every time, which is
 * why the numbers follow the writing with nothing running.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A book of one scene, whose paragraphs are the passages to index. */
const book = (lines: string[]) => {
  let file: ProjectFile = createProjectFile({ title: 'The Lighthouse Keeper', format: 'novel' });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
  const elements = lines.map(para);
  file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements } });
  return { file, beatId: beat.beat.id, elements };
};

/** An index read with a stated page for each element, standing in for the layout. */
const read = (file: ProjectFile, pages: Record<string, number>) =>
  bookIndex({
    marks: file.indexMarks,
    refs: file.indexRefs,
    pageOfElement: (id) => pages[id] ?? 0,
  });

describe('whose book has one', () => {
  it('is a book, and never a script or a stack of them', () => {
    // A series numbers each script from its own page one, so "page 34" would
    // name three pages at once — the same reason its contents counts sheets.
    expect(hasBookIndex('novel')).toBe(true);
    expect(hasBookIndex('short_story')).toBe(true);
    expect(hasBookIndex('screenplay')).toBe(false);
    expect(hasBookIndex('series')).toBe(false);
  });
});

describe('marking a passage', () => {
  it('files it under the writer’s heading rather than the passage’s words', () => {
    // The paragraph says "the lens"; the index says "lenses, Fresnel". An
    // index that could only use the words on the page is a concordance.
    const { file, beatId, elements } = book(['He cleaned the lens until it threw light twelve miles.']);
    const marked = markForIndex(file, {
      term: 'lenses',
      subTerm: 'Fresnel',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
      quote: 'He cleaned the lens',
    });

    expect(marked.mark?.term).toBe('lenses');
    expect(marked.mark?.subTerm).toBe('Fresnel');
    expect(marked.file.indexMarks).toHaveLength(1);
  });

  it('refuses a heading with no words in it', () => {
    const { file, beatId, elements } = book(['A line.']);
    const marked = markForIndex(file, {
      term: '   ',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    });
    expect(marked.mark).toBeNull();
    expect(marked.file.indexMarks).toHaveLength(0);
  });

  it('marking the same passage under the same heading twice is once', () => {
    const { file, beatId, elements } = book(['A line.']);
    const at = { term: 'lamp', beatId, elementId: elements[0]!.id as ManuscriptElementId };
    const once = markForIndex(file, at);
    const twice = markForIndex(once.file, at);
    expect(twice.file.indexMarks).toHaveLength(1);
  });

  it('keeps the words as a quote and never as the thing the link is made of', () => {
    // Addendum 08 §3.2's rule, for the same reason: rewriting the sentence
    // does not break the mark, because the passage is still the passage.
    const { file, beatId, elements } = book(['The lamp turned.']);
    const marked = markForIndex(file, {
      term: 'lamp',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
      quote: 'The lamp turned.',
    });

    const rewritten = updateBeat(marked.file, beatId, {
      manuscript: { elements: [{ ...elements[0]!, text: 'The lamp turned, as it always had.' }] },
    });
    const index = read(rewritten, { [elements[0]!.id as string]: 9 });
    expect(index.headings[0]!.runs).toEqual([{ from: 9, to: 9, principal: false }]);
    expect(index.orphans).toHaveLength(0);
  });
});

describe('page runs', () => {
  it('collapses what is consecutive, the way an index prints it', () => {
    const runs = collapseRuns([14, 15, 16, 17, 22].map((page) => ({ page, principal: false })));
    expect(runsText(runs)).toBe('14–17, 22');
  });

  it('never merges a principal discussion with a passing mention', () => {
    // The bold is the only thing distinguishing the two on the line, and
    // "14–17" set half bold is not something type can do.
    const runs = collapseRuns([
      { page: 14, principal: true },
      { page: 15, principal: false },
    ]);
    expect(runs).toEqual([
      { from: 14, to: 14, principal: true },
      { from: 15, to: 15, principal: false },
    ]);
  });

  it('counts a page marked twice once, and principal wins', () => {
    // A writer saying *this is the discussion* is not undone by a second mark
    // on the same page.
    const runs = collapseRuns([
      { page: 9, principal: false },
      { page: 9, principal: true },
    ]);
    expect(runs).toEqual([{ from: 9, to: 9, principal: true }]);
  });

  it('leaves out a page number that is not one', () => {
    expect(collapseRuns([{ page: 0, principal: false }])).toEqual([]);
  });
});

describe('the index as it reads', () => {
  const staged = () => {
    const { file, beatId, elements } = book([
      'The lamp turned.',
      'Fresnel had the better idea.',
      'The lamp again, at the end.',
      'Maeve climbed.',
    ]);
    const at = (n: number) => elements[n]!.id as ManuscriptElementId;
    let out = markForIndex(file, { term: 'lamp', beatId, elementId: at(0), principal: true }).file;
    out = markForIndex(out, { term: 'lenses', subTerm: 'Fresnel', beatId, elementId: at(1) }).file;
    out = markForIndex(out, { term: 'lamp', beatId, elementId: at(2) }).file;
    out = markForIndex(out, { term: 'Maeve', beatId, elementId: at(3) }).file;
    return { file: out, elements, beatId };
  };

  it('sorts alphabetically and groups under letters', () => {
    const { file, elements } = staged();
    const index = read(file, {
      [elements[0]!.id as string]: 3,
      [elements[1]!.id as string]: 8,
      [elements[2]!.id as string]: 40,
      [elements[3]!.id as string]: 5,
    });

    expect(index.headings.map((one) => one.term)).toEqual(['lamp', 'lenses', 'Maeve']);
    expect(index.letters.map((one) => one.letter)).toEqual(['L', 'M']);
    expect(index.letters[0]!.headings).toHaveLength(2);
  });

  it('carries each heading’s pages, and its sub-heading’s separately', () => {
    const { file, elements } = staged();
    const index = read(file, {
      [elements[0]!.id as string]: 3,
      [elements[1]!.id as string]: 8,
      [elements[2]!.id as string]: 40,
      [elements[3]!.id as string]: 5,
    });

    const lamp = index.headings.find((one) => one.term === 'lamp')!;
    expect(runsText(lamp.runs)).toBe('3, 40');
    expect(lamp.runs[0]!.principal).toBe(true);

    const lenses = index.headings.find((one) => one.term === 'lenses')!;
    expect(lenses.runs).toEqual([]);
    expect(lenses.subEntries[0]!.subTerm).toBe('Fresnel');
    expect(runsText(lenses.subEntries[0]!.runs)).toBe('8');
  });

  it('follows the writing without anything running', () => {
    // Ken's requirement, and the reason no page number is stored: the same
    // marks read against a different layout give different numbers.
    const { file, elements } = staged();
    const before = read(file, { [elements[0]!.id as string]: 3, [elements[2]!.id as string]: 40 });
    const after = read(file, { [elements[0]!.id as string]: 3, [elements[2]!.id as string]: 88 });

    expect(runsText(before.headings.find((one) => one.term === 'lamp')!.runs)).toBe('3, 40');
    expect(runsText(after.headings.find((one) => one.term === 'lamp')!.runs)).toBe('3, 88');
  });

  it('collapses two spellings of one heading, and keeps the first', () => {
    const { file, beatId, elements } = staged();
    const also = markForIndex(file, {
      term: 'Lamp',
      beatId,
      elementId: elements[3]!.id as ManuscriptElementId,
    }).file;

    const index = read(also, {
      [elements[0]!.id as string]: 3,
      [elements[3]!.id as string]: 5,
    });
    expect(index.headings.filter((one) => one.term.toLowerCase() === 'lamp')).toHaveLength(1);
    expect(index.headings.find((one) => one.term.toLowerCase() === 'lamp')!.term).toBe('lamp');
  });
});

describe('a mark whose writing has gone', () => {
  it('is counted and shown rather than silently dropped', () => {
    // A mark that vanished is a writer wondering where their entry went.
    const { file, beatId, elements } = book(['The lamp turned.']);
    const marked = markForIndex(file, {
      term: 'lamp',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    }).file;

    const index = read(marked, {});
    expect(index.orphans).toHaveLength(1);
    expect(index.headings).toHaveLength(0);
    expect(describeIndex(index)).toContain('Nothing is indexed yet');
  });

  it('leaves the heading standing where its other marks survive', () => {
    const { file, beatId, elements } = book(['One.', 'Two.']);
    let out = markForIndex(file, {
      term: 'lamp',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    }).file;
    out = markForIndex(out, {
      term: 'lamp',
      beatId,
      elementId: elements[1]!.id as ManuscriptElementId,
    }).file;

    const index = read(out, { [elements[0]!.id as string]: 7 });
    expect(index.headings).toHaveLength(1);
    expect(runsText(index.headings[0]!.runs)).toBe('7');
    expect(index.headings[0]!.orphans).toBe(1);
    expect(describeIndex(index)).toContain('1 pointing at writing that has gone');
  });
});

describe('see, and see also', () => {
  it('redirects a heading that has no pages of its own', () => {
    const { file } = book(['A line.']);
    const made = addIndexRef(file, { term: 'Fresnel', kind: 'see', target: 'lenses' });
    const index = read(made.file, {});

    expect(index.headings).toHaveLength(1);
    expect(index.headings[0]!.see).toEqual(['lenses']);
    expect(index.headings[0]!.runs).toEqual([]);
  });

  it('sits beside a heading that does have pages', () => {
    const { file, beatId, elements } = book(['The lamp turned.']);
    let out = markForIndex(file, {
      term: 'lamp',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    }).file;
    out = addIndexRef(out, { term: 'lamp', kind: 'see_also', target: 'lenses' }).file;

    const index = read(out, { [elements[0]!.id as string]: 4 });
    expect(index.headings[0]!.seeAlso).toEqual(['lenses']);
    expect(runsText(index.headings[0]!.runs)).toBe('4');
  });

  it('refuses a reference with only one end', () => {
    const { file } = book(['A line.']);
    expect(addIndexRef(file, { term: 'lamp', kind: 'see', target: '  ' }).ref).toBeNull();
    expect(addIndexRef(file, { term: '', kind: 'see', target: 'lenses' }).ref).toBeNull();
  });

  it('refuses a heading pointing at itself', () => {
    // Somebody would follow it once.
    const { file } = book(['A line.']);
    expect(addIndexRef(file, { term: 'lamp', kind: 'see', target: 'Lamp' }).ref).toBeNull();
  });
});

describe('keeping the index tidy', () => {
  it('renames a heading everywhere it is used', () => {
    // Having filed forty passages under "lighthouse" and decided on
    // "lighthouses", doing it mark by mark is how an index gets both.
    const { file, beatId, elements } = book(['One.', 'Two.']);
    let out = markForIndex(file, {
      term: 'lighthouse',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    }).file;
    out = markForIndex(out, {
      term: 'lighthouse',
      beatId,
      elementId: elements[1]!.id as ManuscriptElementId,
    }).file;
    out = addIndexRef(out, { term: 'lighthouse', kind: 'see_also', target: 'lamp' }).file;

    const renamed = renameHeading(out, { term: 'lighthouse' }, { term: 'lighthouses' });
    expect(renamed.indexMarks.every((mark) => mark.term === 'lighthouses')).toBe(true);
    expect(renamed.indexRefs.every((ref) => ref.term === 'lighthouses')).toBe(true);
  });

  it('changes one mark without touching the others', () => {
    const { file, beatId, elements } = book(['One.', 'Two.']);
    let out = markForIndex(file, {
      term: 'lamp',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    }).file;
    const second = markForIndex(out, {
      term: 'lamp',
      beatId,
      elementId: elements[1]!.id as ManuscriptElementId,
    });
    out = updateIndexMark(second.file, second.mark!.id, { principal: true });

    expect(out.indexMarks.filter((mark) => mark.principal)).toHaveLength(1);
  });

  it('takes a mark out without touching the writing', () => {
    const { file, beatId, elements } = book(['The lamp turned.']);
    const marked = markForIndex(file, {
      term: 'lamp',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    });
    const out = unmarkIndex(marked.file, marked.mark!.id);

    expect(out.indexMarks).toHaveLength(0);
    const beat = out.beats.find((one) => one.id === beatId)!;
    expect(beat.manuscript.elements[0]!.text).toBe('The lamp turned.');
  });
});

describe('finding passages to mark', () => {
  it('offers every line the phrase is in, and marks none of them', () => {
    // The line the whole module is drawn on: a search that filed every hit
    // would be building a concordance, and which mentions matter is the
    // writer's judgement.
    const { file } = book(['The lamp turned.', 'She slept.', 'The lamp again.']);
    const found = findForIndex(file, 'lamp');

    expect(found).toHaveLength(2);
    expect(file.indexMarks).toHaveLength(0);
  });

  it('says which of them are already marked under that heading', () => {
    const { file, beatId, elements } = book(['The lamp turned.', 'The lamp again.']);
    const marked = markForIndex(file, {
      term: 'lamp',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    }).file;

    const found = findForIndex(marked, 'lamp', 'lamp');
    expect(found.map((one) => one.marked)).toEqual([true, false]);
  });

  it('finds nothing for an empty phrase, rather than everything', () => {
    const { file } = book(['The lamp turned.']);
    expect(findForIndex(file, '   ')).toEqual([]);
  });
});

describe('the index the screen reads', () => {
  /** A book long enough that the writing moves between pages when it grows. */
  const longBook = () => book(Array.from({ length: 80 }, (_, at) => `Paragraph ${at + 1}. The lamp turned, and she did not.`));

  it('reads the same pages the printed index will', () => {
    const { file, beatId, elements } = longBook();
    const marked = markForIndex(file, {
      term: 'lamp, the',
      beatId,
      elementId: elements[60]!.id as ManuscriptElementId,
    }).file;

    const screen = bookIndexOf(marked);
    const printed = paginateProject(marked)
      .filter((page) => page.index)
      .flatMap((page) => page.index!.letters.flatMap((group) => group.headings));

    // Two readings of one book: the screen's page and the book's page are the
    // same number, or a writer has no way to tell which one is true.
    expect(runsText(screen.headings[0]!.runs)).toBe(runsText(printed[0]!.runs));
    expect(screen.headings[0]!.runs[0]!.from).toBeGreaterThan(1);
  });

  it('shows the index even when this printing leaves it out', () => {
    // The toggle says what the book prints. Somebody managing the index wants
    // to see it either way.
    const { file, beatId, elements } = longBook();
    const marked = markForIndex(file, {
      term: 'lamp, the',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    }).file;

    expect(bookIndexOf(marked, { includeBookIndex: false }).headings).toHaveLength(1);
    expect(paginateProject(marked, { includeBookIndex: false }).some((page) => page.index)).toBe(false);
  });

  it('puts a heading’s marks in the order their pages print, orphans last', () => {
    const { file, beatId, elements } = longBook();
    let marked = file;
    for (const at of [60, 2, 40]) {
      marked = markForIndex(marked, {
        term: 'lamp, the',
        beatId,
        elementId: elements[at]!.id as ManuscriptElementId,
      }).file;
    }
    // A fourth, pinned to writing that is not in the book.
    marked = markForIndex(marked, {
      term: 'lamp, the',
      beatId,
      elementId: crypto.randomUUID() as ManuscriptElementId,
      quote: 'a passage that has gone',
    }).file;

    const where = elementPages(marked);
    const places = marksUnder(marked, { term: 'lamp, the' }, (id) => where.get(id) ?? 0);

    expect(places.map((place) => place.page > 0)).toEqual([true, true, true, false]);
    const pages = places.slice(0, 3).map((place) => place.page);
    expect([...pages].sort((a, b) => a - b)).toEqual(pages);
    expect(places[3]!.mark.quote).toBe('a passage that has gone');
  });

  it('takes the marks of one sub-heading and not its parent’s', () => {
    const { file, beatId, elements } = longBook();
    let marked = markForIndex(file, {
      term: 'lamp, the',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    }).file;
    marked = markForIndex(marked, {
      term: 'lamp, the',
      subTerm: 'cleaning of',
      beatId,
      elementId: elements[30]!.id as ManuscriptElementId,
    }).file;

    const where = elementPages(marked);
    const own = marksUnder(marked, { term: 'lamp, the' }, (id) => where.get(id) ?? 0);
    const under = marksUnder(marked, { term: 'lamp, the', subTerm: 'cleaning of' }, (id) => where.get(id) ?? 0);

    expect(own).toHaveLength(1);
    expect(under).toHaveLength(1);
    expect(own[0]!.mark.id).not.toBe(under[0]!.mark.id);
  });
});
