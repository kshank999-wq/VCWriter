import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMotif,
  addTheme,
  addUnit,
  countOf,
  createProjectFile,
  fromRows,
  moveUnit,
  motifsOfTheme,
  noteOccurrence,
  occurrencesOf,
  relateMotifToTheme,
  removeMotif,
  removeTheme,
  tagPassage,
  thematicTracks,
  thematicWorkIn,
  themesOfMotif,
  toRows,
  unitsInStoryOrder,
  untagPassage,
  updateBeat,
  updateMotif,
  type BeatId,
  type ManuscriptElementId,
  type ProjectFile,
} from '../index.js';

/**
 * Themes and motifs (addendum 12).
 *
 * Three claims, and everything below defends one of them: **they are two kinds
 * all the way down**, **an occurrence is a usage link rather than a second
 * table**, and **whether a tagged passage still exists is a reading** — so
 * cutting the writing orphans it with nothing running.
 */

const para = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A book of several scenes, each with one paragraph. */
const book = (lines: string[]) => {
  let file: ProjectFile = createProjectFile({ title: 'The Bell', format: 'novel' });
  const trackId = file.tracks[0]!.id;
  const beatIds: BeatId[] = [];
  const elementIds: ManuscriptElementId[] = [];
  for (const line of lines) {
    const scene = addUnit(file, { trackId, title: line.slice(0, 20) });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
    const element = para(line);
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [element] } });
    beatIds.push(beat.beat.id);
    elementIds.push(element.id);
  }
  return { file, beatIds, elementIds };
};

describe('two kinds, all the way down', () => {
  it('keeps a theme and a motif in separate collections with different fields', () => {
    let { file } = book(['The bell rang once.']);
    file = addTheme(file, { name: 'What a town owes its dead', arcNotes: 'Refused, then paid' }).file;
    file = addMotif(file, { name: 'the bell', motifType: 'sound' }).file;

    expect(file.themes).toHaveLength(1);
    expect(file.motifs).toHaveLength(1);
    // The fields that make them different kinds rather than one with a flag.
    expect(file.themes[0]!.arcNotes).toBe('Refused, then paid');
    expect(file.motifs[0]!.motifType).toBe('sound');
    expect('motifType' in file.themes[0]!).toBe(false);
    expect('arcNotes' in file.motifs[0]!).toBe(false);
  });

  it('relates a motif to a theme without merging their occurrences', () => {
    const { file: made, beatIds } = book(['The bell rang.', 'Nobody came.', 'She rang it again.']);
    let file = made;
    const theme = addTheme(file, { name: 'What a town owes its dead' });
    file = theme.file;
    const motif = addMotif(file, { name: 'the bell', motifType: 'sound' });
    file = motif.file;
    file = relateMotifToTheme(file, theme.theme.id, motif.motif.id);

    // Three sightings of the bell; one of the theme.
    for (const beatId of beatIds) {
      file = tagPassage(file, { kind: 'motif', ownerId: motif.motif.id as string, beatId }).file;
    }
    file = tagPassage(file, { kind: 'theme', ownerId: theme.theme.id as string, beatId: beatIds[1]! }).file;

    expect(motifsOfTheme(file, theme.theme.id).map((one) => one.name)).toEqual(['the bell']);
    expect(themesOfMotif(file, motif.motif.id)).toHaveLength(1);
    // The reader meets the bell three times; the theme is not therefore three
    // times explored.
    expect(countOf(file, 'motif', motif.motif.id as string).total).toBe(3);
    expect(countOf(file, 'theme', theme.theme.id as string).total).toBe(1);
  });

  it('takes a theme’s occurrences with it and leaves the motif’s alone', () => {
    const { file: made, beatIds } = book(['One.', 'Two.']);
    let file = made;
    const theme = addTheme(file, { name: 'A theme' });
    file = theme.file;
    const motif = addMotif(file, { name: 'A motif' });
    file = motif.file;
    file = tagPassage(file, { kind: 'theme', ownerId: theme.theme.id as string, beatId: beatIds[0]! }).file;
    file = tagPassage(file, { kind: 'motif', ownerId: motif.motif.id as string, beatId: beatIds[0]! }).file;

    const after = removeTheme(file, theme.theme.id);
    expect(after.usageLinks.filter((link) => link.ownerKind === 'theme')).toHaveLength(0);
    expect(after.usageLinks.filter((link) => link.ownerKind === 'motif')).toHaveLength(1);
    // The writing is untouched, which is the only thing that would be a loss.
    expect(after.beats.find((one) => one.id === beatIds[0])!.manuscript.elements[0]!.text).toBe('One.');
  });
});

