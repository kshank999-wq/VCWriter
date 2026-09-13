import { describe, expect, it } from 'vitest';
import {
  WHOLE_BOARD,
  addBlock,
  addChild,
  boardLayout,
  createBoard,
  createProjectFile,
  findBoard,
  isFiltered,
  nodeMatches,
  readBoard,
  subtreeOf,
  updateNode,
  type Board,
  type BoardView,
  type ProjectFile,
  type SculptorNodeId,
} from '../index.js';

/**
 * The Sculptor's views (addendum 03 §10, build order stage 9).
 *
 * The design these hold is the split between the one view that changes the
 * board's **shape** and the three that only change its **lighting**: depth
 * genuinely hides a level, while focus, unbound-only and search dim, because
 * this is a tree and hiding a parent would orphan its children.
 */

/** Beginning, End, one block, two scenes under it, a beat under the first. */
const staged = () => {
  const made = createBoard(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  let file: ProjectFile = made.file;
  const boardId = made.board.id;

  const block = addBlock(file, boardId, { title: 'She takes the job' });
  file = block.file;
  const blockId = block.nodeId!;

  const diner = addChild(file, boardId, blockId, { title: 'The diner' });
  file = diner.file;
  const dinerId = diner.nodeId!;

  const lot = addChild(file, boardId, blockId, { title: 'The car lot' });
  file = lot.file;
  const lotId = lot.nodeId!;

  const bill = addChild(file, boardId, dinerId, { title: 'The bill' });
  file = bill.file;
  const billId = bill.nodeId!;

  return { file, boardId, blockId, dinerId, lotId, billId };
};

const boardOf = (file: ProjectFile, boardId: Board['id']): Board => findBoard(file, boardId) as Board;
const view = (over: Partial<BoardView> = {}): BoardView => ({ ...WHOLE_BOARD, ...over });
const lit = (board: Board, over: Partial<BoardView>) => readBoard(board, view(over)).lit;

describe('nothing asked for', () => {
  it('lights everything and dims nothing', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const reading = readBoard(board, WHOLE_BOARD);

    expect(reading.dimming).toBe(false);
    expect(reading.lit.size).toBe(board.nodes.length);
  });

  it('knows it is not filtering', () => {
    expect(isFiltered(WHOLE_BOARD)).toBe(false);
    expect(isFiltered(view({ unboundOnly: true }))).toBe(true);
    expect(isFiltered(view({ search: '  ' }))).toBe(false);
  });
});

describe('focus', () => {
  it('lights a node and everything hanging off it', () => {
    const { file, boardId, dinerId, billId } = staged();
    const board = boardOf(file, boardId);

    const shown = lit(board, { focusId: dinerId });
    expect(shown.has(dinerId as string)).toBe(true);
    expect(shown.has(billId as string)).toBe(true);
  });

  it('dims what is not under it, including its own parent', () => {
    // §10 says the rest is dimmed, not hidden: the writer still needs to see
    // where the lit part sits.
    const { file, boardId, dinerId, lotId, blockId } = staged();
    const board = boardOf(file, boardId);

    const shown = lit(board, { focusId: dinerId });
    expect(shown.has(lotId as string)).toBe(false);
    expect(shown.has(blockId as string)).toBe(false);
  });

  it('reads a subtree to whatever depth it goes', () => {
    const { file, boardId, blockId, dinerId, lotId, billId } = staged();
    const board = boardOf(file, boardId);

    expect(new Set(subtreeOf(board, blockId))).toEqual(new Set([blockId, dinerId, lotId, billId]));
  });
});

describe('search', () => {
  it('finds a node by its title', () => {
    const { file, boardId, dinerId } = staged();
    const board = boardOf(file, boardId);

    const reading = readBoard(board, view({ search: 'diner' }));
    expect(reading.hits.map((node) => node.id)).toEqual([dinerId]);
  });

  it('finds one by its note, which is where the thinking is', () => {
    const { file, boardId, lotId } = staged();
    const noted = updateNode(file, boardId, lotId, { note: 'She counts the cars and leaves.' });
    const board = boardOf(noted, boardId);

    expect(readBoard(board, view({ search: 'counts' })).hits.map((node) => node.id)).toEqual([lotId]);
  });

  it('finds one by its kind', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);

    expect(readBoard(board, view({ search: 'scene' })).hits.length).toBeGreaterThan(0);
  });

  it('does not search the fields a writer defines on a column', () => {
    // They hold values like "B" or "3", and a search for "a" that lit half the
    // board would make the control useless.
    const { file, boardId, dinerId } = staged();
    const board = boardOf(file, boardId);
    const node = board.nodes.find((one) => one.id === dinerId)!;

    expect(nodeMatches({ ...node, fields: { anything: 'quicksilver' } }, 'quicksilver')).toBe(false);
  });

  it('finds nothing for an empty search, rather than everything', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);

    expect(readBoard(board, view({ search: '   ' })).hits).toEqual([]);
    expect(readBoard(board, view({ search: '   ' })).dimming).toBe(false);
  });
});

describe('two views at once', () => {
  it('lights the intersection rather than either', () => {
    // A writer asking for ideas *and* for "diner" wants the ideas with diner
    // in them.
    const { file, boardId, dinerId, lotId } = staged();
    const board = boardOf(file, boardId);

    const shown = lit(board, { focusId: dinerId, search: 'car lot' });
    expect(shown.has(lotId as string)).toBe(false);
    expect(shown.has(dinerId as string)).toBe(false);
  });
});

describe('depth', () => {
  it('draws the structure column alone as the macro shape', () => {
    const { file, boardId, blockId, dinerId } = staged();
    const board = boardOf(file, boardId);

    const laid = boardLayout(board, view({ depth: 1 }));
    const ids = laid.nodes.map((node) => node.node.id);
    expect(ids).toContain(blockId);
    expect(ids).not.toContain(dinerId);
  });

  it('stops the strip of column names where the columns stop', () => {
    // A board filtered to its structure that still drew three named lanes
    // across an empty canvas would be saying the filter had not worked.
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);

    expect(boardLayout(board, view({ depth: 1 })).columns).toHaveLength(1);
    expect(boardLayout(board, WHOLE_BOARD).columns).toHaveLength(3);
  });

  it('still measures rather than positions, so nothing overlaps', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);

    const laid = boardLayout(board, view({ depth: 2 }));
    const rows = laid.nodes
      .filter((node) => node.column === 1)
      .sort((a, b) => a.y - b.y);

    for (const [index, node] of rows.entries()) {
      const next = rows[index + 1];
      if (next) expect(next.y).toBeGreaterThanOrEqual(node.y + node.height);
    }
  });

  it('leaves the board alone when no depth is asked for', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);

    expect(boardLayout(board, WHOLE_BOARD).nodes).toHaveLength(board.nodes.length);
  });
});
