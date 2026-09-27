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
 * The roles the Overview offers (addendum 25 §3, the handoff's chips).
 *
 * **Offered, never imposed**: the field is free text and the last chip is the
 * writer's own, because *the one who knows* and *the voice on the phone* are
 * roles a story has and no list would hold.
 */
export const CHARACTER_ROLES = [
  'Protagonist',
  'Antagonist',
  'Supporting',
  'Mentor',
  'Ally',
  'Rival',
] as const;

/**
 * Characters are first-class project entities (spec §13) and carry a persistent
 * TTS voice assignment so screenplay read-back sounds like several people
 * talking (§10). A character may also be surfaced in the Characters research
 * category; that is a link, not a copy.
 */
export const characterSchema = z.object({
  /**
   * In the graveyard since (addendum 24): a delete stamps this and the record
   * keeps its place, so everything pointing at it goes on pointing at it and
   * restoring is clearing the field. `null` is the ordinary state.
   */
  deletedAt: z.string().datetime({ offset: true }).nullable().default(null),
  id: id<CharacterId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().default(''),
  arcNotes: z.string().default(''),
  /**
   * The writer's own words for who this is — *antagonist*, *comic relief*,
   * *the one who knows* (addendum 08 §5).
   *
   * Not the heading they are filed under, which is about how much of the story
   * they are in, and not a trait, which is about what they are like. A research
   * item has carried tags since the beginning; this is the same idea about a
   * person, and it stays free text because the vocabulary is the writer's.
   */
  tags: z.array(z.string()).default([]),
  /**
   * What this person is **to the story** (addendum 25 §3): protagonist,
   * antagonist, supporting, mentor, ally, rival — or whatever the writer
   * calls it, which is why it is free text with `CHARACTER_ROLES` offered
   * beside it rather than an enum.
   *
   * It is not the heading they are filed under (how much of the story they
   * are in) and it is **no longer** what `tags` is for: tags did this job and
   * the writer's own topics at once — *antagonist* beside *money*, *grief*,
   * *Christmas thread* — which is one field answering two questions. Tags are
   * the topics now.
   */
  role: z.string().default(''),
  /**
   * The optional half (spec §3, *without making biography the center of the
   * tool*): what a reader would notice, and what happened before the story.
   * Empty strings rather than nulls, because the screen shows three lines
   * whether or not they are filled and an absent field is not a different
   * thing from an empty one here.
   */
  background: z
    .object({
      age: z.string().default(''),
      look: z.string().default(''),
      history: z.string().default(''),
    })
    .default({}),
  /**
   * The writer's own fields — *Voice: clipped, answers questions with
   * prices*.
   *
   * **A list rather than a map**, which the handoff's `customFields{}`
   * suggests: a map loses the order they were made in and cannot be renamed
   * without losing what is in it, because the name is the key. Each carries
   * an id, so renaming one is an edit rather than a delete and an add.
   */
  customFields: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().default(''),
        value: z.string().default(''),
      }),
    )
    .default([]),
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
