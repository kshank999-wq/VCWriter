import { z } from 'zod';
import { newId } from './ids.js';
import { initialOrderKeys, orderKeyBetween } from './ordering.js';
import { nowIso } from './entities/common.js';
import { characterCategorySchema, characterSchema } from './entities/character.js';
import { defaultCharacterCategories } from './characters.js';
import { storyLinkSchema } from './entities/links.js';
import { storyThreadSchema } from './entities/threads.js';
import { gameSetupSchema } from './entities/game.js';
import { implementationBindingSchema } from './entities/implementation.js';
import {
  choiceSchema,
  narrativeElementSchema,
  resourceDefinitionSchema,
  simulationRunSchema,
  stateDefinitionSchema,
} from './entities/narrative.js';
import { learningAidSchema } from './entities/learning.js';
import { importBatchSchema } from './entities/import-batch.js';
import {
  arcPointSchema,
  characterArcSchema,
  characterRelationshipSchema,
  characterTraitSchema,
  characterizationItemSchema,
  usageLinkSchema,
} from './character-creator.js';
import {
  researchMotifSchema,
  researchThemeSchema,
  themeMotifLinkSchema,
} from './entities/themes.js';
import { locationSchema } from './entities/locations.js';
import {
  DEFAULT_RESEARCH_CATEGORIES,
  INSTRUCTIONAL_RESEARCH_CATEGORIES,
  researchCategorySchema,
  researchItemSchema,
} from './entities/research.js';
import { assetSchema } from './entities/asset.js';
import { boardSchema } from './entities/sculptor.js';
import { outlineSchema } from './entities/outline.js';
import { setupPayoffSchema } from './entities/setups.js';
import { indexMarkSchema, indexRefSchema } from './entities/book-index.js';
import { snapshotSchema } from './entities/revision.js';
import { writingSessionSchema } from './sessions.js';
import {
  projectSchema,
  projectSettingsSchema,
  type ProjectFormat,
} from './entities/project.js';
import { TRACK_COLOURS, beatSchema, trackSchema, storyMarkerSchema, structuralUnitSchema } from './entities/structure.js';
import type { CharacterCategoryId, TrackId, ProjectId, ResearchCategoryId, StructuralUnitId, UserId } from './ids.js';
import { isInstructional, isProseFormat } from './formats.js';

/**
 * The VC Writer project document.
 *
 * One platform-neutral shape is the single source of truth for the desktop
 * app's local file, the Supabase row set and any export (spec §3.1: a project
 * created on Windows opens on macOS with structure, links and metadata intact;
 * §14: keep the manuscript/project format platform-neutral).
 *
 * Bump `PROJECT_FORMAT_VERSION` whenever the shape changes and add a migration
 * to `MIGRATIONS`. Callers take a `pre_migration` snapshot first (§14).
 *
 * Versions:
 *  1 — initial release.
 *  2 — scene order is global rather than per track, and `markers[]` exists
 *      (addendum 02 §8, §9).
 *  3 — a lane is a track (migration 0051): `lanes[]` is `tracks[]`, a unit's
 *      `laneId` is its `trackId`, and a story link's `lane` end is a `track`.
 *      The rename went into the database and the code on the same day and
 *      the file format was forgotten, so a project saved before it failed
 *      validation on `units.0.trackId: Required` — which is what a format
 *      version is for.
 */
export const PROJECT_FORMAT_VERSION = 3;

