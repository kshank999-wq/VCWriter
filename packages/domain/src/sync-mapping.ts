import { characterSchema } from './entities/character.js';
import { storyLinkSchema } from './entities/links.js';
import { researchCategorySchema, researchItemSchema } from './entities/research.js';
import { setupPayoffSchema } from './entities/setups.js';
import { projectSchema, projectSettingsSchema } from './entities/project.js';
import { beatSchema, laneSchema, structuralUnitSchema } from './entities/structure.js';
import { countWords } from './entities/manuscript.js';
import { PROJECT_FORMAT_VERSION, projectFileSchema, type ProjectFile } from './project-file.js';
import type { Beat, Lane, StructuralUnit } from './entities/structure.js';
import type { Character } from './entities/character.js';
import type { StoryLink } from './entities/links.js';
import type { ResearchCategory, ResearchItem } from './entities/research.js';
import type { SetupPayoff } from './entities/setups.js';
import type { Project } from './entities/project.js';

/**
 * Translation between the project document and Supabase rows.
 *
 * The document (camelCase, nested) and the database (snake_case, columnar) are
 * two encodings of the one model — spec §14 keeps a single domain model rather
 * than a schema per surface, so this file is the only place the two spellings
 * meet. Everything round-trips: `fromRows(toRows(file))` is the file it started
 * as, which is what makes sync safe to run repeatedly.
 */

export type Row = Record<string, unknown>;

export interface ProjectRows {
  project: Row;
  lanes: Row[];
  units: Row[];
  beats: Row[];
  researchCategories: Row[];
  researchItems: Row[];
  characters: Row[];
  links: Row[];
  setupsPayoffs: Row[];
}

/** Table each collection lives in, so callers do not hard-code names. */
export const SYNC_TABLES = {
  lanes: 'lanes',
  units: 'structural_units',
  beats: 'beats',
  researchCategories: 'research_categories',
  researchItems: 'research_items',
  characters: 'characters',
  links: 'story_links',
  setupsPayoffs: 'setups_payoffs',
} as const;

export type SyncCollection = keyof typeof SYNC_TABLES;
export const SYNC_COLLECTIONS = Object.keys(SYNC_TABLES) as SyncCollection[];

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const flag = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);
const nullableText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

// ---------------------------------------------------------------------------
// Document -> rows
// ---------------------------------------------------------------------------

export const projectToRow = (file: ProjectFile): Row => ({
  id: file.project.id,
  owner_id: file.project.ownerId,
  format: file.project.format,
  title: file.project.title,
  author: file.project.author,
  logline: file.project.logline,
  elevator_pitch: file.project.elevatorPitch,
  synopsis: file.project.synopsis,
  genre: file.project.genre,
  notes: file.project.notes,
  status: file.project.status,
  poster_asset_path: file.project.posterAssetId,
  settings: file.settings,
  format_version: PROJECT_FORMAT_VERSION,
  last_opened_at: file.project.lastOpenedAt,
  created_at: file.project.createdAt,
  updated_at: file.project.updatedAt,
});

const laneToRow = (lane: Lane): Row => ({
  id: lane.id,
  project_id: lane.projectId,
  name: lane.name,
  kind: lane.kind,
  color: lane.color,
  description: lane.description,
  order_key: lane.orderKey,
  collapsed: lane.collapsed,
  created_at: lane.createdAt,
  updated_at: lane.updatedAt,
});

const unitToRow = (unit: StructuralUnit): Row => ({
  id: unit.id,
  project_id: unit.projectId,
  lane_id: unit.laneId,
  kind: unit.kind,
  title: unit.title,
  sequence_label: unit.sequenceLabel,
  summary: unit.summary,
  notes: unit.notes,
  status: unit.status,
  order_key: unit.orderKey,
  collapsed: unit.collapsed,
  created_at: unit.createdAt,
  updated_at: unit.updatedAt,
});

const beatToRow = (beat: Beat): Row => ({
  id: beat.id,
  project_id: beat.projectId,
  unit_id: beat.unitId,
  title: beat.title,
  summary: beat.summary,
  status: beat.status,
  order_key: beat.orderKey,
  manuscript: beat.manuscript,
  // Denormalised so the dashboard and admin views can count without loading
  // every manuscript; the document stays the source of truth.
  word_count: countWords(beat.manuscript),
  created_at: beat.createdAt,
  updated_at: beat.updatedAt,
});

const researchCategoryToRow = (category: ResearchCategory): Row => ({
  id: category.id,
  project_id: category.projectId,
  name: category.name,
  system_key: category.systemKey,
  description: category.description,
  order_key: category.orderKey,
  archived: category.archived,
  created_at: category.createdAt,
  updated_at: category.updatedAt,
});

const researchItemToRow = (item: ResearchItem): Row => ({
  id: item.id,
  project_id: item.projectId,
  category_id: item.categoryId,
  title: item.title,
  body: item.body,
  tags: item.tags,
  usage: item.usage,
  used_at: item.usedAt,
  used_in_beat_ids: item.usedInBeatIds,
  used_confirmed: item.usedConfirmed,
  archived: item.archived,
  order_key: item.orderKey,
  origin: item.origin,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});

const characterToRow = (character: Character): Row => ({
  id: character.id,
  project_id: character.projectId,
  name: character.name,
  aliases: character.aliases,
  description: character.description,
  arc_notes: character.arcNotes,
  research_item_id: character.researchItemId,
  voice: character.voice,
  archived: character.archived,
  created_at: character.createdAt,
  updated_at: character.updatedAt,
});

