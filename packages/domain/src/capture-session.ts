import {
  captureVocabulary,
  formatNamed,
  formatSpokenName,
  spokenFormatNames,
  type CaptureKey,
  type SpokenCategory,
} from './capture-vocabulary.js';
import { nameAfterTheCategory } from './capture-voice.js';
import type { ProjectFormat } from './entities/project.js';

/**
 * A hands-free sitting at the phone (addendum 09 §10, from Ken).
 *
 * *You can say Project Jinn, character, Tom. And then it'll beep and you'll
 * start that note… then you can say something that will turn it off without
 * making that word unavailable when you're using the notes. Maybe you can say
 * dictate done. And then it saves the note. Then you could say dictate new
 * setting.*
 *
 * **The whole design is in the problem he stated.** A voice notebook you use
 * while walking cannot ask you to press anything between notes, so the words
 * that end a note have to be said out loud — and any word that ends a note is
 * a word you can no longer put *in* one. Ken's answer is the right one and it
 * is the only one that scales: **every command is prefixed `dictate`**, so the
 * command vocabulary and the writing vocabulary never overlap, and a note may
 * contain *done*, *idea*, *character*, *project* and *correction* as freely as
 * any other words.
 *
 * Two states and one rule each.
 *
 * **While a note is open, nothing but `dictate …` is a command.** Everything
 * said is the note. This is what makes the phone safe to talk into.
 *
 * **While nothing is open, a bare category word may also start one** — Ken's
 * *or you can just say idea, and it can go into your ideas folder*. It is safe
 * there for the reason it is unsafe inside a note: there is no note for the
 * word to have belonged to.
 *
 * Nothing here hears, beeps, saves or files. It reads a string and says what
 * was meant, which is `readSpoken`'s rule (stage 4) applied to a sitting
 * rather than to a single utterance — testable rather than merely
 * demonstrable, which matters more here than anywhere, because the screen is
 * in somebody's pocket.
 */

/** What one utterance turned out to be. */
export type SpokenTurn =
  /** Open a note of this kind. `text` is whatever followed the command. */
  | { kind: 'start'; key: CaptureKey | null; subjectName: string | null; text: string }
  /** *dictate done* — file the open note. */
  | { kind: 'finish' }
  /** *dictate project Jinn* — address what follows to that project. */
  | { kind: 'project'; name: string }
  /**
   * *dictate group Marketing* — put what follows under that word (§12).
   *
   * An empty name asks rather than guesses: it is a writer who has not finished
   * the sentence, and clearing is its own command.
   */
  | { kind: 'group'; name: string }
  /** *dictate no group* — come back out of it. */
  | { kind: 'ungroup' }
  /** *dictate new project The Lamp* — begin making one. Nothing is made yet. */
  | { kind: 'making'; name: string }
  /** *dictate yes* — the one word that makes it (§11). */
  | { kind: 'yes' }
  /** *dictate correction …* — replace the open note's words. */
  | { kind: 'correction'; text: string }
  /** *dictate scratch that* — throw the open note away. */
  | { kind: 'scratch' }
  /** *command erase all* — empty the open note and start it again (addendum 27 §16). */
  | { kind: 'eraseAll' }
  /** *command erase word* — take back the last word, or the last `count`. */
  | { kind: 'eraseWords'; count: number }
  /** *command next* — what follows is the note's body rather than its title. */
  | { kind: 'toBody' }
  /** *command title* — what follows is the note's title (its name) again. */
  | { kind: 'toTitle' }
  /**
   * `dictate` followed by something this build does not know.
   *
   * **Said rather than swallowed.** A writer who gave a command believes they
   * gave one; quietly writing *dictate nwe setting* into the middle of their
   * note is the worst of the three things that could happen to it, because it
   * is the one they will not notice until they are back at the desk.
   */
  | { kind: 'unknown'; said: string }
  /** Ordinary words. */
  | { kind: 'words'; text: string };

/** The word every command begins with. Ken's, and the point of the design. */
export const WAKE = 'dictate';

/**
 * **Either word starts a command** (addendum 27 §16, from Ken: *we need something like
 * command next — some word that will be used a lot that will signal where
 * we're about to give a command*). *Dictate* was the first and still works;
 * *command* is the word he reached for on the walk, and it says what it is.
 */
export const WAKE_WORDS = ['command', WAKE] as const;

/** The word the screens teach. */
export const COMMAND_WORD = 'command';

