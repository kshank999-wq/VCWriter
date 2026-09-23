import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addResearchItem,
  addUnit,
  createProjectFile,
  deleteResearchItem,
  ideasIn,
  linkEntities,
  ref,
  researchItemsIn,
  researchTree,
  threadLayout,
  workingNotes,
  type ProjectFile,
} from '../index.js';

/**
 * Everywhere a research note is read, after it has been deleted
 * (addendum 24 §5k).
 *
 * The third module with the same fault: three readings wrote `!item.archived`
 * for themselves — the folder counts down the side menu, the room's idea boxes
 * and the theme threads on the timeline. The folder count is the one a writer
 * meets first, since it is the number beside the shelf they just deleted from.
 */

/** A note in Themes, linked to a scene so it draws a thread. */
const noted = () => {
  let file: ProjectFile = createProjectFile({ title: 'The Bell', format: 'screenplay' });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Scene 1' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
  file = beat.file;

  const themes = file.researchCategories.find((one) => one.systemKey === 'themes')!;
  file = addResearchItem(file, { categoryId: themes.id, title: 'Grief is a room' });
  const note = file.researchItems[file.researchItems.length - 1]!;
  file = linkEntities(file, {
    from: ref('research_item', note.id as string),
    to: ref('unit', scene.unit.id as string),
    type: 'relates_to',
  });
  return { file, gone: deleteResearchItem(file, note.id), note, themes };
};

const countIn = (file: ProjectFile, name: string) => {
  const walk = (folders: ReturnType<typeof researchTree>): number | null => {
    for (const folder of folders) {
      if (folder.category.name === name) return folder.count;
      const under = walk(folder.children);
      if (under !== null) return under;
    }
    return null;
  };
  return walk(researchTree(file));
};

describe('a deleted note is off every reading that names one', () => {
  it('leaves the module’s own readings', () => {
    const { file, gone } = noted();
    expect(workingNotes(file).map((one) => one.title)).toEqual(['Grief is a room']);
    expect(workingNotes(gone)).toEqual([]);
    expect(researchItemsIn(gone, { view: 'all' })).toEqual([]);
  });

  it('leaves the count beside its folder', () => {
    const { file, gone, themes } = noted();
    expect(countIn(file, themes.name)).toBe(1);
    expect(countIn(gone, themes.name)).toBe(0);
  });

  it('leaves the theme threads on the timeline', () => {
    const { file, gone } = noted();
    expect(threadLayout(file).themes.map((one) => one.name)).toEqual(['Grief is a room']);
    expect(threadLayout(gone).themes).toEqual([]);
  });

  it('leaves the room’s idea boxes', () => {
    const { file, gone } = noted();
    expect(ideasIn(file).map((one) => one.title)).toEqual(['Grief is a room']);
    expect(ideasIn(gone)).toEqual([]);
  });

  it('is still in its collection, with its link, so restoring gives it back', () => {
    const { gone, note } = noted();
    expect(gone.researchItems.some((one) => one.id === note.id)).toBe(true);
    expect(gone.links.some((link) => link.from.id === (note.id as string))).toBe(true);
  });
});
