import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addChoice, addElement, addResource, addState, removeChoice, updateChoice, updateElement } from '../narrative.js';
import {
  compareRuns,
  describeComparison,
  describeRun,
  findRun,
  holdings,
  recordStep,
  removeRun,
  replayRun,
  runsOf,
  startPoints,
  startRun,
  stepBack,
} from '../narrative-run.js';
import type { Condition, ConditionGroup, Effect } from '../entities/narrative.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Interactive Narrative, stage 7 (addendum 18 §13).
 *
 * The stage decides one thing: **a run stores the choices and never the
 * states**. So the test that carries it is the one where the graph changes
 * under a saved path — which is the feature rather than the limitation, since
 * nothing else in the module can say *the route I walked last week has stopped
 * working*.
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

const all = (...conditions: Condition[]): ConditionGroup => ({ join: 'all', conditions, groups: [] });

const effect = (one: Partial<Effect> & Pick<Effect, 'kind' | 'targetId'>): Effect => ({
  value: '',
  timing: 'immediate',
  note: '',
  ...one,
});

/** The desk gives a keycard; the door wants one; beyond it, two endings. */
const reactor = () => {
  let file = game();
  const card = addResource(file, { name: 'Keycard', kind: 'key_item', initial: 0 });
  file = card.file;
  const trust = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
  file = trust.file;

  const desk = addElement(file, { name: 'The desk' });
  file = desk.file;
  const door = addElement(file, { name: 'The server door' });
  file = door.file;
  file = updateElement(file, door.element.id, {
    conditions: all({ subject: 'resource', subjectId: card.resource.id as string, op: 'at_least', value: '1' }),
  });
  const stays = addElement(file, { name: 'She stays' });
  file = updateElement(stays.file, stays.element.id, { kind: 'ending' });
  const leaves = addElement(file, { name: 'She leaves' });
  file = updateElement(leaves.file, leaves.element.id, { kind: 'ending' });

  const take = addChoice(file, { elementId: desk.element.id, name: 'Take the keycard', toElementId: door.element.id });
  file = updateChoice(take.file, take.choice.id, {
    effects: [effect({ kind: 'grant', targetId: card.resource.id as string, value: '1' })],
  });
  const ignore = addChoice(file, { elementId: desk.element.id, name: 'Leave it', toElementId: door.element.id });
  file = ignore.file;

  const warm = addChoice(file, { elementId: door.element.id, name: 'Tell her the truth', toElementId: stays.element.id });
  file = updateChoice(warm.file, warm.choice.id, {
    effects: [effect({ kind: 'add', targetId: trust.state.id as string, value: '40' })],
  });
  const cold = addChoice(file, { elementId: door.element.id, name: 'Say nothing', toElementId: leaves.element.id });
  file = cold.file;

  return {
    file,
    desk: desk.element.id,
    door: door.element.id,
    take: take.choice.id,
    ignore: ignore.choice.id,
    warm: warm.choice.id,
    cold: cold.choice.id,
    cardId: card.resource.id,
    trustId: trust.state.id,
  };
};

const walk = (file: ProjectFile, steps: readonly string[], startedAt?: Parameters<typeof startRun>[1]) => {
  const begun = startRun(file, startedAt)!;
  let next = begun.file;
  for (const choiceId of steps) next = recordStep(next, begun.run.id, choiceId as never).file;
  return { file: next, runId: begun.run.id };
};

describe('walking a path', () => {
  it('records the choices and works the state out from them', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take, made.warm]);

    const played = replayRun(file, findRun(file, runId)!);
    expect(played.steps.map((one) => one.choice?.name)).toEqual(['Take the keycard', 'Tell her the truth']);
    expect(played.at?.name).toBe('She stays');
    expect(played.state.resources[made.cardId as string]).toBe(1);
    expect(played.state.states[made.trustId as string]).toBe('40');
    expect(played.brokenAt).toBeNull();
  });

  /** §16.2's *log every state mutation during simulation*. */
  it('keeps what each step changed, in order', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take, made.warm]);
    const played = replayRun(file, findRun(file, runId)!);
    expect(played.steps[0]!.log.map((one) => one.says)).toEqual(['Keycard 0 → 1']);
    expect(played.steps[1]!.log.map((one) => one.says)).toEqual(['trust_mara 0 → 40']);
  });

  it('stores no state anywhere on the run', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take]);
    const run = findRun(file, runId)!;
    expect(run.steps).toEqual([made.take]);
    for (const absent of ['state', 'states', 'resources', 'log', 'endedAt']) {
      expect(run).not.toHaveProperty(absent);
    }
  });

  it('takes a step back by dropping the choice', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take, made.warm]);
    const back = stepBack(file, runId);
    const played = replayRun(back, findRun(back, runId)!);
    expect(played.steps).toHaveLength(1);
    expect(played.at?.name).toBe('The server door');
    // And back again past the start changes nothing rather than throwing.
    expect(runsOf(stepBack(stepBack(stepBack(back, runId), runId), runId))[0]!.steps).toEqual([]);
  });

  /** §13's *start at any node*: testing act three should not mean walking one. */
  it('starts anywhere the designer points at', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.warm], { startedAt: made.door });
    const played = replayRun(file, findRun(file, runId)!);
    expect(played.steps[0]!.from.name).toBe('The server door');
    expect(played.at?.name).toBe('She stays');
    // The list offers every node, entries first.
    expect(startPoints(made.file)[0]!.name).toBe('The desk');
    expect(startPoints(made.file)).toHaveLength(4);
  });

  it('refuses to start where there is nothing', () => {
    expect(startRun(game())).toBeNull();
  });
});

