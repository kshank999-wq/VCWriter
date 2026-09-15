import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import {
  addChoice,
  addElement,
  addResource,
  addState,
  findChoice,
  updateChoice,
  updateElement,
} from '../narrative.js';
import {
  CHECK_WORDS,
  contradictions,
  deadEnds,
  describeFindings,
  emptyChoices,
  exhaustibleResources,
  findingsAt,
  impossibleEndings,
  narrativeFindings,
  orphanState,
  prerequisites,
  spineBypassed,
  unreachableNodes,
  weaponsWithoutAmmunition,
} from '../narrative-check.js';
import type { Choice, Condition, ConditionGroup, Effect } from '../entities/narrative.js';
import type { NarrativeElementId } from '../ids.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Interactive Narrative, stage 3 (addendum 18 §8; §12 of the spec, whole).
 *
 * Half of these tests are the checks firing. **The other half are them keeping
 * quiet**, which is the harder and more important half: a validator that
 * reports something a designer can see is fine is one they switch off, after
 * which it catches nothing at all.
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

const all = (...conditions: Condition[]): ConditionGroup => ({ join: 'all', conditions, groups: [] });

const effect = (one: Partial<Effect> & Pick<Effect, 'kind' | 'targetId'>): Effect => ({
  value: '',
  timing: 'immediate',
  note: '',
  ...one,
});

const choiceOn = (
  file: ProjectFile,
  input: { elementId: NarrativeElementId; name?: string; toElementId?: NarrativeElementId | null },
  patch: Partial<Choice> = {},
): { file: ProjectFile; choice: Choice } => {
  const made = addChoice(file, input);
  const next = updateChoice(made.file, made.choice.id, patch);
  return { file: next, choice: findChoice(next, made.choice.id)! };
};

/** Two nodes joined by one choice, which is the smallest working game. */
const twoNodes = () => {
  let file = game();
  const start = addElement(file, { name: 'Cold open' });
  file = start.file;
  const next = addElement(file, { name: 'The corridor' });
  file = updateElement(next.file, next.element.id, { endsHere: true });
  file = addChoice(file, { elementId: start.element.id, name: 'Go', toElementId: next.element.id }).file;
  return { file, start: start.element.id, next: next.element.id };
};

describe('§12.1 — nothing leads here', () => {
  it('names an unreachable node, and the choices stranded on it', () => {
    let file = twoNodes().file;
    const island = addElement(file, { name: 'The vault' });
    file = addChoice(island.file, { elementId: island.element.id, name: 'Look around' }).file;

    const [finding] = unreachableNodes(file);
    expect(finding!.check).toBe('unreachable');
    expect(finding!.says).toBe('Nothing leads to The vault, so the choice written there is never offered.');
  });

  /**
   * One finding, not one per node. The graph has a single problem, and a list
   * that repeats it forty times is a list nobody reads.
   */
  it('says it once when no node is a starting point at all', () => {
    const made = twoNodes();
    const file = updateElement(made.file, made.start, { entry: false });
    const found = unreachableNodes(file);
    expect(found).toHaveLength(1);
    expect(found[0]!.check).toBe('no_entry_point');
    expect(found[0]!.at).toBeNull();
  });

  it('says nothing about a graph with no nodes in it yet', () => {
    expect(unreachableNodes(game())).toEqual([]);
  });
});

