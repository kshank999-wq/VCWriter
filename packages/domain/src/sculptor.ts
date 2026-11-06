import { onlyLiving } from './graveyard.js';
import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { initialOrderKeys, orderKeyBetween } from './ordering.js';
import {
  boardSchema,
  type Board,
  type SculptorEntity,
  type SculptorLevel,
  type SculptorLink,
  type SculptorNode,
  type SculptorSavedView,
  type SculptorSourceKind,
  type SculptorViewState,
} from './entities/sculptor.js';
import { retitleScript } from './planning.js';
import { sculptTypeInfo, SCULPT_TYPE_INFO, sculptTypeName, isSculptType, type SculptType } from './sculptor-types.js';
import type { ProjectFile } from './project-file.js';
import type { BoardId, SculptorEntityId, SculptorLinkId, SculptorNodeId, SculptorViewId } from './ids.js';

/**
 * Story Sculptor 2.0 (addendum 03, v2).
 *
 * **A nested, expandable story mind map.** Frames hold scenes, scenes hold the
 * characters in them, characters hold what they do, and it goes on as deep as
 * the story needs. Any branch can be opened as a map of its own; the whole
 * thing can be exploded onto one canvas or folded back to its frames.
 *
 * Three things are kept apart, as §4, §6 and §7 ask:
 *
 * - **A definition and its placements.** A character is defined once (an
 *   entity, read from the cast) and placed in as many scenes as it appears in.
 *   Deleting a placement never deletes the character.
 * - **Containment and cross-links.** A card has one parent, and the parents
 *   never loop. A cross-link joins any two cards, may loop, and survives every
 *   fold.
 * - **The story and how it is being looked at.** What is open, what is folded
 *   and where the writer dragged a card are view state, beside the story.
 */

// ------------------------------------------------------------ the board

export const boardsOf = (file: ProjectFile): Board[] => file.boards ?? [];

export const findBoard = (file: ProjectFile, boardId: BoardId): Board | null =>
  boardsOf(file).find((board) => board.id === boardId) ?? null;

/** A new, empty v2 board. The writer starts with a frame (v2 §5). */
export const createBoard = (file: ProjectFile, input: { name?: string } = {}): { file: ProjectFile; board: Board } => {
  const at = nowIso();
  const board = boardSchema.parse({
    id: newId<BoardId>(),
    projectId: file.project.id,
    schemaVersion: 2,
    name: input.name ?? 'Story map',
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, boards: [...boardsOf(file), board] }, board };
};

const touch = <T extends { updatedAt: string }>(row: T): T => ({ ...row, updatedAt: nowIso() });

const withBoard = (file: ProjectFile, boardId: BoardId, change: (board: Board) => Board): ProjectFile => {
  const board = findBoard(file, boardId);
  if (!board) return file;
  const changed = change(board);
  if (changed === board) return file;
  const next = touch(changed);
  return {
    ...file,
    boards: boardsOf(file).map((candidate) => (candidate.id === boardId ? next : candidate)),
    project: { ...file.project, updatedAt: nowIso() },
  };
};

export const renameBoard = (file: ProjectFile, boardId: BoardId, name: string): ProjectFile =>
  withBoard(file, boardId, (board) => ({ ...board, name }));

// ----------------------------------------------------------- reading it

const byOrder = (a: { orderKey: string }, b: { orderKey: string }): number =>
  a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0;

export const findNode = (board: Board, nodeId: SculptorNodeId | string): SculptorNode | null =>
  board.nodes.find((node) => node.id === nodeId) ?? null;

/** A card's children in order; null asks for the top level. */
export const childrenOf = (board: Board, parentId: SculptorNodeId | string | null): SculptorNode[] =>
  board.nodes.filter((node) => (node.parentId ?? null) === parentId).sort(byOrder);

/** The top of the story: the cards with no parent. */
export const rootsOf = (board: Board): SculptorNode[] => childrenOf(board, null);

/** Kept for the callers that knew the structure chain as the top level. */
export const blocksOf = rootsOf;

/** From the top of the story down to the card's parent. Bounded, so a broken file cannot loop it. */
export const ancestorsOf = (board: Board, nodeId: SculptorNodeId | string): SculptorNode[] => {
  const chain: SculptorNode[] = [];
  let node = findNode(board, nodeId);
  for (let step = 0; node?.parentId && step <= board.nodes.length; step += 1) {
    const parent = findNode(board, node.parentId);
    if (!parent) break;
    chain.unshift(parent);
    node = parent;
  }
  return chain;
};

export const nodeDepth = (board: Board, nodeId: SculptorNodeId | string): number => ancestorsOf(board, nodeId).length;

/** A card and everything under it, however deep, the card first. */
export const subtreeOf = (board: Board, nodeId: SculptorNodeId | string): SculptorNodeId[] => {
  const found: SculptorNodeId[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    found.push(id as SculptorNodeId);
    for (const child of childrenOf(board, id)) walk(child.id as string);
  };
  walk(nodeId as string);
  return found;
};

/** Whether `nodeId` is `ancestorId` or somewhere under it. */
export const isWithin = (board: Board, nodeId: SculptorNodeId | string, ancestorId: SculptorNodeId | string): boolean =>
  nodeId === ancestorId || ancestorsOf(board, nodeId).some((node) => node.id === ancestorId);

export const entitiesOf = (board: Board): SculptorEntity[] => board.entities ?? [];

export const findEntity = (board: Board, entityId: SculptorEntityId | string | null): SculptorEntity | null =>
  entityId ? entitiesOf(board).find((entity) => entity.id === entityId) ?? null : null;

/** The cards that place this definition. */
export const placementsOfEntity = (board: Board, entityId: SculptorEntityId | string): SculptorNode[] =>
  board.nodes.filter((node) => node.entityId === entityId);

/** The name of the project record a definition stands for, read live. */
export const sourceTitle = (file: ProjectFile, kind: SculptorSourceKind | null, id: string | null): string | null => {
  if (!kind || !id) return null;
  if (kind === 'character') return file.characters.find((one) => (one.id as string) === id)?.name ?? null;
  if (kind === 'location') return (file.locations ?? []).find((one) => (one.id as string) === id)?.name ?? null;
  if (kind === 'research') return file.researchItems.find((one) => (one.id as string) === id)?.title ?? null;
  if (kind === 'theme') {
    const themes = (file as unknown as { themes?: { id: string; name?: string; title?: string }[] }).themes ?? [];
    const theme = themes.find((one) => one.id === id);
    return theme ? theme.name ?? theme.title ?? null : null;
  }
  return null;
};

