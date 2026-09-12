import { z } from 'zod';
import { id, orderKey, timestamps } from './common.js';
import { manuscriptSegmentSchema } from './manuscript.js';
import { titlePageSchema } from './title-page.js';
import type {
  AssetId,
  BeatId,
  BeatRevisionId,
  CharacterId,
  LaneId,
  ProjectId,
  StoryMarkerId,
  StructuralUnitId,
} from '../ids.js';

/**
 * Story structure: lanes -> scene/chapter containers -> beats (spec §5).
 *
 * Hierarchy rule (§19, non-negotiable): a beat belongs to a scene or chapter
 * container. Beats are never free-floating lane cards. `Beat.unitId` is
 * therefore required, not nullable.
 *
 * Story order (addendum 02 §8): a unit's `orderKey` is its position on one
 * axis shared by the whole project. Its lane is the row it is drawn in and
 * nothing more, so a subplot scene can sit between two main-plot scenes,
 * which is where subplot scenes go.
 */

export const laneKindSchema = z.enum([
  'main_plot',
  'subplot',
  'character_arc',
  'theme',
  'mystery',
  'relationship',
  'custom',
]);
export type LaneKind = z.infer<typeof laneKindSchema>;

/**
 * Default lane colours, in the order lanes are usually added. They are the
 * brand's gold and red first, then hues chosen to sit on the near-black
 * ground without shouting; a lane's colour is data and the writer can pick
 * any other.
 */
export const LANE_COLOURS = ['#c9a45c', '#8b1c1c', '#5b7fa6', '#7a9e7e', '#8a6f9e', '#a67c52', '#6f8f9e'] as const;

export const laneSchema = z.object({
  id: id<LaneId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1),
  kind: laneKindSchema.default('custom'),
  /** Hex colour the timeline draws the lane's track and blocks in. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#5b7fa6'),
  /** What this thread of the story is about: its summary. */
  description: z.string().default(''),
  /** How it develops: the arc, as the writer works it out (addendum 02 §4). */
  arc: z.string().default(''),
  orderKey: orderKey(),
  collapsed: z.boolean().default(false),
  ...timestamps,
});
export type Lane = z.infer<typeof laneSchema>;

/** Screenplays use `scene`; novels use `chapter` (or `section`) — §5.2. */
export const structuralUnitKindSchema = z.enum(['scene', 'chapter', 'section']);
export type StructuralUnitKind = z.infer<typeof structuralUnitKindSchema>;

export const structuralUnitStatusSchema = z.enum([
  'outline',
  'drafting',
  'draft_complete',
  'revised',
  'final',
]);
export type StructuralUnitStatus = z.infer<typeof structuralUnitStatusSchema>;

/**
 * A scene read as a story in miniature (spec §8.2).
 *
 * The Story Grid's question, asked of every scene: what is at stake, which
 * way does it move, where does it turn, and why is the scene in the script
 * at all. This is the **writer's** answer — the AI pass proposes one, but a
 * writer with no key and no connection can fill the grid in themselves, and
 * the checks that read it work either way.
 *
 * Empty throughout is the honest starting state: an unanswered question is
 * not the same as "nothing changes", and nothing here guesses.
 */
export const sceneGridSchema = z.object({
  /** What is at stake: "trust / betrayal", "life / death", "hope / despair". */
  value: z.string().default(''),
  /** Which way it moves by the end. Empty means nobody has said. */
  polarity: z.enum(['up', 'down', 'mixed', 'flat', '']).default(''),
  /** Where it turns. Empty on a scene that does not. */
  turn: z.string().default(''),
  /** Why this scene is in the script. */
  purpose: z.string().default(''),
  /** What is being fought over, and who wants what. */
  conflict: z.string().default(''),
  /**
   * The story event: what actually happens, in a line (addendum 04 §5).
   *
   * The writer's own. An AI read's `change` is offered as a suggestion where
   * one has been made, but is never written here without being taken.
   */
  event: z.string().default(''),
  /**
   * Whose eyes the scene is seen through. A novel's column; a screenplay's
   * only where the writer wants one. Nothing measures it.
   */
  pov: z.string().default(''),
  /**
   * The five commandments, asked of the scene (addendum 04 §4).
   *
   * `turn` above is the progressive complication — the turn that makes going
   * back impossible — so it is not asked twice; these are the other four. A
   * scene is a story in miniature, which is why the same five questions work
   * at this scale as at the story's.
   */
  inciting: z.string().default(''),
  crisis: z.string().default(''),
  climax: z.string().default(''),
  resolution: z.string().default(''),
});
export type SceneGrid = z.infer<typeof sceneGridSchema>;

/**
 * What an AI structural pass answered for a scene (spec §8.2).
 *
 * Kept on the scene rather than in the panel's memory for two reasons. A read
 * costs real money, so paying for it twice to see it twice would be a poor
 * bargain; and the writer's own grid is a document, so the reading it was
 * argued with belongs in the document beside it.
 *
 * It is a proposal and stays labelled as one. Nothing here is ever treated as
 * the writer's answer unless the writer copies it across.
 */
