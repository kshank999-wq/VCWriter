import type { EbookPackage } from './ebook.js';
import type { EbookRules } from './ebook-presets.js';

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

const megabytes = (bytes: number): string =>
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
    if (!image.described) warning(`"${image.name}" has no description for a reader who cannot see it.`, { kind: 'image', id: image.id });
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