/** What a definition is called: its source's name where it has one, else its own. */
export const entityTitle = (file: ProjectFile, entity: SculptorEntity): string =>
  sourceTitle(file, entity.sourceKind, entity.sourceId) ?? entity.title;

/** What a card says on its face: its definition's name, or its own title. */
export const titleOf = (file: ProjectFile, board: Board, node: SculptorNode): string => {
  const entity = findEntity(board, node.entityId);
  return entity ? entityTitle(file, entity) : node.title;
};

/** The scene a card is in, if any: the nearest scene above it (v2 §8, *inherits scene context*). */
export const sceneOf = (board: Board, nodeId: SculptorNodeId | string): SculptorNode | null =>
  [...ancestorsOf(board, nodeId)].reverse().find((node) => node.kind === 'scene') ?? null;

/** The character an action belongs to: the nearest character above it. */
export const actorOf = (board: Board, nodeId: SculptorNodeId | string): SculptorNode | null =>
  [...ancestorsOf(board, nodeId)].reverse().find((node) => node.kind === 'character') ?? null;

// ---------------------------------------------------------- writing it

/** What a new card under a card of this type usually is, for *Add under*. */
export const childTypeFor = (parentType: string | null): SculptType => {
  if (parentType === null) return 'frame';
  if (parentType === 'frame' || parentType === 'plot_point') return 'scene';
  if (parentType === 'scene') return 'character';
  if (parentType === 'character') return 'action';
  return 'note';
};

/**
 * Whether a card of this type may go under that one (v2 §4: configurable,
 * permissive by default). Containment never loops; that is checked apart.
 */
export const canContain = (_parentType: string | null, _childType: string): boolean => true;

const keyAmong = (siblings: readonly SculptorNode[], where: { afterId?: string | null; beforeId?: string | null }): string => {
  if (siblings.length === 0) return initialOrderKeys(1)[0] as string;
  if (where.beforeId) {
    const at = siblings.findIndex((node) => node.id === where.beforeId);
    if (at !== -1) return safeBetween(siblings[at - 1]?.orderKey ?? null, siblings[at]?.orderKey ?? null);
  }
  if (where.afterId) {
    const at = siblings.findIndex((node) => node.id === where.afterId);
    if (at !== -1) return safeBetween(siblings[at]?.orderKey ?? null, siblings[at + 1]?.orderKey ?? null);
  }
  return safeBetween(siblings[siblings.length - 1]?.orderKey ?? null, null);
};

const safeBetween = (before: string | null, after: string | null): string => {
  for (const [a, b] of [[before, after], [before, null], [null, after], [null, null]] as const) {
    try {
      return orderKeyBetween(a, b);
    } catch {
      // try the next pair
    }
  }
  return initialOrderKeys(1)[0] as string;
};

const madeNode = (
  boardId: BoardId,
  input: {
    parentId: SculptorNodeId | null;
    orderKey: string;
    kind: string;
    title?: string;
    subtype?: string;
    entityId?: SculptorEntityId | null;
    note?: string;
    fields?: Record<string, string>;
  },
): SculptorNode => {
  const at = nowIso();
  return {
    id: newId<SculptorNodeId>(),
    boardId,
    columnId: null,
    parentId: input.parentId,
    orderKey: input.orderKey,
    title: input.title ?? '',
    note: input.note ?? '',
    kind: input.kind,
    subtype: input.subtype ?? '',
    entityId: input.entityId ?? null,
    colour: '',
    fields: input.fields ?? {},
    characterIds: [],
    end: null,
    collapsed: false,
    boundUnitId: null,
    boundBeatId: null,
    createdAt: at,
    updatedAt: at,
  };
};

/**
 * A new card (v2 §4, §5). Under `parentId`, or at the top for null; after or
 * before a sibling where one is named, else last. The parent is opened so the
 * card is seen.
 */
export const addNode = (
  file: ProjectFile,
  boardId: BoardId,
  input: {
    parentId?: SculptorNodeId | null;
    kind?: string;
    title?: string;
    subtype?: string;
    entityId?: SculptorEntityId | null;
    note?: string;
    afterId?: SculptorNodeId | null;
    beforeId?: SculptorNodeId | null;
  } = {},
): { file: ProjectFile; nodeId: SculptorNodeId | null } => {
  const board = findBoard(file, boardId);
  if (!board) return { file, nodeId: null };
  const parentId = input.parentId ?? null;
  const parent = parentId ? findNode(board, parentId) : null;
  if (parentId && !parent) return { file, nodeId: null };
  const kind = input.kind ?? childTypeFor(parent?.kind ?? null);
  if (!canContain(parent?.kind ?? null, kind)) return { file, nodeId: null };
  if (input.entityId && !findEntity(board, input.entityId)) return { file, nodeId: null };

  const node = madeNode(boardId, {
    parentId,
    orderKey: keyAmong(childrenOf(board, parentId), { afterId: input.afterId ?? null, beforeId: input.beforeId ?? null }),
    kind,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.subtype !== undefined ? { subtype: input.subtype } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    entityId: input.entityId ?? null,
  });
  return {
    file: withBoard(file, boardId, (current) => ({
      ...current,
      nodes: [...current.nodes, node],
      viewState: parentId ? opened(current, parentId) : current.viewState,
    })),
    nodeId: node.id,
  };
};

/** A frame at the top of the story, after the one named (the notes and the outline use this). */
export const addBlock = (
  file: ProjectFile,
  boardId: BoardId,
  input: { afterNodeId?: SculptorNodeId | null; title?: string } = {},
): { file: ProjectFile; nodeId: SculptorNodeId | null } =>
  addNode(file, boardId, {
    parentId: null,
    kind: 'frame',
    ...(input.title !== undefined ? { title: input.title } : {}),
    afterId: input.afterNodeId ?? null,
  });

/** A card under a card, of the type that usually goes there unless one is given. */
export const addChild = (
  file: ProjectFile,
  boardId: BoardId,
  parentId: SculptorNodeId,
  input: { afterNodeId?: SculptorNodeId | null; title?: string; kind?: string } = {},
): { file: ProjectFile; nodeId: SculptorNodeId | null } =>
  addNode(file, boardId, {
    parentId,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    afterId: input.afterNodeId ?? null,
  });

/** One field of a card's details. */
export const setNodeField = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
  name: string,
  value: string,
): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    nodes: board.nodes.map((node) => (node.id === nodeId ? touch({ ...node, fields: { ...node.fields, [name]: value } }) : node)),
  }));

/**
 * What a card says. A title typed on a placement renames its definition, so
 * every placement says the new name (v2 §4); a character's is the cast's own
 * name. A bound card renames its scene or beat (§6).
 */
