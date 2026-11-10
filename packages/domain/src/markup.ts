import { z } from 'zod';
import { seatName, type Seat } from './room.js';
import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import type { ProjectFile } from './project-file.js';
import type { BeatRevision } from './entities/structure.js';
import type { BeatRevisionId } from './ids.js';
import { mayEmail, type Notice } from './notify.js';

/**
 * Marking up a version, the way a PDF is marked up (addendum 07 §27).
 *
 * From Ken: *a section for markup and comparing … see three versions across
 * the screen at a time, or two, or just the one, and mark it up … and be able
 * to send that back … and then there needs to be a notification that there's
 * been a markup to that writer.*
 *
 * **A markup is about a version and never inside it.** A version is a record
 * that cannot be changed once it exists (§9), so the marks live beside it: each
 * one names a manuscript element by its id and a span of that element's text by
 * character offsets. Element ids are the same on every branch's copy of a
 * scene, which is what lets a mark made on one writer's pass be read against
 * the same line in another's.
 *
 * Five tools, as a PDF reader has them: highlight, strike through, underline,
 * a note, and suggested wording. Each carries the words it was made on
 * (`quote`), so a mark can still be read where the text around it has moved.
 */

export {
  MARK_KINDS,
  markKindSchema,
  MARK_KIND_NAMES,
  MARK_COLOURS,
  markSchema,
  type MarkKind,
  type Mark,
} from './entities/mark.js';
import { MARK_COLOURS, MARK_KIND_NAMES, markSchema, type Mark, type MarkKind } from './entities/mark.js';

export const MARKUP_STATES = ['sent', 'seen'] as const;
export const markupStateSchema = z.enum(MARKUP_STATES);
export type MarkupState = (typeof MARKUP_STATES)[number];

export const markupSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  versionId: z.string(),
  /** Who marked it up. */
  authorId: z.string(),
  /** Whose version it is, and so who it is sent to. */
  recipientId: z.string().nullable().default(null),
  marks: z.array(markSchema).default([]),
  /** A covering note for the whole markup. */
  note: z.string().default(''),
  state: markupStateSchema.default('sent'),
  sentAt: z.string(),
  seenAt: z.string().nullable().default(null),
  /**
   * Put away once it has been dealt with (from Ken: *it doesn't get erased …
   * once they get fixed, you can send them to archive*). Archived is a place,
   * not an ending: an archived markup still opens.
   */
  archivedAt: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type Markup = z.infer<typeof markupSchema>;

// ------------------------------------------------------------ making marks

/**
 * A mark from a selection, or a reason it cannot be one.
 *
 * A selection across two elements is refused rather than split, because the
 * marker meant one thing by it and two marks would say two.
 */
export const markFromSelection = (input: {
  id: string;
  elementId: string;
  text: string;
  start: number;
  end: number;
  kind: MarkKind;
  colour?: string;
  note?: string;
  replacement?: string;
}): Mark | { reason: 'empty' | 'needs_words' } => {
  const start = Math.max(0, Math.min(input.start, input.end, input.text.length));
  const end = Math.min(input.text.length, Math.max(input.start, input.end));
  // A note may sit on a point; everything else marks words.
  if (end === start && input.kind !== 'note') return { reason: 'empty' };
  if ((input.kind === 'note' && !(input.note ?? '').trim()) || (input.kind === 'suggest' && !(input.replacement ?? '').trim())) {
    return { reason: 'needs_words' };
  }
  return markSchema.parse({
    id: input.id,
    elementId: input.elementId,
    start,
    end,
    kind: input.kind,
    colour: input.colour ?? MARK_COLOURS[0],
    note: (input.note ?? '').trim(),
    replacement: (input.replacement ?? '').trim(),
    quote: input.text.slice(start, end),
  });
};

// -------------------------------------------------------------- showing them

export interface MarkedSegment {
  text: string;
  /** The marks over this run of text, in the order they were made. */
  marks: Mark[];
}

/**
 * A line of text cut where marks begin and end, so each run can be drawn with
 * every mark that covers it. Marks may overlap; a run carries all of them.
 * Offsets past the end of the text (the line has changed since) are clamped
 * rather than dropped, so a mark is never silently lost.
 */
