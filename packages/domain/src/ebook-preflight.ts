import type { EbookPackage } from './ebook.js';
import type { EbookRules } from './ebook-presets.js';
import { crc32 } from './zip-write.js';

/**
 * Preflight (addendum 23 §6): what would stop the package at the store, what
 * the store would grumble about, and what was done on the way. Three
 * severities and one sentence each, with a pointer to the thing it is about
 * where there is one, so the screen can send the writer to it rather than
 * hand them a log.
 *
 * It runs on the built package, before anything is zipped, and asks the
 * questions a store's own checker asks first: is the package named, is the
 * cover there and big enough, does every link land, is any picture past the
 * limit, is the file too large. The one check it cannot make is EPUBCheck's
 * own, which is a Java program; the report says so rather than pretending.
 */

export type Severity = 'error' | 'warning' | 'info';

export interface PreflightFinding {
  severity: Severity;
  text: string;
  /** What it is about, for the screen to open. */
  about?: { kind: 'image' | 'section' | 'metadata'; id: string };
}

export interface Preflight {
  findings: PreflightFinding[];
  /** Any error at all: the export is refused until it is fixed. */
  blocking: boolean;
  errors: number;
  warnings: number;
}

const MB = 1024 * 1024;

export const megabytes = (bytes: number): string =>
  bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;