export const updateNode = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
  patch: Partial<Pick<SculptorNode, 'title' | 'note' | 'colour' | 'subtype' | 'collapsed'>>,
): ProjectFile => {
  const board = findBoard(file, boardId);
  const before = board ? findNode(board, nodeId) : null;
  if (!board || !before) return file;
  const entity = findEntity(board, before.entityId);
  const { title, ...rest } = patch;

  let next = withBoard(file, boardId, (current) => ({
    ...current,
    nodes: current.nodes.map((node) =>
      node.id === nodeId ? touch({ ...node, ...rest, ...(title !== undefined && !entity ? { title } : {}) }) : node,
    ),
  }));
  if (title === undefined) return next;
  if (entity) return renameEntity(next, boardId, entity.id, title);
  if (before.boundUnitId !== null) next = retitleScript(next, { unitId: before.boundUnitId }, title);
  else if (before.boundBeatId !== null) next = retitleScript(next, { beatId: before.boundBeatId }, title);
  return next;
};

/**
 * A card made another type, where it can be (v2 §4). A card bound to a
 * scene or beat keeps the type it is bound as, and a character placement
 * stays a character: both say *unbind first* in the panel.
 */
export const canChangeType = (board: Board, nodeId: SculptorNodeId, kind: string): boolean => {
  const node = findNode(board, nodeId);
  if (!node || !isSculptType(kind)) return false;
  if (node.kind === kind) return true;
  if (node.boundUnitId !== null || node.boundBeatId !== null) return false;
  const entity = findEntity(board, node.entityId);
  if (entity?.sourceKind) return false;
  return true;
};

export const setNodeType = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId, kind: string): ProjectFile => {
  const board = findBoard(file, boardId);
  if (!board || !canChangeType(board, nodeId, kind)) return file;
  return withBoard(file, boardId, (current) => ({
    ...current,
    nodes: current.nodes.map((node) => (node.id === nodeId ? touch({ ...node, kind }) : node)),
  }));
};

// ------------------------------------------------- moving and reparenting

/** Whether a card may go under another without a loop (v2 §7). Null is the top. */
export const canReparent = (board: Board, nodeId: SculptorNodeId, parentId: SculptorNodeId | null): boolean => {
  const node = findNode(board, nodeId);
  if (!node) return false;
  if (parentId === null) return true;
  const parent = findNode(board, parentId);
  if (!parent || parentId === nodeId) return false;
  if (isWithin(board, parentId, nodeId)) return false;
  return canContain(parent.kind, node.kind);
};

/**
 * What a move would change about where the card stands in the story, so the
 * canvas can ask first (v2 §8): a beat or a character leaving its scene.
 */
export const moveChangesContext = (board: Board, nodeId: SculptorNodeId, parentId: SculptorNodeId | null): string | null => {
  const node = findNode(board, nodeId);
  if (!node) return null;
  const was = sceneOf(board, nodeId);
  const will = parentId === null ? null : findNode(board, parentId)?.kind === 'scene' ? findNode(board, parentId) : sceneOf(board, parentId);
  if ((was?.id ?? null) === (will?.id ?? null)) return null;
  const bound = subtreeOf(board, nodeId)
    .map((id) => findNode(board, id))
    .filter((one) => one && one.boundBeatId !== null).length;
  if (bound === 0 && node.kind !== 'character' && node.kind !== 'action' && node.kind !== 'beat') return null;
  const from = was ? `“${was.title.trim() || 'its scene'}”` : 'no scene';
  const to = will ? `“${will.title.trim() || 'another scene'}”` : 'no scene';
  return `This moves it from ${from} to ${to}.${bound > 0 ? ` ${bound} of the cards are beats in the script; the script is not changed.` : ''}`;
};

/** A card and its branch moved under another card, or to the top, at a place among the siblings. */
export const moveNodeTo = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
  to: { parentId: SculptorNodeId | null; beforeId?: SculptorNodeId | null; afterId?: SculptorNodeId | null },
): ProjectFile => {
  const board = findBoard(file, boardId);
  if (!board || !canReparent(board, nodeId, to.parentId)) return file;
  const siblings = childrenOf(board, to.parentId).filter((node) => node.id !== nodeId);
  const orderKey = keyAmong(siblings, { beforeId: to.beforeId ?? null, afterId: to.afterId ?? null });
  return withBoard(file, boardId, (current) => ({
    ...current,
    nodes: current.nodes.map((node) => (node.id === nodeId ? touch({ ...node, parentId: to.parentId, orderKey }) : node)),
    viewState: to.parentId ? opened(current, to.parentId) : current.viewState,
  }));
};

/** One place up or down among its siblings. */
export const moveNode = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId, direction: -1 | 1): ProjectFile => {
  const board = findBoard(file, boardId);
  const node = board ? findNode(board, nodeId) : null;
  if (!board || !node) return file;
  const siblings = childrenOf(board, node.parentId);
  const at = siblings.findIndex((one) => one.id === nodeId);
  const other = siblings[at + direction];
  if (!other) return file;
  return moveNodeTo(file, boardId, nodeId, {
    parentId: node.parentId,
    ...(direction === -1 ? { beforeId: other.id } : { afterId: other.id }),
  });
};

// ------------------------------------------ definitions and placements (§4)

const madeEntity = (input: Partial<SculptorEntity> & { type: string }): SculptorEntity => {
  const at = nowIso();
  return {
    id: newId<SculptorEntityId>(),
    type: input.type,
    subtype: input.subtype ?? '',
    sourceKind: input.sourceKind ?? null,
    sourceId: input.sourceId ?? null,
    title: input.title ?? '',
    description: input.description ?? '',
    fields: input.fields ?? {},
    favorite: input.favorite ?? false,
    createdAt: at,
    updatedAt: at,
  };
};

/** The type a project record is placed as. */
export const typeForSource = (kind: SculptorSourceKind): { type: SculptType; subtype: string } =>
  kind === 'character'
    ? { type: 'character', subtype: '' }
    : kind === 'location'
      ? { type: 'custom', subtype: 'Location' }
      : kind === 'theme'
        ? { type: 'note', subtype: 'Theme' }
        : { type: 'note', subtype: 'Research' };

