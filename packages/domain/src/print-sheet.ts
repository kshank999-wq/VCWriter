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

const stylesFor = (page: string, margin: string): string => `
  @page { size: ${page}; margin: ${margin}; }
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
  /* ------------------------------------------------------- the board
     Addendum 05 §4c. Landscape, because a strip of shots reads across.
     Each panel is a caption, a frame, and two labelled boxes under it, and
     a timeline runs along the bottom of every strip.

     **The frames are all the same size and all on one line.** That is what
     makes a board a board: the eye runs along the pictures without being
     dragged up and down by how much somebody wrote. The boxes under them
     are only as tall as what is in them, so the distance from the frames
     down to the timeline is set by the fullest panel in the strip — and
     every other panel simply has space under it. */
  .board-doc {
    width: 11in;
    padding: 0.3in 0.5in 0.5in;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
  .board-strip-set { break-inside: avoid; page-break-inside: avoid; margin-bottom: 18pt; }
  /* One line of shots, on a fixed set of columns so **a strip with two shots
     in it draws them at the same size as a strip with four** — a last row
     stretched across the page would make its frames the odd ones out.
     Starting them all at the top is the rest of the design: every frame at
     the same height, whatever hangs below it. */
  .board-strip {
    display: grid;
    grid-template-columns: repeat(var(--shots), 1fr);
    align-items: start;
    gap: 12pt;
  }
  .board-panel { min-width: 0; }
  /* Uniform, always. A drawing that is not 16:9 sits inside its box rather
     than stretching to fill it, and the box stays the size it was. */
  .board-panel .sheet-frame, .board-panel .sheet-plate {
    width: 100%;
    height: 108pt;
    object-fit: contain;
    background: #f4f4f4;
    border: 0.75pt solid #999;
    margin: 0;
  }
  .board-panel .sheet-plate.empty { border-style: dashed; }
  /* The number and the time above the frame, where a board carries them. */
  .board-caption {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 6pt;
    border-bottom: 0.75pt solid #000;
    padding-bottom: 2pt;
    margin-bottom: 3pt;
  }
  .board-shot { font-weight: bold; font-size: 10pt; }
  .board-rt { font-size: 9pt; }
  /* Only as tall as what is in it. An empty one is not drawn at all. */
  .board-box {
    margin-top: 5pt;
    border: 0.5pt solid #999;
    padding: 3pt 4pt 4pt;
  }
  .board-box h3 {
    margin: 0 0 2pt;
    font-size: 6.5pt;
    font-weight: normal;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #666;
  }
  .board-box p { margin: 0 0 3pt; font-size: 8pt; line-height: 1.35; }
  .board-box p:last-child { margin-bottom: 0; }
  .board-action p { font-style: italic; color: #333; }
  /* The timeline along the bottom of the strip, on the same columns as the
     shots — so each span of it sits exactly under its own frame, and the
     rule runs only as far as the shots do. */
  .board-timeline {
    display: grid;
    grid-template-columns: repeat(var(--shots), 1fr);
    gap: 12pt;
    margin-top: 8pt;
  }
  .board-tick {
    min-width: 0;
    padding-top: 3pt;
    position: relative;
    border-top: 1pt solid #000;
    display: flex;
    justify-content: space-between;
    font-size: 7pt;
  }
  .board-tick::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 0.75pt;
    height: 4pt;
    background: #000;
  }
  /* The last shot's span carries where the strip lands as well, on its right
     edge, with a tick of its own. */
  .board-tick.last::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 0.75pt;
    height: 4pt;
    background: #000;
  }
  .board-end { color: #444; }
  .board-segment {
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    border-bottom: 1.5pt solid #000;
    padding-bottom: 3pt;
    margin: 12pt 0 8pt;
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

const document = (title: string, body: string, landscape = false): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${stylesFor(landscape ? 'letter landscape' : 'letter', landscape ? '0.5in' : '0.6in')}</style>
</head>
<body>
${body}
</body>
</html>`;

/** How many shots run across a strip. Four is a comfortable width in landscape. */
export const SHOTS_PER_STRIP = 4;

/** The list cut into strips of at most `size`, keeping the story order. */
const inStrips = <T,>(items: readonly T[], size: number): T[][] => {
  const strips: T[][] = [];
  for (let at = 0; at < items.length; at += size) strips.push(items.slice(at, at + size));
  return strips;
};

/**
 * One shot's panel: the number and the time **above** the frame, the frame
 * itself at the one size every frame is, and under it the two boxes.
 *
 * A box that has nothing in it is not drawn. An empty rule headed DIALOGUE is
 * a thing to be read and then discarded, which is worse than a gap.
 */
