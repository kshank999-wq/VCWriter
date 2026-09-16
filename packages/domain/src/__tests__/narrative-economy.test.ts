import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import {
  addChoice,
  addElement,
  addResource,
  findChoice,
  updateChoice,
  updateElement,
  updateResource,
} from '../narrative.js';
import {
  describeEconomy,
  describeProgression,
  economyOf,
  nodesTouching,
  progressionTiers,
  resourceEconomy,
  upgradeChain,
} from '../narrative-economy.js';
import type { Condition, ConditionGroup, Effect } from '../entities/narrative.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Interactive Narrative, stage 6 (addendum 18 §7, §8).
 *
 * The claim: **§8 was already built and §7 is mostly readings.** So the tests
 * that matter are the ones where something moves in the graph and the economy
 * changes with nothing run — and the one that proves a resource dependency is
 * an ordinary condition rather than a second kind of edge.
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

const all = (...conditions: Condition[]): ConditionGroup => ({ join: 'all', conditions, groups: [] });

const effect = (one: Partial<Effect> & Pick<Effect, 'kind' | 'targetId'>): Effect => ({
  value: '',
  timing: 'immediate',
  note: '',
  ...one,
});

/** A keycard given out at the desk and spent at the door. */
const keycardGame = () => {
  let file = game();
  const card = addResource(file, { name: 'Keycard', kind: 'key_item', initial: 0 });
  file = card.file;

  const desk = addElement(file, { name: 'The desk' });
  file = desk.file;
  const door = addElement(file, { name: 'The server door' });
  file = door.file;

  const take = addChoice(file, { elementId: desk.element.id, name: 'Take the keycard', toElementId: door.element.id });
  file = updateChoice(take.file, take.choice.id, {
    effects: [effect({ kind: 'grant', targetId: card.resource.id as string, value: '1' })],
  });

  const use = addChoice(file, { elementId: door.element.id, name: 'Swipe it' });
  file = updateChoice(use.file, use.choice.id, {
    conditions: all({ subject: 'resource', subjectId: card.resource.id as string, op: 'at_least', value: '1' }),
    effects: [effect({ kind: 'consume', targetId: card.resource.id as string, value: '1' })],
  });

  return { file, cardId: card.resource.id, desk: desk.element.id, door: door.element.id, takeId: take.choice.id };
};

describe('a resource dependency is an ordinary condition', () => {
  /**
   * §8's whole ask, and the audit's finding: *low ammunition makes an assault
   * unavailable* needs no resource edge, because a resource is one of the two
   * subjects a rule can already be about.
   */
  it('needs no second kind of edge anywhere', () => {
    const made = keycardGame();
    expect(made.file).not.toHaveProperty('resourceEdges');
    expect(made.file).not.toHaveProperty('resourceLinks');

    const economy = resourceEconomy(made.file, made.cardId)!;
    expect(economy.gates).toHaveLength(1);
    expect(economy.gates[0]!.says).toBe('Keycard is at least 1');
    expect(economy.gates[0]!.choice?.name).toBe('Swipe it');
  });
});

