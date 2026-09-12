import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addCharacter,
  addTrait,
  addUnit,
  captureFromScript,
  characterBoard,
  createProjectFile,
  peopleInBeat,
  updateBeat,
  updateCharacter,
  whereItAppears,
  type CharacterId,
  type ProjectFile,
} from '../index.js';

/**
 * Characterization caught while writing (addendum 08, stage 4 — story → plan).
 *
 * **The claim is that an item made this way is green the moment it exists.** A
 * writer is not recording a plan here; they are noticing that what they have
 * just written *is* characterization. A path that made the item and left it on
 * deck would be asking them to go and file their own work, and §7 says that
 * path is the one that makes the module usable by half its audience.
 */

const line = (type: 'action' | 'character' | 'dialogue', text: string) => ({
  id: crypto.randomUUID(),
  type,
  text,
  characterId: null,
  attributes: {},
});

const written = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [
        line('action', 'MARA counts out four coins and sets them down, squared.'),
        line('character', 'MARA'),
        line('dialogue', 'That covers it.'),
      ],
    },
  });

  file = addCharacter(file, { name: 'MARA' });
  const characterId = file.characters[file.characters.length - 1]!.id;
  file = addCharacter(file, { name: 'DEAKINS' });

  const elements = file.beats.find((one) => one.id === beat.beat.id)!.manuscript.elements;
  return { file, characterId, beatId: beat.beat.id, elementId: elements[0]!.id };
};

describe('catching characterization off the page', () => {
  it('makes it green the moment it exists, which is the point of the path', () => {
    const { file, characterId, beatId, elementId } = written();
    const caught = captureFromScript(file, {
      characterId,
      text: 'Leaves an embarrassingly small tip.',
      beatId,
      elementId,
    });

    expect(caught.item).not.toBeNull();
    const board = characterBoard({ characterId: characterId as string, file: caught.file });
    expect(board.counts).toEqual({ shown: 1, onDeck: 0, setAside: 0 });
  });

  it('keeps the line as the quote while the item says what the behaviour is', () => {
    // The writer generalises — "leaves a small tip" from "counts out four
    // coins" — and both readings are wanted: the plan in their words, the page
    // in its own.
    const { file, characterId, beatId, elementId } = written();
    const caught = captureFromScript(file, {
      characterId,
      text: 'Leaves an embarrassingly small tip.',
      beatId,
      elementId,
    });

    expect(caught.item!.text).toBe('Leaves an embarrassingly small tip.');
    const seen = whereItAppears({
      owner: { kind: 'characterization', id: caught.item!.id as string },
      file: caught.file,
    });
    expect(seen[0]!.quote).toBe('MARA counts out four coins and sets them down, squared.');
  });

  it('makes the trait when one is named, and files it there', () => {
    const { file, characterId, beatId, elementId } = written();
    const caught = captureFromScript(file, {
      characterId,
      newTraitName: 'Greedy',
      text: 'Leaves a small tip.',
      beatId,
      elementId,
    });

    expect(caught.file.characterTraits).toHaveLength(1);
    expect(caught.file.characterTraits[0]!.name).toBe('Greedy');
    expect(caught.item!.traitId).toBe(caught.file.characterTraits[0]!.id);
  });

  it('files it under one that already exists when that is what was chosen', () => {
    const { file, characterId, beatId, elementId } = written();
    const trait = addTrait(file, { characterId, name: 'Greedy' });
    const caught = captureFromScript(trait.file, {
      characterId,
      traitId: trait.trait!.id,
      newTraitName: 'Ignored',
      text: 'Leaves a small tip.',
      beatId,
      elementId,
    });

    expect(caught.file.characterTraits).toHaveLength(1);
    expect(caught.item!.traitId).toBe(trait.trait!.id);
  });

  it('does not stop to make anybody choose a folder first', () => {
    // §7: the fast path has to be fast, and unfiled is a real place.
    const { file, characterId, beatId, elementId } = written();
    const caught = captureFromScript(file, { characterId, text: 'Says "I had it".', beatId, elementId });

    expect(caught.item!.traitId).toBeNull();
    expect(characterBoard({ characterId: characterId as string, file: caught.file }).unfiled).toHaveLength(1);
  });

  it('takes the whole beat when no line was pointed at', () => {
    const { file, characterId, beatId } = written();
    const caught = captureFromScript(file, { characterId, text: 'Counts everything.', beatId });

    const seen = whereItAppears({
      owner: { kind: 'characterization', id: caught.item!.id as string },
      file: caught.file,
    });
    expect(seen[0]!.link.elementId).toBeNull();
    expect(seen[0]!.quote).toBe('');
  });

  it('keeps nothing at all when it could not be pinned', () => {
    // Half of this would be the one confusing outcome: an item born on deck in
    // a beat the writer is looking at.
    const { file, characterId } = written();
    const nowhere = captureFromScript(file, {
      characterId,
      newTraitName: 'Greedy',
      text: 'Leaves a small tip.',
      beatId: crypto.randomUUID() as never,
    });

    expect(nowhere.item).toBeNull();
    expect(nowhere.file).toEqual(file);
  });

  it('keeps nothing for text that is only spaces', () => {
    const { file, characterId, beatId } = written();
    const empty = captureFromScript(file, { characterId, text: '   ', beatId });
    expect(empty.item).toBeNull();
    expect(empty.file).toEqual(file);
  });
});

describe('who to offer first', () => {
  it('puts the people who speak in the beat at the front', () => {
    const { file, characterId, beatId } = written();
    expect(peopleInBeat(file, beatId)).toEqual([characterId]);
  });

  it('matches an alias as well as a name', () => {
    const { file, beatId } = written();
    const deakins = file.characters.find((one) => one.name === 'DEAKINS')!;
    const withAlias = updateCharacter(file, deakins.id, { aliases: ['MARA'] });
    expect(peopleInBeat(withAlias, beatId)).toHaveLength(2);
  });

  it('is an ordering and never a filter, since a beat can characterize the absent', () => {
    // An action line about what somebody left behind is characterization, and
    // they never said a word in it.
    const { file, beatId } = written();
    const inIt = peopleInBeat(file, beatId).map((id) => id as string);
    expect(inIt).not.toContain(file.characters.find((one) => one.name === 'DEAKINS')!.id as string);
    // Nothing here refuses them; the interface offers everybody and sorts.
    const caught = captureFromScript(file, {
      characterId: file.characters.find((one) => one.name === 'DEAKINS')!.id as CharacterId,
      text: 'Leaves his coat on the stool so nobody takes it.',
      beatId,
    });
    expect(caught.item).not.toBeNull();
  });
});