/** The definition standing for a project record, made the first time it is asked for. Never two. */
export const ensureSourceEntity = (
  file: ProjectFile,
  boardId: BoardId,
  source: { kind: SculptorSourceKind; id: string },
): { file: ProjectFile; entityId: SculptorEntityId | null } => {
  const board = findBoard(file, boardId);
  if (!board) return { file, entityId: null };
  const found = entitiesOf(board).find((entity) => entity.sourceKind === source.kind && entity.sourceId === source.id);
  if (found) return { file, entityId: found.id };
  if (sourceTitle(file, source.kind, source.id) === null) return { file, entityId: null };
  const { type, subtype } = typeForSource(source.kind);
  const entity = madeEntity({ type, subtype, sourceKind: source.kind, sourceId: source.id });
  return {
    file: withBoard(file, boardId, (current) => ({ ...current, entities: [...entitiesOf(current), entity] })),
    entityId: entity.id,
  };
};

/**
 * A project record placed under a card (v2 §8): the same definition every
 * time, so a character dragged into five scenes is still one character.
 */
export const placeSource = (
  file: ProjectFile,
  boardId: BoardId,
  source: { kind: SculptorSourceKind; id: string },
  parentId: SculptorNodeId | null,
): { file: ProjectFile; nodeId: SculptorNodeId | null } => {
  const ensured = ensureSourceEntity(file, boardId, source);
  if (!ensured.entityId) return { file, nodeId: null };
  const { type, subtype } = typeForSource(source.kind);
  return addNode(ensured.file, boardId, { parentId, kind: type, subtype, entityId: ensured.entityId });
};

/** A board definition placed under a card. */
export const placeEntity = (
  file: ProjectFile,
  boardId: BoardId,
  entityId: SculptorEntityId,
  parentId: SculptorNodeId | null,
): { file: ProjectFile; nodeId: SculptorNodeId | null } => {
  const board = findBoard(file, boardId);
  const entity = board ? findEntity(board, entityId) : null;
  if (!entity) return { file, nodeId: null };
  return addNode(file, boardId, { parentId, kind: entity.type, subtype: entity.subtype, entityId });
};

/** A card turned into a definition the library offers, so it can be placed again. */
export const makeReusable = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
): { file: ProjectFile; entityId: SculptorEntityId | null } => {
  const board = findBoard(file, boardId);
  const node = board ? findNode(board, nodeId) : null;
  if (!board || !node) return { file, entityId: null };
  if (node.entityId) return { file, entityId: node.entityId };
  const entity = madeEntity({ type: node.kind, subtype: node.subtype, title: node.title, description: node.note });
  return {
    file: withBoard(file, boardId, (current) => ({
      ...current,
      entities: [...entitiesOf(current), entity],
      nodes: current.nodes.map((one) => (one.id === nodeId ? touch({ ...one, entityId: entity.id }) : one)),
    })),
    entityId: entity.id,
  };
};

/**
 * A definition renamed, so every placement says the new name. A character's
 * name is the cast's, so it is renamed there; nothing else in the script is.
 */
export const renameEntity = (file: ProjectFile, boardId: BoardId, entityId: SculptorEntityId, title: string): ProjectFile => {
  const board = findBoard(file, boardId);
  const entity = board ? findEntity(board, entityId) : null;
  if (!entity) return file;
  if (entity.sourceKind === 'character' && entity.sourceId) {
    const at = nowIso();
    return {
      ...file,
      characters: file.characters.map((one) => ((one.id as string) === entity.sourceId ? { ...one, name: title, updatedAt: at } : one)),
      project: { ...file.project, updatedAt: at },
    };
  }
  if (entity.sourceKind) return file;
  return updateEntity(file, boardId, entityId, { title });
};

export const updateEntity = (
  file: ProjectFile,
  boardId: BoardId,
  entityId: SculptorEntityId,
  patch: Partial<Pick<SculptorEntity, 'title' | 'description' | 'favorite' | 'fields'>>,
): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    entities: entitiesOf(board).map((entity) => (entity.id === entityId ? touch({ ...entity, ...patch }) : entity)),
  }));

/** A favourite in the library. A project record becomes a definition to carry the star. */
export const setFavorite = (
  file: ProjectFile,
  boardId: BoardId,
  target: { entityId: SculptorEntityId } | { kind: SculptorSourceKind; id: string },
  favorite: boolean,
): ProjectFile => {
  if ('entityId' in target) return updateEntity(file, boardId, target.entityId, { favorite });
  const ensured = ensureSourceEntity(file, boardId, target);
  return ensured.entityId ? updateEntity(ensured.file, boardId, ensured.entityId, { favorite }) : file;
};

/**
 * Another placement of the same definition beside this one (v2 §7: *duplicate
 * instance*). A card with no definition is made reusable first, so the two
 * really are one thing.
 */
export const duplicatePlacement = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
): { file: ProjectFile; nodeId: SculptorNodeId | null } => {
  const reusable = makeReusable(file, boardId, nodeId);
  const board = findBoard(reusable.file, boardId);
  const node = board ? findNode(board, nodeId) : null;
  if (!node || !reusable.entityId) return { file, nodeId: null };
  return addNode(reusable.file, boardId, {
    parentId: node.parentId,
    kind: node.kind,
    subtype: node.subtype,
    entityId: reusable.entityId,
    afterId: node.id,
  });
};

/** What *Copy* holds: a branch, with its own links, ready to paste. */
export interface SculptClip {
  nodes: SculptorNode[];
  links: SculptorLink[];
  rootId: string;
}

export const copyBranch = (board: Board, nodeId: SculptorNodeId): SculptClip | null => {
  if (!findNode(board, nodeId)) return null;
  const ids = new Set(subtreeOf(board, nodeId).map((id) => id as string));
  return {
    nodes: board.nodes.filter((node) => ids.has(node.id as string)),
    links: (board.links ?? []).filter((link) => ids.has(link.fromId as string) && ids.has(link.toId as string)),
    rootId: nodeId as string,
  };
};

/**
 * A copied branch pasted under a card. Each card is new; a card that placed a
 * definition still places it (a copy of a scene with Mara in it still has
 * Mara, not a second Mara). With `asNew`, definitions of the board's own are
 * cloned instead (v2 §7, *cloned definition*). Bindings never travel: one
 * scene in the script is one card.
 */
