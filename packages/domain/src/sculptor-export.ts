import { CARD_HEIGHT, CARD_WIDTH, drawnLinks, findEntity, mapPicture, nestedSummaries, placementsOfEntity, titleOf, viewStateOf } from './sculptor.js';
import { sculptLinkTypeName, sculptTypeInfo, sculptTypeName } from './sculptor-types.js';
import type { Board } from './entities/sculptor.js';
import type { ProjectFile } from './project-file.js';

/**
 * The Story Sculptor's map as a picture (addendum 03 v2 §11, export): one SVG
 * that the room turns into a PNG and the PDF window prints.
 *
 * Drawn from the same layout the canvas uses, so the export is what the
 * writer sees: the view as it is, or the whole story exploded. Light ink on
 * white, because it is going on paper or into somebody else's document.
 */

export type MapExportScope = 'shown' | 'everything';

export interface MapSvg {
  svg: string;
  width: number;
  height: number;
}

const MARGIN = 40;
const HEADER = 56;

const LINK_COLOURS: Record<string, string> = {
  related: '#a16207',
  causes: '#dc2626',
  appears_in: '#2563eb',
  setup_payoff: '#059669',
  conflict: '#ea580c',
  influence: '#7c3aed',
  custom: '#475569',
};

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A title broken into at most two lines that fit a card, the second ending in … if it ran on. */
const lines = (text: string, perLine = 26): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= perLine) {
      line = next;
      continue;
    }
    if (line) out.push(line);
    line = word.length > perLine ? `${word.slice(0, perLine - 1)}…` : word;
    if (out.length === 2) break;
  }
  if (line && out.length < 2) out.push(line);
  if (out.length === 2 && words.join(' ').length > out.join(' ').length + 1 && !out[1]!.endsWith('…')) {
    out[1] = `${out[1]!.slice(0, Math.max(0, perLine - 1))}…`;
  }
  return out.length > 0 ? out : [''];
};

/** The board as it would be with every fold opened and no branch entered. */
export const explodedBoard = (board: Board): Board => ({
  ...board,
  viewState: { ...viewStateOf(board), level: { kind: 'all' }, open: [], closed: [], rootId: null },
});

/**
 * The map as an SVG string. `scope: 'everything'` explodes the whole story
 * first; `'shown'` draws exactly what the canvas shows, mini map included.
 */
