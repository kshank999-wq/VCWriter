import { renderTitleSheet, TITLE_PAGE_STYLES, type PrintOptions } from './print-html.js';
import { titlePageOf } from './entities/title-page.js';
import { sceneCardOf } from './outline-binding.js';
import { findOutline, outlineRows, outlinesOf, outlineTally, rowTitle } from './outline.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { ProjectFile } from './project-file.js';

/**
 * The outline, printed and exported (addendum 06 §12, stage 9).
 *
 * Two ways out of the Outliner, and they are deliberately different things.
 *
 * **The document** is the outline as §9 draws it: indentation, and a weight
 * that falls away with depth so the hierarchy reads at a glance without being
 * read. It is what a writer takes into a room.
 *
 * **The indented text** is the outline as characters — the thing addendum 03
 * §8 used to promise the Sculptor and no longer does, because a board is a
 * picture of possibilities and an outline is a decision about them. It is here
 * instead, where an outline actually lives, and it goes on the clipboard so it
 * can be pasted into whatever the writer already works in.
 *
 * **Both print the whole outline.** Folding is how you stop looking at part of
 * it for an afternoon and a filter is a search, and neither is an edit; a
 * document that quietly left out what was folded would be a document the
 * writer could not account for.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const baseName = (file: ProjectFile): string => {
  const page = titlePageOf(file.project, file.settings);
  return (page.title || file.project.title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';
};

/**
 * Every row, folded or not.
 *
 * `outlineRows` walks past a folded row's children unless it is given a set to
 * keep to — the set a filter uses. Handing it every id is how this file says
 * *show me all of it*, which is what both of these documents want.
 */
const everyRow = (outline: Outline) =>
  outlineRows(outline, new Set(outline.items.map((item) => item.id as string)));

/** The outline being printed: the one asked for, or the first one there is. */
export const outlineToPrint = (file: ProjectFile, outlineId?: string | null): Outline | null => {
  const all = outlinesOf(file);
  if (outlineId) return findOutline(file, outlineId as Outline['id']) ?? all[0] ?? null;
  return all[0] ?? null;
};

