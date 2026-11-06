import { z } from 'zod';
import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { initialOrderKeys, safeKeyBetween } from './ordering.js';
import { onlyLiving } from './graveyard.js';
import { addCharacter } from './mutations.js';
import { claimedInScript } from './planning.js';
import { boardSchema, type Board, type SculptorEntity, type SculptorLink, type SculptorNode } from './entities/sculptor.js';
import { boardsOf, childrenOf, findBoard, findNode } from './sculptor.js';
import { isSculptType } from './sculptor-types.js';
import type { ProjectFile } from './project-file.js';
import type { BoardId, SculptorEntityId, SculptorLinkId, SculptorNodeId, SculptorViewId } from './ids.js';

/**
 * Reading a story map back in (addendum 03 v2 §8b): the JSON that
 * `sculptMapJson` writes, from this project or another.
 *
 * **Nothing is overwritten.** It lands as a new map in the project, or inside
 * the map that is open, under the card chosen. Every card gets a new id, so
 * the same file imported twice is two copies, never a collision.
 *
 * What it points at is matched in this project rather than trusted:
 *
 * - a **character** by id, then by name; one the cast does not have is added
 *   to it, because a map never names a person the project does not know;
 * - a **place, research note or theme** by id, then by name; one that is not
 *   here stays on the map as a map-only item, keeping its name;
 * - a **scene or beat** binding only where that scene or beat is in this
 *   project and nothing else already stands for it.
 */

const cardSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable().optional(),
  order: z.number().optional(),
  type: z.string().optional(),
  subtype: z.string().optional(),
  title: z.string().optional(),
  note: z.string().optional(),
  details: z.record(z.string()).optional(),
  definitionId: z.string().nullable().optional(),
  script: z
    .object({ unitId: z.string().nullable().optional(), beatId: z.string().nullable().optional() })
    .partial()
    .nullable()
    .optional(),
});

const definitionSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  subtype: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  source: z.object({ kind: z.string(), id: z.string() }).nullable().optional(),
  favorite: z.boolean().optional(),
});

const connectionSchema = z.object({
  id: z.string().optional(),
  fromId: z.string(),
  toId: z.string(),
  type: z.string().optional(),
  label: z.string().optional(),
  directed: z.boolean().optional(),
});

const mapJsonSchema = z.object({
  format: z.literal('vc-writer-story-map'),
  version: z.number().int(),
  project: z.object({ title: z.string().optional() }).partial().optional(),
  board: z.object({ name: z.string().optional() }).partial().optional(),
  definitions: z.array(definitionSchema).default([]),
  cards: z.array(cardSchema).default([]),
  connections: z.array(connectionSchema).default([]),
  view: z.unknown().optional(),
  layout: z.record(z.object({ x: z.number(), y: z.number() })).optional(),
  savedViews: z.array(z.unknown()).optional(),
});

export type ImportedMap = z.infer<typeof mapJsonSchema>;

export class MapImportError extends Error {}

/** The newest file version this build reads. */
export const MAP_JSON_VERSION = 1;

/**
 * Read and check a file's text. Throws `MapImportError` with a sentence the
 * room can show when it is not a story map, or is from a newer VC Writer.
 */
export const parseMapJson = (text: string): ImportedMap => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new MapImportError('That file is not JSON.');
  }
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== 'vc-writer-story-map') {
    throw new MapImportError('That file is not a VC Writer story map. Export one from the Sculptor with Export › JSON data.');
  }
  const version = (raw as { version?: unknown }).version;
  if (typeof version === 'number' && version > MAP_JSON_VERSION) {
    throw new MapImportError('That map was saved by a newer VC Writer. Update VC Writer to import it.');
  }
  const parsed = mapJsonSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MapImportError(`That story map is damaged${issue ? ` (${issue.path.join('.') || 'top'}: ${issue.message})` : ''}.`);
  }
  return parsed.data;
};

/** What a file holds, for the dialog before anything is changed. */
export const describeMapJson = (map: ImportedMap): { title: string; cards: number; definitions: number; connections: number } => ({
  title: map.board?.name?.trim() || map.project?.title?.trim() || 'Story map',
  cards: map.cards.length,
  definitions: map.definitions.length,
  connections: map.connections.length,
});

