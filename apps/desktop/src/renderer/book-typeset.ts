import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  outOfContents,
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
  type Wraps,
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
 * **The measure box is given only what it is asked about** (§9ai).
 *
 * The comment below has always said a picture's lines come from its own shape
 * rather than from the box — and the measurement drew the picture in anyway.
 * A `display` block measures as a whole page and a `figure` block measures
 * through `pictureLines`; **neither of them looks at the box at all**, so
 * every page of art, plate and illustration put several megabytes of base64
 * into `innerHTML` on **every** laying, to be parsed, decoded and thrown away
 * unread. Measured on a hundred-page novel with three 4 MB illustrations:
 * **16.10 MB of markup against 0.07, and 159 ms a laying against 7**, for
 * measurements identical to the pixel. On a book with more art than that it is
 * the laying that takes the tab down, which is what typing an ISBN into the
 * copyright page did — every keystroke there changes `settings.book`, so the
 * whole book is laid again.
 *
 * It is the **block** that is left out rather than the picture inside it,
 * because a picture reaches the markup by more than one road: a figure's comes
 * from `context.pictures`, a chapter leaf's is baked into `block.chapter.image`
 * by `chapterLeafContent`, and the title page's and the imprint's come from
 * their own records. Blanking the context's pictures would have missed three of
 * those — it did, measured, which is how this rule was arrived at — where
 * leaving the item empty cannot miss any, and is honest about the reason: the
 * box is never read for these, so there is nothing to put in it. The item
 * itself stays, because the blocks and the items are read side by side.
 *
 * Everything else is drawn exactly as before, which is the half that matters:
 * a cut-in picture's reach **is** read off its own box below.
 */
const measuredWithoutTheBox = (block: BookBlock): boolean => block.display || block.kind === 'figure';

/**
 * Measure every block at once: one `innerHTML`, one layout, one read per
 * block. A picture's lines come from its own shape rather than from the
 * box, so a data URL that has not decoded yet cannot measure as nothing.
 */
