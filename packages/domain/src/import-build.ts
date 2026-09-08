import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { initialOrderKeys, orderKeyBetween } from './ordering.js';
import { beatSchema, structuralUnitSchema } from './entities/structure.js';
import { characterSchema } from './entities/character.js';
import { researchItemSchema } from './entities/research.js';
import { manuscriptElementSchema } from './entities/manuscript.js';
import { createProjectFile } from './project-file.js';
import { characterCategoriesInOrder } from './characters.js';
import type { ImportedScript } from './importing.js';
import type { ProjectFile } from './project-file.js';
import type { ProjectFormat } from './entities/project.js';
import type { Beat, StructuralUnit } from './entities/structure.js';
import type { Character } from './entities/character.js';
import type { ResearchItem } from './entities/research.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import type {
  BeatId,
  CharacterId,
  LaneId,
  ManuscriptElementId,
  ResearchItemId,
  StructuralUnitId,
} from './ids.js';

/**
 * Turning a script that was read into a project you can work in
 * (addendum 02 §18).
 *
 * The point of importing is not to hold somebody else's pages. It is to
 * arrive with **the thing already broken up**: a scene per slugline, a beat
 * to write in, the cast filed under headings, and every location on the
 * research shelf. A script that imports as one long block of text has not
 * been imported, it has been pasted.
 *
 * One scene per slugline, one beat per scene. A scene is what the script
 * says it is; how it divides into beats is the writer's own reading, and
 * guessing at it would be inventing structure that is not in the document.
 */

export interface ImportOptions {
  format?: ProjectFormat;
  /** Title and author for the project, when the file did not carry them. */
  title?: string;
  author?: string;
  /** File the cast under the project's headings by how much they speak. */
  fileCast?: boolean;
  /** Write each location up as a research note, under Locations. */
  keepLocations?: boolean;
  /** A character with at least this many speeches is a main character. */
  mainAtLeast?: number;
}

export interface ImportResult {
  file: ProjectFile;
  scenes: number;
  beats: number;
  characters: number;
  locations: number;
  words: number;
}

const wordsIn = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * Who is a main character.
 *
 * By speeches, because that is the only evidence a script actually offers.
 * The threshold is a share of the busiest part rather than a fixed number,
 * so a half-hour comedy and a two-hour feature both come out sensibly: the
 * leads speak in the same order of magnitude as the busiest, the minor parts
 * do not. Everything is a proposal — the writer refiles anyone in a click.
 */
const headingFor = (speeches: number, busiest: number, mainAtLeast: number, headings: number): number => {
  if (speeches >= mainAtLeast || speeches >= busiest * 0.4) return 0;
  // Three headings (a series) puts the middle band under "recurring".
  if (headings > 2 && speeches >= busiest * 0.12) return 1;
  return headings - 1;
};

/**
 * Build a project from a script that has been read.
 *
 * A new project rather than a merge into an open one: an import is a
 * document arriving, and dropping somebody else's script into the middle of
 * one you are writing is not something anybody asks for by accident.
 */
