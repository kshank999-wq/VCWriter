import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addBeat, addUnit } from '../mutations.js';
import { addChoice, addElement, addState, updateElement } from '../narrative.js';
import { choicesFor, describeGraph, describeNode, narrativeMap, wouldBeEntry } from '../narrative-map.js';
import type { Condition, ConditionGroup } from '../entities/narrative.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Interactive Narrative, stage 4 (addendum 18 §1, §9).
 *
 * The decision under test is that **the layout is derived**: nothing is stored,
 * nowhere is draggable, and every placement follows from the graph. So the
 * tests that matter are the ones where something changes and the picture
 * changes with it, having run nothing.
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

const all = (...conditions: Condition[]): ConditionGroup => ({ join: 'all', conditions, groups: [] });

/** Start → left, right; both → the bridge. The smallest branch and converge. */
const diamond = () => {
  let file = game();
  const start = addElement(file, { name: 'Cold open' });
  file = start.file;
  const left = addElement(file, { name: 'The vent' });
  file = left.file;
  const right = addElement(file, { name: 'The corridor' });
  file = right.file;
  const bridge = addElement(file, { name: 'The bridge' });
  file = updateElement(bridge.file, bridge.element.id, { endsHere: true });

  for (const to of [left.element.id, right.element.id]) {
    file = addChoice(file, { elementId: start.element.id, toElementId: to }).file;
  }
  for (const from of [left.element.id, right.element.id]) {
    file = addChoice(file, { elementId: from, toElementId: bridge.element.id }).file;
  }
  return { file, start: start.element.id, left: left.element.id, right: right.element.id, bridge: bridge.element.id };
};

describe('where a node sits', () => {
  it('is how many choices from a start, and nobody typed it', () => {
    const made = diamond();
    const map = narrativeMap(made.file);
    const at = (id: string) => map.nodes.find((one) => (one.element.id as string) === id)!;

    expect(at(made.start as string).column).toBe(0);
    expect(at(made.left as string).column).toBe(1);
    expect(at(made.right as string).column).toBe(1);
    expect(at(made.bridge as string).column).toBe(2);
    expect(map.columns).toBe(3);
  });

  /** Draw the edge and the node moves. Nothing was run, nothing was stored. */
  it('moves when an edge is drawn, with nothing arranged', () => {
    const made = diamond();
    const short = addChoice(made.file, { elementId: made.start, toElementId: made.bridge });
    const map = narrativeMap(short.file);
    expect(map.nodes.find((one) => one.element.id === made.bridge)!.column).toBe(1);
  });

  it('holds no position anywhere on the record', () => {
    const made = addElement(game(), { name: 'Cold open' });
    expect(made.element).not.toHaveProperty('x');
    expect(made.element).not.toHaveProperty('y');
  });
});

describe('convergence', () => {
  it('is counted rather than named', () => {
    const made = diamond();
    const map = narrativeMap(made.file);
    expect(map.nodes.find((one) => one.element.id === made.bridge)!.waysIn).toBe(2);
    expect(describeNode(map.nodes.find((one) => one.element.id === made.bridge)!)).toContain('2 ways in');
  });
});

