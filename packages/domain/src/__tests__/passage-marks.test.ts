import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addCharacter,
  addCharacterization,
  addTheme,
  addTrait,
  addUnit,
  createProjectFile,
  describePassageMarks,
  markForIndex,
  newId,
  passageMarks,
  pinUsage,
  sendToGraveyard,
  tagPassage,
  tracksInOrder,
  updateBeat,
  type BeatId,
  type CharacterId,
  type ManuscriptElementId,
  type ProjectFile,
} from '../index.js';

/**
 * The margin mark (addendum 25 §7).
 *
 * Two claims. **It answers for every anchored kind**, not the Character
 * Creator's alone — a mark that showed characterization and stayed silent
 * beside a themed paragraph would be one that lies about what it means. And
 * **nothing is stored**, so taking the pin off takes the mark off.
 */

interface World {
  file: ProjectFile;
  silas: CharacterId;
  beatId: BeatId;
  first: ManuscriptElementId;
  second: ManuscriptElementId;
}

const world = (): World => {
  let file = createProjectFile({ title: 'The Ledger', format: 'novel' });
  file = addCharacter(file, { name: 'Silas Crane' });
  const silas = file.characters[file.characters.length - 1]!.id;
  const track = tracksInOrder(file)[0]!;
  const unit = addUnit(file, { trackId: track.id, title: 'The Counting House' });
  const beat = addBeat(unit.file, { unitId: unit.unit.id, title: 'The coal bill' });
  const first = newId<ManuscriptElementId>();
  const second = newId<ManuscriptElementId>();
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [
        { id: first, type: 'paragraph', text: 'He counted it twice.', characterId: null, attributes: {} },
        { id: second, type: 'paragraph', text: 'The clerk said nothing.', characterId: null, attributes: {} },
      ],
    },
  } as never);
  return { file, silas, beatId: beat.beat.id, first, second };
};

const beatOf = (file: ProjectFile, id: BeatId) => file.beats.find((one) => one.id === id)!;

describe('what is anchored to a passage', () => {
  it('names the person and the trait, and goes when the pin does', () => {
    const { file, silas, beatId, first } = world();
    const trait = addTrait(file, { characterId: silas, name: 'Miserly' });
    const item = addCharacterization(trait.file, {
      characterId: silas,
      traitId: trait.trait!.id,
      text: "Argues over a ha'penny",
    });
    const pinned = pinUsage(item.file, {
      ownerKind: 'characterization',
      ownerId: item.item!.id as string,
      beatId,
      elementId: first,
    });

    const marks = passageMarks(pinned.file, beatOf(pinned.file, beatId));
    expect(marks.get(first)).toEqual([
      { kind: 'characterization', says: 'Silas Crane · Miserly' },
    ]);
    expect(describePassageMarks(marks.get(first)!)).toBe('Character: Silas Crane · Miserly');

    // **Nothing is stored**: taking the link away takes the mark.
    const cut = { ...pinned.file, usageLinks: [] };
    expect(passageMarks(cut, beatOf(cut, beatId)).size).toBe(0);
  });

  it('answers for a theme as readily as for a character', () => {
    const { file, beatId, second } = world();
    const made = addTheme(file, { name: 'Grief' });
    const tagged = tagPassage(made.file, {
      kind: 'theme',
      ownerId: made.theme!.id as string,
      beatId,
      elementId: second,
    });
    const marks = passageMarks(tagged.file, beatOf(tagged.file, beatId));
    expect(marks.get(second)).toEqual([{ kind: 'theme', says: 'Grief' }]);
  });

  it('answers for an index heading, which is its own table', () => {
    const { file, beatId, first } = world();
    const marked = markForIndex(file, {
      beatId,
      elementId: first,
      term: 'lenses',
      subTerm: 'Fresnel',
    });
    const marks = passageMarks(marked.file, beatOf(marked.file, beatId));
    expect(marks.get(first)).toEqual([{ kind: 'index', says: 'lenses · Fresnel' }]);
  });

  it('carries several on one line, each named', () => {
    const { file, silas, beatId, first } = world();
    const trait = addTrait(file, { characterId: silas, name: 'Miserly' });
    const item = addCharacterization(trait.file, {
      characterId: silas,
      traitId: trait.trait!.id,
      text: "Argues over a ha'penny",
    });
    const pinned = pinUsage(item.file, {
      ownerKind: 'characterization',
      ownerId: item.item!.id as string,
      beatId,
      elementId: first,
    }).file;
    const theme = addTheme(pinned, { name: 'Grief' });
    const both = tagPassage(theme.file, {
      kind: 'theme',
      ownerId: theme.theme!.id as string,
      beatId,
      elementId: first,
    }).file;

    const marks = passageMarks(both, beatOf(both, beatId));
    // Every one named rather than counted: the whole point of a margin is
    // being able to tell without going anywhere.
    expect(describePassageMarks(marks.get(first)!)).toBe(
      'Character: Silas Crane · Miserly\nTheme: Grief',
    );
  });

  it('leaves a beat-wide pin unmarked, rather than putting it on the first line', () => {
    const { file, silas, beatId, first } = world();
    const trait = addTrait(file, { characterId: silas, name: 'Miserly' });
    const item = addCharacterization(trait.file, {
      characterId: silas,
      traitId: trait.trait!.id,
      text: 'Counts the collection plate',
    });
    // No `elementId`: *somewhere in this scene*, which is a real answer and
    // not a position. Putting a mark on the first paragraph would invent one.
    const pinned = pinUsage(item.file, {
      ownerKind: 'characterization',
      ownerId: item.item!.id as string,
      beatId,
    }).file;
    const marks = passageMarks(pinned, beatOf(pinned, beatId));
    expect(marks.size).toBe(0);
    expect(marks.get(first)).toBeUndefined();
  });

  it('says nothing for a buried character, who is off every other list too', () => {
    const { file, silas, beatId, first } = world();
    const trait = addTrait(file, { characterId: silas, name: 'Miserly' });
    const item = addCharacterization(trait.file, {
      characterId: silas,
      traitId: trait.trait!.id,
      text: "Argues over a ha'penny",
    });
    const pinned = pinUsage(item.file, {
      ownerKind: 'characterization',
      ownerId: item.item!.id as string,
      beatId,
      elementId: first,
    }).file;
    expect(passageMarks(pinned, beatOf(pinned, beatId)).get(first)).toHaveLength(1);

    const buried = sendToGraveyard(pinned, { kind: 'character', id: silas as string });
    expect(passageMarks(buried, beatOf(buried, beatId)).get(first)).toBeUndefined();
  });

  it('keeps to the beat it was asked about', () => {
    const { file, silas, beatId, first } = world();
    const track = tracksInOrder(file)[0]!;
    const other = addUnit(file, { trackId: track.id, title: 'Elsewhere' });
    const otherBeat = addBeat(other.file, { unitId: other.unit.id, title: 'Elsewhere' });

    const trait = addTrait(otherBeat.file, { characterId: silas, name: 'Miserly' });
    const item = addCharacterization(trait.file, {
      characterId: silas,
      traitId: trait.trait!.id,
      text: "Argues over a ha'penny",
    });
    const pinned = pinUsage(item.file, {
      ownerKind: 'characterization',
      ownerId: item.item!.id as string,
      beatId,
      elementId: first,
    }).file;

    expect(passageMarks(pinned, beatOf(pinned, otherBeat.beat.id)).size).toBe(0);
  });
});