describe('an occurrence is a usage link', () => {
  it('files one without a second table, keeping the page’s words as the quote', () => {
    const { file: made, beatIds, elementIds } = book(['The bell rang once, in 1911.']);
    let file = made;
    const motif = addMotif(file, { name: 'the bell', motifType: 'sound' });
    file = motif.file;
    const tagged = tagPassage(file, {
      kind: 'motif',
      ownerId: motif.motif.id as string,
      beatId: beatIds[0]!,
      elementId: elementIds[0]!,
      quote: 'The bell rang once, in 1911.',
    });

    expect(tagged.link).not.toBeNull();
    expect(tagged.file.usageLinks).toHaveLength(1);
    expect(tagged.file.usageLinks[0]!.ownerKind).toBe('motif');
    expect(tagged.file.usageLinks[0]!.quote).toBe('The bell rang once, in 1911.');
  });

  it('is once per passage, however many times the writer says it', () => {
    const { file: made, beatIds, elementIds } = book(['The bell.']);
    let file = made;
    const motif = addMotif(file, { name: 'the bell' });
    file = motif.file;
    const once = tagPassage(file, {
      kind: 'motif',
      ownerId: motif.motif.id as string,
      beatId: beatIds[0]!,
      elementId: elementIds[0]!,
    });
    const twice = tagPassage(once.file, {
      kind: 'motif',
      ownerId: motif.motif.id as string,
      beatId: beatIds[0]!,
      elementId: elementIds[0]!,
    });

    expect(twice.file.usageLinks).toHaveLength(1);
    expect(twice.link!.id).toBe(once.link!.id);
  });

  it('carries a note about what the moment contributes', () => {
    const { file: made, beatIds } = book(['The bell.']);
    let file = made;
    const theme = addTheme(file, { name: 'A theme' });
    file = theme.file;
    const tagged = tagPassage(file, { kind: 'theme', ownerId: theme.theme.id as string, beatId: beatIds[0]! });
    file = noteOccurrence(tagged.file, tagged.link!.id, 'This is where it turns.');

    expect(occurrencesOf(file, 'theme', theme.theme.id as string)[0]!.link.note).toBe('This is where it turns.');
  });

  it('untags without touching the writing', () => {
    const { file: made, beatIds } = book(['The bell rang.']);
    let file = made;
    const motif = addMotif(file, { name: 'the bell' });
    file = motif.file;
    const tagged = tagPassage(file, { kind: 'motif', ownerId: motif.motif.id as string, beatId: beatIds[0]! });
    const after = untagPassage(tagged.file, tagged.link!.id);

    expect(after.usageLinks).toHaveLength(0);
    expect(after.beats.find((one) => one.id === beatIds[0])!.manuscript.elements[0]!.text).toBe('The bell rang.');
  });
});

describe('where the occurrences are is a reading', () => {
  it('is in story order, and follows a reorder with nothing running', () => {
    const { file: made, beatIds } = book(['One.', 'Two.', 'Three.']);
    let file = made;
    const motif = addMotif(file, { name: 'the bell' });
    file = motif.file;
    for (const beatId of [beatIds[0]!, beatIds[2]!]) {
      file = tagPassage(file, { kind: 'motif', ownerId: motif.motif.id as string, beatId }).file;
    }

    const before = occurrencesOf(file, 'motif', motif.motif.id as string);
    expect(before.map((one) => one.link.beatId)).toEqual([beatIds[0], beatIds[2]]);

    // Drag the last scene to the front. Nothing is recalculated; the order is
    // simply read again.
    const last = unitsInStoryOrder(file).at(-1)!;
    const moved = moveUnit(file, { unitId: last.id, toTrackId: last.trackId, index: 0 });
    const after = occurrencesOf(moved, 'motif', motif.motif.id as string);
    expect(after.map((one) => one.link.beatId)).toEqual([beatIds[2], beatIds[0]]);
  });

  it('marks a tagged passage that has been cut as unresolved rather than dropping it', () => {
    const { file: made, beatIds, elementIds } = book(['The bell rang.', 'Nothing.']);
    let file = made;
    const motif = addMotif(file, { name: 'the bell' });
    file = motif.file;
    file = tagPassage(file, {
      kind: 'motif',
      ownerId: motif.motif.id as string,
      beatId: beatIds[0]!,
      elementId: elementIds[0]!,
      quote: 'The bell rang.',
    }).file;

    // Cut the paragraph it was on.
    const cut = updateBeat(file, beatIds[0]!, { manuscript: { elements: [] } });
    const found = occurrencesOf(cut, 'motif', motif.motif.id as string);

    expect(found).toHaveLength(1);
    expect(found[0]!.resolved).toBe(false);
    expect(found[0]!.where).toMatch(/has gone/);
    // What it used to say is still there, which is why it is worth keeping.
    expect(found[0]!.link.quote).toBe('The bell rang.');
    expect(countOf(cut, 'motif', motif.motif.id as string)).toEqual({ total: 1, resolved: 0, orphans: 1 });
  });

  it('puts orphans last, because they have no place in the story to sort into', () => {
    const { file: made, beatIds, elementIds } = book(['One.', 'Two.']);
    let file = made;
    const motif = addMotif(file, { name: 'A motif' });
    file = motif.file;
    for (const at of [0, 1]) {
      file = tagPassage(file, {
        kind: 'motif',
        ownerId: motif.motif.id as string,
        beatId: beatIds[at]!,
        elementId: elementIds[at]!,
      }).file;
    }
    const cut = updateBeat(file, beatIds[0]!, { manuscript: { elements: [] } });

    const found = occurrencesOf(cut, 'motif', motif.motif.id as string);
    expect(found.map((one) => one.resolved)).toEqual([true, false]);
  });
});

