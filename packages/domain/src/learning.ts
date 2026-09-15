import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { learningAidSchema, learningSuggestionSchema } from './entities/learning.js';
import type { LearningAid, LearningAidKind, LearningSuggestion, ReviewQuestion } from './entities/learning.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, LearningAidId } from './ids.js';

/**
 * Learning aids (addendum 16 §10).
 *
 * Everything here defends the three rules `entities/learning.ts` sets out, and
 * the one worth stating again: **regeneration cannot overwrite an author's
 * edit, because regeneration does not write where edits live.** `suggest`
 * touches `suggestion`; `accept` is the only thing that moves those words into
 * `text`, and it is an act the author takes.
 */

const EMPTY: Record<LearningAidKind, string> = {
  summary: 'Summary',
  what_you_learned: 'What you learned',
  quiz: 'Review questions',
};

/** What a kind is called, wherever one is named. */
export const aidTitle = (kind: LearningAidKind): string => EMPTY[kind];

// ------------------------------------------------------------------ making

/**
 * The aid of this kind on this section, making an empty one if there is none.
 *
 * One of each kind per section, enforced here rather than by a constraint: a
 * section with two summaries is not a thing anybody wants, and asking twice
 * returning the same aid is what lets every screen call this without checking.
 */
export const aidFor = (
  file: ProjectFile,
  beatId: BeatId,
  kind: LearningAidKind,
): { file: ProjectFile; aid: LearningAid } => {
  const existing = (file.learningAids ?? []).find(
    (one) => one.beatId === beatId && one.kind === kind,
  );
  if (existing) return { file, aid: existing };

  const at = nowIso();
  const aid = learningAidSchema.parse({
    id: newId<LearningAidId>(),
    projectId: file.project.id,
    beatId,
    kind,
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, learningAids: [...(file.learningAids ?? []), aid] }, aid };
};

const patchAid = (
  file: ProjectFile,
  aidId: LearningAidId,
  patch: Partial<LearningAid>,
): ProjectFile => ({
  ...file,
  learningAids: (file.learningAids ?? []).map((one) =>
    one.id === aidId ? learningAidSchema.parse({ ...one, ...patch, updatedAt: nowIso() }) : one,
  ),
});

/** The author writing their own. The ordinary case, and the one that needs no AI at all. */
export const writeAid = (
  file: ProjectFile,
  aidId: LearningAidId,
  input: { text?: string; questions?: ReviewQuestion[] },
): ProjectFile =>
  patchAid(file, aidId, {
    ...(input.text === undefined ? {} : { text: input.text }),
    ...(input.questions === undefined ? {} : { questions: input.questions }),
  });

/**
 * Put it in the book, or take it out again (§10's approval).
 *
 * Reversible and non-destructive: unapproving hides the aid from the printed
 * book and keeps every word of it, because an author trying a chapter without
 * its summary should not have to write the summary again afterwards.
 */
export const approveAid = (file: ProjectFile, aidId: LearningAidId, approved = true): ProjectFile =>
  patchAid(file, aidId, { approved });

export const removeAid = (file: ProjectFile, aidId: LearningAidId): ProjectFile => ({
  ...file,
  learningAids: (file.learningAids ?? []).filter((one) => one.id !== aidId),
});

// -------------------------------------------------------- the machine's half

/**
 * Record what a generation offered.
 *
 * **Writes to `suggestion` and to nothing else** — never to `text`, never to
 * `questions`, never to `approved`. That is §10's third rule, kept by the code
 * rather than by a promise: calling this twice, or a hundred times, cannot cost
 * an author a word they wrote.
 *
 * It parses through the domain's own schema as well as whatever the caller
 * used, so a reading that arrived with extra fields loses them here.
 */
export const suggestAid = (
  file: ProjectFile,
  aidId: LearningAidId,
  offered: LearningSuggestion,
): ProjectFile => {
  const clean = learningSuggestionSchema.parse(offered);
  return patchAid(file, aidId, {
    suggestion: clean.text,
    suggestedQuestions: clean.questions,
    suggestedAt: nowIso(),
  });
};

/**
 * The explicit action §10 asks for: take the suggestion as the words.
 *
 * **Hands back what it replaced**, so the interface can offer it again — the
 * same choice `capture-voice`'s correction makes, and for the same reason: a
 * one-way replacement will one day throw away a paragraph somebody wanted, and
 * an undo that exists only if somebody thought to keep a copy does not exist.
 *
 * Accepting does not approve. *These are the right words* and *this goes in the
 * book* are different decisions that happen to sit next to each other.
 */
export const acceptSuggestion = (
  file: ProjectFile,
  aidId: LearningAidId,
): { file: ProjectFile; replaced: { text: string; questions: ReviewQuestion[] } | null } => {
  const aid = (file.learningAids ?? []).find((one) => one.id === aidId);
  if (!aid) return { file, replaced: null };
  if (aid.suggestion.trim().length === 0 && aid.suggestedQuestions.length === 0) {
    // Nothing on offer. Refused rather than blanking the author's words, which
    // is what a naive copy would do.
    return { file, replaced: null };
  }

  const replaced = { text: aid.text, questions: aid.questions };
  const next = patchAid(file, aidId, {
    text: aid.kind === 'quiz' ? '' : aid.suggestion,
    questions: aid.kind === 'quiz' ? aid.suggestedQuestions : [],
    // Cleared, so the screen stops offering something already taken.
    suggestion: '',
    suggestedQuestions: [],
    suggestedAt: null,
  });
  return { file: next, replaced };
};

