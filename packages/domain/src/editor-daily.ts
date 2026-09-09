import { beatsForUnit, findUnit, unitsInStoryOrder } from './selectors.js';
import { updateBeat } from './mutations.js';
import { isProseFormat } from './editing.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, ManuscriptElementId, StructuralUnitId } from './ids.js';

/**
 * The Daily Editor (spec §8.1).
 *
 * Grammar, mechanics, readability and the habits that weaken a page. Every
 * check here is deterministic and runs locally: it costs nothing, works on a
 * plane, and gives the same answer twice. AI-assisted editing sits on top of
 * this rather than replacing it — a writer should never have to be online to
 * find a doubled word.
 *
 * Two rules shape the design, both from §8.1's "preserve writer control and
 * voice":
 *
 *  - Nothing is ever changed automatically. A finding carries a suggestion;
 *    applying it is a separate, explicit act.
 *  - Style findings are advisory and say so. "Too many adverbs" is an opinion,
 *    not an error, and the interface must not dress one as the other.
 */

export type FindingKind =
  | 'repeated_word'
  | 'double_space'
  | 'trailing_space'
  | 'unbalanced_bracket'
  | 'long_sentence'
  | 'passive_voice'
  | 'adverb_pileup'
  | 'filter_word'
  | 'camera_direction'
  | 'hedged_action'
  | 'unknown_character_cue'
  // Punctuation and typography
  | 'space_before_punctuation'
  | 'doubled_punctuation'
  | 'straight_quote'
  | 'spaced_hyphen'
  // Spelling, as far as it can be told without a dictionary
  | 'misspelling'
  | 'modal_of'
  | 'likely_typo'
  // What a screenplay's own shape asks for
  | 'orphan_dialogue'
  | 'cue_without_speech'
  | 'slug_without_time'
  | 'long_parenthetical'
  | 'wall_of_action';

/** What each rule is called where a person has to read it. */
export const FINDING_LABELS: Record<FindingKind, string> = {
  repeated_word: 'A word typed twice',
  double_space: 'Two spaces',
  trailing_space: 'A space at the end',
  unbalanced_bracket: 'An unclosed bracket',
  long_sentence: 'A long sentence',
  passive_voice: 'The passive voice',
  adverb_pileup: 'Adverbs piling up',
  filter_word: 'Filtering the reader out',
  camera_direction: 'Directing the camera',
  hedged_action: 'Hedged action',
  unknown_character_cue: 'A cue nobody is cast for',
  space_before_punctuation: 'A space before punctuation',
  doubled_punctuation: 'Doubled punctuation',
  straight_quote: 'A straight quote among curly ones',
  spaced_hyphen: 'A hyphen doing a dash’s job',
  misspelling: 'A common misspelling',
  modal_of: '“of” where “have” belongs',
  likely_typo: 'A word used once that is nearly one used often',
  orphan_dialogue: 'Dialogue with nobody speaking it',
  cue_without_speech: 'A cue with nothing under it',
  slug_without_time: 'A slugline with no time of day',
  long_parenthetical: 'A parenthetical doing action’s work',
  wall_of_action: 'A wall of action',
};

/** `error` is objectively wrong; `style` is a judgement the writer may reject. */
export type FindingSeverity = 'error' | 'style';

export interface EditorFinding {
  id: string;
  beatId: BeatId;
  unitId: StructuralUnitId;
  elementId: ManuscriptElementId;
  kind: FindingKind;
  severity: FindingSeverity;
  message: string;
  /** Character range within the element's text. */
  start: number;
  end: number;
  /** The offending text, for display without re-slicing. */
  excerpt: string;
  /** Present when the fix is unambiguous enough to apply in one click. */
  replacement?: string;
}

export interface DailyEditorOptions {
  /** Restrict the pass to one scene/chapter, or one beat. */
  unitId?: StructuralUnitId;
  beatId?: BeatId;
  includeStyle?: boolean;
  /** Sentences longer than this are flagged for readability. */
  longSentenceWords?: number;
  /** A parenthetical longer than this is doing action's work. */
  longParentheticalWords?: number;
  /** An action block longer than this is a wall. */
  actionWallWords?: number;
  /**
   * Rules the writer has switched off, and words they have said are fine.
   * An editor with no way to say "that is not a mistake" is one a writer
   * turns off entirely after the second false alarm.
   */
  ignoredRules?: readonly string[];
  allowedWords?: readonly string[];
}

