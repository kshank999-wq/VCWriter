import type { ManuscriptElementType } from './entities/manuscript.js';
import type { ProjectFormat } from './entities/project.js';
import { isProseFormat } from './editing.js';

/**
 * Dictating the manuscript (spec §9: *desktop writing areas support dictation
 * as an alternative to typing*).
 *
 * **The recogniser hears; this decides what was written.** Whatever puts the
 * words on the screen — the operating system's own dictation on a desktop, the
 * browser's recogniser in the preview — hands back a run of text, and the
 * question after that is a question about text: did the writer name a style,
 * and where does one element end and the next begin.
 *
 * That question matters because of where the writing rules live. Return and Tab
 * are handled on **keydown** (`editing.ts`, spec §19), and dictated text never
 * presses a key: it arrives as an edit to the field. Without this, a dictated
 * scene lands as one action paragraph with newlines inside it — every slugline,
 * cue and speech in the scene flattened into a single element. The clipboard
 * has had the answer to exactly this since the reformat tool: text arriving in
 * bulk becomes *typed elements*. Dictation is a paste coming through a
 * different door, and this is the reading that lets it through.
 */

/** A run of dictated words, and the style the writer named for it. */
export interface SpokenPart {
  /** The style they asked for, or null: carry on in whatever is current. */
  type: ManuscriptElementType | null;
  text: string;
  /**
   * Whether this run begins an element of its own.
   *
   * Only the *leading* run of a dictation is false — the words a writer speaks
   * straight into the line they are already in. Everything after a style name
   * or a break starts something new, and it has to be said separately from
   * `type` because a break carries the current style forward: *new line* in
   * the middle of action means another action line, which is a new element
   * whose type is the same as the one before it.
   */
  starts: boolean;
}

/**
 * What each style sounds like.
 *
 * Ordered longest phrase first within a style, and searched longest first
 * overall, so *scene break* is never read as *scene* with the word *break*
 * left over.
 */
const SCREENPLAY_STYLES: ReadonlyArray<readonly [ManuscriptElementType, readonly string[]]> = [
  ['scene_heading', ['scene heading', 'slug line', 'slugline', 'new scene']],
  ['parenthetical', ['parenthetical', 'wryly']],
  ['transition', ['transition']],
  ['character', ['character', 'cue']],
  ['dialogue', ['dialogue', 'dialog']],
  ['action', ['action']],
  ['shot', ['shot']],
];

const PROSE_STYLES: ReadonlyArray<readonly [ManuscriptElementType, readonly string[]]> = [
  ['scene_break', ['scene break']],
  ['blockquote', ['block quote', 'blockquote']],
  ['heading', ['chapter heading', 'heading']],
  ['paragraph', ['new paragraph', 'paragraph']],
];

/**
 * *New line* starts another element in the style already being written.
 *
 * A newline character counts as one too, and that is the case that matters on
 * a desktop: the operating system's dictation types into the field, so *new
 * line* reaches the app as a character rather than as the Return key the
 * editor would have handled.
 */
const BREAKS = ['new line', 'newline'];

/** Punctuation a recogniser writes where the writer paused. */
const SENTENCE_END = /[.,:;!?—–]/;

const styleWords = (format: ProjectFormat) =>
  isProseFormat(format) ? PROSE_STYLES : SCREENPLAY_STYLES;

/** Every spoken phrase for a format, longest first. */
const phrasesFor = (format: ProjectFormat): Array<{ phrase: string; type: ManuscriptElementType | null }> => {
  const found: Array<{ phrase: string; type: ManuscriptElementType | null }> = [];
  for (const [type, phrases] of styleWords(format)) {
    for (const phrase of phrases) found.push({ phrase, type });
  }
  for (const phrase of BREAKS) found.push({ phrase, type: null });
  return found.sort((a, b) => b.phrase.length - a.phrase.length);
};

