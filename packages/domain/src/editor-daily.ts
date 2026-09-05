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
  | 'unknown_character_cue';

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

/**
 * Run the pass. Findings come back in document order, so walking them is the
 * same as reading the script.
 */
export const runDailyEditor = (file: ProjectFile, options: DailyEditorOptions = {}): EditorFinding[] => {
  const includeStyle = options.includeStyle ?? true;
  const longSentenceWords = options.longSentenceWords ?? 30;
  const screenplay = !isProseFormat(file.project.format);
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
    }
  }

  return findings;
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