export type MapImportTarget = { kind: 'new'; name?: string } | { kind: 'into'; boardId: BoardId; parentId: SculptorNodeId | null };

export interface MapImportReport {
  boardId: BoardId | null;
  cards: number;
  connections: number;
  /** Definitions matched to something already in this project. */
  linked: number;
  /** Characters added to the cast because the project did not have them. */
  castAdded: string[];
  /** Places, notes or themes not found here, kept as map-only items. */
  unlinked: number;
  /** Scene or beat links left off because that scene is not here, or is already on a map. */
  bindingsDropped: number;
  connectionsDropped: number;
}

const norm = (value: string) => value.trim().toLowerCase();

/** The map put into the project. Nothing that is already there changes. */
export const importMapJson = (file: ProjectFile, map: ImportedMap, target: MapImportTarget): { file: ProjectFile; report: MapImportReport } => {
  const at = nowIso();
  let current = file;
  const report: MapImportReport = {
    boardId: null,
    cards: 0,
    connections: 0,
    linked: 0,
    castAdded: [],
    unlinked: 0,
    bindingsDropped: 0,
    connectionsDropped: 0,
  };

  // Where it lands.
  let board: Board;
  let topParent: SculptorNodeId | null = null;
  if (target.kind === 'into') {
    const existing = findBoard(current, target.boardId);
    if (!existing) return { file, report };
    board = existing;
    topParent = target.parentId && findNode(existing, target.parentId) ? target.parentId : null;
  } else {
    board = boardSchema.parse({
      id: newId<BoardId>(),
      projectId: current.project.id,
      schemaVersion: 2,
      name: target.name?.trim() || `${describeMapJson(map).title} (imported)`,
      createdAt: at,
      updatedAt: at,
    });
  }
  const boardId = board.id;

  // Definitions, matched in this project.
  const entityIds = new Map<string, SculptorEntityId>();
  const entities: SculptorEntity[] = [...(board.entities ?? [])];
  const findOrMake = (definition: ImportedMap['definitions'][number]) => {
    const source = definition.source ?? null;
    const name = definition.title ?? '';
    let sourceKind: SculptorEntity['sourceKind'] = null;
    let sourceId: string | null = null;
    if (source?.kind === 'character') {
      const cast = onlyLiving(current.characters);
      const match = cast.find((one) => (one.id as string) === source.id) ?? cast.find((one) => name.trim() && norm(one.name) === norm(name));
      if (match) {
        sourceKind = 'character';
        sourceId = match.id as string;
        report.linked += 1;
      } else if (name.trim()) {
        current = addCharacter(current, { name: name.trim() });
        sourceKind = 'character';
        sourceId = current.characters[current.characters.length - 1]!.id as string;
        report.castAdded.push(name.trim());
      }
    } else if (source?.kind === 'location' || source?.kind === 'research' || source?.kind === 'theme') {
      const pool: { id: string; name: string }[] =
        source.kind === 'location'
          ? (current.locations ?? []).map((one) => ({ id: one.id as string, name: one.name }))
          : source.kind === 'research'
            ? current.researchItems.map((one) => ({ id: one.id as string, name: one.title }))
            : ((current as unknown as { themes?: { id: string; name?: string; title?: string }[] }).themes ?? []).map((one) => ({
                id: one.id,
                name: one.name ?? one.title ?? '',
              }));
      const match = pool.find((one) => one.id === source.id) ?? pool.find((one) => name.trim() && norm(one.name) === norm(name));
      if (match) {
        sourceKind = source.kind;
        sourceId = match.id;
        report.linked += 1;
      } else {
        report.unlinked += 1;
      }
    }
    // One definition per project record: a character already defined on this map is reused.
    const already = sourceKind ? entities.find((one) => one.sourceKind === sourceKind && one.sourceId === sourceId) : undefined;
    if (already) return already.id;
    const entity: SculptorEntity = {
      id: newId<SculptorEntityId>(),
      type: definition.type && isSculptType(definition.type) ? definition.type : 'note',
      subtype: definition.subtype ?? '',
      sourceKind,
      sourceId,
      title: sourceKind ? '' : name,
      description: definition.description ?? '',
      fields: {},
      favorite: definition.favorite ?? false,
      createdAt: at,
      updatedAt: at,
    };
    entities.push(entity);
    return entity.id;
  };
  for (const definition of map.definitions) entityIds.set(definition.id, findOrMake(definition));

  // Cards, with new ids, in the order the file gives among each card's siblings.
  const ids = new Map(map.cards.map((card) => [card.id, newId<SculptorNodeId>()]));
  const claimed = claimedInScript(current);
  const unitIds = new Set(current.units.map((one) => one.id as string));
  const beatIds = new Set(current.beats.map((one) => one.id as string));
  const parentOf = (card: ImportedMap['cards'][number]): SculptorNodeId | null => {
    const parent = card.parentId ? ids.get(card.parentId) : undefined;
    return parent ?? topParent;
  };
  // A file whose parents loop is cut at the first repeat, so it cannot hang.
  const byId = new Map(map.cards.map((card) => [card.id, card]));
  const loops = new Set<string>();
  for (const card of map.cards) {
    const seen = new Set<string>([card.id]);
    let up = card.parentId ? byId.get(card.parentId) : undefined;
    while (up) {
      if (seen.has(up.id)) {
        loops.add(card.id);
        break;
      }
      seen.add(up.id);
      up = up.parentId ? byId.get(up.parentId) : undefined;
    }
  }
  const groups = new Map<string, ImportedMap['cards']>();
  for (const card of map.cards) {
    const key = loops.has(card.id) ? '' : (card.parentId && ids.has(card.parentId) ? card.parentId : '');
    const list = groups.get(key);
    if (list) list.push(card);
    else groups.set(key, [card]);
  }
  const keys = new Map<string, string>();
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (key === '' && target.kind === 'into') {
      // Cards landing beside existing ones go after them, in the file's order.
      let last = childrenOf(board, topParent).at(-1)?.orderKey ?? null;
      for (const card of sorted) {
        last = safeKeyBetween(last, null);
        keys.set(card.id, last);
      }
      continue;
    }
    const made = initialOrderKeys(sorted.length);
    sorted.forEach((card, index) => keys.set(card.id, made[index] as string));
  }

  const nodes: SculptorNode[] = map.cards.map((card) => {
    let unit = card.script?.unitId ?? null;
    let beat = card.script?.beatId ?? null;
    if (unit && (!unitIds.has(unit) || claimed.units.has(unit))) unit = null;
    if (beat && (!beatIds.has(beat) || claimed.beats.has(beat))) beat = null;
    if ((card.script?.unitId && !unit) || (card.script?.beatId && !beat)) report.bindingsDropped += 1;
    if (unit) claimed.units.add(unit);
    if (beat) claimed.beats.add(beat);
    const definitionId = card.definitionId ? entityIds.get(card.definitionId) ?? null : null;
    return {
      id: ids.get(card.id) as SculptorNodeId,
      boardId,
      columnId: null,
      parentId: loops.has(card.id) ? topParent : parentOf(card),
      orderKey: keys.get(card.id) as string,
      title: definitionId && entities.find((one) => one.id === definitionId)?.sourceKind ? '' : card.title ?? '',
      note: card.note ?? '',
      kind: card.type && isSculptType(card.type) ? card.type : 'note',
      subtype: card.subtype ?? '',
      entityId: definitionId,
      colour: '',
      fields: { ...(card.details ?? {}) },
      characterIds: [],
      end: null,
      collapsed: false,
      boundUnitId: unit as SculptorNode['boundUnitId'],
      boundBeatId: beat as SculptorNode['boundBeatId'],
      createdAt: at,
      updatedAt: at,
    };
  });
  report.cards = nodes.length;

  const links: SculptorLink[] = [];
  for (const connection of map.connections) {
    const from = ids.get(connection.fromId);
    const to = ids.get(connection.toId);
    if (!from || !to || from === to) {
      report.connectionsDropped += 1;
      continue;
    }
    const type = connection.type ?? 'related';
    links.push({
      id: newId<SculptorLinkId>(),
      fromId: from,
      toId: to,
      label: connection.label ?? '',
      type,
      directed: connection.directed ?? (type !== 'related' && type !== 'conflict'),
      createdAt: at,
      updatedAt: at,
    });
  }
  report.connections = links.length;

  // The view comes along only with a new map; into an open map, the writer's view stays.
  const remap = (list: unknown): string[] =>
    Array.isArray(list) ? list.flatMap((one) => (typeof one === 'string' && ids.has(one) ? [ids.get(one) as string] : [])) : [];
  const view = (map.view ?? {}) as { level?: unknown; open?: unknown; closed?: unknown; rootId?: unknown; hiddenLinkTypes?: unknown };
  const layout = Object.fromEntries(
    Object.entries(map.layout ?? {}).flatMap(([id, point]) => (ids.has(id) ? [[ids.get(id) as string, point]] : [])),
  );
  const savedViews =
    target.kind === 'new'
      ? (map.savedViews ?? []).flatMap((one) => {
          const saved = one as { name?: unknown; state?: { level?: unknown; open?: unknown; closed?: unknown }; layout?: Record<string, { x: number; y: number }> };
          if (!saved || typeof saved !== 'object') return [];
          return [
            {
              id: newId<SculptorViewId>(),
              name: typeof saved.name === 'string' ? saved.name : 'View',
              state: {
                level: saved.state?.level ?? { kind: 'all' },
                open: remap(saved.state?.open),
                closed: remap(saved.state?.closed),
                rootId: null,
                hiddenLinkTypes: [],
              },
              layout: Object.fromEntries(Object.entries(saved.layout ?? {}).flatMap(([id, point]) => (ids.has(id) ? [[ids.get(id) as string, point]] : []))),
            },
          ];
        })
      : [];

  let next: Board;
  if (target.kind === 'new') {
    next = boardSchema.parse({
      ...board,
      nodes,
      links,
      entities,
      viewState: {
        level: view.level ?? { kind: 'all' },
        open: remap(view.open),
        closed: remap(view.closed),
        rootId: null,
        hiddenLinkTypes: Array.isArray(view.hiddenLinkTypes) ? view.hiddenLinkTypes.filter((one): one is string => typeof one === 'string') : [],
      },
      layout,
      views: savedViews,
    });
  } else {
    const state = board.viewState;
    next = boardSchema.parse({
      ...board,
      nodes: [...board.nodes, ...nodes],
      links: [...(board.links ?? []), ...links],
      entities,
      viewState: topParent
        ? { ...state, closed: state.closed.filter((id) => id !== topParent), open: state.open.includes(topParent) ? state.open : [...state.open, topParent] }
        : state,
      updatedAt: at,
    });
  }

  const boards = boardsOf(current);
  current = {
    ...current,
    boards: target.kind === 'new' ? [...boards, next] : boards.map((one) => (one.id === boardId ? next : one)),
    project: { ...current.project, updatedAt: at },
  };
  report.boardId = boardId;
  return { file: current, report };
};

