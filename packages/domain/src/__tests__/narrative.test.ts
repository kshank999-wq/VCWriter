import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { isInteractive, isProseFormat, nounsFor } from '../formats.js';
import { hasChapterPages } from '../markers.js';
import { hasBookIndex } from '../book-index.js';
import {
  addChoice,
  addElement,
  addResource,
  addState,
  allConditions,
  choicesAt,
  choicesInto,
  elementsOf,
  entryPoints,
  gameSetupOf,
  hasNarrative,
  removeElement,
  removeResource,
  removeState,
  setGameSetup,
  spine,
  statesOf,
  updateChoice,
  updateElement,
  updateState,
} from '../narrative.js';
import { emptyConditions } from '../entities/narrative.js';
import { newId } from '../ids.js';
import type { BeatId } from '../ids.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Interactive Narrative, stages 0 and 1 (addendum 18).
 *
 * The tests worth having are the ones that hold the addendum's decisions down:
 * a choice is not an edge (§2), state is named once by id (§6), and the format
 * is a game without being a second kind of project (§7).
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

describe('the format', () => {
  it('is a game, and is written as a script', () => {
    expect(isInteractive('game')).toBe(true);
    // A game's manuscript is sluglines, cues and dialogue. What is different
    // about it is the graph over the scenes, not how a line is set.
    expect(isProseFormat('game')).toBe(false);
    expect(nounsFor('game').unit).toBe('Scene');
    expect(nounsFor('game').sub).toBe('Beat');
    expect(nounsFor('game').work).toBe('Game');
  });

  it('claims nothing that belongs to a book', () => {
    expect(hasChapterPages('game')).toBe(false);
    expect(hasBookIndex('game')).toBe(false);
  });

  it('leaves every other format exactly as it was', () => {
    expect(isInteractive('screenplay')).toBe(false);
    expect(isInteractive('instructional')).toBe(false);
    expect(nounsFor('screenplay').work).toBe('Script');
  });

  it('gives the graph to a game and to nothing else', () => {
    expect(hasNarrative(game())).toBe(true);
    expect(hasNarrative(createProjectFile({ title: 'A Script', format: 'screenplay' }))).toBe(false);
  });
});

describe('what the designer says the game is', () => {
  it('reads as an empty setup before anybody has said anything', () => {
    expect(gameSetupOf(game()).gameType).toBe('');
  });

  it('keeps the other fields when one is written', () => {
    const told = setGameSetup(setGameSetup(game(), { gameType: 'RPG' }), { stakes: 'The colony' });
    expect(gameSetupOf(told).gameType).toBe('RPG');
    expect(gameSetupOf(told).stakes).toBe('The colony');
  });

  /** §2 of the addendum: the milestones are markers and the premise is the logline. */
  it('holds nothing the project already holds', () => {
    const setup = gameSetupOf(game());
    for (const absent of ['premise', 'milestones', 'climax', 'resolution', 'mandatoryNodes']) {
      expect(setup).not.toHaveProperty(absent);
    }
  });
});

describe('a choice is not an edge', () => {
  /**
   * The decision the module rests on (§2). A choice may change the world and
   * leave the player where they were — which is what makes §5's delayed and
   * cumulative consequences expressible at all.
   */
  it('lets a choice have effects and nowhere to go', () => {
    const made = addElement(game(), { name: 'The reactor' });
    const choice = addChoice(made.file, { elementId: made.element.id, name: 'Examine the panel' });
    expect(choice.choice.toElementId).toBeNull();
    expect(choicesAt(choice.file, made.element.id)).toHaveLength(1);
  });

  it('makes convergence two edges into one node, with no word for it', () => {
    let file = game();
    const start = addElement(file, { name: 'Start' });
    file = start.file;
    const left = addElement(file, { name: 'Left' });
    file = left.file;
    const right = addElement(file, { name: 'Right' });
    file = right.file;
    const after = addElement(file, { name: 'The bridge' });
    file = after.file;

    file = addChoice(file, { elementId: left.element.id, toElementId: after.element.id }).file;
    file = addChoice(file, { elementId: right.element.id, toElementId: after.element.id }).file;

    // Two ways in. Nothing in the module had to be told what convergence is.
    expect(choicesInto(file, after.element.id)).toHaveLength(2);
  });

  it('has no edge record anywhere — the destination is on the choice', () => {
    const made = addElement(game(), { name: 'Start' });
    expect(made.file).not.toHaveProperty('narrativeEdges');
    expect(Object.keys(made.element)).not.toContain('toElementId');
  });
});

