import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addReference,
  addUnit,
  bookDocxParts,
  buildProjectFromImport,
  citationNotes,
  createProjectFile,
  docxToImport,
  ebookOf,
  flattened,
  formatEntry,
  formatNote,
  insertCitation,
  readDocx,
  referenceBibliography,
  referenceProblems,
  setCitationSettings,
  updateBeat,
  type ManuscriptElementId,
  type ProjectFile,
} from '../index.js';

/**
 * Citations leaving the book and coming back (addendum 43 §9, phase 3): Word
 * footnotes and the bibliography in the Word manuscript, linked notes in the
 * EPUB, and Word's footnotes read back in as citations, flagged for the
 * writer to separate.
 */

const para = (text: string) => ({ id: crypto.randomUUID() as ManuscriptElementId, type: 'paragraph' as const, text, characterId: null, attributes: {} });

/** A book of two chapters, each citing the same source: `@` in a line is a citation. */
const book = (chapters: string[][]): ProjectFile => {
  let file: ProjectFile = createProjectFile({ title: 'The Sea', format: 'instructional', author: 'R. Jones' });
  const made = addReference(file, { title: 'On Tides', authors: ['Jones, Robert'], date: '2019', publisher: 'Sea Press', place: 'Boston' });
  file = made.file;
  chapters.forEach((lines, index) => {
    const unit = addUnit(file, { trackId: file.tracks[0]!.id, title: `Unit ${index + 1}` });
    file = addMarker(unit.file, { unitId: unit.unit.id, kind: 'chapter', title: `Chapter ${index + 1}` }).file;
    const beat = addBeat(file, { unitId: unit.unit.id });
    file = beat.file;
    const elements = lines.map((line) => {
      let text = line;
      while (text.includes('@')) {
        const cited = insertCitation(file, { referenceId: made.reference.id, locator: String(10 + file.citations.length) });
        file = cited.file;
        text = text.replace('@', cited.token);
      }
      return para(text);
    });
    file = updateBeat(file, beat.beat.id, { manuscript: { elements } });
  });
  return file;
};

const count = (text: string, pattern: RegExp): number => (text.match(pattern) ?? []).length;

describe('the book as a Word document', () => {
  it('sets each citation as a Word footnote, the first in full and the rest short, with the bibliography at the end', () => {
    const file = book([['Tides follow@ the moon.'], ['They turn@ again.']]);
    const { document, footnotes, noteCount } = bookDocxParts(file);
    expect(noteCount).toBe(2);
    expect(count(document, /<w:footnoteReference w:id="\d+"\/>/g)).toBe(2);
    expect(document).not.toContain('[^');
    expect(footnotes).toContain('<w:footnote w:id="1">');
    // The first note in full, the title in italic; the second short.
    expect(footnotes).toContain('<w:t xml:space="preserve">Robert Jones, </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">On Tides</w:t>');
    expect(footnotes).toContain('(Boston: Sea Press, 2019), 10.');
    expect(footnotes).toContain('<w:t xml:space="preserve">, 11.</w:t>');
    // The separators Word needs.
    expect(footnotes).toContain('w:type="separator" w:id="-1"');
    // No bibliography page in the back matter: one is added from the library.
    expect(document).toContain('<w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">Bibliography</w:t>');
    expect(document).toContain('<w:pStyle w:val="Bibliography"/>');
    expect(document).toContain('<w:numFmt w:val="decimal"/><w:numRestart w:val="continuous"/>');
  });

  it('takes the bibliography from the back matter where the book has the page, and only once', () => {
    const file = addPart(book([['Tides follow@ the moon.']]), 'bibliography').file;
    const { document } = bookDocxParts(file);
    expect(count(document, /<w:pStyle w:val="Bibliography"\/>/g)).toBe(1);
    expect(document).toContain('Jones, Robert. </w:t>');
  });

  it('numbers in the book’s scheme, and per chapter as a section per chapter', () => {
    const file = setCitationSettings(book([['One@.'], ['Two@.']]), { markers: 'symbol', restartEach: 'chapter' });
    const { document } = bookDocxParts(file);
    expect(document).toContain('<w:numFmt w:val="chicago"/><w:numRestart w:val="eachSect"/>');
    // Each division is a section of its own, so Word can restart the count.
    expect(count(document, /<w:sectPr>/g)).toBe(5);
  });

  it('sets APA’s parenthetical in the line, with no footnotes', () => {
    const file = setCitationSettings(book([['Tides follow@.']]), { style: 'apa' });
    const { document, noteCount } = bookDocxParts(file);
    expect(noteCount).toBe(0);
    expect(document).not.toContain('footnoteReference');
    expect(document).toContain('<w:t xml:space="preserve">Tides follow</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t xml:space="preserve">(Jones, 2019, p. 10)</w:t>');
    expect(document).toContain('References');
  });
});