export const pasteBranch = (
  file: ProjectFile,
  boardId: BoardId,
  clip: SculptClip,
  parentId: SculptorNodeId | null,
  options: { asNew?: boolean } = {},
): { file: ProjectFile; nodeId: SculptorNodeId | null } => {
  const board = findBoard(file, boardId);
  if (!board || (parentId && !findNode(board, parentId))) return { file, nodeId: null };
  const at = nowIso();
  const fresh = new Map(clip.nodes.map((node) => [node.id as string, newId<SculptorNodeId>()]));
  const known = new Set(entitiesOf(board).map((entity) => entity.id as string));
  const clones = new Map<string, SculptorEntity>();
  const entityFor = (id: SculptorEntityId | null): SculptorEntityId | null => {
    if (!id || !known.has(id as string)) return null;
    if (!options.asNew) return id;
    const original = findEntity(board, id);
    if (!original || original.sourceKind) return id;
    const clone = clones.get(id as string) ?? { ...madeEntity({ ...original, type: original.type }), title: original.title };
    clones.set(id as string, clone);
    return clone.id;
  };
  const top = fresh.get(clip.rootId) ?? null;
  const siblings = childrenOf(board, parentId);
  const nodes = clip.nodes.map((node) => {
    const isTop = (node.id as string) === clip.rootId;
    return {
      ...node,
      id: fresh.get(node.id as string) as SculptorNodeId,
      boardId,
      parentId: isTop ? parentId : ((fresh.get(node.parentId as string) ?? null) as SculptorNodeId | null),
      orderKey: isTop ? keyAmong(siblings, {}) : node.orderKey,
      entityId: entityFor(node.entityId),
      boundUnitId: null,
      boundBeatId: null,
      createdAt: at,
      updatedAt: at,
    };
  });
  const links = clip.links.map((link) => ({
    ...link,
    id: newId<SculptorLinkId>(),
    fromId: fresh.get(link.fromId as string) as SculptorNodeId,
    toId: fresh.get(link.toId as string) as SculptorNodeId,
    createdAt: at,
    updatedAt: at,
  }));
  return {
    file: withBoard(file, boardId, (current) => ({
      ...current,
      nodes: [...current.nodes, ...nodes],
      links: [...(current.links ?? []), ...links],
      entities: [...entitiesOf(current), ...clones.values()],
      viewState: parentId ? opened(current, parentId) : current.viewState,
    })),
    nodeId: top,
  };
};

// --------------------------------------------------------------- deleting

/**
 * What removing this card would take with it, asked before it goes. Its
 * definition and the other placements of it are never part of it (v2 §8).
 */
export interface WhatGoes {
  cards: number;
  bound: number;
  links: number;
  removable: boolean;
}

export const whatGoesWith = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId): WhatGoes => {
  const board = findBoard(file, boardId);
  if (!board || !findNode(board, nodeId)) return { cards: 0, bound: 0, links: 0, removable: false };
  const doomed = new Set(subtreeOf(board, nodeId).map((id) => id as string));
  const going = board.nodes.filter((node) => doomed.has(node.id as string));
  return {
    cards: going.length,
    bound: going.filter((node) => node.boundUnitId !== null || node.boundBeatId !== null).length,
    links: linksOf(board).filter((link) => doomed.has(link.fromId as string) || doomed.has(link.toId as string)).length,
    removable: true,
  };
};

export const removalQuestion = (going: WhatGoes, title: string): string => {
  const what = title.trim().length > 0 ? `“${title.trim()}”` : 'this card';
  if (going.cards <= 1) return `Delete ${what}?`;
  return `Delete ${what} and the ${going.cards - 1} ${going.cards === 2 ? 'card' : 'cards'} under it?`;
};

export const removalComfort = (going: WhatGoes): string => {
  const parts: string[] = [];
  if (going.bound > 0) {
    parts.push(
      going.bound === 1
        ? 'One of them is in the script. The script stays; only the card goes.'
        : `${going.bound} of them are in the script. The script stays; only the cards go.`,
    );
  }
  if (going.links > 0) {
    parts.push(`${going.links} ${going.links === 1 ? 'connection' : 'connections'} you drew ${going.links === 1 ? 'goes' : 'go'} with ${going.cards === 1 ? 'it' : 'them'}.`);
  }
  parts.push('Characters and other reusable items stay in the library.');
  return parts.join(' ');
};

const withoutNodes = (board: Board, doomed: ReadonlySet<string>): Board => {
  const layout = { ...(board.layout ?? {}) };
  for (const id of doomed) delete layout[id];
  const state = viewStateOf(board);
  return {
    ...board,
    nodes: board.nodes.filter((node) => !doomed.has(node.id as string)),
    links: linksOf(board).filter((link) => !doomed.has(link.fromId as string) && !doomed.has(link.toId as string)),
    layout,
    viewState: {
      ...state,
      open: state.open.filter((id) => !doomed.has(id)),
      closed: state.closed.filter((id) => !doomed.has(id)),
      rootId: state.rootId && doomed.has(state.rootId) ? null : state.rootId,
    },
  };
};

/** A placement and its branch taken off the map. Definitions stay (v2 §8). */
export const removeNode = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId): ProjectFile => {
  const board = findBoard(file, boardId);
  if (!board || !findNode(board, nodeId)) return file;
  const doomed = new Set(subtreeOf(board, nodeId).map((id) => id as string));
  return withBoard(file, boardId, (current) => withoutNodes(current, doomed));
};

/**
 * A definition deleted on purpose, with every placement of it and their
 * branches. The project record it stood for (a character in the cast, a
 * research note) is not touched (v2 §9).
 */
export const removeEntity = (file: ProjectFile, boardId: BoardId, entityId: SculptorEntityId): ProjectFile => {
  const board = findBoard(file, boardId);
  if (!board || !findEntity(board, entityId)) return file;
  const doomed = new Set<string>();
  for (const node of placementsOfEntity(board, entityId)) for (const id of subtreeOf(board, node.id)) doomed.add(id as string);
  return withBoard(file, boardId, (current) => ({
    ...withoutNodes(current, doomed),
    entities: entitiesOf(current).filter((entity) => entity.id !== entityId),
  }));
};

export const boardTally = (board: Board): { nodes: number; bound: number } => ({
  nodes: board.nodes.length,
  bound: board.nodes.filter((node) => node.boundUnitId !== null || node.boundBeatId !== null).length,
});

// ------------------------------------------------------- cross-links (§7)

export const linksOf = (board: Board): SculptorLink[] => board.links ?? [];

export const linkBetween = (board: Board, a: SculptorNodeId, b: SculptorNodeId): SculptorLink | null =>
  linksOf(board).find((link) => (link.fromId === a && link.toId === b) || (link.fromId === b && link.toId === a)) ?? null;

export const linksTouching = (board: Board, nodeId: SculptorNodeId): SculptorLink[] =>
  linksOf(board).filter((link) => link.fromId === nodeId || link.toId === nodeId);

/**
 * A cross-link between any two cards, of a type, with an optional label. The
 * same pair may carry different types; the same type twice is refused. Cycles
 * are allowed (v2 §7); a card to itself is not.
 */