const PROSE_LIKE = new Set(['action', 'dialogue', 'paragraph', 'blockquote', 'general']);

const FILTER_WORDS = [
  'he saw that',
  'she saw that',
  'he felt that',
  'she felt that',
  'he heard that',
  'she heard that',
  'he noticed that',
  'she noticed that',
  'he realized that',
  'she realised that',
];

const CAMERA_DIRECTIONS = ['we see', 'we hear', 'camera pans', 'camera moves', 'we watch as', 'zoom in on'];

const HEDGED_ACTION = ['begins to', 'starts to', 'proceeds to'];

let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `finding-${counter}`;
};

const push = (
  findings: EditorFinding[],
  base: Omit<EditorFinding, 'id' | 'excerpt'>,
  text: string,
): void => {
  findings.push({ ...base, id: nextId(), excerpt: text.slice(base.start, base.end) });
};

const checkMechanics = (
  element: ManuscriptElement,
  context: { beatId: BeatId; unitId: StructuralUnitId },
  findings: EditorFinding[],
): void => {
  const text = element.text;

  // A word typed twice. Case-insensitive, but only for real words — "had had"
  // is legitimate, so a short allow list keeps this from crying wolf.
  const allowed = new Set(['had', 'that', 'no']);
  for (const match of text.matchAll(/\b(\w+)(\s+)\1\b/gi)) {
    const word = match[1] ?? '';
    if (allowed.has(word.toLowerCase())) continue;
    const start = match.index ?? 0;
    push(
      findings,
      {
        ...context,
        elementId: element.id,
        kind: 'repeated_word',
        severity: 'error',
        message: `"${word}" is repeated.`,
        start,
        end: start + match[0].length,
        replacement: word,
      },
      text,
    );
  }

  for (const match of text.matchAll(/(?<=\S) {2,}(?=\S)/g)) {
    const start = match.index ?? 0;
    push(
      findings,
      {
        ...context,
        elementId: element.id,
        kind: 'double_space',
        severity: 'error',
        message: 'More than one space between words.',
        start,
        end: start + match[0].length,
        replacement: ' ',
      },
      text,
    );
  }

  const trailing = text.match(/[ \t]+$/);
  if (trailing) {
    const start = text.length - trailing[0].length;
    push(
      findings,
      {
        ...context,
        elementId: element.id,
        kind: 'trailing_space',
        severity: 'error',
        message: 'Trailing whitespace.',
        start,
        end: text.length,
        replacement: '',
      },
      text,
    );
  }

  // Brackets and quotes that never close read as typos on the page.
  const opens = (text.match(/\(/g) ?? []).length;
  const closes = (text.match(/\)/g) ?? []).length;
  if (opens !== closes) {
    push(
      findings,
      {
        ...context,
        elementId: element.id,
        kind: 'unbalanced_bracket',
        severity: 'error',
        message: 'Brackets do not balance.',
        start: 0,
        end: Math.min(text.length, 40),
      },
      text,
    );
  }
};

