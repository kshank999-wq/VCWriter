import {
  COMMANDMENTS,
  COMMANDMENT_NAMES,
  GENRE_NAMES,
  actCommandments,
  storyGridRows,
  storyGridStatus,
  valueGraph,
  valueGraphLayout,
  valueGraphNote,
  type Commandments,
  type GridPromiseStatus,
  type GridRow,
} from './story-grid.js';
import { renderTitleSheet, TITLE_PAGE_STYLES, type PrintOptions } from './print-html.js';
import { titlePageOf } from './entities/title-page.js';
import type { ProjectFile } from './project-file.js';

/**
 * The Story Grid, printed (addendum 04 §8, stage 6).
 *
 * The tab as a document: what the story is and what that obliges it to
 * deliver, the five commandments at all three scales, the value graph, and
 * the grid itself. **Everything on the tab and nothing more** — a printing
 * that quietly left out the empty rows would be leaving out the finding,
 * because on this tab the gaps are the point (§5).
 *
 * **Landscape.** Twelve columns of a table read across a wide page or not at
 * all, and squeezing them upright would turn every cell into a column of
 * single words.
 *
 * It does not grade, here any more than on screen (§7). There is no score at
 * the foot, and the one sentence under the graph is the same observation the
 * tab makes.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** An answer, or a mark that says plainly there is not one. */
const said = (text: string): string =>
  text.trim().length > 0 ? escapeHtml(text) : '<span class="grid-empty">—</span>';

const commandmentCells = (commandments: Commandments): string =>
  COMMANDMENTS.map((which) => `<td>${said(commandments[which])}</td>`).join('');

const promiseRows = (entries: GridPromiseStatus[]): string =>
  entries
    .map(
      (entry) =>
        '<tr>' +
        `<td class="grid-kept">${entry.scene ? '&#9679;' : '&#9675;'}</td>` +
        `<td>${said(entry.promise.text)}</td>` +
        `<td>${entry.scene ? escapeHtml(entry.scene.label) : '<span class="grid-empty">not yet</span>'}</td>` +
        `<td>${said(entry.promise.note)}</td>` +
        '</tr>',
    )
    .join('');

/**
 * What the story is, and what it owes (§3).
 *
 * The lists print with their marks — a filled circle for a promise with a
 * scene against it, a hollow one for a promise still owed — because the ratio
 * of one to the other is the reason the panel exists.
 */
const renderGlobal = (file: ProjectFile): string => {
  const status = storyGridStatus(file);
  const { grid } = status;
  const obligatory = status.promises.filter((entry) => entry.promise.kind === 'obligatory');
  const conventions = status.promises.filter((entry) => entry.promise.kind === 'convention');

  const said_ = (label: string, value: string): string =>
    `<div class="grid-fact"><dt>${label}</dt><dd>${said(value)}</dd></div>`;

  const list = (title: string, kept: number, of: number, entries: GridPromiseStatus[]): string =>
    entries.length === 0
      ? ''
      : `<section class="grid-promises"><h3>${title} <span class="grid-of">${kept} of ${of}</span></h3>` +
        '<table class="grid-promise-table"><thead><tr>' +
        '<th class="grid-kept"></th><th>What is owed</th><th>The scene</th><th>Note</th>' +
        `</tr></thead><tbody>${promiseRows(entries)}</tbody></table></section>`;

  return (
    '<section class="grid-global">' +
    '<h2>What the story is</h2>' +
    '<dl class="grid-facts">' +
    said_('Genre', grid.genre === '' ? '' : GENRE_NAMES[grid.genre]) +
    said_('Sub-genre', grid.subGenre) +
    said_('Value', grid.value) +
    said_('Controlling idea', grid.controllingIdea) +
    '</dl>' +
    list('What it owes', status.keptObligatory, status.obligatory, obligatory) +
    list('What it carries', status.keptConventions, status.conventions, conventions) +
    '</section>'
  );
};

/** The five, at the two scales the writer answers for themselves (§4). */
const renderCommandments = (file: ProjectFile): string => {
  const status = storyGridStatus(file);
  const acts = actCommandments(file);
  const heads = COMMANDMENTS.map((which) => `<th>${COMMANDMENT_NAMES[which]}</th>`).join('');

  const actRows = acts
    .map(
      (act) =>
        `<tr><th scope="row">${escapeHtml(act.label)}</th>${commandmentCells(act.commandments)}</tr>`,
    )
    .join('');

  return (
    '<section class="grid-commandments">' +
    '<h2>The five commandments</h2>' +
    '<table class="grid-five"><thead><tr>' +
    `<th class="grid-scale">Scale</th>${heads}` +
    '</tr></thead><tbody>' +
    `<tr><th scope="row">The story</th>${commandmentCells(status.grid.story)}</tr>` +
    actRows +
    '</tbody></table>' +
    (acts.length === 0
      ? '<p class="grid-empty small">No act breaks are marked, so there is nothing between the story and its scenes.</p>'
      : '') +
    '</section>'
  );
};

