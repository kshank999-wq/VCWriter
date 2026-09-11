import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { initialOrderKeys, orderKeyBetween } from './ordering.js';
import {
  boardSchema,
  type Board,
  type SculptorColumn,
  type SculptorColumnKind,
  type SculptorField,
  type SculptorFieldKind,
  type SculptorLink,
  type SculptorNode,
} from './entities/sculptor.js';
import { retitleScript } from './planning.js';
import type { ProjectFile } from './project-file.js';
import type {
  BoardId,
  SculptorColumnId,
  SculptorFieldId,
  SculptorLinkId,
  SculptorNodeId,
} from './ids.js';

/**
 * The Story Sculptor (addendum 03), stages 1–6.
 *
 * **A flat outline asks a writer to know the shape of the story before they
 * have found it.** This is the other way round: fix a frame — this is where
 * it starts, this is where it ends — and then add the big blocks of clay to
 * it, then smaller ones, then the detail. Nothing insists you know the next
 * level down before you have finished this one.
 *
 * Story time runs down and detail runs right. Nothing here holds a position:
 * §4's one rule measures the whole diagram, which is what makes overlapping
 * impossible rather than merely unlikely.
 */

// ------------------------------------------------------------ the board

/** What the first three columns are called before the writer renames them. */
const FIRST_COLUMNS: { name: string; kind: SculptorColumnKind }[] = [
  { name: 'Structure', kind: 'structure' },
  { name: 'Scenes', kind: 'scene' },
  { name: 'Beats', kind: 'beat' },
];

/**
 * A new board: three columns, and the two nodes a board cannot be without.
 *
 * **No template is offered** (§11). Beginning and End are real, editable
 * nodes with nothing in them, and a board with one block between them is a
 * valid board.
 */
export const createBoard = (file: ProjectFile, input: { name?: string } = {}): { file: ProjectFile; board: Board } => {
  const boardId = newId<BoardId>();
  const at = nowIso();
  const columnKeys = initialOrderKeys(FIRST_COLUMNS.length);
  const columns: SculptorColumn[] = FIRST_COLUMNS.map((column, index) => ({
    id: newId<SculptorColumnId>(),
    name: column.name,
    kind: column.kind,
    orderKey: columnKeys[index] as string,
    fields: [],
  }));

  const structure = columns[0] as SculptorColumn;
  const endKeys = initialOrderKeys(2);
  const ends: SculptorNode[] = (['beginning', 'end'] as const).map((end, index) => ({
    id: newId<SculptorNodeId>(),
    boardId,
    columnId: structure.id,
    parentId: null,
    orderKey: endKeys[index] as string,
    title: end === 'beginning' ? 'Beginning' : 'End',
    note: '',
    kind: 'structure',
    colour: '',
    fields: {},
    end,
    collapsed: false,
    boundUnitId: null,
    boundBeatId: null,
    createdAt: at,
    updatedAt: at,
  }));

  const board = boardSchema.parse({
    id: boardId,
    projectId: file.project.id,
    name: input.name ?? 'Board',
    columns,
    nodes: ends,
    createdAt: at,
    updatedAt: at,
  });

  return { file: { ...file, boards: [...(file.boards ?? []), board] }, board };
};

export const boardsOf = (file: ProjectFile): Board[] => file.boards ?? [];

export const findBoard = (file: ProjectFile, boardId: BoardId): Board | null =>
  boardsOf(file).find((board) => board.id === boardId) ?? null;

const touch = <T extends { updatedAt: string }>(row: T): T => ({ ...row, updatedAt: nowIso() });

const withBoard = (file: ProjectFile, boardId: BoardId, change: (board: Board) => Board): ProjectFile => {
  const board = findBoard(file, boardId);
  if (!board) return file;
  const next = touch(change(board));
  return {
    ...file,
    boards: boardsOf(file).map((candidate) => (candidate.id === boardId ? next : candidate)),
    project: { ...file.project, updatedAt: nowIso() },
  };
};

// ----------------------------------------------------------- reading it

const byOrder = (a: { orderKey: string }, b: { orderKey: string }): number =>
  a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0;

export const columnsOf = (board: Board): SculptorColumn[] => [...board.columns].sort(byOrder);

/**
 * The structure column's chain, Beginning first and End last (§2).
 *
 * The two ends are held at the ends whatever their keys say, because they are
 * the frame: a block added "after End" would otherwise be after the end of
 * the story, which is not a thing a board can mean.
 */
