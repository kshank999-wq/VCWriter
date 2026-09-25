import { describe, expect, it } from 'vitest';
import {
  APPENDIX_LABELS,
  addPart,
  bookBlocks,
  appendixLabel,
  appendixOf,
  bibliographyEntries,
  bibliographyOf,
  citation,
  createProjectFile,
  extraHeading,
  glossaryEntries,
  glossaryOf,
  partsOf,
  pullFromText,
  pullOffer,
  readerExtraOf,
  sourcesNoted,
  styleReaches,
  termsInText,
  updatePart,
  type BookPart,
  type PartKind,
  type ProjectFile,
} from '../index.js';

/**
 * **Pull from the text** (addendum 20 §17a, from Ken), and the records the
 * four list pages hold.
 *
 * What these pin is the three rules the pull rests on: it reads the writer's
 * own marks and never guesses, it never writes a definition, and it adds
 * without overwriting — so a second press changes nothing.
 */

const book = (): ProjectFile => createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' });

const withPage = (start: ProjectFile, kind: PartKind): { file: ProjectFile; part: BookPart } => {
  const standing = partsOf(start).find((one) => one.kind === kind);
  if (standing) return { file: start, part: standing };
  const made = addPart(start, kind);
  return { file: made.file, part: partsOf(made.file).find((one) => one.id === made.partId)! };
};

/** A book whose writer has marked two terms and typed one source. */
const marked = (): ProjectFile => {
  const file = book();
  return {
    ...file,
    indexMarks: [
      { id: 'm1', projectId: file.project.id, term: 'Fresnel lens', subTerm: '', beatId: 'b1', elementId: 'e1', quote: '', principal: true, createdAt: '', updatedAt: '' },
      { id: 'm2', projectId: file.project.id, term: 'keeper', subTerm: '', beatId: 'b1', elementId: 'e1', quote: '', principal: false, createdAt: '', updatedAt: '' },
    ] as never,
    researchItems: [
      { ...(file.researchItems?.[0] ?? {}), id: 'r1', projectId: file.project.id, title: 'Lights', body: '', source: 'Stevenson, D. Lighthouses. Edinburgh, 1874.', createdAt: '', updatedAt: '' },
    ] as never,
  };
};

