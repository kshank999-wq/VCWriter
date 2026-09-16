import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addChoice, addElement, addState, updateElement } from '../narrative.js';
import { initialState } from '../narrative-eval.js';
import {
  describeCell,
  describeEnding,
  describeMatrix,
  earnedEnding,
  endingBoard,
  endingStanding,
  endingsOf,
  isScored,
  outcomeMatrix,
  unreachableEndings,
} from '../narrative-endings.js';
import type { Condition, ConditionGroup, EndingContributor } from '../entities/narrative.js';
import type { PlayState } from '../narrative-eval.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Interactive Narrative, stage 8 (addendum 18 §11).
 *
 * Two claims. **A hard requirement is a condition and already existed**, so the
 * tests that matter are about the half that is new — the weights — and about
 * the two staying apart: a gate vetoes and a weight only ranks.
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

const all = (...conditions: Condition[]): ConditionGroup => ({ join: 'all', conditions, groups: [] });

const asks = (subjectId: string, op: Condition['op'], value: string): Condition => ({
  subject: 'state',
  subjectId,
  op,
  value,
});

const counts = (condition: Condition, weight: number): EndingContributor => ({ condition, weight, note: '' });

/** Two endings: one deterministic, one scored on trust and the engineer. */
const reactor = () => {
  let file = game();
  const trust = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
  file = trust.file;
  const spared = addState(file, { key: 'engineer_alive', kind: 'flag' });
  file = spared.file;

  const start = addElement(file, { name: 'Cold open' });
  file = start.file;

  const stays = addElement(file, { name: 'She stays' });
  file = updateElement(stays.file, stays.element.id, {
    kind: 'ending',
    contributors: [
      counts(asks(trust.state.id as string, 'at_least', '40'), 20),
      counts({ ...asks(spared.state.id as string, 'is', 'true') }, 10),
    ],
    threshold: 25,
  });

  const leaves = addElement(file, { name: 'She leaves' });
  file = updateElement(leaves.file, leaves.element.id, { kind: 'ending' });

  const buried = addElement(file, { name: 'Everyone dies' });
  file = updateElement(buried.file, buried.element.id, {
    kind: 'ending',
    conditions: all(asks(spared.state.id as string, 'is', 'false')),
  });

  // Joined up, because an ending nothing leads to is stage 3's finding rather
  // than this module's, and these tests are about the ones you can reach.
  for (const to of [stays.element.id, leaves.element.id, buried.element.id]) {
    file = addChoice(file, { elementId: start.element.id, toElementId: to }).file;
  }

  return {
    file,
    trustId: trust.state.id as string,
    sparedId: spared.state.id as string,
    stays: stays.element.id,
    leaves: leaves.element.id,
    buried: buried.element.id,
  };
};

const holding = (file: ProjectFile, values: Record<string, string>): PlayState => ({
  ...initialState(file),
  states: { ...initialState(file).states, ...values },
});

describe('what an ending is', () => {
  /** The audit: §7 called an EndingDefinition new and it already existed. */
  it('is a node, and not a second record', () => {
    const made = reactor();
    expect(made.file).not.toHaveProperty('endings');
    expect(made.file).not.toHaveProperty('endingDefinitions');
    expect(endingsOf(made.file).map((one) => one.name)).toEqual(['She stays', 'She leaves', 'Everyone dies']);
  });

  it('counts a node marked as ending here, whatever its kind says', () => {
    const made = addElement(game(), { name: 'The airlock' });
    expect(endingsOf(made.file)).toHaveLength(0);
    const marked = updateElement(made.file, made.element.id, { endsHere: true });
    expect(endingsOf(marked)).toHaveLength(1);
  });

  /** Read, never declared: no switch to set wrongly. */
  it('is scored because it has weights, not because somebody said so', () => {
    const made = reactor();
    const stays = endingsOf(made.file).find((one) => one.name === 'She stays')!;
    const leaves = endingsOf(made.file).find((one) => one.name === 'She leaves')!;
    expect(isScored(stays)).toBe(true);
    expect(isScored(leaves)).toBe(false);
    expect(stays).not.toHaveProperty('useScore');
  });
});