export const blocksOf = (board: Board): SculptorNode[] => {
  const structure = columnsOf(board)[0];
  if (!structure) return [];
  const blocks = board.nodes.filter((node) => node.columnId === structure.id).sort(byOrder);
  const beginning = blocks.filter((node) => node.end === 'beginning');
  const end = blocks.filter((node) => node.end === 'end');
  const between = blocks.filter((node) => node.end === null);
  return [...beginning, ...between, ...end];
};

/** A node's children: the nodes in the next column that hang off it (§3). */
export const childrenOf = (board: Board, parentId: SculptorNodeId): SculptorNode[] =>
  board.nodes.filter((node) => node.parentId === parentId).sort(byOrder);

export const findNode = (board: Board, nodeId: SculptorNodeId): SculptorNode | null =>
  board.nodes.find((node) => node.id === nodeId) ?? null;

/** Which column a node is in, counting from zero at the structure. */
export const columnIndexOf = (board: Board, node: SculptorNode): number =>
  columnsOf(board).findIndex((column) => column.id === node.columnId);

// ---------------------------------------------------------- the layout

/**
 * The canvas's own unit: one row, the height of a node with nothing under it.
 *
 * **Canvas units in the model, pixels in the view** (§4, §14.2). The shape
 * belongs to the story; the size belongs to the screen, so the renderer turns
 * a unit into pixels at the current zoom and nothing here knows about either.
 */
export const ROW = 1;
/** Between two siblings, so a stack reads as a stack. */
export const GAP = 0.3;
/**
 * A column's width, and the air between one column and the next.
 *
 * Six rather than four because a block carries a sentence — *a woman who will
 * not ask for help* — and a card that clips it is a card the writer cannot
 * read their own story off.
 */
export const COLUMN_WIDTH = 6;
export const COLUMN_GAP = 1.6;

export interface LaidNode {
  node: SculptorNode;
  /** Which column, counting from zero. */
  column: number;
  x: number;
  y: number;
  width: number;
  /** The whole subtree: as tall as its children, and no shorter than itself. */
  height: number;
  /** The node's own card, which is one row whatever hangs off it. */
  headHeight: number;
  /** How many nodes hang off it, so a folded one can say what it is hiding. */
  childCount: number;
}

export interface LaidColumn {
  column: SculptorColumn;
  index: number;
  x: number;
  width: number;
}

export interface BoardLayout {
  nodes: LaidNode[];
  columns: LaidColumn[];
  width: number;
  height: number;
}

/**
 * §4, and the whole of the layout:
 *
 * > **A node is as tall as its children, and no shorter than itself.**
 *
 * Applied recursively it produces the entire diagram. A beat is one row; a
 * scene is as tall as its beats; the gap between two structure nodes is as
 * tall as the scenes stacked beside it. Adding a beat grows its scene and
 * pushes what is below down the canvas, and **nothing ever overlaps, because
 * nothing is positioned — everything is measured.**
 *
 * A folded node is one row tall and its children are not laid out at all,
 * which compresses them and keeps their order (§4).
 */
export const boardLayout = (board: Board): BoardLayout => {
  const columns = columnsOf(board);
  const laid: LaidNode[] = [];

  const xOf = (index: number) => index * (COLUMN_WIDTH + COLUMN_GAP);

  /** Lay a node and its subtree out from `top`, and answer how tall it came to. */
  const place = (node: SculptorNode, columnIndex: number, top: number): number => {
    const children = node.collapsed ? [] : childrenOf(board, node.id);

    let below = top;
    for (const [index, child] of children.entries()) {
      if (index > 0) below += GAP;
      below += place(child, columnIndex + 1, below);
    }

    const stacked = below - top;
    const height = Math.max(ROW, stacked);
    laid.push({
      node,
      column: columnIndex,
      x: xOf(columnIndex),
      y: top,
      width: COLUMN_WIDTH,
      height,
      headHeight: ROW,
      childCount: childrenOf(board, node.id).length,
    });
    return height;
  };

  let top = 0;
  for (const [index, block] of blocksOf(board).entries()) {
    if (index > 0) top += GAP;
    top += place(block, 0, top);
  }

  return {
    nodes: laid,
    columns: columns.map((column, index) => ({
      column,
      index,
      x: xOf(index),
      width: COLUMN_WIDTH,
    })),
    width: columns.length === 0 ? 0 : xOf(columns.length - 1) + COLUMN_WIDTH,
    height: top,
  };
};

// ---------------------------------------------------------- writing it

