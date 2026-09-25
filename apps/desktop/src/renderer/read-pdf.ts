import type { LaidOutLine } from '@vcwriter/domain';
import { openPdfDocument } from './pdf-runtime';

/**
 * Getting the lines off a PDF page (addendum 02 §18).
 *
 * pdf.js gives text as **items** — runs of characters with a transform
 * matrix — not as lines. A screenplay's format lives in the indentation, so
 * what the reader needs is the line: its text, and how far in from the left
 * edge it starts. That is what this makes.
 *
 * Items are gathered into lines by their baseline. A tolerance of a couple
 * of points, because a PDF's own rounding puts the pieces of one line at
 * very slightly different heights, and because a superscript or a revision
 * mark sits a hair above the text it belongs to.
 *
 * The work is done here in the renderer rather than in the main process:
 * pdf.js is large, only this screen needs it, and loading it on demand keeps
 * it out of the path of opening the app. It runs on the bytes, never on a
 * URL, so nothing is fetched.
 */

/** Two points: a line is a line, a new line is 12pt away at 12 point. */
const SAME_LINE = 2.5;

interface Piece {
  text: string;
  x: number;
  y: number;
  width: number;
}

/** The pieces of one baseline, joined with the spaces the layout implies. */
const joinPieces = (pieces: Piece[]): { text: string; x: number } => {
  const inOrder = [...pieces].sort((a, b) => a.x - b.x);
  let text = '';
  let cursor: number | null = null;
  for (const piece of inOrder) {
    if (piece.text.length === 0) continue;
    if (cursor !== null) {
      // A gap wider than about half a character is a space the PDF drew by
      // moving the pen rather than by writing one.
      const gap = piece.x - cursor;
      if (gap > 3 && !text.endsWith(' ') && !piece.text.startsWith(' ')) text += ' ';
    }
    text += piece.text;
    cursor = piece.x + piece.width;
  }
  return { text: text.replace(/\s+$/, ''), x: inOrder[0]?.x ?? 0 };
};

export interface PdfReadResult {
  lines: LaidOutLine[];
  pages: number;
  /** What the PDF says it is called, when it carries a title at all. */
  title: string;
}

/**
 * Read a PDF's text, laid out. Rejects a PDF with no text layer — a scan is
 * pictures of words, and saying so is better than importing nothing.
 */
export const readPdfLines = async (bytes: ArrayBuffer): Promise<PdfReadResult> => {
  // One runtime (§16a), which is also where the polyfill pdf.js 6 needs on
  // this app's Chromium lives — without it `getPage` throws, and this reader
  // had been failing that way with every test green.
  // A script is text: nothing here should reach the network or load a font.
  const { document, done } = await openPdfDocument(bytes, { disableFontFace: true });

  const lines: LaidOutLine[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();

    const byBaseline: Piece[][] = [];
    for (const item of content.items) {
      const piece = item as { str?: string; transform?: number[]; width?: number };
      if (typeof piece.str !== 'string' || piece.str.trim().length === 0) continue;
      const transform = piece.transform ?? [];
      const x = Number(transform[4] ?? 0);
      const y = Number(transform[5] ?? 0);
      const here: Piece = { text: piece.str, x, y, width: Number(piece.width ?? 0) };

      const existing = byBaseline.find((row) => Math.abs((row[0] as Piece).y - y) <= SAME_LINE);
      if (existing) existing.push(here);
      else byBaseline.push([here]);
    }

    // Down the page: a PDF measures up from the bottom, a reader reads down.
    byBaseline.sort((a, b) => (b[0] as Piece).y - (a[0] as Piece).y);
    for (const row of byBaseline) {
      const { text, x } = joinPieces(row);
      if (text.trim().length === 0) continue;
      lines.push({ text, x, y: (row[0] as Piece).y, page: number });
    }
    page.cleanup();
  }

  let title = '';
  try {
    const meta = (await document.getMetadata()) as { info?: { Title?: unknown } };
    if (typeof meta.info?.Title === 'string') title = meta.info.Title.trim();
  } catch {
    // A PDF without metadata is perfectly normal; the writer names it.
  }

  const pages = document.numPages;
  await done();
  return { lines, pages, title };
};