describe('§12.3 — a dead end', () => {
  it('is reported where the designer has not said it is meant', () => {
    let file = game();
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const stop = addElement(file, { name: 'The airlock' });
    file = addChoice(stop.file, { elementId: start.element.id, toElementId: stop.element.id }).file;

    const [finding] = deadEnds(file);
    expect(finding!.check).toBe('dead_end');
    expect(finding!.says).toContain('The airlock has nowhere to go and is not marked as an ending');
  });

  /** §8's one refusal: a validator that cannot be told it is wrong is noise. */
  it('is silent once the designer marks it as meant', () => {
    let file = game();
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const stop = addElement(file, { name: 'The airlock' });
    file = updateElement(stop.file, stop.element.id, { endsHere: true });
    file = addChoice(file, { elementId: start.element.id, toElementId: stop.element.id }).file;
    expect(deadEnds(file)).toEqual([]);
  });

  it('is silent on a node whose kind says it is an ending', () => {
    let file = game();
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const stop = addElement(file, { name: 'She stays' });
    file = updateElement(stop.file, stop.element.id, { kind: 'ending' });
    file = addChoice(file, { elementId: start.element.id, toElementId: stop.element.id }).file;
    expect(deadEnds(file)).toEqual([]);
  });

  it('is silent about a node nothing reaches, which is already reported', () => {
    let file = twoNodes().file;
    file = addElement(file, { name: 'The vault' }).file;
    expect(deadEnds(file)).toEqual([]);
  });
});

describe('§12.2 — a choice that does nothing', () => {
  it('is one with no consequence and nowhere to go', () => {
    let file = game();
    const node = addElement(file, { name: 'The desk' });
    file = addChoice(node.file, { elementId: node.element.id, name: 'Shrug' }).file;
    expect(emptyChoices(file)[0]!.says).toBe('Shrug at The desk changes nothing and leads nowhere.');
  });

  /**
   * §2's narrowing of the spec's *or*. Examining, taking and refusing are
   * choices that change the world and leave the player where they were.
   */
  it('is not one that changes the world and stays put', () => {
    let file = game();
    const state = addState(file, { key: 'saw_panel', kind: 'flag' });
    file = state.file;
    const node = addElement(file, { name: 'The desk' });
    file = choiceOn(
      node.file,
      { elementId: node.element.id, name: 'Examine the panel' },
      { effects: [effect({ kind: 'set', targetId: state.state.id as string, value: 'true' })] },
    ).file;
    expect(emptyChoices(file)).toEqual([]);
  });
});

