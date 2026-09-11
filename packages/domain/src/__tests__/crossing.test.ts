import { describe, expect, it } from 'vitest';
import {
  addBlock,
  addChild,
  addItem,
  addResearchItem,
  addResearchRow,
  addColumn,
  blocksOf,
  boardLayout,
  canCarryToBoard,
  carryNodeToOutline,
  carryRowToBoard,
  childrenOf,
  createBoard,
  createOutline,
  createProjectFile,
  findBoard,
  findNode,
  findOutline,
  findOutlineItem,
  outlineChildren,
  outlineRows,
  promoteRow,
  unitsInStoryOrder,
  updateNode,
  type Board,
  type Outline,
  type OutlineItemId,
  type ProjectFile,
  type SculptorNodeId,
} from '../index.js';

/**
 * Passing material between the board and the outline (addendum 06 §2).
 *
 * **By hand, never wholesale.** Most of what is worth testing is what a
 * crossing does *not* do: it does not empty the place it came from, it does
 * not carry a claim on a scene with it, and it does not invent columns the
 * writer did not ask for.
 */

const board = (file: ProjectFile, made: Board): Board => findBoard(file, made.id) as Board;
const outline = (file: ProjectFile, made: Outline): Outline => findOutline(file, made.id) as Outline;

/** A board with a block, a scene under it, and a beat under that. */
const shaped = () => {
  const project = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const withBoard = createBoard(project);
  const withOutline = createOutline(withBoard.file);
  const id = withBoard.board.id;

  const block = addBlock(withOutline.file, id, { title: 'She takes the job' });
  const scene = addChild(block.file, id, block.nodeId as SculptorNodeId, { title: 'The interview' });
  const beat = addChild(scene.file, id, scene.nodeId as SculptorNodeId, { title: 'She lies about the address' });
  const noted = updateNode(beat.file, id, scene.nodeId as SculptorNodeId, { note: 'Rain on the roof.' });

  return {
    file: noted,
    board: withBoard.board,
    outline: withOutline.outline,
    block: block.nodeId as SculptorNodeId,
    scene: scene.nodeId as SculptorNodeId,
    beat: beat.nodeId as SculptorNodeId,
  };
};

describe('a node carried into the outline', () => {
  it('brings its subtree, in order, one row deeper each time', () => {
    const made = shaped();
    const carried = carryNodeToOutline(made.file, made.board.id, made.block, made.outline.id);

    expect(outlineRows(outline(carried.file, made.outline)).map((row) => [row.depth, row.item.kind, row.item.title]))
      .toEqual([
        [0, 'note', 'She takes the job'],
        [1, 'scene', 'The interview'],
        [2, 'beat', 'She lies about the address'],
      ]);
  });

  it('calls a block a note, because the outline has nothing that is a shape', () => {
    const made = shaped();
    const carried = carryNodeToOutline(made.file, made.board.id, made.block, made.outline.id);
    expect(findOutlineItem(outline(carried.file, made.outline), carried.itemId!)?.kind).toBe('note');
  });

  it('brings the writer’s words with it: a note becomes the body', () => {
    const made = shaped();
    const carried = carryNodeToOutline(made.file, made.board.id, made.scene, made.outline.id);
    expect(findOutlineItem(outline(carried.file, made.outline), carried.itemId!)?.body).toBe('Rain on the roof.');
  });

  it('lands under the row it was dropped on, whatever column it came from', () => {
    const made = shaped();
    const scene = addItem(made.file, made.outline.id, { kind: 'scene', title: 'Warehouse' });
    const carried = carryNodeToOutline(scene.file, made.board.id, made.beat, made.outline.id, {
      under: scene.itemId,
    });
    expect(findOutlineItem(outline(carried.file, made.outline), carried.itemId!)?.parentId).toBe(scene.itemId);
  });

  it('leaves the board exactly as it was: this is a copy', () => {
    const made = shaped();
    const before = boardLayout(board(made.file, made.board));
    const carried = carryNodeToOutline(made.file, made.board.id, made.block, made.outline.id);
    const after = boardLayout(board(carried.file, made.board));

    expect(after.nodes.map((laid) => [laid.node.id, laid.x, laid.y])).toEqual(
      before.nodes.map((laid) => [laid.node.id, laid.x, laid.y]),
    );
    expect(findNode(board(carried.file, made.board), made.block)?.title).toBe('She takes the job');
  });

  it('arrives as a plan, never as a second claim on the same scene', () => {
    const made = shaped();
    // Put the board's scene node into the script first.
    const withScene = addItem(made.file, made.outline.id, { kind: 'scene', title: 'Placeholder' });
    const sent = promoteRow(withScene.file, made.outline.id, withScene.itemId!);
    expect(sent.unitId).not.toBeNull();

    const carried = carryNodeToOutline(sent.file, made.board.id, made.scene, made.outline.id);
    const row = findOutlineItem(outline(carried.file, made.outline), carried.itemId!)!;
    // One plan per scene: a copy is its own plan, with nothing claimed.
    expect(row.boundUnitId).toBeNull();
    expect(row.boundBeatId).toBeNull();
    expect(unitsInStoryOrder(carried.file)).toHaveLength(unitsInStoryOrder(sent.file).length);
  });
});