describe('which pages can be pulled from, and which cannot', () => {
  it('reads the terms the writer marked, and never invents one', () => {
    const file = marked();
    expect(termsInText(file)).toEqual(['Fresnel lens', 'keeper']);
    const { part } = withPage(file, 'glossary');
    const offer = pullOffer(file, part);
    expect(offer.can).toBe(true);
    expect(offer.found).toEqual(['Fresnel lens', 'keeper']);
    expect(offer.says).toContain('2 terms');
    expect(offer.says).toContain('definitions stay yours');
  });

  it('writes the term and leaves the definition empty, which is the work', () => {
    const { file, part } = withPage(marked(), 'glossary');
    const after = updatePart(file, part.id, pullFromText(file, part)!);
    const now = partsOf(after).find((one) => one.id === part.id)!;
    expect(glossaryEntries(now).map((one) => one.term)).toEqual(['Fresnel lens', 'keeper']);
    for (const entry of glossaryEntries(now)) expect(entry.definition).toBe('');
  });

  it('adds only what is missing, so a second press changes nothing', () => {
    const { file, part } = withPage(marked(), 'glossary');
    const once = updatePart(file, part.id, pullFromText(file, part)!);
    const after = partsOf(once).find((one) => one.id === part.id)!;
    // And an edited definition survives, which is what makes it safe to
    // press without asking.
    const edited = updatePart(once, part.id, {
      about: { ...glossaryOf(after), terms: glossaryOf(after).terms.map((one) => ({ ...one, definition: 'A lens.' })) },
    });
    const now = partsOf(edited).find((one) => one.id === part.id)!;
    const again = pullOffer(edited, now);
    expect(again.can).toBe(false);
    expect(again.refusal).toContain('Every term the book marks is already here');
    // *1 term* rather than *1 terms*.
    expect(again.refusal).toContain('2 terms');
    expect(pullFromText(edited, now)).toBeNull();
    expect(glossaryEntries(now).every((one) => one.definition === 'A lens.')).toBe(true);
  });

  it('takes a bibliography from the sources the writer typed on their notes', () => {
    const { file, part } = withPage(marked(), 'bibliography');
    expect(sourcesNoted(file)).toEqual(['Stevenson, D. Lighthouses. Edinburgh, 1874.']);
    const after = updatePart(file, part.id, pullFromText(file, part)!);
    const now = partsOf(after).find((one) => one.id === part.id)!;
    // Each arrives as written, so a style does not rewrite somebody's words.
    const [entry] = bibliographyEntries(now);
    expect(entry?.text).toBe('Stevenson, D. Lighthouses. Edinburgh, 1874.');
    expect(entry?.styled).toBe(false);
  });

  it('is absent on the index, because that page already is the reading', () => {
    const { file, part } = withPage(marked(), 'index');
    const offer = pullOffer(file, part);
    expect(offer.can).toBe(false);
    expect(offer.refusal).toContain('already read from the text');
    expect(offer.refusal).toContain('page numbers follow the layout');
  });

  it('says what a page has nothing to take, rather than offering an empty press', () => {
    let file = book();
    for (const [kind, says] of [
      ['acknowledgements', 'Nobody but you'],
      ['about_the_author', 'Your name comes from the book'],
      ['appendix', 'written rather than gathered'],
    ] as const) {
      const made = withPage(file, kind);
      file = made.file;
      const offer = pullOffer(file, made.part);
      expect(offer.can).toBe(false);
      expect(offer.refusal).toContain(says);
    }
    // And a book with nothing marked says how to mark something.
    const empty = withPage(file, 'glossary');
    expect(pullOffer(empty.file, empty.part).refusal).toContain('Mark one for the index');
  });
});

describe('what the records print', () => {
  const linesOf = (file: ProjectFile, partId: string) =>
    bookBlocks(file)
      .filter((one) => one.partId === partId && one.kind === 'paragraph')
      .map((one) => `${one.role ?? ''}|${one.lead?.text ?? ''}|${one.text}`);

  it('makes a glossary’s paragraphs its terms rather than its words', () => {
    // The panel and the page cannot disagree about what the page says,
    // because there is only one place it comes from.
    const { file, part } = withPage(book(), 'glossary');
    const after = updatePart(file, part.id, {
      text: 'Words nobody should see.',
      about: {
        terms: [
          { id: '1', term: 'keeper', definition: 'Who tends the light.' },
          { id: '2', term: 'Fresnel lens', definition: 'A stepped lens.' },
        ],
        sorted: true,
        letterHeadings: true,
        termStyle: 'small_caps',
        layout: 'run_in',
      },
    });
    expect(linesOf(after, part.id)).toEqual([
      'letter||F',
      'glossary|Fresnel lens|— A stepped lens.',
      'letter||K',
      'glossary|keeper|— Who tends the light.',
    ]);
    expect(bookBlocks(after).find((one) => one.role === 'glossary')?.lead?.style).toBe('small_caps');
  });

  it('sets each source in the page’s style, and keeps a free entry as written', () => {
    const { file, part } = withPage(book(), 'bibliography');
    const after = updatePart(file, part.id, {
      about: {
        style: 'apa',
        sortByAuthor: true,
        sources: [
          { id: '1', author: 'Stevenson, David', title: 'Lighthouses', city: 'Edinburgh', publisher: 'Black', year: '1874', raw: '' },
          { id: '2', author: '', title: '', city: '', publisher: '', year: '', raw: 'A note in full.' },
        ],
      },
    });
    expect(linesOf(after, part.id)).toEqual(['source||A note in full.', 'source||Stevenson, D. (1874). Lighthouses. Black.']);
  });

  it('draws a reader extra from its kind, and numbers the questions', () => {
    const { file, part } = withPage(book(), 'reader_extra');
    const after = updatePart(file, part.id, {
      about: {
        kind: 'questions',
        numbering: 'numbers',
        questions: [
          { id: '1', text: 'Why does she stay?' },
          { id: '2', text: 'What does the light mean?' },
        ],
      },
    });
    // The number is worked out from the order, so moving a question
    // renumbers the rest with nothing run.
    expect(linesOf(after, part.id)).toEqual(['question|1.|Why does she stay?', 'question|2.|What does the light mean?']);
  });

  it('is its words where it has no records, as every prose part always was', () => {
    const { file, part } = withPage(book(), 'acknowledgements');
    const after = updatePart(file, part.id, { text: 'To the keepers.' });
    expect(linesOf(after, part.id)).toEqual(['||To the keepers.']);
  });
});