describe('the economy of one resource', () => {
  it('reads its sources, its sinks and what asks about it', () => {
    const made = keycardGame();
    const economy = resourceEconomy(made.file, made.cardId)!;

    expect(economy.sources.map((one) => one.element.name)).toEqual(['The desk']);
    expect(economy.sources[0]!.amount).toBe('1');
    expect(economy.sinks.map((one) => one.element.name)).toEqual(['The server door']);
    expect(economy.obtainable).toBe(true);
    expect(describeEconomy(economy)).toBe('1 source · 1 sink · 1 rule ask about it.');
  });

  /** The absence the whole module rests on, pointed at the economy. */
  it('turns unobtainable when the choice that gave it is cut, with nothing run', () => {
    const made = keycardGame();
    const before = resourceEconomy(made.file, made.cardId)!;
    expect(before.obtainable).toBe(true);

    const file = updateChoice(made.file, made.takeId, { effects: [] });
    const after = resourceEconomy(file, made.cardId)!;
    expect(after.obtainable).toBe(false);
    expect(after.sources).toEqual([]);
    expect(describeEconomy(after)).toContain('nothing gives it and the player starts with none');
  });

  it('counts what the player starts with as a way of having it', () => {
    let file = game();
    const gold = addResource(file, { name: 'Credits', kind: 'currency', initial: 50 });
    file = gold.file;
    const economy = resourceEconomy(file, gold.resource.id)!;
    expect(economy.obtainable).toBe(true);
    expect(describeEconomy(economy)).toBe('starts with 50.');
  });

  it('puts the earliest acquisition first, by where it falls in the graph', () => {
    let made = keycardGame();
    let file = made.file;
    // A second source, further along.
    const late = addElement(file, { name: 'The vault' });
    file = late.file;
    file = addChoice(file, { elementId: made.door, toElementId: late.element.id }).file;
    const spare = addChoice(file, { elementId: late.element.id, name: 'Take the spare' });
    file = updateChoice(spare.file, spare.choice.id, {
      effects: [effect({ kind: 'grant', targetId: made.cardId as string, value: '1' })],
    });

    const economy = resourceEconomy(file, made.cardId)!;
    expect(economy.sources.map((one) => one.element.name)).toEqual(['The desk', 'The vault']);
    expect(economy.sources.map((one) => one.step)).toEqual([0, 2]);
  });

  /** §7's *optional or required*, read rather than asked for. */
  it('reads required off something mandatory asking for it', () => {
    const made = keycardGame();
    expect(resourceEconomy(made.file, made.cardId)!.required).toBe(false);
    const file = updateElement(made.file, made.door, { mandatory: true });
    // The rule is on the choice at the door, so the door being mandatory is
    // what makes the keycard required.
    const economy = resourceEconomy(file, made.cardId)!;
    expect(economy.required).toBe(true);
    expect(describeEconomy(economy)).toContain('something mandatory needs it');
  });

  it('says nothing mentions a resource nobody has used', () => {
    const made = addResource(game(), { name: 'Rifle', kind: 'weapon' });
    expect(describeEconomy(resourceEconomy(made.file, made.resource.id)!)).toBe(
      'Nothing in the game mentions it yet.',
    );
  });

  it('is null for a resource that has gone', () => {
    const made = addResource(game(), { name: 'Rifle', kind: 'weapon' });
    expect(resourceEconomy(game(), made.resource.id)).toBeNull();
  });
});

describe('ammunition and upgrades', () => {
  it('reads both ends of feeds without being told twice', () => {
    let file = game();
    const rifle = addResource(file, { name: 'Rifle', kind: 'weapon' });
    file = rifle.file;
    const rounds = addResource(file, { name: 'Rifle rounds', kind: 'ammunition', feeds: [rifle.resource.id] });
    file = rounds.file;

    expect(resourceEconomy(file, rifle.resource.id)!.feeds.map((one) => one.name)).toEqual(['Rifle rounds']);
    expect(resourceEconomy(file, rounds.resource.id)!.fedBy.map((one) => one.name)).toEqual(['Rifle']);
  });

  it('walks an upgrade chain from either end', () => {
    let file = game();
    const one = addResource(file, { name: 'Pistol', kind: 'weapon' });
    file = one.file;
    const two = addResource(file, { name: 'Heavy pistol', kind: 'weapon' });
    file = updateResource(two.file, two.resource.id, { upgradeOf: one.resource.id });
    const three = addResource(file, { name: 'Railgun', kind: 'weapon' });
    file = updateResource(three.file, three.resource.id, { upgradeOf: two.resource.id });

    const names = ['Pistol', 'Heavy pistol', 'Railgun'];
    expect(upgradeChain(file, one.resource.id).map((r) => r.name)).toEqual(names);
    expect(upgradeChain(file, three.resource.id).map((r) => r.name)).toEqual(names);
    expect(resourceEconomy(file, two.resource.id)!.replaces?.name).toBe('Pistol');
    expect(resourceEconomy(file, two.resource.id)!.replacedBy.map((r) => r.name)).toEqual(['Railgun']);
  });

  /** A chain that hangs the screen is worse than one that is short. */
  it('stops rather than spinning where somebody makes a loop', () => {
    let file = game();
    const a = addResource(file, { name: 'A', kind: 'weapon' });
    file = a.file;
    const b = addResource(file, { name: 'B', kind: 'weapon' });
    file = updateResource(b.file, b.resource.id, { upgradeOf: a.resource.id });
    file = updateResource(file, a.resource.id, { upgradeOf: b.resource.id });
    expect(upgradeChain(file, a.resource.id).length).toBeLessThanOrEqual(2);
  });
});

