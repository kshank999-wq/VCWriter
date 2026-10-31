import { describe, expect, it } from 'vitest';
import {
  addItem,
  createOutline,
  createProjectFile,
  dropPlacement,
  findOutline,
  moveItem,
  outlineRows,
  type OutlineItemId,
  type ProjectFile,
} from '../index.js';

/**
 * Dragging chapters, sections and subsections in the Outliner (from Ken:
 * *if a section or subsection has subsections below, it won't move.
 * Subsections should move with a section*).
 */
const book = () => {
  let file: ProjectFile = createProjectFile({ title: 'Book', format: 'instructional' });
  const made = createOutline(file, { name: 'Outline' });
  file = made.file;
  const id = made.outline.id;
  const rows: Record<string, OutlineItemId> = {};
  const add = (key: string, kind: string, title: string, parent?: string) => {
    const r = addItem(file, id, { kind, title, ...(parent ? { parentId: rows[parent]! } : {}) });
    file = r.file;
    rows[key] = r.itemId!;
  };
  add('c1', 'chapter', 'One');
  add('s1', 'scene', 'Division', 'c1');
  add('b1', 'beat', 'Long', 's1');
  add('b2', 'beat', 'Short', 's1');
  add('s2', 'scene', 'Times', 'c1');
  add('b3', 'beat', 'Tables', 's2');
  add('c2', 'chapter', 'Two');
  add('s3', 'scene', 'Fractions', 'c2');
  return { file, id, rows };
};

const drag = (made: ReturnType<typeof book>, held: string, target: string, zone: 'before' | 'after' | 'into') => {
  const outline = findOutline(made.file, made.id)!;
  const where = dropPlacement(outline, made.rows[held]!, made.rows[target]!, zone);
  if (!where) return made.file;
  return moveItem(made.file, made.id, made.rows[held]!, where);
};

const shape = (file: ProjectFile, id: ReturnType<typeof book>['id']) =>
  outlineRows(findOutline(file, id)!, new Set(findOutline(file, id)!.items.map((one) => one.id as string))).map(
    ({ item, depth }) => `${'  '.repeat(depth)}${item.title}`,
  );

describe('dragging the structure', () => {
  it('moves a section up with its subsections', () => {
    const made = book();
    const file = drag(made, 's2', 's1', 'before');
    expect(shape(file, made.id)).toEqual(['One', '  Times', '    Tables', '  Division', '    Long', '    Short', 'Two', '  Fractions']);
  });

  it('puts a section dropped on a subsection after that subsection’s section, never inside it', () => {
    const made = book();
    const file = drag(made, 's3', 'b1', 'into');
    expect(shape(file, made.id)).toEqual(['One', '  Division', '    Long', '    Short', '  Fractions', '  Times', '    Tables', 'Two']);
  });

  it('does not tuck a section into another section', () => {
    const made = book();
    const file = drag(made, 's2', 's1', 'into');
    expect(shape(file, made.id)).toEqual(['One', '  Division', '    Long', '    Short', '  Times', '    Tables', 'Two', '  Fractions']);
  });

  it('moves a chapter with everything in it, and keeps it at the top', () => {
    const made = book();
    const up = drag(made, 'c2', 'c1', 'before');
    expect(shape(up, made.id)).toEqual(['Two', '  Fractions', 'One', '  Division', '    Long', '    Short', '  Times', '    Tables']);
    const onSub = drag(made, 'c2', 'b1', 'before');
    expect(shape(onSub, made.id)[0]).toBe('One');
    expect(findOutline(onSub, made.id)!.items.find((one) => one.id === made.rows['c2'])!.parentId).toBeNull();
  });

  it('moves a subsection between sections, and into a section dropped beside it', () => {
    const made = book();
    expect(shape(drag(made, 'b3', 'b1', 'before'), made.id)).toEqual(['One', '  Division', '    Tables', '    Long', '    Short', '  Times', 'Two', '  Fractions']);
    // Just below a section's line: the top of that section.
    expect(shape(drag(made, 'b1', 's2', 'after'), made.id)).toEqual(['One', '  Division', '    Short', '  Times', '    Long', '    Tables', 'Two', '  Fractions']);
    // Just above it: the end of the section before.
    expect(shape(drag(made, 'b3', 's2', 'before'), made.id)).toEqual(['One', '  Division', '    Long', '    Short', '    Tables', '  Times', 'Two', '  Fractions']);
  });

  it('refuses to put a row inside itself', () => {
    const made = book();
    expect(dropPlacement(findOutline(made.file, made.id)!, made.rows['s1']!, made.rows['b1']!, 'after')).toBeNull();
  });
});
