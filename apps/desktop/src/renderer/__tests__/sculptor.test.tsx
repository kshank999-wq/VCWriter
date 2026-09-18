// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBlock,
  addChild,
  beatsForUnit,
  createBoard,
  createProjectFile,
  findBoard,
  findNode,
  unitsInStoryOrder,
  type ProjectFile,
  type SculptorNodeId,
} from '@vcwriter/domain';
import { SculptorWindow } from '../components/SculptorWindow';

/**
 * The Sculptor's *Add to track* (addendum 03 §6a): select a scene, one press,
 * and it is in the script with every beat under it. Three ways in — the
 * toolbar, the card's right-click, the panel — and all three read one offer.
 */

afterEach(cleanup);

let latest: ProjectFile | null = null;

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return (
    <SculptorWindow
      file={file}
      open
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

/** A board with one block, a scene under it and two beats under the scene. */
const shaped = () => {
  const made = createBoard(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  const block = addBlock(made.file, made.board.id, { title: 'She takes the job' });
  const scene = addChild(block.file, made.board.id, block.nodeId as SculptorNodeId, { title: 'The interview' });
  let file = scene.file;
  for (const title of ['She lies', 'He believes her']) {
    file = addChild(file, made.board.id, scene.nodeId as SculptorNodeId, { title }).file;
  }
  return { file, boardId: made.board.id, blockId: block.nodeId as SculptorNodeId, sceneId: scene.nodeId as SculptorNodeId };
};

/** The card on the canvas: the panel beside it shows the same title once it is chosen. */
const cardOf = (title: string): HTMLElement =>
  within(document.querySelector('.sculpt-sheet') as HTMLElement)
    .getByDisplayValue(title)
    .closest('.sculpt-node') as HTMLElement;

/** The toolbar's own buttons: the panel beside the canvas carries the same offer. */
const toolbar = () => within(document.querySelector('.sculptor-bar') as HTMLElement);

describe('Add to track on the Sculptor', () => {
  it('is on the toolbar, waits for a card, and names the beats that would come', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);

    const button = toolbar().getByRole('button', { name: 'Add to track' });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.pointerDown(cardOf('The interview'));
    const offered = toolbar().getByRole('button', { name: 'Add to track — and its 2 beats' });
    expect((offered as HTMLButtonElement).disabled).toBe(false);
    // The panel beside the canvas offers the same thing in the same words.
    expect(screen.getAllByRole('button', { name: 'Add to track — and its 2 beats' })).toHaveLength(2);
  });

  it('puts the scene in the script with its beats under it, in order, from the toolbar', () => {
    const { file, boardId, sceneId } = shaped();
    render(<Harness initial={file} />);

    fireEvent.pointerDown(cardOf('The interview'));
    fireEvent.click(toolbar().getByRole('button', { name: 'Add to track — and its 2 beats' }));

    const units = unitsInStoryOrder(latest as ProjectFile);
    const made = units.find((unit) => unit.title === 'The interview');
    expect(made).toBeDefined();
    expect(beatsForUnit(latest as ProjectFile, made!.id).map((beat) => beat.title)).toEqual([
      'She lies',
      'He believes her',
    ]);
    // The node is that scene now, and the card says so.
    expect(findNode(findBoard(latest as ProjectFile, boardId)!, sceneId)?.boundUnitId).toBe(made!.id);
    expect((toolbar().getByRole('button', { name: 'Add to track' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers the same thing on the card’s right-click', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);

    fireEvent.contextMenu(cardOf('The interview'), { clientX: 120, clientY: 80 });
    const menu = screen.getByRole('menu', { name: 'Card: The interview' });
    expect(menu).toBeDefined();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to track — and its 2 beats' }));

    expect(screen.queryByRole('menu')).toBeNull();
    const made = unitsInStoryOrder(latest as ProjectFile).find((unit) => unit.title === 'The interview');
    expect(made).toBeDefined();
    expect(beatsForUnit(latest as ProjectFile, made!.id)).toHaveLength(2);
  });

  it('keeps the item on a block, disabled, over the reason', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);

    fireEvent.contextMenu(cardOf('She takes the job'), { clientX: 120, clientY: 80 });
    const item = screen.getByRole('menuitem', { name: 'Add to track' }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(screen.getByText('a block is the shape of the story rather than a scene in it.')).toBeDefined();
  });

  it('closes the menu on Escape', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);

    fireEvent.contextMenu(cardOf('The interview'), { clientX: 120, clientY: 80 });
    expect(screen.getByRole('menu')).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers the beats alone once the scene is on the track, in the panel', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);

    fireEvent.pointerDown(cardOf('The interview'));
    fireEvent.click(toolbar().getByRole('button', { name: 'Add to track — and its 2 beats' }));
    // Thought of one more afterwards.
    fireEvent.click(screen.getByRole('button', { name: '+ Under it' }));
    fireEvent.pointerDown(cardOf('The interview'));

    expect(screen.getAllByRole('button', { name: 'Add its 1 beat to the track' }).length).toBeGreaterThan(0);
  });
});
