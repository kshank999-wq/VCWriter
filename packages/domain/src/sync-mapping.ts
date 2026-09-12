import { boardSchema, sculptorLinkSchema, sculptorNodeSchema } from './entities/sculptor.js';
import { captureItemSchema, type CaptureItem } from './entities/capture.js';
import { outlineItemSchema, outlineSchema } from './entities/outline.js';
import { characterCategorySchema, characterSchema } from './entities/character.js';
import { storyLinkSchema } from './entities/links.js';
import { researchCategorySchema, researchItemSchema } from './entities/research.js';
import { setupPayoffSchema } from './entities/setups.js';
import { projectSchema, projectSettingsSchema } from './entities/project.js';
import { beatSchema, laneSchema, storyMarkerSchema, structuralUnitSchema } from './entities/structure.js';
import { countWords } from './entities/manuscript.js';
import { writingSessionSchema, type WritingSession } from './sessions.js';
import { PROJECT_FORMAT_VERSION, projectFileSchema, type ProjectFile } from './project-file.js';
import type { Beat, Lane, StoryMarker, StructuralUnit } from './entities/structure.js';
import type { Character, CharacterCategory } from './entities/character.js';
import type { StoryLink } from './entities/links.js';
import type { ResearchCategory, ResearchItem } from './entities/research.js';
import type { SetupPayoff } from './entities/setups.js';
import type { Project } from './entities/project.js';
import type { Board, SculptorLink, SculptorNode } from './entities/sculptor.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { BoardId, OutlineId, ProjectId } from './ids.js';

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
  markers: Row[];
  sessions: Row[];
  researchCategories: Row[];
  researchItems: Row[];
  characters: Row[];
  characterCategories: Row[];
  links: Row[];
  setupsPayoffs: Row[];
  boards: Row[];
  sculptorNodes: Row[];
  sculptorLinks: Row[];
  outlines: Row[];
  outlineItems: Row[];
}

/** Table each collection lives in, so callers do not hard-code names. */
export const SYNC_TABLES = {
  lanes: 'lanes',
  units: 'structural_units',
  beats: 'beats',
  markers: 'story_markers',
  sessions: 'writing_sessions',
  researchCategories: 'research_categories',
  researchItems: 'research_items',
  characters: 'characters',
  characterCategories: 'character_categories',
  links: 'story_links',
  setupsPayoffs: 'setups_payoffs',
  // The plans (addendum 07 §4). Order matters: `pushRows` upserts collections
  // in the order they are declared here, and a node needs its board to exist.
  boards: 'boards',
  sculptorNodes: 'sculptor_nodes',
  sculptorLinks: 'sculptor_links',
  outlines: 'outlines',
  outlineItems: 'outline_items',
} as const;

export type SyncCollection = keyof typeof SYNC_TABLES;
export const SYNC_COLLECTIONS = Object.keys(SYNC_TABLES) as SyncCollection[];

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const flag = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
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
  arc: lane.arc,
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
  in_script: unit.inScript,
  // The writer's structural reading, as one JSON column: five short strings
  // read and written whole with the scene, and nothing queries inside it.
  grid: unit.grid,
  // The AI's proposed reading, kept beside the writer's own so a scene read
  // on one machine is already read on the next.
  ai_read: unit.aiRead,
  // Who first made it, in a room (addendum 07 §6.3). Null outside one.
  origin: unit.origin,
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
  in_script: beat.inScript,
  manuscript: beat.manuscript,
  revision_name: beat.revisionName,
  revisions: beat.revisions,
  color: beat.color,
  // Denormalised so the dashboard and admin views can count without loading
  // every manuscript; the document stays the source of truth.
  word_count: countWords(beat.manuscript),
  origin: beat.origin,
  created_at: beat.createdAt,
  updated_at: beat.updatedAt,
});

const markerToRow = (marker: StoryMarker): Row => ({
  id: marker.id,
  project_id: marker.projectId,
  unit_id: marker.unitId,
  kind: marker.kind,
  title: marker.title,
  notes: marker.notes,
  // The designed leaf travels as one JSON column: it is a handful of
  // switches and a data URL, and nothing queries inside it.
  page: marker.page,
  // An episode's cast: a list of ids, read and written whole with the marker.
  // `cast` is a reserved word in Postgres, hence the column's own name.
  cast_ids: marker.cast,
  // An episode's own front page; null on every other kind of marker.
  title_page: marker.titlePage,
  created_at: marker.createdAt,
  updated_at: marker.updatedAt,
});

