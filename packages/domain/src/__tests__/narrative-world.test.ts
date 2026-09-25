import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import type { ProjectFile } from '../project-file.js';
import { addChoice, addElement, addResource, choicesAt, statesOf, updateChoice, updateElement } from '../narrative.js';
import { beginRun, choose, evaluate, initialState, useVerb, verbsAt, settle } from '../narrative-eval.js';
import { narrativeFindings } from '../narrative-check.js';
import { recordStep, replayRun, startRun } from '../narrative-run.js';
import { dropIntoLane } from '../narrative-lane.js';
import { playerLane } from '../narrative-objectives.js';
import { addTrigger, sceneBoard, systemicLayer, updateTrigger } from '../narrative-scene.js';
import {
  addMechanic,
  addObject,
  addPuzzle,
  addVerb,
  makeChoicesExclusive,
  mechanicsOf,
  ownerOfState,
  placeObject,
  removeObject,
  removePuzzle,
  setObjectStates,
  updateObject,
  updatePuzzle,
  updateVerb,
} from '../narrative-world.js';
import { addLocation } from '../locations.js';
import { unitsInStoryOrder } from '../selectors.js';
import type { ConditionGroup, Effect } from '../entities/narrative.js';

/**
 * Addendum 25 stages 5–7: objects, triggers, the environment, puzzles, shots,
 * dialogue and choice behaviour — every one of them evaluated by the one
 * evaluator, or written for Game Studio and evaluated by nothing.
 */

const set = (targetId: string, value: string): Effect => ({ kind: 'set', targetId, value, timing: 'immediate', note: '' });
const grant = (targetId: string): Effect => ({ kind: 'grant', targetId, value: '1', timing: 'immediate', note: '' });
const is = (subjectId: string, value: string): ConditionGroup => ({
  join: 'all',
  conditions: [{ subject: 'state', subjectId, op: 'is', value }],
  groups: [],
});

/** The Vault Door scene, one node on the spine, with a lever placed in it. */
const vault = () => {
  let file: ProjectFile = { ...createProjectFile({ title: 'The Sunken Vault', format: 'game' }), units: [], beats: [] };
  const door = dropIntoLane(file, { card: 'scene', afterUnitId: null, name: 'The Vault Door' });
  file = door.file;
  const unitId = unitsInStoryOrder(file)[0]!.id;
  const lever = addObject(file, { name: 'Rusted Lever', states: ['down', 'up'], placedAt: [unitId as string] });
  file = lever.file;
  const pull = addVerb(file, lever.object.id, { name: 'Pull' });
  file = updateVerb(pull.file, lever.object.id, pull.verb.id, {
    conditions: is(lever.object.stateId as string, 'down'),
    effects: [set(lever.object.stateId as string, 'up')],
  });
  return { file, door: door.element, unitId, lever: lever.object, pull: pull.verb };
};

describe('interactive objects', () => {
  it('own a state whose values are theirs, and which follows their name', () => {
    let { file, lever } = vault();
    const owned = statesOf(file).find((one) => one.id === lever.stateId)!;
    expect([owned.key, owned.kind, owned.initial, owned.choices]).toEqual(['rusted_lever_state', 'enum', 'down', ['down', 'up']]);
    expect(ownerOfState(file, lever.stateId)).toMatchObject({ kind: 'object', name: 'Rusted Lever' });
    file = updateObject(file, lever.id, { name: 'Iron Wheel' });
    file = setObjectStates(file, lever.id, ['shut', 'turned']);
    const renamed = statesOf(file).find((one) => one.id === lever.stateId)!;
    expect([renamed.key, renamed.choices, renamed.initial]).toEqual(['iron_wheel_state', ['shut', 'turned'], 'shut']);
  });

  it('offer their verbs where they are placed, decided like a choice', () => {
    const { file, door, lever, pull } = vault();
    const start = beginRun(file)!;
    const [offer] = verbsAt(file, start.state, door.id);
    expect([offer!.verb.name, offer!.available]).toEqual(['Pull', true]);
    const pulled = useVerb(file, start.state, door.id, pull.id);
    expect(pulled.at).toBe(door.id);
    expect(pulled.state.states[lever.stateId as string]).toBe('up');
    // Pulled once, it cannot be pulled again, and it says why.
    const again = useVerb(file, pulled.state, door.id, pull.id);
    expect(again.refused.map((one) => one.says)).toEqual(['rusted_lever_state is down']);
  });

  it('are offered nowhere they are not placed', () => {
    let { file, door, lever, unitId } = vault();
    file = placeObject(file, lever.id, unitId as string, false);
    expect(verbsAt(file, initialState(file), door.id)).toEqual([]);
  });

  it('take their state and every rule about it with them when removed', () => {
    let { file, door, lever } = vault();
    const opens = addElement(file, { name: 'The Vault Opens' });
    file = opens.file;
    const go = addChoice(file, { elementId: door.id, text: 'Open the door', toElementId: opens.element.id });
    file = updateChoice(go.file, go.choice.id, { conditions: is(lever.stateId as string, 'up') });
    file = removeObject(file, lever.id);
    expect(statesOf(file).some((one) => one.id === lever.stateId)).toBe(false);
    expect(choicesAt(file, door.id)[0]!.conditions.conditions).toEqual([]);
  });
});

