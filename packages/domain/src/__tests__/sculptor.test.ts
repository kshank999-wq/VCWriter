import { describe, expect, it } from 'vitest';
import {
  GAP,
  ROW,
  addBlock,
  addChild,
  blocksOf,
  boardLayout,
  childrenOf,
  columnsOf,
  createBoard,
  createProjectFile,
  findBoard,
  moveNode,
  parseProjectFile,
  removeNode,
  renameColumn,
  updateNode,
  type Board,
  type ProjectFile,
  type SculptorNodeId,
} from '../index.js';

/**
 * The Story Sculptor (addendum 03), stages 1–4.
 *
 * §4 is the whole of the layout — *a node is as tall as its children, and no
 * shorter than itself* — so most of what is worth testing here is that one
 * rule, applied recursively, produces the diagram the writer drew.
 */

const started = (): { file: ProjectFile; board: Board } => {
  const made = createBoard(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  return made;
};

/** The board as it stands, after whatever has been done to the file. */
const boardIn = (file: ProjectFile, board: Board): Board => findBoard(file, board.id) as Board;

const heightOf = (file: ProjectFile, board: Board, nodeId: SculptorNodeId): number =>
  boardLayout(boardIn(file, board)).nodes.find((laid) => laid.node.id === nodeId)?.height ?? 0;

const topOf = (file: ProjectFile, board: Board, nodeId: SculptorNodeId): number =>
  boardLayout(boardIn(file, board)).nodes.find((laid) => laid.node.id === nodeId)?.y ?? 0;

describe('a new board', () => {
  it('has exactly two nodes, and both are real and editable', () => {
    const { board } = started();
    expect(board.nodes).toHaveLength(2);
    expect(blocksOf(board).map((node) => node.end)).toEqual(['beginning', 'end']);
    expect(blocksOf(board).map((node) => node.title)).toEqual(['Beginning', 'End']);
  });

  it('comes with the three columns nearly every story wants', () => {
    const { board } = started();
    expect(columnsOf(board).map((column) => column.name)).toEqual(['Structure', 'Scenes', 'Beats']);
    expect(columnsOf(board).map((column) => column.kind)).toEqual(['structure', 'scene', 'beat']);
  });

  it('offers no template: a board with one block between the ends is valid', () => {
    let { file, board } = started();
    file = addBlock(file, board.id, { title: 'She takes the job' }).file;
    expect(blocksOf(boardIn(file, board)).map((node) => node.title)).toEqual([
      'Beginning',
      'She takes the job',
      'End',
    ]);
  });

  it('lets the writer rename a column, because it is theirs', () => {
    const { file, board } = started();
    const next = renameColumn(file, board.id, columnsOf(board)[2]!.id, 'Character arcs');
    expect(columnsOf(boardIn(next, board))[2]?.name).toBe('Character arcs');
  });

  it('travels in the document, and a file that predates boards opens with none', () => {
    const { file } = started();
    const back = parseProjectFile(JSON.parse(JSON.stringify(file)));
    expect(back.boards).toHaveLength(1);
    expect(back.boards[0]?.nodes).toHaveLength(2);

    const older = parseProjectFile({ ...JSON.parse(JSON.stringify(file)), boards: undefined });
    expect(older.boards).toEqual([]);
  });
});

describe('the frame', () => {
  it('keeps Beginning first and End last, whatever is put between them', () => {
    let { file, board } = started();
    for (const title of ['One', 'Two', 'Three']) {
      file = addBlock(file, board.id, {
        afterNodeId: blocksOf(boardIn(file, board)).filter((node) => node.end === null).at(-1)?.id ?? null,
        title,
      }).file;
    }
    expect(blocksOf(boardIn(file, board)).map((node) => node.title)).toEqual([
      'Beginning',
      'One',
      'Two',
      'Three',
      'End',
    ]);
  });

  it('will not put a block after the end of the story', () => {
    let { file, board } = started();
    const end = blocksOf(board).find((node) => node.end === 'end')!;
    file = addBlock(file, board.id, { afterNodeId: end.id, title: 'After the end' }).file;
    expect(blocksOf(boardIn(file, board)).at(-1)?.end).toBe('end');
  });

  it('will not delete either end', () => {
    const { file, board } = started();
    for (const node of blocksOf(board)) {
      expect(removeNode(file, board.id, node.id).boards[0]?.nodes).toHaveLength(2);
    }
  });

  it('moves a block among its siblings and never past an end', () => {
    let { file, board } = started();
    const one = addBlock(file, board.id, { title: 'One' });
    file = one.file;
    const two = addBlock(file, board.id, { afterNodeId: one.nodeId, title: 'Two' });
    file = two.file;

    file = moveNode(file, board.id, two.nodeId!, -1);
    expect(blocksOf(boardIn(file, board)).map((node) => node.title)).toEqual(['Beginning', 'Two', 'One', 'End']);

    // Already at the head of the middle: there is nowhere above it to go.
    const before = boardIn(file, board);
    expect(blocksOf(boardIn(moveNode(file, board.id, two.nodeId!, -1), board)).map((n) => n.title)).toEqual(
      blocksOf(before).map((n) => n.title),
    );
  });
});

describe('the layout rule', () => {
  it('makes a node with nothing under it one row tall', () => {
    const { file, board } = started();
    const layout = boardLayout(boardIn(file, board));
    expect(layout.nodes.every((laid) => laid.height === ROW)).toBe(true);
  });

  it('makes a scene as tall as its beats', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id, { title: 'The job' });
    file = block.file;
    const scene = addChild(file, board.id, block.nodeId!, { title: 'The interview' });
    file = scene.file;

    expect(heightOf(file, board, scene.nodeId!)).toBe(ROW);
    file = addChild(file, board.id, scene.nodeId!, { title: 'She lies' }).file;
    file = addChild(file, board.id, scene.nodeId!, { title: 'He believes her' }).file;
    // Two beats and the gap between them.
    expect(heightOf(file, board, scene.nodeId!)).toBeCloseTo(ROW * 2 + GAP);
  });

  it('grows the gap between two blocks as scenes are stacked beside it', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id, { title: 'The job' });
    file = block.file;
    const was = heightOf(file, board, block.nodeId!);

    file = addChild(file, board.id, block.nodeId!, { title: 'One' }).file;
    file = addChild(file, board.id, block.nodeId!, { title: 'Two' }).file;
    const now = heightOf(file, board, block.nodeId!);
    expect(now).toBeGreaterThan(was);
    expect(now).toBeCloseTo(ROW * 2 + GAP);
  });

  it('pushes everything below a block down the canvas when one grows', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id, { title: 'The job' });
    file = block.file;
    const end = blocksOf(board).find((node) => node.end === 'end')!;
    const was = topOf(file, board, end.id);

    file = addChild(file, board.id, block.nodeId!, { title: 'One' }).file;
    file = addChild(file, board.id, block.nodeId!, { title: 'Two' }).file;
    expect(topOf(file, board, end.id)).toBeGreaterThan(was);
  });

  it('grows a scene, which grows its block, which pushes the rest down', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id, { title: 'The job' });
    file = block.file;
    const scene = addChild(file, board.id, block.nodeId!, { title: 'The interview' });
    file = scene.file;
    const was = heightOf(file, board, block.nodeId!);

    file = addChild(file, board.id, scene.nodeId!, { title: 'She lies' }).file;
    file = addChild(file, board.id, scene.nodeId!, { title: 'He believes her' }).file;
    // A beat grew its scene, and the scene grew the block it hangs off.
    expect(heightOf(file, board, block.nodeId!)).toBeGreaterThan(was);
    expect(heightOf(file, board, block.nodeId!)).toBe(heightOf(file, board, scene.nodeId!));
  });

  it('never overlaps anything, because nothing is positioned', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id, { title: 'The job' });
    file = block.file;
    for (const name of ['One', 'Two', 'Three']) {
      const scene = addChild(file, board.id, block.nodeId!, { title: name });
      file = scene.file;
      for (const beat of ['a', 'b']) file = addChild(file, board.id, scene.nodeId!, { title: beat }).file;
    }

    const layout = boardLayout(boardIn(file, board));
    for (const column of layout.columns) {
      const stack = layout.nodes
        .filter((laid) => laid.column === column.index)
        .sort((a, b) => a.y - b.y);
      for (const [index, laid] of stack.entries()) {
        const next = stack[index + 1];
        if (next) expect(laid.y + laid.height).toBeLessThanOrEqual(next.y + 0.0001);
      }
    }
  });

  it('lays each column out to the right of the one before it', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id, { title: 'The job' });
    file = block.file;
    const scene = addChild(file, board.id, block.nodeId!, { title: 'One' });
    file = scene.file;
    file = addChild(file, board.id, scene.nodeId!, { title: 'a' }).file;

    const layout = boardLayout(boardIn(file, board));
    const xs = layout.columns.map((column) => column.x);
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);
    expect(layout.width).toBeGreaterThan(xs[2]!);
  });

  it('compresses a folded node and keeps its children where they were', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id, { title: 'The job' });
    file = block.file;
    file = addChild(file, board.id, block.nodeId!, { title: 'One' }).file;
    file = addChild(file, board.id, block.nodeId!, { title: 'Two' }).file;

    file = updateNode(file, board.id, block.nodeId!, { collapsed: true });
    const layout = boardLayout(boardIn(file, board));
    expect(heightOf(file, board, block.nodeId!)).toBe(ROW);
    // Folded away, not thrown away: the children are still on the board.
    expect(layout.nodes.filter((laid) => laid.column === 1)).toHaveLength(0);
    expect(childrenOf(boardIn(file, board), block.nodeId!)).toHaveLength(2);
    // And it still says how many it is hiding.
    expect(layout.nodes.find((laid) => laid.node.id === block.nodeId)?.childCount).toBe(2);
  });
});