describe('§12.4 and §12.5 — prerequisites', () => {
  it('names a condition nothing in the game could make true', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
    file = score.file;
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    // It is set somewhere, so this is not an orphan — it is simply never set
    // to anything that satisfies the gate.
    file = updateElement(file, start.element.id, {
      effects: [effect({ kind: 'set', targetId: score.state.id as string, value: '10' })],
    });
    const gate = addElement(file, { name: 'She stays' });
    file = updateElement(gate.file, gate.element.id, {
      endsHere: true,
      conditions: all({ subject: 'state', subjectId: score.state.id as string, op: 'at_least', value: '90' }),
    });
    file = addChoice(file, { elementId: start.element.id, toElementId: gate.element.id }).file;

    const [finding] = prerequisites(file);
    expect(finding!.check).toBe('missing_prerequisite');
    expect(finding!.says).toBe(
      'She stays needs trust_mara is at least 90, and nothing anywhere in the game makes that true.',
    );
  });

  /** A `set` that does satisfy it is read exactly — stage 2's `meets`, again. */
  it('says nothing where an effect does satisfy it', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
    file = score.file;
    const start = addElement(file, { name: 'Cold open' });
    file = updateElement(start.file, start.element.id, {
      effects: [effect({ kind: 'set', targetId: score.state.id as string, value: '95' })],
    });
    const gate = addElement(file, { name: 'She stays' });
    file = updateElement(gate.file, gate.element.id, {
      endsHere: true,
      conditions: all({ subject: 'state', subjectId: score.state.id as string, op: 'at_least', value: '90' }),
    });
    file = addChoice(file, { elementId: start.element.id, toElementId: gate.element.id }).file;
    expect(prerequisites(file)).toEqual([]);
  });

  /**
   * An `add` moves a number by an amount that depends on where it already is,
   * so it is taken as possible. Calling this impossible would be the first
   * false alarm, and the first one is the one that gets the validator ignored.
   */
  it('takes an add as possible rather than guessing at the arithmetic', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
    file = score.file;
    const start = addElement(file, { name: 'Cold open' });
    file = updateElement(start.file, start.element.id, {
      effects: [effect({ kind: 'add', targetId: score.state.id as string, value: '5' })],
    });
    const gate = addElement(file, { name: 'She stays' });
    file = updateElement(gate.file, gate.element.id, {
      endsHere: true,
      conditions: all({ subject: 'state', subjectId: score.state.id as string, op: 'at_least', value: '90' }),
    });
    file = addChoice(file, { elementId: start.element.id, toElementId: gate.element.id }).file;
    expect(prerequisites(file)).toEqual([]);
  });

  /** Under an ANY another branch may carry the group, so nothing is said. */
  it('says nothing about an impossible condition under an ANY', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const other = addState(file, { key: 'alarm', kind: 'flag', initial: 'true' });
    file = other.file;
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const gate = addElement(file, { name: 'The safe room' });
    file = updateElement(gate.file, gate.element.id, {
      endsHere: true,
      conditions: {
        join: 'any',
        conditions: [
          { subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' },
          { subject: 'state', subjectId: other.state.id as string, op: 'is', value: 'true' },
        ],
        groups: [],
      },
    });
    file = addChoice(file, { elementId: start.element.id, toElementId: gate.element.id }).file;
    expect(prerequisites(file)).toEqual([]);
  });

  /** §12.5: the only thing that opens the door is behind the door. */
  it('names a prerequisite locked behind the node that needs it', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const room = addElement(file, { name: 'The safe room' });
    file = updateElement(room.file, room.element.id, {
      conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }),
    });
    const inside = addElement(file, { name: 'The desk drawer' });
    file = updateElement(inside.file, inside.element.id, {
      endsHere: true,
      effects: [effect({ kind: 'set', targetId: flag.state.id as string, value: 'true' })],
    });
    file = addChoice(file, { elementId: start.element.id, toElementId: room.element.id }).file;
    file = addChoice(file, { elementId: room.element.id, toElementId: inside.element.id }).file;

    const [finding] = prerequisites(file);
    expect(finding!.check).toBe('circular_prerequisite');
    expect(finding!.says).toBe(
      'The safe room needs has_key is true, and the only thing that makes it true is behind The safe room.',
    );
  });

  it('says nothing where the key is also handed out somewhere else', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const start = addElement(file, { name: 'Cold open' });
    file = updateElement(start.file, start.element.id, {
      effects: [effect({ kind: 'set', targetId: flag.state.id as string, value: 'true' })],
    });
    const room = addElement(file, { name: 'The safe room' });
    file = updateElement(room.file, room.element.id, {
      endsHere: true,
      conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }),
    });
    file = addChoice(file, { elementId: start.element.id, toElementId: room.element.id }).file;
    expect(prerequisites(file)).toEqual([]);
  });

  it('names a choice that requires what only it grants', () => {
    let file = game();
    const flag = addState(file, { key: 'has_badge', kind: 'flag' });
    file = flag.file;
    const node = addElement(file, { name: 'The checkpoint' });
    file = updateElement(node.file, node.element.id, { endsHere: true });
    file = choiceOn(
      file,
      { elementId: node.element.id, name: 'Show the badge' },
      {
        conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }),
        effects: [effect({ kind: 'set', targetId: flag.state.id as string, value: 'true' })],
      },
    ).file;

    const [finding] = prerequisites(file);
    expect(finding!.check).toBe('circular_prerequisite');
    expect(finding!.says).toContain('behind that same choice');
  });

  /**
   * The player does not have to move to take a second choice, so a key handed
   * over by a sibling at the same node is not behind anything.
   */
  it('says nothing where a sibling choice at the same node hands it over', () => {
    let file = game();
    const flag = addState(file, { key: 'has_badge', kind: 'flag' });
    file = flag.file;
    const node = addElement(file, { name: 'The checkpoint' });
    file = updateElement(node.file, node.element.id, { endsHere: true });
    file = choiceOn(
      file,
      { elementId: node.element.id, name: 'Pick up the badge' },
      { effects: [effect({ kind: 'set', targetId: flag.state.id as string, value: 'true' })] },
    ).file;
    file = choiceOn(
      file,
      { elementId: node.element.id, name: 'Show the badge' },
      { conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }) },
    ).file;
    expect(prerequisites(file)).toEqual([]);
  });

  /** A state nothing sets is `orphanState`'s to name: one problem, one finding. */
  it('leaves a state nothing sets at all to the orphan check', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const node = addElement(file, { name: 'The safe room' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }),
    });
    expect(prerequisites(file)).toEqual([]);
    expect(orphanState(file)[0]!.check).toBe('state_never_set');
  });

  /** §12.7, said about a resource: required before anything can give it. */
  it('names a resource required where nothing ever grants it', () => {
    let file = game();
    const keycard = addResource(file, { name: 'Keycard', kind: 'key_item', initial: 0 });
    file = keycard.file;
    const node = addElement(file, { name: 'The server floor' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      conditions: all({ subject: 'resource', subjectId: keycard.resource.id as string, op: 'at_least', value: '1' }),
    });
    expect(prerequisites(file)[0]!.says).toBe(
      'The server floor needs Keycard is at least 1, and nothing anywhere in the game makes that true.',
    );
  });
});

