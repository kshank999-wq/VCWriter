import { onlyLiving } from './graveyard.js';
import { researchCategoriesInOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { ResearchCategoryId } from './ids.js';

/**
 * Removing a research folder (addendum 24 §5g, from Ken: *I need a delete for
 * research notes and folders too*).
 *
 * **A folder is a shelf, not work**, so it never goes to the graveyard and
 * nothing needs to: `removeResearchCategory` has always moved everything up to
 * where the folder was, so deleting one **takes nothing away** — which is the
 * track's rule (§5e) arriving a second time. There is nothing to restore
 * because nothing was lost; what a writer needs is to be told that before they
 * press, which is what this sentence is for.
 */

/** What removing this folder would do. */
export interface FolderRemoval {
  /** Whether it may be removed at all. */
  allowed: boolean;
  /** Where its contents would go. Empty where nothing may happen. */
  moveTo: string;
  /** The one sentence a screen shows. Always set. */
  sentence: string;
}

export const folderRemoval = (file: ProjectFile, categoryId: ResearchCategoryId): FolderRemoval => {
  const category = file.researchCategories.find((one) => one.id === categoryId);
  if (!category) return { allowed: false, moveTo: '', sentence: 'That folder is not here.' };
  // A seeded folder is the shelf the program put there, so it stays: this is
  // a fact about the project rather than a warning about the press.
  if (category.systemKey !== null) {
    return { allowed: false, moveTo: '', sentence: 'This is one of the shelves the project comes with, so it stays.' };
  }

  const parentId = category.parentId ?? null;
  const home =
    (parentId ? file.researchCategories.find((one) => one.id === parentId) : null) ??
    researchCategoriesInOrder(file).find((one) => one.id !== categoryId) ??
    null;
  if (!home) return { allowed: false, moveTo: '', sentence: 'The last folder stays: notes need a shelf.' };

  const notes = onlyLiving(file.researchItems).filter((item) => item.categoryId === categoryId).length;
  const folders = file.researchCategories.filter((one) => one.parentId === categoryId).length;
  const parts: string[] = [];
  if (notes > 0) parts.push(`${notes} ${notes === 1 ? 'note' : 'notes'}`);
  if (folders > 0) parts.push(`${folders} ${folders === 1 ? 'folder' : 'folders'}`);
  // One note moves; a note and a folder move. Driving the screen caught *1
  // note move to Ideas*, which is what a count joined to a fixed verb gives.
  const moves = parts.length === 1 && notes + folders === 1 ? 'moves' : 'move';

  return {
    allowed: true,
    moveTo: home.name,
    sentence:
      parts.length === 0
        ? `The folder goes. Nothing is in it.`
        : `The folder goes and ${parts.join(' and ')} ${moves} to ${home.name}. Nothing filed in it is lost.`,
  };
};
