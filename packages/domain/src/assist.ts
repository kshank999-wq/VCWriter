import { z } from 'zod';
import { roleCan, type RoomRole } from './room.js';
import { originSchema, type Origin } from './entities/structure.js';

/**
 * The room's AI (addendum 07 §14, stage 12).
 *
 * §14 gives three rules and every one of them is a consequence of §1. Two of
 * them are enforced by the shape of what comes back rather than by asking the
 * model nicely, which is the whole design of this file.
 *
 * **It never rewrites another writer's work — and it cannot.** A prompt saying
 * *do not rewrite* is a request; an output schema with nowhere to put a rewrite
 * is a fact. Every reading here returns observations, quotes and groupings, and
 * there is no field anywhere in it that can carry replacement prose. Nothing it
 * returns is ever written into a document by anything in this codebase: a
 * reading is shown to a person, and the person decides.
 *
 * **Anything it helps make is labelled AI-assisted and attributed to whoever
 * asked.** Not to the AI — a room is people, and a badge naming a machine as a
 * contributor would be a lie about who is responsible. `assisted` rides on the
 * `origin` a record already carries, so a scene written with help is a
 * contribution like any other, with a person's name on it and a mark saying how
 * it was made.
 *
 * **Whether the room uses it at all is the owner's**, and asking is the only
 * thing here that costs money.
 */

// -------------------------------------------------------------- who may ask

/**
 * Whether this role may ask for a reading.
 *
 * Tied to `readAllContributions` rather than to a role list: the useful
 * readings are *about* several writers' work at once, and somebody who may not
 * read the contributions must not be able to get them summarised instead. An
 * Editor has that right and so does the Owner; a Writer sees their own line and
 * a Viewer sees the master, and neither has anything to compare.
 */
export const canAssist = (role: RoomRole | null): boolean =>
  role !== null && roleCan(role, 'readAllContributions');

export type AssistRefusal =
  | { reason: 'cannot_assist' }
  | { reason: 'room_off' }
  | { reason: 'not_enough' }
  | { reason: 'unavailable' };

export const assistRefusalText = (refusal: AssistRefusal): string => {
  switch (refusal.reason) {
    case 'cannot_assist':
      return 'Reading the room’s work with AI is for whoever reads all of it.';
    case 'room_off':
      return 'This room has AI turned off. The showrunner decides.';
    case 'not_enough':
      return 'There is not enough here to compare yet.';
    case 'unavailable':
      return 'AI is not available on this deployment.';
  }
};

// ------------------------------------------------------- what comes back

/**
 * One thing noticed about two passes at the same material.
 *
 * **There is no `suggestion` field and there will not be one.** A reader who
 * wants the AI to write the merged version is asking it to decide, and deciding
 * between two writers is the showrunner's job and the reason the module exists
 * (§3.3). What it may do is say what differs and what each does better, with
 * the writers' own words quoted back.
 */
export const comparisonPointSchema = z.object({
  /** What this observation is about — *the ending*, *Mara's silence*. */
  about: z.string(),
  /** What the first pass does, in the reading's words. */
  inFirst: z.string(),
  /** What the second does. */
  inSecond: z.string(),
  /**
   * Which one this point favours, where it favours one.
   *
   * A judgement, offered and never applied: nothing in the product acts on it,
   * and `neither` is a real and common answer.
   */
  favours: z.enum(['first', 'second', 'neither']).default('neither'),
});
export type ComparisonPoint = z.infer<typeof comparisonPointSchema>;

export const comparisonSchema = z.object({
  /** What the two are both trying to do, said once so the points can be short. */
  bothTrying: z.string().default(''),
  points: z.array(comparisonPointSchema).default([]),
  /** What is in one and simply absent from the other. */
  onlyInFirst: z.array(z.string()).default([]),
  onlyInSecond: z.array(z.string()).default([]),
});
export type Comparison = z.infer<typeof comparisonSchema>;

/** A set of ideas the reading thinks are the same idea. */
export const duplicateGroupSchema = z.object({
  /** The ids of the items it groups. Ids, so nothing is quoted back wrongly. */
  itemIds: z.array(z.string()).min(2),
  /** What the room is saying twice, in one line. */
  theSameIdea: z.string(),
  /** Why they are not quite the same, where they are not. */
  butDifferent: z.string().default(''),
});
export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>;

export const duplicatesSchema = z.object({
  groups: z.array(duplicateGroupSchema).default([]),
});
export type Duplicates = z.infer<typeof duplicatesSchema>;

/**
 * What a reading is worth, said to the reader.
 *
 * Attached to every reading rather than written once in a help page, because
 * this is the sentence that stops somebody treating it as a decision — and the
 * place it has to be read is next to the answer.
 */
export const READING_CAVEAT =
  'A reading, not a decision. Nothing here changes anybody’s draft, and choosing between two passes is yours.';

// ------------------------------------------------- labelling what it helped make

/**
 * Mark a record as made with AI help, by the person who asked.
 *
 * **The person, never the machine.** A room is people; a badge naming an AI as
 * a contributor would be a lie about who is responsible for the words. So this
 * is the same `origin` as any other work, with one more true thing said about
 * it — which is also why it needed no new column: `origin` is already carried
 * as JSON wherever a record lives.
 */
export const assistedBy = (authorId: string, at: string): Origin =>
  originSchema.parse({ authorId, at, assisted: true });

/** Whether a record says it was made with help. */
export const wasAssisted = (origin: Origin | null | undefined): boolean => origin?.assisted === true;

/** What a badge says about an assisted record, beside the writer's name. */
export const ASSISTED_LABEL = 'AI-assisted';

// ----------------------------------------------------------- the room's switch

/**
 * What the room has decided about AI (§14 — *usage controls are the owner's*).
 *
 * One switch, and it is the owner's. A spending cap is a different and larger
 * promise — it needs metering per room and a decision about what happens when
 * it is reached — and saying that here is better than shipping a limit that
 * silently does not hold. What exists meanwhile is the account rate limit every
 * AI call in the product already goes through.
 */
export const roomAiSchema = z.object({
  enabled: z.boolean().default(true),
});
export type RoomAi = z.infer<typeof roomAiSchema>;

/** Whether a reading can be asked for here, and why not where it cannot. */
export const canAskHere = (input: {
  role: RoomRole | null;
  roomEnabled: boolean;
  configured: boolean;
}): true | AssistRefusal => {
  if (!input.configured) return { reason: 'unavailable' };
  if (!input.roomEnabled) return { reason: 'room_off' };
  if (!canAssist(input.role)) return { reason: 'cannot_assist' };
  return true;
};
