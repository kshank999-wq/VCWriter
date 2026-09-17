import { describe, expect, it } from 'vitest';
import {
  addArcPoint,
  addBeat,
  addCharacter,
  addCharacterization,
  addTrait,
  addUnit,
  beginArc,
  characterWorkIn,
  createProjectFile,
  describeWork,
  onDeckForBeat,
  pinUsage,
  updateBeat,
  updateCharacterization,
  type ProjectFile,
} from '../index.js';

/**
 * The module read from the scene rather than from the character (addendum 08
 * §10, stage 6).
 *
 * Everything else asks *where did this person's work land*. A writer in a beat
 * has the opposite question — *what is this carrying, and what is waiting for
 * these people?* — and the answer is the same rows read backwards, so nothing
 * new is stored to give it.
 */

const line = (type: 'action' | 'character' | 'dialogue', text: string) => ({
  id: crypto.randomUUID(),
  type,
  text,
  characterId: null,
  attributes: {},
});

const staged = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'INT. DINER - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [line('character', 'MARA'), line('dialogue', 'That covers it.')],
    },
  });

  file = addCharacter(file, { name: 'MARA' });
  const mara = file.characters[file.characters.length - 1]!.id;
  file = addCharacter(file, { name: 'DEAKINS' });
  const deakins = file.characters[file.characters.length - 1]!.id;

  const trait = addTrait(file, { characterId: mara, name: 'Greedy' });
  const tip = addCharacterization(trait.file, {
    characterId: mara,
    traitId: trait.trait!.id,
    text: 'Leaves a small tip.',
  });
  const other = addCharacterization(tip.file, {
    characterId: deakins,
    text: 'Leaves his coat on the stool.',
  });
  const arc = beginArc(other.file, mara);
  const point = addArcPoint(arc.file, {
    arcId: arc.arc!.id,
    kind: 'refusal',
    text: 'Takes the money anyway.',
  });

  return {
    file: point.file,
    beatId: beat.beat.id,
    mara,
    deakins,
    itemId: tip.item!.id,
    otherId: other.item!.id,
    pointId: point.point!.id,
  };
};

describe('what a beat is carrying', () => {
  it('shows the characterization and the arc points pinned to it', () => {
    const { file, beatId, itemId, pointId } = staged();
    const one = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    const two = pinUsage(one.file, { ownerKind: 'arc_point', ownerId: pointId, beatId });

    const work = characterWorkIn(two.file, beatId);
    expect(work).toHaveLength(2);
    expect(work.every((one) => one.characterName === 'MARA')).toBe(true);
    expect(work.map((one) => one.kind).sort()).toEqual(['arc_point', 'characterization']);
  });

  it('carries the trait and the kind, so a row reads without the Creator open', () => {
    const { file, beatId, itemId, pointId } = staged();
    const one = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    const two = pinUsage(one.file, { ownerKind: 'arc_point', ownerId: pointId, beatId });
    const work = characterWorkIn(two.file, beatId);

    const item = work.find((entry) => entry.kind === 'characterization')!;
    const point = work.find((entry) => entry.kind === 'arc_point')!;
    expect(describeWork(item)).toBe('Greedy — Leaves a small tip.');
    expect(describeWork(point)).toBe('Refuses it: Takes the money anyway.');
  });

  it('empties itself when the pin goes, because it is a reading and not a list', () => {
    const { file, beatId, itemId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    expect(characterWorkIn(pinned.file, beatId)).toHaveLength(1);

    const gone: ProjectFile = { ...pinned.file, usageLinks: [] };
    expect(characterWorkIn(gone, beatId)).toHaveLength(0);
  });
});

describe('what is waiting for the people in it', () => {
  it('puts whoever speaks here first and still offers everybody', () => {
    const { file, beatId } = staged();
    const queue = onDeckForBeat(file, beatId);

    expect(queue.here.map((work) => work.characterName)).toEqual(['MARA', 'MARA']);
    expect(queue.rest.map((work) => work.characterName)).toEqual(['DEAKINS']);
  });

  it('drops work the moment it is pinned somewhere', () => {
    const { file, beatId, itemId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    const queue = onDeckForBeat(pinned.file, beatId);

    expect(queue.here.map((work) => work.text)).toEqual(['Takes the money anyway.']);
  });

  it('leaves out what was set aside, because that decision is already made', () => {
    // §7: nothing in this module nags, and offering a retired idea again is
    // exactly that.
    const { file, beatId, itemId } = staged();
    const aside = updateCharacterization(file, itemId, { retired: true });
    const queue = onDeckForBeat(aside, beatId);

    expect(queue.here.map((work) => work.text)).toEqual(['Takes the money anyway.']);
  });

  it('is an ordering and never a gate — a beat can carry the absent', () => {
    const { file, beatId, otherId } = staged();
    const queue = onDeckForBeat(file, beatId);
    // DEAKINS says nothing here, so he is in `rest` rather than missing.
    expect(queue.rest.map((work) => work.text)).toEqual(['Leaves his coat on the stool.']);

    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: otherId, beatId });
    expect(characterWorkIn(pinned.file, beatId).map((work) => work.characterName)).toEqual(['DEAKINS']);
  });
});