describe('where the player starts', () => {
  it('makes the first node an entry, because a graph with none is all dark', () => {
    const made = addElement(game(), { name: 'Cold open' });
    expect(made.element.entry).toBe(true);
    const second = addElement(made.file, { name: 'The corridor' });
    expect(second.element.entry).toBe(false);
    expect(entryPoints(second.file)).toHaveLength(1);
  });

  it('takes the designer’s word over that', () => {
    const made = addElement(game(), { name: 'Cold open', entry: false });
    expect(made.element.entry).toBe(false);
  });
});

describe('taking a node away', () => {
  /**
   * The designer wrote that choice. Deleting it because its destination went
   * is the tool throwing work away; clearing where it led is not.
   */
  it('keeps a choice that led there, with nowhere to go', () => {
    let file = game();
    const start = addElement(file, { name: 'Start' });
    file = start.file;
    const doomed = addElement(file, { name: 'The tunnel' });
    file = doomed.file;
    const made = addChoice(file, { elementId: start.element.id, name: 'Take the tunnel', toElementId: doomed.element.id });
    file = removeElement(made.file, doomed.element.id);

    expect(elementsOf(file)).toHaveLength(1);
    const kept = choicesAt(file, start.element.id);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.name).toBe('Take the tunnel');
    expect(kept[0]!.toElementId).toBeNull();
  });

  it('takes the choices that were offered at it', () => {
    let file = game();
    const doomed = addElement(file, { name: 'The tunnel' });
    file = addChoice(doomed.file, { elementId: doomed.element.id, name: 'Crawl' }).file;
    file = removeElement(file, doomed.element.id);
    expect(choicesAt(file, doomed.element.id)).toHaveLength(0);
  });
});

describe('state is named once', () => {
  /** §6, and the thing Twine cannot do. */
  it('renames everywhere at once, because a rule holds the id', () => {
    let file = game();
    const state = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
    file = state.file;
    const node = addElement(file, { name: 'The reactor' });
    file = updateElement(node.file, node.element.id, {
      conditions: {
        join: 'all',
        conditions: [{ subject: 'state', subjectId: state.state.id as string, op: 'at_least', value: '40' }],
        groups: [],
      },
    });

    file = updateState(file, state.state.id, { key: 'trust_marabel' });

    // The rule was not touched and now reads the new name.
    expect(statesOf(file)[0]!.key).toBe('trust_marabel');
    const [gate] = allConditions(file);
    expect(gate!.condition.subjectId).toBe(state.state.id as string);
  });

  it('takes every rule that mentioned a state away with it', () => {
    let file = game();
    const state = addState(file, { key: 'guard_spared' });
    file = state.file;
    const node = addElement(file, { name: 'The gate' });
    file = updateElement(node.file, node.element.id, {
      conditions: {
        join: 'all',
        conditions: [{ subject: 'state', subjectId: state.state.id as string, op: 'is', value: 'true' }],
        groups: [],
      },
      effects: [{ kind: 'set', targetId: state.state.id as string, value: 'true', timing: 'immediate', note: '' }],
    });

    file = removeState(file, state.state.id);

    // A condition about nothing cannot be evaluated and cannot be repaired by
    // guessing, so it goes rather than silently stopping meaning anything.
    expect(allConditions(file)).toHaveLength(0);
    expect(elementsOf(file)[0]!.effects).toHaveLength(0);
  });

  it('reaches a condition at any depth', () => {
    let file = game();
    const state = addState(file, { key: 'alarm' });
    file = state.file;
    const node = addElement(file, { name: 'The vent' });
    file = updateElement(node.file, node.element.id, {
      conditions: {
        join: 'all',
        conditions: [],
        groups: [
          {
            join: 'any',
            conditions: [{ subject: 'state', subjectId: state.state.id as string, op: 'is', value: 'true' }],
            groups: [],
          },
        ],
      },
    });
    expect(allConditions(file)).toHaveLength(1);
    file = removeState(file, state.state.id);
    expect(allConditions(file)).toHaveLength(0);
  });
});

