import { describe, expect, it } from 'vitest';
import { addReference, createProjectFile, formatEntry, formatInText, readNotes, recogniseNote, type Reference } from '../index.js';

/**
 * Word notes in APA's and MLA's forms (addendum 43 §27): a whole reference
 * or works-cited entry read into its parts, and the short forms in
 * parentheses citing the source a note before them gave.
 */

describe('APA', () => {
  it('reads a book, an article, a chapter and a web page', () => {
    expect(recogniseNote('Jones, R., & Lee, A. B. (2019). *On tides* (2nd ed.). Sea Press.')).toEqual({
      kind: 'full',
      source: { type: 'book', authors: ['Jones, R.', 'Lee, A. B.'], title: 'On tides', edition: '2nd', publisher: 'Sea Press', date: '2019' },
      locatorKind: 'page',
      locator: '',
    });
    expect(recogniseNote('Lee, A. (2018). The pull of the moon. *Journal of Tides*, *4*(2), 33–40. https://doi.org/10.1000/tides')).toMatchObject({
      source: { type: 'journal', authors: ['Lee, A.'], title: 'The pull of the moon', container: 'Journal of Tides', volume: '4', issue: '2', date: '2018', doi: '10.1000/tides' },
    });
    expect(recogniseNote('Hall, A. (2010). Charts. In B. Kim & C. Day (Eds.), *The sea book* (pp. 45–60). Wave.')).toMatchObject({
      source: { type: 'chapter', authors: ['Hall, A.'], title: 'Charts', editors: ['Kim, B.', 'Day, C.'], container: 'The sea book', publisher: 'Wave', date: '2010' },
    });
    expect(recogniseNote('Harbour Board. (2023, March 3). *Tide tables*. Harbour Board. https://harbour.example/tides')).toMatchObject({
      source: { type: 'website', organization: 'Harbour Board', title: 'Tide tables', date: '2023', url: 'https://harbour.example/tides' },
    });
  });

  it('reads the short forms in parentheses, with their year', () => {
    expect(recogniseNote('(Jones, 2019, p. 12)')).toEqual({ kind: 'short', surname: 'Jones', title: '', year: '2019', locatorKind: 'page', locator: '12' });
    expect(recogniseNote('Jones and Lee (2019, pp. 12–14).')).toMatchObject({ surname: 'Jones', year: '2019', locatorKind: 'pages', locator: '12–14' });
    expect(recogniseNote('(Jones et al., 2019)')).toMatchObject({ surname: 'Jones', year: '2019', locator: '' });
  });
});

describe('MLA', () => {
  it('reads a book, an article, a chapter and a web page', () => {
    expect(recogniseNote('Jones, Robert, and Ada Lee. *On Tides*. Sea Press, 2019.')).toEqual({
      kind: 'full',
      source: { type: 'book', authors: ['Jones, Robert', 'Lee, Ada'], title: 'On Tides', publisher: 'Sea Press', date: '2019' },
      locatorKind: 'page',
      locator: '',
    });
    expect(recogniseNote('Lee, Ada. "The Pull of the Moon." *Journal of Tides*, vol. 4, no. 2, 2018, pp. 33–40.')).toMatchObject({
      source: { type: 'journal', authors: ['Lee, Ada'], title: 'The Pull of the Moon', container: 'Journal of Tides', volume: '4', issue: '2', date: '2018' },
    });
    expect(recogniseNote('Hall, Ann. “Charts.” *The Sea Book*, edited by Bo Kim, Wave, 2010, pp. 45–60.')).toMatchObject({
      source: { type: 'chapter', authors: ['Hall, Ann'], title: 'Charts', container: 'The Sea Book', editors: ['Kim, Bo'], publisher: 'Wave', date: '2010' },
    });
    expect(recogniseNote('"Tide Tables." *Harbour Board*, 3 Mar. 2023, harbour.example/tides.')).toMatchObject({
      source: { type: 'website', title: 'Tide Tables', container: 'Harbour Board', date: '2023', url: 'harbour.example/tides' },
    });
  });

  it('reads the short forms in parentheses, by author and, where given, title', () => {
    expect(recogniseNote('(Jones 12)')).toEqual({ kind: 'short', surname: 'Jones', title: '', locatorKind: 'page', locator: '12' });
    expect(recogniseNote('(Jones, *On Tides* 12–14)')).toMatchObject({ surname: 'Jones', title: 'On Tides', locatorKind: 'pages', locator: '12–14' });
    expect(recogniseNote('(Jones and Lee xii)')).toMatchObject({ surname: 'Jones', locatorKind: 'other', locator: 'xii' });
    // A year written without APA's comma is a year, not a page.
    expect(recogniseNote('(Jones 2019)')).toMatchObject({ surname: 'Jones', year: '2019', locator: '' });
    // And a remark in parentheses is no citation at all.
    expect(recogniseNote('(See also chapter 3)')).toBeNull();
  });
});

