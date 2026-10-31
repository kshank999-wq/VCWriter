import { describe, expect, it } from 'vitest';
import {
  addItem,
  createOutline,
  createProjectFile,
  dropPlacement,
  indentItem,
  outdentItem,
  nudgeItem,
  promoteAll,
  isPromoted,
  unitsInStoryOrder,
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

  it('does not tuck a section into another: dropped on one, it takes its place', () => {
    const made = book();
    // Dragged up onto Division: above it, with its subsections (from Ken: *if I
    // wanted to drag section 1.2 above section 1.1 and reverse the numbering*).
    expect(shape(drag(made, 's2', 's1', 'into'), made.id)).toEqual(['One', '  Times', '    Tables', '  Division', '    Long', '    Short', 'Two', '  Fractions']);
    // Dragged down onto Times: below it.
    expect(shape(drag(made, 's1', 's2', 'into'), made.id)).toEqual(['One', '  Times', '    Tables', '  Division', '    Long', '    Short', 'Two', '  Fractions']);
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

describe('Tab and Shift+Tab step a row through the structure', () => {
  const levels = ['chapter', 'scene', 'beat'];
  const kinds = (file: ProjectFile, id: ReturnType<typeof book>['id']) =>
    outlineRows(findOutline(file, id)!, new Set(findOutline(file, id)!.items.map((one) => one.id as string))).map(
      ({ item, depth }) => `${'  '.repeat(depth)}${item.title}:${item.kind}`,
    );

  it('moves a section with subsections in, and it becomes a subsection with them under it', () => {
    const made = book();
    const file = indentItem(made.file, made.id, made.rows['s2']!, levels);
    expect(kinds(file, made.id)).toEqual([
      'One:chapter',
      '  Division:scene',
      '    Long:beat',
      '    Short:beat',
      '    Times:beat',
      '      Tables:beat',
      'Two:chapter',
      '  Fractions:scene',
    ]);
  });

  it('moves a chapter in to a section, its sections becoming subsections', () => {
    const made = book();
    const file = indentItem(made.file, made.id, made.rows['c2']!, levels);
    expect(kinds(file, made.id).slice(-2)).toEqual(['  Two:scene', '    Fractions:beat']);
  });

  it('moves a section out to a chapter, its subsections becoming sections', () => {
    const made = book();
    const file = outdentItem(made.file, made.id, made.rows['s2']!, levels);
    expect(kinds(file, made.id)).toEqual([
      'One:chapter',
      '  Division:scene',
      '    Long:beat',
      '    Short:beat',
      'Times:chapter',
      '  Tables:scene',
      'Two:chapter',
      '  Fractions:scene',
    ]);
  });

  it('leaves ideas and notes their own kind', () => {
    let { file, id, rows } = book();
    const idea = addItem(file, id, { kind: 'idea', title: 'Thought', parentId: rows['s1']! });
    file = idea.file;
    file = outdentItem(file, id, idea.itemId!, levels);
    expect(findOutline(file, id)!.items.find((one) => one.id === idea.itemId)!.kind).toBe('idea');
  });
});

describe('rows whose keys collide still move (from Ken: *it just snaps back*)', () => {
  const sameKeys = () => {
    const made = book();
    // Division and Times share a key, as an outline built by imports can.
    const outline = findOutline(made.file, made.id)!;
    const key = outline.items.find((one) => one.id === made.rows['s1'])!.orderKey;
    const file = {
      ...made.file,
      outlines: made.file.outlines!.map((one) =>
        one.id === made.id
          ? { ...one, items: one.items.map((item) => (item.id === made.rows['s2'] ? { ...item, orderKey: key } : item)) }
          : one,
      ),
    };
    return { ...made, file };
  };

  it('drags a section above its twin', () => {
    const made = sameKeys();
    const before = shape(made.file, made.id);
    const second = before.indexOf('  Times') > before.indexOf('  Division') ? 's2' : 's1';
    const first = second === 's2' ? 's1' : 's2';
    const file = drag(made, second, first, 'before');
    const after = shape(file, made.id);
    expect(after.indexOf(`  ${second === 's2' ? 'Times' : 'Division'}`)).toBeLessThan(after.indexOf(`  ${first === 's2' ? 'Times' : 'Division'}`));
  });

  it('nudges a section up with the arrows', () => {
    const made = sameKeys();
    const before = shape(made.file, made.id);
    const lower = before.indexOf('  Times') > before.indexOf('  Division') ? 's2' : 's1';
    const file = nudgeItem(made.file, made.id, made.rows[lower]!, -1);
    expect(shape(file, made.id)).not.toEqual(before);
  });
});

describe('Add all to track', () => {
  it('puts every chapter, section and subsection in the track, in order', () => {
    const made = book();
    const done = promoteAll(made.file, made.id);
    const rows = findOutline(done.file, made.id)!.items;
    expect(rows.filter((one) => ['chapter', 'scene', 'beat'].includes(one.kind)).every((one) => isPromoted(one))).toBe(true);
    expect(done.left).toBe(0);
    expect(done.added).toBe(8);
    // Sections land in the outline's order.
    const units = unitsInStoryOrder(done.file).map((one) => one.title);
    expect(units.indexOf('Division')).toBeLessThan(units.indexOf('Times'));
    expect(units.indexOf('Times')).toBeLessThan(units.indexOf('Fractions'));
  });
});

describe('the arrows cross into the next section', () => {
  it('moves a first subsection up to the end of the section above, and a last one down', () => {
    const made = book();
    expect(shape(nudgeItem(made.file, made.id, made.rows['b3']!, -1), made.id)).toEqual([
      'One', '  Division', '    Long', '    Short', '    Tables', '  Times', 'Two', '  Fractions',
    ]);
    expect(shape(nudgeItem(made.file, made.id, made.rows['b2']!, 1), made.id)).toEqual([
      'One', '  Division', '    Long', '  Times', '    Short', '    Tables', 'Two', '  Fractions',
    ]);
  });
});

describe('Add all to track puts what was moved back in line', () => {
  it('moves a section already in the track to where the outline now has it', () => {
    const made = book();
    let file = promoteAll(made.file, made.id).file;
    // Times moved above Division in the outline, after both were in the track.
    file = moveItem(file, made.id, made.rows['s2']!, { parentId: made.rows['c1']!, beforeId: made.rows['s1']! });
    file = promoteAll(file, made.id).file;
    const units = unitsInStoryOrder(file).map((one) => one.title);
    expect(units.indexOf('Times')).toBeLessThan(units.indexOf('Division'));
  });
});
