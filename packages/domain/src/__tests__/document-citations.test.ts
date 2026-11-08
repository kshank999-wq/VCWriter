import { describe, expect, it } from 'vitest';
import {
  addReference,
  archiveReference,
  bringInReferences,
  citeDocumentHtml,
  documentMeasureHtml,
  documentPageBox,
  documentPagedHtml,
  pageNotesHtml,
  createProjectFile,
  documentBodyXml,
  documentCitations,
  insertCitation,
  occurrencesIn,
  setCitationSettings,
  setDocumentContent,
  type DocNode,
  type ProjectFile,
  type WpDocumentId,
} from '../index.js';

/**
 * The Reference Library in the word processor (addendum 43 §11): citations
 * as nodes in a document, each document counting on its own, the notes at the
 * end in print and as Word footnotes, a bibliography block that fills itself,
 * and sources brought in from another project's library.
 */

const text = (value: string): DocNode => ({ type: 'text', text: value });
const cite = (key: string): DocNode => ({ type: 'citation', attrs: { key } });
const para = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });

/** A Document project with one source cited `@` places in each document's paragraphs. */
const project = (documents: string[][]): { file: ProjectFile; ids: string[] } => {
  let file: ProjectFile = createProjectFile({ title: 'Letters', format: 'document' });
  const made = addReference(file, { title: 'On Tides', authors: ['Jones, Robert'], date: '2019', publisher: 'Sea Press', place: 'Boston' });
  file = made.file;
  const first = file.documents[0]!;
  const docs = documents.map((_, index) => (index === 0 ? first : { ...first, id: `doc-${index}` as WpDocumentId, title: `Doc ${index + 1}` }));
  file = { ...file, documents: docs };
  documents.forEach((lines, index) => {
    const content: DocNode = {
      type: 'doc',
      content: [
        ...lines.map((line) =>
          para(
            ...line.split('@').flatMap((piece, at, all) => {
              const out: DocNode[] = piece ? [text(piece)] : [];
              if (at < all.length - 1) {
                const cited = insertCitation(file, { referenceId: made.reference.id, locator: String(10 + file.citations.length) });
                file = cited.file;
                out.push(cite(cited.citation.key));
              }
              return out;
            }),
          ),
        ),
        { type: 'bibliography' },
      ],
    };
    file = setDocumentContent(file, docs[index]!.id, content);
  });
  return { file, ids: docs.map((one) => one.id as string) };
};

