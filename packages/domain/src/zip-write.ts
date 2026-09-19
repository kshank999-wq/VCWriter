/**
 * Writing a zip (addendum 23 §5). The reader is the desktop's `unzip.ts`;
 * this is its other half, here in the domain because an EPUB is a zip and
 * the package is built here. Deflating is the platform's
 * (`CompressionStream('deflate-raw')`, in Chromium and in Node), so nothing
 * is shipped for it, and an entry asked to be *stored* is written as it is —
 * which an EPUB's `mimetype` must be, first and uncompressed, so a reader
 * can tell what the file is from its first bytes.
 */

export interface ZipInput {
  path: string;
  data: Uint8Array;
  /** Written uncompressed. */
  stored?: boolean;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const deflateRaw = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new CompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

/** MS-DOS date and time fields, from a moment; the zip format has no other clock. */
const dosStamp = (at: Date): { time: number; date: number } => ({
  time: (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | Math.floor(at.getUTCSeconds() / 2),
  date: ((Math.max(1980, at.getUTCFullYear()) - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate(),
});

/**
 * The archive, entries in the order given. `at` is the timestamp every
 * entry carries — one clock for the whole file, so two exports of the same
 * book differ only where they were asked to.
 */
export const writeZip = async (entries: readonly ZipInput[], at: Date = new Date(0)): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const stamp = dosStamp(at);
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const raw = entry.data;
    const stored = entry.stored ? raw : await deflateRaw(raw);
    // Deflate rarely loses, but a tiny file can come out larger; keep the
    // smaller of the two, which is what every archiver does.
    const useStored = entry.stored || stored.length >= raw.length;
    const body = useStored ? raw : stored;
    const method = useStored ? 0 : 8;
    const crc = crc32(raw);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // names are UTF-8
    lv.setUint16(8, method, true);
    lv.setUint16(10, stamp.time, true);
    lv.setUint16(12, stamp.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, body);

    const record = new Uint8Array(46 + name.length);
    const cv = new DataView(record.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, stamp.time, true);
    cv.setUint16(14, stamp.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);

    offset += local.length + body.length;
  }

  const directorySize = central.reduce((total, record) => total + record.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);

  const pieces = [...locals, ...central, end];
  const out = new Uint8Array(pieces.reduce((total, piece) => total + piece.length, 0));
  let at_ = 0;
  for (const piece of pieces) {
    out.set(piece, at_);
    at_ += piece.length;
  }
  return out;
};