describe('a path that stops working', () => {
  /**
   * The whole reason a run is stored. The designer takes the keycard out of
   * the desk; the route that walked through the door no longer walks.
   */
  it('breaks where the graph moved, and says which step', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take, made.warm]);
    expect(replayRun(file, findRun(file, runId)!).brokenAt).toBeNull();

    // The keycard is no longer handed over.
    const edited = updateChoice(file, made.take, { effects: [] });
    const played = replayRun(edited, findRun(edited, runId)!);

    // The very first step is the one that breaks: the door is gated on the
    // keycard, and the choice that walked through it no longer hands one over.
    expect(played.brokenAt).toBe(0);
    expect(played.steps[0]!.refused.map((one) => one.says)).toEqual(['Keycard is at least 1']);
    expect(describeRun(edited, findRun(edited, runId)!)).toBe('2 choices — stops working at step 1.');
  });

  it('says so plainly when the choice itself has been cut', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take, made.warm]);
    const edited = removeChoice(file, made.warm);
    const played = replayRun(edited, findRun(edited, runId)!);
    expect(played.brokenAt).toBe(1);
    expect(played.steps[1]!.refused[0]!.says).toBe('that choice has been cut from the game');
  });

  /**
   * It stops rather than guessing on. Everything after the break was chosen in
   * a game that no longer exists, and carrying on would put a state on the
   * screen no player could hold.
   */
  it('does not walk past the break', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take, made.warm]);
    // The keycard stops being handed over, so the first step breaks and the
    // second is never attempted.
    const edited = updateChoice(file, made.take, { effects: [] });
    const played = replayRun(edited, findRun(edited, runId)!);
    expect(played.brokenAt).toBe(0);
    expect(played.steps).toHaveLength(1);
    expect(played.at?.name).toBe('The desk');
  });

  /**
   * A move that is refused did not happen, so it is not written down. The
   * alternative is a path that is broken from the moment it was walked.
   */
  it('refuses to record a step the player could not take', () => {
    const made = reactor();
    const begun = startRun(made.file)!;
    const tried = recordStep(begun.file, begun.run.id, made.ignore);
    expect(tried.refused.map((one) => one.says)).toEqual(['Keycard is at least 1']);
    expect(findRun(tried.file, begun.run.id)!.steps).toEqual([]);
  });

  it('survives the node it started at being deleted', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take]);
    const edited = { ...file, narrativeElements: [] } as ProjectFile;
    const played = replayRun(edited, findRun(edited, runId)!);
    expect(played.at).toBeNull();
    expect(played.brokenAt).toBe(0);
    expect(describeRun(edited, findRun(edited, runId)!)).toContain('the node it started at has gone');
  });
});

describe('what the player is holding', () => {
  it('lists everything defined and marks what has moved', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take]);
    const played = replayRun(file, findRun(file, runId)!);
    const held = holdings(file, played.state);

    expect(held.map((one) => one.subject)).toEqual(['trust_mara', 'Keycard']);
    expect(held.find((one) => one.subject === 'Keycard')).toEqual({ subject: 'Keycard', value: '1', moved: true });
    // A flag still at its start is information too, so it is listed unmoved.
    expect(held.find((one) => one.subject === 'trust_mara')!.moved).toBe(false);
  });
});

describe('two paths side by side', () => {
  it('says where they part and what the player is left holding', () => {
    const made = reactor();
    const one = walk(made.file, [made.take, made.warm]);
    const two = walk(one.file, [made.take, made.cold]);

    const comparison = compareRuns(two.file, findRun(two.file, one.runId)!, findRun(two.file, two.runId)!);
    expect(comparison.shared).toBe(1);
    expect(comparison.divergedAt).toBe(1);
    expect(comparison.leftEnd?.name).toBe('She stays');
    expect(comparison.rightEnd?.name).toBe('She leaves');
    expect(comparison.differences).toEqual([{ subject: 'trust_mara', left: '40', right: '0' }]);
    expect(describeComparison(comparison)).toBe(
      'They part at step 2. One finishes at She stays, the other at She leaves. 1 thing differ at the end.',
    );
  });

  it('knows one path is the beginning of another', () => {
    const made = reactor();
    const one = walk(made.file, [made.take]);
    const two = walk(one.file, [made.take, made.warm]);
    const comparison = compareRuns(two.file, findRun(two.file, one.runId)!, findRun(two.file, two.runId)!);
    expect(comparison.divergedAt).toBeNull();
    expect(describeComparison(comparison)).toContain('One is the first 1 of the other');
  });

  it('says when two different routes leave the player the same', () => {
    const made = reactor();
    const one = walk(made.file, [made.take, made.cold]);
    const two = walk(one.file, [made.take, made.cold]);
    const comparison = compareRuns(two.file, findRun(two.file, one.runId)!, findRun(two.file, two.runId)!);
    expect(describeComparison(comparison)).toContain('The player ends up holding the same things');
  });
});

describe('keeping the paths', () => {
  it('names one, and takes one away', () => {
    const made = reactor();
    const begun = startRun(made.file, { name: 'The honest route' })!;
    expect(findRun(begun.file, begun.run.id)!.name).toBe('The honest route');
    expect(runsOf(removeRun(begun.file, begun.run.id))).toEqual([]);
  });

  it('describes a finished path by where it ends', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take, made.warm]);
    expect(describeRun(file, findRun(file, runId)!)).toBe('2 choices — ends at She stays.');
  });

  it('describes an unfinished one as stopping rather than ending', () => {
    const made = reactor();
    const { file, runId } = walk(made.file, [made.take]);
    expect(describeRun(file, findRun(file, runId)!)).toBe('1 choice — stops at The server door.');
  });
});
