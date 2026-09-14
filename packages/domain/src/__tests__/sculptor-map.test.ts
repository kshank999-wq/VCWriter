import { describe, expect, it } from 'vitest';
import {
  WHOLE_BOARD,
  addBlock,
  addChild,
  boardLayout,
  createBoard,
  createProjectFile,
  findBoard,
  miniMap,
  needsAMap,
  readBoard,
  updateNode,
  windowFromMap,
  type Board,
  type BoardLayout,
  type BoardView,
  type BoardWindow,
  type ProjectFile,
} from '../index.js';

/**
 * The mini-map (addendum 03 §10, the last of stage 9).
 *
 * §10 asks for it in six words — *for a board bigger than the window* — so the
 * first thing these hold is the half of that sentence everybody forgets: a
 * board that fits gets no map. After that it is one claim, which is that the
 * map is a reading of **the layout the canvas is drawing**, so what is folded
 * away, hidden by a depth or dimmed by a filter is folded, hidden and dimmed
 * on the map too.
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
const BOX = { width: 168, height: 120 };

/** A window showing a quarter of whatever it is given. */
const quarter = (layout: BoardLayout): BoardWindow => ({
  left: 0,
  top: 0,
  width: layout.width / 2,
  height: layout.height / 2,
});

/** Smaller than any one card, so there is a map whatever the board is. */
const TINY: BoardWindow = { left: 0, top: 0, width: 4, height: 2 };

const mapOf = (board: Board, window: BoardWindow, over: Partial<BoardView> = {}) =>
  miniMap(boardLayout(board, view(over)), readBoard(board, view(over)), window, BOX);

describe('whether there is a map at all', () => {
  it('gives none for a board that fits the window', () => {
    // The other half of §10's sentence. A map of what is already on the screen
    // is a picture of the screen, and it costs a corner of the canvas all day.
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);

    const whole: BoardWindow = { left: 0, top: 0, width: layout.width, height: layout.height };
    expect(needsAMap(layout, whole)).toBe(false);
    expect(miniMap(layout, readBoard(board, WHOLE_BOARD), whole, BOX)).toBeNull();
  });

  it('gives none for a board hanging a little over the edge', () => {
    // The board is wider than the window and still entirely legible. A map of
    // it is a sliver of two marks in the corner, which reads as debris rather
    // than as a picture of anything, so *bigger* is by a whole card.
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);

    const nearly: BoardWindow = {
      left: 0,
      top: 0,
      width: layout.width - 1,
      height: layout.height - 0.5,
    };
    expect(needsAMap(layout, nearly)).toBe(false);
  });

  it('gives one when the board is taller than the window, not only wider', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);

    const wide: BoardWindow = { left: 0, top: 0, width: layout.width, height: layout.height / 3 };
    expect(needsAMap(layout, wide)).toBe(true);
    expect(mapOf(board, wide)).not.toBeNull();
  });
});

