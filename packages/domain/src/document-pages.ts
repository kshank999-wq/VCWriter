import { nowIso } from './entities/common.js';
import {
  documentHeaderFooterSchema,
  type DocumentBand,
  type DocumentHeaderFooter,
  type WpDocument,
} from './entities/document.js';
import type { ProjectFile } from './project-file.js';
import type { WpDocumentId } from './ids.js';

/**
 * **Headers, footers and page numbers** (addendum 42 §15).
 *
 * A header and a footer are each three slots, left, centre and right, as in
 * Word's default header. A slot is text that may hold fields:
 *
 * - `{page}` — this page's number
 * - `{pages}` — how many pages there are
 * - `{title}` — the document's title
 * - `{date}` — the day it is printed
 *
 * On paper they are the page's own margin boxes (`@page { @top-left … }`),
 * so the browser that sets the pages also numbers them: the number on a page
 * is the page it is on, whatever reflowed. In Word they are real headers and
 * footers with PAGE and NUMPAGES fields, so they keep counting as the writer
 * edits there.
 */

export const HEADER_FOOTER_FIELDS = [
  { token: '{page}', name: 'Page number' },
  { token: '{pages}', name: 'Number of pages' },
  { token: '{title}', name: 'Title' },
  { token: '{date}', name: 'Date' },
] as const;

export type BandSlot = keyof DocumentBand;
export const BAND_SLOTS: readonly BandSlot[] = ['left', 'center', 'right'];

const withDocument = (file: ProjectFile, id: WpDocumentId, change: (document: WpDocument) => WpDocument): ProjectFile => ({
  ...file,
  documents: file.documents.map((document) => (document.id === id ? change(document) : document)),
});

export const setHeaderFooter = (
  file: ProjectFile,
  id: WpDocumentId,
  patch: { header?: Partial<DocumentBand>; footer?: Partial<DocumentBand>; firstPage?: boolean },
): ProjectFile =>
  withDocument(file, id, (document) => ({
    ...document,
    headerFooter: documentHeaderFooterSchema.parse({
      header: { ...document.headerFooter.header, ...patch.header },
      footer: { ...document.headerFooter.footer, ...patch.footer },
      firstPage: patch.firstPage ?? document.headerFooter.firstPage,
    }),
    updatedAt: nowIso(),
  }));

/** Word's Page Number gallery, the common ones: where the number goes and how it reads. */
export const PAGE_NUMBER_PRESETS = [
  { id: 'bottom-center', name: 'Bottom of page, centre: 1', band: 'footer', slot: 'center', text: '{page}' },
  { id: 'bottom-right', name: 'Bottom of page, right: 1', band: 'footer', slot: 'right', text: '{page}' },
  { id: 'bottom-right-of', name: 'Bottom of page, right: Page 1 of 3', band: 'footer', slot: 'right', text: 'Page {page} of {pages}' },
  { id: 'top-right', name: 'Top of page, right: 1', band: 'header', slot: 'right', text: '{page}' },
  { id: 'top-center', name: 'Top of page, centre: 1', band: 'header', slot: 'center', text: '{page}' },
] as const;
export type PageNumberPreset = (typeof PAGE_NUMBER_PRESETS)[number]['id'];

const hasPage = (text: string): boolean => /\{pages?\}/.test(text);

/**
 * Put page numbers in, or take them out. Putting them in clears any other
 * slot that was numbering pages, so the numbers move rather than double up;
 * taking them out empties only the slots that number pages and leaves a
 * running title where it is.
 */
export const setPageNumbers = (file: ProjectFile, id: WpDocumentId, preset: PageNumberPreset | 'none'): ProjectFile =>
  withDocument(file, id, (document) => {
    const strip = (band: DocumentBand): DocumentBand => ({
      left: hasPage(band.left) ? '' : band.left,
      center: hasPage(band.center) ? '' : band.center,
      right: hasPage(band.right) ? '' : band.right,
    });
    const next: DocumentHeaderFooter = {
      ...document.headerFooter,
      header: strip(document.headerFooter.header),
      footer: strip(document.headerFooter.footer),
    };
    const chosen = PAGE_NUMBER_PRESETS.find((one) => one.id === preset);
    if (chosen) next[chosen.band] = { ...next[chosen.band], [chosen.slot]: chosen.text };
    return { ...document, headerFooter: next, updatedAt: nowIso() };
  });

