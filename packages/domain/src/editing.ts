import { screenplayElementTypeSchema, proseElementTypeSchema } from './entities/manuscript.js';
import type { ManuscriptElement, ManuscriptElementType } from './entities/manuscript.js';
import type { ProjectFormat } from './entities/project.js';

/**
 * Element flow rules for the writing workspace (spec §6).
 *
 * A screenplay editor earns its keep by knowing what comes next: press Return
 * after a character cue and you are writing dialogue, press it after dialogue
 * and you are back in action. Tab walks the ring of element types when the
 * guess is wrong. Both tables live here rather than in the component so the
 * behaviour is pinned by tests instead of by whichever keydown handler ran.
 */

/** What pressing Return at the end of an element should create next. */
const SCREENPLAY_ON_ENTER: Record<string, ManuscriptElementType> = {
  scene_heading: 'action',
  action: 'action',
  shot: 'action',
  general: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'scene_heading',
};

const PROSE_ON_ENTER: Record<string, ManuscriptElementType> = {
  paragraph: 'paragraph',
  heading: 'paragraph',
  blockquote: 'paragraph',
  scene_break: 'paragraph',
};

/** The order Tab walks through. */
export const SCREENPLAY_CYCLE = [
  'scene_heading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot',
] as const satisfies readonly ManuscriptElementType[];

export const PROSE_CYCLE = [
  'paragraph',
  'heading',
  'blockquote',
  'scene_break',
] as const satisfies readonly ManuscriptElementType[];

export const isProseFormat = (format: ProjectFormat): boolean =>
  format === 'novel' || format === 'short_story';

export const elementTypesFor = (format: ProjectFormat): ManuscriptElementType[] =>
  isProseFormat(format) ? [...proseElementTypeSchema.options] : [...screenplayElementTypeSchema.options];

export const cycleFor = (format: ProjectFormat): readonly ManuscriptElementType[] =>
  isProseFormat(format) ? PROSE_CYCLE : SCREENPLAY_CYCLE;

export const defaultElementType = (format: ProjectFormat): ManuscriptElementType =>
  isProseFormat(format) ? 'paragraph' : 'action';

export const typeOnEnter = (format: ProjectFormat, current: ManuscriptElementType): ManuscriptElementType => {
  const table = isProseFormat(format) ? PROSE_ON_ENTER : SCREENPLAY_ON_ENTER;
  return table[current] ?? defaultElementType(format);
};

/** Tab moves forward through the ring; Shift+Tab moves back. */
export const cycleType = (
  format: ProjectFormat,
  current: ManuscriptElementType,
  direction: 1 | -1 = 1,
): ManuscriptElementType => {
  const ring = cycleFor(format);
  const index = ring.indexOf(current);
  if (index === -1) return ring[0] as ManuscriptElementType;
  const next = (index + direction + ring.length) % ring.length;
  return ring[next] as ManuscriptElementType;
};

/**
 * A parenthetical is only meaningful inside a speech, so Tab from a character
 * cue offers it, but Tab from action skips straight past it.
 */
export const isDialogueElement = (type: ManuscriptElementType): boolean =>
  type === 'character' || type === 'parenthetical' || type === 'dialogue';

// ---------------------------------------------------------------------------
// The Tab/Enter system (addendum 02 §7)
// ---------------------------------------------------------------------------

/**
 * What a keystroke does to the line being written: which style it becomes,
 * and whether that style starts a new line or re-types the one in hand.
 */
export interface Typing {
  type: ManuscriptElementType;
  /** True: start a new element. False: re-type the current element in place. */
  newLine: boolean;
}

const line = (type: ManuscriptElementType): Typing => ({ type, newLine: true });
const here = (type: ManuscriptElementType): Typing => ({ type, newLine: false });

/**
 * The two keys a screenplay is written with, as Final Draft defines them:
 * **Tab changes the line you are on** into the style that comes next when
 * you are changing mode — action to a character cue, a cue to a
 * parenthetical, dialogue back to a cue — and **Return** starts a new line
 * in the style that continues what you are doing. Shift+Tab walks back
 * through the styles.
 *
 * (Causality's variant of this table starts a new line on Tab and sends a
 * cue to dialogue; Final Draft's is the one writers' hands know, and it is
 * the one implemented here.)
 *
 * Prose has no such convention: Return continues the paragraph, and Tab
 * walks the small ring of prose styles in place.
 */