describe('citations in a document', () => {
  it('counts each document on its own: its notes from 1, its first citation of a source in full', () => {
    const { file, ids } = project([['Tides follow@ the moon@.'], ['They turn@.']]);
    expect(occurrencesIn(file, ids[0]!).map((one) => one.marker)).toEqual(['1', '2']);
    expect(occurrencesIn(file, ids[1]!).map((one) => [one.marker, one.firstOfSource])).toEqual([['1', true]]);
    const notes = documentCitations(file, ids[0]!).notes.map((one) => one.text);
    expect(notes).toEqual(['Robert Jones, *On Tides* (Boston: Sea Press, 2019), 10.', 'Jones, *On Tides*, 11.']);
    expect(documentCitations(file, ids[1]!).notes[0]!.text).toBe('Robert Jones, *On Tides* (Boston: Sea Press, 2019), 12.');
  });

  it('prints the markers in the line, the notes at the end, and the bibliography where the block stands', () => {
    const { file, ids } = project([['Tides follow@ the moon.']]);
    const key = file.citations[0]!.key;
    const html = `<p>Tides follow<sup class="wp-cite" data-cite="${key}"></sup> the moon.</p><div data-bibliography=""></div>`;
    const out = citeDocumentHtml(documentCitations(file, ids[0]!), html);
    expect(out).toContain('Tides follow<sup class="wp-cite"><a href="#wp-note-1" id="wp-ref-1">1</a></sup> the moon.');
    expect(out).toContain('<section class="wp-bibliography"><h2>Bibliography</h2><p class="wp-bibliography-entry">Jones, Robert. <em>On Tides</em>. Boston: Sea Press, 2019.</p></section>');
    expect(out).toContain('<section class="wp-notes"><h2>Notes</h2><p class="wp-note" id="wp-note-1"><a href="#wp-ref-1">1.</a> Robert Jones, <em>On Tides</em> (Boston: Sea Press, 2019), 10.</p></section>');
    // The notes before the bibliography, as a paper sets them.
    expect(out.indexOf('wp-notes')).toBeLessThan(out.indexOf('wp-bibliography'));
  });

  it('sets APA’s parenthetical in the line, with no notes, and its reference list', () => {
    const start = project([['Tides follow@.']]);
    const file = setCitationSettings(start.file, { style: 'apa' });
    const key = file.citations[0]!.key;
    const out = citeDocumentHtml(documentCitations(file, start.ids[0]!), `<p>Tides follow<sup data-cite="${key}"></sup>.</p><div data-bibliography=""></div>`);
    expect(out).toContain('Tides follow <span class="wp-cite-text">(Jones, 2019, p. 10)</span>.');
    expect(out).toContain('<h2>References</h2>');
    expect(out).not.toContain('wp-notes');
  });

  it('writes Word footnotes and the bibliography into the document’s Word file', () => {
    const { file, ids } = project([['Tides follow@ the moon@.']]);
    const document = file.documents[0]!;
    const { xml, context } = documentBodyXml(document, documentCitations(file, ids[0]!));
    expect(xml.match(/<w:footnoteReference w:id="\d"\/>/g)).toHaveLength(2);
    expect(context.footnotes).toEqual(['Robert Jones, *On Tides* (Boston: Sea Press, 2019), 10.', 'Jones, *On Tides*, 11.']);
    expect(xml).toContain('<w:pStyle w:val="Bibliography"/></w:pPr><w:r><w:t xml:space="preserve">Jones, Robert. </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">On Tides</w:t>');
    // Without the citations the nodes print nothing, as any unknown node's empty words.
    expect(documentBodyXml(document).xml).not.toContain('footnoteReference');
  });

  it('leaves the story’s own numbering alone', () => {
    const { file } = project([['Tides follow@.']]);
    expect(occurrencesIn(file, null)).toEqual([]);
  });
});

describe('bringing in sources from another library', () => {
  it('copies the live sources with ids of this project, and none it already has', () => {
    let book = createProjectFile({ title: 'The Sea', format: 'instructional' });
    const tides = addReference(book, { title: 'On Tides', authors: ['Jones, Robert'], doi: '10.1000/tides' });
    book = tides.file;
    const moon = addReference(book, { title: 'The Moon', authors: ['Lee, Ada'] });
    book = moon.file;
    const old = addReference(book, { title: 'Old Charts', authors: ['Hall, Ann'] });
    book = archiveReference(old.file, old.reference.id, true);

    let letters: ProjectFile = createProjectFile({ title: 'Letters', format: 'document' });
    letters = addReference(letters, { title: 'Tides, revisited', authors: ['Someone, Else'], doi: 'https://doi.org/10.1000/TIDES' }).file;

    const result = bringInReferences(letters, book.references);
    expect(result.added.map((one) => one.title)).toEqual(['The Moon']);
    expect(result.already.map((one) => one.title)).toEqual(['On Tides']);
    const brought = result.file.references.find((one) => one.title === 'The Moon')!;
    expect(brought.id).not.toBe(moon.reference.id);
    expect(brought.projectId).toBe(letters.project.id);
    expect(brought.authors).toEqual(['Lee, Ada']);
    // Twice is no different from once.
    expect(bringInReferences(result.file, book.references).added).toEqual([]);
  });

  it('brings only the ones picked', () => {
    let book = createProjectFile({ title: 'The Sea', format: 'instructional' });
    const one = addReference(book, { title: 'A' });
    book = addReference(one.file, { title: 'B' }).file;
    const letters = createProjectFile({ title: 'Letters', format: 'document' });
    expect(bringInReferences(letters, book.references, new Set([one.reference.id])).added.map((ref) => ref.title)).toEqual(['A']);
  });
});