const renderPanel = (row: AvRow, at: number): string => {
  const box = (label: string, className: string, text: string): string => {
    const body = lines(text);
    return body.length === 0 ? '' : `<div class="board-box ${className}"><h3>${label}</h3>${body}</div>`;
  };
  return (
    '<div class="board-panel">' +
    '<div class="board-caption">' +
    `<span class="board-shot">${escapeHtml(row.number)}</span>` +
    `<span class="board-rt">${formatRt(at)}</span>` +
    '</div>' +
    renderPlate(row) +
    box('Dialogue', 'board-dialogue', row.audio) +
    box('Action', 'board-action', row.visual) +
    '</div>'
  );
};

/**
 * A strip of shots, and the timeline under it.
 *
 * The strip's height is its fullest panel's, because the frames are all one
 * size and all on one line — so **the distance from the frames down to the
 * timeline is set by the longest dialogue and action in the strip**, and the
 * shots with less under them simply carry space. The ticks are laid out on
 * the same shares as the panels, so each one falls under its own shot.
 */
const renderStrip = (rows: AvRow[], starts: number[], end: number): string => {
  const panels = rows.map((row, index) => renderPanel(row, starts[index] ?? 0)).join('');
  const ticks = starts
    .map((at, index) => {
      const last = index === starts.length - 1;
      return (
        `<div class="board-tick${last ? ' last' : ''}"><span>${formatRt(at)}</span>` +
        (last ? `<span class="board-end">${formatRt(end)}</span>` : '') +
        '</div>'
      );
    })
    .join('');
  // The columns are declared once, here, so the shots and the timeline under
  // them cannot end up on different ones.
  return (
    `<section class="board-strip-set" style="--shots:${SHOTS_PER_STRIP}">` +
    `<div class="board-strip">${panels}</div>` +
    `<div class="board-timeline">${ticks}</div>` +
    '</section>'
  );
};

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
 * The board: the pictures in order, with the clock under them (§4c).
 *
 * The thing that goes on a wall, and it is **landscape**, because a strip of
 * shots reads across rather than down. Each shot is its number and its time,
 * then the frame, then a box of dialogue and a box of action; each strip runs
 * four shots wide with a timeline along its bottom.
 *
 * **Every frame is the same size and every frame in a strip is on one line.**
 * That is what makes a board a board — the eye runs along the pictures
 * without being dragged up and down by how much somebody wrote. The boxes
 * below are only as tall as what is in them, so the distance from the frames
 * down to the timeline is whatever the fullest panel in the strip needs, and
 * the rest carry space.
 *
 * **A shot with no picture still gets a panel.** A board with a hole in it
 * should look like a board with a hole in it; that is the point of printing
 * it before the work is done.
 */
export const renderBoardDocumentHtml = (file: ProjectFile, options: PrintOptions = {}): string => {
  const sheet = avSheet(file);

  // The board's own clock, so a shot's time on the wall is the second it
  // starts at rather than how long it runs (§5).
  let at = 0;
  const starts = new Map<string, number>();
  for (const segment of sheet.segments) {
    for (const row of segment.rows) {
      starts.set(row.beatId as string, at);
      at += row.seconds;
    }
  }

  const body = sheet.segments
    .map((segment) => {
      const head =
        `<h2 class="board-segment">Segment ${segment.position}` +
        `${segment.name ? ` — ${escapeHtml(segment.name)}` : ''} &#183; ${formatRt(segment.seconds)}</h2>`;
      const strips = inStrips(segment.rows, SHOTS_PER_STRIP)
        .map((rows) => {
          const from = rows.map((row) => starts.get(row.beatId as string) ?? 0);
          const last = rows[rows.length - 1];
          const end = (starts.get((last?.beatId ?? '') as string) ?? 0) + (last?.seconds ?? 0);
          return renderStrip(rows, from, end);
        })
        .join('');
      return head + strips;
    })
    .join('');

  const article =
    front(file, options) +
    '<article class="board-doc">' +
    renderMasthead(file) +
    (body.length === 0 ? '<p class="sheet-none">Nothing on the board yet.</p>' : body) +
    printedAt(options) +
    '</article>';
  return document(`${sheet.title || 'Untitled'} — board`, article, true);
};

const cleanName = (title: string): string =>
  (title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';

export const suggestedSheetFileName = (file: ProjectFile): string =>
  `${cleanName(avSheet(file).title)} sheet.pdf`;

export const suggestedBoardFileName = (file: ProjectFile): string =>
  `${cleanName(avSheet(file).title)} board.pdf`;
