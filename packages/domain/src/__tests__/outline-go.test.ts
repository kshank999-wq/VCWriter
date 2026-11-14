import { describe, expect, it } from 'vitest';
import {
  addItem,
  beatsForUnit,
  createOutline,
  createProjectFile,
  findOutline,
  outlineRowForBeat,
  promoteRow,
  writingBeatForRow,
  type Outline,
} from '../index.js';

/** Go between the Outliner and the writing screen. */
const made = () => {
  const start = createOutline(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  const id = start.outline.id;
  const chapter = addItem(start.file, id, { kind: 'note', title: 'Act one' });
  const scene = addItem(chapter.file, id, { kind: 'scene', title: 'Warehouse' });
  const enters = addItem(scene.file, id, { parentId: scene.itemId, kind: 'beat', title: 'Mara enters.' });
  const finds = addItem(enters.file, id, { parentId: scene.itemId, kind: 'beat', title: 'She finds the case.' });
  const idea = addItem(finds.file, id, { parentId: finds.itemId, kind: 'idea', title: 'Movement upstairs.' });
  const plan = addItem(idea.file, id, { kind: 'note', title: 'Loose plan' });
  const sent = promoteRow(plan.file, id, scene.itemId);
  const file = sent.file;
  // The scene, once on the track, filed under a plan row (as a writer's act
  // heading would be), to show Go looking down from a row with no binding.
  const promoted = findOutline(file, id) as Outline;
  const outline = {
    ...promoted,
    items: promoted.items.map((item) => (item.id === scene.itemId ? { ...item, parentId: chapter.itemId } : item)),
  } as Outline;
  const [first, second] = beatsForUnit(file, sent.unitId!);
  return { file, outline, chapter, scene, enters, finds, idea, plan, first: first!, second: second! };
};

describe('writingBeatForRow', () => {
  it('goes to a beat’s own screen, a scene’s first beat, and a chapter’s first beat under it', () => {
    const { file, outline, chapter, scene, finds, first, second } = made();
    expect(writingBeatForRow(file, outline, finds.itemId)?.id).toBe(second.id);
    expect(writingBeatForRow(file, outline, scene.itemId)?.id).toBe(first.id);
    expect(writingBeatForRow(file, outline, chapter.itemId)?.id).toBe(first.id);
  });

  it('takes a row beneath a beat to that beat, and has nowhere for a loose plan', () => {
    const { file, outline, idea, plan, second } = made();
    expect(writingBeatForRow(file, outline, idea.itemId)?.id).toBe(second.id);
    expect(writingBeatForRow(file, outline, plan.itemId)).toBeNull();
  });
});

describe('outlineRowForBeat', () => {
  it('finds the row that is the beat', () => {
    const { file, outline, finds, second } = made();
    expect(outlineRowForBeat(file, second.id)).toEqual({ outlineId: outline.id, itemId: finds.itemId });
  });
});

describe('Go to a section with nothing written in it yet (from Ken, 14 November)', () => {
  it('makes its first subsection, heading hidden, and opens that; once, not again', async () => {
    const { writingPlaceForRow, canWriteRow } = await import('../index.js');
    const start = createOutline(createProjectFile({ title: 'Writing well', format: 'instructional' }));
    const id = start.outline.id;
    const chapter = addItem(start.file, id, { kind: 'chapter', title: 'AI & The Future' });
    const section = addItem(chapter.file, id, { parentId: chapter.itemId, kind: 'beat', title: "Don't cheat yourself" });
    const sent = promoteRow(section.file, id, section.itemId!);
    const outline = findOutline(sent.file, id) as Outline;
    expect(sent.unitId).not.toBeNull();
    expect(beatsForUnit(sent.file, sent.unitId!)).toHaveLength(0);
    // Nothing to open before: the greyed-out Go.
    expect(writingBeatForRow(sent.file, outline, section.itemId!)).toBeNull();
    expect(canWriteRow(sent.file, outline, section.itemId!)).toBe(true);
    expect(canWriteRow(sent.file, outline, chapter.itemId!)).toBe(true);

    const place = writingPlaceForRow(sent.file, outline, section.itemId!)!;
    expect(place.made).toBe(true);
    const made = place.file.beats.find((one) => (one.id as string) === place.beatId)!;
    expect(made).toMatchObject({ unitId: sent.unitId, title: "Don't cheat yourself", headingShown: false });

    // The second time it is there to open, and nothing more is made.
    const again = writingPlaceForRow(place.file, findOutline(place.file, id) as Outline, section.itemId!)!;
    expect(again).toMatchObject({ beatId: place.beatId, made: false });
    expect(again.file).toBe(place.file);
  });
});

describe('Go to the Sculptor', () => {
  it('finds the card bound to the beat, or to its scene, and nothing for a beat on no board', async () => {
    const { sculptorNodeForBeat, createBoard } = await import('../index.js');
    const { file, first, second } = made();
    expect(sculptorNodeForBeat(file, second.id)).toBeNull();
    const withBoard = createBoard(file);
    const board = withBoard.file.boards![0]!;
    const card = { ...(board.nodes[0] ?? {}), id: 'n-scene', boundBeatId: null, boundUnitId: first.unitId } as never;
    const bound = { ...withBoard.file, boards: [{ ...board, nodes: [...board.nodes, card] }] };
    expect(sculptorNodeForBeat(bound, second.id)).toEqual({ boardId: board.id, nodeId: 'n-scene' });
  });
});
