import { describe, expect, it } from 'vitest';
import {
  addPart,
  createProjectFile,
  describeWorklist,
  dropImportedEntry,
  glossaryEntries,
  importPagesInto,
  importTextInto,
  indexPageOf,
  indexWorklist,
  markForIndex,
  pageImportOffer,
  partsOf,
  readBackMatterText,
  textImportOffer,
  unitsInStoryOrder,
  beatsForUnit,
  updateBeat,
  type ProjectFile,
  type ReadPage,
} from '../index.js';

/**
 * **Importing a back-matter page** (addendum 20 §17c).
 *
 * What these pin is the split the module rests on — text becomes records and
 * a PDF becomes pages — plus the parsing, and the one fact a writer would not
 * guess: an imported index's page numbers are dropped, because this book
 * works its own out.
 */

const book = (): ProjectFile =>
  createProjectFile({ title: 'The Lamp and the Lighthouse', format: 'novel', author: 'M. Shank' });

const withPage = (kind: 'glossary' | 'appendix' | 'index') => {
  const made = addPart(book(), kind, { title: '' });
  return { file: made.file, partId: made.partId! };
};

const partIn = (file: ProjectFile, partId: string) => partsOf(file).find((one) => one.id === partId)!;

// ----------------------------------------------------------------- glossary

describe('reading a text file into a glossary', () => {
  it('reads a term and its meaning however the file separates them', () => {
    const read = readBackMatterText(
      'glossary',
      [
        'Fresnel lens: a stepped lens that throws a beam further than its size suggests.',
        'Occulting light — a light in which the dark is shorter than the light.',
        'Gallery\tthe walkway outside the lantern room.',
      ].join('\n'),
    );
    expect(read.terms.map((one) => one.term)).toEqual(['Fresnel lens', 'Occulting light', 'Gallery']);
    expect(read.terms[2]!.definition).toBe('the walkway outside the lantern room.');
  });

  it('lets a definition run to several lines, a blank line ending the entry', () => {
    const read = readBackMatterText(
      'glossary',
      'Fresnel lens: a stepped lens\nthat throws a beam further\nthan its size suggests.\n\nGallery: the walkway.',
    );
    expect(read.terms).toHaveLength(2);
    expect(read.terms[0]!.definition).toBe('a stepped lens that throws a beam further than its size suggests.');
  });

  it('drops the source page’s letter headings, and says it did', () => {
    // §4's rule: every line read is accounted for, never silently discarded.
    const read = readBackMatterText('glossary', 'A\n\nApron: the stone skirt.\n\nG\n\nGallery: the walkway.');
    expect(read.terms.map((one) => one.term)).toEqual(['Apron', 'Gallery']);
    expect(read.skipped.map((one) => one.line)).toEqual(['A', 'G']);
    expect(read.skipped[0]!.why).toContain('letter heading');
  });

  it('adds and never overwrites, so a second press changes nothing', () => {
    // §17a's rule, and what makes the button safe with no ask in front of it.
    const { file, partId } = withPage('glossary');
    const read = readBackMatterText('glossary', 'Gallery: the walkway.');
    const once = importTextInto(file, partId, read);
    expect(glossaryEntries(partIn(once, partId)).map((one) => one.term)).toEqual(['Gallery']);

    // The writer then edits the definition, and imports the same file again.
    const edited = importTextInto(once, partId, readBackMatterText('glossary', 'Gallery: MY OWN WORDS.'));
    expect(glossaryEntries(partIn(edited, partId))).toHaveLength(1);
    expect(glossaryEntries(partIn(edited, partId))[0]!.definition).toBe('the walkway.');
    expect(textImportOffer(once, partIn(once, partId), read).refusal).toContain('already on the page');
  });

  it('says how many it would add and how many it would leave alone', () => {
    const { file, partId } = withPage('glossary');
    const once = importTextInto(file, partId, readBackMatterText('glossary', 'Gallery: the walkway.'));
    const offer = textImportOffer(
      once,
      partIn(once, partId),
      readBackMatterText('glossary', 'Gallery: the walkway.\nApron: the stone skirt.'),
    );
    expect(offer.can).toBe(true);
    expect(offer.adding).toBe(1);
    expect(offer.says).toContain('Add 1 term');
    expect(offer.says).toContain('1 term already on the page is left exactly as it is');
  });
});

