import { avSheet, formatRt, type AvRow, type AvSegment } from './av-sheet.js';
import { renderTitleSheet, TITLE_PAGE_STYLES, type PrintOptions } from './print-html.js';
import { titlePageOf } from './entities/title-page.js';
import type { ProjectFile } from './project-file.js';

/**
 * Printing a board (addendum 05 §8, stage 8).
 *
 * Two documents come out of a short-form project, and they are handed to
 * different people:
 *
 * - **The sheet**, which is what is on screen — audio, visual, frame and
 *   duration, in rows, under a masthead, with each segment closing on its own
 *   figures. This is the document the client signs off and the producer
 *   budgets from.
 * - **The board**, which is the frames: the pictures in order, each captioned
 *   with its shot number, its time and its line. This is what goes on a wall.
 *
 * **Chromium paginates these, not us.** A screenplay is hand-paginated
 * because it is fixed-pitch and a page holds exactly fifty-five lines, and
 * where `(MORE)` falls is part of the craft. A sheet is a table of rows whose
 * heights depend on pictures and on how much somebody wrote — nothing about
 * it is countable in advance, and pretending otherwise would produce a
 * preview that disagreed with the print. So the rows say `break-inside:
 * avoid`, the column heads repeat with `table-header-group`, and the browser
 * does what browsers are good at.
 *
 * The title page is the script's own, because it is the same piece of work.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Plain lines, one under another: what an AV column is made of. */
const lines = (text: string): string =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

/**
 * What goes in the Image column.
 *
 * A picture prints as the picture. **A clip cannot** — there is no frame to
 * pull out of it without decoding video, and a board that printed a black
 * rectangle where the footage goes would be lying about what is there. So it
 * prints as what it is: a plate saying it is a clip, and how long it runs.
 */
const renderPlate = (row: AvRow): string => {
  if (!row.frame) return '<div class="sheet-plate empty"></div>';
  if (row.moving) {
    return (
      '<div class="sheet-plate clip">' +
      `<span class="sheet-clip-name">${escapeHtml(row.frame.name || 'Clip')}</span>` +
      `<span class="sheet-clip-rt">${formatRt(row.video)}</span>` +
      '</div>'
    );
  }
  return `<img class="sheet-frame" src="${escapeHtml(row.frame.data)}" alt="" />`;
};

/** One of a shot's times, named, so the column reads as the four it is. */
const time = (name: string, value: string, estimated = false): string =>
  `<div class="sheet-time${estimated ? ' estimated' : ''}">` +
  `<span class="sheet-time-name">${name}</span><span>${value}</span></div>`;

const renderRow = (row: AvRow): string =>
  '<tr class="sheet-row">' +
  `<td class="sheet-no">${escapeHtml(row.number)}</td>` +
  `<td class="sheet-audio">${lines(row.audio) || '<p class="sheet-none">—</p>'}</td>` +
  `<td class="sheet-visual">${lines(row.visual) || '<p class="sheet-none">—</p>'}</td>` +
  `<td class="sheet-image">${renderPlate(row)}</td>` +
  '<td class="sheet-duration">' +
  time('Header', formatRt(row.head)) +
  time('Dialogue', formatRt(row.dialogue), row.estimated) +
  time('Tail', formatRt(row.tail)) +
  time('Video', row.video > 0 ? formatRt(row.video) : '—') +
  '</td>' +
  '<td class="sheet-words">' +
  '<div class="sheet-time"></div>' +
  `<div class="sheet-time">${row.words} ${row.words === 1 ? 'word' : 'words'}</div>` +
  '<div class="sheet-time"></div>' +
  `<div class="sheet-time">${row.video > row.head + row.dialogue + row.tail ? 'holds' : ''}</div>` +
  '</td>' +
  '</tr>';

const renderSegment = (segment: AvSegment): string =>
  '<section class="sheet-segment">' +
  '<header class="sheet-segment-head">' +
  `<h2>Segment ${segment.position}${segment.name ? ` — ${escapeHtml(segment.name)}` : ''}</h2>` +
  (segment.line ? `<p class="sheet-segment-line">${escapeHtml(segment.line)}</p>` : '') +
  '</header>' +
  '<table class="sheet-table">' +
  '<thead><tr>' +
  '<th class="sheet-no">Shot</th><th>Audio</th><th>Visual</th>' +
  '<th class="sheet-image">Image</th><th class="sheet-duration">Duration</th>' +
  '<th class="sheet-words">Words +/&#8722;</th>' +
  '</tr></thead>' +
  `<tbody>${segment.rows.map(renderRow).join('')}</tbody>` +
  '</table>' +
  '<footer class="sheet-segment-foot">' +
  `<div class="sheet-foot-name"><span>End of segment ${segment.position}</span>` +
  `<strong>${escapeHtml(segment.name || `Segment ${segment.position}`)}</strong></div>` +
  '<dl class="sheet-figures">' +
  figure('Segment RT', formatRt(segment.seconds)) +
  figure('Segment words', String(segment.words)) +
  figure('Total RT', formatRt(segment.totalSeconds)) +
  figure('Total words', String(segment.totalWords)) +
  '</dl>' +
  '</footer>' +
  '</section>';

