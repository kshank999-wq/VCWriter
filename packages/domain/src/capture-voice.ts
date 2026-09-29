import {
  CAPTURE_CATEGORIES,
  CAPTURE_CATEGORY_NAMES,
  type CaptureCategory,
} from './entities/capture.js';

/**
 * What the writer said, read as a command (addendum 09 §6, stage 4 — his §5
 * and §6).
 *
 * **The browser hears; this decides what was meant.** A recogniser hands back a
 * string, and every question after that — was a category named, was a person
 * named, is this a correction — is a rule about text, which belongs here where
 * it can be tested rather than in a component where it can only be demonstrated.
 *
 * The line this file holds is the one §2 of this addendum drew: a spoken
 * category says **what kind of thought** it is. Nothing here works out where a
 * note goes, and nothing here calls a model.
 */

export type SpokenCommand =
  /** A category was named. `text` is what was left after it. */
  | { kind: 'category'; category: CaptureCategory; subjectName: string | null; text: string }
  /** The writer said *correction*. `text` is the replacement wording. */
  | { kind: 'correction'; text: string }
  /** Ordinary dictation. */
  | { kind: 'none'; text: string };

/** The word the writer says for each of the five. */
const SPOKEN_AS: Record<CaptureCategory, string[]> = {
  character: ['character'],
  plot_point: ['plot point', 'plotpoint'],
  idea: ['idea'],
  theme: ['theme'],
  arc: ['arc'],
};

/** What the correction command sounds like. Only the word itself. */
const CORRECTION = ['correction'];

/** Leading punctuation and spacing a recogniser leaves behind a command word. */
const tidy = (text: string): string => text.replace(/^[\s,.:;—–-]+/, '').trim();

/**
 * Whether `transcript` opens with `phrase` as a **whole word**.
 *
 * Whole-word matters: *arc* must not match *architecture*, and this is the same
 * mistake `charactersCalled` was built to stop making about character cues.
 */