describe('the book as an EPUB', () => {
  const chapterHtml = (file: ProjectFile, index: number): string => {
    const pkg = ebookOf(file, { modified: '2026-01-01T00:00:00Z' });
    const section = pkg.sections.filter((one) => one.kind === 'chapter')[index]!;
    return pkg.entries.find((one) => one.path === `OEBPS/${section.href}`)!.data as string;
  };

  it('links each marker to its note at the end of its chapter, and the note back', () => {
    const file = book([['Tides follow@ the moon.'], ['They turn@ again.']]);
    const [first, second] = file.citations.map((one) => one.key);
    const one = chapterHtml(file, 0);
    expect(one).toContain(`Tides follow<sup class="noteref"><a epub:type="noteref" role="doc-noteref" href="#fn-${first}" id="ref-${first}">1</a></sup> the moon.`);
    expect(one).toContain(`<aside epub:type="footnote" role="doc-footnote" id="fn-${first}" class="footnote"><p><a href="#ref-${first}" role="doc-backlink">1.</a> Robert Jones, <em>On Tides</em> (Boston: Sea Press, 2019), 10.</p></aside>`);
    expect(one).not.toContain(`fn-${second}`);
    // Each chapter carries its own notes.
    const two = chapterHtml(file, 1);
    expect(two).toContain(`id="fn-${second}"`);
    expect(two).toContain('Jones, <em>On Tides</em>, 11.');
  });

  it('sets MLA’s parenthetical in the line, and no notes', () => {
    const file = setCitationSettings(book([['Tides follow@.']]), { style: 'mla' });
    const html = chapterHtml(file, 0);
    expect(html).toContain('Tides follow (Jones 10).');
    expect(html).not.toContain('epub:type="footnote"');
  });
});

// ------------------------------------------------------------- reading Word

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const ref = (id: number) => `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
const words = (text: string) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
const wordDocument = (body: string) => `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`;
const note = (id: number, ...runs: string[]) =>
  `<w:footnote w:id="${id}"><w:p><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>${runs.join('')}</w:p></w:footnote>`;
const wordNotes = (...notes: string[]) =>
  `<?xml version="1.0"?><w:footnotes ${W}><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
  `<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>${notes.join('')}</w:footnotes>`;