// ----------------------------------------------------------------- appendix

describe('reading a text file into an appendix', () => {
  it('takes a blank line as the paragraph break and rejoins the rest', () => {
    // The file's own line breaks belong to the measure it was set in; this
    // book breaks its own lines.
    const read = readBackMatterText('appendix', 'The lens was ground\nin Paris in 1823.\n\nIt shipped in nine crates.');
    expect(read.paragraphs).toEqual(['The lens was ground in Paris in 1823.', 'It shipped in nine crates.']);
  });

  it('appends, leaving what is already on the page above it', () => {
    const { file, partId } = withPage('appendix');
    const first = importTextInto(file, partId, readBackMatterText('appendix', 'First.'));
    const second = importTextInto(first, partId, readBackMatterText('appendix', 'Second.'));
    expect(partIn(second, partId).text).toBe('First.\n\nSecond.');
  });

  it('refuses an empty file in a sentence', () => {
    const { file, partId } = withPage('appendix');
    expect(textImportOffer(file, partIn(file, partId), readBackMatterText('appendix', '   \n\n  ')).can).toBe(false);
  });
});

// -------------------------------------------------------------------- index

describe('reading a text file into an index', () => {
  it('keeps the headings and drops the numbers', () => {
    // Addendum 10 §3: no page number is stored anywhere, because this book's
    // index is read off this book's pagination every time.
    const read = readBackMatterText('index', 'lamp, the, 14, 22–25\nlighthouse, 8');
    expect(read.entries.map((one) => one.term)).toEqual(['lamp, the', 'lighthouse']);
    // The numbers are kept only so the screen can say they were dropped.
    expect(read.entries[0]!.pages).toBe('14, 22–25');
  });

  it('reads an indented line as a sub-entry of the heading above it', () => {
    const read = readBackMatterText('index', 'lamp, the, 14\n    cleaning of, 31\n    lighting of, 9\nkeeper, 3');
    expect(read.entries.map((one) => `${one.term}|${one.subTerm}`)).toEqual([
      'lamp, the|',
      'lamp, the|cleaning of',
      'lamp, the|lighting of',
      'keeper|',
    ]);
  });

  it('names a cross-reference rather than filing it as a heading', () => {
    const read = readBackMatterText('index', 'lamp, the, 14\nlantern. See lamp, the');
    expect(read.entries.map((one) => one.term)).toEqual(['lamp, the']);
    expect(read.skipped[0]!.why).toContain('cross-reference');
  });

  it('says the numbers are being dropped, before the press', () => {
    const { file, partId } = withPage('index');
    const offer = textImportOffer(file, partIn(file, partId), readBackMatterText('index', 'lamp, the, 14, 22–25\nkeeper, 3'));
    expect(offer.says).toContain('drop the page numbers');
    expect(offer.says).toContain('this book works its own out');
    // And it marks nothing: `findForIndex`'s rule is that a search helps
    // somebody mark and marks nothing.
    expect(offer.says).toContain('Nothing is marked');
  });

  it('marks nothing at all — the headings become a list to work through', () => {
    const { file, partId } = withPage('index');
    const after = importTextInto(file, partId, readBackMatterText('index', 'lamp, the, 14\nkeeper, 3'));
    expect(after.indexMarks ?? []).toHaveLength(0);
    expect(indexPageOf(partIn(after, partId)).imported).toHaveLength(2);
  });
});