/** *dictate done*, and what else plainly means it. */
const FINISH = ['done', 'save', 'save it', 'that is it', "that's it", 'end note', 'finished'];
const SCRATCH = ['scratch that', 'scratch', 'cancel', 'throw it away', 'delete that'];
const PROJECT = ['project'];
/** Beginning a new one. Checked **before** `project`, which switches to one. */
const NEW_PROJECT = ['new project', 'a new project', 'start a project', 'start a new project', 'make a project'];
/** The one word that makes it. Deliberately not *ok*, which is said in passing. */
const YES = ['yes', 'make it', 'do it', 'that is right', "that's right", 'confirm'];
const CORRECTION = ['correction', 'correct that'];
/**
 * Putting what follows under a word of the writer's own (§12).
 *
 * **Generous in, one key out** — *group* is what somebody says while walking,
 * *subcategory* is Ken's own word and what the record is called, and the rest
 * are what the same thought sounds like out loud. Checked **after** `UNGROUP`,
 * which would otherwise be read as a group called *group*.
 */
const GROUP = ['group', 'subgroup', 'subcategory', 'sub category', 'folder', 'topic', 'under'];
const UNGROUP = ['no group', 'no folder', 'no topic', 'no subcategory', 'ungroup', 'out of that group'];
/**
 * Taking words back (addendum 27 §16, from Ken: *there needs to be a way to reset… and we
 * need something where we can erase word and it'll go back each word*).
 * Checked before everything else a command might open with, so *erase* is
 * never read as the start of something else.
 */
