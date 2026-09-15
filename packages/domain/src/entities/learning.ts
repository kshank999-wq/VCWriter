import { z } from 'zod';
import { id, timestamps } from './common.js';
import type { BeatId, LearningAidId, ProjectId } from '../ids.js';

/**
 * End-of-section learning aids (addendum 16 §10, from Ken's spec).
 *
 * A summary, a *what you learned* list and a set of review questions, attached
 * to a section and printed at the end of it.
 *
 * §10 makes three demands of the AI-assisted half and the **shape of the record
 * is what keeps all three**, rather than a rule somewhere that has to be
 * remembered:
 *
 *  1. *Generated material must remain editable* — so what the machine writes
 *     lands in a field the author can type over.
 *  2. *…and require author approval before becoming part of the manuscript* —
 *     so an aid prints only when `approved`, and nothing approves itself.
 *  3. *Regeneration should not overwrite author-edited content without an
 *     explicit action* — and this is the one worth being careful about.
 *
 * The third rule is kept **structurally**: there are two fields, and
 * regeneration writes to only one of them. `text` is the author's and is the
 * only thing that ever prints; `suggestion` is what the machine last offered
 * and is never printed. Regenerating cannot overwrite an edit because it does
 * not write where edits live. The explicit action §10 asks for is *accepting*
 * a suggestion, which is the single operation that moves machine words into
 * the author's field — and it hands back what it replaced, so the interface can
 * offer it again.
 *
 * The alternative — one field and a `hasBeenEdited` flag — puts the whole rule
 * on a boolean that has to be set correctly by every code path that touches
 * the text. The first path that forgets silently eats an afternoon's work.
 */

/**
 * Three kinds, and they are a closed list on purpose.
 *
 * §10 names exactly these three. A writer wanting a fourth thing at the end of
 * a section has the manuscript itself, which is where free-form content
 * belongs; a learning aid is a *named* structure a reader learns to expect in
 * the same place in every chapter, and an open list would end that.
 */
export const LEARNING_AID_KINDS = ['summary', 'what_you_learned', 'quiz'] as const;
export const learningAidKindSchema = z.enum(LEARNING_AID_KINDS);
export type LearningAidKind = z.infer<typeof learningAidKindSchema>;

/**
 * One review question.
 *
 * A quiz is the one aid whose content is not prose, and **the fields genuinely
 * differ** — which is the same reason a theme is not a motif (addendum 12 §2).
 * A question has an answer; a summary does not, and a summary crammed into a
 * `prompt`/`answer` pair would carry one of them empty forever.
 *
 * The answer may be empty: plenty of textbooks print review questions and put
 * the answers at the back, or nowhere.
 */
export const reviewQuestionSchema = z.object({
  prompt: z.string().default(''),
  answer: z.string().default(''),
});
export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>;

export const learningAidSchema = z.object({
  id: id<LearningAidId>(),
  projectId: id<ProjectId>(),
  /** The section it belongs to. A beat, which is what §2 calls a Section. */
  beatId: id<BeatId>(),
  kind: learningAidKindSchema,
  /**
   * The author's words, and **the only thing that prints**.
   *
   * For a summary, the prose. For *what you learned*, one bullet a line — a
   * list rather than a nested structure, because a bullet is a sentence and
   * giving it fields it does not have is how an interface grows forms nobody
   * asked for.
   *
   * Empty on a quiz, which keeps its content in `questions` below.
   */
  text: z.string().default(''),
  /** A quiz's questions. Empty on the two prose kinds. */
  questions: z.array(reviewQuestionSchema).default([]),
  /**
   * What the machine last offered, in the same shape as above.
   *
   * **Never printed, and never merged on its own.** Regeneration writes here
   * and only here, which is what makes regenerating always safe.
   */
  suggestion: z.string().default(''),
  suggestedQuestions: z.array(reviewQuestionSchema).default([]),
  suggestedAt: z.string().nullable().default(null),
  /**
   * Whether it is part of the book (§10).
   *
   * False until the author says so, and **nothing sets it but the author**.
   * Generation does not approve, and accepting a suggestion does not approve
   * either — accepting is *these are the right words*, approving is *this goes
   * in the book*, and they are different decisions that happen to be adjacent.
   */
  approved: z.boolean().default(false),
  ...timestamps,
});
export type LearningAid = z.infer<typeof learningAidSchema>;

/**
 * What a generation may hand back — and nothing else.
 *
 * The same trick the Writers Room's AI rests on (addendum 07 §12): **the shape
 * is the permission.** There is no field here for the author's `text`, for
 * `approved`, or for which section this belongs to, so a model that decided to
 * approve its own work, or to rewrite what the author had already written, has
 * nowhere to put it. The parse drops anything else.
 */
export const learningSuggestionSchema = z.object({
  text: z.string().default(''),
  questions: z.array(reviewQuestionSchema).default([]),
});
export type LearningSuggestion = z.infer<typeof learningSuggestionSchema>;
