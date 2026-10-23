import { describe, expect, it } from 'vitest';
import {
  addReference,
  citationNotes,
  createProjectFile,
  fromWordReadable,
  fromWordUnread,
  insertCitation,
  readLocator,
  readNotes,
  recogniseFromWord,
  recogniseNote,
  updateBeat,
  addUnit,
  addBeat,
  type ManuscriptElementId,
  type ProjectFile,
} from '../index.js';

/**
 * Reading a Word footnote's parts (addendum 43 §20): Chicago's note forms
 * read back into a source's fields and the citation's page, short notes and
 * Ibid. finding the source before them, and anything else kept as written.
 */

describe('one note', () => {
  it('reads a book: authors turned round, title, place, publisher, year, and the page apart', () => {
    expect(recogniseNote('Robert Jones and Ada Lee, *On Tides*, 2nd ed. (Boston: Sea Press, 2019), 12.')).toEqual({
      kind: 'full',
      source: { type: 'book', authors: ['Jones, Robert', 'Lee, Ada'], title: 'On Tides', edition: '2nd', place: 'Boston', publisher: 'Sea Press', date: '2019' },
      locatorKind: 'page',
      locator: '12',
    });
    expect(recogniseNote('Harbour Board, *Tide Tables* (Sea Press, 2020)')).toMatchObject({
      source: { organization: 'Harbour Board', title: 'Tide Tables', publisher: 'Sea Press', date: '2020' },
      locator: '',
    });
    expect(recogniseNote('Bo Kim, ed., *The Sea Book* (London: Wave, 2010), 3–5.')).toMatchObject({
      source: { editors: ['Kim, Bo'], title: 'The Sea Book' },
      locatorKind: 'pages',
      locator: '3–5',
    });
  });

  it('reads a chapter in an edited book', () => {
    expect(recogniseNote('Ann Hall, “Charts,” in *The Sea Book*, ed. Bo Kim (London: Wave, 2010), 45.')).toEqual({
      kind: 'full',
      source: { type: 'chapter', authors: ['Hall, Ann'], title: 'Charts', container: 'The Sea Book', editors: ['Kim, Bo'], place: 'London', publisher: 'Wave', date: '2010' },
      locatorKind: 'page',
      locator: '45',
    });
  });

  it('reads an article, with its DOI', () => {
    expect(recogniseNote('Ada Lee, "The Pull of the Moon," *Journal of Tides* 4, no. 2 (Spring 2018): 33, https://doi.org/10.1000/tides.')).toEqual({
      kind: 'full',
      source: { type: 'journal', authors: ['Lee, Ada'], title: 'The Pull of the Moon', container: 'Journal of Tides', volume: '4', issue: '2', date: '2018', doi: '10.1000/tides' },
      locatorKind: 'page',
      locator: '33',
    });
  });

  it('reads a web page', () => {
    expect(recogniseNote('“Tide Tables,” Harbour Board, March 3, 2023, accessed May 1, 2024, https://harbour.example/tides.')).toEqual({
      kind: 'full',
      source: { type: 'website', title: 'Tide Tables', container: 'Harbour Board', date: '2023', accessed: 'May 1, 2024', url: 'https://harbour.example/tides' },
      locatorKind: 'page',
      locator: '',
    });
  });

  it('reads a short note and Ibid.', () => {
    expect(recogniseNote('Jones, *On Tides*, 20.')).toEqual({ kind: 'short', surname: 'Jones', title: 'On Tides', locatorKind: 'page', locator: '20' });
    expect(recogniseNote('Hall, “Charts,” 46.')).toMatchObject({ kind: 'short', surname: 'Hall', title: 'Charts', locator: '46' });
    expect(recogniseNote('Ibid., 14.')).toEqual({ kind: 'ibid', locatorKind: 'page', locator: '14' });
    expect(recogniseNote('Ibid.')).toEqual({ kind: 'ibid', locatorKind: 'page', locator: '' });
  });

  it('leaves a note it cannot read with confidence', () => {
    expect(recogniseNote('See the harbour master’s log for the whole of that winter.')).toBeNull();
    expect(recogniseNote('Jones told me this in 2019, on the quay.')).toBeNull();
    expect(recogniseNote('')).toBeNull();
  });

  it('reads a pinpoint’s kind', () => {
    expect(readLocator('pp. 12-14')).toEqual({ locatorKind: 'pages', locator: '12-14' });
    expect(readLocator('chap. 3')).toEqual({ locatorKind: 'chapter', locator: '3' });
    expect(readLocator('at 1:02:30')).toEqual({ locatorKind: 'timestamp', locator: '1:02:30' });
    expect(readLocator('fig. 2')).toEqual({ locatorKind: 'other', locator: 'fig. 2' });
  });
});