describe('§12.6 — conditions that disagree', () => {
  it('names two values one thing cannot both have', () => {
    let file = game();
    const state = addState(file, { key: 'faction', kind: 'enum', choices: ['miners', 'company'] });
    file = state.file;
    const node = addElement(file, { name: 'The vote' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      conditions: all(
        { subject: 'state', subjectId: state.state.id as string, op: 'is', value: 'miners' },
        { subject: 'state', subjectId: state.state.id as string, op: 'is', value: 'company' },
      ),
    });
    expect(contradictions(file)[0]!.says).toBe(
      'The vote asks for faction is miners and faction is company, which cannot both be true.',
    );
  });

  it('names an empty range', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number' });
    file = score.file;
    const node = addElement(file, { name: 'The vote' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      conditions: all(
        { subject: 'state', subjectId: score.state.id as string, op: 'at_least', value: '5' },
        { subject: 'state', subjectId: score.state.id as string, op: 'at_most', value: '3' },
      ),
    });
    expect(contradictions(file)).toHaveLength(1);
  });

  /** A gap a fraction still falls into is not a contradiction. */
  it('says nothing about a range that is merely narrow', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number' });
    file = score.file;
    const node = addElement(file, { name: 'The vote' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      conditions: all(
        { subject: 'state', subjectId: score.state.id as string, op: 'more_than', value: '5' },
        { subject: 'state', subjectId: score.state.id as string, op: 'less_than', value: '6' },
      ),
    });
    expect(contradictions(file)).toEqual([]);
  });

  it('says nothing about two conditions under an ANY', () => {
    let file = game();
    const state = addState(file, { key: 'faction', kind: 'enum' });
    file = state.file;
    const node = addElement(file, { name: 'The vote' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      conditions: {
        join: 'any',
        conditions: [
          { subject: 'state', subjectId: state.state.id as string, op: 'is', value: 'miners' },
          { subject: 'state', subjectId: state.state.id as string, op: 'is', value: 'company' },
        ],
        groups: [],
      },
    });
    expect(contradictions(file)).toEqual([]);
  });

  it('says nothing about two conditions on different things', () => {
    let file = game();
    const one = addState(file, { key: 'faction', kind: 'enum' });
    file = one.file;
    const two = addState(file, { key: 'rank', kind: 'enum' });
    file = two.file;
    const node = addElement(file, { name: 'The vote' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      conditions: all(
        { subject: 'state', subjectId: one.state.id as string, op: 'is', value: 'miners' },
        { subject: 'state', subjectId: two.state.id as string, op: 'is', value: 'company' },
      ),
    });
    expect(contradictions(file)).toEqual([]);
  });
});