export const measureBlocks = (
  box: HTMLElement,
  blocks: readonly BookBlock[],
  context: BookRenderContext,
): { measured: Measured; wraps: Wraps } => {
  const { leadPx, measurePx } = bookMetrics(context.geometry);
  const linesPerPage = context.geometry.linesPerPage;
  const vars = bookVars(context);
  for (const [name, value] of Object.entries(vars)) box.style.setProperty(name, value);
  box.className = `bk-measure ${textClass(context)}`;
  box.innerHTML = blocks
    .map(
      (block) =>
        `<div class="bk-item" data-block="${block.id}">${measuredWithoutTheBox(block) ? '' : renderBookBlock(block, context)}</div>`,
    )
    .join('');
  const measured = new Map<string, number>();
  /**
   * How far a cut-in picture reaches, in lines (§8b). Measured rather than
   * worked out: only the browser knows how tall the picture sets at this
   * measure, and the cutter needs it to keep the picture and the text
   * running round it on one page.
   *
   * It is read from the picture's own box, which is why the items below are
   * **not** formatting contexts — a float contained by its item would
   * measure as its own paragraph's height and the paragraphs after it would
   * measure full measure, which is the page the fix is about.
   */
  const wraps = new Map<string, number>();
  const items = box.querySelectorAll<HTMLElement>('.bk-item');
  blocks.forEach((block, index) => {
    if (block.display) {
      measured.set(block.id, Math.max(1, linesPerPage));
      return;
    }
    if (block.kind === 'figure') {
      const picture = block.assetId ? context.pictures.get(block.assetId) : undefined;
      const caption = (block.caption ?? '').trim().length > 0 ? 2 : 1;
      // An empty box is the size it was drawn (§9z), so the hole the page
      // keeps for it is the box the writer put there.
      measured.set(block.id, pictureLines(picture, measurePx, leadPx, linesPerPage, block.boxHeight ?? 0) + caption);
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
    if (block.inset && element) {
      const picture = element.querySelector<HTMLElement>('.bk-inset');
      const reach = picture ? picture.getBoundingClientRect().height : 0;
      if (reach > 0) wraps.set(block.id, Math.max(1, Math.ceil(reach / leadPx - 0.1)));
    }
  });
  box.innerHTML = '';
  return { measured, wraps };
};

/** The whole laying, from a file, measuring in `box`. Pure but for the box. */
export const layBook = (file: ProjectFile, box: HTMLElement): Laying => {
  const settings = bookSettingsOf(file);
  const blocks = bookBlocks(file);
  // What the contents page leaves off (§9v). It is read once and handed to
  // both passes, because the entries decide how many pages the list takes
  // and a measurement made against a different list is a measurement of a
  // book that is not being printed.
  const out = outOfContents(file);
  const format = file.project.format;
  const stats = projectStats(file);
  let pages = estimatedPages(stats.wordCount, contentsDivisions(file).length);

  const once = (count: number) => {
    const geometry = geometryOf(settings, format, count);
    const context = contextFor(file, settings, geometry);
    // The contents and the index are measured for their rows: the numbers
    // are not known until the book is laid, and do not change the count.
    const rows = bookContentsOf(blocks, { pages: [], where: new Map(), roman: 0, arabic: 0 }, out);
    const preliminary: BookRenderContext = {
      ...context,
      contents: rows,
      index: bookIndexFor(file, { pages: [], where: new Map(), roman: 0, arabic: 0 }),
    };
    const { measured, wraps } = measureBlocks(box, blocks, preliminary);
    const laid = layPages(blocks, measured, geometry, settings, context.names, wraps);
    const final: BookRenderContext = {
      ...context,
      contents: bookContentsOf(blocks, laid, out),
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
 * **What the laying reads, by identity rather than by content** (addendum 20
 * §9ag, from Ken: *when I try to enter the copyright info, the typing is slow
 * and sticky and then the page shuts down*).
 *
 * The key used to be `JSON.stringify` over the units, **every beat's whole
 * manuscript**, the markers, the assets and the index — rebuilt on every
 * change to the document, which on a book of any size is hundreds of
 * kilobytes of string allocated between two keystrokes.
 *
 * It never needed to read a word of it. **A mutation rebuilds one collection
 * and shares the rest** (addendum 02 §6c, which is what undo's whole-document
 * stack rests on), so a collection that is the same object is a collection
 * nothing has touched — `isWritersAct`'s own argument, which compares
 * top-level references for exactly this reason. Reading references is both
 * cheaper and stricter: it catches a field no list here happened to name.
 */
const layingReads = (file: ProjectFile): readonly unknown[] => [
  file.settings.book,
  file.settings.paragraphStyle,
  file.settings.chapterPageStyle,
  file.settings.titlePage,
  file.settings.markerNumbering,
  file.project.title,
  file.project.author,
  // **Where a unit falls, as well as what it says** (§9v, from Ken: *when you
  // reorder anything… you have to erase and reload the page*). The rail reads
  // the file and re-draws at once; the contents, the running heads and every
  // page number come off the laying, and a chapter dragged rekeys the units it
  // moved without touching a word — so the room went on drawing the book in the
  // order it used to be in. The collection's own identity says it now.
  file.units,
  file.beats,
  file.markers,
  file.assets,
  file.indexMarks,
  file.indexRefs,
];

/** A number that changes when any of them does, so an effect can depend on it. */
const useIdentityKey = (values: readonly unknown[]): number => {
  const held = useRef<readonly unknown[] | null>(null);
  const version = useRef(0);
  const last = held.current;
  if (!last || last.length !== values.length || values.some((one, at) => !Object.is(one, last[at]))) {
    held.current = values;
    version.current += 1;
  }
  return version.current;
};

/**
 * **How long a burst of changes is allowed to collapse into one laying**
 * (§9ag). Short enough that a single act — a drag, a trim, a tick — settles
 * before anybody looks for it, and long enough that typing at speed lays the
 * book once rather than once a character.
 */
const SETTLE_MS = 180;

/**
 * **How big a book has to be before its laying is worth waiting for** (§9ag).
 *
 * The settle is **self-measuring rather than a blanket rule**, because the
 * fault it fixes is a cost and not a gesture: a book the browser lays in a
 * fraction of a frame is one nobody can see happen, so it goes on happening
 * the moment the document changes and a short book behaves exactly as it did
 * — which is why the whole room's suite passed this unedited.
 *
 * **It is counted in blocks rather than in milliseconds**, and that is the
 * half worth keeping. The first draft timed the last laying and let anything
 * under a frame through, which is the same idea measured the wrong way: it
 * made the room's behaviour a fact about **how fast the machine is**, so the
 * threshold flapped on a 46-page novel (86 layings for 67 keystrokes) and one
 * test in the suite passed or failed depending on the run. A block is what
 * actually gets written into the measure box and laid out, so the number of
 * them is the size of the job — a property of the document, the same on every
 * machine and the same on every run.
 *
 * **The number is measured rather than reasoned about**, which took three
 * goes: a 46-page novel is **106** blocks and lays in about 19 ms, and every
 * fixture in the whole room's suite is **13 or fewer**. The first guess at
 * this was 160 — above the novel — so the settle never engaged at all and the
 * measurement is the only reason that was noticed. Forty sits three times
 * above anything a test builds and well under any book somebody is laying
 * out.
 */
const BLOCKS_BEFORE_SETTLING = 40;

/**
 * Lay the book whenever the file changes, measuring in a box the caller
 * renders. The box is a plain element the hook writes into; React never
 * reconciles its children, which is the whole reason it is a ref.
 *
 * **A laying is a reading, and a reading may settle a moment behind the
 * typing** (§9ag). Laying the book is `box.innerHTML = every block of it`
 * followed by a forced layout and the cutter's own walk, and the copyright
 * page, the title page, the chapter openings and Book settings all live in
 * `settings.book` — so every one of those screens, all of which save as you
 * type because a look is tuned against the sheet beside it, was re-laying the
 * whole book between two keystrokes. Measured on a 46-page novel at **117 ms
 * a character**, and the book Ken reported it on is twice that.
 *
 * Nothing about what is written changes: the document still takes every
 * keystroke the moment it is typed. Only the **picture** waits, and only on a
 * book big enough that laying it is something you can see happen — the first
 * laying never waits, and neither does a short one.
 */
export const useBookLaying = (file: ProjectFile, open: boolean): { laying: Laying | null; box: React.RefObject<HTMLDivElement> } => {
  const box = useRef<HTMLDivElement>(null);
  const [laying, setLaying] = useState<Laying | null>(null);
  const key = useIdentityKey(layingReads(file));
  /**
   * The fonts the book has, which is what the pass below is really about —
   * it was keyed on the **laying** key, so every keystroke in every one of
   * those screens registered a second full laying a microtask later, and the
   * cost above was being paid twice over.
   *
   * **Named rather than held by identity**, which is the one place in this
   * hook where that would be wrong: `setBookSettings` runs the whole record
   * through `bookSettingsSchema.parse`, so every nested array in it — this
   * list among them — is a **new object after every write**. Measured, that
   * made this key change on every keystroke and the second laying came back.
   * The ids are a handful of short strings and never the files, which are
   * data URLs of up to four megabytes each.
   */
  const fontKey = bookSettingsOf(file)
    .fonts.map((one) => one.id)
    .join(' ');
  // What to lay from, read at the moment the timer fires rather than captured.
  const latest = useRef(file);
  latest.current = file;
  /**
   * How big the book turned out to be, from the last laying. Nought until one
   * has happened, so the **first** is never made to wait — a room that opened
   * on a blank spread for a fifth of a second would be the fix costing more
   * than the fault.
   */
  const size = useRef(0);

  useLayoutEffect(() => {
    if (!open || !box.current) return undefined;
    const lay = () => {
      if (!box.current) return;
      const next = layBook(latest.current, box.current);
      size.current = next.blocks.length;
      setLaying(next);
    };
    if (size.current <= BLOCKS_BEFORE_SETTLING) {
      lay();
      return undefined;
    }
    const timer = window.setTimeout(lay, SETTLE_MS);
    return () => window.clearTimeout(timer);
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
   *
   * **Once per set of fonts, not once per change to the book** (§9ag): what
   * it is waiting for is a font arriving, which happens when one is imported
   * and never because somebody typed a letter into the copyright page.
   */
  useEffect(() => {
    if (!open) return undefined;
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (!fonts?.ready) return undefined;
    let dropped = false;
    void fonts.ready.then(() => {
      if (!dropped && box.current) setLaying(layBook(latest.current, box.current));
    });
    return () => {
      dropped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey, open]);

  return { laying, box };
};
