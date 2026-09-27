import { describe, expect, it } from 'vitest';
import {
  MOMENT_FILTERS,
  addBeat,
  addCharacter,
  addCharacterization,
  addTrait,
  addUnit,
  captureFromScript,
  characterBoard,
  conflictsFor,
  createProjectFile,
  describeConflicts,
  filterBoard,
  fromRows,
  newId,
  pinUsage,
  setConflict,
  toRows,
  tracksInOrder,
  updateBeat,
  updateCharacterization,
  type BeatId,
  type CharacterId,
  type CharacterTraitId,
  type ManuscriptElementId,
  type ProjectFile,
} from '../index.js';

/**
 * Traits & Moments (addendum 25 §3, stage 3): the filter, the badge and the
 * pair that pull against each other.
 */

interface World {
  file: ProjectFile;
  silas: CharacterId;
  beatId: BeatId;
  elementId: ManuscriptElementId;
}

const world = (): World => {
  let file = createProjectFile({ title: 'The Ledger', format: 'novel' });
  file = addCharacter(file, { name: 'Silas Crane' });
  const silas = file.characters[file.characters.length - 1]!.id;
  const track = tracksInOrder(file)[0]!;
  const unit = addUnit(file, { trackId: track.id, title: 'The Counting House' });
  file = unit.file;
  const beat = addBeat(file, { unitId: unit.unit.id, title: 'The coal bill' });
  // A real id: the usage link is anchored to one, and a made-up string is
  // refused — which is the link doing exactly what it promises.
  const elementId = newId<ManuscriptElementId>();
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [
        { id: elementId, type: 'paragraph', text: 'Crane took the brass tongs.', characterId: null, attributes: {} },
      ],
    },
  } as never);
  return { file, silas, beatId: beat.beat.id, elementId };
};

/** A trait with one moment under it. */
const trait = (file: ProjectFile, characterId: CharacterId, name: string, text: string) => {
  const made = addTrait(file, { characterId, name });
  const item = addCharacterization(made.file, { characterId, traitId: made.trait!.id, text });
  return { file: item.file, traitId: made.trait!.id, itemId: item.item!.id };
};

describe('the filter', () => {
  it('keeps the counts of the whole, whichever is chosen', () => {
    const { file, silas, beatId } = world();
    const first = trait(file, silas, 'Miserly', "Argues over a ha'penny");
    const pinned = pinUsage(first.file, {
      ownerKind: 'characterization',
      ownerId: first.itemId as string,
      beatId,
    }).file;
    const second = trait(pinned, silas, 'Lonely', 'Eats standing up');

    const board = characterBoard({ characterId: silas as string, file: second.file });
    expect(board.counts).toMatchObject({ shown: 1, onDeck: 1 });
    // **The bar says the same thing whichever tab is pressed**: those numbers
    // are what the writer is choosing between.
    for (const which of MOMENT_FILTERS) {
      expect(filterBoard(board, which).counts).toEqual(board.counts);
    }
  });

  it('drops a trait with nothing left under it, and keeps every trait under All', () => {
    const { file, silas, beatId } = world();
    const first = trait(file, silas, 'Miserly', "Argues over a ha'penny");
    const pinned = pinUsage(first.file, {
      ownerKind: 'characterization',
      ownerId: first.itemId as string,
      beatId,
    }).file;
    const second = trait(pinned, silas, 'Lonely', 'Eats standing up');
    // A trait with nothing under it at all: an unfinished thought, not an error.
    const empty = addTrait(second.file, { characterId: silas, name: 'Sharp-tongued' });

    const board = characterBoard({ characterId: silas as string, file: empty.file });
    expect(filterBoard(board, 'all').traits.map((one) => one.trait.name)).toEqual([
      'Miserly',
      'Lonely',
      'Sharp-tongued',
    ]);
    // Asked what is used, a card over nothing is a card about a question
    // nobody asked.
    expect(filterBoard(board, 'used').traits.map((one) => one.trait.name)).toEqual(['Miserly']);
    expect(filterBoard(board, 'on_deck').traits.map((one) => one.trait.name)).toEqual(['Lonely']);
    expect(filterBoard(board, 'retired').traits).toHaveLength(0);
  });

  it('finds a retired moment only under Retired', () => {
    const { file, silas } = world();
    const made = trait(file, silas, 'Secretly sentimental', 'Cries at the funeral');
    const retired = updateCharacterization(made.file, made.itemId, { retired: true });
    const board = characterBoard({ characterId: silas as string, file: retired });
    expect(filterBoard(board, 'on_deck').traits).toHaveLength(0);
    expect(filterBoard(board, 'retired').traits[0]!.items).toHaveLength(1);
  });
});

