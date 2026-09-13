import { z } from 'zod';
import { id, isoDateTime, timestamps } from './common.js';
import { storyEntityRefSchema } from './links.js';
import { systemCategoryKeySchema } from './research.js';
import type { AssetId, CaptureItemId, ProjectId, UserId } from '../ids.js';

/**
 * Voice/mobile intake (spec §9, §11).
 *
 * Raw capture is retained until the writer confirms classification: AI/NLU may
 * propose a destination, but confirmation governs anything that changes
 * canonical project data.
 */

export const captureSourceSchema = z.enum(['mobile_voice', 'mobile_text', 'desktop_dictation', 'import']);
export type CaptureSource = z.infer<typeof captureSourceSchema>;

export const captureStatusSchema = z.enum(['pending', 'needs_review', 'approved', 'rejected']);
export type CaptureStatus = z.infer<typeof captureStatusSchema>;

export const captureInferenceSchema = z.object({
  categoryKey: systemCategoryKeySchema.nullable().default(null),
  /** e.g. the character named in "Character Marisol — she never trusts him". */
  entityName: z.string().nullable().default(null),
  targetRef: storyEntityRefSchema.nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
  model: z.string().nullable().default(null),
});
export type CaptureInference = z.infer<typeof captureInferenceSchema>;

/**
 * What the writer asked for on the capture device, as opposed to what a
 * classifier guessed. A person choosing "Characters" on their phone is not an
 * inference, and the approval queue should not treat it as one.
 */
export const requestedRoutingSchema = z.object({
  kind: z.enum(['research', 'beat', 'character']),
  categoryKey: systemCategoryKeySchema.nullable().default(null),
});
export type RequestedRouting = z.infer<typeof requestedRoutingSchema>;

/**
 * The five kinds of thought the companion app captures (addendum 09 §4).
 *
 * **A category is not a destination** (addendum 09 §2). These say *what kind of
 * thought this is*, spoken out loud on the phone; `requestedRouting` above says
 * *where in the project it goes*, and on the companion app nobody answers that
 * question until they are back at the desk. Two of these name parts of the
 * program — Character, Arc — that a note in that category is emphatically not
 * being filed into.
 *
 * Five, and no more. The app's whole claim is that it stays a voice notebook,
 * and a sixth would be the first step back towards a taxonomy.
 */
export const captureCategorySchema = z.enum(['character', 'plot_point', 'idea', 'theme', 'arc']);
export type CaptureCategory = z.infer<typeof captureCategorySchema>;

/** What each category is called where a writer reads it. */
export const CAPTURE_CATEGORY_NAMES: Record<CaptureCategory, string> = {
  character: 'Character',
  plot_point: 'Plot Point',
  idea: 'Idea',
  theme: 'Theme',
  arc: 'Arc',
};

/** In the order the app offers them, which is the order the spec lists them. */
export const CAPTURE_CATEGORIES: ReadonlyArray<CaptureCategory> = [
  'character',
  'plot_point',
  'idea',
  'theme',
  'arc',
];

export const captureItemSchema = z.object({
  id: id<CaptureItemId>(),
  userId: id<UserId>(),
  /** Unassigned captures are allowed; the writer routes them on review. */
  projectId: id<ProjectId>().nullable().default(null),
  source: captureSourceSchema,
  capturedAt: isoDateTime(),
  /** Never cleared on approval — the raw capture is the recovery record (§9). */
  rawText: z.string().default(''),
  audioAssetId: id<AssetId>().nullable().default(null),
  transcriptConfidence: z.number().min(0).max(1).nullable().default(null),
  inference: captureInferenceSchema.nullable().default(null),
  /** The destination the writer chose when capturing; outranks `inference`. */
  requestedRouting: requestedRoutingSchema.nullable().default(null),
  /**
   * The kind of thought, said out loud (addendum 09 §4). Null for everything
   * captured before the companion app existed, and for a capture that never
   * named one.
   */
  category: captureCategorySchema.nullable().default(null),
  /**
   * The name the writer spoke — §9's *character notes should retain the spoken
   * character name*, and §10's optional short label for the other four.
   *
   * Its own column rather than a corner of `inference`, because **this is
   * testimony and `inference` is for guesses**. A name a person said is not a
   * thing to be weighed against a confidence score.
   */
  subjectName: z.string().nullable().default(null),
  status: captureStatusSchema.default('pending'),
  reviewedAt: isoDateTime().nullable().default(null),
  /** What the approved capture became, once the writer confirmed it. */
  resultRef: storyEntityRefSchema.nullable().default(null),
  /** Offline-tolerant queue bookkeeping (§11). */
  syncedAt: isoDateTime().nullable().default(null),
  ...timestamps,
});
export type CaptureItem = z.infer<typeof captureItemSchema>;
