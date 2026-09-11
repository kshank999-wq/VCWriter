import { describe, expect, it } from 'vitest';
import {
  addBlock,
  addChild,
  addColumn,
  boardLayout,
  createBoard,
  createProjectFile,
  findBoard,
  findNode,
  flipLink,
  linkBetween,
  linkNodes,
  linksOf,
  linksTouching,
  parseProjectFile,
  relabelLink,
  removeColumn,
  removeNode,
  standingFor,
  unlinkNodes,
  updateNode,
  type Board,
  type ProjectFile,
  type SculptorNodeId,
} from '../index.js';

/**
 * The writer's own connections (addendum 03 §7), stage 7.
 *
 * **A connector is never what holds two things together; the parent relation
 * is.** So almost everything worth testing here is about what a link does
 * *not* do: it does not move anything, it does not survive the card it was
 * drawn to, and losing it loses nothing but the observation.
 */

const boardIn = (file: ProjectFile, board: Board): Board => findBoard(file, board.id) as Board;

/** A block with two scenes under it, and a beat under the first. */
const drawn = (): {
  file: ProjectFile;
  board: Board;
  blockId: SculptorNodeId;
  first: SculptorNodeId;
  second: SculptorNodeId;
  beat: SculptorNodeId;
} => {
  const made = createBoard(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  const block = addBlock(made.file, made.board.id, { title: 'She takes the job' });
  const first = addChild(block.file, made.board.id, block.nodeId as SculptorNodeId, { title: 'The interview' });
  const second = addChild(first.file, made.board.id, block.nodeId as SculptorNodeId, { title: 'The walk home' });
  const beat = addChild(second.file, made.board.id, first.nodeId as SculptorNodeId, { title: 'She says she is fine' });
  return {
    file: beat.file,
    board: made.board,
    blockId: block.nodeId as SculptorNodeId,
    first: first.nodeId as SculptorNodeId,
    second: second.nodeId as SculptorNodeId,
    beat: beat.nodeId as SculptorNodeId,
  };
};

describe('what a writer noticed', () => {
  it('joins any node to any node, across the columns, with a label', () => {
    const { file, board, blockId, beat } = drawn();
    const made = linkNodes(file, board.id, beat, blockId, { label: 'This is why she takes it' });

    expect(made.linkId).not.toBeNull();
    const links = linksOf(boardIn(made.file, board));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ fromId: beat, toId: blockId, label: 'This is why she takes it' });
  });

  it('allows a line with nothing written on it', () => {
    const { file, board, first, second } = drawn();
    const made = linkNodes(file, board.id, first, second);
    expect(linksOf(boardIn(made.file, board))[0]?.label).toBe('');
  });

  it('refuses a node joined to itself: a line back to the same card says nothing', () => {
    const { file, board, first } = drawn();
    const made = linkNodes(file, board.id, first, first);
    expect(made.linkId).toBeNull();
    expect(linksOf(boardIn(made.file, board))).toHaveLength(0);
  });

  it('refuses the same pair twice, whichever way round it is asked', () => {
    const { file, board, first, second } = drawn();
    const once = linkNodes(file, board.id, first, second);
    const again = linkNodes(once.file, board.id, first, second);
    const reversed = linkNodes(once.file, board.id, second, first);

    expect(again.linkId).toBeNull();
    expect(reversed.linkId).toBeNull();
    expect(linksOf(boardIn(reversed.file, board))).toHaveLength(1);
  });

  it('turns the arrow round without losing the label', () => {
    const { file, board, first, second } = drawn();
    const made = linkNodes(file, board.id, first, second, { label: 'Pays off here' });
    const flipped = flipLink(made.file, board.id, made.linkId!);

    expect(linksOf(boardIn(flipped, board))[0]).toMatchObject({
      fromId: second,
      toId: first,
      label: 'Pays off here',
    });
  });

  it('finds what a node is connected to, in either direction', () => {
    const { file, board, blockId, first, second, beat } = drawn();
    let current = linkNodes(file, board.id, first, second).file;
    current = linkNodes(current, board.id, beat, first).file;

    expect(linksTouching(boardIn(current, board), first)).toHaveLength(2);
    expect(linksTouching(boardIn(current, board), blockId)).toHaveLength(0);
    expect(linkBetween(boardIn(current, board), second, first)).not.toBeNull();
  });

  it('rewrites the observation', () => {
    const { file, board, first, second } = drawn();
    const made = linkNodes(file, board.id, first, second, { label: 'Setup' });
    const said = relabelLink(made.file, board.id, made.linkId!, 'She learns the address here');
    expect(linksOf(boardIn(said, board))[0]?.label).toBe('She learns the address here');
  });
});

