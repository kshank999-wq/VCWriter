import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addCharacter,
  addCharacterization,
  addTrait,
  addUnit,
  characterBoard,
  characterStanding,
  createProjectFile,
  fileCharacterization,
  newId,
  removeCharacterization,
  removeTrait,
  updateCharacterization,
  updateTrait,
  usageLinkSchema,
  type CharacterId,
  type CharacterTraitId,
  type ProjectFile,
} from '../index.js';

/**
 * The Character Creator's edits and the screen's reading (addendum 08, stage 2).
 *
 * The claim worth defending here is the one a writer would feel: **taking away
 * the folder must never take away the writing in it**. Somebody who decides
 * *greedy* was the wrong word for it has not decided the small tip was a bad
 * idea, and a module that lost the second when they did the first would be
 * punishing them for changing their mind.
 */

/** A project with one person in it. */
const peopled = (): { file: ProjectFile; characterId: CharacterId } => {
  let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  file = addCharacter(file, { name: 'MARA' });
  return { file, characterId: file.characters[file.characters.length - 1]!.id };
};

describe('traits and the characterization filed under them', () => {
  it('files a way of showing something under the trait it shows', () => {
    const { file, characterId } = peopled();
    const withTrait = addTrait(file, { characterId, name: 'Greedy' });
    const trait = withTrait.trait!;

    const added = addCharacterization(withTrait.file, {
      characterId,
      traitId: trait.id,
      text: 'Leaves an embarrassingly small tip.',
    });

    const board = characterBoard({ characterId: characterId as string, file: added.file });
    expect(board.traits).toHaveLength(1);
    expect(board.traits[0]!.items.map((row) => row.item.text)).toEqual([
      'Leaves an embarrassingly small tip.',
    ]);
    expect(board.traits[0]!.unshown).toBe(false);
  });

  it('keeps the writing when the trait is taken away', () => {
    const { file, characterId } = peopled();
    const withTrait = addTrait(file, { characterId, name: 'Greedy' });
    const trait = withTrait.trait!;
    const added = addCharacterization(withTrait.file, {
      characterId,
      traitId: trait.id,
      text: 'Leaves an embarrassingly small tip.',
    });

    const after = removeTrait(added.file, trait.id);

    expect(after.characterTraits).toHaveLength(0);
    expect(after.characterizationItems).toHaveLength(1);
    expect(after.characterizationItems[0]!.traitId).toBeNull();
    // And it is somewhere the writer can see it, rather than orphaned.
    const board = characterBoard({ characterId: characterId as string, file: after });
    expect(board.unfiled.map((row) => row.item.text)).toEqual(['Leaves an embarrassingly small tip.']);
  });

  it('refuses to file somebody else"s work under this person"s trait', () => {
    const { file, characterId } = peopled();
    const two = addCharacter(file, { name: 'DEAKINS' });
    const other = two.characters[two.characters.length - 1]!;
    const withTrait = addTrait(two, { characterId, name: 'Greedy' });

    // Asking for a trait that belongs to Mara while writing about Deakins
    // leaves the item unfiled rather than filed under the wrong person.
    const added = addCharacterization(withTrait.file, {
      characterId: other.id,
      traitId: withTrait.trait!.id,
      text: 'Counts the change twice.',
    });

    expect(added.item!.traitId).toBeNull();
    expect(fileCharacterization(added.file, added.item!.id, withTrait.trait!.id)).toEqual(added.file);
  });

  it('takes nothing from a name that is only spaces', () => {
    const { file, characterId } = peopled();
    expect(addTrait(file, { characterId, name: '   ' }).trait).toBeNull();
    expect(addCharacterization(file, { characterId, text: '  ' }).item).toBeNull();
  });

  it('moves a noticed thought into a trait later', () => {
    const { file, characterId } = peopled();
    const withTrait = addTrait(file, { characterId, name: 'Greedy' });
    const added = addCharacterization(withTrait.file, { characterId, text: 'Counts the change twice.' });
    expect(added.item!.traitId).toBeNull();

    const filed = fileCharacterization(added.file, added.item!.id, withTrait.trait!.id);
    expect(filed.characterizationItems[0]!.traitId).toBe(withTrait.trait!.id);
    expect(characterBoard({ characterId: characterId as string, file: filed }).unfiled).toHaveLength(0);
  });

  it('edits a trait without touching what is filed under it', () => {
    const { file, characterId } = peopled();
    const withTrait = addTrait(file, { characterId, name: 'Greedy' });
    const added = addCharacterization(withTrait.file, {
      characterId,
      traitId: withTrait.trait!.id,
      text: 'Leaves a small tip.',
    });

    const after = updateTrait(added.file, withTrait.trait!.id, { tone: 'negative', prominence: 5 });
    expect(after.characterTraits[0]!.tone).toBe('negative');
    expect(after.characterizationItems).toEqual(added.file.characterizationItems);
  });
});