describe('the spine', () => {
  /**
   * §1's *primary path*, drawn rather than declared: the top row read left to
   * right is the story, because the script decides the order.
   */
  it('takes the top row of its column, in the script’s order', () => {
    let file = game();
    const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. REACTOR - NIGHT' });
    file = scene.file;
    const first = addBeat(file, { unitId: scene.unit.id, title: 'One' });
    file = first.file;
    const second = addBeat(file, { unitId: scene.unit.id, title: 'Two' });
    file = second.file;

    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    // Made in the wrong order on purpose: the script decides, not the clock.
    const later = addElement(file, { name: 'Second beat', boundBeatId: second.beat.id });
    file = later.file;
    const sooner = addElement(file, { name: 'First beat', boundBeatId: first.beat.id });
    file = sooner.file;
    const aside = addElement(file, { name: 'A cinematic' });
    file = aside.file;

    for (const to of [later.element.id, sooner.element.id, aside.element.id]) {
      file = addChoice(file, { elementId: start.element.id, toElementId: to }).file;
    }

    const column = narrativeMap(file).nodes.filter((one) => one.column === 1);
    expect(column.map((one) => one.name)).toEqual(['First beat', 'Second beat', 'A cinematic']);
    expect(column[0]!.onSpine).toBe(true);
    expect(column[2]!.onSpine).toBe(false);
  });

  it('marks the link between two nodes the manuscript puts next to each other', () => {
    let file = game();
    const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. REACTOR - NIGHT' });
    file = scene.file;
    const first = addBeat(file, { unitId: scene.unit.id, title: 'One' });
    file = first.file;
    const second = addBeat(file, { unitId: scene.unit.id, title: 'Two' });
    file = second.file;

    const a = addElement(file, { name: 'A', boundBeatId: first.beat.id });
    file = a.file;
    const b = addElement(file, { name: 'B', boundBeatId: second.beat.id });
    file = b.file;
    const aside = addElement(file, { name: 'A cinematic' });
    file = aside.file;
    file = addChoice(file, { elementId: a.element.id, toElementId: b.element.id }).file;
    file = addChoice(file, { elementId: a.element.id, toElementId: aside.element.id }).file;

    const map = narrativeMap(file);
    expect(map.links.filter((one) => one.spine)).toHaveLength(1);
    expect(map.links.find((one) => one.spine)!.to).toBe(b.element.id);
  });

  it('says which scene a node is in, and nothing about one that is in none', () => {
    let file = game();
    // The scene a new project opens with, and a second one after it.
    const opening = file.beats[0]!;
    const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. REACTOR - NIGHT' });
    file = scene.file;
    const later = addBeat(file, { unitId: scene.unit.id, title: 'One' });
    file = later.file;

    file = addElement(file, { name: 'A', boundBeatId: opening.id }).file;
    file = addElement(file, { name: 'B', boundBeatId: later.beat.id }).file;
    file = addElement(file, { name: 'A cinematic' }).file;

    const map = narrativeMap(file);
    const at = (name: string) => map.nodes.find((one) => one.name === name)!;
    expect(at('A').scenePosition).toBe(1);
    expect(at('B').scenePosition).toBe(2);
    expect(at('A cinematic').scenePosition).toBeNull();
    expect(describeNode(at('B'))).toContain('scene 2');
  });
});

describe('a node nothing reaches', () => {
  /**
   * Drawn, never dropped. A map that quietly omitted it would hide the thing
   * the validator is shouting about.
   */
  it('is placed at the end and drawn stranded', () => {
    const made = diamond();
    const island = addElement(made.file, { name: 'The vault' });
    const map = narrativeMap(island.file);
    const at = map.nodes.find((one) => one.name === 'The vault')!;
    expect(at.stranded).toBe(true);
    expect(at.column).toBe(3);
    expect(map.strandedCount).toBe(1);
    expect(describeNode(at)).toContain('nothing leads here');
  });

  it('can be dropped when a designer asks, and only then', () => {
    const made = diamond();
    const island = addElement(made.file, { name: 'The vault' });
    expect(narrativeMap(island.file, { includeStranded: false }).nodes.map((one) => one.name)).not.toContain(
      'The vault',
    );
  });
});

describe('a link back', () => {
  it('is marked, because a hub’s return is not a step forward', () => {
    let file = game();
    const hub = addElement(file, { name: 'The hub' });
    file = hub.file;
    const room = addElement(file, { name: 'The lab' });
    file = room.file;
    file = addChoice(file, { elementId: hub.element.id, toElementId: room.element.id }).file;
    file = addChoice(file, { elementId: room.element.id, toElementId: hub.element.id }).file;

    const map = narrativeMap(file);
    expect(map.links.filter((one) => one.back)).toHaveLength(1);
    expect(map.links.find((one) => one.back)!.to).toBe(hub.element.id);
  });
});

