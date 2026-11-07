import { describe, expect, it } from 'vitest';
import {
  addItem,
  createOutline,
  createProjectFile,
  dropOutlineRow,
  findOutline,
  indentItem,
  outlineLevels,
  outlineRows,
  updateItem,
  type ProjectFile,
} from '../index.js';

/**
 * Dragging in the Outliner, by two rules (from Ken): onto a row puts it
 * inside, as a sub-element; between rows puts it beside, at that level. And
 * Tab keeps a row where it stands.
 */
const book = () => {
  let file: ProjectFile = createProjectFile({ title: 'Book', format: 'instructional' });
  const made = createOutline(file);
  file = made.file;
  const id = made.outline.id;
  const add = (input: Parameters<typeof addItem>[2]) => {
    const r = addItem(file, id, input);
    file = r.file;
    return r.itemId!;
  };
  const ch = add({ kind: 'chapter', title: 'Ch' });
  const s1 = add({ parentId: ch, kind: 'scene', title: 'S1' });
  const sub = add({ parentId: s1, kind: 'beat', title: 'Sub' });
  const s2 = add({ parentId: ch, kind: 'scene', title: 'S2', afterId: s1 });
  return { get file() { return file; }, set file(next) { file = next; }, id, ch, s1, sub, s2 };
};
const levels = outlineLevels('instructional');
const shape = (file: ProjectFile, id: string) =>
  outlineRows(findOutline(file, id as never)!).map((row) => `${'-'.repeat(row.depth)}${row.item.title}:${row.item.kind}`);

describe('dragging in the outline', () => {
  it('puts a row dropped onto another inside it, a level down', () => {
    const b = book();
    const next = dropOutlineRow(b.file, b.id, b.s2, b.s1, 'into', levels)!;
    expect(shape(next, b.id)).toEqual(['Ch:chapter', '-S1:scene', '--Sub:beat', '--S2:beat']);
  });

  it('puts a row dropped between rows beside them, at their level', () => {
    const b = book();
    const next = dropOutlineRow(b.file, b.id, b.sub, b.s2, 'after', levels)!;
    expect(shape(next, b.id)).toEqual(['Ch:chapter', '-S1:scene', '-S2:scene', '-Sub:scene']);
  });

  it('refuses a drop into its own branch', () => {
    const b = book();
    expect(dropOutlineRow(b.file, b.id, b.s1, b.sub, 'into', levels)).toBeNull();
  });
});

describe('Tab', () => {
  it('keeps a row where it stands when the row above is folded', () => {
    const b = book();
    b.file = updateItem(b.file, b.id, b.s1, { collapsed: true });
    const next = indentItem(b.file, b.id, b.s2, levels);
    expect(shape(next, b.id)).toEqual(['Ch:chapter', '-S1:scene', '--S2:beat', '--Sub:beat']);
    expect(findOutline(next, b.id)!.items.find((one) => one.id === b.s1)!.collapsed).toBe(false);
  });
});