/** Throw the suggestion away without touching the author's words. */
export const discardSuggestion = (file: ProjectFile, aidId: LearningAidId): ProjectFile =>
  patchAid(file, aidId, { suggestion: '', suggestedQuestions: [], suggestedAt: null });

// -------------------------------------------------------------- the reading

export interface AidStanding {
  aid: LearningAid;
  /** Whether the author has written anything at all. */
  written: boolean;
  /** Whether a suggestion is waiting to be looked at. */
  offered: boolean;
  /** One line: what this aid is, and what it is waiting for. */
  says: string;
}

/**
 * Where an aid stands, in a sentence.
 *
 * Says what is true rather than what is missing: an empty aid is not a fault,
 * because §10 says these are **optional**. A chapter with no quiz is a chapter
 * the author did not want a quiz on.
 */
export const aidStanding = (aid: LearningAid): AidStanding => {
  const written =
    aid.kind === 'quiz' ? aid.questions.length > 0 : aid.text.trim().length > 0;
  const offered = aid.suggestion.trim().length > 0 || aid.suggestedQuestions.length > 0;

  const says = !written && !offered
    ? 'Nothing written yet.'
    : offered && written
      ? 'A suggestion is waiting. Accepting it replaces what you wrote, and hands the old wording back.'
      : offered
        ? 'A suggestion is waiting.'
        : aid.approved
          ? 'In the book.'
          : 'Written, and not in the book yet.';

  return { aid, written, offered, says };
};

/** Every aid on one section, in the order §10 lists them. */
export const aidsOn = (file: ProjectFile, beatId: BeatId): LearningAid[] => {
  const order: LearningAidKind[] = ['summary', 'what_you_learned', 'quiz'];
  return (file.learningAids ?? [])
    .filter((one) => one.beatId === beatId)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
};

/**
 * What prints at the end of a section: the approved aids, in order.
 *
 * The **one** reading the manuscript and the printed book both go through, so
 * a writer looking at the screen and a reader holding the book cannot be shown
 * different ends to a chapter.
 */
export const printedAidsOn = (file: ProjectFile, beatId: BeatId): LearningAid[] =>
  aidsOn(file, beatId).filter((one) => one.approved && aidStanding(one).written);

/** An aid whose section was cut. Kept, because the words in it are the author's. */
export const orphanedAids = (file: ProjectFile): LearningAid[] => {
  const beats = new Set(file.beats.map((one) => one.id as string));
  return (file.learningAids ?? []).filter((one) => !beats.has(one.beatId as string));
};

/** What the book's aids owe, in one line. */
export const describeAids = (file: ProjectFile): string => {
  const all = (file.learningAids ?? []).filter((one) => aidStanding(one).written);
  if (all.length === 0) return 'No learning aids yet.';
  const waiting = all.filter((one) => !one.approved).length;
  const noun = all.length === 1 ? 'aid' : 'aids';
  if (waiting === 0) return `${all.length} ${noun}, all in the book.`;
  return `${all.length} ${noun} · ${waiting} not in the book yet`;
};

/**
 * The words a generation should read: the section's own manuscript.
 *
 * §10 says the aids are generated *from the section's actual content*, and this
 * is that content and nothing else — not the chapter around it, not the
 * author's research, not the rest of the book. A summary of a section that
 * quietly drew on the next one is a summary that promises the reader something
 * they have not been told.
 */
export const sectionTextFor = (file: ProjectFile, beatId: BeatId): string => {
  const beat = file.beats.find((one) => one.id === beatId);
  if (!beat) return '';
  return beat.manuscript.elements
    // A figure's caption is not the teaching, and a picture cannot be read here.
    .filter((element) => element.type !== 'figure')
    .map((element) => element.text.trim())
    .filter((text) => text.length > 0)
    .join('\n\n');
};

/** Every section of the book that has words in it, for a *generate them all* pass. */
export const sectionsWorthAiding = (file: ProjectFile): { beatId: BeatId; title: string; words: number }[] => {
  const found: { beatId: BeatId; title: string; words: number }[] = [];
  for (const unit of unitsInStoryOrder(file)) {
    for (const beat of beatsForUnit(file, unit.id)) {
      const words = sectionTextFor(file, beat.id).split(/\s+/).filter((one) => one.length > 0).length;
      if (words === 0) continue;
      found.push({ beatId: beat.id, title: beat.title || unit.title, words });
    }
  }
  return found;
};

export { LEARNING_AID_KINDS, learningAidSchema, learningSuggestionSchema } from './entities/learning.js';
export type { LearningAid, LearningAidKind, LearningSuggestion, ReviewQuestion } from './entities/learning.js';