describe('triggers', () => {
  it('fire when their condition holds after a step, once, and say so in the log', () => {
    let { file, unitId, door, lever, pull } = vault();
    const made = addTrigger(file, unitId, { name: 'Water drains', kind: 'State change' });
    const drained = addResource(made.file, { name: 'Drained seam', kind: 'collectible' });
    file = updateTrigger(drained.file, unitId, made.trigger.id, {
      conditions: is(lever.stateId as string, 'up'),
      effects: [grant(drained.resource.id as string)],
    });
    const start = beginRun(file)!;
    expect(start.state.resources[drained.resource.id as string]).toBe(0);
    const pulled = useVerb(file, start.state, door.id, pull.id);
    expect(pulled.state.resources[drained.resource.id as string]).toBe(1);
    expect(pulled.log.map((one) => one.says)).toContain('Water drains: Drained seam 0 → 1');
    // Once: settling again changes nothing.
    expect(settle(file, pulled.state, door.id).log).toEqual([]);
    expect(systemicLayer(file, unitId).triggers[0]!.says).toBe('WHEN rusted_lever_state is up → DO give 1 Drained seam (once)');
  });
});

describe('puzzles', () => {
  it('are solved the moment their solution holds, run onSolve once, and gate like any state', () => {
    let { file, unitId, door, lever, pull } = vault();
    const key = addResource(file, { name: 'Vault Key', kind: 'key_item' });
    file = key.file;
    const made = addPuzzle(file, { name: 'The Vault Door', unitId });
    file = updatePuzzle(made.file, made.puzzle.id, {
      objective: 'Drain the seam, then turn the key',
      solution: is(lever.stateId as string, 'up'),
      onSolve: [grant(key.resource.id as string)],
    });
    const flag = made.puzzle.solvedStateId as string;
    expect(statesOf(file).find((one) => one.id === flag)!.key).toBe('the_vault_door_solved');

    // A way on that needs the puzzle solved: an ordinary gate on its flag.
    const opens = addElement(file, { name: 'The Vault Opens' });
    file = opens.file;
    const go = addChoice(file, { elementId: door.id, text: 'Step inside', toElementId: opens.element.id });
    file = updateChoice(go.file, go.choice.id, { conditions: is(flag, 'true') });

    const start = beginRun(file)!;
    expect(evaluate(file, start.state, door.id)!.choices[0]!.available).toBe(false);
    const pulled = useVerb(file, start.state, door.id, pull.id);
    expect(pulled.state.states[flag]).toBe('true');
    expect(pulled.state.resources[key.resource.id as string]).toBe(1);
    expect(pulled.log.map((one) => one.says)).toContain('The Vault Door is solved');
    expect(evaluate(file, pulled.state, door.id)!.choices[0]!.available).toBe(true);
    // Solved once: nothing runs twice.
    expect(settle(file, pulled.state, door.id).log).toEqual([]);

    // Removing the puzzle takes its flag and the gate on it.
    file = removePuzzle(file, made.puzzle.id);
    expect(choicesAt(file, door.id)[0]!.conditions.conditions).toEqual([]);
  });

  it('shows on the Player Lane and the board with the lever', () => {
    let { file, unitId } = vault();
    file = addPuzzle(file, { name: 'The Vault Door', unitId }).file;
    const [scene] = playerLane(file);
    expect(scene!.items.map((one) => [one.kind, one.text])).toEqual([
      ['interact', 'Pull Rusted Lever'],
      ['overcome', 'The Vault Door'],
    ]);
    expect(sceneBoard(file, unitId).filter((one) => one.kind === 'object' || one.kind === 'puzzle').map((one) => one.name)).toEqual([
      'Rusted Lever',
      'The Vault Door',
    ]);
  });
});

describe('the checks read rules off the graph too', () => {
  it('count a key handed out by pulling a lever as a key the game gives', () => {
    let { file, door, lever, pull } = vault();
    const key = addResource(file, { name: 'Vault Key', kind: 'key_item' });
    file = key.file;
    file = updateVerb(file, lever.id, pull.id, {
      conditions: is(lever.stateId as string, 'down'),
      effects: [set(lever.stateId as string, 'up'), grant(key.resource.id as string)],
    });
    const opens = addElement(file, { name: 'The Vault Opens' });
    file = opens.file;
    const go = addChoice(file, { elementId: door.id, text: 'Turn the key', toElementId: opens.element.id });
    file = updateChoice(go.file, go.choice.id, {
      conditions: { join: 'all', conditions: [{ subject: 'resource', subjectId: key.resource.id, op: 'at_least', value: '1' }], groups: [] },
    });
    const about = narrativeFindings(file).filter((one) => one.says.includes('Vault Key'));
    expect(about).toEqual([]);
  });
});

