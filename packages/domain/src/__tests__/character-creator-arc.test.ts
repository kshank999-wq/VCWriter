import { describe, expect, it } from 'vitest';
import {
  ARC_SHAPE_WORDS,
  addArcPoint,
  addBeat,
  addCharacter,
  addUnit,
  arcBoard,
  beginArc,
  createProjectFile,
  isDecisive,
  moveArcPoint,
  pinUsage,
  removeArc,
  removeArcPoint,
  updateArc,
  updateArcPoint,
  type ArcPointId,
  type ProjectFile,
} from '../index.js';

/**
 * The Arc Builder (addendum 08, stage 5 — §8 and §9).
 *
 * **The arc does not assume anybody improves.** A Scrooge and an antagonist are
 * built with the same tool; what differs is which points they have, and a
 * refusal is a defining dramatic event rather than a missing positive one.
 *
 * The second claim is about order: **what is written sits where the story puts
 * it**, and only what is still on deck is the writer's to arrange.
 */

const peopled = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'INT. DINER - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
  file = addCharacter(beat.file, { name: 'MARA' });
  const characterId = file.characters[file.characters.length - 1]!.id;
  const begun = beginArc(file, characterId);
  return { file: begun.file, arc: begun.arc!, characterId, beatId: beat.beat.id };
};

describe('starting an arc', () => {
  it('gives somebody one, and never a second', () => {
    const { file, characterId, arc } = peopled();
    const again = beginArc(file, characterId);

    expect(again.arc!.id).toBe(arc.id);
    expect(again.file.characterArcs).toHaveLength(1);
  });

  it('requires nothing of anybody — a character without one is normal', () => {
    let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    file = addCharacter(file, { name: 'DEAKINS' });
    const person = file.characters[file.characters.length - 1]!;
    const board = arcBoard({ characterId: person.id as string, file });

    expect(board.arc).toBeNull();
    expect(board.shape).toBe('unstarted');
    expect(ARC_SHAPE_WORDS[board.shape]).toBe('No arc yet');
  });

  it('takes its points with it when the arc goes', () => {
    // Unlike a trait, whose characterization survives it: a point has no
    // meaning without the journey it is a point of.
    const { file, arc, characterId, beatId } = peopled();
    const point = addArcPoint(file, { arcId: arc.id, text: 'She is offered the money back.' });
    const pinned = pinUsage(point.file, {
      ownerKind: 'arc_point',
      ownerId: point.point!.id,
      beatId,
    });

    const after = removeArc(pinned.file, arc.id);
    expect(after.characterArcs).toHaveLength(0);
    expect(after.arcPoints).toHaveLength(0);
    expect(after.usageLinks).toHaveLength(0);
    expect(arcBoard({ characterId: characterId as string, file: after }).arc).toBeNull();
  });
});

describe('the shape is read back, never declared', () => {
  it('calls it refused the moment there is a refusal, whatever else is there', () => {
    // §9: the refusal is the defining dramatic event once it happens.
    const { file, arc, characterId } = peopled();
    const withEnd = updateArc(file, arc.id, {
      beginning: 'Keeps score.',
      need: 'To stop counting.',
      ending: 'Counts faster.',
    });
    const one = addArcPoint(withEnd, { arcId: arc.id, kind: 'discovery', text: 'Sees what it costs.' });
    const two = addArcPoint(one.file, { arcId: arc.id, kind: 'turning_point', text: 'Could give it back.' });
    const three = addArcPoint(two.file, { arcId: arc.id, kind: 'refusal', text: 'Takes it anyway.' });

    const board = arcBoard({ characterId: characterId as string, file: three.file });
    expect(board.shape).toBe('refused');
    expect(ARC_SHAPE_WORDS.refused).toBe('Is offered the change and refuses it');
  });

  it('says whether they were ever really given the chance', () => {
    const { file, arc, characterId } = peopled();
    const doubled = addArcPoint(file, { arcId: arc.id, kind: 'doubling_down', text: 'Buys another.' });
    expect(arcBoard({ characterId: characterId as string, file: doubled.file }).offered).toBe(false);

    const offered = addArcPoint(doubled.file, {
      arcId: arc.id,
      kind: 'opportunity',
      text: 'Her sister asks her to come home.',
    });
    expect(arcBoard({ characterId: characterId as string, file: offered.file }).offered).toBe(true);
  });

  it('marks the decisive kinds, which is a statement about drama not styling', () => {
    expect(isDecisive('opportunity')).toBe(true);
    expect(isDecisive('refusal')).toBe(true);
    expect(isDecisive('doubling_down')).toBe(true);
    expect(isDecisive('turning_point')).toBe(true);
    expect(isDecisive('movement')).toBe(false);
  });
});