export const segmentsFor = (text: string, marks: readonly Mark[]): MarkedSegment[] => {
  const spans = marks
    .filter((mark) => mark.end > mark.start)
    .map((mark) => ({ mark, start: Math.min(mark.start, text.length), end: Math.min(mark.end, text.length) }))
    .filter((span) => span.end > span.start);
  const cuts = new Set<number>([0, text.length]);
  for (const span of spans) {
    cuts.add(span.start);
    cuts.add(span.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: MarkedSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    if (to <= from) continue;
    out.push({
      text: text.slice(from, to),
      marks: spans.filter((span) => span.start <= from && span.end >= to).map((span) => span.mark),
    });
  }
  return out.length > 0 ? out : [{ text, marks: [] }];
};

/** The marks on one element, in reading order. */
export const marksOn = (marks: readonly Mark[], elementId: string): Mark[] =>
  marks.filter((mark) => mark.elementId === elementId).sort((a, b) => a.start - b.start || a.end - b.end);

/** A mark said in one line, for the list beside the page. */
export const describeMark = (mark: Mark): string => {
  const quoted = mark.quote.trim() ? `“${mark.quote.trim().slice(0, 60)}${mark.quote.trim().length > 60 ? '…' : ''}”` : '';
  switch (mark.kind) {
    case 'suggest':
      return `${quoted} → “${mark.replacement}”`;
    case 'note':
      return quoted ? `${quoted}: ${mark.note}` : mark.note;
    default:
      return `${MARK_KIND_NAMES[mark.kind]} ${quoted}${mark.note ? ` — ${mark.note}` : ''}`.trim();
  }
};

/** Markups waiting for this person: sent to them, not yet opened, not archived. */
export const unseenMarkups = (markups: readonly Markup[], userId: string): Markup[] =>
  markups.filter((markup) => markup.recipientId === userId && markup.state === 'sent' && !markup.archivedAt);

// ------------------------------------------------------ into the script

/**
 * A markup brought into the script as drafts (addendum 07 §27.2).
 *
 * From Ken: *if you want to bring it into the script, then you can bring it in
 * as a markup and then in the version it'll have the initials of the writer
 * plus markup in the drop-down menu.* Each beat the marks touch gains a draft
 * named that way, holding the marked version's text for that beat and the
 * marks on it. Nothing already in the beat changes: the working draft stays
 * the working draft, and the markup is read beside it.
 *
 * Beats are matched by id, which every branch of a room shares. A marked beat
 * this script does not have is counted rather than invented.
 */
export const bringInMarkup = (
  file: ProjectFile,
  input: {
    /** The version that was marked up. */
    source: ProjectFile;
    marks: readonly Mark[];
    /** "MA markup": the marked text's writer's initials, then the word. */
    label: string;
    /** Who made the marks, by name. */
    markedBy: string;
  },
): { file: ProjectFile; beats: number; missing: number } => {
  const markedElements = new Set(input.marks.map((mark) => mark.elementId));
  const marked = input.source.beats.filter((beat) =>
    beat.manuscript.elements.some((element) => markedElements.has(element.id as string)),
  );
  const here = new Set(file.beats.map((beat) => beat.id as string));
  const at = nowIso();
  let beats = 0;
  const next = {
    ...file,
    beats: file.beats.map((beat) => {
      const from = marked.find((one) => one.id === beat.id);
      if (!from) return beat;
      beats += 1;
      const ids = new Set(from.manuscript.elements.map((element) => element.id as string));
      const taken = new Set([beat.revisionName, ...beat.revisions.map((one) => one.name)]);
      let name = input.label;
      for (let count = 2; taken.has(name); count += 1) name = `${input.label} ${count}`;
      return {
        ...beat,
        revisions: [
          ...beat.revisions,
          {
            id: newId<BeatRevisionId>(),
            name,
            manuscript: from.manuscript,
            savedAt: at,
            marks: input.marks.filter((mark) => ids.has(mark.elementId)),
            markedBy: input.markedBy,
            archived: false,
          },
        ],
        updatedAt: at,
      };
    }),
  };
  return { file: next, beats, missing: marked.filter((beat) => !here.has(beat.id as string)).length };
};

/** The label a brought-in markup's drafts carry: the writer's initials, then "markup". */
export const markupDraftLabel = (writerInitials: string): string =>
  `${writerInitials.trim() || 'Writer'} markup`;

/** Whether a beat draft is a markup brought in, rather than a draft written. */
export const isMarkupDraft = (revision: Pick<BeatRevision, 'marks'>): boolean => revision.marks.length > 0;

// -------------------------------------------------------------- telling them

/**
 * The email that says a version has come back marked up.
 *
 * None where the marker marked up their own version, where the version has no
 * writer in the room, or where the writer has turned room email off.
 */
export const noticeForMarkup = (input: {
  markup: Markup;
  seats: readonly Seat[];
  roomName: string;
  versionLabel: string;
}): Notice | null => {
  const { markup } = input;
  if (!markup.recipientId || markup.recipientId === markup.authorId) return null;
  const seat = input.seats.find((one) => one.userId === markup.recipientId) ?? null;
  if (!seat || !mayEmail(seat)) return null;
  const by = input.seats.find((one) => one.userId === markup.authorId);
  const who = by ? seatName(by) : 'The showrunner';
  const count = markup.marks.length;
  return {
    kind: 'markup',
    to: seat,
    subject: `${input.versionLabel} marked up — ${input.roomName}`,
    line: `${who} marked up ${input.versionLabel} with ${count === 1 ? 'one mark' : `${count} marks`}.`,
    said: markup.note.trim(),
    path: `/rooms/${markup.roomId}?view=markups&markup=${markup.id}`,
  };
};

/** Initials from a name: "Ken Shank" → "KS". At most three letters. */
export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase())
    .join('')
    .slice(0, 3);

/**
 * Marks made in the beat writing screen, kept as a markup draft of that beat
 * (addendum 07 §27.3).
 *
 * The marks are saved with a copy of the text they were made on, as a draft
 * of their own ("KS markup"), so the working draft goes on being written while
 * the marks stay readable beside it. The same draft a room markup becomes when
 * it is brought in, so both are read, listed and archived the same way.
 */
export const addMarkupDraft = (
  file: ProjectFile,
  input: { beatId: string; marks: readonly Mark[]; markedBy: string },
): ProjectFile => {
  if (input.marks.length === 0) return file;
  const at = nowIso();
  const label = markupDraftLabel(initialsOf(input.markedBy) || 'Me');
  return {
    ...file,
    beats: file.beats.map((beat) => {
      if ((beat.id as string) !== input.beatId) return beat;
      const taken = new Set([beat.revisionName, ...beat.revisions.map((one) => one.name)]);
      let name = label;
      for (let count = 2; taken.has(name); count += 1) name = `${label} ${count}`;
      return {
        ...beat,
        revisions: [
          ...beat.revisions,
          {
            id: newId<BeatRevisionId>(),
            name,
            manuscript: beat.manuscript,
            savedAt: at,
            marks: [...input.marks],
            markedBy: input.markedBy.trim(),
            archived: false,
          },
        ],
        updatedAt: at,
      };
    }),
  };
};

