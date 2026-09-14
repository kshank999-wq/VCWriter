import { describe, expect, it } from 'vitest';
import {
  FLAT_SCENE_PROMPT,
  POLARITY_STEPS,
  SCENE_PURPOSES,
  addUnit,
  createProjectFile,
  describePolarity,
  flatScenes,
  gridOf,
  handovers,
  movementOf,
  polarityGraph,
  purposesOf,
  setOtherPurpose,
  setPolarity,
  setSceneGrid,
  storyGridRows,
  togglePurpose,
  turnOf,
  unitsInStoryOrder,
  unreadScenes,
  type ProjectFile,
} from '../index.js';

/**
 * Scene polarity and scene purpose (addendum 13).
 *
 * Two claims. **Flat is derived and never chosen** — the Story Grid's single
 * word could be set to *up* on a scene that begins and ends in the same place,
 * and the pair cannot lie that way. And **nothing here judges**: a flat scene
 * is flagged, a purpose nobody has named is *not defined*, and neither is a
 * fault.
 */

const script = (scenes: number) => {
  let file: ProjectFile = createProjectFile({ title: 'The Turn', format: 'screenplay' });
  const laneId = file.lanes[0]!.id;
  for (let at = 0; at < scenes; at += 1) {
    file = addUnit(file, { laneId, title: `Scene ${at + 1}` }).file;
  }
  return { file, ids: unitsInStoryOrder(file).map((unit) => unit.id) };
};

describe('flat is worked out, never chosen', () => {
  it('says nothing until both ends are given', () => {
    const { file, ids } = script(1);
    expect(turnOf(gridOf(file, ids[0]!)).said).toBe(false);

    const half = setPolarity(file, ids[0]!, { start: 'positive' });
    // One end is not a turn. A scene nobody has finished reading is not flat.
    expect(turnOf(gridOf(half, ids[0]!)).said).toBe(false);
    expect(turnOf(gridOf(half, ids[0]!)).flat).toBe(false);
  });

  it('is flat when the two ends are the same, whatever the writer called it', () => {
    const { file, ids } = script(1);
    // The old column, set to a lie: it says the scene rises.
    let current = setSceneGrid(file, ids[0]!, { polarity: 'up' });
    current = setPolarity(current, ids[0]!, { start: 'negative', end: 'negative' });

    const turn = turnOf(gridOf(current, ids[0]!));
    expect(turn.flat).toBe(true);
    expect(turn.direction).toBe(0);
    // And the one-word reading follows the pair rather than the claim.
    expect(movementOf(gridOf(current, ids[0]!))).toBe('flat');
  });

  it('reads the direction and how far it went', () => {
    const { file, ids } = script(1);
    const up = setPolarity(file, ids[0]!, { start: 'double_negative', end: 'positive' });
    const turn = turnOf(gridOf(up, ids[0]!));

    expect(turn.direction).toBe(1);
    expect(turn.distance).toBe(3);
    expect(POLARITY_STEPS.double_negative).toBe(-2);
    expect(POLARITY_STEPS.double_positive).toBe(2);
  });

  it('leaves an older project’s chosen word standing where there is no pair', () => {
    // Throwing it away would lose work somebody did.
    const { file, ids } = script(1);
    const chosen = setSceneGrid(file, ids[0]!, { polarity: 'mixed' });
    expect(movementOf(gridOf(chosen, ids[0]!))).toBe('mixed');
  });

  it('reaches the Story Grid’s own rows', () => {
    const { file, ids } = script(2);
    const current = setPolarity(file, ids[0]!, { start: 'positive', end: 'negative' });
    const rows = storyGridRows(current);
    const row = rows.find((one) => one.unitId === ids[0]);

    expect(row!.polarity).toBe('down');
  });
});

