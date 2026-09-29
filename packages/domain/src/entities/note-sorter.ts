import { z } from 'zod';
import { id, isoDateTime, orderKey, timestamps } from './common.js';
import type { NoteSessionId, NoteSourceId, ProjectId } from '../ids.js';

/**
 * The Note Sorter's own two records (addendum 26 §1, §2).
 *
 * **Two, because the audit found the rest already built.** The spec's §19 data
 * model names four things — a session, a source document, a category and an
 * extracted note — and two of them have been in this program for years under
 * their own names: a `ResearchCategory` has carried a `parentId`, a `color`
 * and an `orderKey` since addendum 02 §7, which is the whole of §8's nesting,
 * colouring and reordering; and a `ResearchItem` has carried a title, a body,
 * tags, an order and a place in the graveyard, which is most of §9's card. So
 * a sorting category **is** a research category and a card **is** a research
 * item, and what is genuinely new is the session those categories belong to
 * and the source a card was pulled out of.
 *
 * That is not a shortcut. §17 asks that an extracted note be able to *become
 * or attach to* a chapter, a scene, a character, a theme, a research item —
 * and `research_item` has been a `storyEntityType` since the links table was
 * built, so a card can already be joined to any of them with nothing added.
 * A second `extracted_notes` table would have had to grow all of that again,
 * and would have been a second answer to *what is a note*.
 */

/**
 * One sitting at the sorting table.
 *
 * It owns its **categories** (a research category carrying this id is the
 * session's; one carrying null is an ordinary research folder) and its
 * **sources**. Nothing else about it is stored: how far through it you are is
 * counted from the notes every time, because a stored percentage would go on
 * saying *58% dealt with* after the source it counted was replaced.
 */
export const noteSessionSchema = z.object({
  id: id<NoteSessionId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1),
  /**
   * There is deliberately **no writing mode** here. The handoff asks for one on
   * the sitting to set the *Send to Outliner* mapping; the project has had a
   * format since the first migration and `sendLadder` reads the mapping off it,
   * so a second field saying what kind of work this is would be two claims
   * about one work, free to disagree the moment either is edited. It was
   * written, found to be read by nothing, and taken out (migration 0058) rather
   * than left as a field that lies — `columns` on a part's style, exactly
   * (addendum 20 §17).
   */
  archived: z.boolean().default(false),
  orderKey: orderKey(),
  ...timestamps,
});
export type NoteSession = z.infer<typeof noteSessionSchema>;

/** Where a session's material came from (§3). */
export const noteSourceKindSchema = z.enum(['file', 'paste', 'typed', 'notes', 'dictation']);
export type NoteSourceKind = z.infer<typeof noteSourceKindSchema>;

export const NOTE_SOURCE_WORDS: Record<NoteSourceKind, string> = {
  file: 'Imported file',
  paste: 'Pasted text',
  typed: 'Typed here',
  notes: 'VC Writer notes',
  dictation: 'Dictation',
};

/**
 * A source document, **immutable** (§6).
 *
 * `text` is written once and never again. That is what makes *Show original
 * source* a promise the module can keep rather than a reconstruction it has to
 * attempt: the original is not rebuilt from overlays, it is simply read, and
 * there is no code path anywhere that edits it. Extracting marks nothing on
 * it; a note records the range it took, and everything about *processed* is
 * counted back from those ranges (§7).
 *
 * The consequence worth stating is that **the extracted text is not stored**.
 * The spec's §19 lists `extractedText: a snapshot` beside the range, and with
 * an immutable source a snapshot can only ever agree with `text.slice(from,
 * to)` or be wrong about it — the sixth time this project has made a fact
 * about the work a reading rather than a column. What *is* stored is the
 * writer's **working text**, on the card, because that is theirs to change and
 * is a different thing from what the page said.
 */
export const noteSourceSchema = z.object({
  id: id<NoteSourceId>(),
  projectId: id<ProjectId>(),
  sessionId: id<NoteSessionId>(),
  name: z.string().min(1),
  kind: noteSourceKindSchema.default('typed'),
  /** Immutable. Nothing in the module writes here after the source is made. */
  text: z.string().default(''),
  /** What it was called on disk, where it came off disk. */
  fileName: z.string().default(''),
  importedAt: isoDateTime().nullable().default(null),
  orderKey: orderKey(),
  ...timestamps,
});
export type NoteSource = z.infer<typeof noteSourceSchema>;