export const linkNodes = (
  file: ProjectFile,
  boardId: BoardId,
  fromId: SculptorNodeId,
  toId: SculptorNodeId,
  input: { label?: string; type?: string; directed?: boolean } = {},
): { file: ProjectFile; linkId: SculptorLinkId | null } => {
  const board = findBoard(file, boardId);
  if (!board || fromId === toId || !findNode(board, fromId) || !findNode(board, toId)) return { file, linkId: null };
  const type = input.type ?? 'related';
  const same = linksOf(board).some(
    (link) => link.type === type && ((link.fromId === fromId && link.toId === toId) || (link.fromId === toId && link.toId === fromId)),
  );
  if (same) return { file, linkId: null };
  const at = nowIso();
  const link: SculptorLink = {
    id: newId<SculptorLinkId>(),
    fromId,
    toId,
    label: input.label ?? '',
    type,
    directed: input.directed ?? (type !== 'related' && type !== 'conflict'),
    createdAt: at,
    updatedAt: at,
  };
  return { file: withBoard(file, boardId, (current) => ({ ...current, links: [...linksOf(current), link] })), linkId: link.id };
};

export const relabelLink = (file: ProjectFile, boardId: BoardId, linkId: SculptorLinkId, label: string): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    links: linksOf(board).map((link) => (link.id === linkId ? touch({ ...link, label }) : link)),
  }));

export const setLinkType = (
  file: ProjectFile,
  boardId: BoardId,
  linkId: SculptorLinkId,
  patch: { type?: string; directed?: boolean },
): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    links: linksOf(board).map((link) => (link.id === linkId ? touch({ ...link, ...patch }) : link)),
  }));

export const flipLink = (file: ProjectFile, boardId: BoardId, linkId: SculptorLinkId): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    links: linksOf(board).map((link) => (link.id === linkId ? touch({ ...link, fromId: link.toId, toId: link.fromId }) : link)),
  }));

export const unlinkNodes = (file: ProjectFile, boardId: BoardId, linkId: SculptorLinkId): ProjectFile =>
  withBoard(file, boardId, (board) => ({ ...board, links: linksOf(board).filter((link) => link.id !== linkId) }));

// --------------------------------------------- explode and collapse (§6)

export const viewStateOf = (board: Board): SculptorViewState => ({
  level: board.viewState?.level ?? { kind: 'all' },
  open: board.viewState?.open ?? [],
  closed: board.viewState?.closed ?? [],
  rootId: board.viewState?.rootId ?? null,
  hiddenLinkTypes: board.viewState?.hiddenLinkTypes ?? [],
});

const opened = (board: Board, nodeId: string): SculptorViewState => {
  const state = viewStateOf(board);
  if (isBranchOpen(board, nodeId)) return state;
  return {
    ...state,
    closed: state.closed.filter((id) => id !== nodeId),
    open: state.open.includes(nodeId) ? state.open : [...state.open, nodeId],
  };
};

const withView = (file: ProjectFile, boardId: BoardId, change: (state: SculptorViewState, board: Board) => SculptorViewState): ProjectFile =>
  withBoard(file, boardId, (board) => ({ ...board, viewState: change(viewStateOf(board), board) }));

/** Whether the global level alone would show this card's children. */
const levelOpens = (board: Board, node: SculptorNode, level: SculptorLevel, rootDepth: number): boolean => {
  if (level.kind === 'all') return true;
  if (level.kind === 'depth') return nodeDepth(board, node.id) - rootDepth < level.depth;
  return sculptTypeInfo(node.kind).rank < sculptTypeInfo(level.type).rank;
};

/** Whether a card's children are showing: the writer's own fold or unfold wins over the level. */
export const isBranchOpen = (board: Board, nodeId: SculptorNodeId | string): boolean => {
  const state = viewStateOf(board);
  if (state.closed.includes(nodeId as string)) return false;
  if (state.open.includes(nodeId as string)) return true;
  const node = findNode(board, nodeId);
  if (!node) return false;
  const root = state.rootId ? findNode(board, state.rootId) : null;
  return levelOpens(board, node, state.level, root ? nodeDepth(board, root.id) : 0);
};

/** Explode All: everything open, every fold forgotten (v2 §6). */
export const explodeAll = (file: ProjectFile, boardId: BoardId): ProjectFile =>
  withView(file, boardId, (state) => ({ ...state, level: { kind: 'all' }, open: [], closed: [] }));

/** Collapse All: back to the frames. */
export const collapseAll = (file: ProjectFile, boardId: BoardId): ProjectFile =>
  withView(file, boardId, (state) => ({ ...state, level: { kind: 'depth', depth: 0 }, open: [], closed: [] }));

/** Collapse to a level: a depth (root = 0) or a type (Frame, Scene, Character, Action). */
export const collapseToLevel = (file: ProjectFile, boardId: BoardId, level: SculptorLevel): ProjectFile =>
  withView(file, boardId, (state) => ({ ...state, level, open: [], closed: [] }));

/** Explode one branch: it and everything under it opened, the rest as it was. */
export const explodeBranch = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId): ProjectFile =>
  withView(file, boardId, (state, board) => {
    const ids = subtreeOf(board, nodeId).map((id) => id as string);
    const set = new Set(ids);
    return {
      ...state,
      closed: state.closed.filter((id) => !set.has(id)),
      open: [...new Set([...state.open, ...ids])],
    };
  });

/** Collapse one branch: folded at this card. What was open under it stays open for next time. */
export const collapseBranch = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId): ProjectFile =>
  withView(file, boardId, (state) => ({
    ...state,
    open: state.open.filter((id) => id !== nodeId),
    closed: state.closed.includes(nodeId as string) ? state.closed : [...state.closed, nodeId as string],
  }));

export const toggleBranch = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId): ProjectFile => {
  const board = findBoard(file, boardId);
  if (!board) return file;
  return isBranchOpen(board, nodeId)
    ? collapseBranch(file, boardId, nodeId)
    : withView(file, boardId, (state, current) => opened({ ...current, viewState: state }, nodeId as string));
};

/** Every ancestor opened, so a card deep in a fold is on the canvas (*show ancestors*, search). */
export const revealNode = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId): ProjectFile =>
  withView(file, boardId, (state, board) => {
    const chain = ancestorsOf(board, nodeId).map((node) => node.id as string);
    const set = new Set(chain);
    const outside = state.rootId !== null && !isWithin(board, nodeId, state.rootId);
    return {
      ...state,
      rootId: outside ? null : state.rootId,
      closed: state.closed.filter((id) => !set.has(id)),
      open: [...new Set([...state.open, ...chain])],
    };
  });