describe('found while writing', () => {
  /**
   * **A fact about where it came from, never a status.** A planned moment and
   * a found one are the same kind of thing: both are used or on deck by the
   * usage links alone.
   */
  it('marks what came out of the manuscript, and nothing else', () => {
    const { file, silas, beatId, elementId } = world();
    const planned = trait(file, silas, 'Miserly', "Argues over a ha'penny");
    expect(planned.file.characterizationItems[0]!.found).toBe(false);

    const caught = captureFromScript(planned.file, {
      characterId: silas,
      traitId: planned.traitId,
      text: 'Hoards the coal tongs',
      beatId,
      elementId,
    });
    const item = caught.item!;
    expect(item.found).toBe(true);
    // And it went in **used**, because it is already in the story — which is
    // the usage link doing it, not the badge.
    const board = characterBoard({ characterId: silas as string, file: caught.file });
    const row = board.traits[0]!.items.find((one) => one.item.id === item.id)!;
    expect(row.colour).toBe('green');
  });

  it('is carried to the rows and back', () => {
    const { file, silas, beatId, elementId } = world();
    const planned = trait(file, silas, 'Miserly', "Argues over a ha'penny");
    const caught = captureFromScript(planned.file, {
      characterId: silas,
      traitId: planned.traitId,
      text: 'Hoards the coal tongs',
      beatId,
      elementId,
    });
    const back = fromRows(toRows(caught.file));
    const item = back.characterizationItems.find((one) => one.id === caught.item!.id)!;
    expect(item.found).toBe(true);
  });
});

describe('traits that pull against each other', () => {
  /**
   * **Said once and read both ways.** Storing the pair on both traits would be
   * two records of one fact, free to disagree the moment one is edited.
   */
  it('shows on both cards from the one thing that was said', () => {
    const { file, silas } = world();
    const a = addTrait(file, { characterId: silas, name: 'Miserly' });
    const b = addTrait(a.file, { characterId: silas, name: 'Secretly sentimental' });
    const said = setConflict(b.file, b.trait!.id, a.trait!.id, true);

    const traits = said.characterTraits;
    // Written on the one it was said from.
    expect(traits.find((one) => one.id === b.trait!.id)!.conflictsWith).toEqual([a.trait!.id]);
    expect(traits.find((one) => one.id === a.trait!.id)!.conflictsWith).toEqual([]);
    // And read from either.
    expect(conflictsFor(traits, b.trait!.id as string).map((one) => one.name)).toEqual(['Miserly']);
    expect(conflictsFor(traits, a.trait!.id as string).map((one) => one.name)).toEqual([
      'Secretly sentimental',
    ]);
    expect(describeConflicts(conflictsFor(traits, a.trait!.id as string))).toBe(
      'pulls against Secretly sentimental',
    );
  });

  it('is taken off from either card', () => {
    const { file, silas } = world();
    const a = addTrait(file, { characterId: silas, name: 'Miserly' });
    const b = addTrait(a.file, { characterId: silas, name: 'Secretly sentimental' });
    const said = setConflict(b.file, b.trait!.id, a.trait!.id, true);
    // Unsaid from the *other* one, which is the card a writer may be looking at.
    const unsaid = setConflict(said, a.trait!.id, b.trait!.id, false);
    expect(conflictsFor(unsaid.characterTraits, a.trait!.id as string)).toHaveLength(0);
    expect(conflictsFor(unsaid.characterTraits, b.trait!.id as string)).toHaveLength(0);
  });

  it('refuses to pull against itself, and says a thing once', () => {
    const { file, silas } = world();
    const a = addTrait(file, { characterId: silas, name: 'Miserly' });
    expect(setConflict(a.file, a.trait!.id, a.trait!.id, true)).toBe(a.file);
    const b = addTrait(a.file, { characterId: silas, name: 'Lonely' });
    const once = setConflict(b.file, a.trait!.id, b.trait!.id, true);
    // Saying it again changes nothing at all.
    expect(setConflict(once, a.trait!.id, b.trait!.id, true)).toBe(once);
  });

  it('is carried to the rows and back', () => {
    const { file, silas } = world();
    const a = addTrait(file, { characterId: silas, name: 'Miserly' });
    const b = addTrait(a.file, { characterId: silas, name: 'Secretly sentimental' });
    const said = setConflict(b.file, b.trait!.id, a.trait!.id, true);
    const back = fromRows(toRows(said));
    expect(conflictsFor(back.characterTraits, a.trait!.id as string).map((one) => one.name)).toEqual([
      'Secretly sentimental',
    ]);
  });

  it('reads nothing for a trait that is gone', () => {
    const { file, silas } = world();
    const a = addTrait(file, { characterId: silas, name: 'Miserly' });
    expect(conflictsFor(a.file.characterTraits, 'not-a-trait' as CharacterTraitId as string)).toEqual([]);
  });
});
