import { describe, expect, it } from 'vitest';
import {
  addSortCategory,
  addSource,
  beginSession,
  createProjectFile,
  extractToCategory,
  fileOnShelf,
  filingChoices,
  researchCategoriesInOrder,
  researchItemsIn,
  researchTree,
  unsortedOf,
  workingNotes,
  type ProjectFile,
} from '../index.js';

/**
 * `cast-surfaces` and `setups-surfaces`' third sibling (addendum 24 §5j, §5i).
 *
 * A Note Sorter card **is** a research item and a sorting category **is** a
 * research category — that is the audit the module rests on — so the risk the
 * module carries is the graveyard's exactly: a reading that never heard of the
 * sorter, listing a brainstorm nobody has filed yet among the writer's notes.
 * The fault there was found one surface at a time over five modules, and the
 * rule it produced is *no reading decides for itself which records exist*.
 *
 * So this walks **every** research reading rather than the ones the module
 * happens to touch, and each assertion checks the shelf **was** answering before
 * the sitting existed — a reading that shows nothing cannot pass by accident.
 */

const world = () => {
  let file: ProjectFile = createProjectFile({ title: 'Villain’s Guide', format: 'novel' });
  const shelfBefore = researchCategoriesInOrder(file).length;

  const begun = beginSession(file, 'brainstorm');
  file = begun.file;
  const session = begun.session;

  const added = addSource(file, {
    sessionId: session.id,
    name: 'Brainstorm',
    text: 'A villain who is right is the only one worth writing.',
    kind: 'paste',
  });
  file = added.file;

  const made = addSortCategory(file, { sessionId: session.id, name: 'Character' });
  file = made.file;

  const card = extractToCategory(file, {
    sourceId: added.source!.id,
    from: 0,
    to: 52,
    categoryId: made.category!.id,
  });
  file = card.file;

  return { file, session, shelfBefore, category: made.category!, card: card.card! };
};

describe('the sorter on research’s own surfaces', () => {
  it('a sitting’s categories are on none of them, and the shelf still is', () => {
    const { file, shelfBefore, category } = world();
    expect(shelfBefore).toBeGreaterThan(0);

    const shelf = researchCategoriesInOrder(file);
    expect(shelf).toHaveLength(shelfBefore);
    expect(shelf.some((one) => (one.id as string) === (category.id as string))).toBe(false);

    // The side menu's tree, and the room's *file this idea under…* list.
    expect(researchTree(file).some((one) => one.category.name === 'Character')).toBe(false);
    expect(researchTree(file)).toHaveLength(shelfBefore);
    expect(filingChoices(file).some((one) => (one.id as string) === (category.id as string))).toBe(false);
    expect(filingChoices(file)).toHaveLength(shelfBefore);
  });

  it('the unsorted pile is not a shelf folder either', () => {
    const { file, session, shelfBefore } = world();
    const pile = unsortedOf(file, session.id)!;
    expect(pile.systemKey).toBe('note_unsorted');
    // It carries a systemKey, which every shelf folder does, so the thing that
    // keeps it out is the sitting rather than the mark.
    expect(researchCategoriesInOrder(file, true).some((one) => (one.id as string) === (pile.id as string)))
      .toBe(false);
    expect(researchTree(file)).toHaveLength(shelfBefore);
  });

  it('a card is on none of the note readings until it is filed on the shelf', () => {
    const { file, card } = world();
    const isCard = (id: string) => id === (card.id as string);

    expect(workingNotes(file).some((one) => isCard(one.id as string))).toBe(false);
    // The smart folders: Everything, Used, Unused, Archived.
    for (const view of ['all', 'used', 'unused', 'archived'] as const) {
      expect(researchItemsIn(file, { view }).some((one) => isCard(one.id as string))).toBe(false);
    }
    // And the search, which is the same reading narrowed.
    expect(researchItemsIn(file, { view: 'all' }, { query: 'villain' })).toHaveLength(0);

    // Filing it moves its home, and every one of those readings has it.
    const folder = researchCategoriesInOrder(file)[0]!;
    const filed = fileOnShelf(file, card.id, folder.id);
    expect(workingNotes(filed).some((one) => isCard(one.id as string))).toBe(true);
    expect(researchItemsIn(filed, { view: 'all' }).some((one) => isCard(one.id as string))).toBe(true);
    expect(researchItemsIn(filed, { categoryId: folder.id }).some((one) => isCard(one.id as string))).toBe(true);
    // The folder's count follows, being a reading rather than arithmetic
    // somebody did in a component (addendum 24 §5k).
    expect(researchTree(filed).find((one) => (one.category.id as string) === (folder.id as string))!.count)
      .toBe(1);
  });
});
