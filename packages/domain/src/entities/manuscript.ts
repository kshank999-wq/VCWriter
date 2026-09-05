import { z } from 'zod';
import { id } from './common.js';
import type { CharacterId, ManuscriptElementId } from '../ids.js';

/**
 * Manuscript content is stored as a platform-neutral list of typed elements
 * (spec §14: "keep manuscript/project format platform-neutral"), never as
 * rendered text or as a formatting-engine-specific blob. Screenplay pagination,
 * PDF export and future export formats (§6) are renderers over this list.
 */

export const screenplayElementTypeSchema = z.enum([
  'scene_heading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot',
  'general',
]);
export type ScreenplayElementType = z.infer<typeof screenplayElementTypeSchema>;

export const proseElementTypeSchema = z.enum(['paragraph', 'heading', 'blockquote', 'scene_break']);
export type ProseElementType = z.infer<typeof proseElementTypeSchema>;

export const manuscriptElementTypeSchema = z.union([screenplayElementTypeSchema, proseElementTypeSchema]);
export type ManuscriptElementType = z.infer<typeof manuscriptElementTypeSchema>;

export const manuscriptElementSchema = z.object({
  id: id<ManuscriptElementId>(),
  type: manuscriptElementTypeSchema,
  text: z.string(),
  /** Dialogue/character elements bind to a character so TTS can voice them (§10). */
  characterId: id<CharacterId>().nullable().default(null),
  /** Dual dialogue, revision colours, locked-page marks and similar extras. */
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});
export type ManuscriptElement = z.infer<typeof manuscriptElementSchema>;

export const manuscriptSegmentSchema = z.object({
  elements: z.array(manuscriptElementSchema).default([]),
});
export type ManuscriptSegment = z.infer<typeof manuscriptSegmentSchema>;

export const emptyManuscript = (): ManuscriptSegment => ({ elements: [] });

const WORD_PATTERN = /[^\s]+/g;

export const countWords = (segment: ManuscriptSegment): number =>
  segment.elements.reduce((total, element) => total + (element.text.match(WORD_PATTERN)?.length ?? 0), 0);