const ERASE_ALL = [
  'erase all',
  'erase it all',
  'erase everything',
  'erase the whole thing',
  'clear all',
  'clear everything',
  'delete all',
  'delete everything',
  'reset',
  'start over',
  'start again',
];
const ERASE_WORD = [
  'erase word',
  'erase a word',
  'erase that word',
  'erase last word',
  'erase the last word',
  'delete word',
  'delete a word',
  'delete last word',
  'delete the last word',
  'backspace',
  'back space',
];
/** *Erase three words*: a count, said or written. */
const ERASE_COUNT = /^(?:erase|delete)\s+(?:the\s+last\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+words?\b/i;
const COUNTS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
/** From the title to the body, and back (addendum 27 §16). */
const TO_BODY = ['next', 'body', 'the body', 'go to the body', 'next part', 'now the note'];
const TO_TITLE = ['title', 'the title', 'back to the title', 'go to the title', 'heading', 'name'];

/** Fillers a writer says before a category and means nothing by. */
const FILLER = ['new', 'a new', 'another', 'a'];

/** Leading punctuation and spacing a recogniser leaves behind a command word. */
const tidy = (text: string): string => text.replace(/^[\s,.:;—–-]+/, '').trim();

/**
 * Whether `said` opens with `phrase` as a **whole word**.
 *
 * Whole-word matters here for `readSpoken`'s reason: *arc* must not match
 * *architecture*, and *a* must not eat the first letter of every note.
 */
const opensWith = (said: string, phrase: string): string | null => {
  const lower = said.toLowerCase();
  if (!lower.startsWith(phrase.toLowerCase())) return null;
  const after = said.slice(phrase.length);
  if (after.length > 0 && /[a-z0-9']/i.test(after[0] as string)) return null;
  // Untidied: the name rule is the one thing allowed to see the pause, and
  // tidying here is what hid Ken's own *character, Tom* from it.
  return after;
};

/** The first of `phrases` that opens `said`, longest first so *plot point* wins. */
const opensWithAny = (said: string, phrases: readonly string[]): string | null => {
  for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
    const rest = opensWith(said, phrase);
    if (rest !== null) return tidy(rest);
  }
  return null;
};

/** A category named at the opening of `said`, or null. */
const categoryAt = (said: string, vocabulary: readonly SpokenCategory[]): SpokenTurn | null => {
  // Longest phrase first across the whole vocabulary, so *plot point* is not
  // read as *plot* with *point* left over.
  const all = vocabulary
    .flatMap((one) => one.spoken.map((phrase) => ({ one, phrase })))
    .sort((a, b) => b.phrase.length - a.phrase.length);

  for (const { one, phrase } of all) {
    const rest = opensWith(said, phrase);
    if (rest === null) continue;
    const named = one.takesName ? nameAfterTheCategory(rest) : null;
    return {
      kind: 'start',
      key: one.key,
      subjectName: named?.name ?? null,
      text: named?.rest ?? tidy(rest),
    };
  }
  return null;
};

/**
 * Read one utterance, knowing whether a note is open.
 *
 * `open` is the whole of the state this needs, which is why the reading is a
 * function rather than a machine: a sitting is a fold of this over what was
 * said, and every step of it can be checked on its own.
 */
export const readTurn = (
  said: string,
  where: { open: boolean; format: ProjectFormat; onTitle?: boolean },
): SpokenTurn => {
  const text = said.trim();
  if (text.length === 0) return { kind: 'words', text: '' };

  const vocabulary = captureVocabulary(where.format);
  const after0 = WAKE_WORDS.map((word) => opensWith(text, word)).find((rest) => rest !== null) ?? null;
  const after = after0 === null ? null : tidy(after0);

  if (after !== null) {
    // `dictate` on its own is a writer who has not finished the sentence.
    if (after.length === 0) return { kind: 'unknown', said: text };

    // Erasing first: *erase all* must not be read as anything else.
    if (opensWithAny(after, ERASE_ALL) !== null) return { kind: 'eraseAll' };
    const counted = ERASE_COUNT.exec(after);
    if (counted) {
      const said = (counted[1] ?? '1').toLowerCase();
      return { kind: 'eraseWords', count: Math.max(1, Number(said) || COUNTS[said] || 1) };
    }
    if (opensWithAny(after, ERASE_WORD) !== null) return { kind: 'eraseWords', count: 1 };
    // A whole utterance only: *next* and *title* are ordinary words at the
    // start of a sentence, so they are commands when they are all that was said.
    const alone = after.replace(/[.!?]+$/, '').trim().toLowerCase();
    if (TO_BODY.includes(alone)) return { kind: 'toBody' };
    if (TO_TITLE.includes(alone)) return { kind: 'toTitle' };

    if (opensWithAny(after, FINISH) !== null) return { kind: 'finish' };
    if (opensWithAny(after, SCRATCH) !== null) return { kind: 'scratch' };
    if (opensWithAny(after, YES) !== null) return { kind: 'yes' };

    // Before `project`: *dictate new project Jinn* makes one, *dictate project
    // Jinn* moves to one, and the filler stripper below would otherwise turn
    // the first into the second by eating the word *new*.
    const making = opensWithAny(after, NEW_PROJECT);
    if (making !== null) return { kind: 'making', name: making };

    const corrected = opensWithAny(after, CORRECTION);
    if (corrected !== null) return { kind: 'correction', text: corrected };

    const project = opensWithAny(after, PROJECT);
    if (project !== null) return { kind: 'project', name: project };

    // *dictate new setting* and *dictate setting* are the same thing.
    const withoutFiller = opensWithAny(after, FILLER) ?? after;

    // Read against both spellings for the filler's own reason: *dictate new
    // group Marketing* and *dictate group Marketing* are one act, and the
    // stripper is what tells them apart. `UNGROUP` first — *no group* opens
    // with neither word the other list holds, but *group* opens with one.
    if (opensWithAny(after, UNGROUP) !== null || opensWithAny(withoutFiller, UNGROUP) !== null) {
      return { kind: 'ungroup' };
    }
    const grouped = opensWithAny(after, GROUP) ?? opensWithAny(withoutFiller, GROUP);
    if (grouped !== null) return { kind: 'group', name: grouped };

    const category = categoryAt(withoutFiller, vocabulary) ?? categoryAt(after, vocabulary);
    if (category) return category;

    return { kind: 'unknown', said: text };
  }

  // On a title, *next* said on its own moves to the body (addendum 27 §17,
  // from Ken: *I said, next… and it didn't move on to the body*). A title that
  // is only the word *next* is not one anybody means.
  if (where.onTitle && TO_BODY.includes(text.replace(/[.!?]+$/, '').trim().toLowerCase())) return { kind: 'toBody' };

  // Outside a note a bare category word starts one; inside, it is just a word.
  if (!where.open) {
    const category = categoryAt(text, vocabulary);
    if (category) return category;
  }

  return { kind: 'words', text };
};

// --------------------------------------------------------------- the sitting

/** A note being spoken. */
export interface OpenNote {
  key: CaptureKey | null;
  subjectName: string | null;
  text: string;
  /**
   * The writer's own word this note was said under, or null (§12).
   *
   * **A word on the note and never a folder in the project.** Nothing is
   * created by saying it — §1's line is that the phone captures and the desktop
   * places, and a taxonomy growing out of somebody's pocket is exactly the
   * folder tree §2 refuses. What it buys is that a walk arrives at the desk
   * already sorted, and that filing the whole of one group is one press there.
   */
  group: string | null;
  /**
   * Which part of the note the next words go into (addendum 27 §16, from Ken: *there's no
   * way to switch from the title or the character to the actual body*).
   *
   * A note opened by naming a person, a place or an arc with nothing after
   * it starts on its **title** — the name — and *command next* moves to the
   * body; *command title* goes back. Absent means the body, which is every
   * note there was before this and every note opened with words after it.
   */
  on?: 'title' | 'body';
}

/**
 * A note as it is filed: the part being spoken into is the sitting's business,
 * not the note's.
 */
const asFiled = (open: OpenNote): OpenNote => {
  const { on: _on, ...note } = open;
  return note;
};

/**
 * Whether a breath said on the title is a title (addendum 27 §16). A name is a few words;
 * a sentence said there is the note itself, so it goes to the body and the
 * note moves on with it — which is what Ken's first walk did (*dictate new
 * setting*, then *the kitchen is too small for the table in it*), and what
 * nobody should have to say *command next* to get.
 */
const TITLE_WORDS = 4;
const isTitle = (words: string): boolean => words.trim().split(/\s+/).filter(Boolean).length <= TITLE_WORDS;

/**
 * Whether a kind of note starts on a title (addendum 27 §16–17): one that names
 * somebody or somewhere, and the book's own parts — a chapter, a section, a
 * subsection, a scene — which have headings. An idea, a theme, a plot point or
 * research is all body, so *idea*, then *she drives a lorry*, is the note.
 */
const hasTitle = (key: CaptureKey | null, format: ProjectFormat): boolean => {
  if (key === null) return false;
  if (key === 'unit' || key === 'sub' || key === 'scene') return true;
  return captureVocabulary(format).find((one) => one.key === key)?.takesName ?? false;
};

/** The words of a note's title, for a name said over more than one breath. */
const titleOf = (open: OpenNote): string => (open.subjectName ?? '').trim();

/**
 * Take the last `count` words off a piece of text, and say which went.
 */
const dropWords = (text: string, count: number): { text: string; gone: string } => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const keep = words.slice(0, Math.max(0, words.length - count));
  return { text: keep.join(' '), gone: words.slice(keep.length).join(' ') };
};

/**
 * A project being made, before it exists (§11).
 *
 * **Held here and nowhere else until it is confirmed**, which is the whole
 * rule: a mis-heard *novel* would make a document whose chapters are scenes,
 * found out about a fortnight later, and something created by accident is the
 * one thing this app has never done. So the name and the format are gathered,
 * said back, and made only by a word whose only job is to make it.
 */
export interface ProjectPlan {
  name: string;
  format: ProjectFormat | null;
}

export interface Sitting {
  /** The note being spoken, or null between notes. */
  open: OpenNote | null;
  /**
   * The group every note is being said under, or null (§12).
   *
   * **It sticks, which is the whole reason it is worth saying**: a writer
   * walking with six thoughts about one thing says the word once. Like the
   * project, and unlike a category, it is a setting on the sitting rather than
   * a fact about one note.
   */
  group: string | null;
  /** A project being described, or null. While set, words answer the question. */
  making: ProjectPlan | null;
  /**
   * Set for exactly the turn that confirmed one, for the host to go and make.
   *
   * **`hear` never creates anything.** It is pure, so it cannot reach a
   * network; what it does is say that the writer confirmed, which is the fact
   * worth testing. The host does the rest and tells the sitting how it went.
   */
  makes: { name: string; format: ProjectFormat } | null;
  /** What has been said and filed, oldest first. */
  filed: OpenNote[];
  /** What the last turn did, for the screen and the read-back. */
  said: string;
  /** Set when the writer asked for a project by name; the host resolves it. */
  wants: string | null;
  /** True for exactly the turn that opened a note — the host beeps on it. */
  opened: boolean;
  /** What a correction replaced, so one press puts it back. */
  undone: string | null;
}

export const emptySitting = (): Sitting => ({
  open: null,
  group: null,
  making: null,
  makes: null,
  filed: [],
  said: '',
  wants: null,
  opened: false,
  undone: null,
});

const join = (current: string, words: string): string =>
  words.length === 0
    ? current
    : `${current}${current.length > 0 && !current.endsWith(' ') ? ' ' : ''}${words}`;

/** Two spoken names for one group. Speech is loose, so matching is (§12). */
const plainly = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');

export const sameGroup = (a: string, b: string): boolean => plainly(a) === plainly(b);

/**
 * Every group this sitting has said, in the order they were first said.
 *
 * A **reading** rather than a list kept beside the notes, for the reason every
 * other one in this program is: a note whose group was corrected changes the
 * answer with nothing run. It is what makes *marketing* the second time mean
 * the **Marketing** of the first — one spelling on every note of a group, or
 * the desk gets two folders out of one word said twice.
 */
export const groupsSaid = (sitting: Sitting): string[] => {
  const out: string[] = [];
  const carry = (name: string | null) => {
    if (!name) return;
    if (!out.some((one) => sameGroup(one, name))) out.push(name);
  };
  for (const one of sitting.filed) carry(one.group);
  carry(sitting.open?.group ?? null);
  carry(sitting.group);
  return out;
};

/** The spelling this sitting already uses for a word, or the word as said. */
const settledSpelling = (sitting: Sitting, spoken: string): string =>
  groupsSaid(sitting).find((one) => sameGroup(one, spoken)) ?? spoken.trim();

/** A group name is a label rather than a sentence, so it is capped like one. */
const MAX_GROUP_WORDS = 6;
const MAX_GROUP_LENGTH = 60;

const nameOf = (key: CaptureKey | null, format: ProjectFormat): string =>
  key === null
    ? 'Note'
    : (captureVocabulary(format).find((one) => one.key === key)?.name ?? 'Note');

/**
 * What the phone asks next about a project being made (§11).
 *
 * **One place decides it**, because three of them would eventually disagree
 * about what is still wanted — and a writer with the phone in their pocket has
 * nothing to check the answer against.
 *
 * It says **what has landed and then what is missing**, which driving it proved
 * is not decoration: with the question alone, answering *a screenplay* before
 * naming anything left the sentence identical to the one before it, so nothing
 * was spoken and nothing on the screen moved — which from a pocket is
 * indistinguishable from the phone not having heard. A reply has to differ from
 * the question it answers or it is not a reply.
 */
const askAbout = (plan: ProjectPlan): string => {
  const name = plan.name.trim();
  const kind = plan.format ? formatSpokenName(plan.format) : null;
  if (name.length === 0) {
    return kind ? `${kind}. What is it called?` : 'What is it called?';
  }
  if (!kind) return `${name}. What kind? ${spokenFormatNames().join(', ')}.`;
  return `${name}, ${kind.toLowerCase()}. Say “${WAKE} yes” to make it.`;
};

/**
 * One utterance folded into the sitting.
 *
 * **Pure, and it never loses words.** Every path that closes a note files it,
 * including the one where a new note is started while another is open — a
 * writer who says *dictate setting* mid-thought has finished the thought
 * before it, and dropping it would be the notebook eating a note. The one act
 * that throws anything away is the one that says so out loud.
 */
export const hear = (sitting: Sitting, said: string, format: ProjectFormat): Sitting => {
  const turns = splitTurns(said, format, sitting.open !== null);
  if (turns.length <= 1) return hearOne(sitting, said, format);
  // Several commands in one breath (addendum 27 §16, from Ken: *command erase word
  // command erase word*): each is heard in turn, and what the host is told is
  // the whole of it — every note filed, and a beep if any opened.
  let at = sitting;
  let opened = false;
  for (const one of turns) {
    at = hearOne(at, one, format);
    opened ||= at.opened;
  }
  return { ...at, opened };
};

/**
 * One breath cut where a command begins (addendum 27 §16). A recogniser that hears
 * *command erase word command erase word* hands back one string; it is two
 * commands. A wake word in the middle of a sentence that is **not** followed
 * by a command it knows stays part of the sentence — *I command you* is a
 * line of dialogue.
 */
export const splitTurns = (said: string, format: ProjectFormat, open: boolean): string[] => {
  const text = said.trim();
  const at: number[] = [];
  const wake = new RegExp(`\\b(?:${WAKE_WORDS.join('|')})\\b`, 'gi');
  for (const match of text.matchAll(wake)) if ((match.index ?? 0) > 0) at.push(match.index ?? 0);
  if (at.length === 0) return [text];
  const pieces: string[] = [];
  let from = 0;
  for (const cut of at) {
    const piece = text.slice(cut);
    const next = at.find((one) => one > cut) ?? text.length;
    const candidate = text.slice(cut, next);
    // A cut only where what follows is a command this build knows.
    if (readTurn(candidate, { open, format }).kind === 'unknown' && readTurn(piece, { open, format }).kind === 'unknown') continue;
    pieces.push(text.slice(from, cut).trim());
    from = cut;
  }
  pieces.push(text.slice(from).trim());
  return pieces.filter((one) => one.replace(/^[\s,.:;—–-]+$/, '').length > 0);
};

const hearOne = (sitting: Sitting, said: string, format: ProjectFormat): Sitting => {
  const turn = readTurn(said, { open: sitting.open !== null, format, onTitle: sitting.open?.on === 'title' });
  const base: Sitting = { ...sitting, opened: false, wants: null, makes: null, undone: sitting.undone };

  /**
   * While a project is being described the phone is **not taking notes**, and
   * what is said answers the question it just asked. That is safe where a bare
   * category word is not, because this state is short, explicit, and says out
   * loud what it wants next — and unsafe to skip, since *a novel* would
   * otherwise become the first line of a note nobody meant to open.
   */
  if (sitting.making && turn.kind !== 'yes' && turn.kind !== 'scratch' && turn.kind !== 'making') {
    /**
     * A command that is not one of the three this state answers is not guessed
     * at: *dictate done* over a waiting plan might mean *make it* and might
     * mean *I have finished talking*, and only `yes` is allowed to mean the
     * first.
     *
     * **It is refused out loud rather than by re-asking**, which driving it
     * settled: the bare question is the sentence already on the screen, so the
     * refusal was silent, and a command that produces no sound is one a writer
     * assumes worked. So the refusal comes first and the question after it.
     */
    if (turn.kind !== 'words') {
      return { ...base, said: `Nothing made yet. ${askAbout(sitting.making)}` };
    }

    // A kind, said whenever it is said: a writer who answers the second
    // question first has still answered it.
    const named = formatNamed(turn.text);
    if (named) {
      const plan: ProjectPlan = { ...sitting.making, format: named };
      return { ...base, making: plan, said: askAbout(plan) };
    }
    // Not a kind, and nothing named yet, so these words are the name.
    if (sitting.making.name.trim().length === 0) {
      const plan: ProjectPlan = { ...sitting.making, name: turn.text };
      return { ...base, making: plan, said: askAbout(plan) };
    }
    // Named already, so this was meant as the kind and was not one of them.
    // **Refused rather than guessed**: the nearest-sounding format is how a
    // novel becomes a screenplay, which is the one mistake §11 exists to stop.
    return { ...base, said: `Not a kind I know. ${spokenFormatNames().join(', ')}.` };
  }

  switch (turn.kind) {
    case 'finish': {
      if (!sitting.open) return { ...base, said: 'Nothing open to save.' };
      // An empty note is nothing; saying *done* over one is not a note.
      if (sitting.open.text.trim().length === 0 && sitting.open.subjectName === null) {
        return { ...base, open: null, said: 'Nothing in that one — let go of it.' };
      }
      return {
        ...base,
        open: null,
        filed: [...sitting.filed, asFiled(sitting.open)],
        said: `Saved. ${nameOf(sitting.open.key, format)}.`,
        undone: null,
      };
    }

    case 'scratch': {
      if (sitting.making) return { ...base, making: null, said: 'Let that project go.' };
      if (!sitting.open) return { ...base, said: 'Nothing open to throw away.' };
      return { ...base, open: null, said: 'Thrown away.', undone: null };
    }

    case 'start': {
      // Whatever was open is finished rather than lost (see the header).
      const keep =
        sitting.open && (sitting.open.text.trim().length > 0 || sitting.open.subjectName)
          ? [...sitting.filed, asFiled(sitting.open)]
          : sitting.filed;
      // A kind said with nothing after it starts on its title (addendum 27
      // §16–17): the next few words are the title — a character's name, a
      // subsection's heading — until *command next*. A note with no kind
      // (words said straight out) is all body.
      const onTitle = hasTitle(turn.key, format) && turn.subjectName === null && turn.text.trim().length === 0;
      const made: OpenNote = {
        key: turn.key,
        subjectName: turn.subjectName,
        text: turn.text,
        // The sitting's group, because it sticks: that is what saying it once
        // over six notes is for (§12).
        group: sitting.group,
        ...(onTitle ? { on: 'title' as const } : {}),
      };
      return {
        ...base,
        open: made,
        filed: keep,
        opened: true,
        undone: null,
        said: turn.subjectName
          ? `${nameOf(turn.key, format)}, ${turn.subjectName}.`
          : onTitle
            ? `${nameOf(turn.key, format)}. Say the title, then “${COMMAND_WORD} next”.`
            : `${nameOf(turn.key, format)}.`,
      };
    }

    case 'eraseAll': {
      if (!sitting.open) return { ...base, said: 'Nothing open to erase.' };
      const titled = hasTitle(sitting.open.key, format);
      return {
        ...base,
        open: { ...sitting.open, subjectName: null, text: '', on: titled ? 'title' : 'body' },
        // What was there, so one press on the screen puts it back.
        undone: sitting.open.text,
        said: titled ? 'Erased. Say the title again.' : 'Erased. Start again.',
      };
    }

    case 'eraseWords': {
      const open = sitting.open;
      if (!open) return { ...base, said: 'Nothing open to erase.' };
      // From the part being spoken into; once that is empty, from the other.
      const fromTitle = (open.on === 'title' && titleOf(open).length > 0) || (open.text.trim().length === 0 && titleOf(open).length > 0);
      if (fromTitle) {
        const after = dropWords(titleOf(open), turn.count);
        return {
          ...base,
          open: { ...open, subjectName: after.text.length > 0 ? after.text : null },
          said: `Erased “${after.gone}”.`,
        };
      }
      if (open.text.trim().length === 0) return { ...base, said: 'Nothing left to erase.' };
      const after = dropWords(open.text, turn.count);
      return { ...base, open: { ...open, text: after.text }, said: `Erased “${after.gone}”.` };
    }

    case 'toBody': {
      if (!sitting.open) return { ...base, said: 'Nothing open. Say a kind of note to start one.' };
      return { ...base, open: { ...sitting.open, on: 'body' }, said: 'Now the note.' };
    }

    case 'toTitle': {
      if (!sitting.open) return { ...base, said: 'Nothing open. Say a kind of note to start one.' };
      return { ...base, open: { ...sitting.open, on: 'title' }, said: 'Now the title.' };
    }

    case 'project':
      return { ...base, wants: turn.name, said: `Project: ${turn.name}.` };

    case 'group': {
      // No name is somebody who has not finished the sentence, so it says where
      // they are and changes nothing — clearing has a command of its own, and
      // guessing at it here would throw a group away on a half-said word.
      if (turn.name.trim().length === 0) {
        return {
          ...base,
          said: sitting.group
            ? `Group: ${sitting.group}. Say “${WAKE} no group” to come out.`
            : 'No group. Say a name after it.',
        };
      }
      const said = turn.name.trim().replace(/[.!?,]+$/, '').trim();
      if (said.length > MAX_GROUP_LENGTH || said.split(/\s+/).length > MAX_GROUP_WORDS) {
        return { ...base, said: 'That is long for a group. Try a word or two.' };
      }
      // The spelling this sitting already uses, so *marketing* said twice is one
      // group at the desk rather than two folders out of one word.
      const name = settledSpelling(sitting, said);
      return {
        ...base,
        group: name,
        // The note in hand takes it too: somebody who says it halfway through a
        // note means this one, which is the only reading that is ever wrong in
        // the recoverable direction.
        open: sitting.open ? { ...sitting.open, group: name } : sitting.open,
        said: `Group: ${name}.`,
      };
    }

    case 'ungroup': {
      if (!sitting.group && !sitting.open?.group) return { ...base, said: 'No group to come out of.' };
      return {
        ...base,
        group: null,
        open: sitting.open ? { ...sitting.open, group: null } : sitting.open,
        said: 'Out of that group.',
      };
    }

    case 'making': {
      // Whatever was open is filed first: making a project is not a reason to
      // lose the thought that led to it.
      const keep =
        sitting.open && (sitting.open.text.trim().length > 0 || sitting.open.subjectName)
          ? [...sitting.filed, asFiled(sitting.open)]
          : sitting.filed;
      // The kind may come in the same breath — *new project The Lamp, a novel*.
      const split = turn.name.search(/[,—–]|\s-\s/);
      const name = (split < 0 ? turn.name : turn.name.slice(0, split)).trim();
      const kind = split < 0 ? null : formatNamed(turn.name.slice(split + 1));
      const plan: ProjectPlan = { name, format: kind };
      return { ...base, open: null, filed: keep, making: plan, said: askAbout(plan) };
    }

    case 'yes': {
      if (!sitting.making) return { ...base, said: 'Nothing waiting on a yes.' };
      if (sitting.making.name.trim().length === 0) {
        return { ...base, said: 'What is it called first?' };
      }
      if (!sitting.making.format) {
        return { ...base, said: `What kind first? ${spokenFormatNames().join(', ')}.` };
      }
      // Confirmed — and still not made: the host does that, and says how it
      // went. Until it answers, the plan stays, so a failure is recoverable by
      // saying yes again rather than by starting over.
      return {
        ...base,
        makes: { name: sitting.making.name.trim(), format: sitting.making.format },
        said: `Making ${sitting.making.name.trim()}…`,
      };
    }

    case 'correction': {
      if (!sitting.open) return { ...base, said: 'Nothing open to correct.' };
      // It **replaces**, which is what the word means (stage 4's rule), and
      // hands back what was there so one press puts it right.
      return {
        ...base,
        open: { ...sitting.open, text: turn.text },
        undone: sitting.open.text,
        said: 'Corrected.',
      };
    }

    case 'unknown':
      return {
        ...base,
        said: `Didn’t catch that command: “${turn.said}”. Nothing was written.`,
      };

    case 'words':
    default: {
      if (turn.text.length === 0) return base;
      // Words spoken with nothing open start a note with no category, because
      // a writer who just starts talking is still writing a note.
      const into: OpenNote =
        sitting.open ?? { key: null, subjectName: null, text: '', group: sitting.group };
      // On the title, words are the name (addendum 27 §16), without the full stop a
      // recogniser puts at the end of every breath.
      if (into.on === 'title' && isTitle(turn.text)) {
        const name = join(titleOf(into), turn.text.replace(/[.!?]+$/, '').trim());
        return { ...base, open: { ...into, subjectName: name.length > 0 ? name : null }, said: turn.text };
      }
      // A sentence said on the title is the note itself: it goes to the body,
      // and the note moves on with it.
      const moved: OpenNote = into.on === 'title' ? { ...into, on: 'body' } : into;
      return {
        ...base,
        open: { ...moved, text: join(moved.text, turn.text) },
        opened: sitting.open === null,
        said: turn.text,
      };
    }
  }
};

/**
 * Everything the sitting has, including the one still being spoken.
 *
 * What it is for is **stopping**: a writer who puts the phone down without
 * saying *dictate done* has not thrown that note away, and the host saves what
 * this returns. A notebook that kept only what you remembered to close is one
 * you would stop trusting after the first walk.
 */
export const everything = (sitting: Sitting): OpenNote[] =>
  sitting.open && (sitting.open.text.trim().length > 0 || sitting.open.subjectName)
    ? [...sitting.filed, asFiled(sitting.open)]
    : sitting.filed;

/**
 * What the sitting looks like once the host has made the project (§11).
 *
 * The pair below is here rather than in the host for one reason: a component
 * assembling a `Sitting` of its own is a second answer about what state the
 * walk is in, and this one is read by the screen the writer cannot see.
 *
 * **The plan is only let go of if it is still the one that was confirmed.** The
 * network answers whenever it answers, and by then the writer may have said
 * *dictate scratch that* and started another — clearing blind would take a plan
 * nobody finished with, which is addendum 18 stage 7's lesson (a value caught
 * on its way out depends on when the host runs it, so the change is made
 * against whatever is current).
 */
const sameAs = (sitting: Sitting, plan: { name: string; format: ProjectFormat }): boolean =>
  sitting.making !== null &&
  sitting.making.name.trim() === plan.name.trim() &&
  sitting.making.format === plan.format;

export const projectMade = (
  sitting: Sitting,
  plan: { name: string; format: ProjectFormat },
): Sitting =>
  sameAs(sitting, plan)
    ? { ...sitting, making: null, makes: null, said: `${plan.name.trim()} is ready.` }
    : { ...sitting, makes: null };

/**
 * The host could not make it.
 *
 * **The plan stays**, so saying *dictate yes* again is a retry rather than a
 * fresh start — which is what somebody walking with a phone will do, and the
 * only reason the name and the kind are worth gathering separately from the
 * making.
 */
export const projectFailed = (
  sitting: Sitting,
  plan: { name: string; format: ProjectFormat },
  why: string,
): Sitting => (sameAs(sitting, plan) ? { ...sitting, makes: null, said: why } : { ...sitting, makes: null });

/**
 * What to say out loud after a turn, or null where speaking would interrupt.
 *
 * **It answers a command and never the writing.** Reading dictation back as it
 * arrives would talk over somebody mid-sentence, which is exactly the thing a
 * hands-free notebook must not do; what is worth hearing is that a note
 * opened, closed or went away.
 */
export const speakBack = (before: Sitting, after: Sitting): string | null => {
  if (after.said === before.said) return null;
  if (after.opened) return after.said;
  if (after.open === null && before.open !== null) return after.said;
  if (after.wants) return after.said;
  /**
   * The group, whenever it moves — set, cleared, or asked about. It is a
   * setting that silently changes where six later notes land, and §11's rule
   * about the project's own questions holds here for the same reason: from a
   * pocket, a change nobody hears is one nobody can catch.
   */
  if (after.group !== before.group || after.said.startsWith('Group:')) return after.said;
  if (after.said.startsWith('Out of that group')) return after.said;
  /**
   * **Every word of making a project is spoken**, which is the one place this
   * rule is absolute: the sentence is a *question*, and a question nobody hears
   * is a phone waiting for an answer to something it never asked. That covers
   * the turn a plan ends on too — a refusal, or *Making Blackout…* — since
   * either way the plan is still set.
   */
  if (after.making || before.making) return after.said;
  if (after.said.startsWith('Didn’t catch')) return after.said;
  // Erasing and moving between title and body are heard (addendum 27 §16): from a pocket,
  // a command nobody hears is one somebody says again.
  if (/^(Erased|Nothing (open|left) to erase|Now the (note|title)|Nothing open\. Say)/.test(after.said)) return after.said;
  return null;
};

/** The project a spoken name meant, matched loosely because speech is loose. */
export const projectNamed = <T extends { id: string; name: string }>(
  spoken: string,
  projects: readonly T[],
): T | null => {
  const wanted = spoken.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (wanted.length === 0) return null;
  const tidyName = (one: T) => one.name.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
  return (
    projects.find((one) => tidyName(one) === wanted) ??
    projects.find((one) => tidyName(one).startsWith(wanted)) ??
    projects.find((one) => tidyName(one).includes(wanted)) ??
    null
  );
};
