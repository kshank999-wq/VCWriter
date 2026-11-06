import { z } from 'zod';
import { id, orderKey, timestamps } from './common.js';
import type {
  BeatId,
  BoardId,
  CharacterId,
  ProjectId,
  SculptorColumnId,
  SculptorEntityId,
  SculptorFieldId,
  SculptorViewId,
  SculptorLinkId,
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
  /**
   * The column a version-1 card stood in. Kept on migrated cards so the old
   * board can be put back (v2 §13); null on everything made in v2.
   */
  columnId: id<SculptorColumnId>().nullable().default(null),
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
  /**
   * Its type (v2 §4): frame, plot_point, scene, character, action, beat, note
   * or custom. The colour, the label and what it can bind to follow from it.
   */
  kind: z.string().default('note'),
  /** A custom type's own name, or a note's subtype: *Location*, *Reveal*. */
  subtype: z.string().default(''),
  /**
   * The reusable definition this card is a placement of (v2 §4), or null for
   * a card that is only itself. Many cards may share one definition.
   */
  entityId: id<SculptorEntityId>().nullable().default(null),
  /** The writer's own, or empty for the board's. */
  colour: z.string().default(''),
  /**
   * Its typed details (v2 §4), keyed by name: *purpose*, *stakes*, *objective*.
   * A migrated card keeps its old column's answers here under their names.
   */
  fields: z.record(z.string()).default({}),
  /**
   * Who is in it (addendum 03 §5).
   *
   * The project's own cast, by id, so a character renamed once is renamed on
   * every card that names them. A card may name somebody the script has not
   * met yet — that is what a board is for — and the cast is where they are
   * added, so a board never invents a person the project does not have.
   */
  characterIds: z.array(id<CharacterId>()).default([]),
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

/**
 * A connection the writer drew, as opposed to the parent relation (§7).
 *
 * **The two kinds of connection are different things.** The structural ones —
 * parent to children, and each structure node to the next — are drawn
 * automatically and say where a thing *belongs*. These are the writer's own:
 * any node to any node, with a label. *This setup pays off here. This scene is
 * why she does that.* They say what a writer **noticed**.
 *
 * A link is never what holds two things together; the parent relation is. So
 * deleting one loses nothing but the observation, and nothing on the board
 * moves when it goes.
 */
export const sculptorLinkSchema = z.object({
  id: id<SculptorLinkId>(),
  /** The direction is the observation: this sets up that, not the reverse. */
  fromId: id<SculptorNodeId>(),
  toId: id<SculptorNodeId>(),
  /** What the writer noticed. Empty is allowed: some links are just a line. */
  label: z.string().default(''),
  /** What kind of relation (v2 §7): related, causes, appears_in, setup_payoff, conflict, influence, custom. */
  type: z.string().default('related'),
  /** An arrow, or a plain line for a relation that runs both ways. */
  directed: z.boolean().default(true),
  ...timestamps,
});
export type SculptorLink = z.infer<typeof sculptorLinkSchema>;

/**
 * A reusable definition (v2 §4): a character, a location, a plot point that
 * appears in more than one place. Its placements are cards with its id.
 *
 * Where it stands for something the project already has (a character in the
 * cast, a location, a research note) `sourceKind` and `sourceId` say which,
 * and its name is read from there, so it is never a second copy.
 */
export const sculptorSourceKindSchema = z.enum(['character', 'location', 'research', 'theme']);
export type SculptorSourceKind = z.infer<typeof sculptorSourceKindSchema>;

export const sculptorEntitySchema = z.object({
  id: id<SculptorEntityId>(),
  type: z.string().default('note'),
  subtype: z.string().default(''),
  sourceKind: sculptorSourceKindSchema.nullable().default(null),
  sourceId: z.string().nullable().default(null),
  title: z.string().default(''),
  description: z.string().default(''),
  fields: z.record(z.string()).default({}),
  favorite: z.boolean().default(false),
  ...timestamps,
});
export type SculptorEntity = z.infer<typeof sculptorEntitySchema>;

/**
 * How much of the map is open (v2 §6), kept apart from the story itself.
 *
 * `level` is the global control; `open` and `closed` are the branches the
 * writer opened or folded by hand, which win over it. `rootId` is the card
 * whose own mini map is showing, or null for the whole story.
 */
export const sculptorLevelSchema = z.union([
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('depth'), depth: z.number().int().min(0) }),
  z.object({ kind: z.literal('type'), type: z.string() }),
]);
export type SculptorLevel = z.infer<typeof sculptorLevelSchema>;

export const sculptorViewStateSchema = z.object({
  level: sculptorLevelSchema.default({ kind: 'all' }),
  open: z.array(z.string()).default([]),
  closed: z.array(z.string()).default([]),
  rootId: z.string().nullable().default(null),
  /** Link types the writer has hidden. */
  hiddenLinkTypes: z.array(z.string()).default([]),
});
export type SculptorViewState = z.infer<typeof sculptorViewStateSchema>;

/** A saved arrangement the writer can come back to (v2 §11). */
export const sculptorSavedViewSchema = z.object({
  id: id<SculptorViewId>(),
  name: z.string().default(''),
  state: sculptorViewStateSchema,
  layout: z.record(z.object({ x: z.number(), y: z.number() })).default({}),
});
export type SculptorSavedView = z.infer<typeof sculptorSavedViewSchema>;

export const boardSchema = z.object({
  id: id<BoardId>(),
  /**
   * 1 is the column board; 2 is Story Sculptor 2.0. A version-1 board is
   * upgraded when it is read (`upgradeBoard`), once.
   */
  schemaVersion: z.number().int().default(1),
  projectId: id<ProjectId>(),
  /** A project may have more than one board (§15). */
  name: z.string().default(''),
  columns: z.array(sculptorColumnSchema).default([]),
  nodes: z.array(sculptorNodeSchema).default([]),
  /** The writer's own connections (§7). None, on a board nobody has drawn on. */
  links: z.array(sculptorLinkSchema).default([]),
  /** v2: the reusable definitions on this board. */
  entities: z.array(sculptorEntitySchema).default([]),
  /** v2: what is open and what is folded. */
  viewState: sculptorViewStateSchema.default({}),
  /** v2: cards the writer placed by hand, by id. Everything else is laid out. */
  layout: z.record(z.object({ x: z.number(), y: z.number() })).default({}),
  /** v2: saved arrangements. */
  views: z.array(sculptorSavedViewSchema).default([]),
  /**
   * The version-1 board as it was before the upgrade, kept whole so the
   * upgrade can be undone (v2 §13). Null on a board made in v2.
   */
  legacy: z.unknown().nullable().default(null),
  ...timestamps,
});
export type Board = z.infer<typeof boardSchema>;