/**
 * A sitting. The word counts at each end travel rather than the difference:
 * the counts are the fact, and every reading of them — a day's total, a rate,
 * a loss — is worked out from those.
 */
const sessionToRow = (session: WritingSession): Row => ({
  id: session.id,
  project_id: session.projectId,
  started_at: session.startedAt,
  ended_at: session.endedAt,
  words_at_start: session.wordsAtStart,
  words_at_end: session.wordsAtEnd,
  device: session.device,
});

const researchCategoryToRow = (category: ResearchCategory): Row => ({
  id: category.id,
  project_id: category.projectId,
  name: category.name,
  system_key: category.systemKey,
  description: category.description,
  parent_id: category.parentId,
  color: category.color,
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
  category_id: character.categoryId,
  voice: character.voice,
  archived: character.archived,
  created_at: character.createdAt,
  updated_at: character.updatedAt,
});

const characterCategoryToRow = (category: CharacterCategory): Row => ({
  id: category.id,
  project_id: category.projectId,
  name: category.name,
  order_key: category.orderKey,
  created_at: category.createdAt,
  updated_at: category.updatedAt,
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

// ---------------------------------------------------------------------------
// The plans, flattened
// ---------------------------------------------------------------------------

/**
 * The Sculptor's boards and the Outliner's outlines, as flat lists (addendum
 * 07 §4).
 *
 * **The document nests them and everything else here does not**, and that is
 * not an inconsistency to be fixed in the document. A board *is* its nodes to
 * the module that draws it, which is why addendum 03 built it that way. But a
 * node is what two writers edit independently, so a node is what the database
 * stores as a row and what a merge compares one at a time — and this file is
 * already "the only place the two spellings meet", so the third spelling lives
 * here with the other two.
 *
 * Flattening loses exactly one fact, which nesting was carrying for free: the
 * board a link belongs to. It travels in the flat form the same way
 * `project_id` travels in a row — the document gets it from where the thing
 * sits, and anything flat has to be told.
 */

/** A link with the board it is on, which the document gets from nesting. */
export type FlatSculptorLink = SculptorLink & { boardId: BoardId };
/** A board without what it contains. */
export type BoardRecord = Omit<Board, 'nodes' | 'links'>;
/** An outline without what it contains. */
export type OutlineRecord = Omit<Outline, 'items'>;

export interface PlanParts {
  boards: BoardRecord[];
  sculptorNodes: SculptorNode[];
  sculptorLinks: FlatSculptorLink[];
  outlines: OutlineRecord[];
  outlineItems: OutlineItem[];
}

/** The plans taken apart: five flat lists, in the order they must be written. */
export const planParts = (file: ProjectFile): PlanParts => {
  const boards = file.boards ?? [];
  const outlines = file.outlines ?? [];
  return {
    boards: boards.map(({ nodes: _nodes, links: _links, ...board }) => board),
    sculptorNodes: boards.flatMap((board) => board.nodes),
    sculptorLinks: boards.flatMap((board) => board.links.map((link) => ({ ...link, boardId: board.id }))),
    outlines: outlines.map(({ items: _items, ...outline }) => outline),
    outlineItems: outlines.flatMap((outline) => outline.items),
  };
};

/**
 * The plans put back together.
 *
 * A node or a link whose board did not survive is dropped rather than kept
 * somewhere it cannot be drawn — the same reasoning `pruneOrphans` applies to
 * a beat whose scene has gone.
 */
export const withPlanParts = (file: ProjectFile, parts: PlanParts): ProjectFile => {
  // A link whose ends did not both survive says nothing, and the board's own
  // rule is that a link is an observation rather than what holds anything
  // together (addendum 03 §7) — so losing one costs the observation and
  // nothing moves.
  const nodeIds = new Set(parts.sculptorNodes.map((node) => node.id as string));

  return {
    ...file,
    boards: parts.boards.map((board) =>
      boardSchema.parse({
        ...board,
        nodes: parts.sculptorNodes.filter((node) => node.boardId === board.id),
        links: parts.sculptorLinks
          .filter(
            (link) =>
              link.boardId === board.id && nodeIds.has(link.fromId as string) && nodeIds.has(link.toId as string),
          )
          .map(({ boardId: _boardId, ...link }) => link),
      }),
    ),
    outlines: parts.outlines.map((outline) =>
      outlineSchema.parse({
        ...outline,
        items: parts.outlineItems.filter((item) => item.outlineId === outline.id),
      }),
    ),
  };
};

/**
 * The collections the document nests. Everything else is a flat array on the
 * file and can be read and written straight.
 */
export const PLAN_COLLECTIONS = ['boards', 'sculptorNodes', 'sculptorLinks', 'outlines', 'outlineItems'] as const;
export type PlanCollection = (typeof PLAN_COLLECTIONS)[number];

const PLAN_SET = new Set<string>(PLAN_COLLECTIONS);
export const isPlanCollection = (collection: SyncCollection): collection is PlanCollection => PLAN_SET.has(collection);

/**
 * One collection's records, flat, whichever way the document keeps them.
 *
 * The merge and the restore both want "the records in this collection" and
 * neither should have to know which of them the document nests. Asking here
 * keeps that knowledge in the one file that is about the difference.
 */
export const recordsOf = (file: ProjectFile, collection: SyncCollection): unknown[] =>
  isPlanCollection(collection)
    ? (planParts(file)[collection] as unknown[])
    : ((file as unknown as Record<string, unknown[]>)[collection] ?? []);

/** The file with one collection replaced, put back together if it was nested. */
export const withRecords = (file: ProjectFile, collection: SyncCollection, records: unknown[]): ProjectFile => {
  if (!isPlanCollection(collection)) {
    return { ...file, [collection]: records } as ProjectFile;
  }
  return withPlanParts(file, {
    ...planParts(file),
    [collection]: records,
  } as PlanParts);
};

const boardToRow = (board: BoardRecord): Row => ({
  id: board.id,
  project_id: board.projectId,
  name: board.name,
  // The board's shape rather than its content: read and written whole, and
  // nothing queries inside it.
  columns: board.columns,
  created_at: board.createdAt,
  updated_at: board.updatedAt,
});

const sculptorNodeToRow = (node: SculptorNode, projectId: ProjectId): Row => ({
  id: node.id,
  project_id: projectId,
  board_id: node.boardId,
  column_id: node.columnId,
  parent_id: node.parentId,
  order_key: node.orderKey,
  title: node.title,
  note: node.note,
  kind: node.kind,
  colour: node.colour,
  fields: node.fields,
  // `end` is a reserved word in SQL, hence the column's own name.
  node_end: node.end,
  collapsed: node.collapsed,
  bound_unit_id: node.boundUnitId,
  bound_beat_id: node.boundBeatId,
  created_at: node.createdAt,
  updated_at: node.updatedAt,
});

const sculptorLinkToRow = (link: FlatSculptorLink, projectId: ProjectId): Row => ({
  id: link.id,
  project_id: projectId,
  board_id: link.boardId,
  from_id: link.fromId,
  to_id: link.toId,
  label: link.label,
  created_at: link.createdAt,
  updated_at: link.updatedAt,
});

const outlineToRow = (outline: OutlineRecord): Row => ({
  id: outline.id,
  project_id: outline.projectId,
  name: outline.name,
  created_at: outline.createdAt,
  updated_at: outline.updatedAt,
});

const outlineItemToRow = (item: OutlineItem, projectId: ProjectId): Row => ({
  id: item.id,
  project_id: projectId,
  outline_id: item.outlineId,
  parent_id: item.parentId,
  order_key: item.orderKey,
  kind: item.kind,
  title: item.title,
  body: item.body,
  status: item.status,
  collapsed: item.collapsed,
  bound_unit_id: item.boundUnitId,
  bound_beat_id: item.boundBeatId,
  // The research this row references, as the project's own `StoryEntityRef`.
  source: item.source,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});

export const toRows = (file: ProjectFile): ProjectRows => ({
  project: projectToRow(file),
  lanes: file.lanes.map(laneToRow),
  units: file.units.map(unitToRow),
  beats: file.beats.map(beatToRow),
  markers: file.markers.map(markerToRow),
  sessions: file.sessions.map(sessionToRow),
  researchCategories: file.researchCategories.map(researchCategoryToRow),
  researchItems: file.researchItems.map(researchItemToRow),
  characters: file.characters.map(characterToRow),
  characterCategories: (file.characterCategories ?? []).map(characterCategoryToRow),
  links: file.links.map(linkToRow),
  setupsPayoffs: file.setupsPayoffs.map(setupPayoffToRow),
  ...planRows(file),
});

/**
 * The plan collections as rows.
 *
 * Nodes, links and items carry `project_id` although the document does not put
 * it on them: every child table in the schema is reached through the one
 * ownership question, and that question is asked of a column.
 */
const planRows = (
  file: ProjectFile,
): Pick<ProjectRows, 'boards' | 'sculptorNodes' | 'sculptorLinks' | 'outlines' | 'outlineItems'> => {
  const parts = planParts(file);
  const projectId = file.project.id;
  return {
    boards: parts.boards.map(boardToRow),
    sculptorNodes: parts.sculptorNodes.map((node) => sculptorNodeToRow(node, projectId)),
    sculptorLinks: parts.sculptorLinks.map((link) => sculptorLinkToRow(link, projectId)),
    outlines: parts.outlines.map(outlineToRow),
    outlineItems: parts.outlineItems.map((item) => outlineItemToRow(item, projectId)),
  };
};

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
    arc: text(row['arc']),
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
    inScript: row['in_script'] === undefined || row['in_script'] === null ? true : flag(row['in_script']),
    // Absent in a row written before the grid existed; the schema fills it.
    grid: row['grid'] ?? undefined,
    aiRead: row['ai_read'] ?? null,
    origin: row['origin'] ?? null,
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
    inScript: flag(row['in_script'], true),
    manuscript: row['manuscript'] ?? { elements: [] },
    revisionName: text(row['revision_name'], 'Draft 1'),
    revisions: row['revisions'] ?? [],
    origin: row['origin'] ?? null,
    color: row['color'] ?? null,
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const markerFromRow = (row: Row): StoryMarker =>
  storyMarkerSchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    unitId: row['unit_id'],
    kind: row['kind'],
    title: text(row['title']),
    notes: text(row['notes']),
    // Absent in a row written before chapter pages existed; the schema's
    // own defaults fill it in.
    page: row['page'] ?? undefined,
    cast: Array.isArray(row['cast_ids']) ? row['cast_ids'] : [],
    titlePage: row['title_page'] ?? null,
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const sessionFromRow = (row: Row): WritingSession =>
  writingSessionSchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    startedAt: row['started_at'],
    endedAt: row['ended_at'],
    wordsAtStart: row['words_at_start'],
    wordsAtEnd: row['words_at_end'],
    device: text(row['device']),
  });

