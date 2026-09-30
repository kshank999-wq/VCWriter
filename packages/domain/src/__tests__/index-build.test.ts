import { describe, expect, it } from 'vitest';
import {
  acceptAll,
  acceptProposal,
  addBeat,
  addCharacter,
  addCharacterization,
  addTheme,
  addTrait,
  addUnit,
  bookIndex,
  createProjectFile,
  removeCharacter,
  describeProposals,
  indexProposals,
  markForIndex,
  newPlaces,
  pinUsage,
  updateBeat,
  type BeatId,
  type ManuscriptElementId,
  type ProjectFile,
} from '../index.js';

/**
 * Building the index out of the book (addendum 10 §8).
 *
 * The claim under all of it: **an index heading comes from a record the writer
 * made and its places from anchors the writer placed**, in whichever room they
 * placed them. Nothing here reads the manuscript's words, so nothing here can
 * turn into a concordance — which is what §2 refuses and goes on refusing.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A book of one scene whose paragraphs are the passages. */
const book = (lines: string[]) => {
  let file: ProjectFile = createProjectFile({ title: 'The Lighthouse Keeper', format: 'novel' });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
  const elements = lines.map(para);
  file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements } });
  return { file, beatId: beat.beat.id, elements };
};

/** Somebody, a trait, a moment, and that moment pinned to a paragraph. */
const pinnedMoment = (
  file: ProjectFile,
  beatId: BeatId,
  elementId: ManuscriptElementId | null,
  names: { person: string; trait: string },
) => {
  const withCast = addCharacter(file, { name: names.person });
  const characterId = withCast.characters[withCast.characters.length - 1]!.id;
  const trait = addTrait(withCast, { characterId, name: names.trait });
  const item = addCharacterization(trait.file, {
    characterId,
    traitId: trait.trait!.id,
    text: 'Leaves an embarrassingly small tip.',
  });
  const pinned = pinUsage(item.file, {
    ownerKind: 'characterization',
    ownerId: item.item!.id as string,
    beatId,
    elementId,
  });
  return { file: pinned.file, characterId };
};

describe('where the headings come from', () => {
  it('reads a heading off the record and its places off the pins', () => {
    const { file, beatId, elements } = book(['He left a coin.', 'He counted it twice.']);
    const first = pinnedMoment(file, beatId, elements[0]!.id as ManuscriptElementId, {
      person: 'Silas Crane',
      trait: 'Miserly',
    });

    const proposals = indexProposals(first.file);
    expect(proposals).toHaveLength(1);
    // The person is the heading and the trait is the sub-heading, which is how
    // a two-level index reads and is what the record already carries.
    expect(proposals[0]!.term).toBe('Silas Crane');
    expect(proposals[0]!.subTerm).toBe('Miserly');
    expect(proposals[0]!.places).toHaveLength(1);
  });

  /**
   * The line the module is drawn on, asserted rather than described: a book
   * whose words are full of a name proposes nothing until somebody has pinned
   * something to a passage.
   */
  it('proposes nothing from the words alone', () => {
    const { file } = book([
      'Silas Crane counted the coins.',
      'Crane counted them again, and Crane was not satisfied.',
    ]);
    const named = addCharacter(file, { name: 'Silas Crane' });

    expect(indexProposals(named)).toEqual([]);
    expect(describeProposals([])).toContain('anchored to a passage');
  });

  /**
   * A pin with no element means *somewhere in this scene*. Filing it against
   * the first paragraph would invent a position the writer never gave, which
   * is what the margin mark refuses and this refuses for the same reason.
   */
  it('ignores a pin made against the whole scene', () => {
    const { file, beatId } = book(['He left a coin.']);
    const whole = pinnedMoment(file, beatId, null, {
      person: 'Silas Crane',
      trait: 'Miserly',
    });

    expect(indexProposals(whole.file)).toEqual([]);
  });

  it('takes a theme as a heading of its own', () => {
    const { file, beatId, elements } = book(['The light went out.']);
    const theme = addTheme(file, { name: 'Grief' });
    const pinned = pinUsage(theme.file, {
      ownerKind: 'theme',
      ownerId: theme.theme!.id as string,
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
    });

    const proposals = indexProposals(pinned.file);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.term).toBe('Grief');
    expect(proposals[0]!.subTerm).toBe('');
  });

  /**
   * A record in the graveyard proposes nothing — a heading with no words in it
   * is worse than one absent, and every reading over the writer's records asks
   * the module's own function (addendum 24 §5j).
   */
  it('proposes nothing for somebody who has been deleted', () => {
    const { file, beatId, elements } = book(['He left a coin.']);
    const pinned = pinnedMoment(file, beatId, elements[0]!.id as ManuscriptElementId, {
      person: 'Silas Crane',
      trait: 'Miserly',
    });
    expect(indexProposals(pinned.file)).toHaveLength(1);

    const gone = removeCharacter(pinned.file, pinned.characterId);
    expect(indexProposals(gone)).toEqual([]);
  });
});