const figure = (label: string, value: string): string =>
  `<div class="sheet-figure"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;

const SHEET_STYLES = `
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f2f2f4;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.4;
    color: #000;
  }
  /* The title page keeps the script's geometry and its typewriter face: it
     is the same front page, on the same piece of work. */
  .page {
    position: relative;
    width: 8.5in;
    min-height: 11in;
    padding: 1in 1in 1in 1.5in;
    margin: 0 auto 24px;
    background: #fff;
    font-family: "Courier New", Courier, monospace;
    font-size: 12pt;
    line-height: 1;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
  ${TITLE_PAGE_STYLES}
  .sheet-doc {
    width: 8.5in;
    padding: 0.2in 0.4in 0.6in;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
  .sheet-masthead { border-bottom: 2px solid #000; padding-bottom: 8pt; margin-bottom: 14pt; }
  .sheet-masthead h1 {
    font-size: 22pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }
  .sheet-version {
    display: inline-block;
    border: 1px solid #000;
    border-radius: 2pt;
    padding: 0 4pt;
    margin-right: 8pt;
    font-size: 9pt;
    vertical-align: middle;
  }
  .sheet-totals { margin: 4pt 0 0; font-size: 10pt; }
  .sheet-over { color: #a00; font-weight: bold; }
  .sheet-segment { margin-bottom: 18pt; }
  .sheet-segment-head { text-align: center; margin: 12pt 0 6pt; }
  .sheet-segment-head h2 {
    font-size: 12pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0;
  }
  .sheet-segment-line { margin: 2pt 0 0; font-style: italic; font-size: 9.5pt; }
  .sheet-table { width: 100%; border-collapse: collapse; }
  .sheet-table th {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    text-align: left;
    padding: 0 6pt 4pt;
    border-bottom: 1.5pt solid #000;
  }
  /* The heads print again at the top of every page the segment runs onto:
     a column of times with no heading over it is a column of numbers. */
  .sheet-table thead { display: table-header-group; }
  .sheet-table td {
    vertical-align: top;
    padding: 8pt 6pt;
    border-bottom: 0.5pt solid #999;
  }
  /* A shot is not split across two sheets. It is one thing. */
  .sheet-row { break-inside: avoid; page-break-inside: avoid; }
  .sheet-no { width: 46pt; font-size: 13pt; font-weight: bold; }
  th.sheet-no { font-size: 7.5pt; font-weight: normal; }
  .sheet-audio, .sheet-visual { width: 22%; }
  .sheet-audio p, .sheet-visual p { margin: 0 0 5pt; }
  .sheet-none { color: #888; }
  .sheet-image { width: 150pt; }
  .sheet-frame { display: block; width: 100%; height: auto; border: 0.5pt solid #999; }
  .sheet-plate {
    width: 100%;
    height: 84pt;
    border: 0.75pt dashed #999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3pt;
    font-size: 8pt;
    color: #666;
  }
  .sheet-plate.clip { border-style: solid; }
  .sheet-clip-name { font-weight: bold; color: #000; }
  .sheet-duration, .sheet-words { width: 78pt; text-align: right; white-space: nowrap; }
  .sheet-time {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 5pt;
    height: 15pt;
    font-size: 9pt;
  }
  .sheet-time-name { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.1em; color: #666; }
  /* The one figure the words themselves decide, drawn as the guess it is. */
  .sheet-time.estimated { font-style: italic; color: #555; }
  .sheet-segment-foot {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16pt;
    border-top: 1.5pt solid #000;
    padding-top: 6pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sheet-foot-name span {
    display: block;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #666;
  }
  .sheet-figures { display: flex; gap: 16pt; margin: 0; }
  .sheet-figure dt {
    font-size: 6.5pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #666;
  }
  .sheet-figure dd { margin: 0; font-size: 10pt; font-weight: bold; }
  /* The board: the frames in order, captioned, several to a page. */
  .board-doc {
    width: 8.5in;
    padding: 0.3in 0.4in 0.6in;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
  .board-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14pt; }
  .board-panel { break-inside: avoid; page-break-inside: avoid; }
  /* Every panel's picture the same shape and the same height, so the
     captions run in a straight line across the wall. A drawing that is not
     16:9 sits inside its box rather than stretching to fill it. */
  .board-panel .sheet-frame, .board-panel .sheet-plate {
    margin-bottom: 4pt;
    width: 100%;
    height: 96pt;
    object-fit: contain;
    background: #f4f4f4;
  }
  .board-caption {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 6pt;
    border-bottom: 0.75pt solid #000;
    padding-bottom: 2pt;
  }
  .board-shot { font-weight: bold; font-size: 10pt; }
  .board-rt { font-size: 9pt; }
  .board-said { margin: 4pt 0 0; font-size: 8.5pt; }
  .board-seen { margin: 3pt 0 0; font-size: 8pt; font-style: italic; color: #555; }
  .board-seen p, .board-said p { margin: 0 0 3pt; }
  .board-segment {
    grid-column: 1 / -1;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    border-bottom: 1.5pt solid #000;
    padding-bottom: 3pt;
    margin-top: 6pt;
    break-after: avoid;
    page-break-after: avoid;
  }
  .sheet-printed { margin-top: 12pt; font-size: 7.5pt; color: #666; }
  @media print {
    body { background: #fff; }
    .page { min-height: 0; height: 11in; margin: 0; box-shadow: none; break-after: page; overflow: hidden; }
    .sheet-doc, .board-doc { width: auto; padding: 0; margin: 0; box-shadow: none; }
  }
`;

/** What the masthead says, printed exactly as the sheet says it on screen. */
const renderMasthead = (file: ProjectFile): string => {
  const sheet = avSheet(file);
  const slot =
    sheet.limit > 0
      ? ` &#183; Time constraint: ${formatRt(sheet.limit)}${
          sheet.over ? ` &#183; over by ${formatRt(sheet.seconds - sheet.limit)}` : ''
        }`
      : '';
  return (
    '<header class="sheet-masthead">' +
    `<h1><span class="sheet-version">${escapeHtml(sheet.version)}</span>${escapeHtml(sheet.title)}</h1>` +
    `<p class="sheet-totals">Total RT <strong class="${sheet.over ? 'sheet-over' : ''}">` +
    `${formatRt(sheet.seconds)}</strong> &#183; Total Words: ${sheet.words}${slot}</p>` +
    '</header>'
  );
};

const document = (title: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${SHEET_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;

const front = (file: ProjectFile, options: PrintOptions): string =>
  options.includeTitlePage === false ? '' : renderTitleSheet(titlePageOf(file.project, file.settings));

const printedAt = (options: PrintOptions): string =>
  options.includePrintedAt ? `<p class="sheet-printed">${escapeHtml(new Date().toLocaleString())}</p>` : '';

/**
 * The sheet, as a document to print or send (addendum 05 §8).
 *
 * What is on screen: the masthead, every segment with its rows, and each foot
 * with its four figures. Nothing is left out and nothing is added — a printed
 * board that disagreed with the one being written would be worse than none.
 */
export const renderSheetDocumentHtml = (file: ProjectFile, options: PrintOptions = {}): string => {
  const sheet = avSheet(file);
  const body =
    front(file, options) +
    '<article class="sheet-doc">' +
    renderMasthead(file) +
    (sheet.segments.length === 0
      ? '<p class="sheet-none">Nothing on the board yet.</p>'
      : sheet.segments.map(renderSegment).join('')) +
    printedAt(options) +
    '</article>';
  return document(sheet.title || 'Untitled', body);
};

/**
 * The board: the pictures in order, and what is said over each (§8).
 *
 * The thing that goes on a wall. Shots run three to a row, with a rule and
 * the segment's name where each segment begins, and every panel carries its
 * shot number, its time, its line and what is seen — because a frame on a
 * wall with nothing under it is a frame nobody can discuss.
 *
 * **A shot with no picture still gets a panel.** A board with a hole in it
 * should look like a board with a hole in it; that is the point of printing
 * it before the work is done.
 */
export const renderBoardDocumentHtml = (file: ProjectFile, options: PrintOptions = {}): string => {
  const sheet = avSheet(file);

  const panels = sheet.segments
    .map((segment) => {
      const head =
        `<h2 class="board-segment">Segment ${segment.position}` +
        `${segment.name ? ` — ${escapeHtml(segment.name)}` : ''} &#183; ${formatRt(segment.seconds)}</h2>`;
      const shots = segment.rows
        .map(
          (row) =>
            '<div class="board-panel">' +
            renderPlate(row) +
            '<div class="board-caption">' +
            `<span class="board-shot">${escapeHtml(row.number)}</span>` +
            `<span class="board-rt">${formatRt(row.seconds)}</span>` +
            '</div>' +
            `<div class="board-said">${lines(row.audio)}</div>` +
            `<div class="board-seen">${lines(row.visual)}</div>` +
            '</div>',
        )
        .join('');
      return head + shots;
    })
    .join('');

  const body =
    front(file, options) +
    '<article class="board-doc">' +
    renderMasthead(file) +
    (panels.length === 0 ? '<p class="sheet-none">Nothing on the board yet.</p>' : `<div class="board-grid">${panels}</div>`) +
    printedAt(options) +
    '</article>';
  return document(`${sheet.title || 'Untitled'} — board`, body);
};

const cleanName = (title: string): string =>
  (title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';

export const suggestedSheetFileName = (file: ProjectFile): string =>
  `${cleanName(avSheet(file).title)} sheet.pdf`;

export const suggestedBoardFileName = (file: ProjectFile): string =>
  `${cleanName(avSheet(file).title)} board.pdf`;