describe('§12.12 — orphaned state', () => {
  it('says once that a new definition is neither read nor set', () => {
    const made = addState(game(), { key: 'trust_mara' });
    const found = orphanState(made.file);
    expect(found).toHaveLength(1);
    expect(found[0]!.says).toBe('Nothing reads trust_mara and nothing sets it.');
  });

  it('names one that is set and never read', () => {
    let file = game();
    const state = addState(file, { key: 'guard_spared', kind: 'flag' });
    file = state.file;
    const node = addElement(file, { name: 'The gate' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      effects: [effect({ kind: 'set', targetId: state.state.id as string, value: 'true' })],
    });
    expect(orphanState(file)[0]!.says).toBe(
      'guard_spared is set but nothing ever reads it, so changing it changes nothing.',
    );
  });

  it('names one that is read and never set, and says what it will always be', () => {
    let file = game();
    const state = addState(file, { key: 'difficulty', kind: 'text', initial: 'hard' });
    file = state.file;
    const node = addElement(file, { name: 'The gate' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      conditions: all({ subject: 'state', subjectId: state.state.id as string, op: 'is', value: 'hard' }),
    });
    expect(orphanState(file)[0]!.says).toBe(
      'difficulty is read but nothing ever sets it, so it will always be “hard”.',
    );
  });

  it('says nothing about one that is both read and set', () => {
    let file = game();
    const state = addState(file, { key: 'has_key', kind: 'flag' });
    file = state.file;
    const start = addElement(file, { name: 'Cold open' });
    file = updateElement(start.file, start.element.id, {
      effects: [effect({ kind: 'set', targetId: state.state.id as string, value: 'true' })],
    });
    const gate = addElement(file, { name: 'The safe room' });
    file = updateElement(gate.file, gate.element.id, {
      endsHere: true,
      conditions: all({ subject: 'state', subjectId: state.state.id as string, op: 'is', value: 'true' }),
    });
    expect(orphanState(file)).toEqual([]);
  });
});

describe('§12.8 — a weapon with nothing to fire', () => {
  it('names one no ammunition feeds', () => {
    const made = addResource(game(), { name: 'Rifle', kind: 'weapon' });
    expect(weaponsWithoutAmmunition(made.file)[0]!.says).toBe(
      'Rifle has no ammunition: no resource says it feeds it.',
    );
  });

  /** *Availability*: a magazine that exists in the design and never arrives. */
  it('names one whose ammunition the player never gets', () => {
    let file = game();
    const rifle = addResource(file, { name: 'Rifle', kind: 'weapon' });
    file = rifle.file;
    file = addResource(file, {
      name: 'Rifle rounds',
      kind: 'ammunition',
      initial: 0,
      feeds: [rifle.resource.id],
    }).file;
    expect(weaponsWithoutAmmunition(file)[0]!.says).toContain('has ammunition the player never gets');
  });

  it('says nothing once somebody grants the ammunition', () => {
    let file = game();
    const rifle = addResource(file, { name: 'Rifle', kind: 'weapon' });
    file = rifle.file;
    const rounds = addResource(file, {
      name: 'Rifle rounds',
      kind: 'ammunition',
      initial: 0,
      feeds: [rifle.resource.id],
    });
    file = rounds.file;
    const node = addElement(file, { name: 'The armoury' });
    file = updateElement(node.file, node.element.id, {
      endsHere: true,
      effects: [effect({ kind: 'grant', targetId: rounds.resource.id as string, value: '30' })],
    });
    expect(weaponsWithoutAmmunition(file)).toEqual([]);
  });

  it('says nothing about ammunition the player starts with', () => {
    let file = game();
    const rifle = addResource(file, { name: 'Rifle', kind: 'weapon' });
    file = rifle.file;
    file = addResource(file, {
      name: 'Rifle rounds',
      kind: 'ammunition',
      initial: 30,
      feeds: [rifle.resource.id],
    }).file;
    expect(weaponsWithoutAmmunition(file)).toEqual([]);
  });
});

