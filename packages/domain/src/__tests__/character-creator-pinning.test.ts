import { describe, expect, it } from 'vitest';
import {
  USAGE_STANDING_WORDS,
  addBeat,
  addCharacter,
  addCharacterization,
  addTrait,
  addUnit,
  characterBoard,
  createProjectFile,
  pinUsage,
  placesToPin,
  quotableLines,
  unpinUsage,
  updateBeat,
  whereItAppears,
  type CharacterizationItemId,
  type ProjectFile,
} from '../index.js';

/**
 * Pinning a piece of character work to the manuscript (addendum 08, stage 3).
 *
 * This is the act that turns something green, so the claims worth defending are
 * the ones about the colour being *true*: pinning to a real place makes it
 * green, pinning to nowhere does nothing at all, and unpinning takes the pin
 * and never the writing.
 */

const line = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'action' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A project with a scene, a beat with two lines, and one thing to show. */
const staged = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [line('MARA counts out four coins and sets them down, squared.'), line('DEAKINS watches.')],
    },
  });

  file = addCharacter(file, { name: 'MARA' });
  const characterId = file.characters[file.characters.length - 1]!.id;
  const trait = addTrait(file, { characterId, name: 'Greedy' });
  const added = addCharacterization(trait.file, {
    characterId,
    traitId: trait.trait!.id,
    text: 'Leaves an embarrassingly small tip.',
  });

  return {
    file: added.file,
    characterId,
    itemId: added.item!.id as CharacterizationItemId,
    unitId: scene.unit.id,
    beatId: beat.beat.id,
  };
};

const owner = (itemId: CharacterizationItemId) => ({ kind: 'characterization' as const, id: itemId as string });

describe('pinning a piece of character work to the writing', () => {
  it('turns it green, which is the whole point of the stage', () => {
    const { file, characterId, itemId, beatId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });

    expect(pinned.link).not.toBeNull();
    const board = characterBoard({ characterId: characterId as string, file: pinned.file });
    expect(board.traits[0]!.items[0]!.colour).toBe('green');
    expect(board.counts).toEqual({ shown: 1, onDeck: 0, setAside: 0 });
  });

  it('works out the scene from the beat rather than being told it', () => {
    // A link naming a beat in one scene and a scene it is not in would navigate
    // somewhere wrong, so there is no way for a caller to make one.
    const { file, itemId, beatId, unitId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    expect(pinned.link!.unitId).toBe(unitId);
  });

  it('copies the line as a quote when a line is pointed at, and nothing when the beat is', () => {
    const { file, itemId, beatId } = staged();
    const lines = quotableLines(file, beatId);
    expect(lines).toHaveLength(2);

    const toLine = pinUsage(file, {
      ownerKind: 'characterization',
      ownerId: itemId,
      beatId,
      elementId: lines[0]!.id,
    });
    expect(toLine.link!.quote).toBe('MARA counts out four coins and sets them down, squared.');

    const toBeat = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    expect(toBeat.link!.quote).toBe('');
  });

  it('leaves out a blank line, because a quote of nothing reads as nothing', () => {
    const { file, beatId } = staged();
    const withBlank: ProjectFile = {
      ...file,
      beats: file.beats.map((beat) =>
        (beat.id as string) === (beatId as string)
          ? { ...beat, manuscript: { elements: [...beat.manuscript.elements, line('   ')] } }
          : beat,
      ),
    };
    expect(quotableLines(withBlank, beatId)).toHaveLength(2);
  });

  it('does nothing at all when the beat is not there', () => {
    const { file, itemId } = staged();
    const nowhere = pinUsage(file, {
      ownerKind: 'characterization',
      ownerId: itemId,
      beatId: file.beats[0]!.id,
      elementId: crypto.randomUUID() as never,
    });
    expect(nowhere.link).toBeNull();
    expect(nowhere.file.usageLinks).toHaveLength(0);
  });

  it('pins the same thing to the same place once, like the database does', () => {
    const { file, itemId, beatId } = staged();
    const once = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    const twice = pinUsage(once.file, { ownerKind: 'characterization', ownerId: itemId, beatId });

    expect(twice.file.usageLinks).toHaveLength(1);
    expect(twice.link!.id).toBe(once.link!.id);
  });

  it('takes the pin and never the writing', () => {
    const { file, characterId, itemId, beatId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    const after = unpinUsage(pinned.file, pinned.link!.id);

    expect(after.usageLinks).toHaveLength(0);
    expect(after.beats).toEqual(file.beats);
    // Back on deck, which is where it was: unpinning is not a deletion.
    expect(characterBoard({ characterId: characterId as string, file: after }).counts.onDeck).toBe(1);
  });
});

describe('reading back where something turned up', () => {
  it('says the scene and the beat it is in', () => {
    const { file, itemId, beatId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    const seen = whereItAppears({ owner: owner(itemId), file: pinned.file });

    expect(seen).toHaveLength(1);
    expect(seen[0]!.unitTitle).toContain('INT. DINER - NIGHT');
    expect(seen[0]!.beatTitle).toBe('The bill');
    expect(seen[0]!.standing).toBe('used');
  });

  it('says the line has changed rather than going red, when it is rewritten', () => {
    // §3.2: the quote and the manuscript diverge the moment somebody improves
    // the sentence, and going red there would punish them for writing.
    const { file, characterId, itemId, beatId } = staged();
    const lines = quotableLines(file, beatId);
    const pinned = pinUsage(file, {
      ownerKind: 'characterization',
      ownerId: itemId,
      beatId,
      elementId: lines[0]!.id,
    });

    const rewritten: ProjectFile = {
      ...pinned.file,
      beats: pinned.file.beats.map((beat) =>
        (beat.id as string) === (beatId as string)
          ? {
              ...beat,
              manuscript: {
                elements: beat.manuscript.elements.map((element) =>
                  element.id === lines[0]!.id ? { ...element, text: 'MARA squares four coins on the check.' } : element,
                ),
              },
            }
          : beat,
      ),
    };

    expect(whereItAppears({ owner: owner(itemId), file: rewritten })[0]!.standing).toBe('rewritten');
    expect(characterBoard({ characterId: characterId as string, file: rewritten }).counts.shown).toBe(1);
    expect(USAGE_STANDING_WORDS.rewritten).toBe('The line has changed since');
  });

  it('keeps a row for writing that has gone, so the red has an explanation', () => {
    const { file, itemId, beatId } = staged();
    const pinned = pinUsage(file, { ownerKind: 'characterization', ownerId: itemId, beatId });
    const cut: ProjectFile = { ...pinned.file, beats: [] };

    const seen = whereItAppears({ owner: owner(itemId), file: cut });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.standing).toBe('gone');
  });

  it('offers the scenes and their beats in story order', () => {
    const { file } = staged();
    const second = addUnit(file, { laneId: file.lanes[0]!.id, title: 'EXT. LOT - LATER' });
    const withBeat = addBeat(second.file, { unitId: second.unit.id, title: 'The walk' });

    const places = placesToPin(withBeat.file);
    // A new project opens with a scene already in it, and it comes first.
    expect(places.map((place) => place.unit.title)).toEqual([
      'Opening Scene',
      'INT. DINER - NIGHT',
      'EXT. LOT - LATER',
    ]);
    expect(places[2]!.beats.map((beat) => beat.title)).toEqual(['The walk']);
  });
});