export const sculptMapSvg = (file: ProjectFile, board: Board, scope: MapExportScope = 'shown'): MapSvg => {
  const drawn = scope === 'everything' ? explodedBoard(board) : board;
  const picture = mapPicture(drawn);
  const summaries = nestedSummaries(drawn);
  const { lines: links } = drawnLinks(drawn, picture.visible);
  const at = new Map(picture.cards.map((card) => [card.node.id as string, card]));
  const minX = picture.cards.reduce((low, card) => Math.min(low, card.x), 0);
  const minY = picture.cards.reduce((low, card) => Math.min(low, card.y), 0);
  const ox = MARGIN - minX;
  const oy = MARGIN + HEADER - minY;
  const width = Math.max(480, Math.ceil(picture.width - minX + MARGIN * 2));
  const height = Math.max(240, Math.ceil(picture.height - minY + MARGIN * 2 + HEADER));

  const state = viewStateOf(drawn);
  const root = state.rootId ? drawn.nodes.find((node) => node.id === state.rootId) : null;
  const heading = `${file.project.title || 'Untitled'} — Story map${root ? `: ${titleOf(file, drawn, root) || 'Untitled'}` : ''}`;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">`,
    `<defs>${Object.entries(LINK_COLOURS)
      .map(
        ([type, colour]) =>
          `<marker id="arrow-${type}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${colour}"/></marker>`,
      )
      .join('')}</defs>`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="${MARGIN}" y="${MARGIN + 6}" font-size="20" font-weight="700" fill="#111827">${escape(heading)}</text>`,
    `<text x="${MARGIN}" y="${MARGIN + 28}" font-size="12" fill="#6b7280">${picture.cards.length} cards${links.length ? ` · ${links.length} connections` : ''}${scope === 'everything' ? ' · everything' : ' · as shown'}</text>`,
  );

  // Containment.
  for (const edge of picture.edges) {
    const from = at.get(edge.fromId);
    const to = at.get(edge.toId);
    if (!from || !to) continue;
    const x0 = from.x + ox + CARD_WIDTH;
    const y0 = from.y + oy + CARD_HEIGHT / 2;
    const x1 = to.x + ox;
    const y1 = to.y + oy + CARD_HEIGHT / 2;
    const mid = (x0 + x1) / 2;
    parts.push(
      `<path d="M${x0} ${y0} C${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}" fill="none" stroke="${sculptTypeInfo(to.node.kind).colour}" stroke-opacity="0.55" stroke-width="2"/>`,
    );
  }

  // Cards.
  for (const card of picture.cards) {
    const info = sculptTypeInfo(card.node.kind);
    const x = card.x + ox;
    const y = card.y + oy;
    const title = titleOf(file, drawn, card.node) || `Untitled ${sculptTypeName(card.node.kind, card.node.subtype).toLowerCase()}`;
    const entity = findEntity(drawn, card.node.entityId);
    const shared = entity ? placementsOfEntity(drawn, entity.id).length : 0;
    const sub = [
      sculptTypeName(card.node.kind, card.node.subtype),
      shared > 1 ? `in ${shared} places` : '',
      card.node.boundUnitId || card.node.boundBeatId ? 'in the script' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const titleLines = lines(title);
    parts.push(
      `<g>`,
      `<rect x="${x}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="10" fill="#ffffff" stroke="#d1d5db"/>`,
      `<rect x="${x}" y="${y}" width="6" height="${CARD_HEIGHT}" rx="3" fill="${info.colour}"/>`,
      `<rect x="${x + 14}" y="${y + CARD_HEIGHT / 2 - 9}" width="28" height="18" rx="4" fill="${info.colour}"/>`,
      `<text x="${x + 28}" y="${y + CARD_HEIGHT / 2 + 4}" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">${info.badge}</text>`,
    );
    const textTop = y + (titleLines.length === 1 ? 30 : 24);
    titleLines.forEach((line, index) => {
      parts.push(`<text x="${x + 50}" y="${textTop + index * 16}" font-size="13" font-weight="700" fill="#111827">${escape(line)}</text>`);
    });
    parts.push(`<text x="${x + 50}" y="${textTop + titleLines.length * 16 + 2}" font-size="10" fill="#6b7280">${escape(sub)}</text>`);
    const summary = summaries.get(card.node.id as string);
    if (summary && summary.total > 0 && card.folded) {
      parts.push(
        `<rect x="${x + CARD_WIDTH - 40}" y="${y - 9}" width="32" height="18" rx="9" fill="#111827"/>`,
        `<text x="${x + CARD_WIDTH - 24}" y="${y + 4}" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">+${summary.total}</text>`,
      );
    }
    parts.push(`</g>`);
  }

  // Cross-links over the cards, with their labels.
  for (const line of links) {
    const from = at.get(line.fromId);
    const to = at.get(line.toId);
    if (!from || !to) continue;
    const a = { x: from.x + ox, y: from.y + oy };
    const b = { x: to.x + ox, y: to.y + oy };
    const forwards = b.x > a.x + CARD_WIDTH / 2;
    const x0 = a.x + (forwards ? CARD_WIDTH : CARD_WIDTH / 2);
    const y0 = a.y + (forwards ? CARD_HEIGHT / 2 : 0);
    const x1 = b.x + (forwards ? 0 : CARD_WIDTH / 2);
    const y1 = b.y + (forwards ? CARD_HEIGHT / 2 : 0);
    const lift = forwards ? 0 : -60 - Math.abs(y1 - y0) * 0.15;
    const cx0 = forwards ? (x0 + x1) / 2 : x0;
    const cx1 = forwards ? (x0 + x1) / 2 : x1;
    const first = line.links[0]!;
    const colour = LINK_COLOURS[first.type] ?? LINK_COLOURS['related']!;
    const directed = line.links.some((one) => one.directed);
    parts.push(
      `<path d="M${x0} ${y0} C${cx0} ${y0 + lift}, ${cx1} ${y1 + lift}, ${x1} ${y1}" fill="none" stroke="${colour}" stroke-width="2" stroke-dasharray="${line.aggregated ? '2 4' : '6 4'}"${directed ? ` marker-end="url(#arrow-${LINK_COLOURS[first.type] ? first.type : 'related'})"` : ''}/>`,
    );
    const label = `${first.label.trim() || sculptLinkTypeName(first.type)}${line.links.length > 1 ? ` ×${line.links.length}` : ''}`;
    const mx = (x0 + 3 * cx0 + 3 * cx1 + x1) / 8;
    const my = (y0 + 3 * (y0 + lift) + 3 * (y1 + lift) + y1) / 8;
    const w = Math.min(220, label.length * 6.2 + 14);
    parts.push(
      `<rect x="${mx - w / 2}" y="${my - 9}" width="${w}" height="18" rx="9" fill="#ffffff" stroke="${colour}"/>`,
      `<text x="${mx}" y="${my + 4}" font-size="10" fill="#111827" text-anchor="middle">${escape(label.length > 34 ? `${label.slice(0, 33)}…` : label)}</text>`,
    );
  }

  parts.push(`</svg>`);
  return { svg: parts.join(''), width, height };
};

/**
 * The map as a one-page document for the PDF window. The page is the map's
 * own shape: never smaller than Letter on its long side, and large maps
 * become large pages rather than unreadable small ones (up to 48 inches).
 */
export const sculptMapHtml = (file: ProjectFile, map: MapSvg): { html: string; paper: { width: number; height: number } } => {
  const dpi = 96;
  const landscape = map.width >= map.height;
  const longSide = Math.min(48, Math.max(11, (landscape ? map.width : map.height) / dpi));
  const scale = longSide / ((landscape ? map.width : map.height) / dpi);
  const width = Math.max(landscape ? 11 : 8.5, Math.round(((map.width / dpi) * scale) * 100) / 100);
  const height = Math.max(landscape ? 8.5 : 11, Math.round(((map.height / dpi) * scale) * 100) / 100);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(file.project.title || 'Untitled')} — Story map</title>
<style>@page { size: ${width}in ${height}in; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; }
.map { width: ${width}in; height: ${height}in; display: flex; align-items: center; justify-content: center; }
.map svg { width: 100%; height: 100%; }</style></head>
<body><div class="map">${map.svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ')}</div></body></html>`;
  return { html, paper: { width, height } };
};

/** The file name an export is offered under. */
export const suggestedMapFileName = (file: ProjectFile, extension: 'png' | 'pdf'): string =>
  `${(file.project.title || 'Untitled').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')} story map.${extension}`;