describe('§12.9 — a resource that can run out', () => {
  /** All three halves, or it is an economy rather than a fault. */
  it('names one that is never granted, is spent elsewhere, and is needed by something mandatory', () => {
    let file = game();
    const fuel = addResource(file, { name: 'Fuel cells', kind: 'consumable', initial: 2 });
    file = fuel.file;
    const detour = addElement(file, { name: 'The greenhouse' });
    file = detour.file;
    file = choiceOn(
      file,
      { elementId: detour.element.id, name: 'Power the lights' },
      { effects: [effect({ kind: 'consume', targetId: fuel.resource.id as string, value: '2' })] },
    ).file;
    const reactor = addElement(file, { name: 'Restart the reactor' });
    file = updateElement(reactor.file, reactor.element.id, {
      mandatory: true,
      endsHere: true,
      conditions: all({ subject: 'resource', subjectId: fuel.resource.id as string, op: 'at_least', value: '1' }),
    });
    file = addChoice(file, { elementId: detour.element.id, toElementId: reactor.element.id }).file;

    const [finding] = exhaustibleResources(file);
    expect(finding!.says).toBe(
      'Fuel cells is never granted anywhere and can be spent before Restart the reactor, which is mandatory, needs it.',
    );
  });

  it('says nothing once the resource is granted somewhere', () => {
    let file = game();
    const fuel = addResource(file, { name: 'Fuel cells', kind: 'consumable', initial: 2 });
    file = fuel.file;
    const detour = addElement(file, { name: 'The greenhouse' });
    file = updateElement(detour.file, detour.element.id, {
      effects: [effect({ kind: 'grant', targetId: fuel.resource.id as string, value: '1' })],
    });
    file = choiceOn(
      file,
      { elementId: detour.element.id, name: 'Power the lights' },
      { effects: [effect({ kind: 'consume', targetId: fuel.resource.id as string, value: '2' })] },
    ).file;
    const reactor = addElement(file, { name: 'Restart the reactor' });
    file = updateElement(reactor.file, reactor.element.id, {
      mandatory: true,
      endsHere: true,
      conditions: all({ subject: 'resource', subjectId: fuel.resource.id as string, op: 'at_least', value: '1' }),
    });
    expect(exhaustibleResources(file)).toEqual([]);
  });

  it('says nothing where nothing mandatory needs it', () => {
    let file = game();
    const fuel = addResource(file, { name: 'Fuel cells', kind: 'consumable', initial: 2 });
    file = fuel.file;
    const detour = addElement(file, { name: 'The greenhouse' });
    file = updateElement(detour.file, detour.element.id, { endsHere: true });
    file = choiceOn(
      file,
      { elementId: detour.element.id, name: 'Power the lights' },
      { effects: [effect({ kind: 'consume', targetId: fuel.resource.id as string, value: '2' })] },
    ).file;
    expect(exhaustibleResources(file)).toEqual([]);
  });

  it('says nothing where the mandatory use is the only place it is spent', () => {
    let file = game();
    const fuel = addResource(file, { name: 'Fuel cells', kind: 'consumable', initial: 2 });
    file = fuel.file;
    const reactor = addElement(file, { name: 'Restart the reactor' });
    file = updateElement(reactor.file, reactor.element.id, {
      mandatory: true,
      endsHere: true,
      effects: [effect({ kind: 'consume', targetId: fuel.resource.id as string, value: '2' })],
    });
    expect(exhaustibleResources(file)).toEqual([]);
  });
});

describe('§12.10 — an ending that cannot happen', () => {
  it('is its own finding rather than a plain unreachable node', () => {
    let file = twoNodes().file;
    const ending = addElement(file, { name: 'She leaves' });
    file = updateElement(ending.file, ending.element.id, { kind: 'ending' });

    expect(impossibleEndings(file)[0]!.says).toBe('She leaves is an ending nothing leads to, so it can never happen.');
    expect(unreachableNodes(file)).toEqual([]);
  });
});

