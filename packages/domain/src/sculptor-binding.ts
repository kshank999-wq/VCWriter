import { addBeat, addUnit, moveUnit, moveBeat } from './mutations.js';
import { beatsForUnit, lanesInOrder, unitsInStoryOrder } from './selectors.js';
import { boardsOf, childrenOf, columnOf, findBoard, findNode } from './sculptor.js';
import { claimedInScript, retitleScript } from './planning.js';
import type { Board, SculptorNode } from './entities/sculptor.js';
import type { Beat, StructuralUnit } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, BoardId, SculptorNodeId, StructuralUnitId } from './ids.js';

/**
 * Binding a node to the script (addendum 03 §6), stage 6.
 *
 * **A node is an idea until the writer says otherwise.** A scene node is a
 * scene you *think might work*: it is not in the script, not in the page
 * count, and deleting it costs nothing. When you decide it is real you bind
 * it, and from then on the two are one thing — rename it in either place and
 * it is renamed in both.
 *
 * This is its own file because it is the one place the board and the script
 * meet. `sculptor.ts` is the diagram and knows nothing about scenes;
 * `mutations.ts` is the script and knows nothing about boards. Everything
 * that has to know both is here.
 */

/** What a node of this kind can be: a scene in the story, a beat in one, or nothing. */
export type BindKind = 'unit' | 'beat' | null;

/**
 * What a node can bind to, which is its **own** kind rather than its column's.
 *
 * A node takes its kind from the column it is made in and the writer can
 * change it (§5), so a node called a scene binds to a scene wherever on the
 * board it happens to sit. Structure blocks and the writer's own columns bind
 * to nothing: there is no object in the script for *Act II* or *Mara's arc* to
 * be the same thing as.
 */
export const bindKindOf = (node: SculptorNode): BindKind =>
  node.kind === 'scene' ? 'unit' : node.kind === 'beat' ? 'beat' : null;

/** The scene or beat a node **is**, resolved; null for an idea. */
export const boundOf = (
  file: ProjectFile,
  node: SculptorNode,
): { kind: 'unit'; unit: StructuralUnit } | { kind: 'beat'; beat: Beat } | null => {
  if (node.boundUnitId !== null) {
    const unit = file.units.find((candidate) => candidate.id === node.boundUnitId);
    return unit ? { kind: 'unit', unit } : null;
  }
  if (node.boundBeatId !== null) {
    const beat = file.beats.find((candidate) => candidate.id === node.boundBeatId);
    return beat ? { kind: 'beat', beat } : null;
  }
  return null;
};

export const isBound = (node: SculptorNode): boolean => node.boundUnitId !== null || node.boundBeatId !== null;

/** What a scene or beat is already spoken for by, this node excepted (§6). */
const claimed = (file: ProjectFile, exceptNodeId: SculptorNodeId | null) =>
  claimedInScript(file, exceptNodeId as string | null);

/** The scenes this node could be, in story order: every one not already spoken for. */
export const bindableUnits = (file: ProjectFile, nodeId: SculptorNodeId | null = null): StructuralUnit[] => {
  const taken = claimed(file, nodeId).units;
  return unitsInStoryOrder(file).filter((unit) => !taken.has(unit.id as string));
};

/**
 * The beats this node could be.
 *
 * Where its parent is bound to a scene, **only that scene's beats**: the
 * diagram says this beat is inside that scene, and offering a beat from
 * somewhere else would make the board say something it does not mean. Where
 * the parent is still an idea, every unclaimed beat is fair game.
 */
export const bindableBeats = (file: ProjectFile, board: Board, nodeId: SculptorNodeId): Beat[] => {
  const node = findNode(board, nodeId);
  if (!node) return [];
  const taken = claimed(file, nodeId).beats;
  const parent = node.parentId ? findNode(board, node.parentId) : null;
  const within = parent?.boundUnitId ?? null;
  const pool = within === null ? file.beats : beatsForUnit(file, within);
  return pool.filter((beat) => !taken.has(beat.id as string));
};

const writeNode = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
  patch: Partial<SculptorNode>,
): ProjectFile => {
  const board = findBoard(file, boardId);
  if (!board) return file;
  const at = new Date().toISOString();
  return {
    ...file,
    boards: boardsOf(file).map((candidate) =>
      candidate.id === boardId
        ? {
            ...candidate,
            nodes: candidate.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch, updatedAt: at } : node)),
            updatedAt: at,
          }
        : candidate,
    ),
    project: { ...file.project, updatedAt: at },
  };
};

/**
 * This node **is** that scene, or that beat.
 *
 * The node's title wins where it has one, because the writer typed it on the
 * card they are looking at; where the node is blank it takes the script's,
 * which is how binding to a scene that already has a name reads as recognising
 * it rather than wiping it.
 */
