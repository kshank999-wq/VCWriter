import { screenplayElementTypeSchema, proseElementTypeSchema } from './entities/manuscript.js';
import type { ManuscriptElementType } from './entities/manuscript.js';
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