const madeNode = (input: {
  boardId: BoardId;
  columnId: SculptorColumnId;
  parentId: SculptorNodeId | null;
  orderKey: string;
  title: string;
  kind: string;
}): SculptorNode => {
  const at = nowIso();
  return {
    id: newId<SculptorNodeId>(),
    boardId: input.boardId,
    columnId: input.columnId,
    parentId: input.parentId,
    orderKey: input.orderKey,
    title: input.title,
    note: '',
    kind: input.kind,
    colour: '',
    fields: {},
    end: null,
    collapsed: false,
    boundUnitId: null,
    boundBeatId: null,
    createdAt: at,
    updatedAt: at,
  };
};

/** A key that puts a new row between two others, or at one end of them. */
const keyAfter = (siblings: readonly SculptorNode[], afterId: SculptorNodeId | null): string => {
  if (siblings.length === 0) return initialOrderKeys(1)[0] as string;
  if (afterId === null) return orderKeyBetween(null, siblings[0]?.orderKey ?? null);
  const at = siblings.findIndex((node) => node.id === afterId);
  if (at === -1) return orderKeyBetween(siblings[siblings.length - 1]?.orderKey ?? null, null);
  return orderKeyBetween(siblings[at]?.orderKey ?? null, siblings[at + 1]?.orderKey ?? null);
};

/**
 * A block in the structure column, between the ends (§2).
 *
 * It lands after the block named, or after Beginning when none is — which is
 * where a writer putting in their first shape means it to go. **Never after
 * End**: the frame holds.
 */
export const addBlock = (
  file: ProjectFile,
  boardId: BoardId,
  input: { afterNodeId?: SculptorNodeId | null; title?: string } = {},
): { file: ProjectFile; nodeId: SculptorNodeId | null } => {
  const board = findBoard(file, boardId);
  const structure = board ? columnsOf(board)[0] : undefined;
  if (!board || !structure) return { file, nodeId: null };

  const chain = blocksOf(board);
  // The ends are not candidates to land after — except Beginning, which is
  // exactly where a first block goes.
  const between = chain.filter((node) => node.end === null);
  const after = input.afterNodeId ?? null;
  const afterEnd = after !== null && findNode(board, after)?.end === 'end';

  let orderKey: string;
  if (after === null || afterEnd || findNode(board, after)?.end === 'beginning') {
    // After Beginning, or unsaid: the head of the middle.
    orderKey = afterEnd
      ? orderKeyBetween(between[between.length - 1]?.orderKey ?? null, null)
      : orderKeyBetween(null, between[0]?.orderKey ?? null);
  } else {
    orderKey = keyAfter(between, after);
  }

  const node = madeNode({
    boardId,
    columnId: structure.id,
    parentId: null,
    orderKey,
    title: input.title ?? '',
    kind: structure.kind,
  });

  return {
    file: withBoard(file, boardId, (current) => ({ ...current, nodes: [...current.nodes, node] })),
    nodeId: node.id,
  };
};

/**
 * A node hung off a parent, in the column after the parent's (§3).
 *
 * Where the parent is in the last column there is nowhere to put it, and
 * nothing happens — columns beyond the third are stage 5's.
 */
export const addChild = (
  file: ProjectFile,
  boardId: BoardId,
  parentId: SculptorNodeId,
  input: { afterNodeId?: SculptorNodeId | null; title?: string } = {},
): { file: ProjectFile; nodeId: SculptorNodeId | null } => {
  const board = findBoard(file, boardId);
  const parent = board ? findNode(board, parentId) : null;
  if (!board || !parent) return { file, nodeId: null };

  const columns = columnsOf(board);
  const next = columns[columnIndexOf(board, parent) + 1];
  if (!next) return { file, nodeId: null };

  const siblings = childrenOf(board, parentId);
  const node = madeNode({
    boardId,
    columnId: next.id,
    parentId,
    orderKey: keyAfter(siblings, input.afterNodeId ?? (siblings[siblings.length - 1]?.id ?? null)),
    title: input.title ?? '',
    kind: next.kind,
  });

  return {
    file: withBoard(file, boardId, (current) => ({ ...current, nodes: [...current.nodes, node] })),
    nodeId: node.id,
  };
};

/**
 * What a node says, and what it is. Anything not given is left alone.
 *
 * Retitling a **bound** node retitles the scene or beat it is (§6): they are
 * one object, so there is no version of this where the card and the script
 * say different things.
 */