export const bindNode = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
  target: { unitId: StructuralUnitId } | { beatId: BeatId },
): ProjectFile => {
  const board = findBoard(file, boardId);
  const node = board ? findNode(board, nodeId) : null;
  if (!board || !node) return file;

  const taken = claimed(file, nodeId);

  if ('unitId' in target) {
    const unit = file.units.find((candidate) => candidate.id === target.unitId);
    if (!unit || taken.units.has(target.unitId as string) || bindKindOf(node) !== 'unit') return file;
    const title = node.title.trim() || unit.title;
    const bound = writeNode(file, boardId, nodeId, { boundUnitId: unit.id, boundBeatId: null, title });
    return retitleScript(bound, { unitId: unit.id }, title);
  }

  const beat = file.beats.find((candidate) => candidate.id === target.beatId);
  if (!beat || taken.beats.has(target.beatId as string) || bindKindOf(node) !== 'beat') return file;
  const title = node.title.trim() || beat.title;
  const bound = writeNode(file, boardId, nodeId, { boundUnitId: null, boundBeatId: beat.id, title });
  return retitleScript(bound, { beatId: beat.id }, title);
};

/**
 * Both stay, no longer joined (§6).
 *
 * The scene keeps its place in the script and everything written in it; the
 * node keeps its place on the canvas and goes back to being an idea. Unbinding
 * is not a deletion and never asks to be confirmed.
 */
export const unbindNode = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId): ProjectFile =>
  writeNode(file, boardId, nodeId, { boundUnitId: null, boundBeatId: null });

/**
 * Where a scene goes in the story, read off the canvas: **after the scene of
 * the nearest bound node above it, or before the nearest bound node below it,
 * and at the end when it has no bound neighbour either way.**
 *
 * Both directions matter. A node at the top of a stack has nothing above it,
 * and landing at the end of the script because of that would put the first
 * scene last — which is the opposite of what the diagram says.
 *
 * **Nothing already in the script moves** (§11): this only ever says where one
 * scene belongs, and a board with nothing bound yet simply appends.
 */
const indexAfterNeighbour = (
  node: SculptorNode,
  siblings: readonly SculptorNode[],
  positionOf: (id: string) => number,
  end: number,
): number => {
  const at = siblings.findIndex((candidate) => candidate.id === node.id);
  const positionAt = (index: number): number => {
    const other = siblings[index];
    const id = other ? ((other.boundUnitId ?? other.boundBeatId) as string | null) : null;
    return id === null ? -1 : positionOf(id);
  };

  for (let index = at - 1; index >= 0; index -= 1) {
    const position = positionAt(index);
    if (position >= 0) return position + 1;
  }
  for (let index = at + 1; index < siblings.length; index += 1) {
    const position = positionAt(index);
    if (position >= 0) return position;
  }
  return end;
};

/**
 * Make the idea real: a scene in the script, or a beat in one, bound to this
 * node from the moment it exists (§6, "binding either takes an existing scene
 * or makes one").
 *
 * A beat can only be made where its parent node is already a scene in the
 * script: a beat belongs to a scene/chapter container and never floats in a
 * lane (spec §19), so there is nowhere to put one whose scene is still an
 * idea. Nothing happens, and the caller says why.
 */
export const realiseNode = (
  file: ProjectFile,
  boardId: BoardId,
  nodeId: SculptorNodeId,
): { file: ProjectFile; unitId: StructuralUnitId | null; beatId: BeatId | null } => {
  const board = findBoard(file, boardId);
  const node = board ? findNode(board, nodeId) : null;
  if (!board || !node || isBound(node)) return { file, unitId: null, beatId: null };

  const kind = bindKindOf(node);
  const title = node.title.trim();

  if (kind === 'unit') {
    const lane = lanesInOrder(file)[0];
    // Without a lane there is no row to draw a scene in, and addUnit would
    // throw. A project always has one; a hand-edited file might not.
    if (!lane) return { file, unitId: null, beatId: null };

    const order = unitsInStoryOrder(file);
    const positionOf = (id: string) => order.findIndex((unit) => (unit.id as string) === id);
    const siblings = node.parentId === null ? [] : childrenOf(board, node.parentId);
    const index = indexAfterNeighbour(node, siblings, positionOf, order.length);

    const made = addUnit(file, { laneId: lane.id, title, index });
    return { file: writeNode(made.file, boardId, nodeId, { boundUnitId: made.unit.id }), unitId: made.unit.id, beatId: null };
  }

  if (kind === 'beat') {
    const parent = node.parentId ? findNode(board, node.parentId) : null;
    const unitId = parent?.boundUnitId ?? null;
    if (unitId === null) return { file, unitId: null, beatId: null };

    const order = beatsForUnit(file, unitId);
    const positionOf = (id: string) => order.findIndex((beat) => (beat.id as string) === id);
    const siblings = parent ? childrenOf(board, parent.id) : [];
    const index = indexAfterNeighbour(node, siblings, positionOf, order.length);

    const made = addBeat(file, { unitId, title, index });
    return { file: writeNode(made.file, boardId, nodeId, { boundBeatId: made.beat.id }), unitId, beatId: made.beat.id };
  }

  return { file, unitId: null, beatId: null };
};

