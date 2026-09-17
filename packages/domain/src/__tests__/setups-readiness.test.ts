import { describe, expect, it } from 'vitest';
import {
  MINIMUM_VALID_SETUPS,
  addBeat,
  addSetupPayoff,
  addSetupPoint,
  addUnit,
  createProjectFile,
  describePlace,
  describeSetups,
  moveUnit,
  recordPayoff,
  ref,
  removeSetupPoint,
  setupReadiness,
  setupsBoard,
  unitsInStoryOrder,
  updateSetupPayoff,
  type ProjectFile,
  type SetupPayoffId,
} from '../index.js';

/**
 * The three-setup rule (the Setups & Payoffs spec, §7).
 *
 * Two claims carry it. **Only setups before the payoff count** — a setup that
 * falls after it is an explanation, so it stays listed and does not count — and
 * **the answer is read every time rather than stored**, so dragging a scene
 * across the payoff changes the light with nothing run. Everything below is
 * one of those two.
 */

/** A script of `scenes` scenes, one beat each, and a payoff record. */
const script = (scenes: number) => {
  let file: ProjectFile = createProjectFile({ title: 'The Gun', format: 'screenplay' });
  const trackId = file.tracks[0]!.id;
  const beatIds: string[] = [];
  for (let at = 0; at < scenes; at += 1) {
    const scene = addUnit(file, { trackId, title: `Scene ${at + 1}` });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
    file = beat.file;
    beatIds.push(beat.beat.id as string);
  }
  const made = addSetupPayoff(file, { title: 'The gun in the drawer', description: 'It fires in the last act.' });
  const recordId = made.setupsPayoffs[made.setupsPayoffs.length - 1]!.id;
  return { file: made, recordId, beatIds };
};

/** Put a setup on the nth beat. */
const setupAt = (file: ProjectFile, recordId: SetupPayoffId, beatId: string, text = 'a setup') =>
  addSetupPoint(file, {
    setupPayoffId: recordId,
    description: text,
    location: ref('beat', beatId),
    strength: 'written',
    excerpt: text,
  });

const payoffAt = (file: ProjectFile, recordId: SetupPayoffId, beatId: string) =>
  recordPayoff(file, { setupPayoffId: recordId, description: 'It fires.', location: ref('beat', beatId) });

const readOf = (file: ProjectFile, recordId: SetupPayoffId) =>
  setupReadiness(file, file.setupsPayoffs.find((one) => one.id === recordId)!);

describe('the light', () => {
  it('is red on a payoff nobody has prepared, and says the payoff is not placed', () => {
    const { file, recordId } = script(6);
    const read = readOf(file, recordId);

    expect(read.light).toBe('red');
    expect(read.count).toBe(`0 / ${MINIMUM_VALID_SETUPS}`);
    expect(read.payoffPlaced).toBe(false);
    // A payoff nobody has written is a different state from one that is
    // under-prepared, and the sentence has to say which.
    expect(read.says).toMatch(/has not been named in the writing yet/);
  });

  it('stays red at one and two setups, and turns green at three', () => {
    const { file, recordId, beatIds } = script(6);
    let current = payoffAt(file, recordId, beatIds[5]!);

    for (const at of [0, 1]) {
      current = setupAt(current, recordId, beatIds[at]!);
      expect(readOf(current, recordId).light).toBe('red');
    }
    current = setupAt(current, recordId, beatIds[2]!);
    const read = readOf(current, recordId);
    expect(read.light).toBe('green');
    expect(read.count).toBe('3 / 3');
    expect(read.says).toMatch(/Prepared/);
  });

  it('stays green on a fourth and a fifth', () => {
    const { file, recordId, beatIds } = script(7);
    let current = payoffAt(file, recordId, beatIds[6]!);
    for (const at of [0, 1, 2, 3, 4]) current = setupAt(current, recordId, beatIds[at]!);

    const read = readOf(current, recordId);
    expect(read.light).toBe('green');
    expect(read.count).toBe('5 / 3');
  });

  it('goes back to red when a setup is taken away from three', () => {
    const { file, recordId, beatIds } = script(6);
    let current = payoffAt(file, recordId, beatIds[5]!);
    for (const at of [0, 1, 2]) current = setupAt(current, recordId, beatIds[at]!);
    expect(readOf(current, recordId).light).toBe('green');

    const record = current.setupsPayoffs.find((one) => one.id === recordId)!;
    current = removeSetupPoint(current, { setupPayoffId: recordId, setupPointId: record.setups[0]!.id });
    expect(readOf(current, recordId).light).toBe('red');
  });
});

