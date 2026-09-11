import { z } from 'zod';
import { id, orderKey, timestamps } from './common.js';
import type {
  BeatId,
  BoardId,
  ProjectId,
  SculptorColumnId,
  SculptorFieldId,
  SculptorNodeId,
  StructuralUnitId,
} from '../ids.js';

/**
 * The Story Sculptor's board (addendum 03).
 *
 * **A graph of its own nodes, some of which point at real scenes.** Not a
 * second view of the manuscript — that was the first draft's mistake, and
 * §14.1 says why: a scene node is a scene you *think might work*, and it is
 * not in the script, not in the page count, and costs nothing to delete.
 *
 * Story time runs down and detail runs right, so a node belongs to a column
 * and hangs off a parent in the column before it. Nothing here holds a
 * position: §4's one rule measures the whole diagram from the nodes and their
 * children, which is what makes overlapping impossible rather than merely
 * unlikely.
 */

/**
 * What a column is for. The first three are made with every board because
 * nearly every story wants them; everything after is the writer's own (§3).
 */
export const sculptorColumnKindSchema = z.enum(['structure', 'scene', 'beat', 'custom']);
export type SculptorColumnKind = z.infer<typeof sculptorColumnKindSchema>;

/**
 * A question a column asks of everything in it (§5).
 *
 * **A node is a title and a note.** Everything beyond that — a scene's POV,
 * its conflict, a character arc's before-and-after state — belongs to the
 * column rather than to the node, and is defined when the column is made. So
 * a writer who wants those columns has them, and one who does not is never
 * shown a form to fill in.
 */
export const sculptorFieldKindSchema = z.enum(['line', 'text']);
export type SculptorFieldKind = z.infer<typeof sculptorFieldKindSchema>;

export const sculptorFieldSchema = z.object({
  id: id<SculptorFieldId>(),
  name: z.string().default(''),
  /** A one-line answer, or somewhere to write at length. */
  kind: sculptorFieldKindSchema.default('line'),
  orderKey: orderKey(),
});
export type SculptorField = z.infer<typeof sculptorFieldSchema>;

export const sculptorColumnSchema = z.object({
  id: id<SculptorColumnId>(),
  /** The writer's, and renameable: what this level of detail is called. */
  name: z.string().default(''),
  kind: sculptorColumnKindSchema.default('custom'),
  /** Left to right; the first column is the structure. */
  orderKey: orderKey(),
  /** What this column asks of everything in it (§5). None, by default. */
  fields: z.array(sculptorFieldSchema).default([]),
});
export type SculptorColumn = z.infer<typeof sculptorColumnSchema>;

/**
 * Which of the two nodes a board cannot be without this is, if either (§2).
 *
 * Both are real, editable nodes — click either and type what the story begins
 * or ends as. Neither can be deleted, and they hold the ends of the structure
 * column whatever is put between them.
 */
export const sculptorEndSchema = z.enum(['beginning', 'end']);
export type SculptorEnd = z.infer<typeof sculptorEndSchema>;

export const sculptorNodeSchema = z.object({
  id: id<SculptorNodeId>(),
  boardId: id<BoardId>(),
  columnId: id<SculptorColumnId>(),
  /**
   * The node in the column before this one that this hangs off. Null in the
   * structure column, whose nodes are a chain rather than children (§3).
   */
  parentId: id<SculptorNodeId>().nullable().default(null),
  /** Among its siblings, or along the chain in the structure column. */
  orderKey: orderKey(),
  /** What it is, typed straight on the node. */
  title: z.string().default(''),
  /** Anything else, in the detail panel (§5). */
  note: z.string().default(''),
  /** Its column's kind by default, changeable (§5). */
  kind: z.string().default(''),
  /** The writer's own, or empty for the board's. */
  colour: z.string().default(''),
  /**
   * The answers to its column's fields, keyed by field id (§5). Empty until
   * something is typed, and a node whose column has no fields never has any.
   */
  fields: z.record(z.string()).default({}),
  /** Beginning, End, or an ordinary node. */
  end: sculptorEndSchema.nullable().default(null),
  /** Folded: its children compressed, their order kept (§4, §10). */
  collapsed: z.boolean().default(false),
  /**
   * The scene or beat in the script this **is**, where the writer has bound it
   * (§6). Null is an idea, which is what every node starts as.
   */
  boundUnitId: id<StructuralUnitId>().nullable().default(null),
  boundBeatId: id<BeatId>().nullable().default(null),
  ...timestamps,
});
export type SculptorNode = z.infer<typeof sculptorNodeSchema>;

export const boardSchema = z.object({
  id: id<BoardId>(),
  projectId: id<ProjectId>(),
  /** A project may have more than one board (§15). */
  name: z.string().default(''),
  columns: z.array(sculptorColumnSchema).default([]),
  nodes: z.array(sculptorNodeSchema).default([]),
  ...timestamps,
});
export type Board = z.infer<typeof boardSchema>;
