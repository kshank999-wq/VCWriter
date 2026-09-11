import { z } from 'zod';
import { id, orderKey, timestamps } from './common.js';
import { storyEntityRefSchema } from './links.js';
import type { BeatId, OutlineId, OutlineItemId, ProjectId, StructuralUnitId } from '../ids.js';

/**
 * The Outliner's document (addendum 06).
 *
 * **A tree of typed rows**, and the rigid sibling of the Sculptor's canvas:
 * the board is for finding a story and this is for organising the one that was
 * found. Material passes between them by dragging, never by converting (§2).
 *
 * An outline item is a **plan until the writer says otherwise** (§1) — the
 * board's sentence with one word changed, and deliberately so: promotion is
 * binding, with the same claim rule and the same two-way rename.
 */

/**
 * What a row **is**, which is a separate question from how deep it is (§4).
 *
 * > Item type and indentation are separate concepts.
 *
 * The load-bearing sentence of the whole module. A Character can sit under a
 * beat, a Note under that Character, and an Idea under the Note, and none of
 * it is a special case — so the type list can grow (Conflict, Revelation,
 * Theme, the writer's own) without the hierarchy changing at all. Hence a
 * string with known values rather than an enum that would refuse the eighth
 * one.
 */
export const OUTLINE_KINDS = ['scene', 'beat', 'note', 'idea', 'character', 'setting', 'prop'] as const;
export type OutlineKind = (typeof OUTLINE_KINDS)[number];

/** How far along a row is. The writer's own words are allowed (§8). */
export const OUTLINE_STATUSES = ['', 'planned', 'in_progress', 'written', 'revised'] as const;

export const outlineItemSchema = z.object({
  id: id<OutlineItemId>(),
  outlineId: id<OutlineId>(),
  /**
   * The row this hangs under, or null at the top.
   *
   * **This carries the whole shape.** There is deliberately no `depth`: a
   * depth stored beside a parent is a second answer to a question that already
   * has one, and the two come apart on the first drag.
   */
  parentId: id<OutlineItemId>().nullable().default(null),
  orderKey: orderKey(),
  /** Scene, Beat, Note, Idea, Character, Setting, Prop, or the writer's own. */
  kind: z.string().default('note'),
  title: z.string().default(''),
  /**
   * The row's own words, which are **not** the research item's (§5). *What
   * this character wants in this scene* is not a fact about the character; it
   * belongs to the row and stays there.
   */
  body: z.string().default(''),
  status: z.string().default(''),
  collapsed: z.boolean().default(false),
  /**
   * The scene or beat in the script this **is**, once promoted (§6). Null is a
   * plan, which is what every row starts as.
   */
  boundUnitId: id<StructuralUnitId>().nullable().default(null),
  boundBeatId: id<BeatId>().nullable().default(null),
  /**
   * The research this row references, where it was dragged in from the shelf
   * (§5). A **reference, not a copy**: the title follows the source, and
   * removing the row does not touch the research.
   *
   * It uses the project's existing `StoryEntityRef` rather than a table of its
   * own, because the relationship system already exists and a second one would
   * be a second set of rules to keep in step.
   */
  source: storyEntityRefSchema.nullable().default(null),
  ...timestamps,
});
export type OutlineItem = z.infer<typeof outlineItemSchema>;

export const outlineSchema = z.object({
  id: id<OutlineId>(),
  projectId: id<ProjectId>(),
  /** A project may have more than one (§13). */
  name: z.string().default(''),
  items: z.array(outlineItemSchema).default([]),
  ...timestamps,
});
export type Outline = z.infer<typeof outlineSchema>;