describe('a run of notes', () => {
  it('makes one source of a full note and the short notes and Ibid.s after it, each at its page', () => {
    const read = readNotes([
      { key: 'a', text: 'Robert Jones, *On Tides* (Boston: Sea Press, 2019), 12.' },
      { key: 'b', text: 'Ibid., 14.' },
      { key: 'c', text: 'Ann Hall, “Charts,” in *The Sea Book*, ed. Bo Kim (London: Wave, 2010), 45.' },
      { key: 'd', text: 'Jones, *On Tides*, 20.' },
      { key: 'e', text: 'Robert Jones, *On Tides* (Boston: Sea Press, 2019), 30.' },
      { key: 'f', text: 'See the log for that winter.' },
      { key: 'g', text: 'Ibid.' },
      { key: 'h', text: 'Lee, *Moonrise*, 9.' },
    ]);
    expect(read.sources.map((one) => one.source?.title ?? `as written: ${one.asWritten}`)).toEqual([
      'On Tides',
      'Charts',
      'as written: See the log for that winter.',
      'as written: Lee, *Moonrise*, 9.',
    ]);
    expect(read.cited.map((one) => [one.key, one.source, one.locator])).toEqual([
      ['a', 0, '12'],
      ['b', 0, '14'],
      ['c', 1, '45'],
      ['d', 0, '20'],
      ['e', 0, '30'],
      ['f', 2, ''],
      ['g', 2, ''],
      ['h', 3, ''],
    ]);
  });
});

/** A book whose citations were brought in from Word before notes were read: each one line. */
const oldImport = (): ProjectFile => {
  let file: ProjectFile = createProjectFile({ title: 'The Sea', format: 'instructional' });
  const notes = ['Robert Jones, *On Tides* (Boston: Sea Press, 2019), 12.', 'Ibid., 14.', 'Jones, *On Tides*, 20.', 'See the log for that winter.'];
  const tokens: string[] = [];
  for (const text of notes) {
    const made = addReference(file, { type: 'other', asWritten: text, tags: ['From Word'] });
    const cited = insertCitation(made.file, { referenceId: made.reference.id });
    file = cited.file;
    tokens.push(cited.token);
  }
  const unit = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' });
  const beat = addBeat(unit.file, { unitId: unit.unit.id });
  return updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: tokens.map((token, at) => ({ id: crypto.randomUUID() as ManuscriptElementId, type: 'paragraph' as const, text: `Line ${at + 1}.${token}`, characterId: null, attributes: {} })),
    },
  });
};

describe('sources already brought in from Word', () => {
  it('reads their parts in the order the book cites them, and takes out the lines left citing nothing', () => {
    const file = oldImport();
    expect(fromWordUnread(file)).toBe(4);
    expect(fromWordReadable(file)).toBe(3);
    const { file: read, read: count } = recogniseFromWord(file);
    expect(count).toBeGreaterThan(0);
    expect(read.references.map((one) => one.title || `as written: ${one.asWritten}`)).toEqual(['On Tides', 'as written: See the log for that winter.']);
    expect(fromWordUnread(read)).toBe(1);
    expect(fromWordReadable(read)).toBe(0);
    expect(citationNotes(read).map((note) => note.text)).toEqual([
      'Robert Jones, *On Tides* (Boston: Sea Press, 2019), 12.',
      // The style's own rule for a note citing the one before: Chicago's
      // short form, not Ibid.
      'Jones, *On Tides*, 14.',
      'Jones, *On Tides*, 20.',
      'See the log for that winter.',
    ]);
    // Twice is no different from once.
    expect(recogniseFromWord(read).read).toBe(0);
  });
});
