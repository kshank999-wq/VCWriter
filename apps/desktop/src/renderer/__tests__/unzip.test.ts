import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { unzip, ZipError } from '../unzip';
import { readDocxParts } from '../read-docx';
import { buildDocx, buildZip, wordParagraph } from './zip-fixture';

/**
 * The host's half of reading a Word document (addendum 21 §2): the zip and
 * the parts. The domain's half is tested with strings in `import-docx.test.ts`.
 */

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

describe('unzip', () => {
  it('lists the entries and reads a stored one and a deflated one', async () => {
    const words = 'The kettle would not boil.';
    const zip = buildZip([
      { name: 'stored.txt', data: words },
      { name: 'deep/deflated.txt', data: words, deflated: new Uint8Array(deflateRawSync(Buffer.from(words))) },
    ]);
    const entries = unzip(zip);
    expect(entries.map((entry) => entry.name)).toEqual(['stored.txt', 'deep/deflated.txt']);
    const decoder = new TextDecoder();
    expect(decoder.decode(await entries[0]!.read())).toBe(words);
    expect(decoder.decode(await entries[1]!.read())).toBe(words);
  });

  it('refuses bytes that are not a zip', () => {
    expect(() => unzip(new TextEncoder().encode('<html>not a zip</html>').buffer as ArrayBuffer)).toThrow(ZipError);
    expect(() => unzip(new ArrayBuffer(4))).toThrow(ZipError);
  });
});

describe('reading the parts of a Word document', () => {
  it('hands the domain the document, the styles and the pictures as data URLs', async () => {
    const docx = buildDocx([wordParagraph('Chapter One', { style: 'Heading1' }), wordParagraph('It rained.')], [
      { name: 'word/media/image1.png', data: PNG_BYTES },
      { name: 'word/media/drawing1.emf', data: PNG_BYTES },
      { name: 'word/_rels/document.xml.rels', data: '<Relationships/>' },
    ]);
    const parts = await readDocxParts(docx);
    expect(parts.document).toContain('<w:body>');
    expect(parts.styles).toContain('Heading1');
    expect(parts.rels).toBe('<Relationships/>');
    expect(parts.theme).toBeUndefined();
    expect(parts.media?.get('word/media/image1.png')).toBe(`data:image/png;base64,${Buffer.from(PNG_BYTES).toString('base64')}`);
    // A picture in a form the page cannot draw is left out.
    expect(parts.media?.has('word/media/drawing1.emf')).toBe(false);
  });

  it('says what is wrong when the file is a zip with no document in it, or no zip at all', async () => {
    await expect(readDocxParts(buildZip([{ name: 'notes.txt', data: 'hello' }]))).rejects.toThrow(/no document part/);
    await expect(readDocxParts(new TextEncoder().encode('plain text').buffer as ArrayBuffer)).rejects.toThrow(/not a zip archive/);
  });
});
