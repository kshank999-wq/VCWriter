import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  bookBlocks,
  bookContentsOf,
  bookIndexFor,
  bookMetrics,
  bookNames,
  bookSettingsOf,
  bookVars,
  chapterPageStyleOf,
  contentsDivisions,
  estimatedPages,
  geometryOf,
  insideFor,
  layPages,
  pictureLines,
  projectStats,
  renderBookBlock,
  textClass,
  titlePageOf,
  type BookBlock,
  type BookGeometry,
  type BookPicture,
  type BookRenderContext,
  type BookSettings,
  type LaidBook,
  type Measured,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * The measuring typesetter (addendum 20 §4).
 *
 * **The browser measures and the domain decides where the pages fall.** The
 * domain cannot know where a line of Garamond breaks — the faces are stacks
 * resolved by this machine — so each block is set in a hidden box the width
 * of the text block, in the chosen face at the chosen size, and its height
 * read back as a count of lines. Those counts go to `layPages`, which holds
 * every rule about the pages, and what comes back is what the screen draws
 * and the PDF prints.
 *
 * Two passes at most: the gutter depends on the page count, and the page
 * count on the gutter. The first pass guesses the count from the words; if
 * the laid count falls in a different gutter tier, the book is measured and
 * laid once more at the true one. A third pass could only oscillate, and the
 * difference would be an eighth of an inch.
 */

export interface Laying {
  blocks: BookBlock[];
  settings: BookSettings;
  geometry: BookGeometry;
  context: BookRenderContext;
  laid: LaidBook;
  measured: Measured;
}

const picturesOf = (file: ProjectFile): Map<string, BookPicture> =>
  new Map(
    (file.assets ?? []).map((asset) => [
      asset.id as string,
      { data: asset.data, altText: asset.altText, width: asset.width, height: asset.height },
    ]),
  );

const contextFor = (file: ProjectFile, settings: BookSettings, geometry: BookGeometry): BookRenderContext => ({
  settings,
  geometry,
  chapterStyle: chapterPageStyleOf(file),
  paragraphStyle: file.settings.paragraphStyle === 'blocked' ? 'blocked' : 'indented',
  pictures: picturesOf(file),
  names: bookNames(file),
  titlePage: titlePageOf(file.project, file.settings),
  contents: [],
  index: null,
});

/**
 * Measure every block at once: one `innerHTML`, one layout, one read per
 * block. A picture's lines come from its own shape rather than from the
 * box, so a data URL that has not decoded yet cannot measure as nothing.
 */
export const measureBlocks = (
  box: HTMLElement,
  blocks: readonly BookBlock[],
  context: BookRenderContext,
): Measured => {
  const { leadPx, measurePx } = bookMetrics(context.geometry);
  const linesPerPage = context.geometry.linesPerPage;
  const vars = bookVars(context);
  for (const [name, value] of Object.entries(vars)) box.style.setProperty(name, value);
  box.className = `bk-measure ${textClass(context)}`;
  box.innerHTML = blocks
    .map((block) => `<div class="bk-item" data-block="${block.id}">${renderBookBlock(block, context)}</div>`)
    .join('');
  const measured = new Map<string, number>();
  const items = box.querySelectorAll<HTMLElement>('.bk-item');
  blocks.forEach((block, index) => {
    if (block.display) {
      measured.set(block.id, Math.max(1, linesPerPage));
      return;
    }
    if (block.kind === 'figure') {
      const picture = block.assetId ? context.pictures.get(block.assetId) : undefined;
      const caption = (block.caption ?? '').trim().length > 0 ? 2 : 1;
      measured.set(block.id, pictureLines(picture, measurePx, leadPx, linesPerPage) + caption);
      return;
    }
    const element = items[index];
    // The fractional height, never `offsetHeight`: that is a whole number of
    // pixels, and a four-line paragraph on a 18.667-pixel leading measures 75
    // rather than 74.67, which read as 4.02 lines and was counted as five —
    // one line too many on every such paragraph, and a widow the cutter's
    // own rule could not prevent. A tenth of a line of slack covers what
    // rounding is left; a real extra line is a whole one.
    const height = element ? element.getBoundingClientRect().height : 0;
    // A box that cannot measure — a test's document has no layout — reads as
    // one line, so the laying still runs and says something rather than
    // nothing.
    measured.set(block.id, height > 0 ? Math.max(1, Math.ceil(height / leadPx - 0.1)) : 1);
  });
  box.innerHTML = '';
  return measured;
};