describe('a row carried onto the board', () => {
  /** An outline with a scene, a beat under it, and a note under that. */
  const written = () => {
    const made = shaped();
    const id = made.outline.id;
    const scene = addItem(made.file, id, { kind: 'scene', title: 'Warehouse' });
    const beat = addItem(scene.file, id, { parentId: scene.itemId, kind: 'beat', title: 'She enters' });
    const note = addItem(beat.file, id, { parentId: beat.itemId, kind: 'note', title: 'Rain masks it' });
    return {
      ...made,
      file: note.file,
      scene: scene.itemId as OutlineItemId,
      beat: beat.itemId as OutlineItemId,
      note: note.itemId as OutlineItemId,
      blockNode: made.block,
      /** The node in the board's last column, which has nothing to its right. */
      beatNode: () => made.beat,
    };
  };

  it('hangs off the node it was dropped on, in the column after it', () => {
    const made = written();
    const carried = carryRowToBoard(made.file, made.outline.id, made.scene, made.board.id, made.blockNode);
    const live = board(carried.file, made.board);

    expect(findNode(live, carried.nodeId!)?.parentId).toBe(made.blockNode);
    expect(childrenOf(live, carried.nodeId!).map((node) => node.title)).toEqual(['She enters']);
  });

  it('brings the subtree as far as the board has columns, and says what stayed', () => {
    const made = written();
    // Dropped on the block: scene → column 2, beat → column 3, note → nowhere.
    const carried = carryRowToBoard(made.file, made.outline.id, made.scene, made.board.id, made.blockNode);
    expect(carried.leftBehind).toBe(1);

    // With a fourth column there is room for all three.
    const wider = addColumn(made.file, made.board.id, { name: 'Detail' });
    const roomy = carryRowToBoard(wider.file, made.outline.id, made.scene, made.board.id, made.blockNode);
    expect(roomy.leftBehind).toBe(0);
  });

  it('will not be offered a node with no column to its right', () => {
    const made = written();
    expect(canCarryToBoard(made.file, made.board.id, made.blockNode)).toBe(true);
    // The beat node is in the last column of a three-column board.
    expect(canCarryToBoard(made.file, made.board.id, made.beatNode())).toBe(false);
  });

  it('leaves the outline exactly as it was: this is a copy', () => {
    const made = written();
    const before = outlineRows(outline(made.file, made.outline)).map((row) => row.item.title);
    const carried = carryRowToBoard(made.file, made.outline.id, made.scene, made.board.id, made.blockNode);
    expect(outlineRows(outline(carried.file, made.outline)).map((row) => row.item.title)).toEqual(before);
  });

  it('keeps the name of a row that came off the shelf, and not the link', () => {
    const project = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    const withBoard = createBoard(project);
    const withOutline = createOutline(withBoard.file);
    const characters = withOutline.file.researchCategories.find((category) => category.systemKey === 'characters')!;
    const shelf = addResearchItem(withOutline.file, { categoryId: characters.id, title: 'Mara Kessler' });
    const mara = shelf.researchItems[shelf.researchItems.length - 1]!.id;

    const block = addBlock(shelf, withBoard.board.id, { title: 'She takes the job' });
    const row = addResearchRow(block.file, withOutline.outline.id, mara);
    const carried = carryRowToBoard(
      row.file,
      withOutline.outline.id,
      row.itemId!,
      withBoard.board.id,
      block.nodeId as SculptorNodeId,
    );

    // The board has nothing to hold a reference in, so the name travels and
    // the link does not — and the shelf is untouched either way.
    expect(findNode(board(carried.file, withBoard.board), carried.nodeId!)?.title).toBe('Mara Kessler');
    expect(carried.file.researchItems.find((item) => item.id === mara)?.title).toBe('Mara Kessler');
  });

  it('brings the body across as the node’s note', () => {
    const made = written();
    const said = addItem(made.file, made.outline.id, { kind: 'scene', title: 'The hospital' });
    const noted = { ...said.file };
    const withBody = carryRowToBoard(
      // Give the row a body first.
      (() => {
        const items = outline(noted, made.outline).items.map((item) =>
          item.id === said.itemId ? { ...item, body: 'Too bright.' } : item,
        );
        return {
          ...noted,
          outlines: noted.outlines.map((one) => (one.id === made.outline.id ? { ...one, items } : one)),
        };
      })(),
      made.outline.id,
      said.itemId!,
      made.board.id,
      made.blockNode,
    );
    expect(findNode(board(withBody.file, made.board), withBody.nodeId!)?.note).toBe('Too bright.');
  });
});

describe('nothing is ever converted wholesale', () => {
  it('carries one card and its subtree, and not the rest of the board', () => {
    const made = shaped();
    // After the first one: an unanchored block goes to the head of the
    // middle, which is where a writer putting in their first shape means it.
    const second = addBlock(made.file, made.board.id, { afterNodeId: made.block, title: 'The lamp goes out' });
    const carried = carryNodeToOutline(second.file, made.board.id, made.block, made.outline.id);

    // The other block, and the two ends, stayed where they were.
    expect(outlineRows(outline(carried.file, made.outline))).toHaveLength(3);
    expect(blocksOf(board(carried.file, made.board)).map((node) => node.title)).toEqual([
      'Beginning',
      'She takes the job',
      'The lamp goes out',
      'End',
    ]);
  });
});
