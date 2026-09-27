import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addCharacter,
  addCharacterization,
  addMarker,
  addTrait,
  addUnit,
  createProjectFile,
  describeStoryPanel,
  newId,
  pinUsage,
  storyPanel,
  tracksInOrder,
  updateBeat,
  type BeatId,
  type CharacterId,
  type ManuscriptElementId,
  type ProjectFile,
  type StructuralUnitId,
} from '../index.js';

/**
 * The Story panel (addendum 25 §3, stage 4): the scenes in story order as
 * somewhere to put a moment.
 *
 * Its whole claim is addendum 08 §2 said of a list — **nothing about it is
 * stored**. Which scenes somebody is in is read off the cues and what is
 * pinned where off the usage links, so writing a cue lights a row with
 * nothing run and cutting one puts it out again.
 */

interface World {
  file: ProjectFile;
  silas: CharacterId;
  units: StructuralUnitId[];
  beats: BeatId[];
}

/** A cue, which is the only way a name can be in a scene (addendum 02 §4b). */
const cue = (name: string) => ({
  id: newId<ManuscriptElementId>(),
  type: 'character' as const,
  text: name,
  characterId: null,
  attributes: {},
});

/**
 * A project of four scenes: the one `createProjectFile` seeds (*Opening
 * Scene*, which nobody is in) and three written ones. The seeded scene is
 * kept rather than cleared, because it is what a real project has and a panel
 * that listed only the scenes a test made would prove nothing about the
 * first row a writer sees.
 */
const world = (): World => {
  let file = createProjectFile({ title: 'The Ledger', format: 'screenplay' });
  file = addCharacter(file, { name: 'Silas Crane' });
  file = addCharacter(file, { name: 'Nell Crane' });
  const silas = file.characters[file.characters.length - 2]!.id;

  const track = tracksInOrder(file)[0]!;
  const units: StructuralUnitId[] = [];
  const beats: BeatId[] = [];
  for (const [title, speaker] of [
    ['The Counting House', 'SILAS CRANE'],
    ["Nell's Invitation", 'NELL CRANE'],
    ["The Clerk's Coat", 'SILAS CRANE'],
  ] as const) {
    const unit = addUnit(file, { trackId: track.id, title });
    file = unit.file;
    units.push(unit.unit.id);
    const beat = addBeat(file, { unitId: unit.unit.id, title: `${title} — opening` });
    beats.push(beat.beat.id);
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [cue(speaker)] },
    } as never);
  }
  return { file, silas, units, beats };
};

/** A trait with one way to show it, still on deck. */
const moment = (file: ProjectFile, characterId: CharacterId, text: string) => {
  const trait = addTrait(file, { characterId, name: 'Miserly' });
  const item = addCharacterization(trait.file, { characterId, traitId: trait.trait!.id, text });
  return { file: item.file, itemId: item.item!.id };
};

