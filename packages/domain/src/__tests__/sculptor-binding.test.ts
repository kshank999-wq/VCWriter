import { describe, expect, it } from 'vitest';
import {
  addBlock,
  addChild,
  addToTrack,
  addUnit,
  nounsFor,
  sayTrackOffer,
  trackOffer,
  bindKindOf,
  bindNode,
  bindableBeats,
  bindableUnits,
  boundOf,
  createBoard,
  createProjectFile,
  findBoard,
  findNode,
  followCanvas,
  isBound,
  moveNode,
  outOfStep,
  realiseNode,
  removeBeat,
  removeNode,
  removeUnit,
  unbindNode,
  unitsInStoryOrder,
  updateBeat,
  updateNode,
  updateUnit,
  beatsForUnit,
  type Board,
  type ProjectFile,
  type SculptorNodeId,
} from '../index.js';

/**
 * Binding a node to the script (addendum 03 §6), stage 6.
 *
 * **A node is an idea until the writer says otherwise.** Everything here is
 * about what that sentence costs: what it means for the two to be one thing,
 * what happens when one of them goes, and what the board is never allowed to
 * do to the script behind the writer's back.
 */

const boardIn = (file: ProjectFile, board: Board): Board => findBoard(file, board.id) as Board;
const nodeIn = (file: ProjectFile, board: Board, id: SculptorNodeId) => findNode(boardIn(file, board), id);

