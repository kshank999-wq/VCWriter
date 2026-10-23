import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addReference,
  addUnit,
  bookBlocks,
  bookCitationsOf,
  bookNames,
  bookSettingsOf,
  bookSettingsSchema,
  chapterPageStyleOf,
  citationNotes,
  citationOccurrences,
  createProjectFile,
  ebookOf,
  geometryOf,
  insertCitation,
  layPages,
  renderBookPage,
  setCitationSettings,
  titlePageOf,
  updateBeat,
  type BookPage,
  type BookRenderContext,
  type ManuscriptElementId,
  type ProjectFile,
} from '../index.js';

/**
 * Citations in the front and back matter (addendum 43 §13): a foreword, an
 * epigraph and an appendix cite as a chapter does, numbered where the book
 * prints them.
 */

/** A book citing one source in its foreword, its one chapter and an appendix. */
const book = (): { file: ProjectFile; keys: { foreword: string; story: string; appendix: string }; parts: { foreword: string; appendix: string } } => {
  let file: ProjectFile = createProjectFile({ title: 'The Sea', format: 'instructional' });
  const made = addReference(file, { title: 'On Tides', authors: ['Jones, Robert'], date: '2019', publisher: 'Sea Press', place: 'Boston' });
  file = made.file;
  const cite = (locator: string) => {
    const cited = insertCitation(file, { referenceId: made.reference.id, locator });
    file = cited.file;
    return cited.citation.key;
  };
  const keys = { story: cite('20'), appendix: cite('30'), foreword: cite('10') };
  const unit = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' });
  file = addMarker(unit.file, { unitId: unit.unit.id, kind: 'chapter', title: 'Chapter 1' }).file;
  const beat = addBeat(file, { unitId: unit.unit.id });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: { elements: [{ id: crypto.randomUUID() as ManuscriptElementId, type: 'paragraph', text: `Tides follow the moon.[^${keys.story}]`, characterId: null, attributes: {} }] },
  });
  const foreword = addPart(file, 'foreword', { text: `A word first.[^${keys.foreword}]` });
  file = foreword.file;
  const appendix = addPart(file, 'appendix', { text: `The tables.[^${keys.appendix}]` });
  file = appendix.file;
  return { file, keys, parts: { foreword: foreword.partId!, appendix: appendix.partId! } };
};

