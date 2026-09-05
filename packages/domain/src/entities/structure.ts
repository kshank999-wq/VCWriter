import { z } from 'zod';
import { id, orderKey, timestamps } from './common.js';
import { manuscriptSegmentSchema } from './manuscript.js';
import type { BeatId, LaneId, ProjectId, StructuralUnitId } from '../ids.js';

/**
 * Story structure: lanes -> scene/chapter containers -> beats (spec §5).
 *
 * Hierarchy rule (§19, non-negotiable): a beat belongs to a scene or chapter
 * container. Beats are never free-floating lane cards. `Beat.unitId` is
 * therefore required, not nullable.
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

export const laneSchema = z.object({
  id: id<LaneId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1),
  kind: laneKindSchema.default('custom'),
  /** Hex colour used by the structure board. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6b7280'),
  description: z.string().default(''),
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
  orderKey: orderKey(),
  collapsed: z.boolean().default(false),
  ...timestamps,
});
export type StructuralUnit = z.infer<typeof structuralUnitSchema>;

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
  manuscript: manuscriptSegmentSchema.default({ elements: [] }),
  ...timestamps,
});
export type Beat = z.infer<typeof beatSchema>;