const fromWord = () =>
  readDocx({
    document: wordDocument(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:outlineLvl w:val="0"/></w:pPr>${words('Chapter One')}</w:p>` +
        `<w:p>${words('Tides follow the moon.')}${ref(1)}${words(' Twice a day.')}${ref(2)}</w:p>` +
        `<w:p>${words('They turn again.')}${ref(3)}</w:p>`,
    ),
    footnotes: wordNotes(
      note(1, words(' Robert Jones, '), '<w:r><w:rPr><w:i/></w:rPr><w:t>On Tides</w:t></w:r>', words(' (Boston: Sea Press, 2019), 12.')),
      note(2, words(' Ibid., 14.')),
      note(3, words(' Robert Jones, '), '<w:r><w:rPr><w:i/></w:rPr><w:t>On Tides</w:t></w:r>', words(' (Boston: Sea Press, 2019), 12.')),
    ),
  });

describe('footnotes read from Word', () => {
  it('reads each note and puts a token where its reference stood, keeping the words clean', () => {
    const doc = fromWord();
    expect(doc.notes!.map((one) => one.text)).toEqual([
      'Robert Jones, *On Tides* (Boston: Sea Press, 2019), 12.',
      'Ibid., 14.',
      'Robert Jones, *On Tides* (Boston: Sea Press, 2019), 12.',
    ]);
    const cited = doc.paragraphs[1]!;
    expect(cited.text).toBe('Tides follow the moon. Twice a day.');
    expect(cited.cited).toBe(`Tides follow the moon.[^${doc.notes![0]!.key}] Twice a day.[^${doc.notes![1]!.key}]`);
  });

  it('reads a note’s parts into one source, with Ibid. and the repeat cited at their own pages (§20)', () => {
    const doc = fromWord();
    const built = buildProjectFromImport(docxToImport(doc, 'instructional'), { format: 'instructional' }).file;
    expect(built.references).toHaveLength(1);
    const [jones] = built.references;
    expect(jones).toMatchObject({ type: 'book', authors: ['Jones, Robert'], title: 'On Tides', place: 'Boston', publisher: 'Sea Press', date: '2019', tags: ['From Word'] });
    expect(flattened(jones!)).toBe(false);
    // The Word text is kept beside the fields, for the writer to check them by.
    expect(jones!.asWritten).toBe('Robert Jones, *On Tides* (Boston: Sea Press, 2019), 12.');
    expect(built.citations.map((one) => [one.key, one.locator])).toEqual(doc.notes!.map((one, at) => [one.key, ['12', '14', '12'][at]]));
    const text = built.beats.flatMap((beat) => beat.manuscript.elements).map((element) => element.text).join('\n');
    for (const one of doc.notes!) expect(text).toContain(`[^${one.key}]`);
    // The style sets them now: in full the first time, short after.
    expect(citationNotes(built).map((one) => one.text)).toEqual([
      'Robert Jones, *On Tides* (Boston: Sea Press, 2019), 12.',
      'Jones, *On Tides*, 14.',
      'Jones, *On Tides*, 12.',
    ]);
    expect(referenceBibliography(built).map((one) => one.text)).toEqual(['Jones, Robert. *On Tides*. Boston: Sea Press, 2019.']);
  });

  it('keeps a note it cannot read as written, flagged, until the source has its parts', () => {
    let file = createProjectFile({ title: 'x', format: 'instructional' });
    const made = addReference(file, { type: 'other', asWritten: 'Jones told me this on the quay, 2019.', tags: ['From Word'] });
    file = made.file;
    const kept = made.reference;
    expect(flattened(kept)).toBe(true);
    expect(referenceProblems(kept).title).toMatch(/^Brought in from Word as one line/);
    expect(formatNote(kept, { locatorKind: 'page', locator: '', note: 'See also chapter 3' }, 'chicago', true)).toBe(
      'Jones told me this on the quay, 2019. See also chapter 3.',
    );
    const jones = { ...kept, title: 'On Tides', authors: ['Jones, Robert'], date: '2019' };
    expect(flattened(jones)).toBe(false);
    expect(formatEntry(jones, 'chicago')).toBe('Jones, Robert. *On Tides*. 2019.');
  });

  it('leaves footnotes out of a novel, and says so', () => {
    const script = docxToImport(fromWord(), 'novel');
    expect(script.notes).toBeUndefined();
    expect(script.warnings).toContain('3 footnotes were left out. Footnotes come in as citations on an instructional book; import into one to keep them.');
    const text = script.scenes.flatMap((scene) => scene.elements.map((element) => element.text)).join('\n');
    expect(text).not.toContain('[^');
  });

  it('goes round: the book’s own Word export reads back as the same notes', () => {
    const file = book([['Tides follow@ the moon.'], ['They turn@ again.']]);
    const parts = bookDocxParts(file);
    const doc = readDocx({ document: parts.document, footnotes: parts.footnotes });
    expect(doc.notes!.map((one) => one.text)).toEqual(citationNotes(file).map((one) => one.text));
  });
});

describe('a short title', () => {
  it('drops a leading article on a long title and never ends on a small word (Chicago 14.32)', () => {
    let file = createProjectFile({ title: 'x', format: 'instructional' });
    const made = addReference(file, { type: 'journal', title: 'The Moon and the Sea', authors: ['Lee, Ada'], container: 'Ocean Review' });
    file = made.file;
    expect(formatNote(made.reference, { locatorKind: 'page', locator: '14', note: '' }, 'chicago', false)).toBe('Lee, “Moon and the Sea,” 14.');
    const short = addReference(file, { title: 'The Shape of Things', authors: ['Smith, Jane'] }).reference;
    expect(formatNote(short, { locatorKind: 'page', locator: '3', note: '' }, 'chicago', false)).toBe('Smith, *The Shape of Things*, 3.');
  });
});