export const onTab = (
  format: ProjectFormat,
  current: ManuscriptElementType,
  _isEmpty = false,
  direction: 1 | -1 = 1,
): Typing => {
  if (isProseFormat(format) || direction === -1) return here(cycleType(format, current, direction));
  switch (current) {
    case 'scene_heading':
      return here('action');
    case 'action':
      return here('character');
    case 'character':
      return here('parenthetical');
    case 'parenthetical':
      return here('dialogue');
    case 'dialogue':
      return here('character');
    case 'transition':
      return here('scene_heading');
    default:
      return here('action');
  }
};

export const onEnter = (format: ProjectFormat, current: ManuscriptElementType, isEmpty: boolean): Typing => {
  if (isProseFormat(format)) return line(typeOnEnter(format, current));
  switch (current) {
    case 'parenthetical':
      // A parenthetical is opened and closed on its own line; Return leaves it
      // for the speech it qualifies, in place if nothing was typed in it.
      return isEmpty ? here('dialogue') : line('dialogue');
    default:
      return line(typeOnEnter(format, current));
  }
};

// ---------------------------------------------------------------------------
// Auto-type: the style a line turns out to be, from what was typed
// ---------------------------------------------------------------------------

/** A line of action that starts this way is a scene heading. */
const SCENE_PREFIX = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?|I\/E\.?)\s/i;

/** Lines that are transitions when they are the whole line. */
export const TRANSITION_WORDS = [
  'CUT TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'JUMP CUT TO:',
  'DISSOLVE TO:',
  'FADE TO:',
  'WIPE TO:',
  'FADE IN:',
  'FADE OUT.',
  'CUT TO BLACK.',
  'THE END',
] as const;

/** Lines that are shot descriptions when a line starts with one. */
export const SHOT_WORDS = [
  'ANGLE ON',
  'CLOSE ON',
  'CLOSER ON',
  'WIDE ON',
  'BACK TO SCENE',
  'INSERT',
  'POV',
  'PAN TO',
  'PUSH IN',
  'PULL BACK',
  'TRACKING SHOT',
  'AERIAL SHOT',
  'REVERSE ANGLE',
] as const;

/** Extensions offered after a character cue. */
export const CHARACTER_EXTENSIONS = ["(CONT'D)", '(O.S.)', '(O.C.)', '(V.O.)', '(ON VIDEO)', '(ON PHONE)', '(PRELAP)'] as const;

export interface AutoTypeOptions {
  /** Shot detection is off by default: "INSERT" is a word writers use in action. */
  detectShots?: boolean;
}

/**
 * The style a line of action turns out to be from what has been typed into
 * it: a slugline when it opens with INT./EXT., a transition when the whole
 * line is one, a shot when shot detection is on. Returns null when the line
 * is what it says it is. Only ever re-types plain action, never a line the
 * writer has deliberately styled.
 */
export const autoType = (
  format: ProjectFormat,
  current: ManuscriptElementType,
  text: string,
  options: AutoTypeOptions = {},
): ManuscriptElementType | null => {
  if (isProseFormat(format)) return null;
  if (current !== 'action' && current !== 'general') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const upper = trimmed.toUpperCase();

  if (SCENE_PREFIX.test(trimmed)) return 'scene_heading';
  if (TRANSITION_WORDS.some((word) => upper === word)) return 'transition';
  if (options.detectShots && SHOT_WORDS.some((word) => upper.startsWith(word))) return 'shot';
  return null;
};

/**
 * Character cues to offer while typing one, best first: whoever spoke in this
 * beat most recently comes first — but not the speaker of the line just
 * above, because two speeches in a row from the same character are rare and
 * dialogue alternates. Everyone else in the project follows, alphabetically.
 */
