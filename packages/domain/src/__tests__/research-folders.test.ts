import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import {
  addResearchCategory,
  addResearchItem,
  markResearchUsed,
  removeResearchCategory,
  reparentResearchCategory,
  updateResearchCategory,
} from '../mutations.js';
import { researchItemsIn, researchSubtree, researchTree } from '../selectors.js';
import { fromRows, toRows } from '../sync-mapping.js';

/** Characters ▸ Mike ▸ Journey, with a note in each of the two deeper ones. */
const nested = () => {
  let file = createProjectFile({ title: 'T', format: 'screenplay' });
  const characters = file.researchCategories.find((category) => category.systemKey === 'characters')!;
  const mike = addResearchCategory(file, { name: 'Mike', parentId: characters.id, color: '#8b1c1c' });
  file = mike.file;
  const journey = addResearchCategory(file, { name: 'Journey', parentId: mike.category.id });
  file = journey.file;
  file = addResearchItem(file, { categoryId: mike.category.id, title: 'Wears his father’s coat' });
  file = addResearchItem(file, { categoryId: journey.category.id, title: 'Stops believing' });
  return { file, characters, mike: mike.category, journey: journey.category };
};

describe('research as a tree', () => {
  it('files a folder inside another and counts what is in it, and under it', () => {
    const { file, mike } = nested();
    const tree = researchTree(file);
    const characters = tree.find((folder) => folder.category.systemKey === 'characters')!;

    expect(characters.children.map((child) => child.category.name)).toEqual(['Mike']);
    expect(characters.depth).toBe(0);
    const mikeFolder = characters.children[0]!;
    expect(mikeFolder.depth).toBe(1);
    expect(mikeFolder.category.color).toBe('#8b1c1c');
    // One note filed directly in Mike, two in Mike and everything under him.
    expect(mikeFolder.count).toBe(1);
    expect(mikeFolder.total).toBe(2);
    expect(characters.total).toBe(2);

    expect(researchSubtree(file, mike.id)).toHaveLength(2);
    expect(fromRows(toRows(file)).researchCategories.find((category) => category.id === mike.id)?.parentId).toBe(
      characters.category.id,
    );
  });

  it('shows a folder with everything under it, and can be asked for just the folder', () => {
    const { file, mike } = nested();
    expect(researchItemsIn(file, { categoryId: mike.id }).map((item) => item.title)).toEqual([
      'Wears his father’s coat',
      'Stops believing',
    ]);
    expect(
      researchItemsIn(file, { categoryId: mike.id }, { includeDescendants: false }).map((item) => item.title),
    ).toEqual(['Wears his father’s coat']);
  });

  it('searches across titles, bodies and tags', () => {
    const { file, mike } = nested();
    expect(researchItemsIn(file, { view: 'all' }, { query: 'coat' }).map((item) => item.title)).toEqual([
      'Wears his father’s coat',
    ]);
    expect(researchItemsIn(file, { categoryId: mike.id }, { query: 'believ' })).toHaveLength(1);
    expect(researchItemsIn(file, { view: 'all' }, { query: 'nothing here' })).toEqual([]);
  });

  it('has smart folders for what is used, what is not, and what was put away', () => {
    let { file } = nested();
    const [first] = file.researchItems;
    file = markResearchUsed(file, { itemId: first!.id, confirmed: true });

    expect(researchItemsIn(file, { view: 'used' }).map((item) => item.title)).toEqual(['Wears his father’s coat']);
    expect(researchItemsIn(file, { view: 'unused' }).map((item) => item.title)).toEqual(['Stops believing']);
    expect(researchItemsIn(file, { view: 'all' })).toHaveLength(2);
    expect(researchItemsIn(file, { view: 'archived' })).toEqual([]);
  });

  it('refuses to file a folder inside itself, or to move or remove a seeded one', () => {
    const { file, characters, mike, journey } = nested();
    expect(() => reparentResearchCategory(file, mike.id, journey.id)).toThrow(/inside itself/);
    expect(() => reparentResearchCategory(file, mike.id, mike.id)).toThrow(/inside itself/);
    expect(() => reparentResearchCategory(file, characters.id, mike.id)).toThrow(/seeded/);
    expect(() => removeResearchCategory(file, characters.id)).toThrow(/seeded/);

    // And a folder can be sent back to the top.
    const top = reparentResearchCategory(file, mike.id, null);
    expect(researchTree(top).map((folder) => folder.category.name)).toContain('Mike');
  });

  it('loses nothing when a folder goes: what was in it moves up to where it was', () => {
    const { file, characters, mike, journey } = nested();
    const after = removeResearchCategory(file, mike.id);

    // Mike is gone; his note and his Journey folder are where he was.
    expect(after.researchCategories.some((category) => category.id === mike.id)).toBe(false);
    expect(after.researchCategories.find((category) => category.id === journey.id)?.parentId).toBe(characters.id);
    expect(after.researchItems.map((item) => item.categoryId)).toEqual([characters.id, journey.id]);
    expect(after.researchItems).toHaveLength(2);
  });

  it('renames and recolours a folder', () => {
    const { file, mike } = nested();
    const after = updateResearchCategory(file, mike.id, { name: 'Mike Sanchez', color: '#5b7fa6' });
    const found = after.researchCategories.find((category) => category.id === mike.id);
    expect([found?.name, found?.color]).toEqual(['Mike Sanchez', '#5b7fa6']);
  });
});
