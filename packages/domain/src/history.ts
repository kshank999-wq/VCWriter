import type { ProjectFile } from './project-file.js';

/**
 * Undo, for everything (addendum 02 §6c, from Ken: *everything you do needs to
 * be able to undo using control plus Z, back at least 10 steps*).
 *
 * The whole of it rests on one fact about this program: **every change to the
 * document is a pure function of the document**, and every one of them goes
 * through the same `update`. So the step before an act *is the document before
 * it*, and undo is a stack of documents rather than a stack of inverses. No
 * module has to know undo exists, nothing has to describe how to take itself
 * back, and an act built tomorrow is undoable the day it is written — which is
 * the only way *everything you do* can be true rather than a list somebody
 * maintains.
 *
 * Keeping whole documents is cheap here for the same reason: a mutation
 * rebuilds the collection it touches and shares everything else, so fifty
 * steps is fifty small spines over one set of beats.
 */

/**
 * How far back it goes. Ken asked for ten; this is the depth a writer who has
 * been rearranging for a few minutes actually wants, and it costs almost
 * nothing.
 */
export const UNDO_STEPS = 50;

/**
 * How long a burst of typing goes on being the same step, in milliseconds.
 * Long enough that a sentence is one undo, short enough that a pause between
 * thoughts is a place to come back to.
 */
export const TYPING_WINDOW = 700;

export interface HistoryStep {
  /** The document as it stood **before** the act this step undoes. */
  file: ProjectFile;
  /** When the step was last written to, for folding a burst of typing into one. */
  at: number;
}

/**
 * The collections the program writes by itself. A change to nothing but these
 * is not something the writer did, so it is not something they can undo — and
 * without this the writing clock's once-a-minute tick would drop an undo step
 * into the middle of a paragraph and throw away the redo stack while somebody
 * typed.
 */
const BOOKKEEPING = new Set(['sessions', 'snapshots']);

/**
 * Whether the writer did this.
 *
 * Every mutation rebuilds the collection it touches and shares the rest, so
 * the top-level references answer it exactly and in a few dozen comparisons.
 * It is derived rather than listed, so a module built tomorrow is covered on
 * the day it is written.
 */
export const isWritersAct = (before: ProjectFile, after: ProjectFile): boolean => {
  if (before === after) return false;
  const one = before as unknown as Record<string, unknown>;
  const other = after as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(one), ...Object.keys(other)])) {
    if (BOOKKEEPING.has(key)) continue;
    if (one[key] !== other[key]) return true;
  }
  return false;
};

/**
 * The shape of the project: how many of each thing it holds.
 *
 * This is what tells **typing** from an **act**. Typing changes words and
 * nothing else; adding, removing, splitting, joining or dividing anything
 * changes one of these counts. So a burst of typing folds into one step, and
 * an act is always a step of its own however fast it followed the typing —
 * which is the case a plain timer gets wrong, and gets wrong exactly when a
 * writer most wants their merge back.
 *
 * Every array the project holds is counted, found rather than listed, for
 * `isWritersAct`'s reason: a list of collections is a list somebody has to
 * keep in step, and the one they forget is the module whose acts stop being
 * their own undo step.
 */
export const shapeOf = (file: ProjectFile): string => {
  const held = file as unknown as Record<string, unknown>;
  const counts = Object.keys(held)
    .sort()
    .filter((key) => !BOOKKEEPING.has(key) && Array.isArray(held[key]))
    .map((key) => `${key}:${(held[key] as unknown[]).length}`);
  // The manuscript's own length, so a new line or a cut one is an act while
  // typing inside a line is not.
  const elements = file.beats.reduce((count, beat) => count + beat.manuscript.elements.length, 0);
  return [...counts, `elements:${elements}`].join(',');
};

/**
 * Write a step for an act that has just happened.
 *
 * Folding **keeps the earliest** of a run rather than the latest: a writer who
 * types a sentence and presses undo wants the sentence gone, not its last
 * letter. So a fold refreshes when the run was last written to and leaves the
 * document it holds alone.
 */
export const remember = (
  past: readonly HistoryStep[],
  before: ProjectFile,
  after: ProjectFile,
  at: number,
  window = TYPING_WINDOW,
): HistoryStep[] => {
  const last = past[past.length - 1];
  if (last && at - last.at < window && shapeOf(before) === shapeOf(after)) {
    return [...past.slice(0, -1), { file: last.file, at }];
  }
  return [...past, { file: before, at }].slice(-UNDO_STEPS);
};