export const cueSuggestions = (
  everyone: readonly string[],
  spokenInOrder: readonly string[],
): string[] => {
  const recent: string[] = [];
  for (let index = spokenInOrder.length - 1; index >= 0; index -= 1) {
    const name = (spokenInOrder[index] as string).toUpperCase();
    if (!recent.includes(name)) recent.push(name);
  }
  // The one who just spoke is the least likely to speak next.
  const justSpoke = recent.shift();
  const rest = [...new Set(everyone.map((name) => name.toUpperCase()))]
    .filter((name) => !recent.includes(name) && name !== justSpoke)
    .sort();
  return [...recent, ...rest, ...(justSpoke ? [justSpoke] : [])];
};

// ---------------------------------------------------------------------------
// Dual dialogue (addendum 02 §7.1)
// ---------------------------------------------------------------------------

/**
 * A speech marked dual is printed beside the speech before it, which is how
 * two characters are shown talking at once. The mark sits on the character
 * cue and means "alongside the one above", so the pair is discovered from
 * the element list rather than kept as a separate structure — a beat's text
 * stays one flat list of elements (§14).
 */
export const isDual = (element: ManuscriptElement): boolean => element.attributes['dual'] === true;

/** A character cue and the parentheticals and dialogue that belong to it. */
export interface SpeechItem {
  kind: 'dual';
  left: ManuscriptElement[];
  right: ManuscriptElement[];
  /** Positions in the original element list, left then right. */
  indexes: number[];
}

export type ManuscriptItem =
  | { kind: 'element'; element: ManuscriptElement; index: number }
  | SpeechItem;

const isSpeechBody = (type: ManuscriptElementType): boolean => type === 'dialogue' || type === 'parenthetical';

/**
 * The element list as it is laid out: single elements, and dual speeches as
 * pairs. The paginator and the editor both read this, so what is printed
 * side by side is what is edited side by side.
 */
export const groupManuscript = (elements: readonly ManuscriptElement[]): ManuscriptItem[] => {
  const items: ManuscriptItem[] = [];

  /** Pull the speech that has just been emitted back off the list, if any. */
  const takePreviousSpeech = (): { elements: ManuscriptElement[]; indexes: number[] } | null => {
    let start = items.length;
    while (start > 0) {
      const item = items[start - 1];
      if (!item || item.kind !== 'element') return null;
      if (isSpeechBody(item.element.type)) {
        start -= 1;
        continue;
      }
      if (item.element.type === 'character') {
        start -= 1;
        break;
      }
      return null;
    }
    const taken = items.slice(start);
    if (taken.length === 0) return null;
    const first = taken[0];
    if (!first || first.kind !== 'element' || first.element.type !== 'character') return null;
    items.length = start;
    return {
      elements: taken.map((item) => (item as { element: ManuscriptElement }).element),
      indexes: taken.map((item) => (item as { index: number }).index),
    };
  };

  let index = 0;
  while (index < elements.length) {
    const element = elements[index] as ManuscriptElement;
    if (element.type === 'character' && isDual(element)) {
      const right: ManuscriptElement[] = [element];
      const rightIndexes = [index];
      let next = index + 1;
      while (next < elements.length && isSpeechBody((elements[next] as ManuscriptElement).type)) {
        right.push(elements[next] as ManuscriptElement);
        rightIndexes.push(next);
        next += 1;
      }
      const previous = takePreviousSpeech();
      if (previous) {
        items.push({ kind: 'dual', left: previous.elements, right, indexes: [...previous.indexes, ...rightIndexes] });
      } else {
        // Nothing to sit beside: it is an ordinary speech until there is.
        right.forEach((member, position) => items.push({ kind: 'element', element: member, index: rightIndexes[position] as number }));
      }
      index = next;
      continue;
    }
    items.push({ kind: 'element', element, index });
    index += 1;
  }

  return items;
};

/**
 * The paragraph styles bound to Ctrl/Cmd+1…9, the way a screenwriting
 * program numbers them.
 */
export const styleShortcuts = (format: ProjectFormat): Record<string, ManuscriptElementType> =>
  isProseFormat(format)
    ? { '1': 'heading', '2': 'paragraph', '3': 'blockquote', '4': 'scene_break' }
    : {
        '1': 'scene_heading',
        '2': 'action',
        '3': 'character',
        '4': 'parenthetical',
        '5': 'dialogue',
        '6': 'transition',
        '7': 'shot',
        '9': 'general',
      };