describe('a hard requirement and a weight are different things', () => {
  it('lets a gate veto, whatever the score says', () => {
    const made = reactor();
    // Everything that counts holds, but the gate refuses.
    const file = updateElement(made.file, made.stays, {
      conditions: all(asks(made.sparedId, 'is', 'true')),
    });
    const state = holding(file, { [made.trustId]: '90' });
    const standing = endingStanding(file, state, endingsOf(file).find((one) => one.name === 'She stays')!);

    expect(standing.score).toBe(20);
    expect(standing.allowed).toBe(false);
    expect(standing.earned).toBe(false);
    expect(describeEnding(standing)).toBe('Not possible here: engineer_alive is true.');
  });

  it('lets a weight rank without vetoing', () => {
    const made = reactor();
    const thin = endingStanding(made.file, holding(made.file, { [made.trustId]: '10' }), endingsOf(made.file)[0]!);
    expect(thin.allowed).toBe(true);
    expect(thin.score).toBe(0);
    expect(thin.earned).toBe(false);
    expect(describeEnding(thin)).toBe('0 of 25 needed.');
  });

  it('adds only the weights whose conditions hold', () => {
    const made = reactor();
    const warm = holding(made.file, { [made.trustId]: '40', [made.sparedId]: 'true' });
    const standing = endingStanding(made.file, warm, endingsOf(made.file)[0]!);
    expect(standing.score).toBe(30);
    expect(standing.earned).toBe(true);
    expect(standing.contributors.map((one) => one.met)).toEqual([true, true]);
    expect(describeEnding(standing)).toBe('Earned with 30 of 25 needed.');
  });

  it('takes a negative weight as counting against', () => {
    const made = reactor();
    const file = updateElement(made.file, made.stays, {
      contributors: [
        counts(asks(made.trustId, 'at_least', '40'), 20),
        counts(asks(made.sparedId, 'is', 'false'), -15),
      ],
      threshold: 10,
    });
    const state = holding(file, { [made.trustId]: '40' });
    const standing = endingStanding(file, state, endingsOf(file)[0]!);
    // The flag is unset, so *engineer_alive is false* holds and costs 15.
    expect(standing.score).toBe(5);
    expect(standing.earned).toBe(false);
    // What is *reachable* counts only what adds, or the bar would move as the
    // player loses ground.
    expect(standing.most).toBe(20);
  });

  it('earns an unscored ending on its gate alone', () => {
    const made = reactor();
    const standing = endingStanding(made.file, initialState(made.file), endingsOf(made.file)[1]!);
    expect(standing.earned).toBe(true);
    expect(describeEnding(standing)).toBe('Earned — nothing else is required.');
  });
});

describe('which ending the player gets', () => {
  it('ranks the earned ones first, then by score', () => {
    const made = reactor();
    const warm = holding(made.file, { [made.trustId]: '40', [made.sparedId]: 'true' });
    const board = endingBoard(made.file, warm);
    expect(board.map((one) => one.ending.name)).toEqual(['She stays', 'She leaves', 'Everyone dies']);
    // The buried ending's gate wants the engineer dead.
    expect(board[2]!.allowed).toBe(false);
  });

  it('picks, because a game has to', () => {
    const made = reactor();
    const warm = holding(made.file, { [made.trustId]: '40', [made.sparedId]: 'true' });
    expect(earnedEnding(made.file, warm).ending?.name).toBe('She stays');
  });

  /** A tie broken silently is the one a designer hears about from a player. */
  it('says when the pick was a tie rather than hiding it', () => {
    let file = game();
    const one = addElement(file, { name: 'One' });
    file = updateElement(one.file, one.element.id, { kind: 'ending' });
    const two = addElement(file, { name: 'Two' });
    file = updateElement(two.file, two.element.id, { kind: 'ending' });

    const earned = earnedEnding(file, initialState(file));
    expect(earned.ending?.name).toBe('One');
    expect(earned.tiedWith.map((other) => other.name)).toEqual(['Two']);
  });

  /** No ending is a real outcome, and usually means a rule nobody can meet. */
  it('says nothing is earned rather than reaching for the nearest', () => {
    const made = reactor();
    const file = updateElement(made.file, made.leaves, {
      conditions: all(asks(made.trustId, 'at_least', '900')),
    });
    const shut = updateElement(file, made.buried, { conditions: all(asks(made.trustId, 'at_least', '900')) });
    expect(earnedEnding(shut, initialState(shut)).ending).toBeNull();
  });
});

