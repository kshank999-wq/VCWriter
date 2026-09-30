import { z } from 'zod';
import { id, isoDateTime, orderKey, timestamps } from './common.js';
import { storyEntityRefSchema } from './links.js';
import { originSchema } from './structure.js';
import type {
  BeatId,
  NoteSessionId,
  NoteSourceId,
  ProjectId,
  ResearchCategoryId,
  ResearchItemId,
} from '../ids.js';

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
  /**
   * A Note Sorter sitting's **unsorted pile** — where a deleted sorting
   * category's cards land (addendum 26 §8).
   *
   * It is the one key that is not a shelf folder: it carries a `sessionId`, so
   * `researchCategoriesInOrder` keeps it out of the research room entirely. It
   * is marked here rather than found by its name for the reason every other key
   * exists — a pile located by matching the word *Unsorted* would be lost the
   * moment anybody renamed it, and would be found by accident in a folder
   * somebody else called that.
   */
  'note_unsorted',
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
  /**
   * The sorting session this category belongs to, or null for an ordinary
   * research folder (addendum 26 §2).
   *
   * **A sorting category is a research category**, because everything §8 asks
   * of one — nesting, colour, reordering, renaming — is already here. What
   * this field decides is *which room lists it*: the research shelf shows the
   * folders a writer filed things in, and a sorting session's categories are
   * the working surface of a sitting rather than shelves. `shelfCategories`
   * is the one reading that applies it, so a new surface asks rather than
   * writing `sessionId === null` for itself — which is the graveyard's lesson
   * (addendum 24 §5j) applied before the fault rather than after it.
   */
  sessionId: id<NoteSessionId>().nullable().default(null),
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
  /**
   * In the graveyard since (addendum 24): a delete stamps this and the record
   * keeps its place, so everything pointing at it goes on pointing at it and
   * restoring is clearing the field. `null` is the ordinary state.
   */
  deletedAt: z.string().datetime({ offset: true }).nullable().default(null),
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
  /**
   * A note to self about the card, never about the work (addendum 26 §16b).
   *
   * **Three fields, three questions**, which is why this is not `body` and not
   * `source`: `body` is the working text — the words that will travel into the
   * outline — `source` is where the fact came from, and this is *Pair with the
   * Hans Gruber example?*, which belongs to neither. A writer who had only the
   * working text to put it in would be typing an instruction into the words
   * the book is going to print.
   *
   * Empty on everything, so no existing note moves.
   */
  comment: z.string().default(''),
  /**
   * Where this card was pulled out of, and the exact stretch it took
   * (addendum 26 §3). Null on every research item that was not extracted,
   * which is all of them until somebody opens the Note Sorter.
   *
   * **The range is the lineage and the words are not.** `title` is the
   * working title and `body` the working text — the writer's, editable, and
   * never written back — while what the page actually said is
   * `source.text.slice(from, to)`, read every time. A source is immutable
   * (addendum 26 §2), so a stored copy of the passage could only ever agree
   * with that or be wrong about it.
   */
  sourceId: id<NoteSourceId>().nullable().default(null),
  sourceFrom: z.number().int().min(0).nullable().default(null),
  sourceTo: z.number().int().min(0).nullable().default(null),
  /**
   * Categories this card also shows in (§10's *Reference*). The card is not
   * copied: `categoryId` is its home and these are extra places it appears,
   * so editing it anywhere is editing the one record.
   */
  alsoIn: z.array(id<ResearchCategoryId>()).default([]),
  /**
   * Where in the book this note belongs — a chapter or a section (addendum 28
   * §2), from Ken: *you have a table of contents that you fill out that also
   * populates the research section… you can just drop it in and it'll show up
   * in the research section*.
   *
   * **A reference to the chapter, never a folder named after it.** A folder
   * would be a second record of one fact: rename the chapter and the folder
   * says the old name, move it and the folder does not follow, delete it and
   * the folder is an orphan holding notes about nothing. It is addendum 09
   * §12's rule in the other direction — there a spoken group is a word on the
   * note and never a folder in the project, here a chapter is a place in the
   * book and never a shelf beside it.
   *
   * It names **one** place rather than a chapter *and* a section, because
   * which chapter a section belongs to is already a reading: `divisionSpan`
   * answers it, and has been the answer three times in addendum 25 alone. So
   * filing a note under section 1.2 puts it under chapter 1 by itself, and
   * moving that section into chapter 3 moves the note with nothing run.
   *
   * Null on every note nobody has placed, which is all of them until somebody
   * opens the table of contents — so no existing project moves.
   */
  place: storyEntityRefSchema.nullable().default(null),
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