describe('choice behaviour', () => {
  it('offers a once-only choice once, and says why not after', () => {
    let { file, door } = vault();
    const look = addChoice(file, { elementId: door.id, text: 'Examine the seam' });
    file = updateChoice(look.file, look.choice.id, { repeat: 'once' });
    const start = beginRun(file)!;
    const looked = choose(file, start.state, door.id, look.choice.id);
    expect(looked.refused).toEqual([]);
    const again = evaluate(file, looked.state, door.id)!.choices.find((one) => one.choice.id === look.choice.id)!;
    expect(again.available).toBe(false);
    expect(again.blockedBy.map((one) => one.says)).toEqual(['already chosen, and it can only be chosen once']);
  });

  it('makes a node’s choices mutually exclusive with one state and one rule each', () => {
    let { file, door } = vault();
    file = addChoice(file, { elementId: door.id, text: 'Side with Mara' }).file;
    file = addChoice(file, { elementId: door.id, text: 'Side with the Warden' }).file;
    file = makeChoicesExclusive(file, door.id);
    const state = statesOf(file).find((one) => one.key === 'the_vault_door_choice')!;
    expect(state.choices).toEqual(['Side with Mara', 'Side with the Warden']);
    const [mara, warden] = choicesAt(file, door.id);
    const start = beginRun(file)!;
    const sided = choose(file, start.state, door.id, mara!.id);
    const now = evaluate(file, sided.state, door.id)!;
    expect(now.choices.find((one) => one.choice.id === warden!.id)!.available).toBe(false);
    expect(now.choices.find((one) => one.choice.id === mara!.id)!.available).toBe(false);
  });

  it('keeps an ANY group whole when it adds the exclusion', () => {
    let { file, door } = vault();
    const a = addChoice(file, { elementId: door.id, text: 'A' });
    file = updateChoice(a.file, a.choice.id, { conditions: { join: 'any', conditions: [], groups: [] } });
    file = addChoice(file, { elementId: door.id, text: 'B' }).file;
    file = makeChoicesExclusive(file, door.id);
    const [first] = choicesAt(file, door.id);
    expect(first!.conditions.join).toBe('all');
    expect(first!.conditions.groups[0]!.join).toBe('any');
  });
});

describe('saved paths', () => {
  it('record and replay a verb, and say so when its object has gone', () => {
    let { file, door, lever, pull } = vault();
    const run = startRun(file, { startedAt: door.id })!;
    file = run.file;
    const stepped = recordStep(file, run.run.id, pull.id as never);
    expect(stepped.refused).toEqual([]);
    file = stepped.file;
    const played = replayRun(file, file.simulationRuns[0]!);
    expect(played.state.states[lever.stateId as string]).toBe('up');
    expect(played.steps[0]!.used?.verb.name).toBe('Pull');

    const gone = placeObject(file, lever.id, lever.placedAt[0]!, false);
    const broken = replayRun(gone, gone.simulationRuns[0]!);
    expect(broken.brokenAt).toBe(0);
    expect(broken.steps[0]!.refused[0]!.says).toBe('the object it used is no longer here');
  });
});

describe('the environment and the cinematic', () => {
  it('keeps a location’s mechanics as authored intent, evaluated by nothing', () => {
    const { file: start } = vault();
    const place = addLocation(start, { name: 'The Fork' });
    const made = addMechanic(place.file, place.location.id, { kind: 'Traversal', variant: 'Crawl', note: 'Narrow squeeze on the left' });
    expect(mechanicsOf(made.file, place.location.id).map((one) => [one.kind, one.variant])).toEqual([['Traversal', 'Crawl']]);
    expect(made.file.environments).toHaveLength(1);
  });

  it('keeps a cinematic’s shots and an unbound conversation’s lines on the node', () => {
    let { file } = vault();
    const scene = addElement(file, { name: 'The Vault Opens', kind: 'cinematic' });
    file = updateElement(scene.file, scene.element.id, {
      skippable: false,
      shots: [{ id: '00000000-0000-4000-8000-000000000001' as never, camera: 'Low wide', action: 'The door swings in', lines: [], audio: 'Rumble', seconds: 4 }],
      lines: [{ characterId: null, text: 'They were here.', direction: 'barely a whisper' }],
    });
    const node = file.narrativeElements.find((one) => one.id === scene.element.id)!;
    expect([node.skippable, node.shots[0]!.camera, node.lines[0]!.text]).toEqual([false, 'Low wide', 'They were here.']);
  });
});