export const updateNode = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
  patch: Partial<Pick<SculptorNode, 'title' | 'note' | 'kind' | 'colour' | 'collapsed'>>,
): ProjectFile => {
  const board = findBoard(file, boardId);
  const before = board ? findNode(board, nodeId) : null;
  const next = withBoard(file, boardId, (current) => ({
    ...current,
    nodes: current.nodes.map((node) => (node.id === nodeId ? touch({ ...node, ...patch }) : node)),
  }));
  if (patch.title === undefined || !before) return next;
  if (before.boundUnitId !== null) return retitleScript(next, { unitId: before.boundUnitId }, patch.title);
  if (before.boundBeatId !== null) return retitleScript(next, { beatId: before.boundBeatId }, patch.title);
  return next;
};

/**
 * A node, and everything hanging off it, taken off the board.
 *
 * **Beginning and End cannot go** (§2): they are the only two nodes a board
 * cannot be without. Nothing in the script is touched — a node is an idea
 * until the writer binds it, and binding is stage 6.
 */
export const removeNode = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId): ProjectFile => {
  const board = findBoard(file, boardId);
  const node = board ? findNode(board, nodeId) : null;
  if (!board || !node || node.end !== null) return file;

  const doomed = new Set<string>([nodeId as string]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const candidate of board.nodes) {
      if (candidate.parentId !== null && doomed.has(candidate.parentId as string) && !doomed.has(candidate.id as string)) {
        doomed.add(candidate.id as string);
        grew = true;
      }
    }
  }

  return withBoard(file, boardId, (current) => ({
    ...current,
    nodes: current.nodes.filter((candidate) => !doomed.has(candidate.id as string)),
    // An observation about a card that is gone has no ends to be drawn
    // between; the link goes with it, and nothing else does (§7).
    links: (current.links ?? []).filter(
      (link) => !doomed.has(link.fromId as string) && !doomed.has(link.toId as string),
    ),
  }));
};

/**
 * A node moved one place among its siblings.
 *
 * It moves nothing but the node (§11): an unbound node is an idea, and the
 * script does not know it exists. The ends do not move, and nothing moves
 * past them.
 */
export const moveNode = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
  direction: -1 | 1,
): ProjectFile => {
  const board = findBoard(file, boardId);
  const node = board ? findNode(board, nodeId) : null;
  if (!board || !node || node.end !== null) return file;

  const siblings =
    node.parentId === null ? blocksOf(board).filter((candidate) => candidate.end === null) : childrenOf(board, node.parentId);
  const at = siblings.findIndex((candidate) => candidate.id === nodeId);
  const to = at + direction;
  if (at === -1 || to < 0 || to >= siblings.length) return file;

  // Between the one it is swapping with and whatever is on that one's far side.
  const before = direction === 1 ? siblings[to]?.orderKey ?? null : siblings[to - 1]?.orderKey ?? null;
  const after = direction === 1 ? siblings[to + 1]?.orderKey ?? null : siblings[to]?.orderKey ?? null;

  return withBoard(file, boardId, (current) => ({
    ...current,
    nodes: current.nodes.map((candidate) =>
      candidate.id === nodeId ? touch({ ...candidate, orderKey: orderKeyBetween(before, after) }) : candidate,
    ),
  }));
};

/**
 * A column to the right of the last one, **without limit** (§3).
 *
 * Character arcs, plot arcs, reveals, setups, research, questions to answer —
 * whatever the next level of detail is. It arrives empty, and what it asks of
 * the nodes in it is the writer's to say (§5).
 */
export const addColumn = (
  file: ProjectFile,
  boardId: BoardId,
  input: { name?: string } = {},
): { file: ProjectFile; columnId: SculptorColumnId | null } => {
  const board = findBoard(file, boardId);
  if (!board) return { file, columnId: null };

  const existing = columnsOf(board);
  const column: SculptorColumn = {
    id: newId<SculptorColumnId>(),
    name: input.name ?? '',
    kind: 'custom',
    orderKey: orderKeyBetween(existing[existing.length - 1]?.orderKey ?? null, null),
    fields: [],
  };

  return {
    file: withBoard(file, boardId, (current) => ({ ...current, columns: [...current.columns, column] })),
    columnId: column.id,
  };
};

/**
 * A column taken off the board, with everything in it.
 *
 * **Only the last one can go.** Removing a column from the middle would leave
 * the column to its right hanging off parents that no longer exist, and a
 * board with orphans in it is a board that cannot be drawn. The first three
 * stay: a board without structure, scenes and beats is not the thing §3
 * describes.
 */
