import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addReference,
  addUnit,
  archiveReference,
  bibliographyHeadingOf,
  citationInText,
  citationMarkers,
  citationNotes,
  citationOccurrences,
  citationSettingsOf,
  createProjectFile,
  danglingCitations,
  duplicateReference,
  formatEntry,
  formatInText,
  formatNote,
  insertCitation,
  markerLabel,
  mergeReferences,
  newId,
  parseInline,
  parseInlineMarks,
  plainInline,
  possibleDuplicates,
  referenceBibliography,
  referenceProblems,
  referencesOf,
  removeReference,
  setCitationSettings,
  tokensIn,
  unitsInStoryOrder,
  updateBeat,
  updateReference,
  type BeatId,
  type ManuscriptElementId,
  type ProjectFile,
  type Reference,
  type ReferenceInput,
} from '../index.js';

/**
 * The Reference Library and citations (addendum 43), against the spec's
 * acceptance tests: one source cited three times is three notes and one
 * bibliography entry; an edit to the source shows everywhere; markers
 * renumber; a style change re-renders without touching the facts.
 */

const BOOK: ReferenceInput = {
  type: 'book',
  authors: ['Smith, Jane'],
  title: 'The Shape of Things: A History',
  place: 'Chicago',
  publisher: 'University of Chicago Press',
  date: '2020',
};

const ARTICLE: ReferenceInput = {
  type: 'journal',
  authors: ['Jones, Robert', 'Lee, Ann'],
  title: 'On Tides',
  container: 'Journal of the Sea',
  volume: '12',
  issue: '3',
  date: '2019-05',
  pages: '101-120',
  doi: 'https://doi.org/10.1000/tides.12',
};

/** A book with one section and one beat, its lines given as text. */
const book = (lines: string[]): { file: ProjectFile; beatId: BeatId } => {
  const file = createProjectFile({ title: 'Book', format: 'instructional' });
  const beatId = file.beats[0]!.id;
  return { file: write(file, beatId, lines), beatId };
};

const write = (file: ProjectFile, beatId: BeatId, lines: string[]): ProjectFile =>
  updateBeat(file, beatId, {
    manuscript: { elements: lines.map((text) => ({ id: newId<ManuscriptElementId>(), type: 'paragraph' as const, text, characterId: null, attributes: {} })) },
  });

/** Cite `reference` n times, returning the tokens. */
const cite = (file: ProjectFile, reference: Reference, locators: string[]): { file: ProjectFile; tokens: string[] } => {
  const tokens: string[] = [];
  let next = file;
  for (const locator of locators) {
    const made = insertCitation(next, { referenceId: reference.id, locator });
    next = made.file;
    tokens.push(made.token);
  }
  return { file: next, tokens };
};

describe('tokens in the text', () => {
  it('a citation is one span that prints nothing on its own, and the writing keeps every character', () => {
    expect(parseInline('As shown[^ab12cd] here.')).toEqual([{ text: 'As shown' }, { text: '', citation: 'ab12cd' }, { text: ' here.' }]);
    expect(plainInline('As shown[^ab12cd] here.')).toBe('As shown here.');
    expect(parseInlineMarks('*a*[^ab12cd]').map((span) => span.text).join('')).toBe('*a*[^ab12cd]');
    expect(tokensIn('x[^ab12cd]y[^000fff]')).toEqual([
      { key: 'ab12cd', start: 1, end: 10 },
      { key: '000fff', start: 11, end: 20 },
    ]);
    // Not a token: too short, or capitals.
    expect(parseInline('[^ab12] and [^AB12CD]').every((span) => !span.citation)).toBe(true);
  });
});

