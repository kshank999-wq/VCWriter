import { z } from 'zod';

import { chapterPageStyleOf, setChapterPageStyle } from './chapter-style.js';
import type { ChapterPageStyle } from './chapter-style.js';
import {
  CHAPTER_LAYOUT_IDS,
  CHAPTER_TEMPLATES,
  FIRST_LINE_KINDS,
  type ChapterLayoutId,
  type ChapterTemplate,
  type FirstLine,
  type StoryMarker,
} from './entities/structure.js';
import { nowIso } from './entities/common.js';
import type { ProjectFile } from './project-file.js';
import type { StoryMarkerId } from './ids.js';

/**
 * How a chapter's opening page is laid out (addendum 20 §14, from Ken's own
 * *Chapter Opening Layout* handoff): where the graphic goes, how the number is
 * shown, how far down the page the chapter starts, and how the first line is
 * treated.
 *
 * **The audit paid again.** Of the handoff's six-field settings model, four
 * fields were already stored under other names — its `numberStyle` is
 * `markerNumbering` (which has offered all four of its options, and three
 * more, since the markers were built), its `sink` is `dropInches`, its
 * `graphicSize` is `graphicWidth`, and its `graphic` is `assetId`. Five of its
 * eight layouts are the four `CHAPTER_TEMPLATES` plus *no graphic at all*. So
 * what is new is the **layout as one named thing**, three layouts nobody could
 * draw (a bleeding header, a flush-left opening, a numeral on its own), and
 * the drop cap.
 *
 * Three decisions carry it.
 *
 * **A layout is data, and the renderer reads the data.** The handoff asks that
 * adding one need only a new entry, so a layout is a **list of slots** and the
 * print walks the list. Nothing anywhere says `if (layout === 'mid')`.
 *
 * **`layout` is the answer and `template` is its older spelling.** An existing
 * book stores where its graphic goes and nothing else, so `layoutOf` reads
 * that back — which is why a book made before this draws exactly as it did,
 * and why setting a layout clears the template rather than leaving two fields
 * to disagree. It is the shape `manuscript`/`serif` took when the face list
 * widened (§7a).
 *
 * **The named steps are read back, never stored.** A sink is *shallow*,
 * *standard* or *deep* on the screen and a number of inches on the page; the
 * number is the truth and the three buttons set it, one of them lit where the
 * number matches. `bookPresetOf`'s rule (§7) — so a writer who types 2.1 in
 * sees Custom rather than a button lying about what the page will do.
 */

// --------------------------------------------------------------- the layouts

/**
 * A piece of a chapter opening, in the order it is met down the page. The
 * print walks this list, so a new layout is an entry here and nothing else.
 */
export const CHAPTER_SLOTS = ['sink', 'graphic', 'number', 'rule', 'title', 'epigraph', 'summary', 'body'] as const;
export type ChapterSlot = (typeof CHAPTER_SLOTS)[number];

export { CHAPTER_LAYOUT_IDS, FIRST_LINE_KINDS, type ChapterLayoutId, type FirstLine };

/**
 * How big the number is drawn. `normal` is the style's own size; the other
 * two are multiples of it, so a book that sets its chapter number in 18 pt
 * gets a flush-left opening in proportion rather than a fixed 54.
 */
export type NumberScale = 'normal' | 'large' | 'display';
export const NUMBER_SCALE: Record<NumberScale, number> = { normal: 1, large: 1.6, display: 2.7 };

/** Where the picture sits, or null where the layout has no graphic at all. */
export type GraphicPlace = 'top' | 'middle' | 'foot' | 'bleed' | 'page';

export interface ChapterLayout {
  id: ChapterLayoutId;
  /** What the writer picks it by. */
  name: string;
  /** One line under the name on the thumbnail, saying what it is for. */
  says: string;
  align: 'center' | 'left';
  slots: readonly ChapterSlot[];
  graphic: GraphicPlace | null;
  numberScale: NumberScale;
  /** A layout that shows the number and nothing else. */
  hideTitle: boolean;
  /** How far down the page the block sits is the picture's business here. */
  ignoresSink: boolean;
  /** The picture's width is the page's, so S/M/L means nothing. */
  ignoresGraphicSize: boolean;
  /** A rule between the number and the title. */
  rule: boolean;
  /**
   * The epigraph set apart, on its own measure with air round it.
   *
   * **Every layout carries the epigraph slot** and this is the one that gives
   * it prominence — because an epigraph is something the writer *typed on this
   * chapter*, and a layout that dropped it would lose their words for a reason
   * they never asked for. Whether a page has one is whether there is one to
   * print; this decides only how it is set.
   */
  epigraphApart: boolean;
}

const one = (
  id: ChapterLayoutId,
  name: string,
  says: string,
  slots: readonly ChapterSlot[],
  extra: Partial<ChapterLayout> = {},
): ChapterLayout => ({
  id,
  name,
  says,
  align: 'center',
  slots,
  graphic: null,
  numberScale: 'normal',
  hideTitle: false,
  ignoresSink: false,
  ignoresGraphicSize: false,
  rule: false,
  epigraphApart: false,
  ...extra,
});

