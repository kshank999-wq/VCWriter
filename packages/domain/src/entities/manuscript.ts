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

/**
 * `figure` is a picture in the manuscript (addendum 16 §9).
 *
 * **A figure is an element, not an attachment.** Putting it in the element
 * list is what gives it a place in the reading order for free: it paginates,
 * prints, moves when its section moves, and appears in Book View at exactly
 * the point the author put it — none of which a side table of
 * "graphics attached to this section" could do without re-deriving the order
 * the manuscript already knows.
 *
 * The element's `text` is the caption *as printed here*, defaulting to the
 * asset's own; `attributes.assetId` names the picture. So one picture may
 * appear twice, and cutting a figure never deletes the picture from the
 * library — the same separation the location descriptions have.
 */
export const proseElementTypeSchema = z.enum([
  'paragraph',
  'heading',
  'blockquote',
  'scene_break',
  'figure',
]);
export type ProseElementType = z.infer<typeof proseElementTypeSchema>;

/**
 * **What a musical holds that a play does not** (addendum 38 §1, Ken's *Stage
 * Play Formatting Engine* spec §4.6).
 *
 * A musical preset was named and not built in addendum 37 because a preset
 * promising lyrics over a manuscript with no lyric element would be a control
 * that lies. These are those elements: the number's title, the sung words, the
 * band's cue and the choreographer's direction.
 *
 * **Element types rather than a style of dialogue.** A lyric is sung, keeps
 * its own line breaks and is set apart from speech on every musical page;
 * a dance direction is a stage direction someone other than the actors reads.
 * Each is a different line of the manuscript, which is what a type is for.
 *
 * They are a **stage play's** (`elementTypesFor`): a screenplay with a song in
 * it is written as action and dialogue, the way a film script sets one.
 */
export const musicalElementTypeSchema = z.enum(['song_title', 'lyric', 'music_cue', 'dance']);
export type MusicalElementType = z.infer<typeof musicalElementTypeSchema>;

export const manuscriptElementTypeSchema = z.union([
  screenplayElementTypeSchema,
  proseElementTypeSchema,
  musicalElementTypeSchema,
]);
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

/** The character cues in a segment, in the order they speak. */
export const cuesInOrder = (segment: ManuscriptSegment): string[] =>
  segment.elements
    .filter((element) => element.type === 'character' && element.text.trim().length > 0)
    // A cue may carry an extension — "MIKE (O.S.)" — which is not the name.
    .map((element) => element.text.trim().toUpperCase().replace(/\s*\(.*$/, ''));

const WORD_PATTERN = /[^\s]+/g;

export const countWords = (segment: ManuscriptSegment): number =>
  segment.elements.reduce((total, element) => total + (element.text.match(WORD_PATTERN)?.length ?? 0), 0);