/** Every `href` and `src` inside the package's own files, resolved against the file it is in. */
const internalLinks = (pkg: EbookPackage): { from: string; target: string }[] => {
  const out: { from: string; target: string }[] = [];
  for (const entry of pkg.entries) {
    if (typeof entry.data !== 'string') continue;
    if (!/\.(xhtml|opf|ncx)$/.test(entry.path)) continue;
    const base = entry.path.split('/').slice(0, -1);
    const pattern = /(?:href|src|full-path)="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(entry.data)) !== null) {
      const raw = match[1] as string;
      if (/^(https?:|mailto:|#|urn:)/i.test(raw)) continue;
      const [path] = raw.split('#') as [string];
      if (path.length === 0) continue;
      const parts = entry.path === 'META-INF/container.xml' ? [] : [...base];
      for (const piece of path.split('/')) {
        if (piece === '..') parts.pop();
        else if (piece !== '.') parts.push(piece);
      }
      out.push({ from: entry.path, target: parts.join('/') });
    }
  }
  return out;
};

export const preflightEbook = (pkg: EbookPackage, rules: EbookRules = pkg.rules): Preflight => {
  const findings: PreflightFinding[] = [];
  const error = (text: string, about?: PreflightFinding['about']) => findings.push({ severity: 'error', text, ...(about ? { about } : {}) });
  const warning = (text: string, about?: PreflightFinding['about']) => findings.push({ severity: 'warning', text, ...(about ? { about } : {}) });
  const info = (text: string) => findings.push({ severity: 'info', text });
  const meta = pkg.metadata;

  // ---- the package must be named
  if (meta.title.trim().length === 0 || meta.title === 'Untitled') error('The book has no title.', { kind: 'metadata', id: 'title' });
  if (meta.authors.length === 0) warning('No author is named; stores ask for one.', { kind: 'metadata', id: 'author' });
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(meta.language)) {
    error(`"${meta.language}" is not a language code; use one like en-US or fr.`, { kind: 'metadata', id: 'language' });
  }
  if (rules.requiresIsbn && meta.identifier.scheme !== 'isbn') {
    error(`${rules.name} needs an eBook ISBN; none is given.`, { kind: 'metadata', id: 'isbn' });
  }
  if (meta.identifier.scheme === 'isbn' && ![10, 13].includes(meta.identifier.value.length)) {
    error(`The ISBN "${meta.identifier.value}" is not 10 or 13 digits.`, { kind: 'metadata', id: 'isbn' });
  }
  if (meta.published && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(meta.published)) {
    error(`The publication date "${meta.published}" is not YYYY-MM-DD.`, { kind: 'metadata', id: 'published' });
  }
  if (meta.description.length === 0) info('No description; stores take one on their own form.');

  // ---- the cover
  if (!pkg.cover) {
    if (rules.requiresEmbeddedCover) error(`${rules.name} needs the cover inside the book, and no cover is chosen.`, { kind: 'metadata', id: 'cover' });
    else warning('No cover is chosen; the store will ask for one on its form.', { kind: 'metadata', id: 'cover' });
  } else {
    const cover = pkg.cover;
    const short = Math.min(cover.width, cover.height);
    const long = Math.max(cover.width, cover.height);
    if (cover.width === 0 || cover.height === 0) {
      warning('The cover’s size is not known, so its pixels could not be checked.', { kind: 'image', id: cover.id });
    } else {
      if (rules.coverMinShortAxis !== null && short < rules.coverMinShortAxis) {
        error(`The cover is ${cover.width} × ${cover.height} px; ${rules.name} wants at least ${rules.coverMinShortAxis} px on its shorter side.`, { kind: 'image', id: cover.id });
      }
      if (rules.coverMinEachSide !== null && short < rules.coverMinEachSide) {
        error(`The cover is ${cover.width} × ${cover.height} px; ${rules.name} wants at least ${rules.coverMinEachSide} px on each side.`, { kind: 'image', id: cover.id });
      }
      if (rules.coverMaxLongAxis !== null && long > rules.coverMaxLongAxis) {
        error(`The cover is ${cover.width} × ${cover.height} px; ${rules.name} allows at most ${rules.coverMaxLongAxis} px on its longer side.`, { kind: 'image', id: cover.id });
      }
      if (cover.width > cover.height) warning('The cover is wider than it is tall; stores expect a portrait cover.', { kind: 'image', id: cover.id });
    }
    if (rules.coverMaxMB !== null && cover.data.length > rules.coverMaxMB * MB) {
      error(`The cover file is ${megabytes(cover.data.length)}; ${rules.name} allows ${rules.coverMaxMB} MB.`, { kind: 'image', id: cover.id });
    }
    if (rules.id === 'ingram' && cover.mediaType !== 'image/jpeg') warning('IngramSpark wants the cover as a JPEG; this one is not.', { kind: 'image', id: cover.id });
    if (rules.requiresSeparateCover) info(`The cover is written beside the book as ${cover.fileName}, for the store’s upload form.`);
  }

  // ---- the pictures inside
  for (const image of pkg.images) {
    if (rules.interiorPixelLimit !== null && image.width * image.height > rules.interiorPixelLimit) {
      error(`"${image.name}" is ${image.width} × ${image.height} px, past ${rules.name}'s ${(rules.interiorPixelLimit / 1_000_000).toFixed(1)} million pixels.`, { kind: 'image', id: image.id });
    }
    if (image.needsDescription) warning(`"${image.name}" has no description for a reader who cannot see it.`, { kind: 'image', id: image.id });
  }

  // ---- fixed layout (§10): the store's stance, and whether the book is one
  if (pkg.layout === 'fixed') {
    if (rules.fixedLayout === 'no') error(`${rules.name} does not take a fixed-layout EPUB; export it reflowable for this store.`, { kind: 'metadata', id: 'layout' });
    else if (rules.fixedLayout === 'limited') warning(`${rules.name} reaches fewer shelves with a fixed-layout EPUB than with a reflowable one.`, { kind: 'metadata', id: 'layout' });
    if (pkg.pages && pkg.pages.count > 0 && pkg.pages.pictured * 2 < pkg.pages.count) {
      warning(
        `Fixed layout on a book of text: ${pkg.pages.count - pkg.pages.pictured} of ${pkg.pages.count} pages carry no picture, and a reader cannot change the type size. Reflowable is what the stores expect of a novel.`,
        { kind: 'metadata', id: 'layout' },
      );
    }
  }

  // ---- the package
  if (pkg.sections.filter((section) => section.kind === 'chapter' || section.kind === 'body').length === 0) {
    error('There is nothing in the book: no chapter and no paragraph.');
  }
  const ids = pkg.entries.map((entry) => entry.id).filter((id): id is string => typeof id === 'string');
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) error(`Two files in the package share the id "${id}".`);
    seen.add(id);
  }
  const paths = new Set(pkg.entries.map((entry) => entry.path));
  for (const link of internalLinks(pkg)) {
    if (!paths.has(link.target)) error(`${link.from} points at ${link.target}, which is not in the package.`);
  }
  if (rules.maxFileMB !== null && pkg.size > rules.maxFileMB * MB) {
    error(`The book is about ${megabytes(pkg.size)} before compression; ${rules.name} allows ${rules.maxFileMB} MB.`);
  } else if (pkg.size > 50 * MB) {
    warning(`The book is about ${megabytes(pkg.size)}; a large file is slow to open and some stores charge by the megabyte.`);
  }

  // ---- what was done
  for (const line of pkg.log) info(line);
  info('EPUBCheck was not run here; run it on the file before uploading if the store insists.');
  if (rules.id === 'kindle') info('KDP recommends opening the EPUB in Kindle Previewer before uploading; the panel offers to where it is installed.');

  const errors = findings.filter((finding) => finding.severity === 'error').length;
  const warnings = findings.filter((finding) => finding.severity === 'warning').length;
  return { findings, blocking: errors > 0, errors, warnings };
};

