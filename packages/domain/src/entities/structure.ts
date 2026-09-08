import { z } from 'zod';
import { id, orderKey, timestamps } from './common.js';
import { manuscriptSegmentSchema } from './manuscript.js';
import type { BeatId, BeatRevisionId, LaneId, ProjectId, StoryMarkerId, StructuralUnitId } from '../ids.js';

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
  ...timestamps,
});
export type Beat = z.infer<typeof beatSchema>;

/**
 * A labelled point in the story order: "this scene starts Act II" (addendum
 * 02 §9). Not a container — scenes do not belong to acts, because an act
 * that owned scenes would cut across lanes and the hierarchy is lanes →
 * scenes → beats (§19). A marker is anchored to the unit that starts it.
 */
export const storyMarkerKindSchema = z.enum(['act', 'sequence', 'note']);
export type StoryMarkerKind = z.infer<typeof storyMarkerKindSchema>;

export const storyMarkerSchema = z.object({
  id: id<StoryMarkerId>(),
  projectId: id<ProjectId>(),
  unitId: id<StructuralUnitId>(),
  kind: storyMarkerKindSchema.default('act'),
  title: z.string().default(''),
  ...timestamps,
});
export type StoryMarker = z.infer<typeof storyMarkerSchema>;