/**
 * The value graph (§6), drawn from the same geometry the tab draws.
 *
 * Worked out once in `valueGraphLayout` and used twice, so the printing and
 * the screen cannot disagree about the shape of the story.
 */
const renderGraph = (rows: GridRow[]): string => {
  const graph = valueGraph(rows);
  if (graph.points.length < 2) return '';
  const layout = valueGraphLayout(graph);
  const note = valueGraphNote(graph);

  const acts = layout.acts
    .map(
      (act) =>
        `<g class="value-act"><line x1="${act.x}" y1="0" x2="${act.x}" y2="${layout.height}" />` +
        `<text x="${act.x + 4}" y="12">${escapeHtml(act.label)}</text></g>`,
    )
    .join('');

  const dots = layout.points
    .map(
      (spot) =>
        `<circle class="value-point${spot.point.said ? '' : ' unsaid'}" cx="${spot.x}" cy="${spot.y}" r="3.5" />`,
    )
    .join('');

  return (
    '<section class="grid-graph">' +
    '<h2>The value</h2>' +
    `<svg viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">` +
    `<line class="value-base" x1="0" y1="${layout.base}" x2="${layout.width}" y2="${layout.base}" />` +
    acts +
    `<path class="value-line" d="${layout.path}" />` +
    dots +
    '</svg>' +
    (note ? `<p class="grid-note">${escapeHtml(note)}</p>` : '') +
    '</section>'
  );
};

/** Which way a scene moves, drawn so a column of it reads at a glance (§5). */
const SHIFT: Record<GridRow['polarity'], string> = {
  '': '&#183;',
  up: '+',
  down: '&#8722;',
  mixed: '&#177;',
  flat: '=',
};

/** The grid itself (§5): one row per scene, in reading order. */
const renderRows = (rows: GridRow[]): string => {
  if (rows.length === 0) return '<p class="grid-empty">No scenes yet.</p>';

  const heads = COMMANDMENTS.map((which) => `<th>${COMMANDMENT_NAMES[which]}</th>`).join('');
  const body = rows
    .map((row) => {
      const where = [row.characters.join(', '), row.setting, row.time].filter((part) => part.length > 0).join(' &#183; ');
      return (
        '<tr>' +
        `<td class="grid-n">${row.position}</td>` +
        `<th scope="row">${escapeHtml(row.label)}${row.act ? `<span class="grid-act">${escapeHtml(row.act)}</span>` : ''}</th>` +
        `<td class="grid-n">${row.pages} ${row.pages === 1 ? 'p' : 'pp'}<span class="grid-act">${row.words} w</span></td>` +
        `<td>${said(row.event)}</td>` +
        `<td>${said(row.value)}</td>` +
        `<td class="grid-n">${SHIFT[row.polarity]}</td>` +
        commandmentCells(row.commandments) +
        `<td>${said(row.pov)}</td>` +
        `<td class="grid-where">${where.length > 0 ? where : '<span class="grid-empty">—</span>'}</td>` +
        '</tr>'
      );
    })
    .join('');

  return (
    '<section class="grid-scenes">' +
    '<h2>The grid</h2>' +
    '<table class="grid-rows"><thead><tr>' +
    '<th class="grid-n">#</th><th>Scene</th><th class="grid-n">Length</th>' +
    `<th>Story event</th><th>At stake</th><th class="grid-n">Shift</th>${heads}` +
    '<th>POV</th><th>Who, where, when</th>' +
    '</tr></thead>' +
    `<tbody>${body}</tbody></table></section>`
  );
};