describe('the story panel', () => {
  it('is every scene in story order, and lights the ones they are in', () => {
    const { file, silas } = world();
    const rows = storyPanel({ characterId: silas as string, file });
    expect(rows.map((row) => row.label)).toEqual([
      'Opening Scene',
      'The Counting House',
      "Nell's Invitation",
      "The Clerk's Coat",
    ]);
    // **Bright where they speak.** A scene they are not in is still listed —
    // a writer may be about to put them in it — and merely dimmed.
    expect(rows.map((row) => row.appears)).toEqual([false, true, false, true]);
  });

  it('re-lights itself when the writing changes, with nothing run', () => {
    const { file, silas, beats } = world();
    const before = storyPanel({ characterId: silas as string, file });
    expect(before[2]!.appears).toBe(false);

    // Put him in the second scene by writing a cue — which is the only act
    // there is, there being no *is in this scene* to store.
    const grown = updateBeat(file, beats[1]!, {
      manuscript: { elements: [cue('NELL CRANE'), cue('SILAS CRANE')] },
    } as never);
    expect(storyPanel({ characterId: silas as string, file: grown })[2]!.appears).toBe(true);

    // And cutting it puts the row out again.
    const cut = updateBeat(grown, beats[1]!, {
      manuscript: { elements: [cue('NELL CRANE')] },
    } as never);
    expect(storyPanel({ characterId: silas as string, file: cut })[2]!.appears).toBe(false);
  });

  it('does not take MARABEL for MARA', () => {
    let file = createProjectFile({ title: 'The Ledger', format: 'screenplay' });
    file = addCharacter(file, { name: 'Mara' });
    const mara = file.characters[file.characters.length - 1]!.id;
    const track = tracksInOrder(file)[0]!;
    const unit = addUnit(file, { trackId: track.id, title: 'The landing' });
    const beat = addBeat(unit.file, { unitId: unit.unit.id, title: 'Opening' });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [cue('MARABEL')] },
    } as never);
    expect(storyPanel({ characterId: mara as string, file })[0]!.appears).toBe(false);
  });

  it('counts only this person’s work as pinned', () => {
    const { file, silas, beats } = world();
    const made = moment(file, silas, "Argues over a ha'penny");
    const pinned = pinUsage(made.file, {
      ownerKind: 'characterization',
      ownerId: made.itemId as string,
      beatId: beats[0]!,
    }).file;

    const rows = storyPanel({ characterId: silas as string, file: pinned });
    expect(rows.map((row) => row.pinned)).toEqual([0, 1, 0, 0]);

    // Somebody else's moment in the same scene is not this panel's business.
    const other = file.characters[file.characters.length - 1]!.id;
    const hers = moment(pinned, other, 'Lends her last shilling');
    const both = pinUsage(hers.file, {
      ownerKind: 'characterization',
      ownerId: hers.itemId as string,
      beatId: beats[0]!,
    }).file;
    expect(storyPanel({ characterId: silas as string, file: both })[1]!.pinned).toBe(1);
  });

  it('carries the division forward from the nearest marker at or before', () => {
    const { file, silas, units } = world();
    // One chapter, opening on the first written scene. The two after it fall
    // under it; the seeded scene before it falls under no marker at all and
    // takes its own sequence label rather than borrowing the chapter's.
    const marked = addMarker(file, { unitId: units[0]!, title: '', kind: 'chapter' }).file;
    const rows = storyPanel({ characterId: silas as string, file: marked });
    expect(rows.map((row) => row.division)).toEqual([
      'Sc. 1',
      'Chapter I',
      'Chapter I',
      'Chapter I',
    ]);

    // A second chapter on the third written scene ends the first one's run —
    // which is `divisionSpan`'s rule, pointed at a list.
    const two = addMarker(marked, { unitId: units[2]!, title: '', kind: 'chapter' }).file;
    expect(storyPanel({ characterId: silas as string, file: two }).map((row) => row.division)).toEqual([
      'Sc. 1',
      'Chapter I',
      'Chapter I',
      'Chapter II',
    ]);
  });

  it('gives a scene with no beats nowhere to land', () => {
    const { file, silas } = world();
    const track = tracksInOrder(file)[0]!;
    const empty = addUnit(file, { trackId: track.id, title: 'Not written yet' });
    const rows = storyPanel({ characterId: silas as string, file: empty.file });
    const row = rows.find((one) => one.label === 'Not written yet')!;
    // **A link with nowhere to anchor is a link that would be broken the
    // moment it was made**, so the row takes no drop and says so by holding
    // no beat.
    expect(row.beatId).toBeNull();
    expect(rows.find((one) => one.label === 'The Counting House')!.beatId).not.toBeNull();
  });

  it('names a scene nobody has titled', () => {
    const { file, silas } = world();
    const track = tracksInOrder(file)[0]!;
    const blank = addUnit(file, { trackId: track.id, title: '' });
    const rows = storyPanel({ characterId: silas as string, file: blank.file });
    expect(rows[rows.length - 1]!.label).toBe('Untitled scene');
  });

  it('says what to do with it, in the format’s own noun', () => {
    const { file } = world();
    expect(describeStoryPanel(file, 'Silas Crane')).toBe(
      'Drag something on deck onto a scene to use it. Silas Crane is in the bright ones.',
    );
    // Nothing here names a format: it reads the noun table, so a novel says
    // *chapter* and a textbook *section* without either being written down.
    const book = { ...file, project: { ...file.project, format: 'novel' as const } };
    expect(describeStoryPanel(book, '')).toContain('onto a chapter');
    expect(describeStoryPanel(book, '')).toContain('They is in the bright ones');
  });
});
