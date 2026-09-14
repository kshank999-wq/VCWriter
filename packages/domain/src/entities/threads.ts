import { z } from 'zod';
import { id, timestamps } from './common.js';
import type { ProjectId, StoryThreadId } from '../ids.js';

/**
 * A narrative thread (addendum 15, from Ken's Research Links spec).
 *
 * §16 of that spec asks for three objects — StoryLink, StoryLinkNode and
 * StoryLinkEdge — and **two of the three already exist**, which is the fourth
 * time this project has found the general mechanism already built and merely
 * narrow in vocabulary (arc links joined `story_links`, thematic occurrences
 * joined `usage_links`, and the Character Creator's colour was already a
 * reading).
 *
 * - A **node** is a moment of the script: a beat, a paragraph, a quote, a note.
 *   That is `usage_links` exactly, whose `ownerKind` this widens to `thread`.
 * - A **dependency edge** is two references and a verb. That is `story_links`
 *   exactly, whose `depends_on` has been in the vocabulary since spec §7.4.
 * - A **sequence edge** is not stored at all, and §13 says why without meaning
 *   to: horizontal position is derived from script position and must not be
 *   draggable. If the order of the thread is the order of the script, then the
 *   thread's sequence *is* the script's, and a stored one is a second answer
 *   waiting to disagree with the first the next time a scene moves.
 *
 * So the only record with nowhere to live is the thread itself — a name, a
 * description, and what its connectors mean — and that is the whole of the new
 * table.
 */

/**
 * What the connectors between this thread's moments assert.
 *
 * **Sequence is drawn and never stored; dependency is stored and never drawn
 * until it is declared.** §5.1 and §5.2 draw the line and §5.2 states the rule
 * outright: the system does not infer causality. So a thread set to
 * `dependency` with nothing declared shows no connectors and a sentence saying
 * so, rather than quietly falling back to chronology and calling the order a
 * cause.
 */
export const THREAD_RELATIONSHIPS = ['sequence', 'dependency'] as const;
export const threadRelationshipSchema = z.enum(THREAD_RELATIONSHIPS);
export type ThreadRelationship = z.infer<typeof threadRelationshipSchema>;

export const storyThreadSchema = z.object({
  id: id<StoryThreadId>(),
  projectId: id<ProjectId>(),
  name: z.string().default(''),
  description: z.string().default(''),
  relationship: threadRelationshipSchema.default('sequence'),
  archived: z.boolean().default(false),
  ...timestamps,
});
export type StoryThread = z.infer<typeof storyThreadSchema>;

/**
 * What §16 lists and this deliberately does not have.
 *
 * `sequence_order` on a node, because the script already holds it (§13), and
 * `node_type`, because the spec names the idea — introduced, repeated,
 * developed, resolved — and no values, and a taxonomy invented here is a
 * vocabulary every writer would have to learn before they could write down that
 * the key turns up in scene four. The moment's own note says what it is, in the
 * writer's words.
 */
export const THREAD_NODE_OWNER_KIND = 'thread' as const;
