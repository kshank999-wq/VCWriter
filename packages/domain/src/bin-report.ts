import { pageSize } from './document.js';
import { defaultExtractTitle } from './extracts.js';
import type { Extract, ExtractCategory, ExtractStatus } from './entities/extract.js';
import type { WpDocument } from './entities/document.js';
import type { ProjectFile } from './project-file.js';

/**
 * **The bin report** (addendum 42 §12, WP spec §7.2: *PDF … bin report*):
 * the extracts as a document to print or keep, one section per bin, in the
 * order the sidebar lists them.
 *
 * It is made from what the bins are showing, so a search or a status filter
 * is a report on that: *everything Ready*, or *every extract tagged harbour*.
 * The page is the document's own paper and margins, so the report prints
 * on the same stock as the writing it came from.
 */

const STATUS_WORDS: Record<ExtractStatus, string> = {
  unassigned: 'Unassigned',
  ready: 'Ready',
  exported: 'Exported',
  failed: 'Failed',
};

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Only a colour the report can put in a style attribute untouched. */
const safeColour = (value: string): string => (/^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#8FA8C4');

const day = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

export const BIN_REPORT_CSS = `
.bin-report { font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.25; color: #000; }
.bin-report h1 { font-size: 20pt; margin: 0 0 2pt; }
.bin-report .sub { color: #555; margin: 0 0 12pt; }
.bin-report table.summary { border-collapse: collapse; margin: 0 0 16pt; min-width: 60%; }
.bin-report table.summary th, .bin-report table.summary td { border-bottom: 1px solid #bbb; padding: 3pt 8pt 3pt 0; text-align: left; }
.bin-report table.summary .n { text-align: right; }
.bin-report h2 { font-size: 13pt; margin: 16pt 0 6pt; padding-bottom: 3pt; border-bottom: 2px solid var(--bin); break-after: avoid; page-break-after: avoid; }
.bin-report h2 .swatch { display: inline-block; width: 9pt; height: 9pt; border-radius: 2pt; background: var(--bin); margin-right: 6pt; }
.bin-report h2 .palette { font-weight: 400; color: #666; font-size: 10pt; margin-left: 6pt; }
.bin-report .extract { margin: 0 0 10pt; break-inside: avoid; page-break-inside: avoid; }
.bin-report .extract h3 { font-size: 11pt; margin: 0 0 2pt; }
.bin-report .extract .words { margin: 0 0 3pt; padding-left: 8pt; border-left: 3px solid var(--bin); white-space: pre-wrap; }
.bin-report .extract .meta { color: #555; font-size: 9pt; }
`;

export interface BinReportOptions {
  /** The extracts to report, in the order the bins list them. Left out, every extract. */
  extractIds?: readonly string[];
  /** What narrowed the list, said under the title: *Ready only*, *matching "harbour"*. */
  filter?: string;
}

interface Section {
  category: ExtractCategory | null;
  extracts: Extract[];
}

/** The report's body: title, a count by bin, then each bin and what is in it. */
export const binReportBody = (file: ProjectFile, document: WpDocument, options: BinReportOptions = {}): string => {
  const byId = new Map(file.extracts.map((extract) => [extract.id as string, extract]));
  const chosen = options.extractIds
    ? options.extractIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
    : file.extracts;

  // Bins in the order their first extract is listed, which is the sidebar's.
  const sections: Section[] = [];
  const index = new Map<string, Section>();
  for (const extract of chosen) {
    let section = index.get(extract.categoryId);
    if (!section) {
      section = { category: file.extractCategories.find((one) => one.id === extract.categoryId) ?? null, extracts: [] };
      index.set(extract.categoryId, section);
      sections.push(section);
    }
    section.extracts.push(extract);
  }

  const paletteName = (category: ExtractCategory | null): string =>
    file.extractPalettes.find((palette) => palette.id === category?.paletteId)?.name ?? '';
  const title = document.title || file.project.title || 'Untitled';
  const count = chosen.length;
  const sub = [
    file.project.title && file.project.title !== title ? escape(file.project.title) : null,
    `${count} ${count === 1 ? 'extract' : 'extracts'} in ${sections.length} ${sections.length === 1 ? 'bin' : 'bins'}`,
    options.filter ? escape(options.filter) : null,
    day(new Date().toISOString()),
  ]
    .filter(Boolean)
    .join(' · ');

  const summary =
    sections.length > 1
      ? '<table class="summary"><thead><tr><th>Bin</th><th class="n">Extracts</th><th class="n">Ready</th><th class="n">Exported</th></tr></thead><tbody>' +
        sections
          .map(
            (section) =>
              `<tr><td>${escape(section.category?.label ?? 'No bin')}</td>` +
              `<td class="n">${section.extracts.length}</td>` +
              `<td class="n">${section.extracts.filter((one) => one.status === 'ready').length}</td>` +
              `<td class="n">${section.extracts.filter((one) => one.status === 'exported').length}</td></tr>`,
          )
          .join('') +
        '</tbody></table>'
      : '';

  const bins = sections
    .map((section) => {
      const colour = safeColour(section.category?.color ?? '');
      const palette = paletteName(section.category);
      const items = section.extracts
        .map((extract) => {
          const meta = [
            STATUS_WORDS[extract.status],
            extract.tags.length ? `Tags: ${extract.tags.map(escape).join(', ')}` : null,
            ...extract.sentTo.map((receipt) => `Sent to ${escape(receipt.projectTitle || 'a project')} › ${escape(receipt.areaName)}`),
            `Captured ${day(extract.createdAt)}`,
          ]
            .filter(Boolean)
            .join(' · ');
          // A title the writer gave it; the first words it was given by default would only repeat the text below.
          const named = extract.title.trim() && extract.title !== defaultExtractTitle(extract.textPlain);
          const heading = named ? `<h3>${escape(extract.title)}</h3>` : '';
          return `<div class="extract">${heading}<p class="words">${escape(extract.textPlain)}</p><p class="meta">${meta}</p></div>`;
        })
        .join('');
      return (
        `<section style="--bin: ${colour}"><h2><span class="swatch"></span>${escape(section.category?.label ?? 'No bin')}` +
        `${palette ? `<span class="palette">${escape(palette)}</span>` : ''}</h2>${items}</section>`
      );
    })
    .join('');

  return (
    `<div class="bin-report"><h1>${escape(title)}: extracts</h1><p class="sub">${sub}</p>` +
    (count === 0 ? '<p>No extracts to report.</p>' : summary + bins) +
    '</div>'
  );
};

/** The whole page, on the document's paper and margins, ready for the printer or a PDF. */
export const binReportHtml = (file: ProjectFile, document: WpDocument, options: BinReportOptions = {}): string => {
  const { width, height } = pageSize(document.pageSetup);
  const m = document.pageSetup.margins;
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<title>${escape(document.title || file.project.title || 'Untitled')}: extracts</title>` +
    '<style>' +
    `@page { size: ${width}in ${height}in; margin: ${m.top}in ${m.right}in ${m.bottom}in ${m.left}in; }` +
    'html, body { margin: 0; padding: 0; background: #fff; }' +
    '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
    BIN_REPORT_CSS +
    '</style></head>' +
    `<body>${binReportBody(file, document, options)}</body></html>`
  );
};
