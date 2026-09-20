import { describe, expect, it } from 'vitest';
import {
  appendImportedEpisode,
  buildProjectFromImport,
  createProjectFile,
  ensureFirstEpisode,
  episodes,
  markEpisodeAt,
  summarise,
  unitsInStoryOrder,
  type ImportedScript,
} from '../index.js';

/**
 * A series imported a file at a time (addendum 22 §4a): each script becomes
 * an episode after the last, on a front page of its own, in the order given.
 */

const script = (title: string, scenes: Array<{ heading: string; cue?: string; lines: string[] }>): ImportedScript =>
  summarise({
    title,
    author: '',
    scenes: scenes.map((scene) => ({
      heading: scene.heading,
      elements: scene.cue
        ? [
            { type: 'character' as const, text: scene.cue },
            ...scene.lines.map((text) => ({ type: 'dialogue' as const, text })),
          ]
        : scene.lines.map((text) => ({ type: 'action' as const, text })),
    })),
    warnings: [],
    source: 'fdx',
  });

const pilot = () =>
  script('Pilot', [
    { heading: 'INT. PRECINCT - NIGHT', cue: 'MAEVE', lines: ['Nobody goes home.'] },
    { heading: 'EXT. HARBOUR - DAWN', lines: ['The tide is out.'] },
  ]);

const wreck = () =>
  script('The Wreck', [
    { heading: 'EXT. HARBOUR - DAY', cue: 'DR HALE', lines: ['She was here before us.', 'Twice.'] },
  ]);

describe('importing a series a file at a time', () => {
  it('appends each script as the next episode, on its own page, in order', () => {
    let file = ensureFirstEpisode(buildProjectFromImport(pilot(), { format: 'series' }).file);
    expect(episodes(file).map((episode) => [episode.label, episode.title])).toEqual([['EPISODE 1', 'Pilot']]);

    const added = appendImportedEpisode(file, wreck());
    expect(added).not.toBeNull();
    file = added!.file;
    expect(added!.scenes).toBe(1);

    const all = episodes(file);
    expect(all.map((episode) => [episode.label, episode.title])).toEqual([
      ['EPISODE 1', 'Pilot'],
      ['EPISODE 2', 'The Wreck'],
    ]);
    // The first episode keeps its scenes and the second's fall after them.
    expect(all[0]?.units.map((unit) => unit.title)).toEqual(['INT. PRECINCT - NIGHT', 'EXT. HARBOUR - DAWN']);
    expect(all[1]?.units.map((unit) => unit.title)).toEqual(['EXT. HARBOUR - DAY']);
    expect(unitsInStoryOrder(file).at(-1)?.id).toBe(added!.unitId);
    // The page claims its number, so a later renumbering cannot move it.
    expect(file.markers.find((marker) => marker.id === added!.markerId)?.titlePage?.episode).toBe('Episode 2');
  });

  it('brings a newcomer into the cast once and never twice', () => {
    let file = ensureFirstEpisode(buildProjectFromImport(pilot(), { format: 'series' }).file);
    expect(file.characters.map((person) => person.name)).toEqual(['MAEVE']);
    file = appendImportedEpisode(file, wreck())!.file;
    expect(file.characters.map((person) => person.name)).toEqual(['MAEVE', 'DR HALE']);
    expect(file.characters[1]?.categoryId).toBeNull();
    file = appendImportedEpisode(file, wreck(), { title: 'The Wreck, again' })!.file;
    expect(file.characters.map((person) => person.name)).toEqual(['MAEVE', 'DR HALE']);
    expect(episodes(file).map((episode) => episode.title)).toEqual(['Pilot', 'The Wreck', 'The Wreck, again']);
  });

  it('gives a series built from its first script an episode, and leaves one that has one alone', () => {
    const built = buildProjectFromImport(pilot(), { format: 'series' }).file;
    expect(episodes(built)).toHaveLength(0);
    const first = ensureFirstEpisode(built);
    expect(episodes(first).map((episode) => episode.label)).toEqual(['EPISODE 1']);
    expect(episodes(first)[0]?.marker.unitId).toBe(unitsInStoryOrder(first)[0]?.id);
    expect(ensureFirstEpisode(first)).toBe(first);
  });

  it('takes the lowest number nobody has claimed', () => {
    let file = createProjectFile({ title: 'S', format: 'series' });
    const unit = unitsInStoryOrder(file)[0]!;
    file = markEpisodeAt(file, unit.id, { title: 'Pilot' }).file;
    expect(file.markers[0]?.titlePage?.episode).toBe('Episode 1');
    file = appendImportedEpisode(file, wreck())!.file;
    expect(episodes(file).map((episode) => episode.number)).toEqual([1, 2]);
  });

  it('adds nothing from a script with no scenes', () => {
    const file = createProjectFile({ title: 'S', format: 'series' });
    expect(appendImportedEpisode(file, script('Empty', []))).toBeNull();
  });
});
