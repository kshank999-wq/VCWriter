import { z } from 'zod';
import { id, timestamps } from './common.js';
import type { ProjectId, ResearchMotifId, ResearchThemeId, ThemeMotifLinkId } from '../ids.js';

/**
 * Themes and motifs (addendum 12, from Ken's Themes & Motifs spec v2).
 *
 * **Two entity types, not one with a flag**, which §2 of the spec asks for
 * twice and is right about. It would be easy to model these as one record with
 * a `kind`, and the interface would then drift towards one list, one filter and
 * one track — which is the exact outcome §8 forbids.
 *
 * The reason it is true rather than merely asked for is that the fields
 * genuinely differ. A theme is an *idea* and what it wants is a sense of where
 * it is going: `arcNotes`. A motif is a *thing that recurs* and what it wants
 * is what kind of thing it is: `motifType`. Neither field means anything on the
 * other, and a single table would carry both half-empty.
 *
 * What they share is **occurrences**, and those are not duplicated: a tagged
 * passage is a `usageLink`, whose `ownerKind` this widens. That record already
 * carried a beat, an element, a quote and a scene for navigation, which is
 * every field §5 asks for — so the reverse index, the orphan reading and the
 * sync table all worked without being written twice.
 */

/** Whether the writer is still working on it. Neither state judges the work. */
export const THEMATIC_STATES = ['active', 'resolved', 'set_aside'] as const;
export const thematicStateSchema = z.enum(THEMATIC_STATES);
export type ThematicState = z.infer<typeof thematicStateSchema>;

export const researchThemeSchema = z.object({
  id: id<ResearchThemeId>(),
  projectId: id<ProjectId>(),
  name: z.string().default(''),
  /** What the theme is: the idea, the question, the argument, the value at issue. */
  description: z.string().default(''),
  /**
   * Where it is meant to go — introduced, complicated, contradicted, paid off.
   *
   * A theme's own field, and the reason a theme is not a motif: a motif recurs,
   * a theme *develops*, and there is nowhere on a motif for this to mean
   * anything.
   */
  arcNotes: z.string().default(''),
  notes: z.string().default(''),
  state: thematicStateSchema.default('active'),
  ...timestamps,
});
export type ResearchTheme = z.infer<typeof researchThemeSchema>;

/**
 * What kind of thing recurs.
 *
 * §7's list, and `custom` for the rest — a motif is whatever the writer keeps
 * putting in, and a closed list would be the module telling them what counts.
 */
export const MOTIF_TYPES = [
  'visual',
  'object',
  'phrase',
  'sound',
  'colour',
  'gesture',
  'location',
  'symbolic',
  'custom',
] as const;
export const motifTypeSchema = z.enum(MOTIF_TYPES);
export type MotifType = z.infer<typeof motifTypeSchema>;

export const researchMotifSchema = z.object({
  id: id<ResearchMotifId>(),
  projectId: id<ProjectId>(),
  name: z.string().default(''),
  description: z.string().default(''),
  /** A motif's own field, and the reason a motif is not a theme. */
  motifType: motifTypeSchema.default('visual'),
  notes: z.string().default(''),
  state: thematicStateSchema.default('active'),
  ...timestamps,
});
export type ResearchMotif = z.infer<typeof researchMotifSchema>;

/**
 * A motif that belongs to a theme (§3, §7).
 *
 * **It relates them and never merges them.** The bell is a motif of the theme
 * *what a town owes its dead*; saying so must not put the bell's recurrences
 * into the theme's occurrence list, because the reader meets the bell nine
 * times and the theme is not therefore nine times explored.
 */
export const themeMotifLinkSchema = z.object({
  id: id<ThemeMotifLinkId>(),
  projectId: id<ProjectId>(),
  themeId: id<ResearchThemeId>(),
  motifId: id<ResearchMotifId>(),
  ...timestamps,
});
export type ThemeMotifLink = z.infer<typeof themeMotifLinkSchema>;