describe('the two tracks', () => {
  it('are two groups, never one', () => {
    const { file: made, beatIds } = book(['One.', 'Two.']);
    let file = made;
    const theme = addTheme(file, { name: 'A theme' });
    file = theme.file;
    const motif = addMotif(file, { name: 'A motif', motifType: 'object' });
    file = motif.file;
    file = tagPassage(file, { kind: 'theme', ownerId: theme.theme.id as string, beatId: beatIds[0]! }).file;
    for (const beatId of beatIds) {
      file = tagPassage(file, { kind: 'motif', ownerId: motif.motif.id as string, beatId }).file;
    }

    const tracks = thematicTracks(file);
    expect(tracks.themes).toHaveLength(1);
    expect(tracks.motifs).toHaveLength(1);
    expect(tracks.themes[0]!.marks).toHaveLength(1);
    expect(tracks.motifs[0]!.marks).toHaveLength(2);
    expect(tracks.motifs[0]!.detail).toBe('object');
  });

  it('leaves something set aside off the track, and draws no orphan', () => {
    const { file: made, beatIds, elementIds } = book(['One.', 'Two.']);
    let file = made;
    const motif = addMotif(file, { name: 'A motif' });
    file = motif.file;
    file = tagPassage(file, {
      kind: 'motif',
      ownerId: motif.motif.id as string,
      beatId: beatIds[0]!,
      elementId: elementIds[0]!,
    }).file;
    const cut = updateBeat(file, beatIds[0]!, { manuscript: { elements: [] } });

    // An orphan has no position, so it cannot be drawn at one.
    expect(thematicTracks(cut).motifs[0]!.marks).toHaveLength(0);

    const aside = updateMotif(cut, motif.motif.id, { state: 'set_aside' });
    expect(thematicTracks(aside).motifs).toHaveLength(0);
  });
});

describe('read from the scene', () => {
  it('says what a beat is carrying, by kind', () => {
    const { file: made, beatIds } = book(['One.']);
    let file = made;
    const theme = addTheme(file, { name: 'A theme' });
    file = theme.file;
    const motif = addMotif(file, { name: 'A motif' });
    file = motif.file;
    file = tagPassage(file, { kind: 'theme', ownerId: theme.theme.id as string, beatId: beatIds[0]! }).file;
    file = tagPassage(file, { kind: 'motif', ownerId: motif.motif.id as string, beatId: beatIds[0]! }).file;

    const here = thematicWorkIn(file, beatIds[0]!);
    expect(here.themes.map((one) => one.name)).toEqual(['A theme']);
    expect(here.motifs.map((one) => one.name)).toEqual(['A motif']);
  });
});

describe('the round trip', () => {
  it('keeps both kinds, their link and their occurrences through sync', () => {
    const { file: made, beatIds } = book(['One.', 'Two.']);
    let file = made;
    const theme = addTheme(file, { name: 'What a town owes its dead', arcNotes: 'Refused, then paid' });
    file = theme.file;
    const motif = addMotif(file, { name: 'the bell', motifType: 'sound' });
    file = motif.file;
    file = relateMotifToTheme(file, theme.theme.id, motif.motif.id);
    const tagged = tagPassage(file, {
      kind: 'motif',
      ownerId: motif.motif.id as string,
      beatId: beatIds[0]!,
      quote: 'It rang.',
    });
    file = noteOccurrence(tagged.file, tagged.link!.id, 'The first time.');

    const back = fromRows(toRows(file));
    expect(back.themes[0]!.arcNotes).toBe('Refused, then paid');
    expect(back.motifs[0]!.motifType).toBe('sound');
    expect(back.themeMotifLinks).toHaveLength(1);
    // The claim the module makes to a writer is the occurrence list, so it has
    // to survive the second machine.
    expect(occurrencesOf(back, 'motif', motif.motif.id as string)).toHaveLength(1);
    expect(back.usageLinks[0]!.note).toBe('The first time.');
  });

  it('does not lose the Character Creator’s own usage links', () => {
    // The widening must not disturb what was already in the table.
    const { file } = book(['One.']);
    const back = fromRows(toRows(file));
    expect(back.usageLinks).toEqual(file.usageLinks);
  });
});

describe('removing a motif', () => {
  it('takes its occurrences and its link to a theme', () => {
    const { file: made, beatIds } = book(['One.']);
    let file = made;
    const theme = addTheme(file, { name: 'A theme' });
    file = theme.file;
    const motif = addMotif(file, { name: 'A motif' });
    file = motif.file;
    file = relateMotifToTheme(file, theme.theme.id, motif.motif.id);
    file = tagPassage(file, { kind: 'motif', ownerId: motif.motif.id as string, beatId: beatIds[0]! }).file;

    const after = removeMotif(file, motif.motif.id);
    expect(after.motifs).toHaveLength(0);
    expect(after.themeMotifLinks).toHaveLength(0);
    expect(after.usageLinks).toHaveLength(0);
    expect(after.themes).toHaveLength(1);
  });
});
