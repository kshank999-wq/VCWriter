import { describe, expect, it } from 'vitest';
import { createProjectFile, parseProjectFile, serializeProjectFile } from '../project-file.js';
import type { ProjectFile } from '../project-file.js';
import { addChoice, addElement, addResource, addState, choicesAt, removeResource, removeState, updateChoice, updateElement } from '../narrative.js';
import { initialState } from '../narrative-eval.js';
import { narrativeFindings } from '../narrative-check.js';
import { narrativeMap } from '../narrative-map.js';
import { dropIntoLane } from '../narrative-lane.js';
import {
  addObjective,
  addQuest,
  objectiveDone,
  objectivesIn,
  playerLane,
  questProgress,
  questSteps,
  removeQuest,
  sayObjective,
  sceneCompletion,
  unplacedObjectives,
  updateObjective,
} from '../narrative-objectives.js';
import { unitsInStoryOrder } from '../selectors.js';
import type { ConditionGroup } from '../entities/narrative.js';
import type { PlayState } from '../narrative-eval.js';

/**
 * Addendum 25 §3: an objective is the Player Lane's one stored record, its
 * completion is a condition the one evaluator reads, and the rest of the lane
 * is read off the nodes.
 */

const holds = (resourceId: string, value = '1'): ConditionGroup => ({
  join: 'all',
  conditions: [{ subject: 'resource', subjectId: resourceId, op: 'at_least', value }],
  groups: [],
});

/** Two scenes on the spine, a key granted in the first and needed in the second. */
const vault = () => {
  let file = createProjectFile({ title: 'The Sunken Vault', format: 'game' });
  file = { ...file, units: [], beats: [] };
  const fork = dropIntoLane(file, { card: 'scene', afterUnitId: null, name: 'The Fork' });
  file = fork.file;
  const door = dropIntoLane(file, { card: 'scene', afterUnitId: unitsInStoryOrder(file)[0]!.id, name: 'The Vault Door' });
  file = door.file;
  const key = addResource(file, { name: 'Vault Key', kind: 'key_item' });
  file = key.file;
  const [forkUnit, doorUnit] = unitsInStoryOrder(file);
  return { file, fork: fork.element, door: door.element, key: key.resource, forkUnit: forkUnit!, doorUnit: doorUnit! };
};

const holding = (file: ProjectFile, resourceId: string, count: number): PlayState => ({
  ...initialState(file),
  resources: { ...initialState(file).resources, [resourceId]: count },
});

describe('objectives', () => {
  it('is done when its condition is met, read off the player’s state', () => {
    const v = vault();
    let { file, objective } = addObjective(v.file, { name: 'Find the vault key', unitId: v.forkUnit.id });
    file = updateObjective(file, objective.id, { complete: holds(v.key.id as string) });
    const now = objectivesIn(file, v.forkUnit.id)[0]!;
    expect(objectiveDone(file, initialState(file), now)).toBe(false);
    expect(objectiveDone(file, holding(file, v.key.id, 1), now)).toBe(true);
    expect(sayObjective(file, now)).toBe('Find the vault key — done when Vault Key is at least 1');
  });

  it('is done on arrival when it asks nothing', () => {
    const v = vault();
    const { file, objective } = addObjective(v.file, { name: 'Reach the door', unitId: v.doorUnit.id });
    expect(objectiveDone(file, initialState(file), objective)).toBe(true);
    expect(sayObjective(file, objective)).toBe('Reach the door — done on arrival');
  });

  it('makes a scene complete only when every mandatory objective is done', () => {
    const v = vault();
    let file = addObjective(v.file, { name: 'Find the key', unitId: v.forkUnit.id }).file;
    const [needed] = objectivesIn(file, v.forkUnit.id);
    file = updateObjective(file, needed!.id, { complete: holds(v.key.id as string) });
    const optional = addObjective(file, { name: 'Find the old map', unitId: v.forkUnit.id, mandatory: false });
    file = updateObjective(optional.file, optional.objective.id, { complete: holds(v.key.id as string, '5') });

    const before = sceneCompletion(file, initialState(file), v.forkUnit.id);
    expect(before.complete).toBe(false);
    expect(before.missing.map((one) => one.name)).toEqual(['Find the key']);
    // The optional one is still not done, and the scene is complete regardless.
    expect(sceneCompletion(file, holding(file, v.key.id, 1), v.forkUnit.id)).toEqual({ complete: true, missing: [] });
    expect(sceneCompletion(file, initialState(file), v.doorUnit.id).complete).toBe(true);
  });

  it('waits unplaced when its scene is cut, rather than being lost', () => {
    const v = vault();
    const { file } = addObjective(v.file, { name: 'Find the key', unitId: v.forkUnit.id });
    const cut = { ...file, units: file.units.filter((one) => one.id !== v.forkUnit.id) };
    expect(unplacedObjectives(cut).map((one) => one.name)).toEqual(['Find the key']);
  });

  it('loses a rule about a state or resource when that is deleted, as every rule does', () => {
    const v = vault();
    const trust = addState(v.file, { key: 'mara_trust', kind: 'number' });
    let { file, objective } = addObjective(trust.file, { name: 'Win Mara over', unitId: v.forkUnit.id });
    file = updateObjective(file, objective.id, {
      complete: {
        join: 'all',
        conditions: [
          { subject: 'state', subjectId: trust.state.id, op: 'at_least', value: '2' },
          { subject: 'resource', subjectId: v.key.id, op: 'at_least', value: '1' },
        ],
        groups: [],
      },
    });
    file = removeState(file, trust.state.id);
    expect(objectivesIn(file, v.forkUnit.id)[0]!.complete.conditions.map((one) => one.subject)).toEqual(['resource']);
    file = removeResource(file, v.key.id);
    expect(objectivesIn(file, v.forkUnit.id)[0]!.complete.conditions).toEqual([]);
  });

  it('counts as reading a state, so the checks do not call that state unread', () => {
    const v = vault();
    const found = addState(v.file, { key: 'found_map', kind: 'flag' });
    let file = found.file;
    const [link] = choicesAt(file, v.fork.id);
    file = updateChoice(file, link!.id, { effects: [{ kind: 'set', targetId: found.state.id, value: 'true', timing: 'immediate', note: '' }] });
    const says = () => narrativeFindings(file).map((one) => one.says).filter((one) => one.includes('found_map'));
    expect(says()).toEqual(['found_map is set but nothing ever reads it, so changing it changes nothing.']);
    const made = addObjective(file, { name: 'Find the map', unitId: v.forkUnit.id });
    file = updateObjective(made.file, made.objective.id, {
      complete: { join: 'all', conditions: [{ subject: 'state', subjectId: found.state.id, op: 'is', value: 'true' }], groups: [] },
    });
    expect(says()).toEqual([]);
  });

  it('survives a save and a load', () => {
    const v = vault();
    const quest = addQuest(v.file, { name: 'The Lost Expedition' });
    const { file } = addObjective(quest.file, { name: 'Find the key', unitId: v.forkUnit.id, questId: quest.quest.id });
    const reopened = parseProjectFile(JSON.parse(serializeProjectFile(file)));
    expect(reopened.objectives).toEqual(file.objectives);
    expect(reopened.quests).toEqual(file.quests);
  });
});