describe('what is written, and what is still to place', () => {
  it('puts a pinned point in the story half and the rest on deck', () => {
    const { file, arc, characterId, beatId } = peopled();
    const one = addArcPoint(file, { arcId: arc.id, text: 'Counts the takings twice.' });
    const two = addArcPoint(one.file, { arcId: arc.id, text: 'Gives the coat back.' });
    const pinned = pinUsage(two.file, { ownerKind: 'arc_point', ownerId: one.point!.id, beatId });

    const board = arcBoard({ characterId: characterId as string, file: pinned.file });
    expect(board.placed.map((row) => row.point.text)).toEqual(['Counts the takings twice.']);
    expect(board.placed[0]!.colour).toBe('green');
    expect(board.placed[0]!.unitTitle).toContain('INT. DINER - NIGHT');
    expect(board.onDeck.map((row) => row.point.text)).toEqual(['Gives the coat back.']);
  });

  it('moves a point that is not in the story yet', () => {
    const { file, arc, characterId } = peopled();
    const one = addArcPoint(file, { arcId: arc.id, text: 'First.' });
    const two = addArcPoint(one.file, { arcId: arc.id, text: 'Second.' });
    const three = addArcPoint(two.file, { arcId: arc.id, text: 'Third.' });

    const moved = moveArcPoint(three.file, three.point!.id, 'up');
    expect(
      arcBoard({ characterId: characterId as string, file: moved }).onDeck.map((row) => row.point.text),
    ).toEqual(['First.', 'Third.', 'Second.']);

    const back = moveArcPoint(moved, three.point!.id, 'down');
    expect(
      arcBoard({ characterId: characterId as string, file: back }).onDeck.map((row) => row.point.text),
    ).toEqual(['First.', 'Second.', 'Third.']);
  });

  it('refuses to move one that is in the story, because the scene decides that', () => {
    const { file, arc, characterId, beatId } = peopled();
    const one = addArcPoint(file, { arcId: arc.id, text: 'First.' });
    const two = addArcPoint(one.file, { arcId: arc.id, text: 'Second.' });
    const pinned = pinUsage(two.file, { ownerKind: 'arc_point', ownerId: two.point!.id, beatId });

    expect(moveArcPoint(pinned.file, two.point!.id, 'up')).toEqual(pinned.file);
    // And it is not in the queue the other one moves within.
    expect(
      arcBoard({ characterId: characterId as string, file: pinned.file }).onDeck.map((row) => row.point.text),
    ).toEqual(['First.']);
  });

  it('does nothing at the ends of the queue', () => {
    const { file, arc } = peopled();
    const one = addArcPoint(file, { arcId: arc.id, text: 'Only.' });
    expect(moveArcPoint(one.file, one.point!.id, 'up')).toEqual(one.file);
    expect(moveArcPoint(one.file, one.point!.id, 'down')).toEqual(one.file);
  });
});

describe('editing the points', () => {
  it('changes a kind without touching where it is', () => {
    const { file, arc, characterId, beatId } = peopled();
    const one = addArcPoint(file, { arcId: arc.id, text: 'Could give it back.' });
    const pinned = pinUsage(one.file, { ownerKind: 'arc_point', ownerId: one.point!.id, beatId });
    const after = updateArcPoint(pinned.file, one.point!.id, { kind: 'opportunity' });

    const board = arcBoard({ characterId: characterId as string, file: after });
    expect(board.placed[0]!.point.kind).toBe('opportunity');
    expect(board.placed[0]!.colour).toBe('green');
    expect(board.offered).toBe(true);
  });

  it('sets one aside without deleting it', () => {
    const { file, arc, characterId } = peopled();
    const one = addArcPoint(file, { arcId: arc.id, text: 'Maybe she apologises.' });
    const after = updateArcPoint(one.file, one.point!.id, { retired: true });
    expect(arcBoard({ characterId: characterId as string, file: after }).onDeck[0]!.colour).toBe('grey');
  });

  it('takes a point and its pins together', () => {
    const { file, arc, beatId } = peopled();
    const one = addArcPoint(file, { arcId: arc.id, text: 'Gone.' });
    const pinned = pinUsage(one.file, { ownerKind: 'arc_point', ownerId: one.point!.id, beatId });
    const after = removeArcPoint(pinned.file, one.point!.id);

    expect(after.arcPoints).toHaveLength(0);
    expect(after.usageLinks).toHaveLength(0);
    expect(after.beats).toEqual(file.beats);
  });

  it('keeps nothing for a point with no words, and none for an arc that is not there', () => {
    const { file, arc } = peopled();
    expect(addArcPoint(file, { arcId: arc.id, text: '  ' }).point).toBeNull();
    expect(addArcPoint(file, { arcId: crypto.randomUUID() as never, text: 'Orphan.' }).point).toBeNull();
    expect(removeArcPoint(file, crypto.randomUUID() as ArcPointId)).toEqual(file);
  });
});
