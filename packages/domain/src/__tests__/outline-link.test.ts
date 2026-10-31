import { describe, expect, it } from 'vitest';
import {
  addItem,
  beatsForUnit,
  createOutline,
  createProjectFile,
  findOutline,
  isPromoted,
  keepLinked,
  moveBeat,
  moveItem,
  moveUnit,
  outlineRows,
  promoteAll,
  unitsInStoryOrder,
  type OutlineItemId,
  type ProjectFile,
} from '../index.js';

/**
 * The outline and the track in one order (from Ken: *when it's rearranged in
 * the track, the beats need to be rearranged in the outliner and vice versa*),
 * and *Add all to track* taking subsections inside subsections.
 */
const book = () => {
  let file: ProjectFile = createProjectFile({ title: 'Villains', format: 'instructional' });
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
  add('s1', 'scene', 'Publishers', 'c1');
  add('b1', 'beat', 'Big boys', 's1');
  add('bb1', 'beat', 'Major houses', 'b1');
  add('bb2', 'beat', 'Major studios', 'b1');
  add('b2', 'beat', 'Independents', 's1');
  add('s2', 'scene', 'Money', 'c1');
  add('b3', 'beat', 'Selling', 's2');
  return { file: promoteAll(file, id).file, id, rows };
};

const titlesOfUnit = (file: ProjectFile, title: string) =>
  beatsForUnit(file, unitsInStoryOrder(file).find((unit) => unit.title === title)!.id).map((beat) => beat.title);

const outlineOrder = (file: ProjectFile, id: ReturnType<typeof book>['id']) =>
  outlineRows(findOutline(file, id)!, new Set(findOutline(file, id)!.items.map((one) => one.id as string))).map(
    ({ item, depth }) => `${'  '.repeat(depth)}${item.title}`,
  );

describe('Add all to track takes subsections inside subsections', () => {
  it('puts every one in the track, in reading order in its section', () => {
    const made = book();
    expect(findOutline(made.file, made.id)!.items.every((row) => isPromoted(row))).toBe(true);
    expect(titlesOfUnit(made.file, 'Publishers')).toEqual(['Big boys', 'Major houses', 'Major studios', 'Independents']);
  });
});

describe('the track follows the outline', () => {
  it('moves a section in the track when its row is moved in the outline', () => {
    const made = book();
    const moved = moveItem(made.file, made.id, made.rows['s2']!, { parentId: made.rows['c1']!, beforeId: made.rows['s1']! });
    const file = keepLinked(made.file, moved);
    expect(unitsInStoryOrder(file).map((unit) => unit.title).filter((title) => title !== 'Chapter One')).toEqual(['Money', 'Publishers']);
    // The chapter starts on what is now its first section.
    const marker = file.markers.find((one) => one.kind === 'chapter')!;
    expect(unitsInStoryOrder(file).find((unit) => unit.id === marker.unitId)!.title).toBe('Money');
  });

  it('moves a subsection into another section when its row is moved there', () => {
    const made = book();
    const moved = moveItem(made.file, made.id, made.rows['b2']!, { parentId: made.rows['s2']! });
    const file = keepLinked(made.file, moved);
    expect(titlesOfUnit(file, 'Money')).toEqual(['Selling', 'Independents']);
    expect(titlesOfUnit(file, 'Publishers')).not.toContain('Independents');
  });
});

describe('the outline follows the track', () => {
  it('reorders the section rows when the sections are reordered in the track', () => {
    const made = book();
    const money = unitsInStoryOrder(made.file).find((unit) => unit.title === 'Money')!;
    const moved = moveUnit(made.file, { unitId: money.id, toTrackId: money.trackId, index: 0 });
    const file = keepLinked(made.file, moved);
    const order = outlineOrder(file, made.id);
    expect(order.indexOf('  Money')).toBeLessThan(order.indexOf('  Publishers'));
  });

  it('moves a subsection row under the section its beat was dragged into', () => {
    const made = book();
    const units = unitsInStoryOrder(made.file);
    const money = units.find((unit) => unit.title === 'Money')!;
    const independents = made.file.beats.find((beat) => beat.title === 'Independents')!;
    const moved = moveBeat(made.file, { beatId: independents.id, toUnitId: money.id, index: 0 });
    const file = keepLinked(made.file, moved);
    expect(outlineOrder(file, made.id)).toEqual([
      'One',
      '  Publishers',
      '    Big boys',
      '      Major houses',
      '      Major studios',
      '  Money',
      '    Independents',
      '    Selling',
    ]);
  });
});