// ------------------------------------------ when the two fall out of step

/**
 * A bound node whose neighbours on the canvas are in a different order in the
 * script (§11).
 *
 * Moving a node moves nothing but the node, always — the board never reorders
 * the script behind the writer's back. So instead the disagreement is said out
 * loud: *on the canvas this comes before that; in the script it comes after*.
 * The offer to fix it is one click and it is the writer's.
 */
export interface OutOfStep {
  /** The node that has moved out of step. */
  nodeId: SculptorNodeId;
  /** The sibling it disagrees with, by name, for the sentence. */
  otherTitle: string;
  /** True where the canvas puts this one first, which is what the script would become. */
  canvasFirst: boolean;
}

export const outOfStep = (file: ProjectFile, board: Board, nodeId: SculptorNodeId): OutOfStep | null => {
  const node = findNode(board, nodeId);
  if (!node || !isBound(node)) return null;

  const parent = node.parentId ? findNode(board, node.parentId) : null;
  const siblings = parent ? childrenOf(board, parent.id) : [];
  const at = siblings.findIndex((candidate) => candidate.id === nodeId);
  if (at === -1) return null;

  const order =
    node.boundUnitId !== null
      ? unitsInStoryOrder(file).map((unit) => unit.id as string)
      : parent?.boundUnitId
        ? beatsForUnit(file, parent.boundUnitId).map((beat) => beat.id as string)
        : file.beats.map((beat) => beat.id as string);

  const positionOf = (candidate: SculptorNode): number => {
    const id = (candidate.boundUnitId ?? candidate.boundBeatId) as string | null;
    return id === null ? -1 : order.indexOf(id);
  };

  const mine = positionOf(node);
  if (mine === -1) return null;

  // The nearest bound sibling on either side is the one the sentence is about:
  // a disagreement with something three cards away is not what a writer sees.
  for (const step of [-1, 1] as const) {
    for (let index = at + step; index >= 0 && index < siblings.length; index += step) {
      const other = siblings[index] as SculptorNode;
      const theirs = positionOf(other);
      if (theirs === -1) continue;
      const canvasFirst = step === 1;
      const scriptFirst = mine < theirs;
      if (canvasFirst !== scriptFirst) {
        return { nodeId, otherTitle: other.title.trim() || 'the one beside it', canvasFirst };
      }
      break;
    }
  }
  return null;
};

/**
 * Move the script to match the canvas, for one node, because the writer asked.
 *
 * The scene goes to the position its node has among its bound siblings, and
 * nothing else is touched. This is the only way the board ever changes the
 * story order, and it is always a click.
 */
export const followCanvas = (file: ProjectFile, boardId: BoardId, nodeId: SculptorNodeId): ProjectFile => {
  const board = findBoard(file, boardId);
  const node = board ? findNode(board, nodeId) : null;
  if (!board || !node || !isBound(node)) return file;

  const parent = node.parentId ? findNode(board, node.parentId) : null;
  const siblings = parent ? childrenOf(board, parent.id) : [];
  const at = siblings.findIndex((candidate) => candidate.id === nodeId);
  if (at === -1) return file;

  if (node.boundUnitId !== null) {
    const order = unitsInStoryOrder(file);
    const positionOf = (id: string) => order.findIndex((unit) => (unit.id as string) === id);
    // Where it goes: after the scene of the nearest bound node above it. The
    // index moveUnit wants counts every scene but this one, so a scene moving
    // down loses the place it is vacating.
    const target = indexAfterNeighbour(node, siblings, positionOf, order.length);
    const here = positionOf(node.boundUnitId as string);
    const index = here !== -1 && target > here ? target - 1 : target;
    const unit = file.units.find((candidate) => candidate.id === node.boundUnitId);
    if (!unit) return file;
    // Its own lane: the board says where a scene is in the story, never which
    // thread it belongs to (addendum 02 §8).
    return moveUnit(file, { unitId: node.boundUnitId, toLaneId: unit.laneId, index });
  }

  const unitId = parent?.boundUnitId ?? null;
  if (unitId === null || node.boundBeatId === null) return file;
  const order = beatsForUnit(file, unitId);
  const positionOf = (id: string) => order.findIndex((beat) => (beat.id as string) === id);
  const target = indexAfterNeighbour(node, siblings, positionOf, order.length);
  const here = positionOf(node.boundBeatId as string);
  const index = here !== -1 && target > here ? target - 1 : target;
  return moveBeat(file, { beatId: node.boundBeatId, toUnitId: unitId, index });
};

/** The column a node sits in, re-exported so the panel needs one import. */
export { columnOf };