export const removeColumn = (file: ProjectFile, boardId: BoardId, columnId: SculptorColumnId): ProjectFile => {
  const board = findBoard(file, boardId);
  if (!board) return file;
  const columns = columnsOf(board);
  const last = columns[columns.length - 1];
  if (!last || last.id !== columnId || columns.length <= FIRST_COLUMNS.length) return file;

  const leaving = new Set(
    board.nodes.filter((node) => node.columnId === columnId).map((node) => node.id as string),
  );

  return withBoard(file, boardId, (current) => ({
    ...current,
    columns: current.columns.filter((column) => column.id !== columnId),
    nodes: current.nodes.filter((node) => node.columnId !== columnId),
    links: (current.links ?? []).filter(
      (link) => !leaving.has(link.fromId as string) && !leaving.has(link.toId as string),
    ),
  }));
};

/**
 * A question this column asks of everything in it (§5).
 *
 * Defined on the column rather than on the node, so a writer who wants a
 * before-and-after on their character arcs has it on every one of them, and a
 * writer who does not is never shown the boxes.
 */
export const addColumnField = (
  file: ProjectFile,
  boardId: BoardId,
  columnId: SculptorColumnId,
  input: { name?: string; kind?: SculptorFieldKind } = {},
): { file: ProjectFile; fieldId: SculptorFieldId | null } => {
  const board = findBoard(file, boardId);
  const column = board ? columnsOf(board).find((candidate) => candidate.id === columnId) : undefined;
  if (!board || !column) return { file, fieldId: null };

  const fields = fieldsOf(column);
  const field: SculptorField = {
    id: newId<SculptorFieldId>(),
    name: input.name ?? '',
    kind: input.kind ?? 'line',
    orderKey: orderKeyBetween(fields[fields.length - 1]?.orderKey ?? null, null),
  };

  return {
    file: withBoard(file, boardId, (current) => ({
      ...current,
      columns: current.columns.map((candidate) =>
        candidate.id === columnId ? { ...candidate, fields: [...candidate.fields, field] } : candidate,
      ),
    })),
    fieldId: field.id,
  };
};

export const renameColumnField = (
  file: ProjectFile,
  boardId: BoardId,
  columnId: SculptorColumnId,
  fieldId: SculptorFieldId,
  name: string,
): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    columns: board.columns.map((column) =>
      column.id === columnId
        ? { ...column, fields: column.fields.map((field) => (field.id === fieldId ? { ...field, name } : field)) }
        : column,
    ),
  }));

/**
 * A question taken off a column, and the answers to it with it.
 *
 * The answers go because they were answers to *that* question; leaving them
 * keyed to a field nobody can see would be leaving the board carrying text
 * the writer has no way to read.
 */
export const removeColumnField = (
  file: ProjectFile,
  boardId: BoardId,
  columnId: SculptorColumnId,
  fieldId: SculptorFieldId,
): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    columns: board.columns.map((column) =>
      column.id === columnId ? { ...column, fields: column.fields.filter((field) => field.id !== fieldId) } : column,
    ),
    nodes: board.nodes.map((node) => {
      if (node.columnId !== columnId || !(fieldId in node.fields)) return node;
      const { [fieldId as string]: gone, ...rest } = node.fields;
      void gone;
      return touch({ ...node, fields: rest });
    }),
  }));

/** A node's answer to one of its column's questions. */
export const setNodeField = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
  fieldId: SculptorFieldId,
  value: string,
): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    nodes: board.nodes.map((node) =>
      node.id === nodeId ? touch({ ...node, fields: { ...node.fields, [fieldId as string]: value } }) : node,
    ),
  }));

/** A column's questions, in the order they were asked. */
export const fieldsOf = (column: SculptorColumn): SculptorField[] => [...column.fields].sort(byOrder);

/** The column a node is in, for the detail panel's sake. */
export const columnOf = (board: Board, node: SculptorNode): SculptorColumn | null =>
  columnsOf(board).find((column) => column.id === node.columnId) ?? null;

/** The column's own name, which is the writer's (§3). */
export const renameColumn = (
  file: ProjectFile,
  boardId: BoardId,
  columnId: SculptorColumnId,
  name: string,
): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    columns: board.columns.map((column) => (column.id === columnId ? { ...column, name } : column)),
  }));

export const renameBoard = (file: ProjectFile, boardId: BoardId, name: string): ProjectFile =>
  withBoard(file, boardId, (board) => ({ ...board, name }));