export const projectFileSchema = z.object({
  formatVersion: z.number().int().positive(),
  /** Written by the app that last saved the file; support/telemetry only. */
  generator: z.string().default('vcwriter'),
  savedAt: z.string().datetime({ offset: true }),
  project: projectSchema,
  settings: projectSettingsSchema,
  tracks: z.array(trackSchema).default([]),
  units: z.array(structuralUnitSchema).default([]),
  beats: z.array(beatSchema).default([]),
  markers: z.array(storyMarkerSchema).default([]),
  /**
   * The pictures the document carries (addendum 05 §3c): storyboard frames,
   * each stored once and referenced by id. Empty in a file that has none,
   * which is every file that predates them.
   */
  assets: z.array(assetSchema).default([]),
  /**
   * The Story Sculptor's boards (addendum 03). Empty in every file that
   * predates them, and in every project whose writer has not opened one.
   */
  boards: z.array(boardSchema).default([]),
  /** The Outliner's trees (addendum 06). Empty until one is made. */
  outlines: z.array(outlineSchema).default([]),
  researchCategories: z.array(researchCategorySchema).default([]),
  researchItems: z.array(researchItemSchema).default([]),
  characters: z.array(characterSchema).default([]),
  /** The headings the cast is filed under (addendum 02 §16). */
  characterCategories: z.array(characterCategorySchema).default([]),
  /**
   * The Character Creator (addendum 08). Empty in every file that predates it
   * and in every project whose writer has not opened one — which, like the
   * boards and the outlines, is most of them for a while.
   *
   * Six collections rather than a nested tree, for the reason every other
   * collection here is flat: a per-record sync merge compares records, and a
   * character carrying its traits carrying their characterization would be one
   * record as far as the merge is concerned.
   */
  characterTraits: z.array(characterTraitSchema).default([]),
  characterizationItems: z.array(characterizationItemSchema).default([]),
  usageLinks: z.array(usageLinkSchema).default([]),
  /**
   * Themes and motifs (addendum 12 §2): two collections rather than one, all
   * the way down, because one place that blurred them is the place the
   * interface would start to.
   */
  themes: z.array(researchThemeSchema).default([]),
  motifs: z.array(researchMotifSchema).default([]),
  themeMotifLinks: z.array(themeMotifLinkSchema).default([]),
  /**
   * Locations (addendum 14): reusable places, each with however many prepared
   * descriptions the writer has made for it.
   */
  locations: z.array(locationSchema).default([]),
  characterArcs: z.array(characterArcSchema).default([]),
  arcPoints: z.array(arcPointSchema).default([]),
  characterRelationships: z.array(characterRelationshipSchema).default([]),
  /**
   * The back-of-book index (addendum 10). Two collections, because a mark in
   * the manuscript and a cross-reference between headings are different in
   * kind — `entities/book-index.ts` says why.
   */
  indexMarks: z.array(indexMarkSchema).default([]),
  indexRefs: z.array(indexRefSchema).default([]),
  links: z.array(storyLinkSchema).default([]),
  /**
   * Narrative threads (addendum 15). One collection, because a thread's
   * *moments* are `usageLinks` and its *dependencies* are `links` — the module
   * asks for three record types and two of them were already here.
   */
  threads: z.array(storyThreadSchema).default([]),
  /**
   * The interactive narrative graph (addendum 18). Empty in every project that
   * is not a game.
   *
   * Four collections and no edge table: **a choice is not an edge** (§2), so
   * the only edge in the module is a choice's `toElementId`, and everything the
   * spec calls a relationship is a condition or an effect living on the thing
   * it is about.
   */
  narrativeElements: z.array(narrativeElementSchema).default([]),
  choices: z.array(choiceSchema).default([]),
  stateDefinitions: z.array(stateDefinitionSchema).default([]),
  resourceDefinitions: z.array(resourceDefinitionSchema).default([]),
  /** Saved playthroughs (addendum 18 §13) — the module's one stored thing. */
  simulationRuns: z.array(simulationRunSchema).default([]),
  /** What the designer said the game is (addendum 18 §2). */
  gameSetup: gameSetupSchema.nullable().default(null),
  /**
   * What VC Game Studio has built in an engine (addendum 25 §2). VC Writer
   * never writes one; it is here so that a Save in VC Writer **keeps** them,
   * because a collection the schema does not name is stripped on load.
   */
  implementationBindings: z.array(implementationBindingSchema).default([]),
  /**
   * End-of-section learning aids (addendum 16 §10). Empty in every project
   * that is not an instructional book, and in most that are.
   */
  learningAids: z.array(learningAidSchema).default([]),
  /**
   * What each import brought in, and what it could not (addendum 16 §4).
   *
   * In the document rather than a table, like `sessions`: it is a record of
   * something that happened to this project, small, and worth following the
   * work to another machine.
   */
  importBatches: z.array(importBatchSchema).default([]),
  setupsPayoffs: z.array(setupPayoffSchema).default([]),
  snapshots: z.array(snapshotSchema).default([]),
  /**
   * What the writing cost, sitting by sitting (addendum 02 §15). In the
   * document so the record follows the work to another machine.
   */
  sessions: z.array(writingSessionSchema).default([]),
});
export type ProjectFile = z.infer<typeof projectFileSchema>;

export class ProjectFormatError extends Error {
  readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ProjectFormatError';
    this.details = details;
  }
}