describe('quests', () => {
  it('are their objectives in order, and say which is next', () => {
    const v = vault();
    let { file, quest } = addQuest(v.file, { name: 'The Lost Expedition' });
    const first = addObjective(file, { name: 'Find the key', unitId: v.forkUnit.id, questId: quest.id });
    file = updateObjective(first.file, first.objective.id, { complete: holds(v.key.id as string) });
    const second = addObjective(file, { name: 'Open the vault', unitId: v.doorUnit.id, questId: quest.id });
    file = updateObjective(second.file, second.objective.id, { complete: holds(v.key.id as string, '9') });

    expect(questSteps(file, quest.id).map((one) => one.name)).toEqual(['Find the key', 'Open the vault']);
    const early = questProgress(file, initialState(file), quest.id)!;
    expect([early.done, early.total, early.next?.name]).toEqual([0, 2, 'Find the key']);
    const later = questProgress(file, holding(file, v.key.id, 1), quest.id)!;
    expect([later.done, later.next?.name]).toEqual([1, 'Open the vault']);
  });

  it('keeps its objectives when it is removed', () => {
    const v = vault();
    const quest = addQuest(v.file, { name: 'The Lost Expedition' });
    const { file } = addObjective(quest.file, { name: 'Find the key', unitId: v.forkUnit.id, questId: quest.quest.id });
    const after = removeQuest(file, quest.quest.id);
    expect(after.quests).toEqual([]);
    expect(objectivesIn(after, v.forkUnit.id).map((one) => [one.name, one.questId])).toEqual([['Find the key', null]]);
  });
});

describe('the Player Lane', () => {
  it('reads what the player does in each scene off its objectives and its nodes', () => {
    const v = vault();
    let file = v.file;
    // The fork offers two ways and grants the key on one of them.
    const [onward] = choicesAt(file, v.fork.id);
    file = updateChoice(file, onward!.id, {
      text: 'The wide passage',
      effects: [{ kind: 'grant', targetId: v.key.id, value: '1', timing: 'immediate', note: '' }],
    });
    file = addChoice(file, { elementId: v.fork.id, text: 'The squeeze', toElementId: v.door.id }).file;
    file = updateElement(file, v.fork.id, { kind: 'encounter' });
    file = addObjective(file, { name: 'Get past the fork', unitId: v.forkUnit.id }).file;
    // The door needs the key and takes it.
    const [turn] = choicesAt(file, v.door.id).length ? choicesAt(file, v.door.id) : [null];
    expect(turn).toBeNull();
    file = updateElement(file, v.door.id, {
      conditions: holds(v.key.id as string),
      effects: [{ kind: 'consume', targetId: v.key.id, value: '1', timing: 'immediate', note: '' }],
    });

    const lane = playerLane(file);
    expect(lane.map((one) => one.title)).toEqual(['The Fork', 'The Vault Door']);
    expect(lane[0]!.items.map((one) => [one.kind, one.text])).toEqual([
      ['objective', 'Get past the fork'],
      ['decide', 'The wide passage / The squeeze'],
      ['acquire', 'Vault Key'],
      ['overcome', 'The Fork'],
    ]);
    expect(lane[1]!.items.map((one) => [one.kind, one.text])).toEqual([
      ['need', 'Vault Key'],
      ['spend', 'Vault Key'],
    ]);
  });

  it('keeps a row free directly under the spine for itself', () => {
    const v = vault();
    let file = v.file;
    // Two branches off the fork: the first goes above the spine, the second below.
    for (const name of ['Up the shaft', 'Into the pool']) {
      const branch = addElement(file, { name, kind: 'encounter' });
      file = addChoice(branch.file, { elementId: v.fork.id, text: name, toElementId: branch.element.id }).file;
    }
    const map = narrativeMap(file);
    const below = map.nodes.find((one) => one.name === 'Into the pool')!;
    expect(below.lane).toBe('below');
    expect(map.playerRow).toBe(map.laneRow + 1);
    expect(below.row).toBe(map.playerRow + 1);
    expect(map.nodes.some((one) => one.row === map.playerRow)).toBe(false);
  });
});
