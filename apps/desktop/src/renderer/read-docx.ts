import { ImportError, type DocxParts } from '@vcwriter/domain';
import { unzip, ZipError } from './unzip';

/**
 * The host's half of reading a Word document (addendum 21 §2): unzip it and
 * hand the domain the parts it reads. What the words *are* is decided in
 * `import-docx.ts`, where it is tested with a string; this turns bytes into
 * strings and pictures into data URLs and nothing else.
 */

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const CHUNK = 0x8000;
  for (let at = 0; at < bytes.length; at += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK));
  }
  return btoa(binary);
};

/** The XML parts and the pictures of a `.docx`. Throws an `ImportError` where the file is not one. */
export const readDocxParts = async (buffer: ArrayBuffer): Promise<DocxParts> => {
  let entries;
  try {
    entries = unzip(buffer);
  } catch (error) {
    if (error instanceof ZipError) throw new ImportError('That is not a Word document — it is not a zip archive.');
    throw error;
  }
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const decoder = new TextDecoder('utf-8');
  const text = async (name: string): Promise<string | undefined> => {
    const entry = byName.get(name);
    return entry ? decoder.decode(await entry.read()) : undefined;
  };

  const document = await text('word/document.xml');
  if (document === undefined) throw new ImportError('That is not a Word document — there is no document part in it.');

  const media = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.name.startsWith('word/media/')) continue;
    const extension = entry.name.split('.').pop()?.toLowerCase() ?? '';
    const type = IMAGE_TYPES[extension];
    // A picture in a form the page cannot draw (an EMF, a WMF) is left out,
    // and the paragraph it sat in comes in without it.
    if (!type) continue;
    media.set(entry.name, `data:${type};base64,${toBase64(await entry.read())}`);
  }

  const parts: DocxParts = { document, media };
  const styles = await text('word/styles.xml');
  if (styles !== undefined) parts.styles = styles;
  const theme = await text('word/theme/theme1.xml');
  if (theme !== undefined) parts.theme = theme;
  const rels = await text('word/_rels/document.xml.rels');
  if (rels !== undefined) parts.rels = rels;
  return parts;
};