describe('the imported index as work to do', () => {
  const withWriting = () => {
    const start = withPage('index');
    const unit = unitsInStoryOrder(start.file)[0]!;
    const beat = beatsForUnit(start.file, unit.id)[0]!;
    const elements = ['The lamp turned all night.', 'She climbed past the lamp room.'].map((text) => ({
      id: crypto.randomUUID(),
      type: 'paragraph' as const,
      text,
      attributes: {},
    }));
    const file = updateBeat(start.file, beat.id, { manuscript: { elements } as never });
    return { ...start, file, beatId: beat.id, elementId: elements[0]!.id };
  };

  it('counts where each heading is mentioned in this manuscript', () => {
    const { file, partId } = withWriting();
    const after = importTextInto(file, partId, readBackMatterText('index', 'lamp, 14\nkeeper, 3'));
    const rows = indexWorklist(after, partIn(after, partId));
    expect(rows.map((one) => [one.term, one.hits])).toEqual([
      ['lamp', 2],
      ['keeper', 0],
    ]);
  });

  it('says a heading this manuscript never mentions rather than hiding it', () => {
    // It is the most useful row on the list: a subject the old book covered
    // and this one may not.
    const { file, partId } = withWriting();
    const after = importTextInto(file, partId, readBackMatterText('index', 'lamp, 14\nkeeper, 3'));
    expect(describeWorklist(indexWorklist(after, partIn(after, partId)))).toBe(
      '2 headings still to mark, 1 of which this manuscript never mentions.',
    );
  });

  it('reads done off the marks, so marking a passage strikes the row off', () => {
    const { file, partId, beatId, elementId } = withWriting();
    const after = importTextInto(file, partId, readBackMatterText('index', 'lamp, 14'));
    expect(indexWorklist(after, partIn(after, partId))[0]!.done).toBe(false);

    const marked = markForIndex(after, {
      term: 'lamp',
      subTerm: '',
      beatId,
      elementId: elementId as never,
      quote: '',
      principal: false,
    }).file;
    expect(indexWorklist(marked, partIn(marked, partId))[0]!.done).toBe(true);
    expect(describeWorklist(indexWorklist(marked, partIn(marked, partId)))).toBe('All 1 imported heading is marked.');
  });

  it('lets a row be taken off the list by hand', () => {
    const { file, partId } = withWriting();
    const after = importTextInto(file, partId, readBackMatterText('index', 'lamp, 14\nkeeper, 3'));
    const fewer = dropImportedEntry(after, partId, 0);
    expect(indexPageOf(partIn(fewer, partId)).imported.map((one) => one.term)).toEqual(['keeper']);
  });
});

// ---------------------------------------------------------------- as pages

describe('bringing a PDF in as pages', () => {
  const pages: ReadPage[] = [
    { name: 'Glossary p1', data: 'data:image/png;base64,AAA', width: 1200, height: 1800 },
    { name: 'Glossary p2', data: 'data:image/png;base64,BBB', width: 1200, height: 1800 },
  ];

  const addGraphic = (file: ProjectFile, input: ReadPage) => {
    const id = `asset-${input.name}`;
    return { file: { ...file, assets: [...(file.assets ?? []), { id, name: input.name, data: input.data }] } as ProjectFile, assetId: id };
  };

  it('says what it keeps and what it costs, before the press', () => {
    const offer = pageImportOffer('glossary', pages);
    expect(offer.can).toBe(true);
    expect(offer.says).toContain('exactly as they are');
    // The cost, said rather than discovered after the book is printed.
    expect(offer.says).toContain('a picture of a glossary rather than a glossary');
    expect(offer.says).toContain('will not reflow in the eBook');
  });

  it('says an imported index’s numbers are the old book’s', () => {
    // He asked for it, so it is built — with the one fact that makes it a
    // decision rather than a trap.
    const offer = pageImportOffer('index', pages);
    expect(offer.can).toBe(true);
    expect(offer.says).toContain('the old book’s');
    expect(offer.says).toContain('will not follow this book’s writing');
  });

  it('places them as art pages at the back, in order', () => {
    // An art page is what the book already has for a picture that is the
    // whole page, so this needed no new kind of page.
    const after = importPagesInto(book(), pages, addGraphic);
    const plates = partsOf(after).filter((one) => one.kind === 'plate');
    expect(plates.map((one) => one.title)).toEqual(['Glossary p1', 'Glossary p2']);
    expect(plates.every((one) => one.inFront === false)).toBe(true);
    expect(plates[0]!.assetId).toBe('asset-Glossary p1');
  });

  it('refuses a PDF with no pages', () => {
    expect(pageImportOffer('glossary', []).can).toBe(false);
  });
});