describe('§12.11 — a branch that misses the spine', () => {
  /** **Mandatory is what *supposed to* means**: §2.3's spine, on the node. */
  it('names a mandatory node a path can get past', () => {
    let file = game();
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const reactor = addElement(file, { name: 'Restart the reactor' });
    file = updateElement(reactor.file, reactor.element.id, { mandatory: true, endsHere: true });
    const away = addElement(file, { name: 'Walk into the storm' });
    file = updateElement(away.file, away.element.id, { kind: 'ending' });
    file = addChoice(file, { elementId: start.element.id, toElementId: reactor.element.id }).file;
    file = addChoice(file, { elementId: start.element.id, toElementId: away.element.id }).file;

    const [finding] = spineBypassed(file);
    expect(finding!.says).toBe(
      'Restart the reactor is marked mandatory, and a path can reach Walk into the storm without passing it.',
    );
  });

  it('says nothing where every path goes through it', () => {
    let file = game();
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const reactor = addElement(file, { name: 'Restart the reactor' });
    file = updateElement(reactor.file, reactor.element.id, { mandatory: true });
    const after = addElement(file, { name: 'She stays' });
    file = updateElement(after.file, after.element.id, { kind: 'ending' });
    file = addChoice(file, { elementId: start.element.id, toElementId: reactor.element.id }).file;
    file = addChoice(file, { elementId: reactor.element.id, toElementId: after.element.id }).file;
    expect(spineBypassed(file)).toEqual([]);
  });
});

describe('the list', () => {
  it('is empty on a graph with nothing wrong with it, and says so', () => {
    let file = game();
    const state = addState(file, { key: 'has_key', kind: 'flag' });
    file = state.file;
    const start = addElement(file, { name: 'Cold open' });
    file = updateElement(start.file, start.element.id, {
      effects: [effect({ kind: 'set', targetId: state.state.id as string, value: 'true' })],
    });
    const room = addElement(file, { name: 'The safe room' });
    file = updateElement(room.file, room.element.id, {
      kind: 'ending',
      conditions: all({ subject: 'state', subjectId: state.state.id as string, op: 'is', value: 'true' }),
    });
    file = addChoice(file, { elementId: start.element.id, name: 'Go in', toElementId: room.element.id }).file;

    expect(narrativeFindings(file)).toEqual([]);
    expect(describeFindings([])).toBe(
      'Nothing to report. Every node can be reached and every rule can be satisfied.',
    );
  });

  it('reads the most structural first', () => {
    let file = game();
    const orphan = addState(file, { key: 'unused' });
    file = orphan.file;
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    file = addChoice(file, { elementId: start.element.id, name: 'Shrug' }).file;
    file = addElement(file, { name: 'The island' }).file;

    const found = narrativeFindings(file);
    expect(found.map((one) => one.check)).toEqual(['unreachable', 'dead_end', 'empty_choice', 'state_never_read']);
    expect(describeFindings(found)).toBe('4 findings across 4 checks.');
    expect(CHECK_WORDS.unreachable).toBe('Unreachable');
  });

  /** §15.2: a warning a designer only finds elsewhere is one they do not find. */
  it('gives a node its own findings, its choices’ and its rules’', () => {
    let file = game();
    const orphan = addState(file, { key: 'unused' });
    file = orphan.file;
    const node = addElement(file, { name: 'The desk' });
    file = node.file;
    file = choiceOn(
      file,
      { elementId: node.element.id, name: 'Shrug' },
      { effects: [effect({ kind: 'set', targetId: orphan.state.id as string, value: 'true' })] },
    ).file;
    const elsewhere = addElement(file, { name: 'The island' });
    file = elsewhere.file;

    const mine = findingsAt(file, node.element.id);
    expect(mine.map((one) => one.check)).toEqual(['dead_end', 'state_never_read']);
    // The unreachable island is not this node's problem.
    expect(mine.every((one) => !one.says.includes('The island'))).toBe(true);
  });
});
