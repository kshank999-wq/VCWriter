import { describe, expect, it } from 'vitest';
import {
  addItem,
  createOutline,
  createProjectFile,
  depthOf,
  findOutline,
  findOutlineItem,
  foldAll,
  indentItem,
  isUnder,
  moveItem,
  nudgeItem,
  outdentItem,
  outlineChildren,
  outlineRows,
  outlineSubtree,
  outlineTally,
  parseProjectFile,
  removeItem,
  updateItem,
  type Outline,
  type OutlineItemId,
  type ProjectFile,
} from '../index.js';

/**
 * The Outliner (addendum 06), stage 1: the document and the shape rules.
 *
 * §4 is the whole of it — **item type and indentation are separate
 * concepts** — so most of what is worth testing is that a row's type never
 * constrains where it can go, and that a tree stays a tree whatever is
 * dragged where.
 */

const started = (): { file: ProjectFile; outline: Outline } =>
  createOutline(createProjectFile({ title: 'Blackout', format: 'screenplay' }));

const live = (file: ProjectFile, outline: Outline): Outline => findOutline(file, outline.id) as Outline;

/** A scene, two beats, and three supporting rows under the first beat. */
const warehouse = (): {
  file: ProjectFile;
  outline: Outline;
  scene: OutlineItemId;
  enters: OutlineItemId;
  finds: OutlineItemId;
  idea: OutlineItemId;
} => {
  const made = started();
  const id = made.outline.id;
  const scene = addItem(made.file, id, { kind: 'scene', title: 'Warehouse Confrontation' });
  const enters = addItem(scene.file, id, {
    parentId: scene.itemId,
    kind: 'beat',
    title: 'Mara enters believing the warehouse is empty.',
  });
  const finds = addItem(enters.file, id, {
    parentId: scene.itemId,
    kind: 'beat',
    title: 'She finds the missing case open on the workbench.',
  });

  let file = finds.file;
  let idea: OutlineItemId | null = null;
  for (const [kind, title] of [
    ['idea', 'Keep the audience aware of movement upstairs.'],
    ['setting', 'Rain on the metal roof masks footsteps.'],
    ['character', 'Mara is trying to appear calm.'],
  ] as const) {
    const row = addItem(file, id, { parentId: enters.itemId, kind, title });
    file = row.file;
    if (kind === 'idea') idea = row.itemId;
  }

  return {
    file,
    outline: made.outline,
    scene: scene.itemId as OutlineItemId,
    enters: enters.itemId as OutlineItemId,
    finds: finds.itemId as OutlineItemId,
    idea: idea as OutlineItemId,
  };
};

describe('a new outline', () => {
  it('is empty: no template is offered', () => {
    const { outline } = started();
    expect(outline.items).toEqual([]);
    expect(outline.name).toBe('Outline');
  });

  it('travels in the document, defaulting to none', () => {
    const plain = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    expect(plain.outlines).toEqual([]);
    const back = parseProjectFile(JSON.parse(JSON.stringify(started().file)));
    expect(back.outlines).toHaveLength(1);
  });
});

describe('type and depth are separate concepts', () => {
  it('puts a character under a beat, a note under the character, and an idea under the note', () => {
    const made = started();
    const scene = addItem(made.file, made.outline.id, { kind: 'scene', title: 'Warehouse' });
    const beat = addItem(scene.file, made.outline.id, { parentId: scene.itemId, kind: 'beat', title: 'She enters' });
    const character = addItem(beat.file, made.outline.id, {
      parentId: beat.itemId,
      kind: 'character',
      title: 'Mara is suspicious',
    });
    const note = addItem(character.file, made.outline.id, {
      parentId: character.itemId,
      kind: 'note',
      title: 'She has been here before',
    });
    const idea = addItem(note.file, made.outline.id, { parentId: note.itemId, kind: 'idea', title: 'Or has she' });

    const rows = outlineRows(live(idea.file, made.outline));
    expect(rows.map((row) => [row.item.kind, row.depth])).toEqual([
      ['scene', 0],
      ['beat', 1],
      ['character', 2],
      ['note', 3],
      ['idea', 4],
    ]);
  });

  it('takes a type nobody has heard of, because the list is a list of words', () => {
    const made = started();
    const row = addItem(made.file, made.outline.id, { kind: 'revelation', title: 'Daniel lied' });
    expect(findOutlineItem(live(row.file, made.outline), row.itemId!)?.kind).toBe('revelation');
  });

  it('counts depth from the parents rather than storing it', () => {
    const made = started();
    const one = addItem(made.file, made.outline.id, { kind: 'scene' });
    const two = addItem(one.file, made.outline.id, { parentId: one.itemId, kind: 'beat' });
    const outline = live(two.file, made.outline);
    expect(depthOf(outline, findOutlineItem(outline, two.itemId!)!)).toBe(1);
  });
});