describe('before the payoff is the only thing that counts', () => {
  it('does not count a setup that falls after it, and says why', () => {
    const { file, recordId, beatIds } = script(6);
    let current = payoffAt(file, recordId, beatIds[2]!);
    current = setupAt(current, recordId, beatIds[0]!);
    current = setupAt(current, recordId, beatIds[1]!);
    // This one is after the payoff: it is an explanation, not a setup.
    current = setupAt(current, recordId, beatIds[4]!, 'the late one');

    const read = readOf(current, recordId);
    expect(read.valid).toBe(2);
    expect(read.light).toBe('red');
    // Listed rather than dropped, with a reason.
    expect(read.setups).toHaveLength(3);
    expect(read.setups[2]!.why).toMatch(/after the payoff/);
    expect(read.says).toMatch(/1 falls after it and does not count/);
  });

  it('changes with the story order, because it is read rather than stored', () => {
    const { file, recordId, beatIds } = script(6);
    let current = payoffAt(file, recordId, beatIds[3]!);
    for (const at of [0, 1, 2]) current = setupAt(current, recordId, beatIds[at]!);
    expect(readOf(current, recordId).light).toBe('green');

    // Drag the third setup's scene past the payoff. Nothing runs, and the
    // light is red the next time anybody looks.
    const order = unitsInStoryOrder(current);
    const third = order[2]!;
    current = moveUnit(current, { unitId: third.id, toTrackId: third.trackId, index: 4 });
    expect(readOf(current, recordId).light).toBe('red');
    expect(readOf(current, recordId).valid).toBe(2);

    // And back again.
    const back = unitsInStoryOrder(current).findIndex((unit) => unit.id === third.id);
    expect(back).toBeGreaterThan(2);
    current = moveUnit(current, { unitId: third.id, toTrackId: third.trackId, index: 0 });
    expect(readOf(current, recordId).light).toBe('green');
  });

  it('reads to the beat, so two points in one scene are still ordered', () => {
    let file: ProjectFile = createProjectFile({ title: 'One scene', format: 'screenplay' });
    const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Only' });
    const first = addBeat(scene.file, { unitId: scene.unit.id, title: 'first' });
    const second = addBeat(first.file, { unitId: scene.unit.id, title: 'second' });
    file = addSetupPayoff(second.file, { title: 'In one scene', description: '' });
    const recordId = file.setupsPayoffs[0]!.id;

    // Setup in beat one, payoff in beat two: before, and it counts.
    let current = payoffAt(file, recordId, second.beat.id as string);
    current = setupAt(current, recordId, first.beat.id as string);
    expect(readOf(current, recordId).valid).toBe(1);

    // The other way round, it does not.
    let other = payoffAt(file, recordId, first.beat.id as string);
    other = setupAt(other, recordId, second.beat.id as string);
    expect(readOf(other, recordId).valid).toBe(0);
  });
});

describe('a setup whose writing has gone', () => {
  it('is kept and explained rather than dropped', () => {
    const { file, recordId, beatIds } = script(4);
    let current = payoffAt(file, recordId, beatIds[3]!);
    current = setupAt(current, recordId, beatIds[0]!);
    // A beat id that names nothing: the writing it was on has been cut.
    current = addSetupPoint(current, {
      setupPayoffId: recordId,
      description: 'the cut one',
      location: ref('beat', crypto.randomUUID()),
      strength: 'written',
      excerpt: 'what it used to say',
    });

    const read = readOf(current, recordId);
    expect(read.setups).toHaveLength(2);
    expect(read.setups[1]!.counts).toBe(false);
    expect(read.setups[1]!.why).toMatch(/has gone/);
    expect(read.setups[1]!.point.excerpt).toBe('what it used to say');
  });
});

describe('what a record may ask for', () => {
  it('wants three unless it says otherwise', () => {
    const { file, recordId, beatIds } = script(8);
    let current = updateSetupPayoff(payoffAt(file, recordId, beatIds[7]!), recordId, { minimumSetups: 5 });
    for (const at of [0, 1, 2]) current = setupAt(current, recordId, beatIds[at]!);

    expect(readOf(current, recordId).count).toBe('3 / 5');
    expect(readOf(current, recordId).light).toBe('red');
    for (const at of [3, 4]) current = setupAt(current, recordId, beatIds[at]!);
    expect(readOf(current, recordId).light).toBe('green');
  });
});

describe('the list', () => {
  it('puts the under-prepared first, because that is what it is for', () => {
    const { file, recordId, beatIds } = script(8);
    let current = payoffAt(file, recordId, beatIds[7]!);
    for (const at of [0, 1, 2]) current = setupAt(current, recordId, beatIds[at]!);

    current = addSetupPayoff(current, { title: 'The letter', description: '' });
    const second = current.setupsPayoffs[1]!.id;
    current = payoffAt(current, second, beatIds[6]!);
    current = setupAt(current, second, beatIds[0]!);

    const board = setupsBoard(current);
    expect(board[0]!.record.title).toBe('The letter');
    expect(board[0]!.readiness.light).toBe('red');
    expect(board[1]!.readiness.light).toBe('green');
    expect(describeSetups(current)).toMatch(/1 of 2 is under-prepared/);
  });
});

describe('where a point is', () => {
  it('reads as a scene and a beat, and says so when it is nowhere', () => {
    const { file, beatIds } = script(3);
    // A new project starts with a scene of its own, so the three made here sit
    // after it: the label is the scene's real place in the story.
    const at = unitsInStoryOrder(file).length - 3;
    expect(describePlace(file, ref('beat', beatIds[1]!))).toBe(`Scene ${at + 2} · Beat 1`);
    expect(describePlace(file, null)).toBe('Not placed yet');
    expect(describePlace(file, ref('beat', crypto.randomUUID()))).toMatch(/has gone/);
  });
});
