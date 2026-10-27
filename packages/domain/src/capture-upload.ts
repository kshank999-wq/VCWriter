import { z } from 'zod';
import { captureKeySchema, captureSourceSchema } from './entities/capture.js';

/**
 * What the phone is allowed to send, and what it becomes (addendum 09 §6,
 * stage 2).
 *
 * **The shape is the permission.** A capture row carries fields that belong to
 * the desktop — `status`, `inference`, `reviewed_at`, what the note was turned
 * into — and the phone has no business setting any of them. Rather than
 * checking that on the way in, the payload simply has nowhere to put them: a
 * client that tried has no field to try with, and the row builder below writes
 * the desktop's columns itself.
 *
 * That is the same trick addendum 07 §12 used for the room's AI, for the same
 * reason. A rule enforced by the shape of the data cannot be forgotten by the
 * next person to touch the endpoint.
 *
 * **Idempotent on `client_capture_id`**, which the database has enforced with a
 * unique constraint since migration 0003: §11 asks that repeated Sync taps not
 * create duplicate notes, and the answer is that the second send is an upsert
 * of the same row rather than an insert of a new one. The client makes the id
 * once, when the note is written to its own storage — never at send time, or a
 * retry would make a new one.
 */

export const captureUploadSchema = z.object({
  /** Made on the device when the note was saved, not when it was sent. */
  clientCaptureId: z.string().min(1).max(200),
  /**
   * Null is allowed: §11's offline case includes catching a thought before
   * choosing a project, and the desktop routes it on review.
   */
  projectId: z.string().uuid().nullable().default(null),
  source: captureSourceSchema.default('mobile_voice'),
  capturedAt: z.string().datetime(),
  /**
   * The note's words. **Empty is allowed where the note has a title** (addendum
   * 27 §17): a character named on a walk with nothing said after it is a note,
   * and refusing it held up every note behind it on Ken's phone.
   */
  rawText: z.string().max(20_000).default(''),
  /**
   * What kind of thought the writer said it was, if they said (§4).
   *
   * **`captureKeySchema` rather than the five-value enum**, which is a fault
   * this stage found rather than made: §10 widened the vocabulary to the
   * project's own words and migration 0060 widened the column to match, and
   * this schema was not told — so the documented route refused a `setting` or a
   * `sub` note with a 400 while the web page, which writes to the database
   * directly, took them happily. A gate beside a reader that has learned to
   * take more is the barcode's own lesson (addendum 20 §16a) pointed at a
   * payload, and the shape being the permission is no defence when the shape
   * is out of date.
   */
  category: captureKeySchema.nullable().default(null),
  /** The name they spoke. Testimony, never a guess (§3.1). */
  subjectName: z.string().max(200).nullable().default(null),
  /** The writer's own word this note was said under (§12). */
  subcategory: z.string().max(200).nullable().default(null),
  /**
   * The story in a collection the note is for (addendum 27 §23): the story's
   * marker id, chosen from the list on the phone. Null for every other format.
   */
  storyId: z.string().uuid().nullable().default(null),
  /** How sure the transcription was, when the device can say. */
  transcriptConfidence: z.number().min(0).max(1).nullable().default(null),
}).refine((note) => note.rawText.trim().length > 0 || (note.subjectName ?? '').trim().length > 0, {
  message: 'A note needs some words or a title.',
  path: ['rawText'],
});
export type CaptureUpload = z.infer<typeof captureUploadSchema>;

/**
 * A Sync press read **note by note** (addendum 27 §17). The batch used to be
 * accepted or refused whole, so one note the server would not take held up
 * every note queued behind it — on Ken's phone, everything after the first
 * title-only note, with the screen saying *Saved*. Now each note stands on its
 * own: the good ones land, and each refused one comes back with its reason.
 */
export const readUploadBatch = (
  body: unknown,
): { notes: CaptureUpload[]; refused: { clientCaptureId: string | null; reason: string }[] } | null => {
  const list = (body as { notes?: unknown } | null)?.notes;
  if (!Array.isArray(list) || list.length === 0 || list.length > 200) return null;
  const notes: CaptureUpload[] = [];
  const refused: { clientCaptureId: string | null; reason: string }[] = [];
  for (const one of list) {
    const read = captureUploadSchema.safeParse(one);
    if (read.success) notes.push(read.data);
    else {
      const id = (one as { clientCaptureId?: unknown } | null)?.clientCaptureId;
      refused.push({ clientCaptureId: typeof id === 'string' ? id : null, reason: read.error.issues[0]?.message ?? 'That is not a note.' });
    }
  }
  return { notes, refused };
};

/** A whole Sync press: everything still waiting on the device, in one call. */
export const captureUploadBatchSchema = z.object({
  notes: z.array(captureUploadSchema).min(1).max(200),
});
export type CaptureUploadBatch = z.infer<typeof captureUploadBatchSchema>;

/**
 * The row an upload becomes, for the user it came from.
 *
 * `status` is written here rather than accepted from the phone, and it is
 * always `pending`: a note arriving from a device has not been looked at, and
 * that is true whatever the sender claims (§1 — the desktop places).
 */
export const uploadToRow = (
  upload: CaptureUpload,
  userId: string,
  now: string = new Date().toISOString(),
): Record<string, unknown> => ({
  user_id: userId,
  project_id: upload.projectId,
  source: upload.source,
  captured_at: upload.capturedAt,
  raw_text: upload.rawText,
  category: upload.category,
  subject_name: upload.subjectName,
  subcategory: upload.subcategory,
  story_marker_id: upload.storyId,
  transcript_confidence: upload.transcriptConfidence,
  client_capture_id: upload.clientCaptureId,
  synced_at: now,
  status: 'pending',
});

/**
 * Whether the phone may still change a note.
 *
 * **Once the desktop has placed it, it belongs to the project** (§7's editing
 * and deletion). The research note is made, possibly edited, possibly linked;
 * reaching back from a phone to alter the capture it came from would change
 * nothing about the project and everything about the record of where the note
 * came from. So: a note waiting is the writer's to fix or throw away, and a
 * note placed is history.
 *
 * The database says the same thing in migration 0042, because a rule that lives
 * only in a screen is a rule the next client will not know about.
 */
export const mayStillEdit = (status: string): boolean =>
  status === 'pending' || status === 'needs_review';