describe('what the screen is told', () => {
  /** A project where one item is in the writing and one is not. */
  const written = () => {
    const { file, characterId } = peopled();
    const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
    const withTrait = addTrait(beat.file, { characterId, name: 'Greedy' });
    const one = addCharacterization(withTrait.file, {
      characterId,
      traitId: withTrait.trait!.id,
      text: 'Leaves a small tip.',
    });
    const two = addCharacterization(one.file, {
      characterId,
      traitId: withTrait.trait!.id,
      text: 'Keeps the receipt.',
    });

    const at = '2026-09-12T00:00:00.000Z';
    const link = usageLinkSchema.parse({
      id: newId(),
      projectId: two.file.project.id,
      ownerKind: 'characterization',
      ownerId: one.item!.id,
      unitId: scene.unit.id,
      beatId: beat.beat.id,
      elementId: null,
      quote: '',
      createdAt: at,
      updatedAt: at,
    });

    return {
      file: { ...two.file, usageLinks: [link] },
      characterId,
      traitId: withTrait.trait!.id as CharacterTraitId,
      usedItemId: one.item!.id,
      onDeckItemId: two.item!.id,
    };
  };

  it('colours one green and one red, off the links and nothing else', () => {
    const { file, characterId } = written();
    const board = characterBoard({ characterId: characterId as string, file });
    const rows = board.traits[0]!.items;

    expect(rows.map((row) => row.colour)).toEqual(['green', 'red']);
    expect(board.counts).toEqual({ shown: 1, onDeck: 1, setAside: 0 });
  });

  it('turns the green one red when the beat it was in is cut', () => {
    // The whole reason `used` is never stored: nothing runs here, and the
    // reading changes because the manuscript did.
    const { file, characterId } = written();
    const cut: ProjectFile = { ...file, beats: [] };
    expect(characterBoard({ characterId: characterId as string, file: cut }).counts).toEqual({
      shown: 0,
      onDeck: 2,
      setAside: 0,
    });
  });

  it('stops counting something set aside as work outstanding', () => {
    const { file, characterId, onDeckItemId } = written();
    const after = updateCharacterization(file, onDeckItemId, { retired: true });
    const board = characterBoard({ characterId: characterId as string, file: after });

    expect(board.counts).toEqual({ shown: 1, onDeck: 0, setAside: 1 });
    // Set aside, not deleted: it is still on the screen.
    expect(board.traits[0]!.items).toHaveLength(2);
  });

  it('takes the usage links with an item that is deleted outright', () => {
    const { file, usedItemId } = written();
    const after = removeCharacterization(file, usedItemId);
    expect(after.characterizationItems).toHaveLength(1);
    expect(after.usageLinks).toHaveLength(0);
  });

  it('counts rather than judges, and says nothing at all about an empty person', () => {
    const { file, characterId } = peopled();
    const empty = characterBoard({ characterId: characterId as string, file });
    expect(characterStanding(empty)).toBe('Nothing written down for them yet.');

    const { file: some, characterId: who } = written();
    const standing = characterStanding(characterBoard({ characterId: who as string, file: some }));
    expect(standing).toBe('1 in the writing, 1 on deck.');
    // §7: information, never pressure. No verdict words anywhere in it.
    expect(standing).not.toMatch(/underdevelop|should|need|weak|thin/i);
  });
});