describe('what a node is', () => {
  it('is a title and a note, and nothing is asked for up front', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id);
    file = block.file;
    const made = findBoard(file, board.id)!.nodes.find((node) => node.id === block.nodeId);
    expect(made?.title).toBe('');
    expect(made?.note).toBe('');

    file = updateNode(file, board.id, block.nodeId!, { title: 'The job', note: 'She should not take it.' });
    const after = findBoard(file, board.id)!.nodes.find((node) => node.id === block.nodeId);
    expect(after?.title).toBe('The job');
    expect(after?.note).toBe('She should not take it.');
  });

  it('is an idea until the writer says otherwise', () => {
    const { file, board } = started();
    expect(boardIn(file, board).nodes.every((node) => node.boundUnitId === null && node.boundBeatId === null)).toBe(
      true,
    );
  });

  it('takes its column’s kind by default', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id);
    file = block.file;
    const scene = addChild(file, board.id, block.nodeId!);
    file = scene.file;
    const made = findBoard(file, board.id)!.nodes.find((node) => node.id === scene.nodeId);
    expect(made?.kind).toBe('scene');
  });

  it('takes its subtree with it when it goes, and nothing else', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id, { title: 'The job' });
    file = block.file;
    const scene = addChild(file, board.id, block.nodeId!, { title: 'One' });
    file = scene.file;
    file = addChild(file, board.id, scene.nodeId!, { title: 'a' }).file;
    expect(boardIn(file, board).nodes).toHaveLength(5);

    file = removeNode(file, board.id, block.nodeId!);
    // The block, its scene and its beat; the two ends stay.
    expect(boardIn(file, board).nodes).toHaveLength(2);
  });

  it('has nowhere to hang a child off a node in the last column', () => {
    let { file, board } = started();
    const block = addBlock(file, board.id);
    file = block.file;
    const scene = addChild(file, board.id, block.nodeId!);
    file = scene.file;
    const beat = addChild(file, board.id, scene.nodeId!);
    file = beat.file;

    const deeper = addChild(beat.file, board.id, beat.nodeId!);
    expect(deeper.nodeId).toBeNull();
    expect(boardIn(deeper.file, board).nodes).toHaveLength(5);
  });
});
