import { z } from 'zod';
import { id, isoDateTime, orderKey, timestamps } from './common.js';
import type { BeatId, ProjectId, ResearchCategoryId, ResearchItemId } from '../ids.js';

/**
 * Research and story intelligence (spec §7).
 *
 * Categories ship with defaults (Characters, Ideas, Plot Points, ...) but are
 * fully user-editable: create, rename, reorder, archive.
 */

/** Well-known categories the app reasons about; users may add any others. */
export const systemCategoryKeySchema = z.enum([
  'characters',
  'ideas',
  'plot_points',
  'locations',
  'props',
  'themes',
  'setups_payoffs',
  'world',
]);
export type SystemCategoryKey = z.infer<typeof systemCategoryKeySchema>;

export const researchCategorySchema = z.object({
  id: id<ResearchCategoryId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1),
  /** Set for seeded categories; `null` for anything the writer created. */
  systemKey: systemCategoryKeySchema.nullable().default(null),
  description: z.string().default(''),
  orderKey: orderKey(),
  archived: z.boolean().default(false),
  ...timestamps,
});
export type ResearchCategory = z.infer<typeof researchCategorySchema>;

/**
 * Used/unused workflow (§7.2). `used` is a reversible state, never a delete;
 * `usedConfirmed` records whether a human confirmed it, because automatic
 * detection may only *suggest* that material has been incorporated.
 */
export const researchUsageSchema = z.enum(['unused', 'used']);
export type ResearchUsage = z.infer<typeof researchUsageSchema>;

export const researchItemSchema = z.object({
  id: id<ResearchItemId>(),
  projectId: id<ProjectId>(),
  categoryId: id<ResearchCategoryId>(),
  title: z.string().min(1),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
  usage: researchUsageSchema.default('unused'),
  usedAt: isoDateTime().nullable().default(null),
  /** Where the material was incorporated, when known. */
  usedInBeatIds: z.array(id<BeatId>()).default([]),
  /** False when the system inferred usage and the writer has not confirmed it. */
  usedConfirmed: z.boolean().default(false),
  archived: z.boolean().default(false),
  orderKey: orderKey(),
  origin: z.enum(['desktop', 'mobile_capture', 'import']).default('desktop'),
  ...timestamps,
});
export type ResearchItem = z.infer<typeof researchItemSchema>;

export const DEFAULT_RESEARCH_CATEGORIES: ReadonlyArray<{ name: string; systemKey: SystemCategoryKey }> = [
  { name: 'Characters', systemKey: 'characters' },
  { name: 'Ideas', systemKey: 'ideas' },
  { name: 'Plot Points', systemKey: 'plot_points' },
  { name: 'Locations', systemKey: 'locations' },
  { name: 'Props', systemKey: 'props' },
  { name: 'Themes', systemKey: 'themes' },
];