describe('citations in the front and back matter', () => {
  it('numbers them where the book prints them: the foreword before the story, the appendix after', () => {
    const { file, keys, parts } = book();
    const occurrences = citationOccurrences(file);
    expect(occurrences.map((one) => [one.key, one.marker])).toEqual([
      [keys.foreword, '1'],
      [keys.story, '2'],
      [keys.appendix, '3'],
    ]);
    expect(occurrences[0]).toMatchObject({ partId: parts.foreword, unitId: null });
    expect(occurrences[2]).toMatchObject({ partId: parts.appendix });
    // The foreword cites the source first, so its note is the full one.
    expect(citationNotes(file).map((note) => note.text)).toEqual([
      'Robert Jones, *On Tides* (Boston: Sea Press, 2019), 10.',
      'Jones, *On Tides*, 20.',
      'Jones, *On Tides*, 30.',
    ]);
  });

  it('counts each page as a division of its own where the count starts again at each chapter', () => {
    const { file } = book();
    const restarted = setCitationSettings(file, { restartEach: 'chapter' });
    expect(citationOccurrences(restarted).map((one) => one.marker)).toEqual(['1', '1', '1']);
  });

  it('raises the marker on the foreword’s page and sets its note there', () => {
    const { file, keys, parts } = book();
    const blocks = bookBlocks(file);
    const words = blocks.find((block) => block.partId === parts.foreword && block.kind === 'paragraph')!;
    const settings = bookSettingsOf(file);
    const context: BookRenderContext = {
      settings,
      geometry: geometryOf(settings, 'instructional', 100),
      chapterStyle: chapterPageStyleOf(file),
      paragraphStyle: 'indented',
      pictures: new Map(),
      names: bookNames(file),
      titlePage: titlePageOf(file.project, file.settings),
      contents: [],
      index: null,
      citations: bookCitationsOf(file),
    };
    const page: BookPage = {
      sheet: 5, side: 'recto', numbering: 'roman', number: 5, folio: 'v', counted: 'v', runningHead: '', runningFoot: '', chapterTitle: '',
      display: false, blank: false, opens: false, pieces: [{ blockId: words.id, from: 0, to: 1 }], notes: [keys.foreword], noteParts: [], depth: 1, target: 30,
    };
    const html = renderBookPage(page, new Map(blocks.map((block) => [block.id, block])), context);
    expect(html).toContain(`A word first.<sup class="bk-cite" data-cite="${keys.foreword}">1</sup>`);
    expect(html).toContain('<span class="bk-note-mark">1.</span> Robert Jones,');
  });

  it('cites from an epigraph’s page of words, its note at the page’s foot', () => {
    let { file } = book();
    const cited = insertCitation(file, { referenceId: file.references[0]!.id, locator: '5' });
    file = cited.file;
    const key = cited.citation.key;
    const epigraph = addPart(file, 'epigraph', { text: `The sea is patient.${cited.token}\n— R. Jones` });
    file = epigraph.file;
    const blocks = bookBlocks(file);
    const page = blocks.find((block) => block.partId === epigraph.partId && block.display)!;
    expect(page).toBeTruthy();
    // Front matter, after the foreword it was added behind and before the story.
    expect(citationOccurrences(file).map((one) => one.partId)).toEqual([expect.any(String), epigraph.partId, null, expect.any(String)]);
    expect(citationOccurrences(file)[1]).toMatchObject({ key, marker: '2' });
    const settings = bookSettingsSchema.parse({ trim: { width: 6, height: 9 } });
    const laid = layPages(blocks, new Map(), geometryOf(settings, 'instructional', 100), settings, { title: 'The Sea', author: '' }, undefined, {
      anchors: new Map(),
      heights: new Map([[key, 2]]),
    });
    const leaf = laid.pages.find((one) => one.pieces.some((piece) => piece.blockId === page.id))!;
    expect(leaf.notes).toEqual([key]);
    // And in the eBook the marker links to its note.
    const pkg = ebookOf(file, { modified: '2026-01-01T00:00:00Z' });
    const html = pkg.entries.map((one) => (typeof one.data === 'string' ? one.data : '')).join('\n');
    expect(html).toContain(`The sea is patient.<sup class="noteref"><a epub:type="noteref" role="doc-noteref" href="#fn-${key}"`);
    expect(html).toContain(`id="fn-${key}"`);
    expect(html).not.toContain(`[^${key}]`);
  });

  it('cites from a glossary’s definitions, numbered in the order the page prints its terms', () => {
    let { file } = book();
    const source = file.references[0]!.id;
    const tide = insertCitation(file, { referenceId: source, locator: '40' });
    file = tide.file;
    const ebb = insertCitation(file, { referenceId: source, locator: '41' });
    file = ebb.file;
    // Written Tide first, Ebb second; the page sorts them, so Ebb prints first.
    const glossary = addPart(file, 'glossary', {
      about: {
        terms: [
          { id: 't1', term: 'Tide', definition: `The sea rising and falling.${tide.token}` },
          { id: 't2', term: 'Ebb', definition: `The tide going out.${ebb.token}` },
        ],
      },
    });
    file = glossary.file;
    const inGlossary = citationOccurrences(file).filter((one) => one.partId === glossary.partId);
    expect(inGlossary.map((one) => one.key)).toEqual([ebb.citation.key, tide.citation.key]);
    // Back matter, after the story and the appendix written before it.
    expect(citationOccurrences(file).map((one) => one.marker)).toEqual(['1', '2', '3', '4', '5']);

    // The definition is set as a paragraph of the page, its marker raised.
    const blocks = bookBlocks(file);
    const entry = blocks.find((block) => block.partId === glossary.partId && block.role === 'glossary' && block.text.includes('going out'))!;
    expect(entry.lead?.text).toBe('Ebb');
    const settings = bookSettingsOf(file);
    const context: BookRenderContext = {
      settings,
      geometry: geometryOf(settings, 'instructional', 100),
      chapterStyle: chapterPageStyleOf(file),
      paragraphStyle: 'indented',
      pictures: new Map(),
      names: bookNames(file),
      titlePage: titlePageOf(file.project, file.settings),
      contents: [],
      index: null,
      citations: bookCitationsOf(file),
    };
    const page: BookPage = {
      sheet: 20, side: 'recto', numbering: 'arabic', number: 9, folio: '9', counted: '9', runningHead: '', runningFoot: '', chapterTitle: '',
      display: false, blank: false, opens: false, pieces: [{ blockId: entry.id, from: 0, to: 1 }], notes: [ebb.citation.key], noteParts: [], depth: 1, target: 30,
    };
    const html = renderBookPage(page, new Map(blocks.map((block) => [block.id, block])), context);
    // The foreword's is 1, the story's 2, the appendix's 3: Ebb's is 4.
    expect(html).toContain(`<span class="bk-lead bk-lead-bold">Ebb</span> — The tide going out.<sup class="bk-cite" data-cite="${ebb.citation.key}">4</sup>`);
    expect(html).toContain('<span class="bk-note-mark">4.</span> Jones, <i>On Tides</i>, 41.');
  });

  it('cites from a reader extra’s discussion questions, in their order, each set with its number', () => {
    let { file } = book();
    const source = file.references[0]!.id;
    const first = insertCitation(file, { referenceId: source, locator: '50' });
    file = first.file;
    const second = insertCitation(file, { referenceId: source, locator: '51' });
    file = second.file;
    const extra = addPart(file, 'reader_extra', {
      about: {
        kind: 'questions',
        numbering: 'numbers',
        questions: [
          { id: 'q1', text: `Why does the harbour empty twice a day?${first.token}` },
          { id: 'q2', text: `What did Jones get wrong?${second.token}` },
        ],
      },
    });
    file = extra.file;
    const inExtra = citationOccurrences(file).filter((one) => one.partId === extra.partId);
    // After the foreword (1), the story (2) and the appendix (3).
    expect(inExtra.map((one) => [one.key, one.marker])).toEqual([
      [first.citation.key, '4'],
      [second.citation.key, '5'],
    ]);
    const blocks = bookBlocks(file);
    const question = blocks.find((block) => block.partId === extra.partId && block.role === 'question' && block.text.includes('Jones'))!;
    expect(question.lead?.text).toBe('2.');
    const settings = bookSettingsOf(file);
    const context: BookRenderContext = {
      settings,
      geometry: geometryOf(settings, 'instructional', 100),
      chapterStyle: chapterPageStyleOf(file),
      paragraphStyle: 'indented',
      pictures: new Map(),
      names: bookNames(file),
      titlePage: titlePageOf(file.project, file.settings),
      contents: [],
      index: null,
      citations: bookCitationsOf(file),
    };
    const page: BookPage = {
      sheet: 22, side: 'recto', numbering: 'arabic', number: 11, folio: '11', counted: '11', runningHead: '', runningFoot: '', chapterTitle: '',
      display: false, blank: false, opens: false, pieces: [{ blockId: question.id, from: 0, to: 1 }], notes: [second.citation.key], noteParts: [], depth: 1, target: 30,
    };
    const html = renderBookPage(page, new Map(blocks.map((block) => [block.id, block])), context);
    expect(html).toContain(`What did Jones get wrong?<sup class="bk-cite" data-cite="${second.citation.key}">5</sup>`);
    expect(html).toContain('<span class="bk-note-mark">5.</span> Jones, <i>On Tides</i>, 51.');
  });

  it('cites from a newsletter’s message and the notes beside the author’s other titles', () => {
    let { file } = book();
    const source = file.references[0]!.id;
    const message = insertCitation(file, { referenceId: source, locator: '60' });
    file = message.file;
    const note = insertCitation(file, { referenceId: source, locator: '61' });
    file = note.file;
    const newsletter = addPart(file, 'reader_extra', { about: { kind: 'newsletter', message: `Tide tables for every port, as Jones kept them.${message.token}` } });
    file = newsletter.file;
    const also = addPart(file, 'reader_extra', {
      about: {
        kind: 'also_by',
        titles: [
          { id: 'b1', title: 'The Moon’s Hours', series: `after Jones’s tables${note.token}` },
          { id: 'b2', title: '', series: 'a title with no name is not listed' },
        ],
      },
    });
    file = also.file;
    const occurrences = citationOccurrences(file);
    // After the foreword (1), the story (2) and the appendix (3): the newsletter, then the also-by.
    expect(occurrences.filter((one) => one.partId === newsletter.partId).map((one) => one.marker)).toEqual(['4']);
    expect(occurrences.filter((one) => one.partId === also.partId).map((one) => [one.key, one.marker])).toEqual([[note.citation.key, '5']]);

    const blocks = bookBlocks(file);
    const title = blocks.find((block) => block.partId === also.partId && block.role === 'also')!;
    expect(title.text).toBe(`The Moon’s Hours — after Jones’s tables${note.token}`);
    const settings = bookSettingsOf(file);
    const context: BookRenderContext = {
      settings,
      geometry: geometryOf(settings, 'instructional', 100),
      chapterStyle: chapterPageStyleOf(file),
      paragraphStyle: 'indented',
      pictures: new Map(),
      names: bookNames(file),
      titlePage: titlePageOf(file.project, file.settings),
      contents: [],
      index: null,
      citations: bookCitationsOf(file),
    };
    const page: BookPage = {
      sheet: 24, side: 'recto', numbering: 'arabic', number: 13, folio: '13', counted: '13', runningHead: '', runningFoot: '', chapterTitle: '',
      display: false, blank: false, opens: false, pieces: [{ blockId: title.id, from: 0, to: 1 }], notes: [note.citation.key], noteParts: [], depth: 1, target: 30,
    };
    const html = renderBookPage(page, new Map(blocks.map((block) => [block.id, block])), context);
    expect(html).toContain(`The Moon’s Hours — after Jones’s tables<sup class="bk-cite" data-cite="${note.citation.key}">5</sup>`);
    expect(html).toContain('<span class="bk-note-mark">5.</span> Jones, <i>On Tides</i>, 61.');
  });
});
