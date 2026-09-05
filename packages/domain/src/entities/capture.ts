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
  status: captureStatusSchema.default('pending'),
  reviewedAt: isoDateTime().nullable().default(null),
  /** What the approved capture became, once the writer confirmed it. */
  resultRef: storyEntityRefSchema.nullable().default(null),
  /** Offline-tolerant queue bookkeeping (§11). */
  syncedAt: isoDateTime().nullable().default(null),
  ...timestamps,
});
export type CaptureItem = z.infer<typeof captureItemSchema>;