/** Open a card as its own mini map (v2 §5); null is the whole story. */
export const enterNode = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId | null): ProjectFile =>
  withView(file, boardId, (state, board) => {
    if (nodeId === null) return { ...state, rootId: null };
    if (!findNode(board, nodeId)) return state;
    const set = new Set([nodeId as string]);
    return { ...state, rootId: nodeId as string, closed: state.closed.filter((id) => !set.has(id)) };
  });

export const setHiddenLinkTypes = (file: ProjectFile, boardId: BoardId, types: readonly string[]): ProjectFile =>
  withView(file, boardId, (state) => ({ ...state, hiddenLinkTypes: [...types] }));

/** Ancestors of the card being shown as a mini map, for the breadcrumbs. */
export const breadcrumbsOf = (board: Board): SculptorNode[] => {
  const rootId = viewStateOf(board).rootId;
  const root = rootId ? findNode(board, rootId) : null;
  return root ? [...ancestorsOf(board, root.id), root] : [];
};

/** What sits under a card, by type, for its corner dots and the hover (v2 §4). */
export interface NestedSummary {
  total: number;
  byType: { type: string; count: number }[];
}

export const nestedSummary = (board: Board, nodeId: SculptorNodeId | string): NestedSummary => nestedSummaries(board).get(nodeId as string) ?? { total: 0, byType: [] };

const summaryCache = new WeakMap<Board, Map<string, NestedSummary>>();

/** Every card's summary at once, in one pass up the tree; cached per board value. */
export const nestedSummaries = (board: Board): Map<string, NestedSummary> => {
  const cached = summaryCache.get(board);
  if (cached) return cached;
  const kids = new Map<string, SculptorNode[]>();
  for (const node of board.nodes) {
    if (!node.parentId) continue;
    const list = kids.get(node.parentId as string);
    if (list) list.push(node);
    else kids.set(node.parentId as string, [node]);
  }
  const counts = new Map<string, Map<string, number>>();
  const visiting = new Set<string>();
  const countOf = (id: string): Map<string, number> => {
    const done = counts.get(id);
    if (done) return done;
    const mine = new Map<string, number>();
    if (visiting.has(id)) return mine;
    visiting.add(id);
    for (const child of kids.get(id) ?? []) {
      mine.set(child.kind, (mine.get(child.kind) ?? 0) + 1);
      for (const [type, n] of countOf(child.id as string)) mine.set(type, (mine.get(type) ?? 0) + n);
    }
    counts.set(id, mine);
    return mine;
  };
  const order = Object.keys(SCULPT_TYPE_INFO);
  const result = new Map<string, NestedSummary>();
  for (const node of board.nodes) {
    const mine = countOf(node.id as string);
    let total = 0;
    for (const n of mine.values()) total += n;
    result.set(node.id as string, {
      total,
      byType: [...mine.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)),
    });
  }
  summaryCache.set(board, result);
  return result;
};

/** One dot per type, capped, with the rest as `+N`. */
export const cornerDots = (summary: NestedSummary, cap = 4): { types: string[]; more: number } => ({
  types: summary.byType.slice(0, cap).map((entry) => entry.type),
  more: Math.max(0, summary.byType.length - cap),
});

export const sayNested = (summary: NestedSummary): string =>
  summary.byType.map((entry) => `${entry.count} ${(entry.count === 1 ? sculptTypeInfo(entry.type).name : sculptTypeInfo(entry.type).plural).toLowerCase()}`).join(', ');

// ----------------------------------------------------------- the canvas

/** A card's size and the air around it, in canvas pixels at 100%. */
export const CARD_WIDTH = 220;
export const CARD_HEIGHT = 72;
export const LEVEL_GAP = 80;
export const SIBLING_GAP = 16;

export interface PlacedCard {
  node: SculptorNode;
  x: number;
  y: number;
  depth: number;
  /** Children exist and are folded away. */
  folded: boolean;
  /** Placed by hand, rather than by the layout. */
  pinned: boolean;
}

export interface MapPicture {
  cards: PlacedCard[];
  /** Parent to child, for the containment lines. */
  edges: { fromId: string; toId: string }[];
  width: number;
  height: number;
  /** The ids on the canvas, for the links and the minimap. */
  visible: Set<string>;
}

/**
 * Lay out what is open (v2 §6, §7): a tree from left to right, each card's
 * children stacked to its right and centred on it. Deterministic, so the same
 * story always draws the same. A card the writer dragged keeps where they put
 * it, and its branch moves with it.
 */
export const mapPicture = (board: Board): MapPicture => {
  const state = viewStateOf(board);
  // Indexed once, so a map of thousands of cards lays out in one pass (v2 §12).
  const kids = new Map<string | null, SculptorNode[]>();
  const byId = new Map<string, SculptorNode>();
  for (const node of board.nodes) {
    byId.set(node.id as string, node);
    const key = (node.parentId as string | null) ?? null;
    const list = kids.get(key);
    if (list) list.push(node);
    else kids.set(key, [node]);
  }
  for (const list of kids.values()) list.sort(byOrder);
  const closed = new Set(state.closed);
  const forced = new Set(state.open);
  const level = state.level;
  const opensAt = (node: SculptorNode, depth: number): boolean => {
    if (closed.has(node.id as string)) return false;
    if (forced.has(node.id as string)) return true;
    if (level.kind === 'all') return true;
    if (level.kind === 'depth') return depth < level.depth;
    return sculptTypeInfo(node.kind).rank < sculptTypeInfo(level.type).rank;
  };

  const root = state.rootId ? byId.get(state.rootId) ?? null : null;
  const tops = root ? [root] : kids.get(null) ?? [];
  const placed: PlacedCard[] = [];
  const edges: { fromId: string; toId: string }[] = [];
  const visible = new Set<string>();
  const step = CARD_HEIGHT + SIBLING_GAP;
  const auto = new Map<string, { x: number; y: number; depth: number; folded: boolean; showing: SculptorNode[] }>();

  const lay = (node: SculptorNode, depth: number, top: number): number => {
    const id = node.id as string;
    if (visible.has(id)) return top;
    visible.add(id);
    const children = kids.get(id) ?? [];
    const showing = children.length > 0 && opensAt(node, depth) ? children : [];
    let bottom = top;
    for (const child of showing) {
      edges.push({ fromId: id, toId: child.id as string });
      bottom = lay(child, depth + 1, bottom);
    }
    const height = showing.length === 0 ? step : bottom - top;
    const y = showing.length === 0 ? top : top + height / 2 - step / 2;
    auto.set(id, { x: depth * (CARD_WIDTH + LEVEL_GAP), y, depth, folded: children.length > 0 && showing.length === 0, showing });
    return top + height;
  };
  let top = 0;
  for (const node of tops) top = lay(node, 0, top) + SIBLING_GAP;

  // Hand placement: a pinned card is where it was put; its branch follows it.
  const pins = board.layout ?? {};
  const shifted = (node: SculptorNode, dx: number, dy: number) => {
    const at = auto.get(node.id as string);
    if (!at) return;
    const pin = pins[node.id as string];
    const x = pin ? pin.x : at.x + dx;
    const y = pin ? pin.y : at.y + dy;
    placed.push({ node, x, y, depth: at.depth, folded: at.folded, pinned: Boolean(pin) });
    for (const child of at.showing) shifted(child, x - at.x, y - at.y);
  };
  for (const node of tops) shifted(node, 0, 0);

  let width = 0;
  let height = 0;
  for (const card of placed) {
    width = Math.max(width, card.x + CARD_WIDTH);
    height = Math.max(height, card.y + CARD_HEIGHT);
  }
  return { cards: placed, edges, width, height, visible };
};

