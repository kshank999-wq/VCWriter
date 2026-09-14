import { z } from 'zod';
import { id, timestamps } from './common.js';
import type {
  BeatId,
  IndexMarkId,
  IndexRefId,
  ManuscriptElementId,
  ProjectId,
} from '../ids.js';

/**
 * The records a back-of-book index is made of (addendum 10).
 *
 * Two of them, and they are different in kind — which is why they are two
 * collections rather than one with a nullable anchor and a flag. A **mark** is
 * a place in the manuscript. A **cross-reference** is a sentence about the
 * index itself, pointing from one heading to another, and it is attached to no
 * passage at all. One record with half a target is the muddle the room's
 * comments table refused (addendum 07, migration 0035), for the same reason.
 */

/**
 * A passage the writer has said belongs under a heading.
 *
 * **Anchored by id, with the words kept as a quote** — the same decision the
 * Character Creator's usage link makes (addendum 08 §3.2) and for the same
 * reasons. The element id survives a reorder and a rewrite; the quote is there
 * so a list of marks reads like something rather than like a table of uuids,
 * and it is never what the link is made of. Rewriting the sentence does not
 * break the mark, because the passage is still the passage.
 *
 * There is **no page number here**, which is the whole point: a page is where
 * something lands after the book is laid out, and storing one would be storing
 * an answer that goes stale the moment anybody writes a paragraph.
 */
export const indexMarkSchema = z.object({
  id: id<IndexMarkId>(),
  projectId: id<ProjectId>(),
  /**
   * The heading it files under. **The writer's words, not the passage's** — a
   * paragraph about the lens is indexed under *lenses, Fresnel*, and an index
   * that could only use the words on the page would be a concordance.
   */
  term: z.string().default(''),
  /** The sub-heading beneath it, where there is one. Two levels, never three. */
  subTerm: z.string().default(''),
  beatId: id<BeatId>(),
  /** The element the mark sits on. Where the index points. */
  elementId: id<ManuscriptElementId>(),
  /** What the passage said when it was marked. For reading, never for finding. */
  quote: z.string().default(''),
  /**
   * A principal discussion, printed bold in the index the way books do it.
   *
   * A real index distinguishes *where this is discussed* from *where this is
   * mentioned*, and only the writer knows which is which.
   */
  principal: z.boolean().default(false),
  ...timestamps,
});
export type IndexMark = z.infer<typeof indexMarkSchema>;

/**
 * *See* and *see also*, which an index is not an index without.
 *
 * They are genuinely different and the difference matters when it prints:
 * **see** is a redirect — the heading has no pages of its own and sends the
 * reader elsewhere — while **see also** sits *after* a heading's page numbers
 * and offers somewhere else to look as well.
 */
export const INDEX_REF_KINDS = ['see', 'see_also'] as const;
export const indexRefKindSchema = z.enum(INDEX_REF_KINDS);
export type IndexRefKind = (typeof INDEX_REF_KINDS)[number];

export const indexRefSchema = z.object({
  id: id<IndexRefId>(),
  projectId: id<ProjectId>(),
  /** The heading this is written under. */
  term: z.string().default(''),
  subTerm: z.string().default(''),
  kind: indexRefKindSchema.default('see'),
  /** The heading it points at, as it is written there. */
  target: z.string().default(''),
  ...timestamps,
});
export type IndexRef = z.infer<typeof indexRefSchema>;