describe('what a card says about itself', () => {
  it('is read off the graph and never typed', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const room = addElement(file, { name: 'The safe room' });
    file = updateElement(room.file, room.element.id, {
      endsHere: true,
      conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }),
      effects: [{ kind: 'set', targetId: flag.state.id as string, value: 'true', timing: 'immediate', note: '' }],
    });
    file = addChoice(file, { elementId: start.element.id, toElementId: room.element.id }).file;

    const node = narrativeMap(file).nodes.find((one) => one.name === 'The safe room')!;
    expect(node.gated).toBe(true);
    expect(node.changes).toBe(true);
    expect(describeNode(node)).toBe('ends here · gated · changes the world');

    // The way in says so in words. The card carries a gold stripe as well, and
    // a stripe explains itself to nobody.
    const wayIn = narrativeMap(file).nodes.find((one) => one.name === 'Cold open')!;
    expect(describeNode(wayIn)).toBe('starts here · 1 way on');
  });

  /** Stage 3 arrives on the card: a finding a designer cannot see is not one. */
  it('carries the count of what the validator says about it', () => {
    let file = game();
    const start = addElement(file, { name: 'Cold open' });
    file = addChoice(start.file, { elementId: start.element.id, name: 'Shrug' }).file;
    const node = narrativeMap(file).nodes[0]!;
    // A dead end nobody marked, and a choice that does nothing.
    expect(node.findings).toBe(2);
  });
});

describe('the filters', () => {
  it('reach both ways from the focus, because a convergence is what you clicked', () => {
    const made = diamond();
    const map = narrativeMap(made.file, { focusId: made.bridge, within: 1 });
    expect(map.nodes.map((one) => one.name).sort()).toEqual(['The bridge', 'The corridor', 'The vent']);
  });

  it('search a name and a note', () => {
    const made = diamond();
    expect(narrativeMap(made.file, { search: 'vent' }).nodes.map((one) => one.name)).toEqual(['The vent']);
  });

  it('drop a link whose other end is filtered away', () => {
    const made = diamond();
    const map = narrativeMap(made.file, { search: 'vent' });
    expect(map.links).toEqual([]);
  });

  it('keep the kinds asked for', () => {
    let file = game();
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const ending = addElement(file, { name: 'She stays' });
    file = updateElement(ending.file, ending.element.id, { kind: 'ending' });
    expect(narrativeMap(file, { kinds: ['ending'] }).nodes.map((one) => one.name)).toEqual(['She stays']);
  });
});

describe('the sentence above it', () => {
  it('counts what is there', () => {
    const made = diamond();
    expect(describeGraph(made.file, narrativeMap(made.file))).toBe(
      '4 nodes · 4 connections · 1 converging.',
    );
  });

  it('says the board is empty rather than showing nothing', () => {
    const file = game();
    expect(describeGraph(file, narrativeMap(file))).toBe('Nothing on the board yet. Add a node to start the graph.');
  });

  it('says a filter matched nothing, which is a different thing', () => {
    const made = diamond();
    expect(describeGraph(made.file, narrativeMap(made.file, { search: 'zzz' }))).toBe('Nothing matches that.');
  });
});

describe('the inspector’s list', () => {
  it('gives every choice with where it goes', () => {
    const made = diamond();
    const rows = choicesFor(made.file, made.start);
    expect(rows).toHaveLength(2);
    expect(rows.map((one) => one.to?.name)).toEqual(['The vent', 'The corridor']);
  });

  it('knows the first node made will be the way in', () => {
    expect(wouldBeEntry(game())).toBe(true);
    expect(wouldBeEntry(addElement(game(), { name: 'Cold open' }).file)).toBe(false);
  });
});
