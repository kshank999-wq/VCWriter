import { describe, expect, it } from 'vitest';
import {
  addItem,
  addNoteToOutline,
  promoteAll,
  notesToProcess,
  unsortedNotes,
  addResearchItem,
  beatsForUnit,
  contentsShelf,
  createOutline,
  createProjectFile,
  fileNoteUnder,
  findOutline,
  noteOnTrack,
  outlineFolders,
  placeNoteOnTrack,
  researchItemsIn,
  setNoteRewrite,
  textToPlace,
  type OutlineItemId,
  type ProjectFile,
  type ResearchItemId,
} from '../index.js';

/**
 * The outline beside the notes, and the rewrite screen (addendum 28 §7).
 *
 * The claims: every part of the outline is a folder, chapters down to ideas;
 * a note dropped on one is filed there and the table of contents agrees; the
 * rewrite keeps the note's own words; placing puts the rewrite on the track
 * where the note was filed, and only then does the note read used.
 */

/** A textbook planned in the Outliner and not added to the track. */
const planned = () => {
  let file: ProjectFile = createProjectFile({ title: 'Planned', format: 'instructional' });
  const made = createOutline(file, { name: 'Outline' });
  file = made.file;
  const outlineId = made.outline.id;
  const rows: Record<string, OutlineItemId> = {};
  const add = (key: string, kind: string, title: string, parent?: string) => {
    const row = addItem(file, outlineId, { kind, title, ...(parent ? { parentId: rows[parent]! } : {}) });
    file = row.file;
    rows[key] = row.itemId!;
  };
  add('one', 'chapter', 'Mathematics');
  add('division', 'scene', 'Division', 'one');
  add('long', 'beat', 'Long division', 'division');
  add('short', 'beat', 'Short division', 'division');
  add('remainders', 'idea', 'Remainders as fractions', 'long');
  return { file, outlineId, rows };
};

const note = (file: ProjectFile, title: string, body = '') => {
  const next = addResearchItem(file, { categoryId: file.researchCategories[0]!.id, title, body });
  return { file: next, id: next.researchItems[next.researchItems.length - 1]!.id as ResearchItemId };
};

const textOf = (file: ProjectFile, beatId: string) =>
  file.beats.find((beat) => beat.id === beatId)!.manuscript.elements.map((element) => element.text);

describe('the outline beside the notes', () => {
  it('lists chapters, sections, subsections and ideas, in order and at their depth', () => {
    const made = planned();
    const folders = outlineFolders(made.file).filter((folder) => folder.fromOutline);
    expect(folders.map((folder) => [folder.kind, folder.title, folder.depth])).toEqual([
      ['chapter', 'Mathematics', 0],
      ['section', 'Division', 1],
      ['subsection', 'Long division', 2],
      ['idea', 'Remainders as fractions', 3],
      ['subsection', 'Short division', 2],
    ]);
    expect(folders.find((folder) => folder.kind === 'idea')!.number).toBe('');
  });

  it('files a note dropped on a subsection there, and the table of contents agrees', () => {
    const made = planned();
    const n = note(made.file, 'Bring down the next digit');
    const folder = outlineFolders(n.file).find((one) => one.title === 'Long division')!;
    const file = fileNoteUnder(n.file, n.id, folder.place);
    const after = outlineFolders(file).find((one) => one.title === 'Long division')!;
    expect(after.notes.map((one) => one.title)).toEqual(['Bring down the next digit']);
    expect(after.used).toBe(0);
    // The folder the note sat in is untouched.
    expect(file.researchItems.find((one) => one.id === n.id)!.categoryId).toBe(file.researchCategories[0]!.id);
  });
});

describe('the rewrite', () => {
  it('keeps the original and places the rewrite', () => {
    const made = planned();
    const n = note(made.file, 'Digits', 'raw words from the phone');
    let file = setNoteRewrite(n.file, n.id, 'A clean paragraph.\n\nAnd a second one.');
    const item = file.researchItems.find((one) => one.id === n.id)!;
    expect(item.body).toBe('raw words from the phone');
    expect(textToPlace(item)).toBe('A clean paragraph.\n\nAnd a second one.');
    // An empty rewrite falls back to the note.
    file = setNoteRewrite(file, n.id, '   ');
    expect(textToPlace(file.researchItems.find((one) => one.id === n.id)!)).toBe('raw words from the phone');
  });
});

