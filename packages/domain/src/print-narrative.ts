import { renderTitleSheet, type PrintOptions } from './print-html.js';
import { titlePageOf } from './entities/title-page.js';
import { narrativeReports } from './narrative-reports.js';
import { describeGraph, narrativeMap } from './narrative-map.js';
import type { NarrativeReport } from './narrative-reports.js';
import type { ProjectFile } from './project-file.js';

/**
 * The design report, printed (addendum 18 stage 9 — §17's *human-readable
 * design report*).
 *
 * It is **§18's reports, one after another, and nothing else** — the same rows
 * the screen draws, because a printed report that computed its own numbers
 * would be a second answer a designer could take into a meeting and be wrong
 * with. There is nothing here but layout.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const STYLES = `
  @page { margin: 18mm 16mm; }
  body { font: 11pt/1.45 Georgia, 'Times New Roman', serif; color: #111; margin: 0; }
  .nr-masthead { border-bottom: 1px solid #111; padding-bottom: 6pt; margin-bottom: 14pt; }
  .nr-masthead h1 { font-size: 18pt; margin: 0 0 3pt; }
  .nr-masthead p { margin: 0; font-size: 9.5pt; color: #555; }
  section { break-inside: auto; margin-bottom: 16pt; }
  h2 { font-size: 13pt; margin: 0 0 2pt; }
  .nr-note { margin: 0 0 6pt; font-size: 9.5pt; color: #555; font-style: italic; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { border: 0.5pt solid #bbb; padding: 3pt 4pt; text-align: left; vertical-align: top; }
  thead th { background: #f2f2f2; font-weight: 600; }
  /* A heading with its table's first rows, never stranded at a page foot. */
  h2, .nr-note, thead { break-after: avoid; }
  tr { break-inside: avoid; }
  .nr-empty { font-size: 9.5pt; color: #555; }
  .nr-printed { margin-top: 14pt; font-size: 8.5pt; color: #777; }
`;

const renderReport = (report: NarrativeReport): string =>
  '<section>' +
  `<h2>${escapeHtml(report.title)}</h2>` +
  `<p class="nr-note">${escapeHtml(report.note)}</p>` +
  (report.rows.length === 0
    ? `<p class="nr-empty">${escapeHtml(report.emptyWord)}</p>`
    : '<table><thead><tr>' +
      report.columns.map((one) => `<th>${escapeHtml(one)}</th>`).join('') +
      '</tr></thead><tbody>' +
      report.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('') +
      '</tbody></table>') +
  '</section>';

export const renderNarrativeReportHtml = (file: ProjectFile, options: PrintOptions = {}): string => {
  const page = titlePageOf(file.project, file.settings);
  const title = page.title || file.project.title || 'Untitled';
  const said = describeGraph(file, narrativeMap(file));

  const body =
    (options.includeTitlePage === false ? '' : renderTitleSheet(page)) +
    '<article class="nr-doc">' +
    '<header class="nr-masthead">' +
    '<h1>Narrative design report</h1>' +
    `<p>${escapeHtml(title)} &#183; ${escapeHtml(said)}</p>` +
    '</header>' +
    narrativeReports(file).map(renderReport).join('') +
    (options.includePrintedAt ? `<p class="nr-printed">${escapeHtml(new Date().toLocaleString())}</p>` : '') +
    '</article>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — Narrative design report</title>
<style>${STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
};

const baseName = (file: ProjectFile): string =>
  (file.project.title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';

export const suggestedNarrativeFileName = (file: ProjectFile): string =>
  `${baseName(file)} narrative design.pdf`;