describe('resources', () => {
  it('are one record with a kind rather than eight tables', () => {
    let file = game();
    const rifle = addResource(file, { name: 'Rifle', kind: 'weapon' });
    file = rifle.file;
    const rounds = addResource(file, { name: 'Rifle rounds', kind: 'ammunition', feeds: [rifle.resource.id] });
    file = rounds.file;
    expect(rounds.resource.feeds).toEqual([rifle.resource.id]);
  });

  it('unfeed a weapon that has gone, rather than pointing at nothing', () => {
    let file = game();
    const rifle = addResource(file, { name: 'Rifle', kind: 'weapon' });
    file = rifle.file;
    const rounds = addResource(file, { name: 'Rifle rounds', kind: 'ammunition', feeds: [rifle.resource.id] });
    file = removeResource(rounds.file, rifle.resource.id);
    expect(file.resourceDefinitions[0]!.feeds).toEqual([]);
  });
});

describe('the spine is the manuscript', () => {
  /**
   * §3. The spine is read from the story order rather than kept, so moving a
   * scene in the script moves the node along it with nothing run.
   */
  it('reads the order off the script, and follows when it changes', () => {
    let file = game();
    const first = newId<BeatId>();
    const second = newId<BeatId>();
    file = addElement(file, { name: 'A', boundBeatId: first }).file;
    file = addElement(file, { name: 'B', boundBeatId: second }).file;

    expect(spine(file, [first, second]).map((one) => one.name)).toEqual(['A', 'B']);
    // The writer moved the scene. Nothing was run here.
    expect(spine(file, [second, first]).map((one) => one.name)).toEqual(['B', 'A']);
  });

  it('leaves an unbound node off the spine without calling it missing', () => {
    let file = game();
    const beatId = newId<BeatId>();
    file = addElement(file, { name: 'A cinematic' }).file;
    file = addElement(file, { name: 'A scene', boundBeatId: beatId }).file;
    expect(spine(file, [beatId])).toHaveLength(1);
    expect(elementsOf(file)).toHaveLength(2);
  });
});

describe('an empty rule', () => {
  it('is satisfied, so a new node is usable before anybody has written one', () => {
    const made = addElement(game(), { name: 'Anywhere' });
    expect(made.element.conditions).toEqual(emptyConditions());
    expect(allConditions(made.file)).toHaveLength(0);
  });
});

describe('a choice’s order', () => {
  it('keeps the order they were made in', () => {
    let file = game();
    const node = addElement(file, { name: 'The door' });
    file = node.file;
    for (const name of ['Knock', 'Force it', 'Walk away']) {
      file = addChoice(file, { elementId: node.element.id, name }).file;
    }
    expect(choicesAt(file, node.element.id).map((one) => one.name)).toEqual(['Knock', 'Force it', 'Walk away']);
  });

  it('can be pointed somewhere after the fact', () => {
    let file = game();
    const from = addElement(file, { name: 'The door' });
    file = from.file;
    const to = addElement(file, { name: 'The hall' });
    file = to.file;
    const made = addChoice(file, { elementId: from.element.id, name: 'Knock' });
    file = updateChoice(made.file, made.choice.id, { toElementId: to.element.id });
    expect(choicesInto(file, to.element.id)).toHaveLength(1);
  });
});