interface Migration {
  readonly from: number;
  readonly to: number;
  readonly migrate: (input: Record<string, unknown>) => Record<string, unknown>;
}

interface OrderedRow {
  id?: unknown;
  orderKey?: unknown;
  trackId?: unknown;
}

const byOrderKey = (a: OrderedRow, b: OrderedRow): number => {
  const left = typeof a.orderKey === 'string' ? a.orderKey : '';
  const right = typeof b.orderKey === 'string' ? b.orderKey : '';
  if (left === right) return String(a.id).localeCompare(String(b.id));
  return left < right ? -1 : 1;
};

/**
 * Format 1 ordered scenes within their track and printed track by track. Format
 * 2 orders scenes across the project. Re-key every scene in the order it
 * printed before — track order, then scene order — so the manuscript reads
 * exactly as it did until the writer moves something.
 */
const migrateToGlobalStoryOrder = (doc: Record<string, unknown>): Record<string, unknown> => {
  const tracks = Array.isArray(doc['tracks']) ? ([...doc['tracks']] as OrderedRow[]).sort(byOrderKey) : [];
  const units = Array.isArray(doc['units']) ? ([...doc['units']] as OrderedRow[]) : [];

  const printed: OrderedRow[] = [];
  for (const track of tracks) {
    printed.push(...units.filter((unit) => unit.trackId === track.id).sort(byOrderKey));
  }
  // A scene whose track is missing still has to land somewhere: after everything.
  printed.push(...units.filter((unit) => !tracks.some((track) => track.id === unit.trackId)).sort(byOrderKey));

  const keys = initialOrderKeys(printed.length);
  const keyFor = new Map(printed.map((unit, index) => [unit, keys[index]]));
  // The re-key is an edit as far as sync is concerned: stamped now, so the
  // next merge pushes the global keys to the cloud rather than letting a
  // copy that still carries per-track keys win and interleave the two.
  const stamp = nowIso();

  return {
    ...doc,
    formatVersion: 2,
    units: units.map((unit) => ({ ...unit, orderKey: keyFor.get(unit) ?? unit.orderKey, updatedAt: stamp })),
    markers: Array.isArray(doc['markers']) ? doc['markers'] : [],
  };
};

/**
 * Format 2 called a track a lane. Format 3 says track everywhere, the way
 * the code and the database have since migration 0051. Each rename is made
 * only where the old name is present, so a format-2 file saved *after* the
 * rename — which already says track, the version having not been bumped —
 * passes through unchanged.
 */
const migrateLanesToTracks = (doc: Record<string, unknown>): Record<string, unknown> => {
  const rows = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null) : [];
  const tracks = Array.isArray(doc['tracks']) ? doc['tracks'] : Array.isArray(doc['lanes']) ? doc['lanes'] : [];
  const units = rows(doc['units']).map((unit) => {
    if ('trackId' in unit || !('laneId' in unit)) return unit;
    const { laneId, ...rest } = unit;
    return { ...rest, trackId: laneId };
  });
  const end = (value: unknown): unknown => {
    if (typeof value !== 'object' || value === null) return value;
    const ref = value as Record<string, unknown>;
    return ref['type'] === 'lane' ? { ...ref, type: 'track' } : ref;
  };
  const links = rows(doc['links']).map((link) => ({ ...link, from: end(link['from']), to: end(link['to']) }));
  const { lanes: _lanes, ...rest } = doc;
  return {
    ...rest,
    formatVersion: 3,
    tracks,
    units,
    ...(Array.isArray(doc['links']) ? { links } : {}),
  };
};

/** Ordered, contiguous migrations from an older format version to the current one. */
const MIGRATIONS: readonly Migration[] = [
  { from: 1, to: 2, migrate: migrateToGlobalStoryOrder },
  { from: 2, to: 3, migrate: migrateLanesToTracks },
];