export const sceneReadSchema = z.object({
  /** What is true when the scene opens. */
  opening: z.string().default(''),
  /** What has changed by the end. */
  change: z.string().default(''),
  /**
   * Where the scene turns. Null on a scene the read found no turn in.
   *
   * This is the **progressive complication** of the five commandments under
   * the name the Final Editor's grid has always used for it (addendum 04 §4).
   */
  turn: z.string().nullable().default(null),
  /** Whether the scene's value moves, and in which direction. */
  valueShift: z.enum(['positive', 'negative', 'mixed', 'none']).default('none'),
  purpose: z.string().default(''),
  concerns: z.array(z.string()).default([]),
  /**
   * The other four commandments at scene scale (addendum 04 §4, §8 stage 4).
   *
   * **Null means the read did not find one**, which is a finding rather than
   * a gap: a scene with no crisis in it is worth being told about. They
   * default to null so a project read before this existed opens with four
   * unanswered questions rather than four wrong answers.
   */
  inciting: z.string().nullable().default(null),
  crisis: z.string().nullable().default(null),
  climax: z.string().nullable().default(null),
  resolution: z.string().nullable().default(null),
  /** Which model answered, so an old read can be told from a new one. */
  model: z.string().default(''),
  /** When it was read, so a read made before an edit can be spotted. */
  readAt: z.string().default(''),
});
export type SceneRead = z.infer<typeof sceneReadSchema>;


/**
 * Who first made this, and when (addendum 07 §6.3).
 *
 * **Origin is immutable**: it survives a merge into the master draft, which is
 * what makes §1's promise auditable rather than merely intended. It names a
 * person and nothing else — no colour and no initials — because those belong to
 * the seat and are read through it (the module's rule since addendum 06 §5:
 * read through rather than copy across). A writer who changes their colour has
 * changed every page they wrote, not a hundred stale copies.
 *
 * Null on everything written outside a room, which is most writing.
 */
export const originSchema = z.object({
  /** The profile that made it. Resolved to a name and a colour by the room. */
  authorId: z.string(),
  at: z.string(),
});
export type Origin = z.infer<typeof originSchema>;

export const structuralUnitSchema = z.object({
  id: id<StructuralUnitId>(),
  projectId: id<ProjectId>(),
  laneId: id<LaneId>(),
  kind: structuralUnitKindSchema,
  title: z.string().default(''),
  /** Display label such as "Sc. 14" or "Chapter Two"; free text by design. */
  sequenceLabel: z.string().default(''),
  summary: z.string().default(''),
  notes: z.string().default(''),
  status: structuralUnitStatusSchema.default('outline'),
  /** Position in the story, across every lane (addendum 02 §8). */
  orderKey: orderKey(),
  collapsed: z.boolean().default(false),
  /**
   * Off: the scene stays in the structure — on the timeline, dimmed — but
   * leaves the script, the preview and every export (addendum 02 §4). A way
   * to hold a scene in reserve without deleting it.
   */
  inScript: z.boolean().default(true),
  /** The writer's own structural reading of the scene (spec §8.2). */
  grid: sceneGridSchema.default({}),
  /** The last AI read of this scene, if one has been asked for. */
  aiRead: sceneReadSchema.nullable().default(null),
  /** Who first made it, in a room (addendum 07 §6.3). Null everywhere else. */
  origin: originSchema.nullable().default(null),
  ...timestamps,
});
export type StructuralUnit = z.infer<typeof structuralUnitSchema>;

/** A kept version of a beat's manuscript (addendum 02 §4). */
export const beatRevisionSchema = z.object({
  id: id<BeatRevisionId>(),
  name: z.string().min(1),
  manuscript: manuscriptSegmentSchema,
  savedAt: z.string().datetime({ offset: true }),
});
export type BeatRevision = z.infer<typeof beatRevisionSchema>;

export const beatStatusSchema = z.enum(['planned', 'drafting', 'written', 'revised', 'cut']);
export type BeatStatus = z.infer<typeof beatStatusSchema>;