/** The report written beside the book: preset, files, findings, log. */
export const ebookReport = (pkg: EbookPackage, preflight: Preflight, files: readonly { name: string; bytes: number }[]): string => {
  const lines: string[] = [];
  lines.push(`${pkg.metadata.title} — eBook export`, `Target: ${pkg.rules.name}`, `Made: ${pkg.metadata.modified}`, '');
  lines.push('Files:');
  for (const file of files) lines.push(`  ${file.name}  (${megabytes(file.bytes)})`);
  lines.push('', `Preflight: ${preflight.errors} ${preflight.errors === 1 ? 'error' : 'errors'}, ${preflight.warnings} ${preflight.warnings === 1 ? 'warning' : 'warnings'}`);
  for (const severity of ['error', 'warning', 'info'] as const) {
    const own = preflight.findings.filter((finding) => finding.severity === severity);
    if (own.length === 0) continue;
    lines.push('', severity === 'error' ? 'Errors:' : severity === 'warning' ? 'Warnings:' : 'Notes:');
    for (const finding of own) lines.push(`  - ${finding.text}`);
  }
  lines.push('', 'At the store:');
  for (const step of pkg.rules.checklist) lines.push(`  - ${step}`);
  return `${lines.join('\n')}\n`;
};

// -------------------------------------------------- after packaging

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/**
 * The preflight again, on the bytes (§6): Ken's spec asks for a check
 * *before* packaging and *again after*, and the second is about the archive
 * rather than the book — a store's checker refuses a package whose
 * `mimetype` is not the first entry, uncompressed and exact, before it
 * reads a word. So the central directory is read back: the first entry is
 * the mimetype, stored, with no extra field; every file the package meant
 * to write is there once; and each one's length and checksum are what was
 * handed to the writer. Nothing is inflated; this is a check on the
 * container, not a second read of the content.
 */
export const packagedCheck = (bytes: Uint8Array, pkg: EbookPackage): PreflightFinding[] => {
  const findings: PreflightFinding[] = [];
  const error = (text: string) => findings.push({ severity: 'error', text });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let eocd = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65535); at -= 1) {
    if (view.getUint32(at, true) === EOCD) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) {
    error('The written file is not a zip archive: its central directory could not be found.');
    return findings;
  }
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const seen = new Map<string, { method: number; crc: number; size: number; offset: number }>();
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL) {
      error('The central directory is damaged.');
      return findings;
    }
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (seen.has(name)) error(`"${name}" is in the archive twice.`);
    seen.set(name, { method, crc, size, offset });
    at += 46 + nameLength + extraLength + commentLength;
  }

  const first = seen.get('mimetype');
  const firstOffset = [...seen.values()].reduce((least, one) => Math.min(least, one.offset), Number.POSITIVE_INFINITY);
  if (!first) error('The archive has no mimetype entry.');
  else {
    if (first.offset !== 0 || firstOffset !== 0) error('The mimetype is not the first entry in the archive.');
    if (first.method !== 0) error('The mimetype is compressed; it must be stored.');
    if (view.getUint32(0, true) === LOCAL) {
      const extra = view.getUint16(28, true);
      if (extra !== 0) error('The mimetype entry carries an extra field, which a reader may refuse.');
      const text = decoder.decode(bytes.subarray(30 + 8, 30 + 8 + 20));
      if (text !== 'application/epub+zip') error(`The mimetype reads "${text}" rather than application/epub+zip.`);
    }
  }

  for (const entry of pkg.entries) {
    const written = seen.get(entry.path);
    if (!written) {
      error(`${entry.path} was not written into the archive.`);
      continue;
    }
    const data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    if (written.size !== data.length) error(`${entry.path} is ${written.size} bytes in the archive and ${data.length} in the package.`);
    else if (written.crc !== crc32(data)) error(`${entry.path}'s checksum in the archive is not the package's.`);
  }
  for (const name of seen.keys()) {
    if (!pkg.entries.some((entry) => entry.path === name)) error(`${name} is in the archive and not in the package.`);
  }

  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      text: `Checked after packaging: ${seen.size} files, the mimetype first and stored, every length and checksum as written (${megabytes(bytes.length)} on disk).`,
    });
  }
  return findings;
};