/** Apply every migration needed to bring a raw document up to the current version. */
export const migrateProjectFile = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== 'object' || raw === null) {
    throw new ProjectFormatError('Project file is not an object');
  }
  let doc = { ...(raw as Record<string, unknown>) };
  const declared = doc['formatVersion'];
  if (typeof declared !== 'number' || !Number.isInteger(declared) || declared < 1) {
    throw new ProjectFormatError('Project file is missing a valid formatVersion');
  }
  if (declared > PROJECT_FORMAT_VERSION) {
    throw new ProjectFormatError(
      `Project was saved by a newer version of VC Writer (format ${declared}; this build supports ${PROJECT_FORMAT_VERSION}). Update VC Writer to open it.`,
    );
  }
  let version = declared;
  while (version < PROJECT_FORMAT_VERSION) {
    const migration = MIGRATIONS.find((candidate) => candidate.from === version);
    if (!migration) {
      throw new ProjectFormatError(`No migration path from project format ${version} to ${PROJECT_FORMAT_VERSION}`);
    }
    doc = migration.migrate(doc);
    version = migration.to;
  }
  doc['formatVersion'] = PROJECT_FORMAT_VERSION;
  return doc;
};

/** Migrate then validate. This is the only supported way to load a project. */
export const parseProjectFile = (raw: unknown): ProjectFile => {
  const migrated = migrateProjectFile(raw);
  const result = projectFileSchema.safeParse(migrated);
  if (!result.success) {
    throw new ProjectFormatError(`Project file failed validation: ${result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`, result.error);
  }
  return result.data;
};

export const serializeProjectFile = (file: ProjectFile): string =>
  JSON.stringify({ ...file, formatVersion: PROJECT_FORMAT_VERSION, savedAt: nowIso() }, null, 2);

export interface CreateProjectOptions {
  title: string;
  format: ProjectFormat;
  author?: string;
  logline?: string;
  ownerId?: UserId | null;
}

/** Unit kind a format uses for its top-level container (spec §5.2). */
export const defaultUnitKind = (format: ProjectFormat): 'scene' | 'chapter' =>
  isProseFormat(format) ? 'chapter' : 'scene';

/**
 * A new project starts usable: one main-plot track holding one empty
 * scene/chapter with one beat, plus the default research categories (§7.1).
 */
export const createProjectFile = (options: CreateProjectOptions): ProjectFile => {
  const timestamp = nowIso();
  const projectId = newId<ProjectId>();
  const trackId = newId<TrackId>();
  const unitId = newId<StructuralUnitId>();
  const unitKind = defaultUnitKind(options.format);

  // The headings the cast is filed under. A series makes one more
  // distinction than the rest — recurring, between main and minor (§16).
  const castNames = defaultCharacterCategories(options.format);
  const castKeys = initialOrderKeys(castNames.length);
  const characterCategories = castNames.map((name, index) =>
    characterCategorySchema.parse({
      id: newId<CharacterCategoryId>(),
      projectId,
      name,
      orderKey: castKeys[index],
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );

  /**
   * Which shelves a new project starts with (addendum 16 §3).
   *
   * An instructional book gets graphics, notes, ideas and an inbox rather than
   * characters, props and themes — §15 requires the two taxonomies stay
   * distinct, and a professor offered a Characters folder has been told what
   * kind of book they are writing.
   */
  const seeded = isInstructional(options.format)
    ? INSTRUCTIONAL_RESEARCH_CATEGORIES
    : DEFAULT_RESEARCH_CATEGORIES;
  const categoryKeys = initialOrderKeys(seeded.length);
  const researchCategories = seeded.map((category, index) =>
    researchCategorySchema.parse({
      id: newId<ResearchCategoryId>(),
      projectId,
      name: category.name,
      systemKey: category.systemKey,
      orderKey: categoryKeys[index],
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );

  return projectFileSchema.parse({
    formatVersion: PROJECT_FORMAT_VERSION,
    generator: 'vcwriter',
    savedAt: timestamp,
    project: {
      id: projectId,
      ownerId: options.ownerId ?? null,
      format: options.format,
      title: options.title,
      author: options.author ?? '',
      logline: options.logline ?? '',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    settings: projectSettingsSchema.parse({}),
    tracks: [
      {
        id: trackId,
        projectId,
        name: 'Main Plot',
        kind: 'main_plot',
        color: TRACK_COLOURS[0],
        orderKey: orderKeyBetween(null, null),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    units: [
      {
        id: unitId,
        projectId,
        trackId,
        kind: unitKind,
        title: unitKind === 'chapter' ? 'Chapter One' : 'Opening Scene',
        sequenceLabel: unitKind === 'chapter' ? 'Chapter 1' : 'Sc. 1',
        orderKey: orderKeyBetween(null, null),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    beats: [
      {
        id: newId(),
        projectId,
        unitId,
        title: 'Opening beat',
        orderKey: orderKeyBetween(null, null),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    researchCategories,
    characterCategories,
  });
};