describe('what the map draws', () => {
  it('fits the whole board inside the box it is given', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const map = mapOf(board, quarter(boardLayout(board, WHOLE_BOARD)))!;

    expect(map.width).toBeLessThanOrEqual(BOX.width + 0.001);
    expect(map.height).toBeLessThanOrEqual(BOX.height + 0.001);
    for (const card of map.cards) {
      expect(card.box.x).toBeGreaterThanOrEqual(0);
      expect(card.box.x + card.box.width).toBeLessThanOrEqual(map.width + 2.001);
    }
  });

  it('keeps the proportions of the board rather than squashing it into the box', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);
    const map = mapOf(board, quarter(layout))!;

    expect(map.width / map.height).toBeCloseTo(layout.width / layout.height, 5);
  });

  it('draws a card for everything the canvas is drawing, and nothing else', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);

    expect(mapOf(board, quarter(layout))!.cards).toHaveLength(layout.nodes.length);
  });

  it('leaves out what a depth has hidden, because that is not on the board either', () => {
    // A map is only useful if it is a map of the board in front of the writer.
    const { file, boardId, billId } = staged();
    const board = boardOf(file, boardId);

    const map = mapOf(board, TINY, { depth: 1 })!;
    expect(map.cards.some((card) => card.id === billId)).toBe(false);
  });

  it('leaves out what a fold has hidden, and keeps the card that stands for it', () => {
    const { file, boardId, dinerId, billId } = staged();
    const folded = updateNode(file, boardId, dinerId, { collapsed: true });
    const board = boardOf(folded, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);

    const map = mapOf(board, quarter(layout))!;
    expect(map.cards.some((card) => card.id === dinerId)).toBe(true);
    expect(map.cards.some((card) => card.id === billId)).toBe(false);
  });

  it('dims on the map what is dimmed on the board', () => {
    // The map is the one place a writer can see that what they searched for is
    // off the top of the window, so it has to carry the lighting.
    const { file, boardId, dinerId, lotId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);

    const map = mapOf(board, quarter(layout), { focusId: dinerId })!;
    expect(map.cards.find((card) => card.id === dinerId)!.lit).toBe(true);
    expect(map.cards.find((card) => card.id === lotId)!.lit).toBe(false);
  });

  it('lights everything when nothing is filtering', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);

    expect(mapOf(board, quarter(layout))!.cards.every((card) => card.lit)).toBe(true);
  });

  it('gives the smallest card a mark rather than nothing', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);

    const map = miniMap(layout, readBoard(board, WHOLE_BOARD), quarter(layout), {
      width: 20,
      height: 14,
    })!;
    for (const card of map.cards) {
      expect(card.box.width).toBeGreaterThan(0);
      expect(card.box.height).toBeGreaterThan(0);
    }
  });
});

describe('the window drawn on it', () => {
  it('is the part of the board the window is showing', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);
    const map = mapOf(board, quarter(layout))!;

    expect(map.window.width).toBeCloseTo(map.width / 2, 5);
    expect(map.window.height).toBeCloseTo(map.height / 2, 5);
  });

  it('moves with the board', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);
    const scrolled: BoardWindow = { ...quarter(layout), top: layout.height / 4 };

    expect(mapOf(board, scrolled)!.window.y).toBeGreaterThan(0);
  });

  it('is clipped to the map rather than hanging off it', () => {
    // A rectangle half outside the picture reads as the board having moved,
    // when what has happened is the canvas being dragged past its own edge.
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);
    const past: BoardWindow = { ...quarter(layout), left: layout.width * 2, top: -layout.height };

    const map = mapOf(board, past)!;
    expect(map.window.x + map.window.width).toBeLessThanOrEqual(map.width + 0.001);
    expect(map.window.y).toBeGreaterThanOrEqual(0);
  });
});

describe('pressing somewhere on it', () => {
  it('puts that point in the middle of the window', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);
    const window = quarter(layout);
    const map = mapOf(board, window)!;

    const middle = { x: map.width / 2, y: map.height / 2 };
    const moved = windowFromMap(map, layout, window, middle);
    expect(moved.left + window.width / 2).toBeCloseTo(layout.width / 2, 5);
    expect(moved.top + window.height / 2).toBeCloseTo(layout.height / 2, 5);
  });

  it('never scrolls past the end of the board', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);
    const window = quarter(layout);
    const map = mapOf(board, window)!;

    const corner = windowFromMap(map, layout, window, { x: map.width, y: map.height });
    expect(corner.left).toBeCloseTo(layout.width - window.width, 5);
    expect(corner.top).toBeCloseTo(layout.height - window.height, 5);
  });

  it('never scrolls before the start of it either', () => {
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);
    const window = quarter(layout);
    const map = mapOf(board, window)!;

    const origin = windowFromMap(map, layout, window, { x: 0, y: 0 });
    expect(origin.left).toBe(0);
    expect(origin.top).toBe(0);
  });

  it('leaves an axis alone where the board fits it', () => {
    // There is nothing to scroll along an axis the board does not overflow, so
    // pressing the map may not shunt the board sideways to make a point.
    const { file, boardId } = staged();
    const board = boardOf(file, boardId);
    const layout = boardLayout(board, WHOLE_BOARD);
    const window: BoardWindow = { left: 0, top: 0, width: layout.width, height: layout.height / 2 };
    const map = mapOf(board, window)!;

    expect(windowFromMap(map, layout, window, { x: map.width, y: map.height }).left).toBe(0);
  });
});