describe('placing a note on the track', () => {
  it('adds its part of the outline to the track and puts the rewrite in a beat there', () => {
    const made = planned();
    const n = note(made.file, 'Bring down', 'rough');
    let file = fileNoteUnder(n.file, n.id, { kind: 'plan', itemId: made.rows['long']! });
    file = setNoteRewrite(file, n.id, 'Bring down the next digit.\n\nThen divide again.');
    expect(noteOnTrack(file, file.researchItems.find((one) => one.id === n.id)!)).toBe(false);
    expect(researchItemsIn(file, { view: 'unused' }).map((one) => one.id)).toContain(n.id);

    const placed = placeNoteOnTrack(file, n.id);
    if (!placed.ok) throw new Error(placed.why);
    file = placed.file;

    // The chapter, its section and subsections are in the book now.
    const outline = findOutline(file, made.outlineId)!;
    const long = outline.items.find((row) => row.id === made.rows['long'])!;
    expect(long.boundBeatId).not.toBeNull();
    // The beat sits just after Long division's own beat, before Short division's.
    const order = beatsForUnit(file, placed.unitId).map((beat) => beat.id as string);
    const short = outline.items.find((row) => row.id === made.rows['short'])!;
    expect(order.indexOf(placed.beatId)).toBe(order.indexOf(long.boundBeatId as string) + 1);
    expect(order.indexOf(placed.beatId)).toBeLessThan(order.indexOf(short.boundBeatId as string));
    expect(textOf(file, placed.beatId)).toEqual(['Bring down the next digit.', 'Then divide again.']);

    // Used now, and it moved to *Used in the book*.
    const item = file.researchItems.find((one) => one.id === n.id)!;
    expect(noteOnTrack(file, item)).toBe(true);
    expect(researchItemsIn(file, { view: 'used' }).map((one) => one.id)).toContain(n.id);
    expect(researchItemsIn(file, { view: 'unused' }).map((one) => one.id)).not.toContain(n.id);
    // And it is still filed under the same subsection.
    const folder = outlineFolders(file).find((one) => one.title === 'Long division')!;
    expect(folder.notes.map((one) => one.id)).toEqual([n.id]);
    expect(folder.used).toBe(1);
  });

  it('keeps the order things were placed in under one subsection', () => {
    const made = planned();
    let file = made.file;
    const ids: ResearchItemId[] = [];
    for (const title of ['First', 'Second']) {
      const n = note(file, title, title);
      file = fileNoteUnder(n.file, n.id, { kind: 'plan', itemId: made.rows['long']! });
      ids.push(n.id);
    }
    const first = placeNoteOnTrack(file, ids[0]!);
    if (!first.ok) throw new Error(first.why);
    const second = placeNoteOnTrack(first.file, ids[1]!);
    if (!second.ok) throw new Error(second.why);
    const order = beatsForUnit(second.file, second.unitId).map((beat) => beat.id as string);
    expect(order.indexOf(first.beatId)).toBeLessThan(order.indexOf(second.beatId));
  });

  it('puts a note filed under an idea after the subsection the idea hangs under', () => {
    const made = planned();
    const n = note(made.file, 'Remainder', 'r over divisor');
    const file = fileNoteUnder(n.file, n.id, { kind: 'plan', itemId: made.rows['remainders']! });
    const placed = placeNoteOnTrack(file, n.id);
    if (!placed.ok) throw new Error(placed.why);
    const long = findOutline(placed.file, made.outlineId)!.items.find((row) => row.id === made.rows['long'])!;
    const order = beatsForUnit(placed.file, placed.unitId).map((beat) => beat.id as string);
    expect(order.indexOf(placed.beatId)).toBe(order.indexOf(long.boundBeatId as string) + 1);
  });

  it('refuses a note that is filed nowhere, and an empty one', () => {
    const made = planned();
    const loose = note(made.file, 'Loose', 'words');
    const refused = placeNoteOnTrack(loose.file, loose.id);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.why).toMatch(/chapter or section/);

    const empty = note(made.file, 'Empty', '');
    const filed = fileNoteUnder(empty.file, empty.id, { kind: 'plan', itemId: made.rows['division']! });
    const nothing = placeNoteOnTrack(filed, empty.id);
    expect(nothing.ok).toBe(false);
  });

  it('refuses a chapter with no section to write in', () => {
    let file: ProjectFile = createProjectFile({ title: 'Bare', format: 'instructional' });
    const made = createOutline(file, { name: 'Outline' });
    file = made.file;
    const row = addItem(file, made.outline.id, { kind: 'chapter', title: 'Alone' });
    const n = note(row.file, 'Thought', 'words');
    file = fileNoteUnder(n.file, n.id, { kind: 'plan', itemId: row.itemId! });
    const refused = placeNoteOnTrack(file, n.id);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.why).toMatch(/Add a section/);
  });

  it('a note on the track whose beat is cut reads unused again', () => {
    const made = planned();
    const n = note(made.file, 'Cut me', 'words');
    const filed = fileNoteUnder(n.file, n.id, { kind: 'plan', itemId: made.rows['division']! });
    const placed = placeNoteOnTrack(filed, n.id);
    if (!placed.ok) throw new Error(placed.why);
    const cut = { ...placed.file, beats: placed.file.beats.filter((beat) => beat.id !== placed.beatId) };
    expect(noteOnTrack(cut, cut.researchItems.find((one) => one.id === n.id)!)).toBe(false);
    // The table of contents still lists the section the note went into.
    expect(contentsShelf(cut).some((one) => one.title === 'Division')).toBe(true);
  });
});