/** The report as one sentence for the room's status line. */
export const sayMapImport = (report: MapImportReport): string => {
  const parts = [`Imported ${report.cards} ${report.cards === 1 ? 'card' : 'cards'}`];
  if (report.connections) parts.push(`${report.connections} ${report.connections === 1 ? 'connection' : 'connections'}`);
  let text = parts.join(' and ') + '.';
  if (report.linked) text += ` ${report.linked} linked to what this project already has.`;
  if (report.castAdded.length) text += ` Added to the cast: ${report.castAdded.join(', ')}.`;
  if (report.unlinked) text += ` ${report.unlinked} ${report.unlinked === 1 ? 'item was' : 'items were'} not found here and stay on the map only.`;
  if (report.bindingsDropped) text += ` ${report.bindingsDropped} script ${report.bindingsDropped === 1 ? 'link was' : 'links were'} left off (not in this project, or already on a map).`;
  return text;
};

/** A map removed from the project, its cards with it. The script, the cast and the research are not touched. */
export const removeBoard = (file: ProjectFile, boardId: BoardId): ProjectFile => {
  if (!findBoard(file, boardId)) return file;
  return { ...file, boards: boardsOf(file).filter((one) => one.id !== boardId), project: { ...file.project, updatedAt: nowIso() } };
};

/** A map renamed. */
export const nameBoard = (file: ProjectFile, boardId: BoardId, name: string): ProjectFile =>
  findBoard(file, boardId)
    ? { ...file, boards: boardsOf(file).map((one) => (one.id === boardId ? { ...one, name, updatedAt: nowIso() } : one)) }
    : file;