const STYLES = `
  @page { size: letter landscape; margin: 0.5in; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f2f2f4;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 9pt;
    line-height: 1.35;
    color: #000;
  }
  /* The title page keeps the script's geometry and its typewriter face. */
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
  .grid-doc {
    width: 11in;
    padding: 0.3in 0.5in 0.5in;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
  .grid-masthead { border-bottom: 2pt solid #000; padding-bottom: 6pt; margin-bottom: 12pt; }
  .grid-masthead h1 {
    margin: 0;
    font-size: 18pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .grid-masthead p { margin: 3pt 0 0; font-size: 9pt; }
  h2 {
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    border-bottom: 1pt solid #000;
    padding-bottom: 3pt;
    margin: 16pt 0 6pt;
    break-after: avoid;
    page-break-after: avoid;
  }
  h3 {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 10pt 0 4pt;
    break-after: avoid;
    page-break-after: avoid;
  }
  .grid-of { color: #666; letter-spacing: 0; text-transform: none; }
  .grid-facts { display: flex; flex-wrap: wrap; gap: 16pt; margin: 0; }
  .grid-fact { min-width: 120pt; }
  .grid-fact dt {
    font-size: 6.5pt;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #666;
  }
  .grid-fact dd { margin: 1pt 0 0; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; }
  /* The heads print again on every page a long table runs onto: a column of
     answers with no heading over it is a column of sentences. */
  thead { display: table-header-group; }
  th {
    font-size: 6.5pt;
    font-weight: normal;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-align: left;
    color: #666;
    border-bottom: 1pt solid #000;
    padding: 0 4pt 3pt;
  }
  td, tbody th {
    vertical-align: top;
    text-align: left;
    font-weight: normal;
    padding: 4pt;
    border-bottom: 0.4pt solid #bbb;
  }
  /* A scene is not split across two sheets. */
  tbody tr { break-inside: avoid; page-break-inside: avoid; }
  /*
    A row's own label is not a column head, and must stop inheriting one: the
    head rule above sets 6.5pt uppercase grey, which is right over a column
    and quite wrong on the name of a scene.
  */
  tbody th {
    font-size: 8.5pt;
    font-weight: bold;
    text-transform: none;
    letter-spacing: 0;
    color: #000;
  }
  /* Except the scale column, where ACT I is a label and reads as one. */
  .grid-five tbody th {
    font-size: 7pt;
    font-weight: normal;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #444;
  }
  .grid-n { width: 30pt; text-align: right; }
  th.grid-n { text-align: right; }
  .grid-kept { width: 14pt; text-align: center; }
  .grid-scale { width: 70pt; }
  .grid-where { width: 90pt; color: #444; }
  .grid-act { display: block; font-size: 6.5pt; color: #666; font-weight: normal; }
  /* An empty cell is the finding (§5), so it is drawn rather than left blank. */
  .grid-empty { color: #aaa; }
  .grid-five tbody th { width: 70pt; }
  /* The two text columns carry sentences and must not be squeezed to one
     word a line to make room for the narrow ones. */
  .grid-rows th:nth-child(4), .grid-rows th:nth-child(5) { width: 90pt; }
  .grid-graph svg { display: block; margin: 4pt 0; overflow: visible; }
  .value-base { stroke: #999; stroke-width: 0.75; stroke-dasharray: 3 3; }
  .value-line { fill: none; stroke: #000; stroke-width: 1.25; stroke-linejoin: round; }
  .value-point { fill: #000; stroke: #fff; stroke-width: 1; }
  /* A scene nobody has answered holds the line without claiming it stayed
     still, and is drawn hollow so the difference survives printing. */
  .value-point.unsaid { fill: #fff; stroke: #000; stroke-width: 0.75; }
  .value-act line { stroke: #ccc; stroke-width: 0.5; }
  .value-act text { fill: #666; font-size: 6pt; letter-spacing: 0.1em; }
  .grid-note { margin: 2pt 0 0; font-size: 8pt; color: #333; }
  .grid-printed { margin-top: 12pt; font-size: 7pt; color: #666; }
  .small { font-size: 8pt; }
  @media print {
    body { background: #fff; }
    .page { min-height: 0; height: 11in; margin: 0; box-shadow: none; break-after: page; overflow: hidden; }
    .grid-doc { width: auto; padding: 0; margin: 0; box-shadow: none; }
  }
`;

export const renderGridDocumentHtml = (file: ProjectFile, options: PrintOptions = {}): string => {
  const rows = storyGridRows(file);
  const page = titlePageOf(file.project, file.settings);
  const title = page.title || file.project.title || 'Untitled';

  const body =
    (options.includeTitlePage === false ? '' : renderTitleSheet(page)) +
    '<article class="grid-doc">' +
    '<header class="grid-masthead">' +
    `<h1>${escapeHtml(title)}</h1>` +
    `<p>Story Grid &#183; ${rows.length} ${rows.length === 1 ? 'scene' : 'scenes'}</p>` +
    '</header>' +
    renderGlobal(file) +
    renderCommandments(file) +
    renderGraph(rows) +
    renderRows(rows) +
    (options.includePrintedAt ? `<p class="grid-printed">${escapeHtml(new Date().toLocaleString())}</p>` : '') +
    '</article>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — Story Grid</title>
<style>${STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
};

export const suggestedGridFileName = (file: ProjectFile): string => {
  const page = titlePageOf(file.project, file.settings);
  const base =
    (page.title || file.project.title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';
  return `${base} story grid.pdf`;
};