/**
 * Whether a phrase at `at` is being **spoken as a command rather than used as a
 * word**.
 *
 * This is the whole safety of the module, and it is one rule: **a command is a
 * sentence of its own.** *Action* opens a sentence and closes it; *the action
 * was over by then* does neither. A writer dictating says the style and pauses,
 * and a recogniser writes that pause as punctuation — so the test is that the
 * phrase sits between two sentence boundaries.
 *
 * When it fails, nothing is taken and the words stay in the manuscript where
 * the writer can see them. That is the same trade the phone makes about a
 * spoken name (`capture-voice.ts`): a wrong guess is worse than no guess,
 * because a guess that goes unnoticed is a line of somebody's screenplay
 * quietly turned into a scene heading.
 */
const spokenAsACommand = (said: string, at: number, phrase: string): boolean => {
  const before = said.slice(0, at).trimEnd();
  const opensASentence = before.length === 0 || SENTENCE_END.test(before[before.length - 1] as string);
  if (!opensASentence) return false;

  const after = said.slice(at + phrase.length);
  // Nothing after it at all is the writer naming the style and then stopping,
  // which is how somebody dictating one line at a time works.
  if (after.trim().length === 0) return true;
  return SENTENCE_END.test(after[0] as string);
};

/** Where the words start again after a command and the punctuation behind it. */
const wordsAfter = (rest: string): string => rest.replace(/^[\s.,:;!?—–-]+/, '');

/**
 * A character cue is a name, and a name has no full stop.
 *
 * Everywhere else the words are left exactly as they were spoken — deciding
 * the style is this module's job and editing the prose is not. A cue is the
 * exception because of what happens downstream rather than how it reads: the
 * cast is noted from cues, so *Mara.* with the stop left on would put a second,
 * punctuated person in the character list beside the real one.
 */
const asCue = (text: string): string => text.trim().replace(/[.,]+$/, '').trim();

/**
 * Read a run of dictation into styled parts.
 *
 * A part with a null `type` carries on in whatever style the writer is already
 * in, which is both the ordinary case — dictation with no command in it at all
 * — and what *new line* asks for.
 */
export const readDictatedScript = (transcript: string, format: ProjectFormat): SpokenPart[] => {
  const said = transcript.replace(/\r\n?/g, '\n').trim();
  if (said.length === 0) return [];

  const phrases = phrasesFor(format);
  const parts: SpokenPart[] = [];

  /** The style the current run is being written in, once one has been named. */
  let type: ManuscriptElementType | null = null;
  /** False only for the leading run: words spoken into the line already open. */
  let starts = false;
  let from = 0;
  let at = 0;

  const keep = (text: string) => {
    const words = type === 'character' ? asCue(text) : text.trim();
    // A command with nothing after it still makes a part — the writer named
    // the style and is about to speak into it — but an empty leading run is
    // nothing at all.
    if (words.length === 0 && !starts) return;
    parts.push({ type, text: words, starts });
  };

  const lower = said.toLowerCase();

  while (at < said.length) {
    // A line break is a break whoever typed it, and it carries the current
    // style forward rather than clearing it.
    if (said[at] === '\n') {
      keep(said.slice(from, at));
      starts = true;
      at += 1;
      const rest = said.slice(at).replace(/^[\s]+/, '');
      from = said.length - rest.length;
      at = from;
      continue;
    }

    const hit = phrases.find(
      ({ phrase }) => lower.startsWith(phrase, at) && spokenAsACommand(said, at, phrase),
    );

    if (!hit) {
      at += 1;
      continue;
    }

    keep(said.slice(from, at));
    // A style name sets the style; a spoken break leaves it where it was.
    if (hit.type !== null) type = hit.type;
    starts = true;
    at += hit.phrase.length;
    const rest = wordsAfter(said.slice(at));
    from = said.length - rest.length;
    at = from;
  }

  keep(said.slice(from));
  return parts;
};

/**
 * Whether a run of dictated text says anything about structure.
 *
 * The caller uses this to decide whether dictation needs re-typing at all: a
 * phrase with no command and no line break in it is an ordinary edit to the
 * element being written, and should stay one.
 */
export const carriesStructure = (transcript: string, format: ProjectFormat): boolean =>
  readDictatedScript(transcript, format).some((part) => part.starts);
