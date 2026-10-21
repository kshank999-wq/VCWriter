import { describe, expect, it } from 'vitest';
import {
  addCategory,
  addPalette,
  buildExtractBundle,
  categoriesOf,
  createExtract,
  createProjectFile,
  ensureExtractPalettes,
  extractsCsv,
  importExtractBundle,
  mainDocument,
  newId,
  palettesOf,
  readExtractBundle,
  serializeExtractBundle,
  type ExtractId,
  type ProjectFile,
} from '../index.js';

/**
 * The portable bundle and the CSV manifest (addendum 42 §11, WP spec §7.2):
 * extracts carried to another document or install with their palettes, and
 * a flat list for review.
 */

const make = (): ProjectFile => {
  let file = ensureExtractPalettes(createProjectFile({ title: 'Notes', format: 'document' }));
  const math = addPalette(file, 'Math Instruction');
  file = math.file;
  const times = addCategory(file, math.palette.id, 'Multiplication');
  file = times.file;
  const idea = categoriesOf(file, palettesOf(file)[0]!.id).find((category) => category.kind === 'idea')!;
  for (const [categoryId, text] of [
    [times.category.id, 'Seven times eight, "fifty-six".'],
    [idea.id, 'The lamp is a signal,\nacross the water.'],
  ] as const) {
    file = createExtract(file, { id: newId<ExtractId>(), documentId: mainDocument(file)!.id, categoryId, textPlain: text }).file;
  }
  return file;
};

describe('the extract bundle', () => {
  it('round-trips into another document, joining palettes of the same name, once', () => {
    const source = make();
    const text = serializeExtractBundle(buildExtractBundle(source));
    const read = readExtractBundle(text);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    const target = ensureExtractPalettes(createProjectFile({ title: 'Elsewhere', format: 'document' }));
    const first = importExtractBundle(target, read.bundle, mainDocument(target)!.id);
    expect(first.added).toBe(2);
    expect(palettesOf(first.file).map((palette) => palette.name)).toEqual(['General Writing', 'Math Instruction']);
    // General Writing was joined, not duplicated.
    expect(first.file.extractCategories).toHaveLength(target.extractCategories.length + 1);
    expect(first.file.extracts.every((extract) => extract.documentId === mainDocument(target)!.id)).toBe(true);

    const second = importExtractBundle(first.file, read.bundle, mainDocument(target)!.id);
    expect(second).toMatchObject({ added: 0, skipped: 2 });
    expect(second.file.extracts).toHaveLength(2);
  });

  it('refuses what is not a bundle, and a newer version, in words', () => {
    expect(readExtractBundle('nonsense')).toEqual({ ok: false, error: 'That file is not a VC Writer extract bundle.' });
    const newer = { ...buildExtractBundle(make()), version: 99 };
    expect(readExtractBundle(JSON.stringify(newer))).toMatchObject({ ok: false, error: expect.stringContaining('newer') });
  });

  it('writes a CSV a spreadsheet reads, quotes and line breaks included', () => {
    const csv = extractsCsv(make());
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Title,Category,Palette,Kind,Status,Tags,Sent to,Captured,Text');
    expect(csv).toContain('"Seven times eight, ""fifty-six""."');
    expect(csv).toContain('"The lamp is a signal,\nacross the water."');
  });
});