const sentencesOf = (text: string): Array<{ text: string; start: number }> => {
  const sentences: Array<{ text: string; start: number }> = [];
  let start = 0;
  const pattern = /[.!?]+["')\]]*\s+/g;
  for (const match of text.matchAll(pattern)) {
    const end = (match.index ?? 0) + match[0].length;
    sentences.push({ text: text.slice(start, end), start });
    start = end;
  }
  if (start < text.length) sentences.push({ text: text.slice(start), start });
  return sentences;
};

const countWords = (text: string): number => (text.match(/[^\s]+/g) ?? []).length;

const checkStyle = (
  element: ManuscriptElement,
  context: { beatId: BeatId; unitId: StructuralUnitId },
  findings: EditorFinding[],
  options: Required<Pick<DailyEditorOptions, 'longSentenceWords'>>,
  screenplay: boolean,
): void => {
  const text = element.text;

  for (const sentence of sentencesOf(text)) {
    const words = countWords(sentence.text);
    if (words > options.longSentenceWords) {
      push(
        findings,
        {
          ...context,
          elementId: element.id,
          kind: 'long_sentence',
          severity: 'style',
          message: `${words} words in one sentence — consider breaking it up.`,
          start: sentence.start,
          end: sentence.start + sentence.text.length,
        },
        text,
      );
    }

    // Three or more -ly adverbs in a sentence is usually the draft talking.
    const adverbs = [...sentence.text.matchAll(/\b\w+ly\b/g)];
    if (adverbs.length >= 3) {
      push(
        findings,
        {
          ...context,
          elementId: element.id,
          kind: 'adverb_pileup',
          severity: 'style',
          message: `${adverbs.length} adverbs in one sentence.`,
          start: sentence.start,
          end: sentence.start + sentence.text.length,
        },
        text,
      );
    }
  }

  for (const match of text.matchAll(/\b(?:was|were|is|are|been|being)\s+(\w+(?:ed|en))\b/gi)) {
    const start = match.index ?? 0;
    push(
      findings,
      {
        ...context,
        elementId: element.id,
        kind: 'passive_voice',
        severity: 'style',
        message: 'Passive construction — an active verb is usually stronger.',
        start,
        end: start + match[0].length,
      },
      text,
    );
  }

  const lowered = text.toLowerCase();
  for (const phrase of FILTER_WORDS) {
    let from = lowered.indexOf(phrase);
    while (from !== -1) {
      push(
        findings,
        {
          ...context,
          elementId: element.id,
          kind: 'filter_word',
          severity: 'style',
          message: 'Filtering the action through a character distances the reader.',
          start: from,
          end: from + phrase.length,
        },
        text,
      );
      from = lowered.indexOf(phrase, from + phrase.length);
    }
  }

  for (const phrase of HEDGED_ACTION) {
    let from = lowered.indexOf(phrase);
    while (from !== -1) {
      push(
        findings,
        {
          ...context,
          elementId: element.id,
          kind: 'hedged_action',
          severity: 'style',
          message: `"${phrase}" — let the character just do it.`,
          start: from,
          end: from + phrase.length,
        },
        text,
      );
      from = lowered.indexOf(phrase, from + phrase.length);
    }
  }

  // Camera directions in action lines are a spec-script habit worth flagging.
  if (screenplay && element.type === 'action') {
    for (const phrase of CAMERA_DIRECTIONS) {
      const from = lowered.indexOf(phrase);
      if (from === -1) continue;
      push(
        findings,
        {
          ...context,
          elementId: element.id,
          kind: 'camera_direction',
          severity: 'style',
          message: 'Camera direction in an action line — most readers prefer it implied.',
          start: from,
          end: from + phrase.length,
        },
        text,
      );
    }
  }
};


// ---------------------------------------------------------------------------
// Punctuation and typography
// ---------------------------------------------------------------------------

/** Words that a keyboard gets wrong often enough to be worth naming. */
const MISSPELLINGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\balot\b/gi, 'a lot'],
  [/\bdefinately\b/gi, 'definitely'],
  [/\bseperate(ly)?\b/gi, 'separate$1'],
  [/\boccured\b/gi, 'occurred'],
  [/\brecieve(d|s)?\b/gi, 'receive$1'],
  [/\bteh\b/gi, 'the'],
  [/\buntill\b/gi, 'until'],
  [/\bwich\b/gi, 'which'],
  [/\bits'\B/g, 'its'],
  [/\bthier\b/gi, 'their'],
  [/\btommorow\b/gi, 'tomorrow'],
  [/\bneccessary\b/gi, 'necessary'],
];

/**
 * Punctuation a keyboard produces and a page should not.
 *
 * Every one of these is unambiguous, so every one carries a fix. Nothing
 * here is a matter of taste — a space before a comma is not a style.
 */
