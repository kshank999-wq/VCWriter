import { z } from 'zod';
import { captureCategorySchema, captureSourceSchema } from './entities/capture.js';

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
  rawText: z.string().min(1).max(20_000),
  /** What kind of thought the writer said it was, if they said (§4). */
  category: captureCategorySchema.nullable().default(null),
  /** The name they spoke. Testimony, never a guess (§3.1). */
  subjectName: z.string().max(200).nullable().default(null),
  /** How sure the transcription was, when the device can say. */
  transcriptConfidence: z.number().min(0).max(1).nullable().default(null),
});
export type CaptureUpload = z.infer<typeof captureUploadSchema>;

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
