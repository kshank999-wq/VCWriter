import { describe, expect, it } from 'vitest';
import {
  addBlock,
  addCharacter,
  addChild,
  castOnNode,
  createBoard,
  createProjectFile,
  findBoard,
  findNode,
  linkNodes,
  removalComfort,
  removalQuestion,
  removeNode,
  setNodeCast,
  whatGoesWith,
  type ProjectFile,
} from '../index.js';

/**
 * The card, asked about before it goes (addendum 03 §5).
 *
 * A × next to a ↑ and a ↓ is a × that gets hit, and a card near the top of a
 * board takes everything hanging off it. The question has to name what is
 * actually at stake — *delete these seven?* — rather than ask something
 * nobody can answer from the words in it.
 */

const board = () => {
  const made = createBoard(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  return { file: made.file, boardId: made.board.id };
};

/** A block with two cards under it, and one of those with a card of its own. */
const family = () => {
  const start = board();
  const block = addBlock(start.file, start.boardId, { title: 'The heist' });
  const one = addChild(block.file, start.boardId, block.nodeId!, { title: 'The warehouse' });
  const two = addChild(one.file, start.boardId, block.nodeId!, { title: 'The docks' });
  const deep = addChild(two.file, start.boardId, one.nodeId!, { title: 'The roller door' });
  return { file: deep.file, boardId: start.boardId, block: block.nodeId!, one: one.nodeId!, deep: deep.nodeId! };
};

describe('what a delete would take', () => {
  it('counts the card and everything hanging off it', () => {
    const { file, boardId, block } = family();
    const going = whatGoesWith(file, boardId, block);
    expect(going.cards).toBe(4);
    expect(going.removable).toBe(true);
  });

  it('counts only what is under the card, not the board', () => {
    const { file, boardId, one } = family();
    expect(whatGoesWith(file, boardId, one).cards).toBe(2);
  });

  it('counts the connections that would have nothing left to join', () => {
    const { file, boardId, block, deep } = family();
    const linked = linkNodes(file, boardId, block, deep, { label: 'this pays off here' });
    expect(linked.linkId).not.toBeNull();
    expect(whatGoesWith(linked.file, boardId, deep).links).toBe(1);
  });

  it('refuses to take Beginning or End, which a board cannot be without', () => {
    const { file, boardId } = board();
    const beginning = findBoard(file, boardId)!.nodes.find((node) => node.end === 'beginning')!;
    expect(whatGoesWith(file, boardId, beginning.id).removable).toBe(false);
  });

  it('agrees with what removing actually does', () => {
    const { file, boardId, block } = family();
    const before = findBoard(file, boardId)!.nodes.length;
    const going = whatGoesWith(file, boardId, block);
    const after = findBoard(removeNode(file, boardId, block), boardId)!.nodes.length;
    expect(before - after).toBe(going.cards);
  });
});

describe('the question the writer is asked', () => {
  it('asks about one card by name', () => {
    expect(removalQuestion({ cards: 1, bound: 0, links: 0, removable: true }, 'The docks')).toBe(
      'Delete “The docks”?',
    );
  });

  it('says how many go, because that is the part nobody can see', () => {
    expect(removalQuestion({ cards: 4, bound: 0, links: 0, removable: true }, 'The heist')).toBe(
      'Delete “The heist” and the 3 cards under it?',
    );
  });

  it('has something to call a card nobody has named yet', () => {
    expect(removalQuestion({ cards: 1, bound: 0, links: 0, removable: true }, '   ')).toBe('Delete this card?');
  });

  it('says what is not lost, which is what stops the question frightening anybody', () => {
    const comfort = removalComfort({ cards: 4, bound: 2, links: 1, removable: true });
    expect(comfort).toContain('scenes stay');
    expect(comfort).toContain('1 connection');
  });

  it('says nothing where there is nothing to reassure anybody about', () => {
    expect(removalComfort({ cards: 1, bound: 0, links: 0, removable: true })).toBe('');
  });
});

describe('who is on a card', () => {
  const withCast = (): { file: ProjectFile; boardId: string; node: string; mara: string } => {
    const start = family();
    const withMara = addCharacter(start.file, { name: 'MARA' });
    const mara = withMara.characters.find((one) => one.name === 'MARA')!;
    return {
      file: withMara,
      boardId: start.boardId as string,
      node: start.one as string,
      mara: mara.id as string,
    };
  };

  it('puts somebody on it and takes them off again', () => {
    const { file, boardId, node, mara } = withCast();
    const on = setNodeCast(file, boardId as never, node as never, mara as never, true);
    expect(castOnNode(on, findNode(findBoard(on, boardId as never)!, node as never)!).map((one) => one.name)).toEqual([
      'MARA',
    ]);

    const off = setNodeCast(on, boardId as never, node as never, mara as never, false);
    expect(castOnNode(off, findNode(findBoard(off, boardId as never)!, node as never)!)).toEqual([]);
  });

  it('reads the name through the cast, so renaming somebody renames every card', () => {
    const { file, boardId, node, mara } = withCast();
    const on = setNodeCast(file, boardId as never, node as never, mara as never, true);
    const renamed = {
      ...on,
      characters: on.characters.map((one) => (one.id === (mara as never) ? { ...one, name: 'MARA OKONJO' } : one)),
    };
    expect(
      castOnNode(renamed, findNode(findBoard(renamed, boardId as never)!, node as never)!).map((one) => one.name),
    ).toEqual(['MARA OKONJO']);
  });

  it('does not put the same person on twice', () => {
    const { file, boardId, node, mara } = withCast();
    const once = setNodeCast(file, boardId as never, node as never, mara as never, true);
    const twice = setNodeCast(once, boardId as never, node as never, mara as never, true);
    expect(twice).toBe(once);
  });
});