describe('the matrix', () => {
  /** §11: read off the rules, and never typed. */
  it('is a row per thing the endings mention', () => {
    const made = reactor();
    const matrix = outcomeMatrix(made.file);
    expect(matrix.endings.map((one) => one.name)).toEqual(['She stays', 'She leaves', 'Everyone dies']);
    expect(matrix.rows.map((one) => one.subject)).toEqual(['trust_mara', 'engineer_alive']);
    expect(describeMatrix(matrix)).toBe('3 endings · 1 scored · 2 things decide them.');
  });

  it('keeps a requirement and a weight apart in the same cell', () => {
    const made = reactor();
    const matrix = outcomeMatrix(made.file);
    const engineer = matrix.rows.find((one) => one.subject === 'engineer_alive')!;

    // She stays weights it; Everyone dies requires the other way.
    expect(describeCell(made.file, engineer.cells[0]!)).toBe('+10 if engineer_alive is true');
    expect(describeCell(made.file, engineer.cells[2]!)).toBe('needs engineer_alive is false');
    expect(describeCell(made.file, engineer.cells[1]!)).toBe('');
  });

  /** A rule stops mentioning it and the row goes, with nothing run. */
  it('loses a row when nothing asks about it any more', () => {
    const made = reactor();
    const file = updateElement(made.file, made.stays, { contributors: [] });
    const matrix = outcomeMatrix(file);
    expect(matrix.rows.map((one) => one.subject)).toEqual(['engineer_alive']);
  });

  it('says there are no endings rather than drawing an empty grid', () => {
    expect(describeMatrix(outcomeMatrix(game()))).toBe('No endings yet. A node marked as an ending is one.');
  });
});

describe('an ending no state can earn', () => {
  /**
   * Stage 3 finds an ending nothing *reaches*; this finds one nothing can
   * *satisfy*. A threshold above everything that counts towards it is a fact
   * rather than an opinion, and nothing else catches it.
   */
  it('is named, with the arithmetic', () => {
    const made = reactor();
    const file = updateElement(made.file, made.stays, { threshold: 100 });
    const found = unreachableEndings(file);
    expect(found).toHaveLength(1);
    expect(found[0]!.says).toBe(
      'She stays needs 100 and everything that counts towards it adds up to 30.',
    );
  });

  it('says nothing about one that can be earned', () => {
    expect(unreachableEndings(reactor().file)).toEqual([]);
  });

  /** An ending nothing reaches is stage 3's to say, and is not said twice. */
  it('leaves an unreachable ending to the validator', () => {
    let file = game();
    const trust = addState(file, { key: 'trust_mara', kind: 'number' });
    file = trust.file;
    file = addElement(file, { name: 'Cold open' }).file;
    const island = addElement(file, { name: 'She stays' });
    // Scored past what it can reach, and nothing leads to it: this check keeps
    // quiet and the validator says the reachable half.
    file = updateElement(island.file, island.element.id, {
      kind: 'ending',
      contributors: [counts(asks(trust.state.id as string, 'at_least', '1'), 5)],
      threshold: 100,
    });
    expect(unreachableEndings(file)).toEqual([]);
  });
});