const linkToRow = (link: StoryLink): Row => ({
  id: link.id,
  project_id: link.projectId,
  from_type: link.from.type,
  from_id: link.from.id,
  to_type: link.to.type,
  to_id: link.to.id,
  link_type: link.type,
  label: link.label,
  notes: link.notes,
  created_at: link.createdAt,
  updated_at: link.updatedAt,
});

const setupPayoffToRow = (record: SetupPayoff): Row => ({
  id: record.id,
  project_id: record.projectId,
  title: record.title,
  description: record.description,
  status: record.status,
  setups: record.setups,
  payoff: record.payoff,
  archived: record.archived,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

export const toRows = (file: ProjectFile): ProjectRows => ({
  project: projectToRow(file),
  lanes: file.lanes.map(laneToRow),
  units: file.units.map(unitToRow),
  beats: file.beats.map(beatToRow),
  researchCategories: file.researchCategories.map(researchCategoryToRow),
  researchItems: file.researchItems.map(researchItemToRow),
  characters: file.characters.map(characterToRow),
  links: file.links.map(linkToRow),
  setupsPayoffs: file.setupsPayoffs.map(setupPayoffToRow),
});

// ---------------------------------------------------------------------------
// Rows -> document
// ---------------------------------------------------------------------------

const laneFromRow = (row: Row): Lane =>
  laneSchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    name: text(row['name'], 'Untitled lane'),
    kind: row['kind'],
    color: text(row['color'], '#6b7280'),
    description: text(row['description']),
    orderKey: row['order_key'],
    collapsed: flag(row['collapsed']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const unitFromRow = (row: Row): StructuralUnit =>
  structuralUnitSchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    laneId: row['lane_id'],
    kind: row['kind'],
    title: text(row['title']),
    sequenceLabel: text(row['sequence_label']),
    summary: text(row['summary']),
    notes: text(row['notes']),
    status: row['status'],
    orderKey: row['order_key'],
    collapsed: flag(row['collapsed']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const beatFromRow = (row: Row): Beat =>
  beatSchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    unitId: row['unit_id'],
    title: text(row['title']),
    summary: text(row['summary']),
    status: row['status'],
    orderKey: row['order_key'],
    manuscript: row['manuscript'] ?? { elements: [] },
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const researchCategoryFromRow = (row: Row): ResearchCategory =>
  researchCategorySchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    name: text(row['name'], 'Untitled category'),
    systemKey: nullableText(row['system_key']),
    description: text(row['description']),
    orderKey: row['order_key'],
    archived: flag(row['archived']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const researchItemFromRow = (row: Row): ResearchItem =>
  researchItemSchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    categoryId: row['category_id'],
    title: text(row['title'], 'Untitled note'),
    body: text(row['body']),
    tags: list(row['tags']),
    usage: row['usage'],
    usedAt: nullableText(row['used_at']),
    usedInBeatIds: list(row['used_in_beat_ids']),
    usedConfirmed: flag(row['used_confirmed']),
    archived: flag(row['archived']),
    orderKey: row['order_key'],
    origin: row['origin'],
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const characterFromRow = (row: Row): Character =>
  characterSchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    name: text(row['name'], 'Unnamed'),
    aliases: list(row['aliases']),
    description: text(row['description']),
    arcNotes: text(row['arc_notes']),
    researchItemId: nullableText(row['research_item_id']),
    voice: row['voice'] ?? null,
    archived: flag(row['archived']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const linkFromRow = (row: Row): StoryLink =>
  storyLinkSchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    from: { type: row['from_type'], id: row['from_id'] },
    to: { type: row['to_type'], id: row['to_id'] },
    type: row['link_type'],
    label: text(row['label']),
    notes: text(row['notes']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const setupPayoffFromRow = (row: Row): SetupPayoff =>
  setupPayoffSchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    title: text(row['title'], 'Untitled'),
    description: text(row['description']),
    status: row['status'],
    setups: row['setups'] ?? [],
    payoff: row['payoff'] ?? null,
    archived: flag(row['archived']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

export const projectFromRow = (row: Row): Project =>
  projectSchema.parse({
    id: row['id'],
    ownerId: nullableText(row['owner_id']),
    format: row['format'],
    title: text(row['title'], 'Untitled'),
    author: text(row['author']),
    logline: text(row['logline']),
    elevatorPitch: text(row['elevator_pitch']),
    synopsis: text(row['synopsis']),
    genre: text(row['genre']),
    notes: text(row['notes']),
    status: row['status'],
    posterAssetId: nullableText(row['poster_asset_path']),
    lastOpenedAt: nullableText(row['last_opened_at']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

export const fromRows = (rows: ProjectRows): ProjectFile =>
  projectFileSchema.parse({
    formatVersion: PROJECT_FORMAT_VERSION,
    generator: 'vcwriter-sync',
    savedAt: new Date().toISOString(),
    project: projectFromRow(rows.project),
    settings: projectSettingsSchema.parse(rows.project['settings'] ?? {}),
    lanes: rows.lanes.map(laneFromRow),
    units: rows.units.map(unitFromRow),
    beats: rows.beats.map(beatFromRow),
    researchCategories: rows.researchCategories.map(researchCategoryFromRow),
    researchItems: rows.researchItems.map(researchItemFromRow),
    characters: rows.characters.map(characterFromRow),
    links: rows.links.map(linkFromRow),
    setupsPayoffs: rows.setupsPayoffs.map(setupPayoffFromRow),
    // Snapshots are local recovery points, not shared state; they stay on disk.
    snapshots: [],
  });
