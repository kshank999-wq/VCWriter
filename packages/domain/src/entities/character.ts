import { z } from 'zod';
import { id, orderKey, timestamps } from './common.js';
import { voiceAssignmentSchema } from './project.js';
import type { CharacterCategoryId, CharacterId, ProjectId, ResearchItemId } from '../ids.js';

/**
 * How a project sorts its people (addendum 02 §16).
 *
 * Every format has main characters and minor ones; a series has recurring
 * ones in between, because that is the distinction a series actually makes.
 * The categories are **data, not an enum** — a writer who wants "The family"
 * and "The precinct" should have them, and a category is only a heading with
 * an order.
 */
export const characterCategorySchema = z.object({
  id: id<CharacterCategoryId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1),
  /** Main before recurring before minor: the order they are offered in. */
  orderKey: orderKey(),
  ...timestamps,
});
export type CharacterCategory = z.infer<typeof characterCategorySchema>;

/**
 * Characters are first-class project entities (spec §13) and carry a persistent
 * TTS voice assignment so screenplay read-back sounds like several people
 * talking (§10). A character may also be surfaced in the Characters research
 * category; that is a link, not a copy.
 */
export const characterSchema = z.object({
  id: id<CharacterId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().default(''),
  arcNotes: z.string().default(''),
  /** Optional backing research card, when the writer keeps one. */
  researchItemId: id<ResearchItemId>().nullable().default(null),
  /** Which heading they are filed under; null until the writer files them. */
  categoryId: id<CharacterCategoryId>().nullable().default(null),
  /** Persists per project and stays editable (§10). */
  voice: voiceAssignmentSchema.nullable().default(null),
  archived: z.boolean().default(false),
  ...timestamps,
});
export type Character = z.infer<typeof characterSchema>;
