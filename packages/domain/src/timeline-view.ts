import { nounsFor } from './formats.js';
import { placedMarkers } from './markers.js';
import type { ProjectFile } from './project-file.js';
import { unitsInStoryOrder } from './selectors.js';
import type { StorySpan } from './story-layout.js';
import { spanWidth } from './story-layout.js';

/**
 * **How far the timeline and the tracks zoom, and what a block says when it
 * is too small to read** (addendum 02 §4d, from Ken: *the zoom needs to be
 * able to compress it even more… all the way down to where you can see
 * everything on the screen. And then you can zoom it all the way out to where
 * it's really big, to where you can see all the beats. Right now, you can
 * make the beats stretch way out, which is not needed… And when you hover
 * over, it'll give you the chapter*).
 *
 * ## What was measured
 *
 * The slider ran **40 to 600 pixels a page** at both ends of the workspace,
 * and three things made the compressed end useless:
 *
 * - `spanWidth` put a **fixed 40-pixel floor** under every scene, so forty
 *   chapters could not be drawn in less than 1,600 pixels however far the
 *   slider went — in a 773-pixel stage, *everything on the screen* was
 *   arithmetically impossible.
 * - the tracks widened a scene to hold its **beat columns at 132 pixels
 *   each**, a floor that did not scale with the zoom at all, so a scene with
 *   six beats could not be drawn narrower than 408 pixels at any zoom.
 * - and 600 a page is a scene two screens wide, which is the stretch he says
 *   is not needed.
 *
 * So this is not a new mechanism; it is the **range being wrong at both
 * ends** and two floors that do not belong at the compressed one.
 */

// ---------------------------------------------------------------------------
// The range
// ---------------------------------------------------------------------------

/**
 * **The compressed end is a map rather than a reading.** Four pixels a page
 * draws a four-hundred-page novel in sixteen hundred, which is a long book on
 * one screen — nothing on it is legible and nothing is meant to be, which is
 * what the hover is for.
 */
export const ZOOM_FLOOR = 4;

/**
 * **The expanded end stops where the beats are read.** A beat column is 132
 * pixels, a scene of a novel runs two or three pages, so around 240 a page
 * every beat of an ordinary scene stands at its full width — past that the
 * block is stretched beyond what its beats need and the extra is white.
 * Ken's *you just need to be able to read them*.
 */
export const ZOOM_CEILING = 240;

export const clampZoom = (zoom: number): number =>
  Math.min(ZOOM_CEILING, Math.max(ZOOM_FLOOR, Math.round(zoom)));

/**
 * **The size that fits is a reading** (addendum 20 §9e, in a fourth room; and
 * addendum 15 §15's *whole story means the whole story fits*).
 *
 * What fits depends on the book and on the window, so it is worked out from
 * the measured stage every time rather than stored — widen the pane, or
 * write another chapter, and *Fit* means something else with nothing run.
 *
 * `across` is the room left for the blocks once the sticky head and whatever
 * the stage reserves are taken off. A book too long to fit even at the floor
 * lands on the floor, which is as near as the screen can come and is still
 * the most of it anybody can be shown.
 */
export const fitZoom = (spans: readonly StorySpan[], across: number): number => {
  if (spans.length === 0 || across <= 0) return ZOOM_CEILING;
  const pages = spans.reduce((total, span) => total + Math.max(span.pages, 0.5), 0);
  if (pages <= 0) return ZOOM_CEILING;
  return clampZoom(Math.floor(across / pages));
};

/** Whether a zoom is the one that fits, within the rounding. */
export const fitsAt = (zoom: number, spans: readonly StorySpan[], across: number): boolean =>
  Math.abs(clampZoom(zoom) - fitZoom(spans, across)) <= 1;

// ---------------------------------------------------------------------------
// When the beats stop being chips
// ---------------------------------------------------------------------------