describe('notes at the foot of each page (§23)', () => {
  it('leaves the notes off the end when the pages will carry them', () => {
    const { file, ids } = project([['Tides follow@ the moon.']]);
    const key = file.citations[0]!.key;
    const html = `<p>Tides follow<sup class="wp-cite" data-cite="${key}"></sup> the moon.</p>`;
    const set = citeDocumentHtml(documentCitations(file, ids[0]!), html, false);
    expect(set).toContain('<a href="#wp-note-1" id="wp-ref-1">1</a>');
    expect(set).not.toContain('wp-notes');
  });

  it('draws each set page the height of the page, its own notes at its foot', () => {
    const { file, ids } = project([['Tides follow@ the moon@.', 'They turn@.']]);
    const document = file.documents[0]!;
    // Letter, inch margins: six and a half by nine inches for words and notes.
    expect(documentPageBox(document)).toEqual({ width: 6.5, height: 9 });
    const cites = documentCitations(file, ids[0]!);
    const html = documentPagedHtml(document, [{ body: '<p>One.</p>', notes: [1, 2] }, { body: '<p>Two.</p>', notes: [3] }], cites);
    expect(html.match(/<section class="wp-page">/g)).toHaveLength(2);
    expect(html).toContain('.wp-doc .wp-page { height: 8.980in;');
    expect(html).toContain(
      '<section class="wp-page"><div class="wp-page-body"><p>Two.</p></div><div class="wp-page-notes"><p class="wp-note" id="wp-note-3"><a href="#wp-ref-3">3.</a> Jones, <em>On Tides</em>, 12.</p></div></section>',
    );
    expect(html).toContain('@page { size: 8.5in 11in;');
    // A page with nothing cited carries no rule at its foot.
    expect(documentPagedHtml(document, [{ body: '<p>Plain.</p>', notes: [] }], cites)).not.toContain('<div class="wp-page-notes">');
  });

  it('measures in the same stylesheet, at the width of the page’s words', () => {
    const { file } = project([['Tides.']]);
    const html = documentMeasureHtml(file.documents[0]!);
    expect(html).toContain('<div class="wp-doc" style="width: 6.5in"><div id="wp-flow"></div><div id="wp-page" class="wp-page-body"');
    expect(html).toContain('.wp-doc .wp-split { margin-bottom: 0 !important; }');
  });
});

describe('a long note carried on in a document’s print (§24)', () => {
  it('sets what is carried first, under a rule the width of the page, and the page’s last note as cut', () => {
    const { file, ids } = project([['Tides follow@ the moon@.', 'They turn@.']]);
    const cites = documentCitations(file, ids[0]!);
    const carried = '<p class="wp-note wp-cont">the rest of the long note.</p>';
    const cut = '<p class="wp-note wp-split" id="wp-note-3"><a href="#wp-ref-3">3.</a> Jones, the first lines</p>';
    expect(pageNotesHtml({ body: '', notes: [2, 3], carried, cut }, cites)).toBe(
      '<div class="wp-page-notes continues">' +
        carried +
        '<p class="wp-note" id="wp-note-2"><a href="#wp-ref-2">2.</a> Jones, <em>On Tides</em>, 11.</p>' +
        cut +
        '</div>',
    );
    // A page of nothing but what is carried still sets it.
    expect(pageNotesHtml({ body: '', notes: [], carried }, cites)).toBe(`<div class="wp-page-notes continues">${carried}</div>`);
    expect(pageNotesHtml({ body: '<p>x</p>', notes: [] }, cites)).toBe('');
    expect(documentPagedHtml(file.documents[0]!, [{ body: '', notes: [], carried }], cites)).toContain('.wp-doc .wp-page-notes.continues::before { width: 100%; }');
  });
});