/** Which preset the document's numbering matches, if any: what the menu shows as chosen. */
export const pageNumberPresetOf = (document: WpDocument): PageNumberPreset | 'none' | 'custom' => {
  const { header, footer } = document.headerFooter;
  const numbered = [...BAND_SLOTS.map((slot) => ({ band: 'header' as const, slot, text: header[slot] })), ...BAND_SLOTS.map((slot) => ({ band: 'footer' as const, slot, text: footer[slot] }))].filter((one) => hasPage(one.text));
  if (numbered.length === 0) return 'none';
  if (numbered.length > 1) return 'custom';
  const [only] = numbered;
  return PAGE_NUMBER_PRESETS.find((one) => one.band === only!.band && one.slot === only!.slot && one.text === only!.text)?.id ?? 'custom';
};

export const hasHeaderFooter = (document: WpDocument): boolean =>
  BAND_SLOTS.some((slot) => document.headerFooter.header[slot].trim() || document.headerFooter.footer[slot].trim());

export interface FieldValues {
  page: number;
  pages: number;
  title: string;
  date: string;
}

/** A slot's text with its fields filled in, for the screen. */
export const fillFields = (text: string, values: FieldValues): string =>
  text
    .replace(/\{page\}/g, String(values.page))
    .replace(/\{pages\}/g, String(values.pages))
    .replace(/\{title\}/g, values.title)
    .replace(/\{date\}/g, values.date);

/** The day, as a header prints it: 22 October 2026 reads the same in every country. */
export const printedDate = (at: Date = new Date()): string =>
  at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const cssString = (value: string): string => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ')}"`;

/** A slot as a CSS `content` value: its text quoted, its page fields as counters. */
export const slotContent = (text: string, values: { title: string; date: string }): string => {
  const parts: string[] = [];
  for (const piece of text.split(/(\{page\}|\{pages\})/)) {
    if (piece === '{page}') parts.push('counter(page)');
    else if (piece === '{pages}') parts.push('counter(pages)');
    else if (piece) parts.push(cssString(piece.replace(/\{title\}/g, values.title).replace(/\{date\}/g, values.date)));
  }
  return parts.length ? parts.join(' ') : 'none';
};

const BOX: Record<'header' | 'footer', Record<BandSlot, string>> = {
  header: { left: 'top-left', center: 'top-center', right: 'top-right' },
  footer: { left: 'bottom-left', center: 'bottom-center', right: 'bottom-right' },
};

/**
 * The header and footer as the page's margin boxes. Nothing at all where the
 * document has neither, so an ordinary page prints exactly as it did.
 */
export const headerFooterCss = (document: WpDocument, values: { title: string; date: string }): string => {
  if (!hasHeaderFooter(document)) return '';
  const boxes = (['header', 'footer'] as const).flatMap((band) =>
    BAND_SLOTS.flatMap((slot) => {
      const text = document.headerFooter[band][slot];
      if (!text.trim()) return [];
      const align = slot === 'left' ? 'left' : slot === 'right' ? 'right' : 'center';
      return [
        `@${BOX[band][slot]} { content: ${slotContent(text, values)}; font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 10pt; color: #404040; text-align: ${align}; vertical-align: middle; }`,
      ];
    }),
  );
  const first = document.headerFooter.firstPage
    ? ''
    : `@page :first { ${(['header', 'footer'] as const).flatMap((band) => BAND_SLOTS.map((slot) => `@${BOX[band][slot]} { content: none; }`)).join(' ')} }`;
  return `@page { ${boxes.join(' ')} } ${first}`;
};
