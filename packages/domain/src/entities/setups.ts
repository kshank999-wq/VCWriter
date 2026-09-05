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
  createdAt: isoDateTime(),
});
export type SetupPoint = z.infer<typeof setupPointSchema>;

export const payoffPointSchema = z.object({
  description: z.string().default(''),
  location: storyEntityRefSchema.nullable().default(null),
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