describe('the progression', () => {
  /** The one ordering the graph cannot give, which is why it is stored. */
  it('groups by tier, and puts the unranked last', () => {
    let file = game();
    const late = addResource(file, { name: 'Railgun', kind: 'weapon' });
    file = updateResource(late.file, late.resource.id, { tier: 3 });
    const early = addResource(file, { name: 'Pistol', kind: 'weapon' });
    file = updateResource(early.file, early.resource.id, { tier: 1 });
    file = addResource(file, { name: 'Credits', kind: 'currency' }).file;

    expect(progressionTiers(file).map((one) => one.tier)).toEqual([1, 3, 0]);
    expect(progressionTiers(file)[2]!.resources.map((one) => one.name)).toEqual(['Credits']);
  });

  it('counts the two things worth counting and no opinions', () => {
    const made = keycardGame();
    expect(describeProgression(made.file)).toBe('1 resource.');

    const file = addResource(made.file, { name: 'Rifle', kind: 'weapon' }).file;
    expect(describeProgression(file)).toBe('2 resources · 1 the player cannot get · 1 nothing spends or asks about.');
    expect(describeProgression(game())).toContain('No resources yet');
  });
});

describe('§9’s overlay', () => {
  it('lights every node a resource is granted, spent or asked about', () => {
    const made = keycardGame();
    const lit = nodesTouching(made.file, made.cardId as string);
    expect(lit.has(made.desk as string)).toBe(true);
    expect(lit.has(made.door as string)).toBe(true);
  });

  /**
   * The corridor that reaches a gated door belongs on the overlay too, or the
   * door lights and the way to it does not.
   */
  it('lights what leads to a gated node', () => {
    let file = game();
    const card = addResource(file, { name: 'Keycard', kind: 'key_item' });
    file = card.file;
    const hall = addElement(file, { name: 'The hall' });
    file = hall.file;
    const door = addElement(file, { name: 'The door' });
    file = updateElement(door.file, door.element.id, {
      conditions: all({ subject: 'resource', subjectId: card.resource.id as string, op: 'at_least', value: '1' }),
    });
    file = addChoice(file, { elementId: hall.element.id, toElementId: door.element.id }).file;

    const lit = nodesTouching(file, card.resource.id as string);
    expect(lit.has(door.element.id as string)).toBe(true);
    expect(lit.has(hall.element.id as string)).toBe(true);
  });

  it('says nothing about a subject nothing mentions', () => {
    const made = addResource(game(), { name: 'Rifle', kind: 'weapon' });
    expect(nodesTouching(made.file, made.resource.id as string).size).toBe(0);
  });
});

describe('what stage 6 did not store', () => {
  /**
   * §7 lists dozens of fields. Three are on the record and the rest are read,
   * because a stored acquisition point would be a second answer that goes
   * stale the moment a choice moves.
   */
  it('keeps no acquisition point, source list or use point on the record', () => {
    const made = addResource(game(), { name: 'Keycard', kind: 'key_item' });
    for (const absent of ['acquiredAt', 'sources', 'sinks', 'usePoints', 'prerequisites', 'unlocks', 'optional']) {
      expect(made.resource).not.toHaveProperty(absent);
    }
    // And the three that are not readings are there.
    expect(made.resource.tier).toBe(0);
    expect(made.resource.upgradeOf).toBeNull();
    expect(made.resource.scarcityTarget).toBe('');
  });

  it('reads every resource at once for the screen', () => {
    const made = keycardGame();
    expect(economyOf(made.file).map((one) => one.resource.name)).toEqual(['Keycard']);
    expect(findChoice(made.file, made.takeId)).not.toBeNull();
  });
});