describe('sorting notes in the Outliner (addendum 28 §9)', () => {
  it('a note sorted into a row leaves the unsorted list and waits under that row', () => {
    const made = planned();
    const n = note(made.file, 'Raw thought', 'rough words');
    expect(unsortedNotes(n.file).map((one) => one.id)).toContain(n.id);
    const file = fileNoteUnder(n.file, n.id, { kind: 'plan', itemId: made.rows['division']! });
    expect(unsortedNotes(file).map((one) => one.id)).not.toContain(n.id);
    expect(notesToProcess(file, { kind: 'plan', itemId: made.rows['division']! }).map((one) => one.id)).toEqual([n.id]);
    expect(notesToProcess(file, { kind: 'plan', itemId: made.rows['long']! })).toEqual([]);
  });

  it('adding it makes a row with the rewrite under that row, and archives the note', () => {
    const made = planned();
    const n = note(made.file, 'Raw thought', 'rough words');
    let file = fileNoteUnder(n.file, n.id, { kind: 'plan', itemId: made.rows['division']! });
    file = setNoteRewrite(file, n.id, 'A clean paragraph.');
    const added = addNoteToOutline(file, n.id, made.outlineId, made.rows['division']!, 'beat');
    expect(added.rowId).not.toBeNull();
    const row = findOutline(added.file, made.outlineId)!.items.find((one) => one.id === added.rowId)!;
    expect([row.kind, row.title, row.body, row.parentId]).toEqual(['beat', 'Raw thought', 'A clean paragraph.', made.rows['division']]);
    const after = added.file.researchItems.find((one) => one.id === n.id)!;
    expect(after.archived).toBe(true);
    expect(after.body).toBe('rough words');
    // Done: no longer waiting under the row, nor in the folders beside the notes.
    expect(notesToProcess(added.file, { kind: 'plan', itemId: made.rows['division']! })).toEqual([]);
    expect(outlineFolders(added.file).find((one) => one.title === 'Division')!.notes).toEqual([]);
  });
});

describe('sorted, worked in, and in the manuscript (addendum 28 §10)', () => {
  it('a note sorted into the outline leaves its folder and waits under Sorted', () => {
    const made = planned();
    const n = note(made.file, 'Jay-Z', 'rough');
    const folder = made.file.researchCategories[0]!.id;
    expect(researchItemsIn(n.file, { categoryId: folder }).map((one) => one.id)).toContain(n.id);
    const file = fileNoteUnder(n.file, n.id, { kind: 'plan', itemId: made.rows['division']! });
    expect(researchItemsIn(file, { categoryId: folder }).map((one) => one.id)).not.toContain(n.id);
    expect(researchItemsIn(file, { view: 'sorted' }).map((one) => one.id)).toEqual([n.id]);
    expect(researchItemsIn(file, { view: 'unused' }).map((one) => one.id)).toContain(n.id);
  });

  it('worked into the outline it counts as used, and its words reach the manuscript on the track', () => {
    const made = planned();
    const n = note(made.file, 'Check it', 'rough');
    let file = fileNoteUnder(n.file, n.id, { kind: 'plan', itemId: made.rows['division']! });
    file = setNoteRewrite(file, n.id, 'Multiply it back.\n\nIt should match.');
    const added = addNoteToOutline(file, n.id, made.outlineId, made.rows['division']!, 'beat');
    file = added.file;
    expect(researchItemsIn(file, { view: 'used' }).map((one) => one.id)).toContain(n.id);
    expect(researchItemsIn(file, { view: 'unused' }).map((one) => one.id)).not.toContain(n.id);
    expect(researchItemsIn(file, { view: 'sorted' }).map((one) => one.id)).not.toContain(n.id);
    expect(researchItemsIn(file, { view: 'archived' }).map((one) => one.id)).not.toContain(n.id);
    // On the track, the row's words become the subsection's text.
    file = promoteAll(file, made.outlineId).file;
    const row = findOutline(file, made.outlineId)!.items.find((one) => one.id === added.rowId)!;
    const beat = file.beats.find((one) => one.id === row.boundBeatId)!;
    expect(beat.manuscript.elements.map((element) => element.text)).toEqual(['Multiply it back.', 'It should match.']);
  });
});
