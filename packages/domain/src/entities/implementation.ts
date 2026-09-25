import { z } from 'zod';
import { id, timestamps } from './common.js';
import type { ImplementationBindingId, ProjectId } from '../ids.js';

/**
 * A binding: VC Game Studio's note that an authored record has been built in
 * an engine (addendum 25 §2).
 *
 * VC Writer plans and Game Studio implements, and both open the same `.vcw`.
 * This record is how the second's work survives the first: it is a collection
 * VC Writer's schema names, so a Save here carries it exactly rather than
 * stripping it as an unknown key.
 *
 * **Everything engine-shaped is free text**: `sourceType`, `engine` and
 * `target`. An enum here would be widened by every new engine or bindable
 * kind, and a file carrying a value an older VC Writer does not know fails to
 * open at all. A string a reader does not recognise is simply a binding it
 * does not read.
 *
 * **Status is not stored.** Unbound, partial, implemented, needs update and
 * conflict are read off this record and the one it points at, every time —
 * the same reason reachability is a reading (addendum 18 §4).
 */
export const implementationBindingSchema = z.object({
  id: id<ImplementationBindingId>(),
  projectId: id<ProjectId>(),
  /** What kind of authored record this implements: `element`, `choice`, … */
  sourceType: z.string(),
  /** The authored record's id. */
  sourceId: z.string(),
  /** `godot`, `unity`, `unreal`. Free text, never an enum. */
  engine: z.string().default(''),
  /** Where it was built: a node path, a prefab GUID, a Blueprint path. */
  target: z.string().default(''),
  /**
   * `fingerprintOf` the authored record when it was bound. A different
   * fingerprint now is what *needs update* means.
   */
  sourceHash: z.string().default(''),
  /** Game Studio's word that the binding is finished, not in progress. */
  complete: z.boolean().default(false),
  note: z.string().default(''),
  ...timestamps,
});
export type ImplementationBinding = z.infer<typeof implementationBindingSchema>;