const researchCategoryFromRow = (row: Row): ResearchCategory =>
  researchCategorySchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    name: text(row['name'], 'Untitled category'),
    systemKey: nullableText(row['system_key']),
    description: text(row['description']),
    parentId: nullableText(row['parent_id']),
    color: nullableText(row['color']),
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
    categoryId: nullableText(row['category_id']),
    voice: row['voice'] ?? null,
    archived: flag(row['archived']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const characterCategoryFromRow = (row: Row): CharacterCategory =>
  characterCategorySchema.parse({
    id: row['id'],
    projectId: row['project_id'],
    name: text(row['name'], 'Characters'),
    orderKey: row['order_key'],
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

// ---------------------------------------------------------------------------
// Captures
// ---------------------------------------------------------------------------

export const captureFromRow = (row: Row): CaptureItem =>
  captureItemSchema.parse({
    id: row['id'],
    userId: row['user_id'],
    projectId: nullableText(row['project_id']),
    source: row['source'],
    capturedAt: row['captured_at'],
    rawText: text(row['raw_text']),
    audioAssetId: nullableText(row['audio_path']),
    transcriptConfidence: typeof row['transcript_confidence'] === 'number' ? row['transcript_confidence'] : null,
    inference: row['inference'] ?? null,
    requestedRouting: row['requested_routing'] ?? null,
    status: row['status'],
    reviewedAt: nullableText(row['reviewed_at']),
    resultRef:
      typeof row['result_type'] === 'string' && typeof row['result_id'] === 'string'
        ? { type: row['result_type'], id: row['result_id'] }
        : null,
    syncedAt: nullableText(row['synced_at']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

/** The columns a review decision writes back. The raw capture is never touched. */
export const captureReviewToRow = (capture: CaptureItem): Row => ({
  status: capture.status,
  reviewed_at: capture.reviewedAt,
  result_type: capture.resultRef?.type ?? null,
  result_id: capture.resultRef?.id ?? null,
});

const sculptorNodeFromRow = (row: Row): SculptorNode =>
  sculptorNodeSchema.parse({
    id: row['id'],
    boardId: row['board_id'],
    columnId: row['column_id'],
    parentId: nullableText(row['parent_id']),
    orderKey: row['order_key'],
    title: text(row['title']),
    note: text(row['note']),
    kind: text(row['kind']),
    colour: text(row['colour']),
    fields: row['fields'] ?? {},
    end: nullableText(row['node_end']),
    collapsed: flag(row['collapsed']),
    boundUnitId: nullableText(row['bound_unit_id']),
    boundBeatId: nullableText(row['bound_beat_id']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

const sculptorLinkFromRow = (row: Row): FlatSculptorLink => ({
  ...sculptorLinkSchema.parse({
    id: row['id'],
    fromId: row['from_id'],
    toId: row['to_id'],
    label: text(row['label']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  }),
  boardId: row['board_id'] as BoardId,
});

const outlineItemFromRow = (row: Row): OutlineItem =>
  outlineItemSchema.parse({
    id: row['id'],
    outlineId: row['outline_id'],
    parentId: nullableText(row['parent_id']),
    orderKey: row['order_key'],
    kind: text(row['kind'], 'note'),
    title: text(row['title']),
    body: text(row['body']),
    status: text(row['status']),
    collapsed: flag(row['collapsed']),
    boundUnitId: nullableText(row['bound_unit_id']),
    boundBeatId: nullableText(row['bound_beat_id']),
    source: row['source'] ?? null,
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });

/** The five plan collections, read back and put together again. */
const plansFromRows = (rows: ProjectRows): Pick<ProjectFile, 'boards' | 'outlines'> => {
  const nodes = rows.sculptorNodes.map(sculptorNodeFromRow);
  const links = rows.sculptorLinks.map(sculptorLinkFromRow);
  const items = rows.outlineItems.map(outlineItemFromRow);

  return {
    boards: rows.boards.map((row) =>
      boardSchema.parse({
        id: row['id'],
        projectId: row['project_id'],
        name: text(row['name']),
        columns: row['columns'] ?? [],
        nodes: nodes.filter((node) => (node.boardId as string) === row['id']),
        links: links
          .filter((link) => (link.boardId as string) === row['id'])
          .map(({ boardId: _boardId, ...link }) => link),
        createdAt: row['created_at'],
        updatedAt: row['updated_at'],
      }),
    ),
    outlines: rows.outlines.map((row) =>
      outlineSchema.parse({
        id: row['id'],
        projectId: row['project_id'],
        name: text(row['name']),
        items: items.filter((item) => (item.outlineId as string) === row['id']),
        createdAt: row['created_at'],
        updatedAt: row['updated_at'],
      }),
    ),
  };
};

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
    markers: rows.markers.map(markerFromRow),
    sessions: rows.sessions.map(sessionFromRow),
    researchCategories: rows.researchCategories.map(researchCategoryFromRow),
    researchItems: rows.researchItems.map(researchItemFromRow),
    characters: rows.characters.map(characterFromRow),
    characterCategories: rows.characterCategories.map(characterCategoryFromRow),
    links: rows.links.map(linkFromRow),
    setupsPayoffs: rows.setupsPayoffs.map(setupPayoffFromRow),
    ...plansFromRows(rows),
    // Snapshots are local recovery points, not shared state; they stay on disk.
    snapshots: [],
  });