/** The whole laying, from a file, measuring in `box`. Pure but for the box. */
export const layBook = (file: ProjectFile, box: HTMLElement): Laying => {
  const settings = bookSettingsOf(file);
  const blocks = bookBlocks(file);
  const format = file.project.format;
  const stats = projectStats(file);
  let pages = estimatedPages(stats.wordCount, contentsDivisions(file).length);

  const once = (count: number) => {
    const geometry = geometryOf(settings, format, count);
    const context = contextFor(file, settings, geometry);
    // The contents and the index are measured for their rows: the numbers
    // are not known until the book is laid, and do not change the count.
    const rows = bookContentsOf(blocks, { pages: [], where: new Map(), roman: 0, arabic: 0 });
    const preliminary: BookRenderContext = {
      ...context,
      contents: rows,
      index: bookIndexFor(file, { pages: [], where: new Map(), roman: 0, arabic: 0 }),
    };
    const measured = measureBlocks(box, blocks, preliminary);
    const laid = layPages(blocks, measured, geometry, settings, context.names);
    const final: BookRenderContext = {
      ...context,
      contents: bookContentsOf(blocks, laid),
      index: bookIndexFor(file, laid),
    };
    return { blocks, settings, geometry, context: final, laid, measured };
  };

  let laying = once(pages);
  // The estimate decided the gutter, and the laid count may sit in a different
  // tier of the standard's band — so where the inside margin would come out
  // differently, lay it again on the real count. The trim decides the band, so
  // it is asked rather than a page count alone.
  const trim = laying.geometry.trim;
  if (insideFor(trim, laying.laid.pages.length) !== insideFor(trim, pages)) {
    pages = laying.laid.pages.length;
    laying = once(pages);
  }
  return countedAt(laying, laying.laid.pages.length);
};

/**
 * Say the count the book **has** rather than the guess that decided the gutter
 * (§9g).
 *
 * `estimatedPages` exists only to break a circle — the gutter needs a page
 * count and the page count needs the gutter — and once the circle is closed
 * the guess has no business surviving into what the screen reads. It did: the
 * bar said *13 pages* while the margin sentence beside it said *worked out
 * from the trim and 9 pages*, and the spine sentence said *at 9 pages*. Two
 * numbers for one book, on one screen.
 *
 * Nothing about the margins moves. The pass above only skips a re-lay when
 * `insideFor` gives the same answer at both counts, and the inside margin is
 * the only one a page count reaches, so the geometry at the real count is the
 * geometry already in hand — with its `pages` told the truth.
 */
const countedAt = (laying: Laying, pages: number): Laying => {
  if (laying.geometry.pages === pages) return laying;
  const geometry = { ...laying.geometry, pages };
  return { ...laying, geometry, context: { ...laying.context, geometry } };
};

/**
 * Lay the book whenever the file changes, measuring in a box the caller
 * renders. The box is a plain element the hook writes into; React never
 * reconciles its children, which is the whole reason it is a ref.
 */
export const useBookLaying = (file: ProjectFile, open: boolean): { laying: Laying | null; box: React.RefObject<HTMLDivElement> } => {
  const box = useRef<HTMLDivElement>(null);
  const [laying, setLaying] = useState<Laying | null>(null);
  // What the laying depends on, so typing a note elsewhere does not re-set the book.
  const key = useMemo(
    () =>
      JSON.stringify([
        file.settings.book,
        file.settings.paragraphStyle,
        file.settings.chapterPageStyle,
        file.settings.titlePage,
        file.settings.markerNumbering,
        file.project.title,
        file.project.author,
        file.units.map((unit) => [unit.id, unit.inScript, unit.title]),
        file.beats.map((beat) => [beat.id, beat.unitId, beat.inScript, beat.orderKey, beat.manuscript]),
        file.markers,
        (file.assets ?? []).map((asset) => [asset.id, asset.width, asset.height, asset.caption]),
        file.indexMarks,
        file.indexRefs,
      ]),
    [file],
  );

  useLayoutEffect(() => {
    if (!open || !box.current) return;
    setLaying(layBook(file, box.current));
    // The key is what the laying reads; the file is what it reads it from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  /**
   * And again once the fonts have arrived (addendum 20 §6b).
   *
   * An imported font is a data URL the browser decodes **after** the first
   * layout, so the first measurement is of the fallback — and a fallback that
   * sets narrower puts the wrong number of lines on every page. Waiting for
   * `document.fonts.ready` and laying once more is the honest fix; where
   * there are no fonts to wait for it settles at once and lays the same book
   * twice, which costs one pass and nothing else.
   */
  useEffect(() => {
    if (!open) return undefined;
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (!fonts?.ready) return undefined;
    let dropped = false;
    void fonts.ready.then(() => {
      if (!dropped && box.current) setLaying(layBook(file, box.current));
    });
    return () => {
      dropped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  return { laying, box };
};
