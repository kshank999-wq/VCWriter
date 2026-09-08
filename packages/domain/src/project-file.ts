import { z } from 'zod';
import { newId } from './ids.js';
import { initialOrderKeys, orderKeyBetween } from './ordering.js';
import { nowIso } from './entities/common.js';
import { characterSchema } from './entities/character.js';
import { storyLinkSchema } from './entities/links.js';
import {
  DEFAULT_RESEARCH_CATEGORIES,
  researchCategorySchema,
  researchItemSchema,
} from './entities/research.js';
import { setupPayoffSchema } from './entities/setups.js';
import { snapshotSchema } from './entities/revision.js';
import { writingSessionSchema } from './sessions.js';
import {
  projectSchema,
  projectSettingsSchema,
  type ProjectFormat,
} from './entities/project.js';
import { LANE_COLOURS, beatSchema, laneSchema, storyMarkerSchema, structuralUnitSchema } from './entities/structure.js';
import type { LaneId, ProjectId, ResearchCategoryId, StructuralUnitId, UserId } from './ids.js';

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
 *  2 — scene order is global rather than per lane, and `markers[]` exists
 *      (addendum 02 §8, §9).
 */
export const PROJECT_FORMAT_VERSION = 2;

export const projectFileSchema = z.object({
  formatVersion: z.number().int().positive(),
  /** Written by the app that last saved the file; support/telemetry only. */
  generator: z.string().default('vcwriter'),
  savedAt: z.string().datetime({ offset: true }),
  project: projectSchema,
  settings: projectSettingsSchema,
  lanes: z.array(laneSchema).default([]),
  units: z.array(structuralUnitSchema).default([]),
  beats: z.array(beatSchema).default([]),
  markers: z.array(storyMarkerSchema).default([]),
  researchCategories: z.array(researchCategorySchema).default([]),
  researchItems: z.array(researchItemSchema).default([]),
  characters: z.array(characterSchema).default([]),
  links: z.array(storyLinkSchema).default([]),
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
  laneId?: unknown;
}

const byOrderKey = (a: OrderedRow, b: OrderedRow): number => {
  const left = typeof a.orderKey === 'string' ? a.orderKey : '';
  const right = typeof b.orderKey === 'string' ? b.orderKey : '';
  if (left === right) return String(a.id).localeCompare(String(b.id));
  return left < right ? -1 : 1;
};

/**
 * Format 1 ordered scenes within their lane and printed lane by lane. Format
 * 2 orders scenes across the project. Re-key every scene in the order it
 * printed before — lane order, then scene order — so the manuscript reads
 * exactly as it did until the writer moves something.
 */
const migrateToGlobalStoryOrder = (doc: Record<string, unknown>): Record<string, unknown> => {
  const lanes = Array.isArray(doc['lanes']) ? ([...doc['lanes']] as OrderedRow[]).sort(byOrderKey) : [];
  const units = Array.isArray(doc['units']) ? ([...doc['units']] as OrderedRow[]) : [];

  const printed: OrderedRow[] = [];
  for (const lane of lanes) {
    printed.push(...units.filter((unit) => unit.laneId === lane.id).sort(byOrderKey));
  }
  // A scene whose lane is missing still has to land somewhere: after everything.
  printed.push(...units.filter((unit) => !lanes.some((lane) => lane.id === unit.laneId)).sort(byOrderKey));

  const keys = initialOrderKeys(printed.length);
  const keyFor = new Map(printed.map((unit, index) => [unit, keys[index]]));
  // The re-key is an edit as far as sync is concerned: stamped now, so the
  // next merge pushes the global keys to the cloud rather than letting a
  // copy that still carries per-lane keys win and interleave the two.
  const stamp = nowIso();

  return {
    ...doc,
    formatVersion: 2,
    units: units.map((unit) => ({ ...unit, orderKey: keyFor.get(unit) ?? unit.orderKey, updatedAt: stamp })),
    markers: Array.isArray(doc['markers']) ? doc['markers'] : [],
  };
};

/** Ordered, contiguous migrations from an older format version to the current one. */
const MIGRATIONS: readonly Migration[] = [{ from: 1, to: 2, migrate: migrateToGlobalStoryOrder }];

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
  format === 'novel' || format === 'short_story' ? 'chapter' : 'scene';

/**
 * A new project starts usable: one main-plot lane holding one empty
 * scene/chapter with one beat, plus the default research categories (§7.1).
 */
export const createProjectFile = (options: CreateProjectOptions): ProjectFile => {
  const timestamp = nowIso();
  const projectId = newId<ProjectId>();
  const laneId = newId<LaneId>();
  const unitId = newId<StructuralUnitId>();
  const unitKind = defaultUnitKind(options.format);

  const categoryKeys = initialOrderKeys(DEFAULT_RESEARCH_CATEGORIES.length);
  const researchCategories = DEFAULT_RESEARCH_CATEGORIES.map((category, index) =>
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
    lanes: [
      {
        id: laneId,
        projectId,
        name: 'Main Plot',
        kind: 'main_plot',
        color: LANE_COLOURS[0],
        orderKey: orderKeyBetween(null, null),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    units: [
      {
        id: unitId,
        projectId,
        laneId,
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
  });
};