/**
 * **A beat is a chip while there is room for one and a tick when there is
 * not.**
 *
 * The tracks widened a scene to hold its beat columns, which is right while a
 * writer is reading beats and is exactly what stopped the board compressing.
 * Below this the block takes its page width alone and the beats are drawn as
 * marks — still every beat, still in order, still carrying its colour and its
 * status, and still answering the hover (§4c), which is the half that makes a
 * compressed board usable rather than merely small.
 *
 * **It is read off the block's own width rather than off the zoom**, which
 * the first draft got wrong and driving the real board caught: a global
 * threshold is a claim that every scene is the same length, and on a novel
 * imported a chapter to a section an 8-page block drew ticks at a zoom where
 * it had three hundred pixels to spare. A long chapter showing its beats
 * beside a two-line scene showing ticks is not two vocabularies, it is the
 * truth about the two of them.
 *
 * The width it asks about is the scene's **page** width, before the tracks'
 * own beat floor is applied — or the question would answer itself.
 */
export const BEAT_CHIP_MIN = 90;

export const beatsAreChips = (spanPixels: number): boolean => spanPixels >= BEAT_CHIP_MIN;

/**
 * How wide a beat chip may be drawn, whatever room the block has.
 *
 * Ken's *right now, you can make the beats stretch way out, which is not
 * needed. You just need to be able to read them*: measured at the top of the
 * slider a single beat was **2,089 pixels** across, one chip filling a
 * chapter. A block scales with its pages because that is the axis; **a chip
 * is a chip**, and past a couple of hundred pixels there is nothing more of
 * it to read.
 */
export const BEAT_CHIP_MAX = 180;

// ---------------------------------------------------------------------------
// What it is, when you cannot read it
// ---------------------------------------------------------------------------

/**
 * Which division a scene falls in — *the chapter*, in Ken's words — read as
 * the marker at or before it in the story order, which is `divisionSpan`'s
 * own rule seen from the other end. Null before the first marker, a scene
 * standing in front of chapter one being in no chapter rather than in a
 * made-up one.
 */
export const divisionAt = (file: ProjectFile, unitId: string): string | null => {
  const order = unitsInStoryOrder(file);
  const index = order.findIndex((unit) => (unit.id as string) === unitId);
  if (index === -1) return null;
  const marked = placedMarkers(file).filter((one) => one.unitIndex <= index);
  const nearest = marked[marked.length - 1];
  if (!nearest) return null;
  const title = nearest.marker.title.trim();
  if (nearest.label && title) return `${nearest.label} — ${title}`;
  return nearest.label || title || null;
};

/**
 * **What this block is, for a hover** (Ken: *if it's too compressed to see
 * it, if you hover over it, it will give you that chapter heading*).
 *
 * The chapter first, because that is what he asked for and what a compressed
 * board loses first; then what the scene is called, in the format's own noun.
 * The keys follow, because §4c's rule is **one hover, one answer** — the
 * block's title said how to click it and nothing about what it was, so a
 * second tooltip beside this one would be the fault that section removed.
 */
export const describeSpanAt = (file: ProjectFile, unitId: string, keys?: string): string => {
  const nouns = nounsFor(file.project.format);
  const unit = unitsInStoryOrder(file).find((one) => (one.id as string) === unitId);
  const name = unit?.title.trim() ?? '';
  const where = divisionAt(file, unitId);
  /**
   * **Not the same name twice.** On a novel a chapter marker sits on the
   * unit the chapter opens with, and that unit is called what the chapter is
   * called — so the first draft read *Chapter 3 — Lantern · Chapter:
   * Lantern*, one answer said twice on one line, which is addendum 28 §4a's
   * fault in a tooltip. Where the division already names it, the division
   * line is the whole of it.
   */
  const named = name.length > 0 ? name : 'Untitled';
  const repeats = Boolean(where) && name.length > 0 && where!.toLowerCase().endsWith(name.toLowerCase());
  const said = [where, repeats ? null : `${nouns.unit}: ${named}`]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  return keys ? `${said} · ${keys}` : said;
};

/** How wide a scene is drawn at a zoom, before the tracks' own beat floor. */
export const spanAt = (span: StorySpan, zoom: number): number => spanWidth(span, zoom);
