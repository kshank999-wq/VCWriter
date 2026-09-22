import { z } from 'zod';
import { id, timestamps } from './common.js';
import type { LocationDescriptionId, LocationId, ProjectId } from '../ids.js';

/**
 * Locations (addendum 14, from Ken's Location Research & Scene Integration spec).
 *
 * A location is a **project asset like a character**, not a property of a
 * scene: one record, used by any number of scenes, edited in one place.
 *
 * The field that decides the shape is `descriptions`. §3.3 asks for several
 * prepared descriptions per location — *Initial Reveal*, *Night Version*,
 * *After the Fire* — rather than one paragraph, because a place is described
 * differently the second time it is seen, and a single field would make the
 * writer overwrite the first description to write the second.
 */

export const locationDescriptionSchema = z.object({
  id: id<LocationDescriptionId>(),
  /** Named so it can be chosen: "Initial reveal", "After the fire". */
  title: z.string().default(''),
  body: z.string().default(''),
  ...timestamps,
});
export type LocationDescription = z.infer<typeof locationDescriptionSchema>;

export const locationSchema = z.object({
  /**
   * In the graveyard since (addendum 24): a delete stamps this and the record
   * keeps its place, so everything pointing at it goes on pointing at it and
   * restoring is clearing the field. `null` is the ordinary state.
   */
  deletedAt: z.string().datetime({ offset: true }).nullable().default(null),
  id: id<LocationId>(),
  projectId: id<ProjectId>(),
  /** The canonical name, as the heading prints it: MILLER HOUSE. */
  name: z.string().default(''),
  /**
   * What the heading opens with, and what time of day it usually is.
   *
   * **Defaults, not facts about the place.** A scene may be in the same house
   * at night, and saying so must not rewrite the location — which is why the
   * scene keeps its own heading and this only fills it in.
   */
  setting: z.string().default('INT.'),
  time: z.string().default('DAY'),
  /** A compact label for a crowded picker. Optional, and usually unused. */
  shortName: z.string().default(''),
  /** Research, geography, production notes — whatever the writer needs. */
  notes: z.string().default(''),
  descriptions: z.array(locationDescriptionSchema).default([]),
  /**
   * Put away rather than deleted, because a location a scene still names is
   * not something to remove behind the writer's back (§8).
   */
  archived: z.boolean().default(false),
  ...timestamps,
});
export type Location = z.infer<typeof locationSchema>;
