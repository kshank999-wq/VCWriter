import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addCharacter,
  addCharacterization,
  addTrait,
  addUnit,
  beginArc,
  characterRail,
  createProjectFile,
  pinUsage,
  railStanding,
  removeBeat,
  updateBeat,
  type CharacterizationItemId,
  type ProjectFile,
} from '../index.js';

/**
 * The rail down the side of the Creator (addendum 08 §12).
 *
 * One reading over everything a character has, in blocks, each row red or
 * green. The claim worth defending is the one the whole module rests on: the
 * colour is **derived**, so it follows the manuscript rather than a flag
 * somebody set. These hold that it does, and that the rail never invents a
 * colour where there is no claim to make.
 */

const line = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'action' as const,
  text,
  characterId: null,
  attributes: {},
});

const staged = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'INT. DINER - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: { elements: [line('MARA counts out four coins and sets them down, squared.')] },
  });

  file = addCharacter(file, { name: 'MARA' });
  const characterId = file.characters[file.characters.length - 1]!.id;

  const greedy = addTrait(file, { characterId, name: 'Greedy' });
  const shown = addCharacterization(greedy.file, {
    characterId,
    traitId: greedy.trait!.id,
    text: 'Leaves an embarrassingly small tip.',
  });

  return {
    file: shown.file,
    characterId,
    itemId: shown.item!.id as CharacterizationItemId,
    beatId: beat.beat.id,
  };
};

const rail = (file: ProjectFile, characterId: string) => characterRail({ characterId, file });

describe('what the rail shows', () => {
  it('gives a block per trait, with what shows it under it', () => {
    const { file, characterId } = staged();
    const blocks = rail(file, characterId as string);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.title).toBe('Greedy');
    expect(blocks[0]!.kind).toBe('trait');
    expect(blocks[0]!.rows.map((row) => row.label)).toEqual([
      'Leaves an embarrassingly small tip.',
    ]);
  });

  it('opens red, because nothing is in the writing yet', () => {
    const { file, characterId } = staged();
    const blocks = rail(file, characterId as string);

    expect(blocks[0]!.rows[0]!.colour).toBe('red');
    expect(blocks[0]!.onDeck).toBe(1);
  });

  it('turns green when the work is pinned to a beat', () => {
    const { file, characterId, itemId, beatId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });

    const blocks = rail(pinned.file, characterId as string);
    expect(blocks[0]!.rows[0]!.colour).toBe('green');
    expect(blocks[0]!.onDeck).toBe(0);
  });

  it('turns red again when the beat it was pinned to is cut', () => {
    // The reason there is no stored flag: the manuscript changed, and nothing
    // ran to keep the colour in step — because nothing has to.
    const { file, characterId, itemId, beatId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    expect(rail(pinned.file, characterId as string)[0]!.rows[0]!.colour).toBe('green');

    const cut = removeBeat(pinned.file, beatId);
    expect(rail(cut, characterId as string)[0]!.rows[0]!.colour).toBe('red');
  });

  it('stays green when the beat survives but its words are rewritten', () => {
    // The pin is to the beat, not to a sentence: a writer improving the line
    // has not un-shown the trait, and turning it red would be the colour
    // lying in the other direction.
    const { file, characterId, itemId, beatId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    const rewritten = updateBeat(pinned.file, beatId, {
      manuscript: { elements: [line('MARA leaves three coins and pockets the fourth.')] },
    });

    expect(rail(rewritten, characterId as string)[0]!.rows[0]!.colour).toBe('green');
  });

  it('marks a trait with nothing under it as empty rather than as owing', () => {
    // An unfinished thought is not the same as a debt (§1).
    const { file, characterId } = staged();
    const bare = addTrait(file, { characterId, name: 'Never asks for help' });

    const block = rail(bare.file, characterId as string).find((one) => one.title === 'Never asks for help');
    expect(block?.empty).toBe(true);
    expect(block?.onDeck).toBe(0);
  });

  it('gives the arc a block of its own', () => {
    const { file, characterId } = staged();
    const arc = beginArc(file, { characterId, want: 'To be owed nothing' });

    const block = rail(arc.file, characterId as string).find((one) => one.kind === 'arc');
    // An arc with no points yet is not a block; the want alone is not work.
    expect(block).toBeUndefined();
  });
});

describe('what the rail refuses to claim', () => {
  it('gives a note no colour at all', () => {
    // A note is something the writer knows, not something shown in a scene, so
    // there is no claim about the manuscript to make. A dot here would be an
    // invented one, and an invented colour in one block teaches a writer to
    // distrust the colour in every other.
    const { file, characterId } = staged();
    const blocks = rail(file, characterId as string);
    for (const block of blocks) {
      for (const row of block.rows) {
        if (block.kind === 'notes') expect(row.colour).toBeNull();
        else expect(row.colour).not.toBeNull();
      }
    }
  });
});

describe('what the rail owes, in one line', () => {
  it('says nothing has been made when there is nothing', () => {
    let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    file = addCharacter(file, { name: 'SAL' });
    const person = file.characters[file.characters.length - 1]!;

    expect(railStanding(rail(file, person.id as string))).toBe('Nothing made for them yet');
  });

  it('counts what is still on deck', () => {
    const { file, characterId } = staged();
    expect(railStanding(rail(file, characterId as string))).toBe('1 still on deck');
  });

  it('says so when all of it is in the writing', () => {
    const { file, characterId, itemId, beatId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });

    expect(railStanding(rail(pinned.file, characterId as string))).toBe('All of it is in the writing');
  });
});