const opensWith = (transcript: string, phrase: string): string | null => {
  const lower = transcript.toLowerCase();
  if (!lower.startsWith(phrase)) return null;
  const after = transcript.slice(phrase.length);
  if (after.length > 0 && /[a-z0-9']/i.test(after[0] as string)) return null;
  return after;
};

/**
 * A name, only when the writer paused after it.
 *
 * **Silence is what separates a name from a sentence**, and a recogniser writes
 * a pause as a comma or a dash. Without one there is no way to tell *Marisol
 * never trusts him* from a name followed by a note, so nothing is taken and the
 * whole thing becomes the note — which the writer can see and fix, where a
 * wrong guess would have to be noticed first.
 *
 * Capped at four words: a pause can also fall in the middle of a sentence, and
 * *the audit lands the same week* is not somebody's name.
 */
const MAX_NAME_WORDS = 4;
const MAX_NAME_LENGTH = 40;

/**
 * The name a writer spoke after a category, read from the **untidied**
 * remainder — the one place that may see the pause.
 *
 * It took Ken's own sentence to find what was wrong with the first version:
 * *character, Tom* came back with no name at all. The remainder was tidied
 * before this ran, which strips the leading comma — **the very pause that
 * marks the name** — so a name could only be found when there happened to be a
 * *second* pause after it. *Character, Marisol, she never trusts him* worked;
 * *character, Tom*, which is what somebody actually says, did not.
 *
 * **There are two shapes and both are real**, which is what the first fix got
 * wrong in the other direction — it handled Ken's and broke the one already
 * shipped:
 *
 * - *Character Marisol, she never trusts him* — the pause falls **after** the
 *   name, and the name is what stands before it.
 * - *Character, Tom* — the pause falls **straight after the category**, and
 *   the name is what stands between that pause and the next one, or the end.
 *
 * With no pause anywhere nothing is taken, which is stage 4's rule and still
 * the right one: there is no way to tell *Marisol never trusts him* from a
 * name followed by a note, and a wrong guess has to be noticed before it can
 * be fixed.
 *
 * Capped at four words and forty characters, and refused outright if it has
 * sentence punctuation in it: a pause also falls in the middle of a sentence,
 * and *the audit lands the same week* is not somebody's name.
 */
const PAUSE = /[,—–]|\s-\s/;

export const nameAfterTheCategory = (
  /** What followed the category word, **before** any tidying. */
  raw: string,
): { name: string; rest: string } | null => {
  const first = raw.search(PAUSE);
  if (first < 0) return null;

  // Did the writer pause straight after the category, or after the name?
  const paused = raw.slice(0, first).trim().length === 0;
  const body = paused ? raw.slice(first + 1) : raw;
  const next = body.search(PAUSE);

  // Without a leading pause there has to be one after the name, or this was a
  // sentence; with one, the name may simply run to the end.
  if (!paused && next < 0) return null;
  const candidate = (next < 0 ? body : body.slice(0, next)).trim();

  if (candidate.length === 0 || candidate.length > MAX_NAME_LENGTH) return null;
  if (candidate.split(/\s+/).length > MAX_NAME_WORDS) return null;
  // A name has no sentence in it.
  if (/[.!?]/.test(candidate)) return null;

  return { name: candidate, rest: next < 0 ? '' : tidy(body.slice(next + 1)) };
};

/**
 * Read one utterance.
 *
 * Only the **opening** of the transcript is treated as a command: a writer who
 * says *the idea is that she never drives* is dictating, not filing, and a
 * parser that hunted for keywords anywhere would file half their notes for them.
 */
export const readSpoken = (transcript: string): SpokenCommand => {
  const said = transcript.trim();
  if (said.length === 0) return { kind: 'none', text: '' };

  for (const phrase of CORRECTION) {
    const rest = opensWith(said, phrase);
    if (rest !== null) return { kind: 'correction', text: tidy(rest) };
  }

  for (const category of CAPTURE_CATEGORIES) {
    for (const phrase of SPOKEN_AS[category]) {
      const rest = opensWith(said, phrase);
      if (rest === null) continue;

      // Only the two that are about a person take a name (§4): *Idea, the audit
      // lands the same week* has a pause in it and nobody in it.
      const named =
        category === 'character' || category === 'arc' ? nameAfterTheCategory(rest) : null;

      return {
        kind: 'category',
        category,
        subjectName: named?.name ?? null,
        text: named?.rest ?? tidy(rest),
      };
    }
  }

  return { kind: 'none', text: said };
};

/**
 * What the app says back (his §5.7).
 *
 * The category and the name first, because those are the two things a writer
 * cannot see when the phone is in their pocket and are the two a recogniser is
 * most likely to have got wrong. Then the note, exactly as it stands — a
 * read-back that tidied the words would be confirming something other than what
 * would be saved.
 */
export const sayBack = (note: {
  category: CaptureCategory | null;
  subjectName: string | null;
  text: string;
}): string => {
  const head = note.category ? CAPTURE_CATEGORY_NAMES[note.category] : 'Note';
  const who = note.subjectName?.trim();
  const opening = who && who.length > 0 ? `${head}, ${who}.` : `${head}.`;
  return note.text.trim().length > 0 ? `${opening} ${note.text.trim()}` : opening;
};

/**
 * What a correction does to the note (his §6).
 *
 * **It replaces**, because that is what the word means. §6 allows a correction
 * to be a clarification instead, and an interpretation layer could tell the two
 * apart — but a model deciding whether to replace or append is a model that will
 * sometimes throw away a sentence the writer wanted kept, silently, in a room
 * where they cannot see the screen. So: it replaces, the previous wording is
 * handed back, and putting it back is one press.
 */
export const applyCorrection = (
  current: string,
  spoken: string,
): { text: string; previous: string } => ({
  text: spoken.trim(),
  previous: current,
});
