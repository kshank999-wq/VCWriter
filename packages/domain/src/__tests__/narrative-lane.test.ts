import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import type { ProjectFile } from '../project-file.js';
import { addChoice, addElement, choicesAt, elementsOf, entryPoints } from '../narrative.js';
import { dropIntoLane, dropOnConnection, laneSlots } from '../narrative-lane.js';
import { narrativeMap } from '../narrative-map.js';
import { narrativeFindings } from '../narrative-check.js';
import { beatsForUnit, unitsInStoryOrder } from '../selectors.js';
import type { NarrativeElement } from '../entities/narrative.js';

/**
 * Addendum 25 §4.3: the spine through the middle, branches above and below,
 * and scenes and beats dropped into the lane — each drop an edit to the
 * story, never a position.
 */

/** A new game project, which already holds one empty scene: *Opening Scene*. */
const game = (): ProjectFile => createProjectFile({ title: 'The Sunken Vault', format: 'game' });

/** Three scenes dropped one after another onto the end of the lane. */
const threeScenes = () => {
  let file = game();
  const names = ['The Cave Mouth', 'The Fork', 'The Vault Door'];
  const nodes: NarrativeElement[] = [];
  for (const name of names) {
    const after = unitsInStoryOrder(file).at(-1)?.id ?? null;
    const dropped = dropIntoLane(file, { card: 'scene', afterUnitId: after, name });
    file = dropped.file;
    nodes.push(dropped.element);
  }
  return { file, nodes };
};

const waysOn = (file: ProjectFile, node: NarrativeElement) =>
  choicesAt(file, node.id).map((one) => one.toElementId);

describe('dropping into the lane', () => {
  it('writes the scene in the story order first, then a node bound to it', () => {
    const { file, element } = dropIntoLane(game(), { card: 'scene', afterUnitId: null, name: 'The Cave Mouth' });
    const [unit] = unitsInStoryOrder(file);
    expect(unit!.title).toBe('The Cave Mouth');
    const [beat] = beatsForUnit(file, unit!.id);
    expect(element.boundBeatId).toBe(beat!.id);
    // The first node is where the game starts, as addendum 18 decided.
    expect(entryPoints(file).map((one) => one.id)).toEqual([element.id]);
  });

  it('carries the story on when scenes are dropped one after another on the end', () => {
    const { file, nodes } = threeScenes();
    expect(waysOn(file, nodes[0]!)).toEqual([nodes[1]!.id]);
    expect(waysOn(file, nodes[1]!)).toEqual([nodes[2]!.id]);
    expect(waysOn(file, nodes[2]!)).toEqual([]);
    // Nothing is stranded, so the checks have nothing to say about reachability.
    expect(narrativeFindings(file).filter((one) => one.check === 'unreachable')).toEqual([]);
  });

  it('splices a scene dropped between two connected scenes into the route', () => {
    const { file: before, nodes } = threeScenes();
    const fork = unitsInStoryOrder(before)[2]!;
    const { file, element } = dropIntoLane(before, { card: 'scene', afterUnitId: fork.id, name: 'The Squeeze' });
    expect(unitsInStoryOrder(file).map((one) => one.title)).toEqual([
      'Opening Scene', 'The Cave Mouth', 'The Fork', 'The Squeeze', 'The Vault Door',
    ]);
    expect(waysOn(file, nodes[1]!)).toEqual([element.id]);
    expect(waysOn(file, element)).toEqual([nodes[2]!.id]);
  });

  it('does not guess a connection between scenes the designer left unconnected', () => {
    let file = game();
    const a = dropIntoLane(file, { card: 'scene', afterUnitId: null, name: 'A' });
    file = a.file;
    // B is a second start, connected to nothing: the designer's branching.
    const b = dropIntoLane(file, { card: 'scene', afterUnitId: unitsInStoryOrder(file)[0]!.id, name: 'B' });
    file = b.file;
    // A offered no way on, so B was joined on the end. Take that away again
    // and drop between them: nothing to splice, nothing invented.
    file = { ...file, choices: [] };
    const c = dropIntoLane(file, { card: 'scene', afterUnitId: unitsInStoryOrder(file)[0]!.id, name: 'C' });
    expect(c.file.choices).toEqual([]);
  });

  it('takes over the start when dropped before the first scene', () => {
    const { file: before, nodes } = threeScenes();
    const { file, element } = dropIntoLane(before, { card: 'scene', afterUnitId: null, name: 'Prologue' });
    expect(unitsInStoryOrder(file)[0]!.title).toBe('Prologue');
    expect(entryPoints(file).map((one) => one.id)).toEqual([element.id]);
    expect(waysOn(file, element)).toEqual([nodes[0]!.id]);
  });

  it('puts a beat card in the scene to the left of where it was dropped', () => {
    const { file: before, nodes } = threeScenes();
    const fork = unitsInStoryOrder(before)[2]!;
    const { file, element } = dropIntoLane(before, { card: 'beat', afterUnitId: fork.id, name: 'Mara hesitates' });
    expect(unitsInStoryOrder(file)).toHaveLength(4);
    const beats = beatsForUnit(file, fork.id);
    expect(beats.map((one) => one.title)).toEqual(['The Fork', 'Mara hesitates']);
    expect(element.boundBeatId).toBe(beats[1]!.id);
    expect(waysOn(file, nodes[1]!)).toEqual([element.id]);
    expect(waysOn(file, element)).toEqual([nodes[2]!.id]);
  });

  it('offers a slot before the first scene and after each one', () => {
    const { file } = threeScenes();
    expect(laneSlots(file).map((one) => one.label)).toEqual([
      'Before the first scene', 'After Opening Scene', 'After The Cave Mouth', 'After The Fork', 'After The Vault Door',
    ]);
    const empty = { ...game(), units: [], beats: [] };
    expect(laneSlots(empty)[0]!.label).toBe('Start the story');
  });
});

