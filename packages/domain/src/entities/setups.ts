import { z } from 'zod';
import { id, isoDateTime, timestamps } from './common.js';
import { storyEntityRefSchema } from './links.js';
import type { ProjectId, SetupPayoffId, SetupPointId } from '../ids.js';

/**
 * Setups & payoffs (spec §7.3).
 *
 * One payoff may be established by several setup points, and the system must
 * track all of them. A record that is resolved can be archived while keeping
 * its history and links — archiving is reversible, not a delete.
 */

export const setupStrengthSchema = z.enum(['planned', 'written', 'weak']);
export type SetupStrength = z.infer<typeof setupStrengthSchema>;

export const setupPointSchema = z.object({
  id: id<SetupPointId>(),
  description: z.string().default(''),
  /** Where the setup lands in the story, when it has been placed. */
  location: storyEntityRefSchema.nullable().default(null),
  strength: setupStrengthSchema.default('planned'),
  /**
   * What the passage said when it was tagged.
   *
   * For recognising the point again, never for finding it: the anchor is the
   * `location`, so editing the line does not move the setup and cutting the
   * beat orphans it rather than silently losing it.
   */
  excerpt: z.string().default(''),
  createdAt: isoDateTime(),
});
export type SetupPoint = z.infer<typeof setupPointSchema>;

export const payoffPointSchema = z.object({
  description: z.string().default(''),
  location: storyEntityRefSchema.nullable().default(null),
  /** As on a setup point: the page's words, kept for recognition. */
  excerpt: z.string().default(''),
  writtenAt: isoDateTime().nullable().default(null),
});
export type PayoffPoint = z.infer<typeof payoffPointSchema>;

/**
 * `open` — payoff intended, nothing established yet.
 * `established` — at least one setup written, payoff not yet delivered.
 * `resolved` — payoff written.
 * `abandoned` — deliberately dropped; kept for history.
 */
export const setupPayoffStatusSchema = z.enum(['open', 'established', 'resolved', 'abandoned']);
export type SetupPayoffStatus = z.infer<typeof setupPayoffStatusSchema>;

export const setupPayoffSchema = z.object({
  id: id<SetupPayoffId>(),
  projectId: id<ProjectId>(),
  title: z.string().min(1),
  description: z.string().default(''),
  status: setupPayoffStatusSchema.default('open'),
  setups: z.array(setupPointSchema).default([]),
  payoff: payoffPointSchema.nullable().default(null),
  /**
   * How many setups this payoff wants before it counts as prepared.
   *
   * Three unless the writer says otherwise — `MINIMUM_VALID_SETUPS` in
   * `setups.ts` is the one place the number lives, and this is the one place it
   * can be disagreed with. Zero means *use the default*, so a record written
   * before the field existed reads as three rather than as none required.
   */
  minimumSetups: z.number().int().min(0).max(20).default(0),
  /** Resolved records may be archived out of the active list (§7.3). */
  archived: z.boolean().default(false),
  ...timestamps,
});
export type SetupPayoff = z.infer<typeof setupPayoffSchema>;

/** Derive the status implied by the current setup/payoff evidence. */
export const derivedSetupPayoffStatus = (record: SetupPayoff): SetupPayoffStatus => {
  if (record.status === 'abandoned') return 'abandoned';
  if (record.payoff?.writtenAt) return 'resolved';
  return record.setups.some((setup) => setup.strength === 'written') ? 'established' : 'open';
};

/** Active obligations the writer still owes the reader (§7.3). */
export const isUnresolved = (record: SetupPayoff): boolean =>
  !record.archived && derivedSetupPayoffStatus(record) !== 'resolved' && record.status !== 'abandoned';
