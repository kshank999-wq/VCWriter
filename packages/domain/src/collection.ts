import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { storyMarkerSchema } from './entities/structure.js';
import { addMarker, addUnit } from './mutations.js';
import { unitsInStoryOrder } from './selectors.js';
import { placedMarkers, type PlacedMarker } from './markers.js';
import { chapterSpan } from './outline-binding.js';
import { isCollection } from './formats.js';
import { chapterName, materialiseScenes } from './import-build.js';
import type { ProjectFile } from './project-file.js';
import type { ImportedScript } from './importing.js';
import type { StoryMarker, StructuralUnit } from './entities/structure.js';
import type { CharacterId, StoryMarkerId, StructuralUnitId, TrackId } from './ids.js';

/**
 * A collection of stories (addendum 22).
 *
 * The short-story format holds one story or many, and **a story is a marker
 * over its sections** — the chapter-kind marker every prose project already
 * has, called nothing before its number, its page carrying the story's title.
 * Nothing new is stored: a collection is a project whose markers are read as
 * stories, which is what lets the Layout room set one as it sets a novel (a
 * story to a chapter, the contents page listing them) and the timeline draw
 * them where the chapters would be. What a story *covers* is `chapterSpan`,
 * a reading from its marker to the next.
 */

export interface Story {
  placed: PlacedMarker;
  /** The story's sections, in story order, from its marker to the next story's. */
  sections: StructuralUnit[];
  /** The words in it, counted every time. */
  words: number;
}

const wordsIn = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** The stories of a collection in story order; empty on any other format. */
export const storiesOf = (file: ProjectFile): Story[] => {
  if (!isCollection(file.project.format)) return [];
  return placedMarkers(file)
    .filter((placed) => placed.marker.kind === 'chapter')
    .map((placed) => {
      const sections = chapterSpan(file, placed.marker.id);
      const ids = new Set(sections.map((unit) => unit.id as string));
      const words = file.beats
        .filter((beat) => ids.has(beat.unitId as string))
        .reduce((total, beat) => total + beat.manuscript.elements.reduce((sum, element) => sum + wordsIn(element.text), 0), 0);
      return { placed, sections, words };
    });
};

/** The sections of a collection no story has claimed: those before the first marker. */
export const unplacedSections = (file: ProjectFile): StructuralUnit[] => {
  if (!isCollection(file.project.format)) return [];
  const order = unitsInStoryOrder(file);
  const first = order.findIndex((unit) => file.markers.some((marker) => marker.kind === 'chapter' && marker.unitId === unit.id));
  return first === -1 ? order : order.slice(0, first);
};

/**
 * Start a new story at the end of the collection: a fresh section, and a
 * marker on it carrying the title. A story begins on a section of its own
 * rather than on the selected one, because a story is not a division of the
 * story before it.
 */
export const beginStory = (
  file: ProjectFile,
  input: { title: string; trackId?: TrackId },
): { file: ProjectFile; unitId: StructuralUnitId; markerId: StoryMarkerId } => {
  const trackId = input.trackId ?? (file.tracks[0]?.id as TrackId);
  const made = addUnit(file, { trackId, title: '' });
  const marked = addMarker(made.file, { unitId: made.unit.id, title: input.title, kind: 'chapter' });
  return { file: marked.file, unitId: made.unit.id, markerId: marked.marker.id };
};

export interface AddedStory {
  file: ProjectFile;
  unitId: StructuralUnitId;
  markerId: StoryMarkerId;
  sections: number;
  words: number;
}

/**
 * Add a read document to the collection as one story, after the last one.
 * Its scenes become the story's sections — a document's own headings divide
 * a story, they do not make stories — and one marker on the first carries
 * the title. Nothing already in the collection is touched. Null where the
 * document held nothing to add.
 */
export const appendImportedStory = (
  file: ProjectFile,
  script: ImportedScript,
  options: { title?: string } = {},
): AddedStory | null => {
  const trackId = file.tracks[0]?.id as TrackId;
  const timestamp = nowIso();
  const last = unitsInStoryOrder(file).at(-1);
  const byName = new Map<string, CharacterId>(file.characters.map((person) => [person.name, person.id]));
  const made = materialiseScenes(script, {
    projectId: file.project.id,
    trackId,
    format: file.project.format,
    timestamp,
    byName,
    after: last?.orderKey ?? null,
    sequenceLabels: false,
    // One story: its first heading is its title, and every later heading
    // stays in the words as a heading rather than starting a story.
    headings: 'sections',
  });
  const first = made.units[0];
  if (!first) return null;

  const firstHeading = chapterName(script.scenes.find((scene) => scene.heading.trim().length > 0)?.heading ?? '');
  const title = (options.title ?? script.title ?? '').trim() || firstHeading || 'Untitled story';
  const marker: StoryMarker = storyMarkerSchema.parse({
    id: newId<StoryMarkerId>(),
    projectId: file.project.id,
    unitId: first.id,
    kind: 'chapter',
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    file: {
      ...file,
      project: { ...file.project, updatedAt: timestamp },
      units: [...file.units, ...made.units],
      beats: [...file.beats, ...made.beats],
      // The document's own headings became sections, so the only marker is
      // the story's: the ones the builder would have made are left out.
      markers: [...file.markers, marker],
      assets: [...file.assets, ...made.assets],
    },
    unitId: first.id,
    markerId: marker.id,
    sections: made.units.length,
    words: made.words,
  };
};

/** "3 stories · 12 sections · 9,400 words", for the bar. */
export const describeCollection = (file: ProjectFile): string => {
  const stories = storiesOf(file);
  const sections = stories.reduce((total, story) => total + story.sections.length, 0);
  const words = stories.reduce((total, story) => total + story.words, 0);
  const plural = (count: number, one: string, many: string) => `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
  return `${plural(stories.length, 'story', 'stories')} · ${plural(sections, 'section', 'sections')} · ${plural(words, 'word', 'words')}`;
};