describe('the acceptance tests', () => {
  it('one source cited three times: three linked notes, one bibliography entry', () => {
    const made = addReference(book([]).file, BOOK);
    const { file, tokens } = cite(made.file, made.reference, ['12', '15', '']);
    const beatId = file.beats[0]!.id;
    const written = write(file, beatId, [`First${tokens[0]}.`, `Second${tokens[1]} and third${tokens[2]}.`]);
    const notes = citationNotes(written);
    expect(notes.map((note) => note.marker)).toEqual(['1', '2', '3']);
    expect(notes.map((note) => note.text)).toEqual([
      'Jane Smith, *The Shape of Things: A History* (Chicago: University of Chicago Press, 2020), 12.',
      'Smith, *The Shape of Things*, 15.',
      'Smith, *The Shape of Things*.',
    ]);
    expect(referenceBibliography(written)).toEqual([
      { reference: expect.objectContaining({ id: made.reference.id }), text: 'Smith, Jane. *The Shape of Things: A History*. Chicago: University of Chicago Press, 2020.' },
    ]);
  });

  it('changing the source’s author and title changes every note and the entry', () => {
    const made = addReference(book([]).file, BOOK);
    const { file, tokens } = cite(made.file, made.reference, ['1', '2', '3']);
    const written = write(file, file.beats[0]!.id, [tokens.join(' ')]);
    const changed = updateReference(written, made.reference.id, { authors: ['Brown, Ada'], title: 'Forms' });
    expect(citationNotes(changed).map((note) => note.text)).toEqual([
      'Ada Brown, *Forms* (Chicago: University of Chicago Press, 2020), 1.',
      'Brown, *Forms*, 2.',
      'Brown, *Forms*, 3.',
    ]);
    expect(referenceBibliography(changed)[0]!.text).toBe('Brown, Ada. *Forms*. Chicago: University of Chicago Press, 2020.');
  });

  it('inserting and removing citations between others renumbers them, links intact', () => {
    const made = addReference(book([]).file, BOOK);
    const { file, tokens } = cite(made.file, made.reference, ['1', '2', '3', '4']);
    const beatId = file.beats[0]!.id;
    const [a, b, c, d] = tokens as [string, string, string, string];
    let written = write(file, beatId, [`One${a}`, `Three${c}`]);
    expect([...citationMarkers(written)]).toEqual([
      [a.slice(2, 8), '1'],
      [c.slice(2, 8), '2'],
    ]);
    written = write(written, beatId, [`One${a}`, `Two${b}`, `Three${c}`, `Four${d}`]);
    expect(citationOccurrences(written).map((one) => [one.citation!.locator, one.marker])).toEqual([
      ['1', '1'],
      ['2', '2'],
      ['3', '3'],
      ['4', '4'],
    ]);
    written = write(written, beatId, [`One${a}`, `Four${d}`]);
    expect(citationOccurrences(written).map((one) => [one.citation!.locator, one.marker])).toEqual([
      ['1', '1'],
      ['4', '2'],
    ]);
  });

  it('switching style or markers re-renders the notes and the bibliography, and the source is untouched', () => {
    const first = addReference(book([]).file, BOOK);
    const second = addReference(first.file, ARTICLE);
    const one = cite(second.file, first.reference, ['12']);
    const two = cite(one.file, second.reference, ['105']);
    let file = write(two.file, two.file.beats[0]!.id, [`A${one.tokens[0]} b${two.tokens[0]}.`]);
    const before = JSON.stringify(file.references);

    file = setCitationSettings(file, { markers: 'symbol' });
    expect(citationNotes(file).map((note) => note.marker)).toEqual(['*', '†']);

    file = setCitationSettings(file, { style: 'apa' });
    expect(citationNotes(file)).toEqual([]);
    expect(citationOccurrences(file).map((occurrence) => citationInText(file, occurrence))).toEqual(['(Smith, 2020, p. 12)', '(Jones & Lee, 2019, p. 105)']);
    expect(referenceBibliography(file).map((entry) => entry.text)).toEqual([
      'Jones, R., & Lee, A. (2019, May). On Tides. *Journal of the Sea*, *12*(3), 101–120. https://doi.org/10.1000/tides.12',
      'Smith, J. (2020). *The Shape of Things: A History*. University of Chicago Press.',
    ]);
    expect(bibliographyHeadingOf(citationSettingsOf(file))).toBe('References');

    file = setCitationSettings(file, { style: 'mla' });
    expect(citationOccurrences(file).map((occurrence) => citationInText(file, occurrence))).toEqual(['(Smith 12)', '(Jones and Lee 105)']);
    expect(bibliographyHeadingOf(citationSettingsOf(file))).toBe('Works Cited');

    file = setCitationSettings(file, { style: 'custom', customNoteForm: 'apa', markers: 'alpha' });
    expect(citationNotes(file).map((note) => [note.marker, note.text])).toEqual([
      ['a', 'Smith, 2020, p. 12.'],
      ['b', 'Jones & Lee, 2019, p. 105.'],
    ]);
    expect(JSON.stringify(file.references)).toBe(before);
  });
});

describe('markers', () => {
  it('counts 1, 2, 3; a … z, aa; and *, †, ‡ … then doubled, or numbers', () => {
    expect([1, 26, 27, 28].map((n) => markerLabel(n, 'alpha'))).toEqual(['a', 'z', 'aa', 'ab']);
    expect([1, 2, 6, 7, 8].map((n) => markerLabel(n, 'symbol'))).toEqual(['*', '†', '¶', '**', '††']);
    expect(markerLabel(7, 'symbol', 'numeric')).toBe('7');
  });

  it('restarts with each chapter when asked', () => {
    let { file } = book([]);
    const made = addReference(file, BOOK);
    file = made.file;
    const second = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Two' });
    file = addMarker(second.file, { unitId: second.unit.id, kind: 'chapter', title: 'Chapter 2' }).file;
    const beat = addBeat(file, { unitId: second.unit.id });
    file = beat.file;
    const cited = cite(file, made.reference, ['1', '2', '3']);
    file = write(cited.file, cited.file.beats[0]!.id, [`${cited.tokens[0]}${cited.tokens[1]}`]);
    file = write(file, beat.beat.id, [`${cited.tokens[2]}`]);
    expect(unitsInStoryOrder(file)).toHaveLength(2);
    expect(citationOccurrences(file).map((one) => one.marker)).toEqual(['1', '2', '3']);
    file = setCitationSettings(file, { restartEach: 'chapter' });
    expect(citationOccurrences(file).map((one) => one.marker)).toEqual(['1', '2', '1']);
  });
});