export const buildProjectFromImport = (script: ImportedScript, options: ImportOptions = {}): ImportResult => {
  const format = options.format ?? 'screenplay';
  const title = (options.title ?? script.title ?? '').trim() || 'Untitled';
  const author = (options.author ?? script.author ?? '').trim();

  const base = createProjectFile({ title, format, author });
  const timestamp = nowIso();
  const projectId = base.project.id;
  const laneId = base.lanes[0]?.id as LaneId;

  // ------------------------------------------------------------- the cast
  const headings = characterCategoriesInOrder(base);
  const busiest = script.characters[0]?.speeches ?? 0;
  const mainAtLeast = options.mainAtLeast ?? 12;
  const byName = new Map<string, CharacterId>();

  // In order of how much they speak, so the busiest part reads first here too.
  const characters: Character[] = script.characters.map((person) => {
    const id = newId<CharacterId>();
    byName.set(person.name, id);
    const heading =
      options.fileCast === false
        ? null
        : (headings[headingFor(person.speeches, busiest, mainAtLeast, headings.length)]?.id ?? null);
    return characterSchema.parse({
      id,
      projectId,
      name: person.name,
      // What the script itself says about them: how much they carry.
      description: `${person.speeches} ${person.speeches === 1 ? 'speech' : 'speeches'} across ${person.scenes} ${person.scenes === 1 ? 'scene' : 'scenes'}.`,
      categoryId: heading,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  // -------------------------------------------------------- scenes & beats
  const scenes = script.scenes.filter(
    (scene) => scene.heading.trim().length > 0 || scene.elements.length > 0,
  );
  const sceneKeys = initialOrderKeys(Math.max(1, scenes.length));

  const units: StructuralUnit[] = [];
  const beats: Beat[] = [];
  let words = 0;

  scenes.forEach((scene, index) => {
    const unitId = newId<StructuralUnitId>();
    units.push(
      structuralUnitSchema.parse({
        id: unitId,
        projectId,
        laneId,
        kind: format === 'novel' || format === 'short_story' ? 'chapter' : 'scene',
        // The slugline is the scene's title as well as its first line: the
        // heading prints, the title is what the timeline shows.
        title: scene.heading.trim(),
        sequenceLabel: format === 'novel' || format === 'short_story' ? `Chapter ${index + 1}` : `Sc. ${index + 1}`,
        status: 'draft_complete',
        orderKey: sceneKeys[index] ?? orderKeyBetween(null, null),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );

    const elements: ManuscriptElement[] = [];
    if (scene.heading.trim().length > 0) {
      elements.push(
        manuscriptElementSchema.parse({
          id: newId<ManuscriptElementId>(),
          type: 'scene_heading',
          text: scene.heading.trim(),
        }),
      );
    }
    for (const element of scene.elements) {
      words += wordsIn(element.text);
      elements.push(
        manuscriptElementSchema.parse({
          id: newId<ManuscriptElementId>(),
          type: element.type,
          text: element.text,
          // Bound to the character so read-back can voice it (§10).
          characterId: element.type === 'character' ? (byName.get(element.text.trim().toUpperCase()) ?? null) : null,
          attributes: {
            ...(element.dual ? { dual: true } : {}),
            // Marked so the writer can be shown what to look at, and so a
            // later pass can find every line the reader was unsure of.
            ...(element.guessed ? { imported_guess: true } : {}),
          },
        }),
      );
    }

    beats.push(
      beatSchema.parse({
        id: newId<BeatId>(),
        projectId,
        unitId,
        title: '',
        status: 'written',
        orderKey: orderKeyBetween(null, null),
        manuscript: { elements },
        revisionName: 'Imported',
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
  });

  // ---------------------------------------------------------- the locations
  const locationsFolder = base.researchCategories.find((category) => category.systemKey === 'locations');
  const locationKeys = initialOrderKeys(Math.max(1, script.locations.length));
  const research: ResearchItem[] =
    options.keepLocations === false || !locationsFolder
      ? []
      : script.locations.map((location, index) =>
          researchItemSchema.parse({
            id: newId<ResearchItemId>(),
            projectId,
            categoryId: locationsFolder.id,
            title: location.name,
            body:
              `${location.scenes} ${location.scenes === 1 ? 'scene' : 'scenes'}` +
              (location.where === 'unknown' ? '.' : `, ${location.where}.`),
            usage: 'used',
            usedConfirmed: false,
            orderKey: locationKeys[index] ?? orderKeyBetween(null, null),
            origin: 'import',
            createdAt: timestamp,
            updatedAt: timestamp,
          }),
        );

  const file: ProjectFile = {
    ...base,
    project: { ...base.project, author, notes: noteFor(script), updatedAt: timestamp },
    // The scene the project was created with is replaced: an import brings
    // its own, and an empty "Opening Scene" ahead of page one is litter.
    units: units.length > 0 ? units : base.units,
    beats: beats.length > 0 ? beats : base.beats,
    characters,
    researchItems: [...base.researchItems, ...research],
  };

  return {
    file,
    scenes: units.length,
    beats: beats.length,
    characters: characters.length,
    locations: research.length,
    words,
  };
};

const noteFor = (script: ImportedScript): string => {
  const from = script.source === 'fdx' ? 'a Final Draft document' : script.source === 'pdf' ? 'a PDF' : 'plain text';
  const lines = [`Imported from ${from}.`];
  if (script.warnings.length > 0) lines.push('', ...script.warnings.map((warning) => `— ${warning}`));
  return lines.join('\n');
};
