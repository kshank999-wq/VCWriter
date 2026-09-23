import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addResearchItem,
  createProjectFile,
  isWritersAct,
  recordWriting,
  remember,
  shapeOf,
  UNDO_STEPS,
  unitsInStoryOrder,
  updateBeat,
  type HistoryStep,
  type ProjectFile,
} from '../index.js';

/**
 * Undo, for everything (addendum 02 §6c, from Ken: *everything you do needs to
 * be able to undo using control plus Z, back at least 10 steps*).
 *
 * The stack itself is three lines in the renderer. What is worth testing is
 * the two rules that decide **what a step is**: that the writing clock's own
 * ticks are not the writer's acts, and that a burst of typing is one step
 * while an act that follows it a tenth of a second later is its own.
 */

const project = (): ProjectFile => {
  const file = createProjectFile({ title: 'The Lamp', format: 'novel' });
  const unit = unitsInStoryOrder(file)[0]!;
  const made = addBeat(file, { unitId: unit.id, title: 'first' });
  return made.file;
};

const typed = (file: ProjectFile, text: string): ProjectFile =>
  updateBeat(file, file.beats[0]!.id, {
    manuscript: { elements: [{ id: 'p1' as never, type: 'paragraph', text, characterId: null, attributes: {} }] },
  });

describe('what counts as a step', () => {
  it('is not the writing clock writing itself down', () => {
    const file = project();
    const ticked = recordWriting(file, new Date().toISOString());
    // The clock really did change the document…
    expect(ticked).not.toBe(file);
    expect(ticked.sessions.length).toBeGreaterThan(file.sessions.length);
    // …and it is still not something the writer can take back. Without this
    // a step lands in the middle of a paragraph once a minute, and the redo
    // stack is thrown away while somebody is typing.
    expect(isWritersAct(file, ticked)).toBe(false);

    // Anything they did themselves is.
    expect(isWritersAct(file, typed(file, 'The bell again.'))).toBe(true);
    expect(isWritersAct(file, addResearchItem(file, { categoryId: file.researchCategories[0]!.id, title: 'A note' }))).toBe(true);
    expect(isWritersAct(file, file)).toBe(false);
  });

  /**
   * The counts are found rather than listed, so a module built tomorrow is
   * covered on the day it is written. This asserts the deriving rather than a
   * particular list, which a list-based reading could not pass.
   */
  it('counts every collection the project holds, without being told which', () => {
    const file = project();
    const shape = shapeOf(file);
    for (const [key, value] of Object.entries(file as unknown as Record<string, unknown>)) {
      if (!Array.isArray(value) || key === 'sessions' || key === 'snapshots') continue;
      expect(shape).toContain(`${key}:${value.length}`);
    }
    // And the manuscript's own length, so a new line is an act.
    expect(shape).toContain('elements:');
  });
});

describe('folding a burst of typing', () => {
  const at = 1_000_000;

  it('is one step, and keeps the document the run began at', () => {
    const one = project();
    const two = typed(one, 'The');
    const three = typed(two, 'The bell');
    const four = typed(three, 'The bell again.');

    let past: HistoryStep[] = [];
    past = remember(past, one, two, at);
    past = remember(past, two, three, at + 120);
    past = remember(past, three, four, at + 240);

    expect(past).toHaveLength(1);
    // The earliest, not the latest: undo takes the sentence, not its last
    // letter. A fold that replaced the step would leave *The bell* behind.
    expect(past[0]!.file).toBe(one);
  });

  it('starts a new step once the writer has stopped for a moment', () => {
    const one = project();
    const two = typed(one, 'The');
    const three = typed(two, 'The bell');
    let past: HistoryStep[] = [];
    past = remember(past, one, two, at);
    past = remember(past, two, three, at + 5_000);
    expect(past).toHaveLength(2);
  });

  /**
   * The case a plain timer gets wrong, and gets wrong exactly when a writer
   * most wants their act back: a merge pressed a tenth of a second after the
   * last keystroke is still a merge.
   */
  it('never folds an act into the typing before it, however fast it followed', () => {
    const one = project();
    const two = typed(one, 'The bell');
    const three = addBeat(two, { unitId: unitsInStoryOrder(two)[0]!.id, title: 'second' }).file;

    let past: HistoryStep[] = [];
    past = remember(past, one, two, at);
    past = remember(past, two, three, at + 10);

    expect(past).toHaveLength(2);
    expect(past[1]!.file).toBe(two);
    expect(shapeOf(two)).not.toBe(shapeOf(three));
  });

  it('goes back further than Ken asked, and stops somewhere', () => {
    expect(UNDO_STEPS).toBeGreaterThanOrEqual(10);
    const file = project();
    let past: HistoryStep[] = [];
    for (let step = 0; step < UNDO_STEPS + 20; step += 1) {
      // Far enough apart that nothing folds, and a real act each time.
      const after = addBeat(file, { unitId: unitsInStoryOrder(file)[0]!.id }).file;
      past = remember(past, file, after, at + step * 10_000);
    }
    expect(past).toHaveLength(UNDO_STEPS);
  });
});