describe('reading the outline', () => {
  it('reads top to bottom, in order, with everything under its parent', () => {
    const made = started();
    const scene = addItem(made.file, made.outline.id, { kind: 'scene', title: 'One' });
    const a = addItem(scene.file, made.outline.id, { parentId: scene.itemId, kind: 'beat', title: 'A' });
    const b = addItem(a.file, made.outline.id, { parentId: scene.itemId, kind: 'beat', title: 'B' });
    const second = addItem(b.file, made.outline.id, { kind: 'scene', title: 'Two' });

    expect(outlineRows(live(second.file, made.outline)).map((row) => row.item.title)).toEqual([
      'One',
      'A',
      'B',
      'Two',
    ]);
  });

  it('leaves a folded row’s children out entirely, and puts them back unchanged', () => {
    const made = started();
    const scene = addItem(made.file, made.outline.id, { kind: 'scene', title: 'One' });
    const a = addItem(scene.file, made.outline.id, { parentId: scene.itemId, kind: 'beat', title: 'A' });
    const b = addItem(a.file, made.outline.id, { parentId: scene.itemId, kind: 'beat', title: 'B' });

    const folded = updateItem(b.file, made.outline.id, scene.itemId!, { collapsed: true });
    expect(outlineRows(live(folded, made.outline)).map((row) => row.item.title)).toEqual(['One']);
    expect(outlineRows(live(folded, made.outline))[0]?.childCount).toBe(2);

    const open = updateItem(folded, made.outline.id, scene.itemId!, { collapsed: false });
    expect(outlineRows(live(open, made.outline)).map((row) => row.item.title)).toEqual(['One', 'A', 'B']);
  });

  it('folds and unfolds everything at once, and never a row with nothing under it', () => {
    const { file, outline, scene, idea } = warehouse();
    const shut = foldAll(file, outline.id, true);
    expect(outlineRows(live(shut, outline)).map((row) => row.item.title)).toEqual(['Warehouse Confrontation']);
    expect(findOutlineItem(live(shut, outline), idea)?.collapsed).toBe(false);
    expect(findOutlineItem(live(shut, outline), scene)?.collapsed).toBe(true);

    const open = foldAll(shut, outline.id, false);
    expect(outlineRows(live(open, outline))).toHaveLength(6);
  });
});

describe('moving things about', () => {
  it('moves a row to a new parent, and its subtree comes with it', () => {
    const { file, outline, enters, finds, idea } = warehouse();
    const moved = moveItem(file, outline.id, enters, { parentId: finds, afterId: null });

    const back = live(moved, outline);
    expect(findOutlineItem(back, enters)?.parentId).toBe(finds);
    // The idea is still under the beat it was under, which is now deeper.
    expect(findOutlineItem(back, idea)?.parentId).toBe(enters);
    expect(outlineRows(back).find((row) => row.item.id === idea)?.depth).toBe(3);
  });

  it('lands a row first, which "at the end" could never say', () => {
    const { file, outline, scene, finds } = warehouse();
    // Dropping something above the opening scene is an ordinary thing to want,
    // and before `beforeId` there was no way to express it.
    const moved = moveItem(file, outline.id, finds, { parentId: null, beforeId: scene });
    expect(outlineChildren(live(moved, outline), null).map((item) => item.id)).toEqual([finds, scene]);
  });

  it('lands a row between two others, and takes its subtree with it', () => {
    const { file, outline, scene, enters, finds, idea } = warehouse();
    const moved = moveItem(file, outline.id, enters, { parentId: scene, beforeId: finds });
    const back = live(moved, outline);
    expect(outlineChildren(back, scene).map((item) => item.id)).toEqual([enters, finds]);
    expect(findOutlineItem(back, idea)?.parentId).toBe(enters);
  });

  it('puts a row at the end when neither end is named', () => {
    const { file, outline, scene, enters } = warehouse();
    const moved = moveItem(file, outline.id, enters, { parentId: null });
    expect(outlineChildren(live(moved, outline), null).map((item) => item.id)).toEqual([scene, enters]);
  });

  it('refuses to move a row inside itself, which would cut the branch off the trunk', () => {
    const { file, outline, scene, enters, idea } = warehouse();
    expect(moveItem(file, outline.id, scene, { parentId: enters })).toBe(file);
    expect(moveItem(file, outline.id, scene, { parentId: idea })).toBe(file);
    expect(moveItem(file, outline.id, scene, { parentId: scene })).toBe(file);
  });

  it('knows what is under what', () => {
    const { file, outline, scene, enters, idea, finds } = warehouse();
    const back = live(file, outline);
    expect(isUnder(back, idea, scene)).toBe(true);
    expect(isUnder(back, idea, enters)).toBe(true);
    expect(isUnder(back, idea, finds)).toBe(false);
    expect(isUnder(back, scene, scene)).toBe(false);
  });

  it('moves a row one place among its siblings, keeping what is under it', () => {
    const { file, outline, scene, enters, finds } = warehouse();
    const moved = nudgeItem(file, outline.id, finds, -1);
    const back = live(moved, outline);
    expect(outlineChildren(back, scene).map((item) => item.id)).toEqual([finds, enters]);
    expect(outlineChildren(back, enters)).toHaveLength(3);
  });

  it('does nothing at the ends', () => {
    const { file, outline, enters } = warehouse();
    expect(nudgeItem(file, outline.id, enters, -1)).toBe(file);
  });
});

