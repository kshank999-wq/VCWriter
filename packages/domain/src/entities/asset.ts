import { z } from 'zod';
import { id, timestamps } from './common.js';
import type { AssetId, ProjectId } from '../ids.js';

/**
 * Something the document carries (addendum 05 §3c) — a picture, or a clip.
 *
 * A storyboard frame, and later anything else the file has to hold. **It
 * travels in the project**, as a data URI, because a project is one document
 * that opens on another machine — a frame pointing at a folder on somebody's
 * desktop is a frame that is gone the moment the file is sent anywhere.
 *
 * Stored once and referenced by id, so a frame used on two rows is one
 * picture in the file rather than two.
 *
 * A **video** is the same thing that moves. It is carried the same way and
 * for the same reason, and it brings one fact a drawing does not: its own
 * length, which the board reads rather than asks for (§4b).
 */
export const assetKindSchema = z.enum(['image', 'video']);
export type AssetKind = z.infer<typeof assetKindSchema>;

export const assetSchema = z.object({
  id: id<AssetId>(),
  projectId: id<ProjectId>(),
  kind: assetKindSchema.default('image'),
  /** What it was called when it came in, so a writer can tell two apart. */
  name: z.string().default(''),
  /** `data:image/jpeg;base64,…`. The picture, or the clip, itself. */
  data: z.string().default(''),
  /** Its own size, so a plate can hold its shape before it has loaded. */
  width: z.number().int().min(0).default(0),
  height: z.number().int().min(0).default(0),
  /**
   * How long it runs, for a video. **Read from the file, never typed** — a
   * clip's length is a fact about the clip, and a board that let you argue
   * with it would be a board that lies about the cut (§4b). Zero for a
   * still, which has no length.
   */
  seconds: z.number().min(0).default(0),
  ...timestamps,
});
export type Asset = z.infer<typeof assetSchema>;