describe('the records the list pages hold', () => {
  it('works an appendix’s label out from where it falls', () => {
    expect(APPENDIX_LABELS).toEqual(['letters', 'numbers', 'roman']);
    expect([0, 1, 2].map((at) => appendixLabel(at, 'letters'))).toEqual(['A', 'B', 'C']);
    expect([0, 1, 2].map((at) => appendixLabel(at, 'numbers'))).toEqual(['1', '2', '3']);
    expect([0, 1, 2].map((at) => appendixLabel(at, 'roman'))).toEqual(['I', 'II', 'III']);
    const { part } = withPage(book(), 'appendix');
    expect(appendixOf(part).labels).toBe('letters');
  });

  it('sorts the glossary where the page asks and keeps the writer’s order where it does not', () => {
    const { file, part } = withPage(book(), 'glossary');
    const terms = [
      { id: '1', term: 'keeper', definition: '' },
      { id: '2', term: 'Fresnel lens', definition: '' },
    ];
    const sorted = updatePart(file, part.id, { about: { terms, sorted: true } });
    expect(glossaryEntries(partsOf(sorted).find((o) => o.id === part.id)!).map((o) => o.term)).toEqual(['Fresnel lens', 'keeper']);
    const kept = updatePart(file, part.id, { about: { terms, sorted: false } });
    expect(glossaryEntries(partsOf(kept).find((o) => o.id === part.id)!).map((o) => o.term)).toEqual(['keeper', 'Fresnel lens']);
  });

  it('sets a source in each of the three styles, and leaves free text alone', () => {
    const source = { id: '1', author: 'Stevenson, David', title: 'Lighthouses', city: 'Edinburgh', publisher: 'Black', year: '1874', raw: '' };
    expect(citation(source, 'chicago')).toBe('Stevenson, David. Lighthouses. Edinburgh: Black, 1874.');
    expect(citation(source, 'mla')).toBe('Stevenson, David. Lighthouses. Black, 1874.');
    expect(citation(source, 'apa')).toBe('Stevenson, D. (1874). Lighthouses. Black.');
    // A style is a rule about fields, so an entry with none is kept whole.
    const free = { ...source, raw: 'A note written out in full.' };
    expect(citation(free, 'apa')).toBe('A note written out in full.');
    expect(styleReaches(free)).toBe(false);
    expect(styleReaches(source)).toBe(true);
  });

  it('names the reader extra after its kind, and *Also by* after the author', () => {
    const file = book();
    expect(extraHeading(file, 'newsletter')).toBe('Want More?');
    expect(extraHeading(file, 'questions')).toBe('Questions for Discussion');
    // A reading rather than a string in the table: renaming the author
    // renames the page with nothing run.
    expect(extraHeading(file, 'also_by')).toBe('Also by M. Shank');
    const { part } = withPage(file, 'reader_extra');
    expect(readerExtraOf(part).kind).toBe('newsletter');
    expect(bibliographyOf(part).sources).toEqual([]);
  });
});