export const beatSchema = z.object({
  id: id<BeatId>(),
  projectId: id<ProjectId>(),
  /** Required: a beat always lives inside a scene/chapter container (§19). */
  unitId: id<StructuralUnitId>(),
  /**
   * Internal authoring label. Spec §5.3 / §19: this is metadata for the writer
   * and must never be emitted as manuscript text unless explicitly requested.
   */
  title: z.string().default(''),
  summary: z.string().default(''),
  status: beatStatusSchema.default('planned'),
  orderKey: orderKey(),
  /**
   * Off: the beat keeps its text and leaves the script, the way a scene
   * does (addendum 02 §4). A draft of a beat can be held back without
   * losing it.
   */
  inScript: z.boolean().default(true),
  /** The working text: the revision named by `revisionName`. */
  manuscript: manuscriptSegmentSchema.default({ elements: [] }),
  /** The name of the working revision; the others are in `revisions`. */
  revisionName: z.string().default('Draft 1'),
  /** Every revision that is not the working one, kept in full. */
  revisions: z.array(beatRevisionSchema).default([]),
  /** A colour the writer gave the beat, for the timeline and the threads; null for none. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().default(null),
  /**
   * What is seen, where the beat is a row of an AV sheet (addendum 05 §6).
   *
   * The second column of a commercial board: plain lines, because that is
   * what a visual column is. The manuscript above it is the audio. A format
   * that has no sheet never reads it, and it is empty until it is written.
   */
  visual: z.string().default(''),
  /**
   * The storyboard frame beside the row (addendum 05 §3c), by id into the
   * project's own pictures. Null until one is dropped on it.
   */
  imageAssetId: id<AssetId>().nullable().default(null),
  /**
   * How long the **dialogue** of a shot runs, in whole seconds (addendum 05
   * §4).
   *
   * Zero means "as long as the words take" — the one place in the sheet where
   * a time is estimated rather than typed, because the length of a read is
   * the one thing the words really do determine. Set it and the writer's
   * number wins.
   */
  seconds: z.number().int().min(0).default(0),
  /**
   * The action before the dialogue starts, and after it ends, in seconds
   * (addendum 05 §4). A shot is rarely only its line: something happens, then
   * somebody speaks, then something happens. Both are the writer's, and both
   * are zero until they are set.
   */
  headSeconds: z.number().int().min(0).default(0),
  tailSeconds: z.number().int().min(0).default(0),
  /**
   * Who first wrote it, in a room (addendum 07 §6.3). Null everywhere else —
   * which is most writing, and the reason this needs no format migration: an
   * older document parses with none and loses nothing.
   */
  origin: originSchema.nullable().default(null),
  ...timestamps,
});
export type Beat = z.infer<typeof beatSchema>;

/**
 * A labelled point in the story order: "this scene starts Act II" (addendum
 * 02 §9). Not a container — scenes do not belong to acts, because an act
 * that owned scenes would cut across lanes and the hierarchy is lanes →
 * scenes → beats (§19). A marker is anchored to the unit that starts it.
 */
export const storyMarkerKindSchema = z.enum(['act', 'episode', 'sequence', 'chapter', 'part', 'note']);
export type StoryMarkerKind = z.infer<typeof storyMarkerKindSchema>;

/**
 * The page a chapter — or an episode — opens with (addendum 02 §12, §14).
 *
 * A novel puts a leaf between chapters: the chapter's number, its name if it
 * has one, sometimes an epigraph, sometimes a device or an illustration. It
 * is a page of the book, not of the manuscript — nothing on it is text the
 * writer is writing — so it lives on the marker rather than among the
 * elements, and it can be left out of a printing without touching a word.
 */
export const chapterPageSchema = z.object({
  /** Off: the chapter still exists, it just has no page of its own. */
  include: z.boolean().default(false),
  showNumber: z.boolean().default(true),
  showTitle: z.boolean().default(true),
  /** A few lines under the title: a dedication, an epigraph, a date. */
  epigraph: z.string().default(''),
  /**
   * A device or illustration, held in the document as a data URL. Kept small
   * on purpose (`MAX_CHAPTER_IMAGE_BYTES`): the project is a text file that
   * syncs, and a full-bleed photograph in it would make every save enormous.
   */
  image: z
    .object({ dataUrl: z.string(), name: z.string().default(''), width: z.number().min(5).max(100).default(40) })
    .nullable()
    .default(null),
  align: z.enum(['left', 'center']).default('center'),
});
export type ChapterPage = z.infer<typeof chapterPageSchema>;

export const storyMarkerSchema = z.object({
  id: id<StoryMarkerId>(),
  projectId: id<ProjectId>(),
  unitId: id<StructuralUnitId>(),
  kind: storyMarkerKindSchema.default('act'),
  title: z.string().default(''),
  /**
   * What the writer wants to remember about this point in the story. A
   * screenplay's act markers have no page to design, and this is what they
   * carry instead — the note that would otherwise go on a card.
   */
  notes: z.string().default(''),
  /** Ignored by a screenplay, which has no chapter pages to print. */
  page: chapterPageSchema.default({}),
  /**
   * Who is in this one. Used by episode markers and ignored by the rest: an
   * episode has a cast, an act does not. It is what the carry-over writes
   * when a new episode starts, and what orders the names offered while a
   * character cue is typed inside it (addendum 02 §17).
   */
  cast: z.array(id<CharacterId>()).default([]),
  /**
   * This episode's own title page (spec §6.1, addendum 02 §17). Used by
   * episode markers and ignored by the rest — an episode is a script that
   * goes out on its own, so it has its own front page, with its own number,
   * its own name and its own draft date.
   *
   * Null means it has never been filled in, and the series' own title page
   * stands in for it: a new episode is not a blank front page, it is the
   * series' with the episode's number on it.
   */
  titlePage: titlePageSchema.nullable().default(null),
  ...timestamps,
});
export type StoryMarker = z.infer<typeof storyMarkerSchema>;