describe('accepting one', () => {
  it('files every passage under the heading, and says how many', () => {
    const { file, beatId, elements } = book(['He left a coin.', 'He counted it twice.']);
    let next = pinnedMoment(file, beatId, elements[0]!.id as ManuscriptElementId, {
      person: 'Silas Crane',
      trait: 'Miserly',
    }).file;
    // A second pin, on the second paragraph, under the same moment.
    const item = next.characterizationItems[0]!;
    next = pinUsage(next, {
      ownerKind: 'characterization',
      ownerId: item.id as string,
      beatId,
      elementId: elements[1]!.id as ManuscriptElementId,
    }).file;

    const proposal = indexProposals(next)[0]!;
    const done = acceptProposal(next, proposal);

    expect(done.made).toBe(2);
    expect(done.file.indexMarks).toHaveLength(2);
    expect(done.file.indexMarks.every((mark) => mark.term === 'Silas Crane')).toBe(true);
  });

  /** Adds and never overwrites: a second press changes nothing at all. */
  it('does nothing the second time', () => {
    const { file, beatId, elements } = book(['He left a coin.']);
    const pinned = pinnedMoment(file, beatId, elements[0]!.id as ManuscriptElementId, {
      person: 'Silas Crane',
      trait: 'Miserly',
    }).file;

    const once = acceptProposal(pinned, indexProposals(pinned)[0]!);
    expect(once.made).toBe(1);

    const twice = acceptProposal(once.file, indexProposals(once.file)[0]!);
    expect(twice.made).toBe(0);
    expect(twice.file.indexMarks).toHaveLength(1);
  });

  /**
   * The one thing about a mark only the writer knows. A passage they marked by
   * hand as a principal discussion stays principal — the proposal does not
   * reach it, because `markForIndex` refuses the same passage under the same
   * heading twice and that refusal is what keeps their work.
   */
  it('leaves a mark the writer made by hand exactly as they left it', () => {
    const { file, beatId, elements } = book(['He left a coin.']);
    const pinned = pinnedMoment(file, beatId, elements[0]!.id as ManuscriptElementId, {
      person: 'Silas Crane',
      trait: 'Miserly',
    }).file;

    const byHand = markForIndex(pinned, {
      term: 'Silas Crane',
      subTerm: 'Miserly',
      beatId,
      elementId: elements[0]!.id as ManuscriptElementId,
      principal: true,
    });

    const proposal = indexProposals(byHand.file)[0]!;
    expect(newPlaces(proposal)).toEqual([]);
    expect(proposal.says).toBe('Already in the index.');

    const after = acceptProposal(byHand.file, proposal);
    expect(after.made).toBe(0);
    expect(after.file.indexMarks[0]!.principal).toBe(true);
  });

  it('files every heading at once, and counts the headings it touched', () => {
    const { file, beatId, elements } = book(['He left a coin.', 'The light went out.']);
    let next = pinnedMoment(file, beatId, elements[0]!.id as ManuscriptElementId, {
      person: 'Silas Crane',
      trait: 'Miserly',
    }).file;
    const theme = addTheme(next, { name: 'Grief' });
    next = pinUsage(theme.file, {
      ownerKind: 'theme',
      ownerId: theme.theme!.id as string,
      beatId,
      elementId: elements[1]!.id as ManuscriptElementId,
    }).file;

    const all = acceptAll(next, indexProposals(next));
    expect(all.headings).toBe(2);
    expect(all.made).toBe(2);
  });
});

describe('what the page then says', () => {
  /**
   * The whole point, end to end: pins made in another room become an index
   * with page numbers on it — and the numbers are still read off the
   * pagination rather than stored, so the promise addendum 10 §3 makes is
   * untouched by any of this.
   */
  it('turns pins into an index with pages on it', () => {
    const { file, beatId, elements } = book(['He left a coin.', 'The light went out.']);
    let next = pinnedMoment(file, beatId, elements[0]!.id as ManuscriptElementId, {
      person: 'Silas Crane',
      trait: 'Miserly',
    }).file;
    const theme = addTheme(next, { name: 'Grief' });
    next = pinUsage(theme.file, {
      ownerKind: 'theme',
      ownerId: theme.theme!.id as string,
      beatId,
      elementId: elements[1]!.id as ManuscriptElementId,
    }).file;
    next = acceptAll(next, indexProposals(next)).file;

    const pages: Record<string, number> = {
      [elements[0]!.id]: 14,
      [elements[1]!.id]: 41,
    };
    const index = bookIndex({
      marks: next.indexMarks,
      refs: next.indexRefs,
      pageOfElement: (id) => pages[id] ?? 0,
    });

    const headings = index.headings.map((one) => one.term);
    expect(headings).toContain('Grief');
    expect(headings).toContain('Silas Crane');
    const crane = index.headings.find((one) => one.term === 'Silas Crane')!;
    expect(crane.subEntries[0]!.subTerm).toBe('Miserly');
    expect(crane.subEntries[0]!.runs[0]!.from).toBe(14);
  });
});