describe('indenting and outdenting', () => {
  it('indents a row under the one above it', () => {
    const { file, outline, enters, finds } = warehouse();
    const deeper = indentItem(file, outline.id, finds);
    expect(findOutlineItem(live(deeper, outline), finds)?.parentId).toBe(enters);
  });

  it('will not indent the first row of a group: there is nothing above it to go under', () => {
    const { file, outline, enters } = warehouse();
    expect(indentItem(file, outline.id, enters)).toBe(file);
  });

  it('outdents a row to sit directly after its parent, not at the end of the outline', () => {
    const made = started();
    const one = addItem(made.file, made.outline.id, { kind: 'scene', title: 'One' });
    const two = addItem(one.file, made.outline.id, { kind: 'scene', title: 'Two' });
    const beat = addItem(two.file, made.outline.id, { parentId: one.itemId, kind: 'beat', title: 'A' });

    const out = outdentItem(beat.file, made.outline.id, beat.itemId!);
    expect(outlineRows(live(out, made.outline)).map((row) => row.item.title)).toEqual(['One', 'A', 'Two']);
  });

  it('takes what was under it and leaves what was after it', () => {
    const { file, outline, scene, enters, finds, idea } = warehouse();
    const out = outdentItem(file, outline.id, enters);
    const back = live(out, outline);

    // The beat is now a sibling of the scene, with its three rows still under it…
    expect(findOutlineItem(back, enters)?.parentId).toBeNull();
    expect(outlineChildren(back, enters)).toHaveLength(3);
    expect(findOutlineItem(back, idea)?.parentId).toBe(enters);
    // …and the beat that came after it stayed in the scene.
    expect(findOutlineItem(back, finds)?.parentId).toBe(scene);
  });

  it('will not outdent a row that is already at the top', () => {
    const { file, outline, scene } = warehouse();
    expect(outdentItem(file, outline.id, scene)).toBe(file);
  });
});

describe('taking a row out', () => {
  it('takes everything under it and nothing else', () => {
    const { file, outline, scene, enters, finds } = warehouse();
    const gone = removeItem(file, outline.id, enters);
    const back = live(gone, outline);

    expect(outlineSubtree(back, scene).map((item) => item.id)).toEqual([scene, finds]);
    expect(back.items).toHaveLength(2);
  });

  it('never touches the script', () => {
    const { file, outline, scene } = warehouse();
    const gone = removeItem(file, outline.id, scene);
    expect(gone.units).toEqual(file.units);
    expect(gone.beats).toEqual(file.beats);
  });
});

describe('what the header says', () => {
  it('counts the rows, the scenes, and how many are in the script', () => {
    const { file, outline } = warehouse();
    expect(outlineTally(live(file, outline))).toEqual({ rows: 6, scenes: 1, promoted: 0 });
  });
});
