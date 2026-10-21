import { describe, expect, it } from 'vitest';
import {
  binReportHtml,
  categoriesOf,
  createExtract,
  createProjectFile,
  ensureExtractPalettes,
  mainDocument,
  newId,
  palettesOf,
  recordTransfer,
  updateExtract,
  type ExtractId,
  type ProjectFile,
} from '../index.js';

/** The bin report (addendum 42 §12): the bins as a document to print or keep. */

const make = (): { file: ProjectFile; ids: string[] } => {
  let file = ensureExtractPalettes(createProjectFile({ title: 'Notes', format: 'document' }));
  const general = categoriesOf(file, palettesOf(file)[0]!.id);
  const kind = (k: string) => general.find((category) => category.kind === k)!.id;
  const ids: string[] = [];
  for (const [categoryId, text] of [
    [kind('character'), 'Sarah never sleeps <before> two.'],
    [kind('location'), 'The old house on Cutter Street.'],
    [kind('character'), 'She keeps a lamp lit.'],
  ] as const) {
    const made = createExtract(file, { id: newId<ExtractId>(), documentId: mainDocument(file)!.id, categoryId, textPlain: text });
    file = made.file;
    ids.push(made.extract.id);
  }
  return { file, ids };
};

describe('the bin report', () => {
  it('sets each bin under its own heading, in the order listed, with a count by bin', () => {
    const { file } = make();
    const html = binReportHtml(file, mainDocument(file)!);
    expect(html).toContain('<title>Notes: extracts</title>');
    expect(html).toContain('3 extracts in 2 bins');
    expect(html.indexOf('Character</h2>') >= 0 || html.includes('>Character<span')).toBe(true);
    expect(html.indexOf('Character')).toBeLessThan(html.indexOf('Location</'));
    // The two characters together, under Character, before Location.
    const body = html.slice(html.indexOf('<section'));
    expect(body.indexOf('She keeps a lamp lit.')).toBeLessThan(body.indexOf('The old house'));
    expect(html).toContain('<table class="summary">');
  });

  it('escapes the writer’s words, and says status, tags and where each was sent', () => {
    let { file, ids } = make();
    file = updateExtract(file, ids[0] as ExtractId, { tags: ['night'], status: 'ready' });
    file = recordTransfer(
      file,
      new Map([[ids[1]!, { projectId: 'p', projectTitle: 'The Lamp', path: null, area: 'research', areaName: 'Research › Locations', resultId: 'r', at: new Date().toISOString() }]]),
      'copy',
    );
    const html = binReportHtml(file, mainDocument(file)!);
    expect(html).toContain('Sarah never sleeps &lt;before&gt; two.');
    expect(html).not.toContain('<before>');
    expect(html).toContain('Ready · Tags: night');
    expect(html).toContain('Sent to The Lamp › Research › Locations');
  });

  it('reports only what is listed, and says what narrowed it', () => {
    const { file, ids } = make();
    const html = binReportHtml(file, mainDocument(file)!, { extractIds: [ids[1]!], filter: 'Matching “house”' });
    expect(html).toContain('1 extract in 1 bin · Matching “house”');
    expect(html).not.toContain('Sarah');
    expect(html).not.toContain('class="summary"');
    // The page is the document's paper.
    expect(html).toContain('@page { size: 8.5in 11in;');
  });
});