describe('the library', () => {
  it('searches, archives, duplicates and refuses to delete a cited source', () => {
    const made = addReference(book([]).file, { ...BOOK, shortCode: 'Smith2020', tags: ['history'] });
    const article = addReference(made.file, ARTICLE);
    let file = article.file;
    expect(referencesOf(file, { query: 'smith2020' }).map((one) => one.title)).toEqual(['The Shape of Things: A History']);
    expect(referencesOf(file, { type: 'journal' }).map((one) => one.title)).toEqual(['On Tides']);
    expect(referencesOf(file, { tag: 'history' })).toHaveLength(1);
    file = archiveReference(file, article.reference.id, true);
    expect(referencesOf(file).map((one) => one.title)).toEqual(['The Shape of Things: A History']);
    expect(referencesOf(file, { archived: true }).map((one) => one.title)).toEqual(['On Tides']);
    const copy = duplicateReference(file, made.reference.id);
    expect(copy.reference).toMatchObject({ title: BOOK.title, shortCode: 'Smith2020-copy' });
    const cited = insertCitation(copy.file, { referenceId: made.reference.id });
    expect(removeReference(cited.file, made.reference.id)).toBe(cited.file);
    expect(removeReference(cited.file, copy.reference!.id).references).toHaveLength(2);
  });

  it('finds duplicates and merges them, pointing every citation at the one kept', () => {
    const first = addReference(book([]).file, { ...BOOK, tags: ['a'] });
    const second = addReference(first.file, { ...BOOK, title: 'the shape of things — a history', isbn: '9780226000001', tags: ['b'] });
    const cited = insertCitation(second.file, { referenceId: second.reference.id });
    expect(possibleDuplicates(cited.file).map((group) => group.length)).toEqual([2]);
    const merged = mergeReferences(cited.file, first.reference.id, [second.reference.id]);
    expect(merged.references).toHaveLength(1);
    expect(merged.references[0]).toMatchObject({ isbn: '9780226000001', tags: ['a', 'b'] });
    expect(merged.citations[0]!.referenceId).toBe(first.reference.id);
  });

  it('says what is wrong with a DOI, a URL, a date or an ISBN, field by field', () => {
    const made = addReference(book([]).file, { title: 'X', doi: '10.1000/ok', url: 'example.com', date: '2024-13', isbn: '123' });
    expect(referenceProblems(made.reference)).toEqual({
      url: 'That is not a complete web address. It should start https://.',
      date: 'Write it as 2024, 2024-03 or 2024-03-15.',
      isbn: 'An ISBN has 10 or 13 digits.',
    });
    expect(referenceProblems({ ...made.reference, doi: 'nope', url: 'https://example.com/a', date: '2024-03-15', isbn: '978-0-226-00000-1' })).toEqual({
      doi: 'A DOI starts 10. and a number, then a slash: 10.1000/xyz123.',
    });
  });

  it('a citation whose source was removed is listed, not silently dropped', () => {
    const made = addReference(book([]).file, BOOK);
    const cited = insertCitation(made.file, { referenceId: made.reference.id });
    const file = write({ ...cited.file, references: [] }, cited.file.beats[0]!.id, [`x${cited.token}`]);
    expect(danglingCitations(file)).toHaveLength(1);
    expect(citationNotes(file)[0]!.text).toContain('Source missing');
  });
});

describe('the styles', () => {
  const article = addReference(createProjectFile({ title: 'B', format: 'instructional' }), ARTICLE).reference;

  it('Chicago: a journal article, note and entry', () => {
    expect(formatNote(article, { locatorKind: 'page', locator: '105', note: '' }, 'chicago', true)).toBe(
      'Robert Jones and Ann Lee, “On Tides,” *Journal of the Sea* 12, no. 3 (May 2019): 105, https://doi.org/10.1000/tides.12.',
    );
    expect(formatEntry(article, 'chicago')).toBe(
      'Jones, Robert, and Ann Lee. “On Tides.” *Journal of the Sea* 12, no. 3 (May 2019): 101–120. https://doi.org/10.1000/tides.12.',
    );
  });

  it('MLA: the entry and the citation in the text', () => {
    expect(formatEntry(article, 'mla')).toBe(
      'Jones, Robert, and Ann Lee. “On Tides.” *Journal of the Sea*, vol. 12, no. 3, May 2019, pp. 101–120, doi.org/10.1000/tides.12.',
    );
    expect(formatInText(article, { locatorKind: 'pages', locator: '105-107' }, 'mla')).toBe('(Jones and Lee 105–107)');
  });

  it('keeps the source’s own asterisks as characters, and adds the writer’s note', () => {
    const made = addReference(createProjectFile({ title: 'B', format: 'instructional' }), { title: 'Stars * and _lines_' });
    const note = formatNote(made.reference, { locatorKind: 'section', locator: '2', note: 'see also chapter 4' }, 'chicago', true);
    expect(note).toBe('*Stars \\* and \\_lines\\_*, sec. 2. See also chapter 4.'.replace('See', 'see'));
    expect(plainInline(note)).toBe('Stars * and _lines_, sec. 2. see also chapter 4.');
  });
});
