/**
 * A zip written by hand, for testing the reader: every entry stored or
 * deflated as asked, with a real central directory behind it. Small enough to
 * read alongside `unzip.ts`, which is the point of writing it here.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

export interface ZipInput {
  name: string;
  data: Uint8Array | string;
  /** Already deflated bytes, where the entry should read as compressed. */
  deflated?: Uint8Array;
}

const encoder = new TextEncoder();

export const buildZip = (inputs: readonly ZipInput[]): ArrayBuffer => {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const input of inputs) {
    const raw = typeof input.data === 'string' ? encoder.encode(input.data) : input.data;
    const stored = input.deflated ?? raw;
    const method = input.deflated ? 8 : 0;
    const name = encoder.encode(input.name);
    const crc = crc32(raw);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, stored.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, stored);

    const entry = new Uint8Array(46 + name.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, stored.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    entry.set(name, 46);
    central.push(entry);

    offset += local.length + stored.length;
  }

  const directoryOffset = offset;
  const directorySize = central.reduce((total, entry) => total + entry.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, inputs.length, true);
  ev.setUint16(10, inputs.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, directoryOffset, true);

  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((total, piece) => total + piece.length, 0));
  let at = 0;
  for (const piece of all) {
    out.set(piece, at);
    at += piece.length;
  }
  return out.buffer;
};

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

/** A paragraph as Word writes one: a style, a run, the words. */
export const wordParagraph = (text: string, options: { style?: string; align?: string; indent?: number; face?: string; size?: number } = {}): string => {
  const props = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    options.indent !== undefined ? `<w:ind w:left="${Math.round(options.indent * 1440)}"/>` : '',
  ].join('');
  const runProps = [
    options.face ? `<w:rFonts w:ascii="${options.face}" w:hAnsi="${options.face}"/>` : '',
    options.size ? `<w:sz w:val="${options.size * 2}"/>` : '',
  ].join('');
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}<w:r>${runProps ? `<w:rPr>${runProps}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
};

export const WORD_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}>
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Garamond"/><w:sz w:val="56"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Garamond"/><w:b/><w:sz w:val="32"/></w:rPr></w:style>
</w:styles>`;

/** A whole `.docx`, as bytes, from the paragraphs of its body. */
export const buildDocx = (paragraphs: readonly string[], extra: readonly ZipInput[] = []): ArrayBuffer =>
  buildZip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types/>' },
    {
      name: 'word/document.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${paragraphs.join('')}<w:sectPr/></w:body></w:document>`,
    },
    { name: 'word/styles.xml', data: WORD_STYLES },
    ...extra,
  ]);