/**
 * The eight of Ken's handoff, plus the whole-page art the book already had.
 *
 * `art` is **not** `full`: a bleeding header is a band across the top with the
 * heading set under it, and a page of art is the picture edge to edge with
 * nothing over it at all — the number and the name are painted into the
 * artwork. The book has drawn the second since `full_page`, and conflating
 * them would take that away.
 */
export const CHAPTER_LAYOUTS: readonly ChapterLayout[] = [
  one('classic', 'Classic sink', 'The heading, a third of the way down', [
    'sink',
    'number',
    'title',
    'epigraph',
    'summary',
    'body',
  ]),
  one('top', 'Graphic above', 'A device over the heading', ['sink', 'graphic', 'number', 'title', 'epigraph', 'summary', 'body'], {
    graphic: 'top',
  }),
  one('mid', 'Graphic between', 'A device under the heading', ['sink', 'number', 'title', 'graphic', 'epigraph', 'summary', 'body'], {
    graphic: 'middle',
  }),
  one(
    'bottom',
    'Graphic at foot',
    'A device at the bottom margin',
    ['sink', 'number', 'title', 'epigraph', 'summary', 'body', 'graphic'],
    { graphic: 'foot' },
  ),
  one('full', 'Bleeding header', 'A band of picture across the top', ['graphic', 'number', 'title', 'epigraph', 'summary', 'body'], {
    graphic: 'bleed',
    ignoresSink: true,
    ignoresGraphicSize: true,
  }),
  one('left', 'Flush left', 'A large number at the left margin', ['sink', 'number', 'rule', 'title', 'epigraph', 'summary', 'body'], {
    align: 'left',
    numberScale: 'large',
    rule: true,
  }),
  one('epi', 'With epigraph', 'A quotation given its own measure', ['sink', 'number', 'title', 'epigraph', 'summary', 'body'], {
    epigraphApart: true,
  }),
  one('bignum', 'Numeral only', 'The number alone, very large', ['sink', 'number', 'epigraph', 'summary', 'body'], {
    numberScale: 'display',
    hideTitle: true,
  }),
  one('art', 'A page of art', 'The picture is the page, edge to edge', ['graphic'], {
    graphic: 'page',
    ignoresSink: true,
    ignoresGraphicSize: true,
  }),
];

export const chapterLayout = (id: ChapterLayoutId): ChapterLayout =>
  CHAPTER_LAYOUTS.find((layout) => layout.id === id) ?? CHAPTER_LAYOUTS[0]!;

// ------------------------------------------------------- the older spelling

/**
 * What an existing book's `template` means as a layout. Nothing is migrated:
 * a page that has never been given a layout goes on being read this way, so
 * a book made before this draws exactly as it did.
 */
export const LAYOUT_OF_TEMPLATE: Record<ChapterTemplate, ChapterLayoutId> = {
  graphic_top: 'top',
  graphic_middle: 'mid',
  graphic_bottom: 'bottom',
  full_page: 'art',
};

/** The reverse, for the print stack's own template-shaped questions. */
export const TEMPLATE_OF_LAYOUT: Partial<Record<ChapterLayoutId, ChapterTemplate>> = {
  top: 'graphic_top',
  mid: 'graphic_middle',
  bottom: 'graphic_bottom',
  art: 'full_page',
};

// --------------------------------------------------------- the named steps

/**
 * How far down the page the block sits, as a share of the trim height. The
 * numbers are Ken's handoff's; what is stored is the **inches**, and which of
 * the three is lit is read back from them.
 */
export const CHAPTER_SINKS = [
  { id: 'shallow', label: 'Shallow', share: 0.03 },
  { id: 'standard', label: 'Standard', share: 0.12 },
  { id: 'deep', label: 'Deep', share: 0.23 },
] as const;
export type ChapterSink = (typeof CHAPTER_SINKS)[number]['id'];

/** The inches a named sink means on a page of this height. */
export const sinkInches = (sink: ChapterSink, pageHeight: number): number => {
  const found = CHAPTER_SINKS.find((step) => step.id === sink) ?? CHAPTER_SINKS[1];
  return Math.round(found.share * pageHeight * 16) / 16;
};

/**
 * Which step a stored drop is, or null for a depth the writer typed. Read
 * back rather than stored (§7), so a button is never lit over a page that
 * will print something else.
 */
export const sinkOf = (dropInches: number, pageHeight: number): ChapterSink | null =>
  CHAPTER_SINKS.find((step) => Math.abs(sinkInches(step.id, pageHeight) - dropInches) < 0.031)?.id ?? null;

/** How wide the picture draws, as a share of the text block. */
export const GRAPHIC_SIZES = [
  { id: 's', label: 'S', says: 'Small graphic', share: 26 },
  { id: 'm', label: 'M', says: 'Medium graphic', share: 45 },
  { id: 'l', label: 'L', says: 'Large graphic', share: 70 },
] as const;
export type GraphicSize = (typeof GRAPHIC_SIZES)[number]['id'];

export const graphicSizeOf = (width: number): GraphicSize | null =>
  GRAPHIC_SIZES.find((step) => Math.abs(step.share - width) < 1)?.id ?? null;