// ------------------------------------------------------------- the report

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The report written beside the book (§7, Ken's §17): preset, files and
 * their sizes, the findings by severity, what was done on the way, the
 * package's own parts, and what to do at the store. HTML because it is
 * read rather than parsed; `metadata.json` beside it is the machine's copy.
 */
export const ebookReportHtml = (
  pkg: EbookPackage,
  preflight: Preflight,
  files: readonly { name: string; bytes: number }[],
  packaged: readonly PreflightFinding[] = [],
): string => {
  const list = (items: readonly string[]) => (items.length === 0 ? '<p class="none">Nothing.</p>' : `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
  const by = (severity: Severity) => preflight.findings.filter((finding) => finding.severity === severity).map((finding) => finding.text);
  const parts = pkg.entries
    .filter((entry) => entry.id)
    .map((entry) => {
      const size = typeof entry.data === 'string' ? new TextEncoder().encode(entry.data).length : entry.data.length;
      return `<tr><td>${escapeHtml(entry.path.replace(/^OEBPS\//, ''))}</td><td>${escapeHtml(entry.mediaType)}</td><td class="n">${escapeHtml(megabytes(size))}</td></tr>`;
    })
    .join('');
  const pictures = pkg.images
    .map((image) => `<tr><td>${escapeHtml(image.name)}</td><td>${image.width > 0 ? `${image.width} × ${image.height} px` : 'size not known'}</td><td>${image.needsDescription ? 'needs a description' : image.described ? escapeHtml(image.alt) : 'decorative'}</td></tr>`)
    .join('');
  const summary = `${preflight.errors} ${preflight.errors === 1 ? 'error' : 'errors'}, ${preflight.warnings} ${preflight.warnings === 1 ? 'warning' : 'warnings'}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(pkg.metadata.title)} — eBook export report</title>
<style>
  body { font: 15px/1.5 Georgia, serif; max-width: 52em; margin: 2em auto; padding: 0 1em; color: #222; }
  h1 { font-size: 1.6em; } h2 { font-size: 1.15em; margin-top: 2em; border-bottom: 1px solid #ddd; padding-bottom: 0.2em; }
  table { border-collapse: collapse; width: 100%; font-size: 0.95em; } td, th { text-align: left; padding: 0.25em 0.6em 0.25em 0; vertical-align: top; } td.n { text-align: right; white-space: nowrap; }
  .errors li { color: #b3261e; } .warnings li { color: #8a6d00; } .none { color: #777; } dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.2em 1em; }
</style>
</head>
<body>
<h1>${escapeHtml(pkg.metadata.title)} — eBook export</h1>
<dl>
<dt>Target</dt><dd>${escapeHtml(pkg.rules.name)}</dd>
<dt>Layout</dt><dd>${pkg.layout === 'fixed' ? `Fixed: ${pkg.pages?.count ?? 0} pages as laid` : 'Reflowable EPUB 3.3'}</dd>
<dt>Made</dt><dd>${escapeHtml(pkg.metadata.modified)}</dd>
<dt>Identifier</dt><dd>${escapeHtml(pkg.metadata.identifier.urn)}</dd>
<dt>Preflight</dt><dd>${summary}${preflight.blocking ? ' — the errors were fixed before this file was written' : ''}</dd>
</dl>
<h2>Files</h2>
<table>${files.map((file) => `<tr><td>${escapeHtml(file.name)}</td><td class="n">${escapeHtml(megabytes(file.bytes))}</td></tr>`).join('')}</table>
<h2>Errors</h2><div class="errors">${list(by('error'))}</div>
<h2>Warnings</h2><div class="warnings">${list(by('warning'))}</div>
<h2>Done on the way</h2>${list(by('info'))}
<h2>After packaging</h2>${list(packaged.map((finding) => finding.text))}
<h2>Inside the package</h2>
<table><tr><th>File</th><th>Type</th><th class="n">Size</th></tr>${parts}</table>
${pkg.images.length > 0 ? `<h2>Pictures</h2><table><tr><th>Picture</th><th>Size</th><th>Description</th></tr>${pictures}</table>` : ''}
<h2>At ${escapeHtml(pkg.rules.name)}</h2>${list(pkg.rules.checklist)}
</body>
</html>
`;
};
