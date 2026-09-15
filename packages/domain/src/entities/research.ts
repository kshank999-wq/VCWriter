import { z } from 'zod';
import { id, isoDateTime, orderKey, timestamps } from './common.js';
import { originSchema } from './structure.js';
import type { BeatId, ProjectId, ResearchCategoryId, ResearchItemId } from '../ids.js';

/**
 * Research and story intelligence (spec §7).
 *
 * Categories ship with defaults (Characters, Ideas, Plot Points, ...) but are
 * fully user-editable: create, rename, reorder, archive.
 */

/** Well-known categories the app reasons about; users may add any others. */
export const systemCategoryKeySchema = z.enum([
  'characters',
  'ideas',
  'plot_points',
  'locations',
  'props',
  'themes',
  'setups_payoffs',
  'world',
  /**
   * The instructional shelves (addendum 16 §3).
   *
   * A separate taxonomy rather than extra folders beside the creative ones,
   * because §3 asks for that and is right: a professor's research is graphics,
   * notes and ideas, and offering them Characters, Props and Themes alongside
   * is the software telling them what kind of book they are writing.
   *
   * `ideas` is deliberately **not** repeated here — it is already in the list
   * above and means the same thing in both. A second `instructional_ideas`
   * key would be two names for one shelf. Nor is there a `graphics` key: the
   * library (§9) is the graphics shelf, and a folder of the same name beside
   * it could only hold the wrong thing.
   */
  'notes',
  'inbox',
]);
export type SystemCategoryKey = z.infer<typeof systemCategoryKeySchema>;

export const researchCategorySchema = z.object({
  id: id<ResearchCategoryId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1),
  /** Set for seeded categories; `null` for anything the writer created. */
  systemKey: systemCategoryKeySchema.nullable().default(null),
  description: z.string().default(''),
  /**
   * The folder this one sits in, or null at the top (addendum 02 §7).
   * Research is a tree: a character folder can hold a folder of their
   * journey, which can hold the beats of it.
   */
  parentId: id<ResearchCategoryId>().nullable().default(null),
  /** A colour for the folder and everything filed in it; null inherits. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().default(null),
  orderKey: orderKey(),
  archived: z.boolean().default(false),
  ...timestamps,
});
export type ResearchCategory = z.infer<typeof researchCategorySchema>;

/**
 * Used/unused workflow (§7.2). `used` is a reversible state, never a delete;
 * `usedConfirmed` records whether a human confirmed it, because automatic
 * detection may only *suggest* that material has been incorporated.
 */
export const researchUsageSchema = z.enum(['unused', 'used']);
export type ResearchUsage = z.infer<typeof researchUsageSchema>;

export const researchItemSchema = z.object({
  id: id<ResearchItemId>(),
  projectId: id<ProjectId>(),
  categoryId: id<ResearchCategoryId>(),
  title: z.string().min(1),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
  /**
   * Where the material came from — a book, a paper, a URL, a lecture, a
   * person (addendum 16 §3).
   *
   * **The one field a nonfiction author cannot work without and a novelist
   * never needs.** `origin` below is already taken and answers a different
   * question — *how it got into the project* (typed, dictated, imported) —
   * which is not *whose fact this is*. A textbook that cannot cite is not a
   * textbook, and an importer that dropped the provenance of every note it
   * read would be worse than no importer.
   *
   * Free text rather than a structured citation: a writer pasting a DOI, a
   * page reference and a half-remembered author should not be stopped by a
   * form. Formatting a bibliography is a later problem and a different one.
   */
  source: z.string().default(''),
  usage: researchUsageSchema.default('unused'),
  usedAt: isoDateTime().nullable().default(null),
  /** Where the material was incorporated, when known. */
  usedInBeatIds: z.array(id<BeatId>()).default([]),
  /** False when the system inferred usage and the writer has not confirmed it. */
  usedConfirmed: z.boolean().default(false),
  archived: z.boolean().default(false),
  orderKey: orderKey(),
  origin: z.enum(['desktop', 'mobile_capture', 'import']).default('desktop'),
  /**
   * Who wrote it, in a room (addendum 07 §11).
   *
   * **Called `author` rather than `origin`** because `origin` above already
   * means something else here and has since 0001 — *how it got into the
   * project*, which is a different question from *whose it is*. A scene and a
   * beat carry the same fact under the name `origin`, since neither of them
   * has a provenance field to be confused with.
   *
   * Null for everything written outside a room, which is most research.
   */
  author: originSchema.nullable().default(null),
  ...timestamps,
});
export type ResearchItem = z.infer<typeof researchItemSchema>;

export interface SeededCategory {
  name: string;
  systemKey: SystemCategoryKey;
}

export const DEFAULT_RESEARCH_CATEGORIES: ReadonlyArray<SeededCategory> = [
  { name: 'Characters', systemKey: 'characters' },
  { name: 'Ideas', systemKey: 'ideas' },
  { name: 'Plot Points', systemKey: 'plot_points' },
  { name: 'Locations', systemKey: 'locations' },
  { name: 'Props', systemKey: 'props' },
  { name: 'Themes', systemKey: 'themes' },
];

/**
 * What an instructional book starts with instead (addendum 16 §3).
 *
 * §15 requires that creative and instructional research stay distinct, and
 * this is where that begins: a project seeded with these has no Characters
 * folder to ignore. The shelves are still ordinary categories — renameable,
 * reorderable, and joinable by any folder the author makes — because a
 * taxonomy the author cannot extend is one they will work around.
 *
 * **The inbox is last and is a real shelf**, not a modal. §4 wants imported
 * material to land somewhere before it is classified, and somewhere is a
 * place you can leave things and come back to.
 *
 * **There is deliberately no Graphics folder.** One was seeded here and the
 * screen showed why it should not be: the research menu carried a *Graphics*
 * folder that holds notes directly above a *Graphics* library that holds
 * pictures, and the first thing anybody would do is drop a diagram into the
 * one that cannot take it. The library is the graphics shelf; §9 is where it
 * lives, and a second thing of the same name is a trap rather than a taxonomy.
 */
export const INSTRUCTIONAL_RESEARCH_CATEGORIES: ReadonlyArray<SeededCategory> = [
  { name: 'General Notes', systemKey: 'notes' },
  { name: 'Ideas', systemKey: 'ideas' },
  { name: 'Imported', systemKey: 'inbox' },
];