/** What a row is called on the page. The writer's own types read as typed. */
export const kindLabel = (kind: string): string =>
  kind
    .split(/[_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Row';

/**
 * The name a row goes out under.
 *
 * A scene that is in the script is numbered there, and the number stands in
 * for the word — *Sc. 12 — Warehouse Confrontation*, the way §9's example has
 * it, because the writer's own label already says what kind of thing it is and
 * *Scene Sc. 12* says it twice. A row nobody has named yet says so rather than
 * printing as a blank line with an em dash after it — on paper there is no
 * cursor to explain the gap.
 */
const headOf = (file: ProjectFile, outline: Outline, item: OutlineItem): string => {
  const card = item.kind === 'scene' ? sceneCardOf(file, outline, item) : null;
  const label = card?.number?.trim() || kindLabel(item.kind);
  const said = rowTitle(file, item).trim();
  return said.length > 0 ? `${label} — ${said}` : `${label} (unnamed)`;
};

// ------------------------------------------------------- indented text

const INDENT = '    ';

/**
 * The outline as characters, depth-first (§12 stage 9).
 *
 * Indentation carries the shape, because that is the one thing every editor,
 * every email client and every notes application agrees about. A row's body
 * follows it one step further in, so a note attached to a beat cannot be read
 * as a row of its own.
 */
export const outlineAsText = (file: ProjectFile, outline: Outline): string => {
  const lines: string[] = [];
  for (const row of everyRow(outline)) {
    lines.push(INDENT.repeat(row.depth) + headOf(file, outline, row.item));
    const body = row.item.body.trim();
    if (body.length > 0) {
      for (const line of body.split(/\r?\n/)) lines.push(INDENT.repeat(row.depth + 1) + line.trim());
    }
  }
  return lines.join('\n');
};

/** What to call the file, when the text is saved rather than pasted. */
export const suggestedOutlineTextName = (file: ProjectFile, outline: Outline): string =>
  `${baseName(file)} — ${outline.name.replace(/[^\w\-. ]+/g, '').trim() || 'Outline'}.txt`;

// ---------------------------------------------------------- the document

/**
 * A scene's card, under its name (§7).
 *
 * Only the fields that have something in them. The card on screen is empty
 * until filled in and does not nag; a printed one that listed *POV: —* for
 * every scene would be nagging in a place the writer cannot answer it.
 *
 * The synopsis is the scene's own once it is in the script and the row's own
 * while it is a plan — the card reads through rather than copying across, and
 * so does this.
 */
const cardLine = (file: ProjectFile, outline: Outline, item: OutlineItem): string => {
  const card = sceneCardOf(file, outline, item);
  if (!card) return '';
  const facts: string[] = [];
  if (card.pov?.trim()) facts.push(`POV ${card.pov.trim()}`);
  if (card.lane) facts.push(card.lane.name);
  if (card.status.trim()) facts.push(card.status.trim());
  facts.push(`${card.beats} ${card.beats === 1 ? 'beat' : 'beats'}`);

  const said = [card.synopsis, card.purpose ?? ''].map((text) => text.trim()).filter((text) => text.length > 0);
  return (
    `<p class="out-facts">${escapeHtml(facts.join(' · '))}</p>` +
    said.map((text) => `<p class="out-purpose">${escapeHtml(text)}</p>`).join('')
  );
};

/**
 * One row, at its depth.
 *
 * The depth is a left margin rather than nesting, because a nested list that
 * ran to eight levels would leave a sentence four words wide at the bottom of
 * the page. Eight is where the indentation stops growing for the same reason;
 * the class still says which level it is, so the weight keeps falling.
 */
const renderRow = (file: ProjectFile, outline: Outline, row: { item: OutlineItem; depth: number }): string => {
  const { item, depth } = row;
  const tier = depth === 0 ? 'out-scene' : depth === 1 ? 'out-beat' : 'out-under';
  const indent = Math.min(depth, 8) * 18;
  const body = item.body.trim();
  const linked = item.source?.type === 'research_item';

  return (
    `<li class="out-row ${tier} out-kind-${escapeHtml(item.kind)}" style="margin-left:${indent}pt">` +
    `<p class="out-head">${escapeHtml(headOf(file, outline, item))}` +
    (linked ? '<span class="out-mark" title="From the research">&#9670;</span>' : '') +
    (item.boundUnitId || item.boundBeatId ? '<span class="out-mark">&#9679;</span>' : '') +
    '</p>' +
    (item.kind === 'scene' ? cardLine(file, outline, item) : '') +
    (body.length > 0 && item.kind !== 'scene' ? `<p class="out-body">${escapeHtml(body)}</p>` : '') +
    '</li>'
  );
};

const STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f2f2f2;
    color: #000;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { size: Letter portrait; margin: 0.75in 0.75in 0.75in 1in; }
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
  .out-doc {
    width: 8.5in;
    padding: 0.3in 0.75in 0.5in 1in;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
  .out-masthead { border-bottom: 2pt solid #000; padding-bottom: 6pt; margin-bottom: 14pt; }
  .out-masthead h1 { margin: 0; font-size: 18pt; text-transform: uppercase; letter-spacing: 0.06em; }
  .out-masthead p { margin: 3pt 0 0; font-size: 9pt; color: #444; }
  ol { list-style: none; margin: 0; padding: 0; }
  /* A row and everything it says about itself stay on one sheet. */
  .out-row { break-inside: avoid; page-break-inside: avoid; padding: 3pt 0 3pt 8pt; }
  .out-head { margin: 0; }
  /*
    §9: scene rows strongest, beats lighter, supporting rows lighter still, so
    the hierarchy reads without being read. On paper the indentation alone is
    not enough — a column of identical grey lines eight levels deep is a wall.
  */
  .out-scene {
    border-left: 2.5pt solid #000;
    margin-top: 12pt;
    break-after: avoid;
    page-break-after: avoid;
  }
  .out-scene > .out-head { font-size: 12pt; font-weight: bold; letter-spacing: 0.01em; }
  .out-beat { border-left: 1.25pt solid #666; }
  .out-beat > .out-head { font-size: 10.5pt; font-weight: 600; color: #111; }
  .out-under { border-left: 0.5pt solid #bbb; }
  .out-under > .out-head { font-size: 9.5pt; color: #333; }
  .out-body { margin: 2pt 0 0; font-size: 9pt; color: #444; white-space: pre-wrap; }
  .out-facts {
    margin: 2pt 0 0;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #666;
  }
  .out-purpose { margin: 2pt 0 0; font-size: 9pt; color: #333; white-space: pre-wrap; }
  /* A row that is in the script, and a row that came off the shelf. Small, in
     the margin of the line, because they are facts about the row rather than
     part of what it says. */
  .out-mark { margin-left: 6pt; font-size: 7pt; color: #666; vertical-align: 2pt; }
  .out-empty { font-size: 10pt; color: #666; }
  .out-printed { margin-top: 14pt; font-size: 7pt; color: #666; }
  @media print {
    body { background: #fff; }
    .page { min-height: 0; height: 11in; margin: 0; box-shadow: none; break-after: page; overflow: hidden; }
    .out-doc { width: auto; padding: 0; margin: 0; box-shadow: none; }
  }
`;

/**
 * The outline as a document.
 *
 * Portrait, unlike the Story Grid: an outline is a column of sentences that
 * get shorter as they get deeper, and a wide page would leave most of it
 * white. The title sheet in front of it is the script's, because this is a
 * document about that script rather than a document of its own.
 */
export const renderOutlineDocumentHtml = (
  file: ProjectFile,
  outlineId?: string | null,
  options: PrintOptions = {},
): string => {
  const outline = outlineToPrint(file, outlineId);
  const page = titlePageOf(file.project, file.settings);
  const title = page.title || file.project.title || 'Untitled';
  const tally = outline ? outlineTally(outline) : { rows: 0, scenes: 0, promoted: 0 };
  // Everything: printing is not reading, so nothing is folded out of it.
  const rows = outline ? everyRow(outline) : [];

  const said =
    `${tally.scenes} ${tally.scenes === 1 ? 'scene' : 'scenes'} · ${tally.rows} ` +
    `${tally.rows === 1 ? 'row' : 'rows'}` +
    (tally.promoted > 0 ? ` · ${tally.promoted} in the script` : '');

  const body =
    (options.includeTitlePage === false ? '' : renderTitleSheet(page)) +
    '<article class="out-doc">' +
    '<header class="out-masthead">' +
    `<h1>${escapeHtml(outline ? outline.name : 'Outline')}</h1>` +
    `<p>${escapeHtml(title)} &#183; ${said}</p>` +
    '</header>' +
    (rows.length === 0
      ? '<p class="out-empty">This outline is empty.</p>'
      : `<ol>${rows.map((row) => renderRow(file, outline as Outline, row)).join('')}</ol>`) +
    (options.includePrintedAt ? `<p class="out-printed">${escapeHtml(new Date().toLocaleString())}</p>` : '') +
    '</article>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — ${escapeHtml(outline ? outline.name : 'Outline')}</title>
<style>${STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
};

export const suggestedOutlineFileName = (file: ProjectFile, outlineId?: string | null): string => {
  const outline = outlineToPrint(file, outlineId);
  const name = (outline?.name ?? 'Outline').replace(/[^\w\-. ]+/g, '').trim() || 'Outline';
  return `${baseName(file)} ${name}.pdf`;
};