/** A board with a block, and two scene nodes hanging off it. */
const shaped = (): { file: ProjectFile; board: Board; blockId: SculptorNodeId; first: SculptorNodeId; second: SculptorNodeId } => {
  const made = createBoard(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  const block = addBlock(made.file, made.board.id, { title: 'She takes the job' });
  const first = addChild(block.file, made.board.id, block.nodeId as SculptorNodeId, { title: 'The interview' });
  const second = addChild(first.file, made.board.id, block.nodeId as SculptorNodeId, { title: 'The walk home' });
  return {
    file: second.file,
    board: made.board,
    blockId: block.nodeId as SculptorNodeId,
    first: first.nodeId as SculptorNodeId,
    second: second.nodeId as SculptorNodeId,
  };
};

describe('what a node can be', () => {
  it('binds a scene node to a scene and a beat node to a beat, and a block to neither', () => {
    const { file, board, blockId, first } = shaped();
    const beat = addChild(file, board.id, first);
    expect(bindKindOf(nodeIn(file, board, blockId)!)).toBeNull();
    expect(bindKindOf(nodeIn(file, board, first)!)).toBe('unit');
    expect(bindKindOf(nodeIn(beat.file, board, beat.nodeId!)!)).toBe('beat');
  });

  it('offers every scene in the story, in story order', () => {
    const { file } = shaped();
    expect(bindableUnits(file)).toHaveLength(1);
    expect(bindableUnits(file).map((unit) => unit.title)).toEqual(['Opening Scene']);
  });

  it('never offers a scene another node has already claimed', () => {
    const { file, board, first, second } = shaped();
    const scene = unitsInStoryOrder(file)[0]!;
    const bound = bindNode(file, board.id, first, { unitId: scene.id });
    expect(bindableUnits(bound, second)).toHaveLength(0);
    // …but the node that holds it still sees it, or it could not stay bound.
    expect(bindableUnits(bound, first).map((unit) => unit.id)).toEqual([scene.id]);
  });
});

describe('binding', () => {
  it('makes the two one thing, and the node names the scene', () => {
    const { file, board, first } = shaped();
    const scene = unitsInStoryOrder(file)[0]!;
    const bound = bindNode(file, board.id, first, { unitId: scene.id });

    expect(isBound(nodeIn(bound, board, first)!)).toBe(true);
    expect(boundOf(bound, nodeIn(bound, board, first)!)).toMatchObject({ kind: 'unit' });
    expect(bound.units.find((unit) => unit.id === scene.id)?.title).toBe('The interview');
  });

  it('takes the scene’s name where the node has none, rather than wiping it', () => {
    const { file, board, blockId } = shaped();
    const blank = addChild(file, board.id, blockId);
    const scene = unitsInStoryOrder(blank.file)[0]!;
    const bound = bindNode(blank.file, board.id, blank.nodeId!, { unitId: scene.id });

    expect(nodeIn(bound, board, blank.nodeId!)?.title).toBe('Opening Scene');
    expect(bound.units.find((unit) => unit.id === scene.id)?.title).toBe('Opening Scene');
  });

  it('refuses a scene that is already somebody else’s', () => {
    const { file, board, first, second } = shaped();
    const scene = unitsInStoryOrder(file)[0]!;
    const once = bindNode(file, board.id, first, { unitId: scene.id });
    const twice = bindNode(once, board.id, second, { unitId: scene.id });
    expect(isBound(nodeIn(twice, board, second)!)).toBe(false);
  });

  it('refuses to make a block into a scene: there is no such object in the script', () => {
    const { file, board, blockId } = shaped();
    const scene = unitsInStoryOrder(file)[0]!;
    const tried = bindNode(file, board.id, blockId, { unitId: scene.id });
    expect(isBound(nodeIn(tried, board, blockId)!)).toBe(false);
  });
});

describe('making the idea real', () => {
  it('puts a new scene in the script with the node’s name on it', () => {
    const { file, board, first } = shaped();
    const made = realiseNode(file, board.id, first);

    expect(made.unitId).not.toBeNull();
    expect(unitsInStoryOrder(made.file)).toHaveLength(2);
    expect(made.file.units.find((unit) => unit.id === made.unitId)?.title).toBe('The interview');
    expect(nodeIn(made.file, board, first)?.boundUnitId).toBe(made.unitId);
  });

  it('lands the second scene after the first, because that is the order on the canvas', () => {
    const { file, board, first, second } = shaped();
    const one = realiseNode(file, board.id, first);
    const two = realiseNode(one.file, board.id, second);

    const order = unitsInStoryOrder(two.file).map((unit) => unit.id);
    expect(order.indexOf(two.unitId!)).toBe(order.indexOf(one.unitId!) + 1);
  });

  it('moves nothing that was already in the script', () => {
    const { file, board, first } = shaped();
    const before = unitsInStoryOrder(file).map((unit) => unit.id);
    const made = realiseNode(file, board.id, first);
    const after = unitsInStoryOrder(made.file).map((unit) => unit.id);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('will not make a beat whose scene is still an idea', () => {
    const { file, board, first } = shaped();
    const beat = addChild(file, board.id, first, { title: 'She says she is fine' });
    const tried = realiseNode(beat.file, board.id, beat.nodeId!);
    expect(tried.beatId).toBeNull();
    expect(tried.file.beats).toHaveLength(beat.file.beats.length);
  });

  it('makes a beat inside the scene its parent is, once the parent is real', () => {
    const { file, board, first } = shaped();
    const scene = realiseNode(file, board.id, first);
    const node = addChild(scene.file, board.id, first, { title: 'She says she is fine' });
    const beat = realiseNode(node.file, board.id, node.nodeId!);

    expect(beat.beatId).not.toBeNull();
    expect(beatsForUnit(beat.file, scene.unitId!).map((row) => row.title)).toEqual(['She says she is fine']);
  });

  it('offers only that scene’s beats once the parent is bound', () => {
    const { file, board, first, second } = shaped();
    const here = realiseNode(file, board.id, first);
    const there = realiseNode(here.file, board.id, second);

    const mine = addChild(there.file, board.id, first, { title: 'Mine' });
    const made = realiseNode(mine.file, board.id, mine.nodeId!);
    const theirs = addChild(made.file, board.id, second, { title: 'Theirs' });

    // A beat node under the second scene is never offered the first scene's.
    expect(bindableBeats(theirs.file, boardIn(theirs.file, board), theirs.nodeId!)).toHaveLength(0);
    expect(there.unitId).not.toBe(here.unitId);
  });
});

describe('onto the track, whole (addendum 03 §6a)', () => {
  const nouns = nounsFor('screenplay');

  /** A scene node with three beat nodes under it, all ideas. */
  const withBeats = () => {
    const base = shaped();
    let file = base.file;
    const beats: SculptorNodeId[] = [];
    for (const title of ['She lies', 'He believes her', 'The door']) {
      const made = addChild(file, base.board.id, base.first, { title });
      file = made.file;
      beats.push(made.nodeId!);
    }
    return { ...base, file, beats };
  };

  it('offers the scene and counts the beats that would come with it', () => {
    const { file, board, first } = withBeats();
    const offer = trackOffer(file, boardIn(file, board), first);
    expect(offer).toEqual({ refusal: null, self: true, beats: 3 });
    expect(sayTrackOffer(offer, nodeIn(file, board, first)!, nouns)).toBe('Add to track — and its 3 beats');
  });

  it('puts the scene on the track with every beat under it, in canvas order', () => {
    const { file, board, first, beats } = withBeats();
    const made = addToTrack(file, board.id, first);

    expect(made.unitId).not.toBeNull();
    expect(made.beats).toHaveLength(3);
    expect(beatsForUnit(made.file, made.unitId!).map((beat) => beat.title)).toEqual([
      'She lies',
      'He believes her',
      'The door',
    ]);
    // Each node is now that beat, and the scene node is that scene.
    for (const [index, nodeId] of beats.entries()) {
      expect(nodeIn(made.file, board, nodeId)?.boundBeatId).toBe(made.beats[index]);
    }
    expect(nodeIn(made.file, board, first)?.boundUnitId).toBe(made.unitId);
  });

  it('adds the beats alone where the scene is already on the track', () => {
    const { file, board, first } = withBeats();
    const scene = realiseNode(file, board.id, first);
    const offer = trackOffer(scene.file, boardIn(scene.file, board), first);
    expect(offer).toEqual({ refusal: null, self: false, beats: 3 });
    expect(sayTrackOffer(offer, nodeIn(scene.file, board, first)!, nouns)).toBe('Add its 3 beats to the track');

    const made = addToTrack(scene.file, board.id, first);
    expect(made.unitId).toBe(scene.unitId);
    expect(unitsInStoryOrder(made.file)).toHaveLength(unitsInStoryOrder(scene.file).length);
    expect(made.beats).toHaveLength(3);
  });

  it('leaves a beat that is already real alone and takes the rest', () => {
    const { file, board, first, beats } = withBeats();
    const scene = realiseNode(file, board.id, first);
    const one = realiseNode(scene.file, board.id, beats[1]!);
    const made = addToTrack(one.file, board.id, first);

    expect(made.beats).toHaveLength(2);
    expect(beatsForUnit(made.file, scene.unitId!).map((beat) => beat.title)).toEqual([
      'She lies',
      'He believes her',
      'The door',
    ]);
    expect(nodeIn(made.file, board, beats[1]!)?.boundBeatId).toBe(one.beatId);
  });

  it('says a scene with everything on the track is already there', () => {
    const { file, board, first } = withBeats();
    const made = addToTrack(file, board.id, first);
    const offer = trackOffer(made.file, boardIn(made.file, board), first);
    expect(offer.refusal).toBe('already on the track');
    expect(addToTrack(made.file, board.id, first).file).toBe(made.file);
  });

  it('refuses a block, in a sentence', () => {
    const { file, board, blockId } = withBeats();
    const offer = trackOffer(file, boardIn(file, board), blockId);
    expect(offer.refusal).toBe('a block is the shape of the story rather than a scene in it');
    expect(addToTrack(file, board.id, blockId).file).toBe(file);
  });

  it('refuses a beat whose scene is still an idea, and takes one whose scene is real', () => {
    const { file, board, first, beats } = withBeats();
    expect(trackOffer(file, boardIn(file, board), beats[0]!).refusal).toBe('its scene is still an idea');
    expect(addToTrack(file, board.id, beats[0]!).file).toBe(file);

    const scene = realiseNode(file, board.id, first);
    const offer = trackOffer(scene.file, boardIn(scene.file, board), beats[0]!);
    expect(offer).toEqual({ refusal: null, self: true, beats: 0 });
    const made = addToTrack(scene.file, board.id, beats[0]!);
    expect(made.beats).toHaveLength(1);
    expect(made.unitId).toBe(scene.unitId);
  });

  it('lands the scene where the canvas says, like a press on the node alone', () => {
    const { file, board, first, second } = shaped();
    const one = addToTrack(file, board.id, first);
    const two = addToTrack(one.file, board.id, second);
    const order = unitsInStoryOrder(two.file).map((unit) => unit.id);
    expect(order.indexOf(two.unitId!)).toBe(order.indexOf(one.unitId!) + 1);
  });
});

describe('one name, in both places', () => {
  it('renames the scene when the node is renamed', () => {
    const { file, board, first } = shaped();
    const made = realiseNode(file, board.id, first);
    const renamed = updateNode(made.file, board.id, first, { title: 'The second interview' });
    expect(renamed.units.find((unit) => unit.id === made.unitId)?.title).toBe('The second interview');
  });

  it('renames the node when the scene is renamed', () => {
    const { file, board, first } = shaped();
    const made = realiseNode(file, board.id, first);
    const renamed = updateUnit(made.file, made.unitId!, { title: 'The second interview' });
    expect(nodeIn(renamed, board, first)?.title).toBe('The second interview');
  });

  it('renames a bound beat both ways too', () => {
    const { file, board, first } = shaped();
    const scene = realiseNode(file, board.id, first);
    const node = addChild(scene.file, board.id, first, { title: 'She says she is fine' });
    const beat = realiseNode(node.file, board.id, node.nodeId!);

    const fromScript = updateBeat(beat.file, beat.beatId!, { title: 'She lies' });
    expect(nodeIn(fromScript, board, node.nodeId!)?.title).toBe('She lies');

    const fromBoard = updateNode(fromScript, board.id, node.nodeId!, { title: 'She lies badly' });
    expect(fromBoard.beats.find((row) => row.id === beat.beatId)?.title).toBe('She lies badly');
  });

  it('leaves an unbound node’s name to itself', () => {
    const { file, board, first } = shaped();
    const titles = file.units.map((unit) => unit.title);
    const renamed = updateNode(file, board.id, first, { title: 'Something else' });
    expect(renamed.units.map((unit) => unit.title)).toEqual(titles);
  });
});

describe('coming apart', () => {
  it('unbinds without touching either: the scene stays, the node stays', () => {
    const { file, board, first } = shaped();
    const made = realiseNode(file, board.id, first);
    const loose = unbindNode(made.file, board.id, first);

    expect(isBound(nodeIn(loose, board, first)!)).toBe(false);
    expect(loose.units.some((unit) => unit.id === made.unitId)).toBe(true);
    expect(nodeIn(loose, board, first)?.title).toBe('The interview');
  });

  it('leaves the scene in the script when the node is taken off the board', () => {
    const { file, board, first } = shaped();
    const made = realiseNode(file, board.id, first);
    const gone = removeNode(made.file, board.id, first);

    expect(nodeIn(gone, board, first)).toBeNull();
    expect(gone.units.find((unit) => unit.id === made.unitId)?.title).toBe('The interview');
  });

  it('turns the node back into an idea when the scene leaves the script', () => {
    const { file, board, first } = shaped();
    const made = realiseNode(file, board.id, first);
    const gone = removeUnit(made.file, made.unitId!);

    expect(nodeIn(gone, board, first)).not.toBeNull();
    expect(isBound(nodeIn(gone, board, first)!)).toBe(false);
    expect(nodeIn(gone, board, first)?.title).toBe('The interview');
  });

  it('does the same for a beat, and for the beats inside a removed scene', () => {
    const { file, board, first } = shaped();
    const scene = realiseNode(file, board.id, first);
    const node = addChild(scene.file, board.id, first, { title: 'She says she is fine' });
    const beat = realiseNode(node.file, board.id, node.nodeId!);

    const one = removeBeat(beat.file, beat.beatId!);
    expect(isBound(nodeIn(one, board, node.nodeId!)!)).toBe(false);

    const both = removeUnit(beat.file, scene.unitId!);
    expect(isBound(nodeIn(both, board, first)!)).toBe(false);
    expect(isBound(nodeIn(both, board, node.nodeId!)!)).toBe(false);
  });
});

describe('when the canvas and the script disagree', () => {
  it('says nothing while they agree', () => {
    const { file, board, first, second } = shaped();
    const one = realiseNode(file, board.id, first);
    const two = realiseNode(one.file, board.id, second);
    expect(outOfStep(two.file, boardIn(two.file, board), second)).toBeNull();
  });

  it('says so when a bound node is moved past a bound sibling', () => {
    const { file, board, first, second } = shaped();
    const one = realiseNode(file, board.id, first);
    const two = realiseNode(one.file, board.id, second);
    const moved = moveNode(two.file, board.id, second, -1);

    const said = outOfStep(moved, boardIn(moved, board), second);
    expect(said).not.toBeNull();
    expect(said?.otherTitle).toBe('The interview');
  });

  it('moves nothing in the script until it is asked to', () => {
    const { file, board, first, second } = shaped();
    const one = realiseNode(file, board.id, first);
    const two = realiseNode(one.file, board.id, second);
    const before = unitsInStoryOrder(two.file).map((unit) => unit.id);
    const moved = moveNode(two.file, board.id, second, -1);
    expect(unitsInStoryOrder(moved).map((unit) => unit.id)).toEqual(before);
  });

  it('follows the canvas when it is, and then agrees again', () => {
    const { file, board, first, second } = shaped();
    const one = realiseNode(file, board.id, first);
    const two = realiseNode(one.file, board.id, second);
    const moved = moveNode(two.file, board.id, second, -1);
    const followed = followCanvas(moved, board.id, second);

    const order = unitsInStoryOrder(followed).map((unit) => unit.id);
    expect(order.indexOf(two.unitId!)).toBeLessThan(order.indexOf(one.unitId!));
    expect(outOfStep(followed, boardIn(followed, board), second)).toBeNull();
  });

  it('says nothing about a node that is still an idea', () => {
    const { file, board, first, second } = shaped();
    const one = realiseNode(file, board.id, first);
    expect(outOfStep(one.file, boardIn(one.file, board), second)).toBeNull();
  });

  it('reorders a scene’s beats the same way', () => {
    const { file, board, first } = shaped();
    const scene = realiseNode(file, board.id, first);
    const a = addChild(scene.file, board.id, first, { title: 'She arrives' });
    const madeA = realiseNode(a.file, board.id, a.nodeId!);
    const b = addChild(madeA.file, board.id, first, { title: 'She leaves' });
    const madeB = realiseNode(b.file, board.id, b.nodeId!);

    const moved = moveNode(madeB.file, board.id, b.nodeId!, -1);
    expect(outOfStep(moved, boardIn(moved, board), b.nodeId!)).not.toBeNull();

    const followed = followCanvas(moved, board.id, b.nodeId!);
    expect(beatsForUnit(followed, scene.unitId!).map((row) => row.title)).toEqual(['She leaves', 'She arrives']);
  });
});
