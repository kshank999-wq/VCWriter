import { z } from 'zod';

/**
 * One mark on a piece of script (addendum 07 §27): its own small file so a
 * beat's drafts can carry marks without the beat depending on the room.
 */

export const MARK_KINDS = ['highlight', 'strike', 'underline', 'note', 'suggest'] as const;
export const markKindSchema = z.enum(MARK_KINDS);
export type MarkKind = (typeof MARK_KINDS)[number];

export const MARK_KIND_NAMES: Record<MarkKind, string> = {
  highlight: 'Highlight',
  strike: 'Strike through',
  underline: 'Underline',
  note: 'Note',
  suggest: 'Suggest wording',
};

/** The highlighter's colours: few, and readable on the page in either theme. */
export const MARK_COLOURS = ['#f5d547', '#7ed492', '#f29bb6', '#8ec5ff'] as const;

export const markSchema = z
  .object({
    id: z.string().min(1).max(64),
    elementId: z.string().min(1).max(64),
    start: z.number().int().min(0),
    end: z.number().int().min(0),
    kind: markKindSchema,
    colour: z.string().max(16).default(MARK_COLOURS[0]),
    /** What the marker said about it. A note's whole point; optional on the rest. */
    note: z.string().max(2000).default(''),
    /** The wording suggested in place of the span. Only a `suggest` mark has one. */
    replacement: z.string().max(2000).default(''),
    /** The words the mark was made on, as they read when it was made. */
    quote: z.string().max(2000).default(''),
  })
  .refine((mark) => mark.end >= mark.start, { message: 'A mark ends after it starts.' });
export type Mark = z.infer<typeof markSchema>;

