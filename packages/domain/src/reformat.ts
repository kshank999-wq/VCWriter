import { isProseFormat, TRANSITION_WORDS } from './editing.js';
import type { ManuscriptElementType } from './entities/manuscript.js';
import type { ProjectFormat } from './entities/project.js';

/**
 * Reading a script that arrives as plain text (addendum 02 §7.1).
 *
 * Text pasted from a mail, a text editor or another program is a wall of
 * lines: the shape of a screenplay is in the capitals, the indents and the
 * blank lines, not in any markup. This works that shape back out into typed
 * elements, so pasting a scene gives sluglines, cues and dialogue rather
 * than one long block of action to re-type by hand.
 *
 * It reads what writers actually have: Word and Notepad text, Fountain's
 * forcing characters (`.slug`, `@CUE`, `>TRANSITION:`), and hard-wrapped
 * lines, which are rejoined into the paragraph they were before someone's
 * column width broke them.
 */

export interface ReformattedElement {
  type: ManuscriptElementType;
  text: string;
  /**
   * Position of the element this came from, when there was one. A caller
   * re-typing a manuscript uses it to keep that element's identity — its
   * id, and anything hanging off it — rather than building a new one.
   */
  from?: number;
}

const SCENE_PREFIX = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?|EST\.?|I\/E\.?)[\s.]/i;

/** A line that is a character cue and not a shout in the middle of action. */
const looksLikeCue = (line: string): boolean => {
  const text = line.trim();
  if (text.length === 0 || text.length > 40) return false;
  if (!/[A-Z]/.test(text)) return false;
  // Capitals only, give or take an extension, a number or punctuation.
  if (text !== text.toUpperCase()) return false;
  if (/[.!?]$/.test(text.replace(/\s*\(.*\)\s*$/, ''))) return false;
  return true;
};

const looksLikeTransition = (line: string): boolean => {
  const text = line.trim().toUpperCase();
  if (text.length === 0 || text.length > 30) return false;
  return TRANSITION_WORDS.some((word) => text === word) || /\bTO:$/.test(text);
};

const isParenthetical = (line: string): boolean => /^\(.*\)$/.test(line.trim());

/** Lines that belong together, split where the text was left blank. */
const blocksOf = (text: string): string[][] => {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line.length === 0) {
      if (current.length > 0) blocks.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
};

/** Hard-wrapped lines are one paragraph again. */
const joined = (lines: readonly string[]): string => lines.join(' ').replace(/\s+/g, ' ').trim();

const speechFrom = (lines: readonly string[]): ReformattedElement[] => {
  const out: ReformattedElement[] = [];
  let speech: string[] = [];
  const flush = () => {
    if (speech.length > 0) {
      out.push({ type: 'dialogue', text: joined(speech) });
      speech = [];
    }
  };
  for (const line of lines) {
    if (isParenthetical(line)) {
      flush();
      out.push({ type: 'parenthetical', text: line.trim() });
      continue;
    }
    speech.push(line);
  }
  flush();
  return out;
};

const screenplayFrom = (blocks: string[][]): ReformattedElement[] => {
  const out: ReformattedElement[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index] as string[];
    const first = (block[0] as string).trim();
    const rest = block.slice(1);

    // Fountain's forcing characters, for text that already carries them.
    if (/^\.[^.]/.test(first)) {
      out.push({ type: 'scene_heading', text: first.slice(1).trim() });
      if (rest.length > 0) out.push({ type: 'action', text: joined(rest) });
      continue;
    }
    if (first.startsWith('@')) {
      out.push({ type: 'character', text: first.slice(1).trim() });
      out.push(...speechFrom(rest));
      continue;
    }
    if (first.startsWith('>')) {
      const text = first.replace(/^>\s*/, '').replace(/\s*<$/, '');
      out.push({ type: first.endsWith('<') ? 'general' : 'transition', text });
      if (rest.length > 0) out.push({ type: 'action', text: joined(rest) });
      continue;
    }

    if (SCENE_PREFIX.test(first)) {
      out.push({ type: 'scene_heading', text: first });
      if (rest.length > 0) out.push({ type: 'action', text: joined(rest) });
      continue;
    }

    if (block.length === 1 && looksLikeTransition(first)) {
      out.push({ type: 'transition', text: first });
      continue;
    }

    if (looksLikeCue(first)) {
      // A cue with its speech under it, or a cue whose speech is the block
      // after it — which is how text that has been through a mail client
      // usually arrives.
      if (rest.length > 0) {
        out.push({ type: 'character', text: first });
        out.push(...speechFrom(rest));
        continue;
      }
      const following = blocks[index + 1];
      if (following && !looksLikeCue(following[0] as string) && !SCENE_PREFIX.test((following[0] as string).trim())) {
        out.push({ type: 'character', text: first });
        out.push(...speechFrom(following));
        index += 1;
        continue;
      }
      // A lone shout with nothing to say is action in capitals.
      out.push({ type: 'action', text: first });
      continue;
    }

    out.push({ type: 'action', text: joined(block) });
  }

  return out;
};

const proseFrom = (blocks: string[][]): ReformattedElement[] =>
  blocks.map((block) => {
    const first = (block[0] as string).trim();
    if (block.length === 1) {
      if (/^#{1,6}\s+/.test(first)) return { type: 'heading' as const, text: first.replace(/^#+\s+/, '') };
      if (/^(\*\s*){3,}$|^#{3,}$|^-{3,}$/.test(first)) return { type: 'scene_break' as const, text: first };
      if (/^(chapter|part|prologue|epilogue)\b/i.test(first) || (first === first.toUpperCase() && first.length <= 40)) {
        return { type: 'heading' as const, text: first };
      }
    }
    if (block.every((line) => line.startsWith('>'))) {
      return { type: 'blockquote' as const, text: joined(block.map((line) => line.replace(/^>\s*/, ''))) };
    }
    return { type: 'paragraph' as const, text: joined(block) };
  });

/**
 * Plain text as typed manuscript elements. Empty text gives nothing, and a
 * single unremarkable line gives one element, so a caller can leave an
 * ordinary paste to the ordinary paste.
 */
export const reformatText = (text: string, format: ProjectFormat): ReformattedElement[] => {
  const blocks = blocksOf(text);
  if (blocks.length === 0) return [];
  return isProseFormat(format) ? proseFrom(blocks) : screenplayFrom(blocks);
};

/** Styles that carry no decision: what plain pasted or typed text becomes. */
export const isUntyped = (type: ManuscriptElementType): boolean =>
  type === 'action' || type === 'general' || type === 'paragraph';

/**
 * Re-read elements that were never typed — plain action, or a note — and
 * leave everything else exactly as the writer set it. This is the reformat
 * a writer asks for after pasting a scene in as text: it can be run twice
 * with no further effect, and it never touches a line that was deliberately
 * styled.
 */
export const reformatUntyped = (
  elements: readonly { type: ManuscriptElementType; text: string }[],
  format: ProjectFormat,
): ReformattedElement[] => {
  const out: ReformattedElement[] = [];
  let pending: { text: string; at: number }[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    const parsed = reformatText(pending.map((entry) => entry.text).join('\n\n'), format);
    // The elements that were there keep their place, so the ones that came
    // out of the same text keep their identity where they can.
    parsed.forEach((element, position) => {
      const source = pending[position];
      out.push(source ? { ...element, from: source.at } : element);
    });
    pending = [];
  };

  elements.forEach((element, at) => {
    if (isUntyped(element.type)) {
      pending.push({ text: element.text, at });
      return;
    }
    flush();
    out.push({ type: element.type, text: element.text, from: at });
  });
  flush();
  return out;
};