describe('a run of notes in either style', () => {
  it('cites the source a whole entry gave from the short forms after it, at their own pages', () => {
    const apa = readNotes([
      { key: 'a', text: 'Jones, R. (2019). *On tides*. Sea Press.' },
      { key: 'b', text: 'Lee, A. (2019). *Moonrise*. Wave.' },
      { key: 'c', text: '(Jones, 2019, p. 12)' },
      { key: 'd', text: '(Lee, 2018, p. 3)' },
    ]);
    expect(apa.sources.map((one) => one.source?.title ?? `as written: ${one.asWritten}`)).toEqual(['On tides', 'Moonrise', 'as written: (Lee, 2018, p. 3)']);
    expect(apa.cited.map((one) => [one.key, one.source, one.locator])).toEqual([
      ['a', 0, ''],
      ['b', 1, ''],
      ['c', 0, '12'],
      // A year that is not the source's names some other work: kept as written.
      ['d', 2, ''],
    ]);

    const mla = readNotes([
      { key: 'a', text: 'Jones, Robert. *On Tides*. Sea Press, 2019.' },
      { key: 'b', text: 'Jones, Robert. *Moonrise*. Wave, 2021.' },
      { key: 'c', text: '(Jones, *On Tides* 12)' },
      { key: 'd', text: '(Jones 40)' },
    ]);
    // With no title, the latest work by the author is the one meant.
    expect(mla.cited.map((one) => [one.key, one.source, one.locator])).toEqual([
      ['a', 0, ''],
      ['b', 1, ''],
      ['c', 0, '12'],
      ['d', 1, '40'],
    ]);
  });

  it('reads back what the book’s own APA and MLA write', () => {
    let file = createProjectFile({ title: 'x', format: 'instructional' });
    const sources: Reference[] = [];
    for (const input of [
      { type: 'book' as const, title: 'On Tides', authors: ['Jones, Robert'], publisher: 'Sea Press', date: '2019' },
      { type: 'journal' as const, title: 'The Pull of the Moon', authors: ['Lee, Ada'], container: 'Journal of Tides', volume: '4', issue: '2', pages: '33–40', date: '2018' },
    ]) {
      const made = addReference(file, input);
      file = made.file;
      sources.push(made.reference);
    }
    for (const form of ['apa', 'mla'] as const) {
      for (const source of sources) {
        const read = recogniseNote(formatEntry(source, form));
        expect(read, `${form}: ${formatEntry(source, form)}`).toMatchObject({ kind: 'full', source: { type: source.type, date: source.date } });
        const short = recogniseNote(formatInText(source, { locatorKind: 'page', locator: '12' }, form));
        expect(short, `${form}: ${formatInText(source, { locatorKind: 'page', locator: '12' }, form)}`).toMatchObject({ kind: 'short', locator: '12' });
      }
    }
  });
});
