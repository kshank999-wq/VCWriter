import {
  addChild,
  childrenOf,
  columnIndexOf,
  columnsOf,
  findBoard,
  findNode,
  updateNode,
} from './sculptor.js';
import { addItem, findOutline, findOutlineItem, outlineChildren, updateItem } from './outline.js';
import type { ProjectFile } from './project-file.js';
import type { BoardId, OutlineId, OutlineItemId, SculptorNodeId } from './ids.js';

/**
 * Passing material between the board and the outline (addendum 06 §2, §12
 * stage 7).
 *
 * **By hand, never wholesale.** Ken's reason, in his words: *it'll be a messy
 * process to try to create a mind map into an outline*. A board is a picture
 * of possibilities, most of which are not in the story; flattening the whole
 * of one would produce an outline nobody asked for and then ask the writer to
 * delete most of it. So there is no *Convert* anything, and there will not be:
 * what there is is a card, and its subtree, carried across to start the
 * organisation off.
 *
 * Three rules hold in both directions.
 *
 * **The drop decides the depth.** A node carried into the outline lands under
 * the row it was dropped on; a row carried onto the board hangs off the node
 * it was dropped on, in the column after it. Neither carries its old depth,
 * because depth means something different on each side — a column over there,
 * a parent over here — and the writer is choosing where it goes by where they
 * let go of it.
 *
 * **What it says comes with it; what it *is* does not.** The title travels,
 * and so does the note or the body, because those are the writer's words. The
 * binding does not: a scene in the script is claimed by exactly one plan
 * (`planning.ts`), so a copy arrives as a plan of its own rather than a second
 * claim on the same scene. Nor does a research reference, because the board
 * has nothing to hold one in — the name is kept, the link is not.
 *
 * **Nothing leaves where it came from.** This is a copy in both directions.
 * The board still has its node afterwards, and the outline still has its row.
 */

/**
 * What a node becomes in the outline.
 *
 * Scenes and beats are the two the outline has by the same names. Everything
 * else — a structure block, a card in a column the writer invented — arrives
 * as a **Note**, the type that claims least about what a thing is. A block
 * dragged across therefore brings its scenes with it as scenes, under a note
 * saying what that part of the story is, which is what the board was saying.
 */
const ROW_KIND: Record<string, string> = { scene: 'scene', beat: 'beat' };

/**
 * A node and everything under it, copied into the outline (§2).
 *
 * `under` is the row it was dropped on, or null for the top of the outline.
 * The subtree keeps its shape and its order; each level goes one row deeper,
 * whatever column it was in.
 */
export const carryNodeToOutline = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
  outlineId: OutlineId,
  at: { under?: OutlineItemId | null; afterId?: OutlineItemId | null; beforeId?: OutlineItemId | null } = {},
): { file: ProjectFile; itemId: OutlineItemId | null } => {
  const board = findBoard(file, boardId);
  const outline = findOutline(file, outlineId);
  const node = board ? findNode(board, nodeId) : null;
  if (!board || !outline || !node) return { file, itemId: null };

  const under = at.under ?? null;
  if (under !== null && !findOutlineItem(outline, under)) return { file, itemId: null };

  let current = file;
  let top: OutlineItemId | null = null;

  const carry = (
    from: typeof node,
    parentId: OutlineItemId | null,
    where: { afterId?: OutlineItemId | null; beforeId?: OutlineItemId | null },
  ): void => {
    const made = addItem(current, outlineId, {
      parentId,
      ...where,
      kind: ROW_KIND[from.kind] ?? 'note',
      title: from.title,
    });
    current = made.file;
    if (!made.itemId) return;
    if (top === null) top = made.itemId;
    // The note is the writer's words about it, so it travels as the body.
    if (from.note.trim().length > 0) {
      current = updateItem(current, outlineId, made.itemId, { body: from.note });
    }
    // Read the board from the file being written to, so a subtree copied in
    // one go sees the same board throughout.
    const live = findBoard(current, boardId);
    if (!live) return;
    for (const child of childrenOf(live, from.id)) carry(child, made.itemId, {});
  };

  carry(node, under, { afterId: at.afterId ?? null, beforeId: at.beforeId });
  return { file: current, itemId: top };
};

/**
 * A row and everything under it, copied onto the board (§2).
 *
 * `under` is the node it was dropped on, and the copy hangs off it in the
 * column after — exactly as a node added by hand does. A subtree deeper than
 * the board has columns **stops at the last one**: `addChild` refuses to put a
 * node where there is no column for it, and the right answer to that is to
 * carry across what fits rather than to invent columns the writer did not ask
 * for. The rows that did not fit are counted, so the panel can say so.
 */
export const carryRowToBoard = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  boardId: BoardId,
  under: SculptorNodeId,
): { file: ProjectFile; nodeId: SculptorNodeId | null; leftBehind: number } => {
  const outline = findOutline(file, outlineId);
  const board = findBoard(file, boardId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  const parent = board ? findNode(board, under) : null;
  if (!outline || !board || !item || !parent) return { file, nodeId: null, leftBehind: 0 };

  let current = file;
  let top: SculptorNodeId | null = null;
  let leftBehind = 0;

  const carry = (from: typeof item, parentId: SculptorNodeId): void => {
    const made = addChild(current, boardId, parentId, { title: from.title });
    if (!made.nodeId) {
      // No column to the right of the parent: everything from here down stays
      // in the outline, and is counted rather than silently dropped.
      leftBehind += 1 + outlineChildren(outline, from.id).length;
      return;
    }
    current = made.file;
    if (top === null) top = made.nodeId;
    if (from.body.trim().length > 0) {
      current = updateNode(current, boardId, made.nodeId, { note: from.body });
    }
    const live = findOutline(current, outlineId);
    if (!live) return;
    for (const child of outlineChildren(live, from.id)) carry(child, made.nodeId);
  };

  carry(item, under);
  return { file: current, nodeId: top, leftBehind };
};

/**
 * Whether there is anywhere on the board for a row to land under this node.
 *
 * The board runs out of columns, and a drop that cannot happen should not be
 * offered — the indicator says what will happen, and a card at the last
 * column has nothing to its right.
 */
export const canCarryToBoard = (file: ProjectFile, boardId: BoardId, under: SculptorNodeId): boolean => {
  const board = findBoard(file, boardId);
  const node = board ? findNode(board, under) : null;
  if (!board || !node) return false;
  return columnIndexOf(board, node) + 1 < columnsOf(board).length;
};
