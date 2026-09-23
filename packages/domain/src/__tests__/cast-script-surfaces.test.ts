import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addCharacter,
  addEpisode,
  addUnit,
  castCalled,
  castForNewEpisode,
  castNeverSpoken,
  charactersCalled,
  createProjectFile,
  cuesWithoutCharacter,
  notedCast,
  peopleSpeakingIn,
  removeCharacter,
  scriptPresence,
  type ProjectFile,
} from '../index.js';

/**
 * Everywhere a **cue** is turned into a person, after that person has been
 * deleted (addendum 24 §5o).
 *
 * §5i swept the surfaces that read the cast *list* and pointed them at
 * `workingCast`. These are the ones that start from the **manuscript** and
 * arrive at a person, and all three wrote `!person.archived` for themselves —
 * which was the whole answer before the graveyard and half of one after it.
 * This walks every one of them, and pins the two readings that must go on
 * seeing the buried, which is the half that keeps a delete from turning into a
 * duplicate.
 */

/** A series whose last episode has MARA speaking in two scenes. */
const spoken = () => {
  let file: ProjectFile = createProjectFile({ title: 'The Drowned Bell', format: 'series' });
  file = addEpisode(file, { title: 'Pilot' }).file;
  const trackId = file.tracks[0]!.id;
  const beatIds: string[] = [];
  for (let at = 0; at < 2; at += 1) {
    const scene = addUnit(file, { trackId, title: `Scene ${at + 1}` });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
    file = beat.file;
    beatIds.push(beat.beat.id as string);
  }

  file = addCharacter(file, { name: 'MARA' });
  const maraId = file.characters[file.characters.length - 1]!.id;

  // MARA speaks in both scenes, once with an extension.
  file = {
    ...file,
    beats: file.beats.map((beat) =>
      beatIds.includes(beat.id as string)
        ? {
            ...beat,
            manuscript: {
              ...beat.manuscript,
              elements: [
                {
                  id: `${beat.id}-cue` as never,
                  type: 'character' as const,
                  text: (beat.id as string) === beatIds[0] ? 'MARA' : 'MARA (V.O.)',
                  order: 0,
                  attributes: {},
                },
                {
                  id: `${beat.id}-line` as never,
                  type: 'dialogue' as const,
                  text: 'The bell again.',
                  order: 1,
                  attributes: {},
                },
              ],
            },
          }
        : beat,
    ),
  };

  return { file, maraId, beatIds, gone: removeCharacter(file, maraId) };
};

const beatOf = (file: ProjectFile, beatId: string) =>
  file.beats.find((one) => (one.id as string) === beatId)!;

describe('a deleted character, read back off the script', () => {
  it('was there before the delete, everywhere', () => {
    const { file, maraId, beatIds } = spoken();

    expect(peopleSpeakingIn(file, beatOf(file, beatIds[0]!))).toContain(maraId);
    expect(scriptPresence(file).map((row) => row.characterId)).toContain(maraId);
    expect(castForNewEpisode(file, { castFrom: [], castWhoSpoke: true })).toContain(maraId);
  });

  /**
   * The fourth, and the one 2100 green tests missed: driving the real Research
   * room showed a deleted MARA still standing under *In the cast, not yet
   * speaking*. A list of who is in the cast is a reading over the cast.
   */
  it('leaves the never-spoken list', () => {
    const { file, gone, maraId } = spoken();
    const silent = createProjectFile({ title: 'Quiet', format: 'screenplay' });
    const withHer = addCharacter(silent, { name: 'MARA' });
    const her = withHer.characters[withHer.characters.length - 1]!.id;

    expect(castNeverSpoken(withHer)).toContain(her);
    expect(castNeverSpoken(removeCharacter(withHer, her))).not.toContain(her);
    // And she is not resurrected into it by being deleted mid-script either.
    expect(castNeverSpoken(file)).not.toContain(maraId);
    expect(castNeverSpoken(gone)).not.toContain(maraId);
  });

  it('stops speaking in a beat', () => {
    const { gone, maraId, beatIds } = spoken();
    expect(peopleSpeakingIn(gone, beatOf(gone, beatIds[0]!))).not.toContain(maraId);
  });

  it('leaves the script-presence review', () => {
    const { gone, maraId } = spoken();
    expect(scriptPresence(gone).map((row) => row.characterId)).not.toContain(maraId);
  });

  it('is not carried into the next episode', () => {
    const { gone, maraId } = spoken();
    expect(castForNewEpisode(gone, { castFrom: [], castWhoSpoke: true })).not.toContain(maraId);
  });

  /**
   * The other half, and the one that stops a delete becoming a duplicate
   * (§5l's edge). These two ask *does the script name somebody this project
   * has never heard of*, which is a question about the manuscript — so they
   * must go on counting the buried, or `notedCast` would file a second MARA
   * beside the one in the graveyard.
   */
  it('is still known to the cue matcher, so no second MARA is filed', () => {
    const { gone, maraId } = spoken();

    expect(charactersCalled(gone, 'MARA (V.O.)').map((one) => one.id)).toContain(maraId);
    expect(castCalled(gone, 'MARA (V.O.)')).toHaveLength(0);

    expect(cuesWithoutCharacter(gone).map((one) => one.cue)).not.toContain('MARA');

    const after = notedCast(gone);
    expect(after.characters).toHaveLength(gone.characters.length);
    expect(after.characters.filter((one) => one.name === 'MARA')).toHaveLength(1);
  });
});