/** How much of the board is still an idea, for the badge count (§6). */
export const boardTally = (board: Board): { nodes: number; bound: number } => ({
  nodes: board.nodes.length,
  bound: board.nodes.filter((node) => node.boundUnitId !== null || node.boundBeatId !== null).length,
});

// ------------------------------------ the writer's own connections (§7)

/**
 * Any node to any node, with a label the writer types.
 *
 * **A pair is connected or it is not.** Drawing the same pair twice is the
 * same observation twice, so a second attempt does nothing whichever way round
 * it is asked — and the direction, which is the observation (*this* sets up
 * *that*), is changed with `flipLink` rather than by drawing the reverse.
 *
 * A node cannot be linked to itself: a line from a card back to the same card
 * says nothing a writer could read.
 */
export const linkNodes = (
  file: ProjectFile,
  boardId: BoardId,
  fromId: SculptorNodeId,
  toId: SculptorNodeId,
  input: { label?: string } = {},
): { file: ProjectFile; linkId: SculptorLinkId | null } => {
  const board = findBoard(file, boardId);
  if (!board || fromId === toId) return { file, linkId: null };
  if (!findNode(board, fromId) || !findNode(board, toId)) return { file, linkId: null };
  if (linkBetween(board, fromId, toId)) return { file, linkId: null };

  const at = nowIso();
  const link: SculptorLink = {
    id: newId<SculptorLinkId>(),
    fromId,
    toId,
    label: input.label ?? '',
    createdAt: at,
    updatedAt: at,
  };

  return {
    file: withBoard(file, boardId, (current) => ({ ...current, links: [...linksOf(current), link] })),
    linkId: link.id,
  };
};

/** Every connection the writer drew, oldest first. */
export const linksOf = (board: Board): SculptorLink[] => board.links ?? [];

/** The link joining these two, whichever way round it was drawn. */
export const linkBetween = (board: Board, a: SculptorNodeId, b: SculptorNodeId): SculptorLink | null =>
  linksOf(board).find(
    (link) => (link.fromId === a && link.toId === b) || (link.fromId === b && link.toId === a),
  ) ?? null;

/** What this node is connected to, in either direction (§9). */
export const linksTouching = (board: Board, nodeId: SculptorNodeId): SculptorLink[] =>
  linksOf(board).filter((link) => link.fromId === nodeId || link.toId === nodeId);

/** What the writer noticed, in their own words. */
export const relabelLink = (
  file: ProjectFile,
  boardId: BoardId,
  linkId: SculptorLinkId,
  label: string,
): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    links: linksOf(board).map((link) => (link.id === linkId ? touch({ ...link, label }) : link)),
  }));

/**
 * The other way round, keeping the label.
 *
 * *This setup pays off here* and *this is the payoff of that* are the same
 * observation seen from either end, so turning the arrow is an edit rather
 * than a second link.
 */
export const flipLink = (file: ProjectFile, boardId: BoardId, linkId: SculptorLinkId): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    links: linksOf(board).map((link) =>
      link.id === linkId ? touch({ ...link, fromId: link.toId, toId: link.fromId }) : link,
    ),
  }));

/**
 * A connection removed, and **nothing else** (§7).
 *
 * A connector is never what holds two things together; the parent relation is.
 * So this loses the observation and not one thing more, and nothing on the
 * board moves.
 */
export const unlinkNodes = (file: ProjectFile, boardId: BoardId, linkId: SculptorLinkId): ProjectFile =>
  withBoard(file, boardId, (board) => ({
    ...board,
    links: linksOf(board).filter((link) => link.id !== linkId),
  }));

/**
 * Which card stands for a node on the drawn canvas.
 *
 * A folded node's children are not laid out at all (§4), so a link into a fold
 * has no end to be drawn to. Rather than dropping the line — which would make
 * folding look like losing something — it is drawn to the folded ancestor that
 * is standing in for it, which is exactly what the writer is looking at.
 */
export const standingFor = (board: Board, layout: BoardLayout, nodeId: SculptorNodeId): LaidNode | null => {
  const drawn = new Map(layout.nodes.map((laid) => [laid.node.id as string, laid]));
  let node = findNode(board, nodeId);
  // The chain of parents is finite and acyclic, but a hand-edited file need
  // not be: count the steps rather than trusting it.
  for (let step = 0; node && step <= board.nodes.length; step += 1) {
    const here = drawn.get(node.id as string);
    if (here) return here;
    node = node.parentId ? findNode(board, node.parentId) : null;
  }
  return null;
};