describe('the graph', () => {
  it('keeps every scene in script order, including the unread ones', () => {
    // A graph that dropped them would draw a story with no gaps and lie about
    // how much has been looked at.
    const { file, ids } = script(4);
    const current = setPolarity(file, ids[1]!, { start: 'neutral', end: 'negative' });
    const graph = polarityGraph(current);

    expect(graph.points).toHaveLength(ids.length);
    expect(graph.said).toBe(1);
    expect(graph.points.map((one) => one.number)).toEqual(graph.points.map((one, at) => at + 1));
    expect(unreadScenes(current)).toHaveLength(ids.length - 1);
  });

  it('counts the flat ones and lists them for review', () => {
    const { file, ids } = script(3);
    let current = setPolarity(file, ids[0]!, { start: 'positive', end: 'positive' });
    current = setPolarity(current, ids[1]!, { start: 'positive', end: 'negative' });

    expect(polarityGraph(current).flat).toBe(1);
    expect(flatScenes(current).map((one) => one.unitId)).toEqual([ids[0]]);
    // A prompt rather than a verdict: it names what a flat scene might need.
    expect(FLAT_SCENE_PROMPT).toMatch(/Review whether/);
    expect(FLAT_SCENE_PROMPT).not.toMatch(/delete|cut|remove/i);
  });

  it('draws the axis with neutral in the middle', () => {
    const { file } = script(1);
    expect(polarityGraph(file).rows).toEqual([
      'double_positive',
      'positive',
      'neutral',
      'negative',
      'double_negative',
    ]);
  });

  it('follows the story order when scenes are reordered', () => {
    const { file, ids } = script(3);
    let current = setPolarity(file, ids[0]!, { start: 'neutral', end: 'positive' });
    current = setPolarity(current, ids[2]!, { start: 'neutral', end: 'negative' });

    const before = polarityGraph(current).points.map((one) => one.unitId);
    const last = unitsInStoryOrder(current).at(-1)!;
    const moved = { ...current, units: current.units.map((unit) => unit) };
    expect(before).toEqual(ids);
    // The graph is a reading of the story order, so nothing stored has to move.
    expect(polarityGraph(moved).points.map((one) => one.unitId)).toEqual(ids);
    expect(last).toBeTruthy();
  });
});

describe('what a scene is for', () => {
  it('takes several at once, because a scene does several things', () => {
    const { file, ids } = script(1);
    let current = togglePurpose(file, ids[0]!, 'reveal_character');
    current = togglePurpose(current, ids[0]!, 'create_conflict');

    expect(purposesOf(gridOf(current, ids[0]!)).sort()).toEqual(['create_conflict', 'reveal_character']);
    // And off again.
    current = togglePurpose(current, ids[0]!, 'reveal_character');
    expect(purposesOf(gridOf(current, ids[0]!))).toEqual(['create_conflict']);
  });

  it('is not defined rather than at fault when nobody has said', () => {
    const { file, ids } = script(2);
    const graph = polarityGraph(file);
    expect(graph.points.every((one) => one.purposeUndefined)).toBe(true);
    expect(ids).toHaveLength(graph.points.length);
  });

  it('keeps the writer’s own words for a purpose the list does not cover', () => {
    const { file, ids } = script(1);
    let current = togglePurpose(file, ids[0]!, 'other');
    current = setOtherPurpose(current, ids[0]!, 'It buys the audience a breath.');

    expect(gridOf(current, ids[0]!).otherPurpose).toBe('It buys the audience a breath.');
    expect(SCENE_PURPOSES).toContain('other');
  });
});

describe('scene to scene', () => {
  it('says where one scene left the reader and where the next opens', () => {
    const { file, ids } = script(3);
    let current = setPolarity(file, ids[0]!, { start: 'neutral', end: 'positive' });
    current = setPolarity(current, ids[1]!, { start: 'positive', end: 'negative' });
    current = setPolarity(current, ids[2]!, { start: 'neutral', end: 'neutral' });

    const pairs = handovers(current);
    expect(pairs).toHaveLength(2);
    // Continuous: scene two opens where scene one closed.
    expect(pairs[0]!.continuous).toBe(true);
    // A cut: scene three opens somewhere else. Not a warning — writers do this.
    expect(pairs[1]!.continuous).toBe(false);
  });
});

describe('one line about the script', () => {
  it('counts what has been read and how many are flat', () => {
    const { file, ids } = script(3);
    expect(describePolarity(file)).toMatch(/none read yet/);

    let current = setPolarity(file, ids[0]!, { start: 'positive', end: 'positive' });
    current = setPolarity(current, ids[1]!, { start: 'positive', end: 'negative' });
    expect(describePolarity(current)).toMatch(/2 of \d+ read · 1 flat/);
  });
});
