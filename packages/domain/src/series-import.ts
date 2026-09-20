import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { storyMarkerSchema } from './entities/structure.js';
import { titlePageSchema } from './entities/title-page.js';
import { characterSchema } from './entities/character.js';
import { materialiseScenes } from './import-build.js';
import { episodes, nextEpisodeNumber } from './episodes.js';
import { unitsInStoryOrder } from './selectors.js';
import type { ImportedScript } from './importing.js';
import type { ProjectFile } from './project-file.js';
import type { Character } from './entities/character.js';
import type { StoryMarker } from './entities/structure.js';
import type { CharacterId, StoryMarkerId, StructuralUnitId, TrackId } from './ids.js';

/**
 * Importing a series a file at a time (addendum 22 §4a): one script in, one
 * episode out, after the last one already there, with the front page every
 * episode has and the marker that opens it. What `appendImportedStory` is
 * to a collection, this is to a series — the same builder underneath, so a
 * scene comes in exactly as the script importer would have brought it, and
 * a writer who imports a season a file at a time gets each on its own page
 * in the order the files were given.
 */

export interface AddedEpisode {
  file: ProjectFile;
  unitId: StructuralUnitId;
  markerId: StoryMarkerId;
  scenes: number;
  words: number;
}

/**
 * Open an episode on a scene already in the story: the marker, with a front
 * page that claims the lowest number no episode has. The first script of a
 * series comes in through the project builder, which knows nothing of
 * episodes, so it is this that gives it its page before the second script
 * is appended — without it the second would be *Episode 1*.
 */
export const markEpisodeAt = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  options: { title?: string } = {},
): { file: ProjectFile; markerId: StoryMarkerId } => {
  const timestamp = nowIso();
  const marker: StoryMarker = storyMarkerSchema.parse({
    id: newId<StoryMarkerId>(),
    projectId: file.project.id,
    unitId,
    kind: 'episode',
    title: (options.title ?? '').trim(),
    // Its own front page, started with the one thing already known: which
    // episode this is (addendum 02 §17). The rest falls back to the series'.
    titlePage: titlePageSchema.parse({ episode: `Episode ${nextEpisodeNumber(file)}` }),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return {
    file: { ...file, project: { ...file.project, updatedAt: timestamp }, markers: [...file.markers, marker] },
    markerId: marker.id,
  };
};

/**
 * A series built from its first script has scenes and no episode. Give it
 * one, on the first scene, so what is appended next is the second. A series
 * that already has an episode is handed back as it is.
 */
export const ensureFirstEpisode = (file: ProjectFile, options: { title?: string } = {}): ProjectFile => {
  if (episodes(file).length > 0) return file;
  const first = unitsInStoryOrder(file)[0];
  if (!first) return file;
  return markEpisodeAt(file, first.id, { title: options.title ?? file.project.title }).file;
};

export const appendImportedEpisode = (
  file: ProjectFile,
  script: ImportedScript,
  options: { title?: string } = {},
): AddedEpisode | null => {
  const trackId = file.tracks[0]?.id as TrackId;
  const timestamp = nowIso();
  const last = unitsInStoryOrder(file).at(-1);
  const byName = new Map<string, CharacterId>(file.characters.map((person) => [person.name, person.id]));

  // Whoever speaks in this episode and is not yet in the cast joins it,
  // unfiled: the series' headings are the writer's to sort them under.
  const newcomers: Character[] = script.characters
    .filter((person) => !byName.has(person.name))
    .map((person) => {
      const id = newId<CharacterId>();
      byName.set(person.name, id);
      return characterSchema.parse({
        id,
        projectId: file.project.id,
        name: person.name,
        aliases: person.aliases ?? [],
        description:
          person.speeches === 0
            ? `Named in the action, with no lines. ${person.scenes} ${person.scenes === 1 ? 'scene' : 'scenes'}.`
            : `${person.speeches} ${person.speeches === 1 ? 'speech' : 'speeches'} across ${person.scenes} ${person.scenes === 1 ? 'scene' : 'scenes'}.`,
        categoryId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

  const made = materialiseScenes(script, {
    projectId: file.project.id,
    trackId,
    format: file.project.format,
    timestamp,
    byName,
    after: last?.orderKey ?? null,
    sequenceLabels: false,
  });
  const first = made.units[0];
  if (!first) return null;

  const joined: ProjectFile = {
    ...file,
    project: { ...file.project, updatedAt: timestamp },
    characters: [...file.characters, ...newcomers],
    units: [...file.units, ...made.units],
    beats: [...file.beats, ...made.beats],
    // A script's own markers would be acts; the episode is the one marker
    // this adds, and its scenes are its own.
    assets: [...file.assets, ...made.assets],
  };
  const marked = markEpisodeAt(joined, first.id, { title: options.title ?? script.title ?? '' });

  return {
    file: marked.file,
    unitId: first.id,
    markerId: marked.markerId,
    scenes: made.units.length,
    words: made.words,
  };
};