describe('dropping onto a connection', () => {
  it('puts the new node between the two ends, keeping every other rule', () => {
    const { file: before, nodes } = threeScenes();
    const [link] = choicesAt(before, nodes[0]!.id);
    const { file, element } = dropOnConnection(before, { card: 'scene', choiceId: link!.id, name: 'The Ledge' });
    // The same choice, now leading to the new node: its text and rules stay.
    expect(choicesAt(file, nodes[0]!.id).map((one) => [one.id, one.toElementId])).toEqual([[link!.id, element.id]]);
    expect(waysOn(file, element)).toEqual([nodes[1]!.id]);
    expect(unitsInStoryOrder(file).map((one) => one.title)).toEqual([
      'Opening Scene', 'The Cave Mouth', 'The Ledge', 'The Fork', 'The Vault Door',
    ]);
  });

  it('refuses a choice that leads nowhere', () => {
    let file = game();
    const a = addElement(file, { name: 'Examine the wall' });
    const c = addChoice(a.file, { elementId: a.element.id, text: 'Look closer' });
    expect(() => dropOnConnection(c.file, { card: 'scene', choiceId: c.choice.id })).toThrow(/leads nowhere/);
    file = c.file;
    expect(elementsOf(file)).toHaveLength(1);
  });
});

describe('the lane on the map', () => {
  it('runs the spine along one row, in the story order', () => {
    const { file, nodes } = threeScenes();
    const map = narrativeMap(file);
    const lane = map.nodes.filter((one) => one.lane === 'spine');
    expect(lane.map((one) => one.element.id)).toEqual(nodes.map((one) => one.id));
    expect(new Set(lane.map((one) => one.row))).toEqual(new Set([map.laneRow]));
  });

  it('draws branches above and below the lane, and keeps a branch on the side it left by', () => {
    const { file: spine, nodes } = threeScenes();
    let file = spine;
    // Two branches off the first scene, and a branch off the first branch.
    const up = addElement(file, { name: 'Climb the shaft' });
    file = addChoice(up.file, { elementId: nodes[0]!.id, toElementId: up.element.id }).file;
    const down = addElement(file, { name: 'Wade the pool' });
    file = addChoice(down.file, { elementId: nodes[0]!.id, toElementId: down.element.id }).file;
    const further = addElement(file, { name: 'The high gallery' });
    file = addChoice(further.file, { elementId: up.element.id, toElementId: further.element.id }).file;

    const map = narrativeMap(file);
    const at = (id: string) => map.nodes.find((one) => one.element.id === id)!;
    expect(at(up.element.id).lane).toBe('above');
    expect(at(down.element.id).lane).toBe('below');
    expect(at(further.element.id).lane).toBe(at(up.element.id).lane);
    expect(at(up.element.id).row).toBeLessThan(map.laneRow);
    expect(at(down.element.id).row).toBeGreaterThan(map.laneRow);
  });

  it('stores no position anywhere: the drop is an edit, and the layout is read', () => {
    const { file } = threeScenes();
    for (const node of elementsOf(file)) {
      expect(Object.keys(node)).not.toContain('x');
      expect(Object.keys(node)).not.toContain('y');
      expect(Object.keys(node)).not.toContain('row');
    }
  });
});
