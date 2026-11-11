import { describe, expect, it } from 'vitest';
import {
  addItem,
  beatPlan,
  addBeat,
  addUnit,
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
  promoteRow,
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

describe('rows deeper than a subsection stay off the track (from Ken, 11 November)', () => {
  it('puts the chapter, sections and subsections in the track, and keeps deeper rows in their subsection’s list', async () => {
    const { rowsBeneathBeat, trackLevelOf } = await import('../index.js');
    const made = book();
    const outline = findOutline(made.file, made.id)!;
    const row = (key: string) => outline.items.find((one) => one.id === made.rows[key])!;
    expect(['c1', 's1', 'b1', 'bb1'].map((key) => trackLevelOf(outline, row(key)))).toEqual(['chapter', 'unit', 'beat', 'beneath']);
    expect(titlesOfUnit(made.file, 'Publishers')).toEqual(['Big boys', 'Independents']);
    expect(isPromoted(row('bb1'))).toBe(false);
    const bigBoys = made.file.beats.find((beat) => beat.title === 'Big boys')!;
    expect(rowsBeneathBeat(made.file, bigBoys.id as string).map((one) => one.title)).toEqual(['Major houses', 'Major studios']);
  });

  it('makes a subsection-kind row at the section level a section on the track', async () => {
    const { trackLevelOf, promoteKindIn } = await import('../index.js');
    const made = book();
    const outline = findOutline(made.file, made.id)!;
    const added = addItem(made.file, made.id, { kind: 'beat', title: 'Know what sucks', parentId: made.rows['c1']! });
    const grown = findOutline(added.file, made.id)!;
    const row = grown.items.find((one) => one.id === added.itemId)!;
    expect(trackLevelOf(grown, row)).toBe('unit');
    expect(promoteKindIn(grown, row)).toBe('unit');
    void outline;
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

describe('what is made in the track joins the outline', () => {
  it('a beat added in the track gets a row in its section, bound and in order', () => {
    const made = book();
    const money = unitsInStoryOrder(made.file).find((unit) => unit.title === 'Money')!;
    const added = addBeat(made.file, { unitId: money.id, title: 'New beat', index: 0 });
    const file = keepLinked(made.file, added.file);
    const order = outlineOrder(file, made.id);
    expect(order.slice(order.indexOf('  Money'), order.indexOf('  Money') + 3)).toEqual(['  Money', '    New beat', '    Selling']);
    // The section the project was born with, untouched, does not join: it
    // put a stray row at the top of a book's outline (from Ken).
    expect(order).not.toContain('Chapter One');
    const row = findOutline(file, made.id)!.items.find((one) => one.title === 'New beat')!;
    expect(row.boundBeatId).toBe(added.beat.id);
  });

  it('a scene added in the track gets a row with its beats', () => {
    const made = book();
    const track = made.file.tracks[0]!.id;
    const unit = addUnit(made.file, { trackId: track, title: 'Agents' });
    const beat = addBeat(unit.file, { unitId: unit.unit.id, title: 'Literary agents' });
    const file = keepLinked(made.file, beat.file);
    const order = outlineOrder(file, made.id);
    expect(order).toContain('  Agents');
    expect(order[order.indexOf('  Agents') + 1]).toBe('    Literary agents');
  });
});

describe('what was planned for a beat, beside its writing', () => {
  it('lists the rows under the beat’s own row, with their words', () => {
    const made = book();
    const id = made.id;
    let file = made.file;
    const big = findOutline(file, id)!.items.find((row) => row.title === 'Big boys')!;
    const n = addItem(file, id, { kind: 'note', title: 'Penguin, Harper', parentId: big.id });
    file = n.file;
    const plan = beatPlan(file, big.boundBeatId!);
    expect(plan.row?.id).toBe(big.id);
    expect(plan.lines.map((line) => [line.depth, line.kind, line.title])).toEqual([
      [0, 'beat', 'Major houses'],
      [0, 'beat', 'Major studios'],
      [0, 'note', 'Penguin, Harper'],
    ]);
  });
});

describe('a change made in the Outliner keeps the outline as arranged (from Ken: *it pops it down to the bottom*)', () => {
  it('adding and promoting a section leaves the outline where the writer put it, and the track follows', () => {
    const made = book();
    // The track has drifted from the outline: Money stands before Publishers.
    const money = unitsInStoryOrder(made.file).find((unit) => unit.title === 'Money')!;
    let file = moveUnit(made.file, { unitId: money.id, toTrackId: money.trackId, index: 0 });
    const before = outlineOrder(file, made.id);
    // A new section right after Publishers, then Add to track — as the Outliner does it.
    const row = addItem(file, made.id, { kind: 'scene', title: 'Agents', parentId: made.rows['c1']!, afterId: made.rows['s1']! });
    const promoted = promoteRow(row.file, made.id, row.itemId!).file;
    file = keepLinked(file, promoted);
    const after = outlineOrder(file, made.id);
    // The outline is as arranged, with Agents where it was put.
    expect(after).toEqual([...before.slice(0, before.indexOf('  Money')), '  Agents', ...before.slice(before.indexOf('  Money'))]);
    expect(after).not.toContain('Chapter One');
    // The track follows the outline.
    const units = unitsInStoryOrder(file).map((unit) => unit.title).filter((title) => title !== 'Chapter One');
    expect(units).toEqual(['Publishers', 'Agents', 'Money']);
  });
});

describe('the track takes the outline’s numbers (from Ken, 11 November)', () => {
  it('numbers a chapter on the track as the outline does, counting the chapters still planned', async () => {
    const d = await import('../index.js');
    let file = d.createProjectFile({ title: 'Guide', format: 'instructional' });
    file = { ...file, units: [], beats: [], markers: [] };
    const made = d.createOutline(file, { name: 'Outline' });
    file = made.file;
    const add = (kind: string, title: string, parentId?: string) => {
      const r = d.addItem(file, made.outline.id, { kind, title, ...(parentId ? { parentId: parentId as never } : {}) });
      file = r.file;
      return r.itemId as string;
    };
    add('chapter', 'Prologue');
    add('chapter', 'What is a true artist');
    const craft = add('chapter', 'Craft');
    const story = add('scene', 'What is a story', craft);
    add('beat', 'A situation', story);
    file = d.promoteRow(file, made.outline.id, craft as never).file;

    const marker = file.markers.find((one) => one.kind === 'chapter')!;
    expect(d.numberOfChapter(file, marker.id)).toBe('3');
    const unit = file.units.find((one) => one.title === 'What is a story')!;
    expect(d.numberOfUnit(file, unit.id)).toBe('3.1');
    const beat = file.beats.find((one) => one.title === 'A situation')!;
    expect(d.numberOfSub(file, beat.id)).toBe('3.1.1');
  });
});
