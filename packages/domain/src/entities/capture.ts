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

/**
 * The two states that mean *nobody has placed this yet* (addendum 09 §15).
 *
 * **One list rather than one per host.** The desktop reads the queue from
 * Supabase and the browser preview reads it through a route, and *what is
 * waiting* is the question both have to answer identically — a desk that
 * disagreed with itself about which notes are still on the phone's list is a
 * note that disappears on one machine and not the other.
 */
export const WAITING_STATUSES: ReadonlyArray<CaptureStatus> = ['pending', 'needs_review'];

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

/**
 * What a note was actually captured under (addendum 09 §10, from Ken).
 *
 * **A string rather than the enum above**, and the widening is deliberate. §4's
 * five were fixed for a phone that did not know which project it was in; the
 * app has opened on a project list since stage 5, so the words a writer may
 * say are now the project's own — a screenplay's Scene and Beat, a textbook's
 * Section and Subsection — and `captureVocabulary` reads them off the format
 * rather than storing a sixth, seventh and eighth enum value nobody can add to
 * without a migration.
 *
 * The five keep their exact spellings, so every note ever captured reads back
 * as what it was, and the enum above stays as the older, narrower vocabulary
 * that `inboxGroups` and the review screen still understand.
 *
 * Unvalidated on purpose: a key this build has never heard of is still a note,
 * and the inbox's promise is that **the last group is never hidden**. A schema
 * that refused it would turn a note captured by a newer phone into nothing.
 */
export const captureKeySchema = z.string().max(40);

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
  category: captureKeySchema.nullable().default(null),
  /**
   * The name the writer spoke — §9's *character notes should retain the spoken
   * character name*, and §10's optional short label for the other four.
   *
   * Its own column rather than a corner of `inference`, because **this is
   * testimony and `inference` is for guesses**. A name a person said is not a
   * thing to be weighed against a confidence score.
   */
  subjectName: z.string().nullable().default(null),
  /**
   * The writer's own word this note was said under (addendum 09 §12, from Ken:
   * *you can create subcategories for that project if you need to*).
   *
   * **A word on the note and never a folder in the project.** Saying it creates
   * nothing: §1's line is that the phone captures and the desktop places, and a
   * taxonomy grown from a pocket is the folder tree §2 refuses. What it is for
   * is that a walk arrives at the desk already divided, and that filing a whole
   * group is one press there — which is where the folder is finally made, by
   * somebody looking at it.
   *
   * Free text rather than a key, for `category`'s reason one level down: it is
   * the writer's word, and nothing here is entitled to a list of what they are
   * allowed to have thought about.
   */
  subcategory: z.string().nullable().default(null),
  status: captureStatusSchema.default('pending'),
  reviewedAt: isoDateTime().nullable().default(null),
  /** What the approved capture became, once the writer confirmed it. */
  resultRef: storyEntityRefSchema.nullable().default(null),
  /** Offline-tolerant queue bookkeeping (§11). */
  syncedAt: isoDateTime().nullable().default(null),
  ...timestamps,
});
export type CaptureItem = z.infer<typeof captureItemSchema>;