/**
 * What happens to the first line of the chapter (Ken's handoff §5). A drop
 * cap floats the first letter about three lines deep; a lead-in sets the
 * first few words in small capitals. Both are conventions and neither is a
 * default a book can be given without being asked, so the book chooses once.
 */
export const FIRST_LINES: ReadonlyArray<{ id: FirstLine; label: string; says: string }> = [
  { id: 'drop_cap', label: 'Drop cap', says: 'The first letter, three lines deep' },
  { id: 'lead_in', label: 'Small caps lead-in', says: 'The first few words in small capitals' },
  { id: 'plain', label: 'Neither', says: 'The paragraph as it stands' },
];

/** How many words a lead-in takes. Five is the convention and the handoff's. */
export const LEAD_IN_WORDS = 5;

// ------------------------------------------------------------- the settings

/**
 * The layout in force for a chapter: its own where it has one, the book's
 * otherwise, and the older `template` spelling where neither has been set.
 */
export const layoutOf = (
  style: Pick<ChapterPageStyle, 'layout' | 'template'>,
  marker: StoryMarker | null,
): ChapterLayoutId => {
  const page = marker?.page as { layout?: unknown; template?: unknown } | undefined;
  const own = page?.layout;
  if (typeof own === 'string' && (CHAPTER_LAYOUT_IDS as readonly string[]).includes(own)) return own as ChapterLayoutId;
  if (style.layout) return style.layout;
  // The older spelling: where the graphic sits, which is all a book used to
  // store. A page's own template beats the book's, as it always has.
  const ownTemplate = typeof page?.template === 'string' ? page.template : 'book';
  const template = ownTemplate !== 'book' ? ownTemplate : style.template;
  if ((CHAPTER_TEMPLATES as readonly string[]).includes(template)) {
    return LAYOUT_OF_TEMPLATE[template as ChapterTemplate];
  }
  return 'mid';
};

/**
 * The same, read off a project.
 *
 * `layoutOf` takes the **style** rather than the file on purpose: it is the
 * one thing `chapter-style.ts` calls back into this module for, and giving it
 * no runtime dependency of its own is what keeps the two modules from forming
 * a cycle. The acts below do import `chapter-style.js`, and that edge only
 * goes one way.
 */
export const chapterLayoutOf = (file: ProjectFile, marker: StoryMarker | null): ChapterLayoutId =>
  layoutOf(chapterPageStyleOf(file), marker);

/** How the first line of the chapter is set. The book's alone: it is a convention. */
export const firstLineOf = (file: ProjectFile): FirstLine => chapterPageStyleOf(file).firstLine;

export const setFirstLine = (file: ProjectFile, firstLine: FirstLine): ProjectFile =>
  setChapterPageStyle(file, { firstLine });

/**
 * Give one chapter its own layout, or the whole book one.
 *
 * **Setting a layout clears the template**, which is the whole of why the two
 * fields cannot disagree: the older spelling is read only where nothing newer
 * has been said. Naming no chapter writes the book's default and clears every
 * chapter's own, which is Ken's *all chapter openers* — and what makes that
 * safe to offer is that `chaptersOverriding` says first how many it would
 * clear.
 */
export const setChapterLayout = (
  file: ProjectFile,
  markerId: StoryMarkerId | null,
  layout: ChapterLayoutId,
): ProjectFile => {
  if (markerId === null) {
    const template = TEMPLATE_OF_LAYOUT[layout];
    const book = setChapterPageStyle(file, template ? { layout, template } : { layout });
    return {
      ...book,
      markers: book.markers.map((marker) =>
        marker.page ? { ...marker, page: { ...marker.page, layout: null, template: 'book' } } : marker,
      ),
    };
  }
  return {
    ...file,
    markers: file.markers.map((marker) =>
      marker.id === markerId ? { ...marker, page: { ...(marker.page ?? {}), layout, template: 'book' } } : marker,
    ),
    project: { ...file.project, updatedAt: nowIso() },
  };
};

/**
 * The chapters that would lose their own layout if the book's were set. Said
 * before the press rather than after it (the room's habit), because *all
 * chapter openers* is the one act here that reaches work somebody did.
 */
export const chaptersOverriding = (file: ProjectFile): StoryMarker[] =>
  file.markers.filter((marker) => {
    const page = marker.page as Record<string, unknown> | undefined;
    if (!page) return false;
    const own = page.layout;
    if (typeof own === 'string' && (CHAPTER_LAYOUT_IDS as readonly string[]).includes(own)) return true;
    return typeof page.template === 'string' && page.template !== 'book';
  });

/** What applying to every opener would take, in a sentence a writer can act on. */
export const describeApplyToAll = (file: ProjectFile, layout: ChapterLayoutId): string => {
  const held = chaptersOverriding(file);
  const name = chapterLayout(layout).name.toLowerCase();
  if (held.length === 0) return `Every chapter opens as ${name}. None of them is set on its own.`;
  return `Every chapter opens as ${name}. ${held.length === 1 ? 'One chapter is' : `${held.length} chapters are`} set on their own, and that goes.`;
};