/** A card put where the writer dropped it. */
export const pinNode = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId, at: { x: number; y: number }): ProjectFile =>
  withBoard(file, boardId, (board) => ({ ...board, layout: { ...(board.layout ?? {}), [nodeId as string]: { x: Math.round(at.x), y: Math.round(at.y) } } }));

/** Auto layout: hand placements forgotten for what is showing (or everything), the story untouched. */
export const autoLayout = (file: ProjectFile, boardId: BoardId, only?: readonly string[]): ProjectFile =>
  withBoard(file, boardId, (board) => {
    if (!only) return { ...board, layout: {} };
    const layout = { ...(board.layout ?? {}) };
    for (const id of only) delete layout[id];
    return { ...board, layout };
  });

/** The card standing in for one that is folded away: itself, or its nearest visible ancestor. */
export const standIn = (board: Board, visible: ReadonlySet<string>, nodeId: SculptorNodeId | string): string | null => {
  if (visible.has(nodeId as string)) return nodeId as string;
  for (const node of [...ancestorsOf(board, nodeId)].reverse()) if (visible.has(node.id as string)) return node.id as string;
  return null;
};

/**
 * The cross-links as the canvas draws them (v2 §6): a link into a fold goes
 * to the card standing in for its end, links between the same two cards are
 * drawn once with a count, and a link whose ends both fold into one card is
 * counted on that card. No link is ever lost.
 */
export interface DrawnLink {
  fromId: string;
  toId: string;
  links: SculptorLink[];
  /** At least one end is folded away. */
  aggregated: boolean;
}

export const drawnLinks = (
  board: Board,
  visible: ReadonlySet<string>,
): { lines: DrawnLink[]; inside: Map<string, number>; outside: Map<string, number> } => {
  const hidden = new Set(viewStateOf(board).hiddenLinkTypes);
  const parent = new Map(board.nodes.map((node) => [node.id as string, (node.parentId as string | null) ?? null]));
  const standing = (id: string): string | null => {
    let at: string | null = id;
    for (let step = 0; at !== null && step <= board.nodes.length; step += 1) {
      if (visible.has(at)) return at;
      at = parent.get(at) ?? null;
    }
    return null;
  };
  const lines = new Map<string, DrawnLink>();
  const inside = new Map<string, number>();
  // A link to a card outside the mini map being shown is counted on the card
  // that is here, so opening a branch never makes a connection look lost.
  const outside = new Map<string, number>();
  for (const link of linksOf(board)) {
    if (hidden.has(link.type)) continue;
    const from = standing(link.fromId as string);
    const to = standing(link.toId as string);
    if (!from || !to) {
      const here = from ?? to;
      if (here) outside.set(here, (outside.get(here) ?? 0) + 1);
      continue;
    }
    const aggregated = from !== link.fromId || to !== link.toId;
    if (from === to) {
      inside.set(from, (inside.get(from) ?? 0) + 1);
      continue;
    }
    const key = `${from}>${to}`;
    const line = lines.get(key) ?? { fromId: from, toId: to, links: [], aggregated: false };
    line.links.push(link);
    line.aggregated = line.aggregated || aggregated;
    lines.set(key, line);
  }
  return { lines: [...lines.values()], inside, outside };
};

// ----------------------------------------------------------- search (§11)

export interface SculptHit {
  node: SculptorNode;
  title: string;
  /** The titles above it, top first. */
  path: string[];
}

/** Every card whose title, note, details or type matches, folded or not, with where it is. */
export const searchBoard = (file: ProjectFile, board: Board, query: string): SculptHit[] => {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [];
  return board.nodes
    .filter((node) =>
      [titleOf(file, board, node), node.note, sculptTypeName(node.kind, node.subtype), ...Object.values(node.fields ?? {})].some((text) =>
        text.toLowerCase().includes(wanted),
      ),
    )
    .map((node) => ({
      node,
      title: titleOf(file, board, node),
      path: ancestorsOf(board, node.id).map((one) => titleOf(file, board, one) || sculptTypeName(one.kind, one.subtype)),
    }))
    .sort((a, b) => a.path.length - b.path.length || a.title.localeCompare(b.title));
};

// ---------------------------------------------------------- saved views

export const saveView = (file: ProjectFile, boardId: BoardId, name: string): { file: ProjectFile; viewId: SculptorViewId | null } => {
  const board = findBoard(file, boardId);
  if (!board) return { file, viewId: null };
  const view: SculptorSavedView = {
    id: newId<SculptorViewId>(),
    name: name.trim() || `View ${(board.views ?? []).length + 1}`,
    state: viewStateOf(board),
    layout: { ...(board.layout ?? {}) },
  };
  return { file: withBoard(file, boardId, (current) => ({ ...current, views: [...(current.views ?? []), view] })), viewId: view.id };
};

export const applyView = (file: ProjectFile, boardId: BoardId, viewId: SculptorViewId): ProjectFile =>
  withBoard(file, boardId, (board) => {
    const view = (board.views ?? []).find((one) => one.id === viewId);
    if (!view) return board;
    const ids = new Set(board.nodes.map((node) => node.id as string));
    const layout = Object.fromEntries(Object.entries(view.layout).filter(([id]) => ids.has(id)));
    return { ...board, viewState: { ...view.state, rootId: view.state.rootId && ids.has(view.state.rootId) ? view.state.rootId : null }, layout };
  });

export const removeView = (file: ProjectFile, boardId: BoardId, viewId: SculptorViewId): ProjectFile =>
  withBoard(file, boardId, (board) => ({ ...board, views: (board.views ?? []).filter((one) => one.id !== viewId) }));

/** The cast, as the library lists it (only the living). */
export const castForLibrary = (file: ProjectFile) => onlyLiving(file.characters);