describe('what a link never costs', () => {
  it('moves nothing on the board: the layout is the same before and after', () => {
    const { file, board, first, second, beat } = drawn();
    const before = boardLayout(boardIn(file, board)).nodes.map((laid) => ({
      id: laid.node.id,
      x: laid.x,
      y: laid.y,
      height: laid.height,
    }));

    let current = linkNodes(file, board.id, beat, second, { label: 'This is why' }).file;
    current = linkNodes(current, board.id, first, second).file;

    const after = boardLayout(boardIn(current, board)).nodes.map((laid) => ({
      id: laid.node.id,
      x: laid.x,
      y: laid.y,
      height: laid.height,
    }));
    expect(after).toEqual(before);
  });

  it('loses the observation and nothing else when it goes', () => {
    const { file, board, first, second } = drawn();
    const made = linkNodes(file, board.id, first, second, { label: 'Setup' });
    const gone = unlinkNodes(made.file, board.id, made.linkId!);

    expect(linksOf(boardIn(gone, board))).toHaveLength(0);
    expect(findNode(boardIn(gone, board), first)?.title).toBe('The interview');
    expect(findNode(boardIn(gone, board), second)?.title).toBe('The walk home');
  });

  it('goes with the card it was drawn to, and with the subtree under it', () => {
    const { file, board, blockId, first, second, beat } = drawn();
    let current = linkNodes(file, board.id, beat, second, { label: 'Why' }).file;
    current = linkNodes(current, board.id, blockId, second).file;

    // Removing the first scene takes its beat with it, so the beat's link goes
    // too — but the block's link to the second scene stands.
    const gone = removeNode(current, board.id, first);
    expect(linksOf(boardIn(gone, board))).toHaveLength(1);
    expect(linksOf(boardIn(gone, board))[0]?.fromId).toBe(blockId);
  });

  it('goes with the column it was drawn into', () => {
    const { file, board, first, beat } = drawn();
    const column = addColumn(file, board.id, { name: 'Character arc' });
    // The fourth column hangs off the third, so the arc goes under the beat.
    const arc = addChild(column.file, board.id, beat, { title: 'Mara' });
    const made = linkNodes(arc.file, board.id, first, arc.nodeId!, { label: 'Her arc turns here' });

    const gone = removeColumn(made.file, board.id, column.columnId!);
    expect(linksOf(boardIn(gone, board))).toHaveLength(0);
  });
});

describe('a link into a fold', () => {
  it('is drawn to the folded card standing in for what is hidden', () => {
    const { file, board, first, beat, second } = drawn();
    const made = linkNodes(file, board.id, second, beat, { label: 'Why' }).file;
    const folded = updateNode(made, board.id, first, { collapsed: true });

    const live = boardIn(folded, board);
    const layout = boardLayout(live);
    // The beat is not laid out at all while its scene is folded…
    expect(layout.nodes.some((laid) => laid.node.id === beat)).toBe(false);
    // …so the scene stands for it, which is what the writer is looking at.
    expect(standingFor(live, layout, beat)?.node.id).toBe(first);
  });

  it('stands for itself when nothing is folded', () => {
    const { file, board, beat } = drawn();
    const live = boardIn(file, board);
    expect(standingFor(live, boardLayout(live), beat)?.node.id).toBe(beat);
  });
});

describe('links in the document', () => {
  it('survive a save and a re-open', () => {
    const { file, board, first, second } = drawn();
    const made = linkNodes(file, board.id, first, second, { label: 'Pays off here' });

    const back = parseProjectFile(JSON.parse(JSON.stringify(made.file)));
    expect(back.boards[0]!.links).toHaveLength(1);
    expect(back.boards[0]!.links[0]).toMatchObject({ fromId: first, toId: second, label: 'Pays off here' });
  });

  it('default to none, so a board drawn before this existed opens with a clean canvas', () => {
    const { file, board } = drawn();
    const stripped = JSON.parse(JSON.stringify(file));
    delete stripped.boards[0].links;

    const back = parseProjectFile(stripped);
    expect(back.boards[0]!.links).toEqual([]);
    expect(linksOf(boardIn(back, board))).toEqual([]);
  });
});
