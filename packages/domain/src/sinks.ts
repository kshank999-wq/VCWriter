import { CHAPTER_SINKS, type ChapterSink } from './chapter-layouts.js';

/**
 * **How far down the page a block sits, named** (addendum 20 §17).
 *
 * `CHAPTER_SINKS` (§14) already holds Shallow, Standard and Deep and already
 * says what each means as a share of the page, so the back matter reads that
 * table rather than keeping a second one — the two would drift the first time
 * either was tuned. A chapter page stores its sink in **inches**, because it
 * is placing one block on one leaf; a back-matter page stores it in `drop`,
 * the **share** every designed page has carried since §7a. Same three steps,
 * two units, one table.
 *
 * It lives in a module of its own so `part-style` and `back-matter` can both
 * read it without either importing the other.
 */
export type Sink = ChapterSink | 'head';

/**
 * The four a back-matter page offers. **`head` is the fourth and the
 * handoff does not name it**: a prose part's `drop` has been stored and never
 * read, so making the sink a control could only move an existing foreword
 * unless *where it already is* were one of the answers. §7a's rule — a style
 * starts as exactly what the page prints — decides it.
 */
export const BACK_SINKS: ReadonlyArray<{ id: Sink; label: string }> = [
  { id: 'head', label: 'At the head' },
  ...CHAPTER_SINKS.map((step) => ({ id: step.id as Sink, label: step.label })),
];

/** What a named step means as a share of the page, which is what `drop` is. */
export const sinkDrop = (sink: Sink): number =>
  sink === 'head' ? 0 : Math.round((CHAPTER_SINKS.find((step) => step.id === sink) ?? CHAPTER_SINKS[1]).share * 100);

/**
 * Which step a page's drop is, or null for a depth set by hand — a
 * **reading**, so a button is never lit over a page that sits elsewhere
 * (`bookPresetOf`'s rule for the sixth time).
 */
export const backSinkOf = (style: { drop: number }): Sink | null =>
  BACK_SINKS.find((step) => sinkDrop(step.id) === style.drop)?.id ?? null;

export const sinkPatch = (sink: Sink): { drop: number } => ({ drop: sinkDrop(sink) });
