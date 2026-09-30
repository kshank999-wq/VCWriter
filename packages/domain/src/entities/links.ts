import { z } from 'zod';
import { id, timestamps } from './common.js';
import type { ProjectId, StoryLinkId } from '../ids.js';

/**
 * Typed story links (spec §7.4, §19).
 *
 * A link is a structured record between two entity references — never text
 * duplicated into several places — so renaming or editing an entity propagates
 * everywhere it is referenced.
 */

export const storyEntityTypeSchema = z.enum([
  'project',
  'track',
  'unit',
  'beat',
  'research_item',
  'character',
  'setup_payoff',
  'capture_item',
  /**
   * A point in somebody's arc (addendum 08 §13).
   *
   * Joining this list is the whole of what a cross-character arc link needed:
   * *Mara's refusal **causes** Deakins' decision* is two references, a verb and
   * a note, which is exactly what a story link already is. The database stores
   * these types as text, so nothing had to change there either.
   */
  'arc_point',
  /**
   * A moment of a narrative thread (addendum 15 §3).
   *
   * The same move again, and the plainest one yet: a dependency edge between
   * two moments of a thread is two references and a verb, and `depends_on` has
   * been in the list below since spec §7.4. So Ken's spec §16 asks for a
   * StoryLinkEdge table and the answer is this one line — no table, no
   * migration, and the same reading code draws it.
   */
  'thread_node',
  /**
   * A theme and a motif (addendum 25 §4e).
   *
   * **The fifth time this list has been the answer.** An arc point that *is
   * about* a theme, or that a motif recurs at, is two references and a verb,
   * which is what a story link has been since spec §7.4 — so linking an arc to
   * what the book is about needed no table, no migration and no second kind of
   * link, only these two words. `from_type` is text in Postgres, as it was for
   * `arc_point` and `thread_node`.
   *
   * They stay **two entries and never one** — Themes & Motifs' rule all the
   * way down (addendum 12 §2): a reader *meets* a motif and *understands* a
   * theme, and nothing anywhere takes *a thematic thing* and works out which.
   */
  'theme',
  'motif',
  /**
   * A chapter — a `chapter` story marker (addendum 28 §2).
   *
   * **The sixth time this list has been the answer**, and the first time it is
   * a *place in the book* rather than a thing in the story. A note filed under
   * Chapter 3 is a reference to that chapter, and `unit` has been in this list
   * since the beginning for the section under it, so filing at either level is
   * one field naming one ref rather than two nullable ids that could both be
   * set.
   *
   * It is deliberately **not** called `chapter`: the record is a story marker,
   * which is an episode in a series and a story in a collection as well
   * (addendum 22 §7a renamed `chapterSpan` to `divisionSpan` for exactly this),
   * and a type named for one of its three uses is the drift that rename
   * removed. `from_type` is text in Postgres, as it was for the five above.
   */
  'story_marker',
]);
export type StoryEntityType = z.infer<typeof storyEntityTypeSchema>;

export const storyEntityRefSchema = z.object({
  type: storyEntityTypeSchema,
  id: z.string().uuid(),
});
export type StoryEntityRef = z.infer<typeof storyEntityRefSchema>;

export const storyLinkTypeSchema = z.enum([
  'appears_in',
  'mentions',
  'establishes',
  'pays_off',
  'located_at',
  'owns',
  'depends_on',
  'relates_to',
  // What one arc point does to another (addendum 08 §13). They are link types
  // rather than a second vocabulary beside them, because the thing they
  // describe is a link: two references and a verb.
  'causes',
  'influences',
  'challenges',
  'enables',
  'prevents',
  'reveals',
  'betrays',
  'inspires',
  'custom',
]);
export type StoryLinkType = z.infer<typeof storyLinkTypeSchema>;

export const storyLinkSchema = z.object({
  id: id<StoryLinkId>(),
  projectId: id<ProjectId>(),
  from: storyEntityRefSchema,
  to: storyEntityRefSchema,
  type: storyLinkTypeSchema.default('relates_to'),
  /** Free label used when `type` is `custom`, or to annotate the relationship. */
  label: z.string().default(''),
  notes: z.string().default(''),
  ...timestamps,
});
export type StoryLink = z.infer<typeof storyLinkSchema>;

export const refEquals = (a: StoryEntityRef, b: StoryEntityRef): boolean => a.type === b.type && a.id === b.id;

export const ref = (type: StoryEntityType, entityId: string): StoryEntityRef => ({ type, id: entityId });