const checkPunctuation = (
  element: ManuscriptElement,
  context: { beatId: BeatId; unitId: StructuralUnitId },
  findings: EditorFinding[],
  curly: boolean,
): void => {
  const text = element.text;

  for (const match of text.matchAll(/\s+([,.;:!?])/g)) {
    const start = match.index ?? 0;
    push(
      findings,
      {
        ...context,
        elementId: element.id,
        kind: 'space_before_punctuation',
        severity: 'error',
        message: `A space before the “${match[1]}”.`,
        start,
        end: start + match[0].length,
        replacement: match[1] as string,
      },
      text,
    );
  }

  // Doubled punctuation — but an ellipsis is three dots and is not a mistake,
  // and "?!" is a thing writers mean.
  for (const match of text.matchAll(/([,;:!?])\1+|\.{2,}/g)) {
    const whole = match[0] as string;
    // Exactly three dots is an ellipsis, wherever it falls in a longer run.
    if (whole.startsWith('.') && whole.length === 3) continue;
    const start = match.index ?? 0;
    push(
      findings,
      {
        ...context,
        elementId: element.id,
        kind: 'doubled_punctuation',
        severity: 'error',
        message: `“${whole}” — one is enough.`,
        start,
        end: start + whole.length,
        replacement: whole.startsWith('.') ? '…' : (whole[0] as string),
      },
      text,
    );
  }

  // A straight quote in a manuscript that is otherwise typeset properly. Only
  // raised where the writer has clearly chosen curly quotes: on its own a
  // straight apostrophe is a choice, not an error.
  if (curly) {
    for (const match of text.matchAll(/['"]/g)) {
      const start = match.index ?? 0;
      const straight = match[0] as string;
      // An apostrophe inside a word is a right single quote.
      const inWord = start > 0 && /\w/.test(text[start - 1] ?? '') && /\w/.test(text[start + 1] ?? '');
      push(
        findings,
        {
          ...context,
          elementId: element.id,
          kind: 'straight_quote',
          severity: 'style',
          message: 'A straight quote where the rest of the manuscript is curly.',
          start,
          end: start + 1,
          replacement: straight === '"' ? '“' : inWord ? '’' : '‘',
        },
        text,
      );
    }
  }

  // " - " between words is a dash being typed as a hyphen. Sluglines use it
  // as a separator on purpose, so they are left alone.
  if (element.type !== 'scene_heading') {
    for (const match of text.matchAll(/(\w)\s+-\s+(\w)/g)) {
      const start = (match.index ?? 0) + (match[1] as string).length;
      push(
        findings,
        {
          ...context,
          elementId: element.id,
          kind: 'spaced_hyphen',
          severity: 'style',
          message: 'A hyphen between spaces, where an em dash is meant.',
          start,
          end: start + match[0].length - (match[1] as string).length - (match[2] as string).length,
          replacement: '—',
        },
        text,
      );
    }
  }
};

/** Spelling, as far as it can be told without shipping a dictionary. */
const checkSpelling = (
  element: ManuscriptElement,
  context: { beatId: BeatId; unitId: StructuralUnitId },
  findings: EditorFinding[],
  common: Map<string, number>,
  allowed: ReadonlySet<string>,
): void => {
  const text = element.text;

  for (const [pattern, correction] of MISSPELLINGS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const fixed = (match[0] as string).replace(pattern, correction);
      push(
        findings,
        {
          ...context,
          elementId: element.id,
          kind: 'misspelling',
          severity: 'error',
          message: `“${match[0]}” — did you mean “${fixed}”?`,
          start,
          end: start + (match[0] as string).length,
          replacement: fixed,
        },
        text,
      );
    }
  }

  // "could of" is always "could have". This one is never a judgement call.
  for (const match of text.matchAll(/\b(could|would|should|must|might)\s+of\b/gi)) {
    const start = match.index ?? 0;
    push(
      findings,
      {
        ...context,
        elementId: element.id,
        kind: 'modal_of',
        severity: 'error',
        message: `“${match[0]}” — “have”, not “of”.`,
        start,
        end: start + (match[0] as string).length,
        replacement: `${match[1]} have`,
      },
      text,
    );
  }

  // A word used once in the whole manuscript that is one keystroke away from
  // a word used often is almost always a typo. This is the closest thing to
  // a spell-check that can be honest without a dictionary: it knows nothing
  // about English, only about what this writer actually writes.
  for (const match of text.matchAll(/\b[A-Za-z][a-z]{3,}\b/g)) {
    const word = (match[0] as string).toLowerCase();
    if ((common.get(word) ?? 0) !== 1 || allowed.has(word)) continue;
    const near = nearestCommonWord(word, common);
    if (!near) continue;
    const start = match.index ?? 0;
    push(
      findings,
      {
        ...context,
        elementId: element.id,
        kind: 'likely_typo',
        severity: 'style',
        message: `“${match[0]}” appears once; “${near}” appears ${common.get(near)} times.`,
        start,
        end: start + (match[0] as string).length,
        replacement: matchCase(match[0] as string, near),
      },
      text,
    );
  }
};

/** The frequent word this rare one is one edit away from, if there is one. */
const nearestCommonWord = (word: string, common: Map<string, number>): string | null => {
  for (const [candidate, count] of common) {
    if (count < 3 || candidate.length < 4 || candidate === word) continue;
    if (Math.abs(candidate.length - word.length) > 1) continue;
    // An inflection is not a typo: "stair" and "stairs" are both words.
    if (candidate.startsWith(word) || word.startsWith(candidate)) continue;
    if (oneEditApart(word, candidate)) return candidate;
  }
  return null;
};

/**
 * True when a is one typo away from b: one insertion, deletion,
 * substitution — or one transposition, which is what fingers actually do.
 * "lantren" for "lantern" is two substitutions by the textbook measure and
 * one slip in life, so it counts.
 */
const oneEditApart = (a: string, b: string): boolean => {
  if (a === b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;

  // Two letters swapped: equal lengths, and the only difference is a pair
  // that reads the same the other way round.
  if (a.length === b.length) {
    const differing: number[] = [];
    for (let index = 0; index < a.length; index += 1) {
      if (a[index] !== b[index]) differing.push(index);
      if (differing.length > 2) return false;
    }
    if (differing.length === 1) return true;
    if (differing.length === 2) {
      const [first, second] = differing as [number, number];
      if (second === first + 1 && a[first] === b[second] && a[second] === b[first]) return true;
      return false;
    }
    return false;
  }

  // One letter inserted or dropped.
  let i = 0;
  let j = 0;
  let slack = 1;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (slack === 0) return false;
    slack = 0;
    j += 1;
  }
  return true;
};

/** Keep the shape of what was typed: Stair for stair, STAIR for STAIR. */
const matchCase = (typed: string, replacement: string): string => {
  if (typed === typed.toUpperCase()) return replacement.toUpperCase();
  if (typed[0] === (typed[0] ?? '').toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
};


// ---------------------------------------------------------------------------
// What a screenplay's own shape asks for
// ---------------------------------------------------------------------------

/**
 * The mistakes that are only mistakes because of where a line sits: a speech
 * with nobody speaking it, a cue with nothing under it, a slug that does not
 * say when. These need the elements around them, so they run over a beat
 * rather than over a line.
 */
const checkShape = (
  elements: readonly ManuscriptElement[],
  context: { beatId: BeatId; unitId: StructuralUnitId },
  findings: EditorFinding[],
  options: { longParenthetical: number; actionWall: number },
): void => {
  const spoken = elements.filter((element) => element.text.trim().length > 0);

  spoken.forEach((element, index) => {
    const previous = spoken[index - 1];
    const next = spoken[index + 1];
    const text = element.text;
    const at = { ...context, elementId: element.id, start: 0, end: text.length };

    if (element.type === 'dialogue' && previous?.type !== 'character' && previous?.type !== 'parenthetical') {
      push(
        findings,
        {
          ...at,
          kind: 'orphan_dialogue',
          severity: 'error',
          message: 'A speech with no character cue above it — nobody is saying this.',
        },
        text,
      );
    }

    if (element.type === 'character' && next?.type !== 'dialogue' && next?.type !== 'parenthetical') {
      push(
        findings,
        {
          ...at,
          kind: 'cue_without_speech',
          severity: 'error',
          message: `${text.trim()} is cued but says nothing.`,
        },
        text,
      );
    }

    if (element.type === 'scene_heading' && /^(INT|EXT|I\/E|EST)/i.test(text.trim())) {
      // A full slugline says where and when. A secondary slug — LATER,
      // CONTINUOUS, a bare place — is a different thing and is left alone.
      const hasTime = /\s[-—–]\s*[A-Z][A-Z\s']+$/.test(text.trim().toUpperCase());
      if (!hasTime) {
        push(
          findings,
          {
            ...at,
            kind: 'slug_without_time',
            severity: 'style',
            message: 'This slugline does not say when it happens.',
          },
          text,
        );
      }
    }

    if (element.type === 'parenthetical' && words(text) > options.longParenthetical) {
      push(
        findings,
        {
          ...at,
          kind: 'long_parenthetical',
          severity: 'style',
          message: 'A parenthetical is a direction, not a line of action. This one is doing action’s work.',
        },
        text,
      );
    }

    if (element.type === 'action' && words(text) > options.actionWall) {
      push(
        findings,
        {
          ...at,
          kind: 'wall_of_action',
          severity: 'style',
          message: `${words(text)} words of unbroken action. A reader’s eye skips a block this size.`,
        },
        text,
      );
    }
  });
};

const words = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** How often each word is used across the whole manuscript. */
const wordFrequency = (file: ProjectFile): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const beat of file.beats) {
    for (const element of beat.manuscript.elements) {
      for (const match of element.text.matchAll(/\b[A-Za-z][a-z]{3,}\b/g)) {
        const word = (match[0] as string).toLowerCase();
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
  }
  return counts;
};

/** Whether the manuscript is typeset with curly quotes, by weight of use. */
const usesCurlyQuotes = (file: ProjectFile): boolean => {
  let curly = 0;
  let straight = 0;
  for (const beat of file.beats) {
    for (const element of beat.manuscript.elements) {
      curly += (element.text.match(/[“”‘’]/g) ?? []).length;
      straight += (element.text.match(/["']/g) ?? []).length;
    }
  }
  return curly > straight && curly > 0;
};

/**
 * Run the pass. Findings come back in document order, so walking them is the
 * same as reading the script.
 */
export const runDailyEditor = (file: ProjectFile, options: DailyEditorOptions = {}): EditorFinding[] => {
  const includeStyle = options.includeStyle ?? true;
  const longSentenceWords = options.longSentenceWords ?? 30;
  const longParenthetical = options.longParentheticalWords ?? 12;
  const actionWall = options.actionWallWords ?? 70;
  const screenplay = !isProseFormat(file.project.format);
  const ignored = new Set(options.ignoredRules ?? file.settings.editorIgnoredRules ?? []);
  const allowed = new Set(
    (options.allowedWords ?? file.settings.editorAllowedWords ?? []).map((word) => word.toLowerCase()),
  );
  // The cast are proper nouns the writer chose; they are never typos.
  for (const character of file.characters) {
    for (const part of character.name.toLowerCase().split(/\s+/)) allowed.add(part);
  }
  const common = wordFrequency(file);
  const curly = usesCurlyQuotes(file);
  const knownCues = new Set(file.characters.map((character) => character.name.trim().toUpperCase()));

  const units = options.unitId
    ? [findUnit(file, options.unitId)].filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
    : unitsInStoryOrder(file);

  const findings: EditorFinding[] = [];

  for (const unit of units) {
    for (const beat of beatsForUnit(file, unit.id)) {
      if (options.beatId && beat.id !== options.beatId) continue;
      const context = { beatId: beat.id, unitId: unit.id };

      for (const element of beat.manuscript.elements) {
        if (element.text.trim().length === 0) continue;

        checkMechanics(element, context, findings);
        checkPunctuation(element, context, findings, curly);
        if (PROSE_LIKE.has(element.type)) checkSpelling(element, context, findings, common, allowed);

        // A cue naming someone who is not in the cast is usually a typo, and
        // it is why read-back would fall back to the narrator voice (§10).
        if (screenplay && element.type === 'character' && knownCues.size > 0) {
          const name = element.text.trim().toUpperCase().replace(/\s*\(.*\)$/, '');
          if (name.length > 0 && !knownCues.has(name)) {
            push(
              findings,
              {
                ...context,
                elementId: element.id,
                kind: 'unknown_character_cue',
                severity: 'style',
                message: `${name} is not in the project's characters — add them to assign a voice.`,
                start: 0,
                end: element.text.length,
              },
              element.text,
            );
          }
        }

        if (includeStyle && PROSE_LIKE.has(element.type)) {
          checkStyle(element, context, findings, { longSentenceWords }, screenplay);
        }
      }

      if (screenplay) checkShape(beat.manuscript.elements, context, findings, { longParenthetical, actionWall });
    }
  }

  // What the writer has switched off never reaches them.
  return findings.filter((finding) => !ignored.has(finding.kind));
};

/**
 * Apply several findings at once — every one of a kind, say.
 *
 * They are applied **back to front within each element**, so an earlier
 * finding's offsets are still true when its turn comes. Only findings that
 * carry a replacement are applied; the rest are opinions and cannot be.
 */
export const applyFindings = (file: ProjectFile, findings: readonly EditorFinding[]): ProjectFile => {
  const fixable = findings.filter((finding) => finding.replacement !== undefined);
  if (fixable.length === 0) return file;

  const byBeat = new Map<string, EditorFinding[]>();
  for (const finding of fixable) {
    const list = byBeat.get(finding.beatId as string) ?? [];
    list.push(finding);
    byBeat.set(finding.beatId as string, list);
  }

  let next = file;
  for (const [beatId, list] of byBeat) {
    const beat = next.beats.find((candidate) => (candidate.id as string) === beatId);
    if (!beat) continue;

    const elements = beat.manuscript.elements.map((element) => {
      const here = list
        .filter((finding) => finding.elementId === element.id)
        .sort((a, b) => b.start - a.start);
      if (here.length === 0) return element;

      let text = element.text;
      let lastStart = Number.POSITIVE_INFINITY;
      for (const finding of here) {
        // Overlapping findings cannot both be applied; the later one wins and
        // the pass is re-run, which is what the caller does anyway.
        if (finding.end > lastStart) continue;
        text = `${text.slice(0, finding.start)}${finding.replacement}${text.slice(finding.end)}`;
        lastStart = finding.start;
      }
      return { ...element, text };
    });

    next = updateBeat(next, beat.id, { manuscript: { elements } });
  }
  return next;
};

/** The findings grouped by rule, commonest first: what to work through. */
export interface FindingGroup {
  kind: FindingKind;
  label: string;
  severity: FindingSeverity;
  findings: EditorFinding[];
  fixable: number;
}

export const groupFindings = (findings: readonly EditorFinding[]): FindingGroup[] => {
  const groups = new Map<FindingKind, FindingGroup>();
  for (const finding of findings) {
    const group = groups.get(finding.kind) ?? {
      kind: finding.kind,
      label: FINDING_LABELS[finding.kind],
      severity: finding.severity,
      findings: [],
      fixable: 0,
    };
    group.findings.push(finding);
    if (finding.replacement !== undefined) group.fixable += 1;
    groups.set(finding.kind, group);
  }
  // Errors before opinions, and the commonest first inside each.
  return [...groups.values()].sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) || b.findings.length - a.findings.length,
  );
};

/**
 * Apply one finding's suggestion. Findings hold character ranges, so applying
 * one invalidates the offsets of any later finding in the same element — the
 * caller re-runs the pass rather than applying a batch blind.
 */
export const applyFinding = (file: ProjectFile, finding: EditorFinding): ProjectFile => {
  if (finding.replacement === undefined) return file;
  const beat = file.beats.find((candidate) => candidate.id === finding.beatId);
  if (!beat) return file;

  const elements = beat.manuscript.elements.map((element) => {
    if (element.id !== finding.elementId) return element;
    const text = `${element.text.slice(0, finding.start)}${finding.replacement}${element.text.slice(finding.end)}`;
    return { ...element, text };
  });

  return updateBeat(file, beat.id, { manuscript: { elements } });
};

export interface DailyEditorSummary {
  errors: number;
  style: number;
  fixable: number;
}

export const summariseFindings = (findings: readonly EditorFinding[]): DailyEditorSummary => ({
  errors: findings.filter((finding) => finding.severity === 'error').length,
  style: findings.filter((finding) => finding.severity === 'style').length,
  fixable: findings.filter((finding) => finding.replacement !== undefined).length,
});
