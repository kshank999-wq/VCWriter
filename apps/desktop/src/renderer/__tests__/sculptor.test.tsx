// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBlock,
  addCharacter,
  addChild,
  beatsForUnit,
  boardSchema,
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
 * Story Sculptor 2.0 in the app (addendum 03 v2 §14): one Sculptor, the
 * palette, the library, the inspector, the corner dots, explode and collapse,
 * mini maps with breadcrumbs, and Add to track carried over from version 1.
 */

afterEach(cleanup);

let latest: ProjectFile | null = null;

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return <SculptorWindow file={file} open onClose={() => undefined} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

/** Act one → The interview (scene) → two beats, and Mara in the cast. */
const shaped = () => {
  const cast = addCharacter(createProjectFile({ title: 'Blackout', format: 'screenplay' }), { name: 'Mara' });
  const made = createBoard(cast);
  const block = addBlock(made.file, made.board.id, { title: 'Act one' });
  const scene = addChild(block.file, made.board.id, block.nodeId as SculptorNodeId, { title: 'The interview', kind: 'scene' });
  let file = scene.file;
  for (const title of ['She lies', 'He believes her']) {
    file = addChild(file, made.board.id, scene.nodeId as SculptorNodeId, { title, kind: 'beat' }).file;
  }
  return { file, boardId: made.board.id, blockId: block.nodeId as SculptorNodeId, sceneId: scene.nodeId as SculptorNodeId };
};

const card = (title: string): HTMLElement =>
  [...document.querySelectorAll<HTMLElement>('.sc-card')].find((one) => one.querySelector('.sc-card-title')?.textContent === title) as HTMLElement;
const cardTitles = () => [...document.querySelectorAll('.sc-card .sc-card-title')].map((one) => one.textContent);
const select = (title: string) => fireEvent.pointerDown(card(title), { button: 0 });
const board = () => findBoard(latest!, latest!.boards![0]!.id)!;

describe('one Sculptor, the v2 map', () => {
  it('opens as the map with a palette, a library and type-labelled cards', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    expect(screen.getAllByRole('dialog', { name: 'Story Sculptor' })).toHaveLength(1);
    expect(screen.getByRole('complementary', { name: 'New cards' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Library' })).toBeTruthy();
    expect(cardTitles()).toEqual(['Act one', 'The interview', 'She lies', 'He believes her']);
    expect(within(card('The interview')).getByText('SC')).toBeTruthy();
    // Corner dots on the cards that hold something.
    expect(card('Act one').querySelectorAll('.sc-dot')).toHaveLength(2);
    expect(card('She lies').querySelector('.sc-dots')).toBeNull();
  });

  it('upgrades a version-1 board the first time it is opened, and never offers the old board', () => {
    const base = createProjectFile({ title: 'Old', format: 'screenplay' });
    const at = '2026-01-01T00:00:00.000Z';
    const old = boardSchema.parse({
      id: '00000000-0000-4000-8000-0000000000b1',
      projectId: base.project.id,
      name: 'Board',
      columns: [{ id: '00000000-0000-4000-8000-0000000000c1', name: 'Structure', kind: 'structure', orderKey: 'a1', fields: [] }],
      nodes: [
        {
          id: '00000000-0000-4000-8000-0000000000d1',
          boardId: '00000000-0000-4000-8000-0000000000b1',
          columnId: '00000000-0000-4000-8000-0000000000c1',
          orderKey: 'a1',
          title: 'Beginning',
          kind: 'structure',
          end: 'beginning',
          createdAt: at,
          updatedAt: at,
        },
      ],
      createdAt: at,
      updatedAt: at,
    });
    render(<Harness initial={{ ...base, boards: [old] }} />);
    expect(board().schemaVersion).toBe(2);
    expect(findNode(board(), '00000000-0000-4000-8000-0000000000d1')!.kind).toBe('frame');
    expect(screen.queryByRole('button', { name: /\+ Column/ })).toBeNull();
  });

  it('adds from the palette under the selected card, and asks which character for a Character', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    select('The interview');
    fireEvent.click(screen.getByRole('button', { name: 'Add a character' }));
    const dialog = screen.getByRole('dialog', { name: 'Which character?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mara' }));
    const mara = board().nodes.find((node) => node.kind === 'character')!;
    expect(mara.parentId).toBe(board().nodes.find((node) => node.title === 'The interview')!.id);
    expect(latest!.characters.filter((one) => one.name === 'Mara')).toHaveLength(1);
  });

  it('places a character from the library twice as one definition', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    const library = screen.getByRole('region', { name: 'Library' });
    select('She lies');
    fireEvent.click(within(library).getByTitle('Place Mara'));
    select('He believes her');
    fireEvent.click(within(library).getByTitle('Place Mara'));
    const placements = board().nodes.filter((node) => node.kind === 'character');
    expect(placements).toHaveLength(2);
    expect(new Set(placements.map((node) => node.entityId)).size).toBe(1);
    expect(board().entities).toHaveLength(1);
  });

  it('collapses all to the frames, explodes all back, and collapses to Scene', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    fireEvent.click(screen.getByRole('button', { name: /Collapse all/ }));
    expect(cardTitles()).toEqual(['Act one']);
    // The folded card counts what it hides.
    expect(card('Act one').querySelector('.sc-dot-count')?.textContent).toBe('3');
    fireEvent.click(screen.getByRole('button', { name: /Explode all/ }));
    expect(cardTitles()).toHaveLength(4);
    fireEvent.change(screen.getByRole('combobox', { name: 'Collapse to level' }), { target: { value: 'type:scene' } });
    expect(cardTitles()).toEqual(['Act one', 'The interview']);
  });

  it('opens a card as its own map and comes back by the breadcrumbs', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    fireEvent.doubleClick(card('The interview'));
    expect(cardTitles()).toEqual(['The interview', 'She lies', 'He believes her']);
    const crumbs = screen.getByRole('navigation', { name: 'Where you are in the story' });
    expect(within(crumbs).getByRole('button', { name: 'Act one' })).toBeTruthy();
    fireEvent.click(within(crumbs).getByRole('button', { name: 'Whole story' }));
    expect(cardTitles()).toHaveLength(4);
  });

  it('finds a card inside a fold and reveals it with its path', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    fireEvent.click(screen.getByRole('button', { name: /Collapse all/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the map' }), { target: { value: 'believes' } });
    const results = screen.getByRole('listbox', { name: 'Search results' });
    expect(within(results).getByText('Act one › The interview')).toBeTruthy();
    fireEvent.click(within(results).getByRole('button'));
    expect(cardTitles()).toContain('He believes her');
  });

  it('asks before deleting and says reusable items stay', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    select('The interview');
    fireEvent.keyDown(window, { key: 'Delete' });
    const ask = screen.getByRole('alertdialog');
    expect(ask.textContent).toContain('and the 2 cards under it');
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete' }));
    expect(board().nodes).toHaveLength(1);
  });
});

describe('Add to track, carried over from version 1', () => {
  it('puts the scene in the script with its beats under it, in order, from the inspector', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    select('The interview');
    const inspector = screen.getByRole('region', { name: 'Card details' });
    fireEvent.click(within(inspector).getByRole('button', { name: /Add to track — and its 2 beats/ }));
    const units = unitsInStoryOrder(latest!);
    const unit = units.find((one) => one.title === 'The interview')!;
    expect(beatsForUnit(latest!, unit.id).map((beat) => beat.title)).toEqual(['She lies', 'He believes her']);
  });

  it('offers it on the card’s right-click, and the menu closes on Escape', () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    fireEvent.contextMenu(card('The interview'), { clientX: 100, clientY: 100 });
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Add to track/ })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('exporting the map', () => {
  it('sends the map to the PDF window as one drawn page', async () => {
    const { file } = shaped();
    const calls: unknown[] = [];
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      exportPdf: async (input: unknown) => {
        calls.push(input);
        return { ok: true, data: { path: '/tmp/Blackout story map.pdf', pageCount: 1 } };
      },
    };
    render(<Harness initial={file} />);
    fireEvent.click(screen.getByRole('button', { name: 'PDF, everything' }));
    await screen.findByRole('status');
    const sent = calls[0] as { kind: string; html: string; paper: { width: number } };
    expect(sent.kind).toBe('map');
    expect(sent.html).toContain('He believes her');
    expect(sent.paper.width).toBeGreaterThanOrEqual(11);
  });
});

describe('exporting the map as JSON', () => {
  it('saves the whole graph as a .json file', async () => {
    const { file } = shaped();
    const saved: { name: string; bytes: Uint8Array; mediaType: string }[] = [];
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      saveFile: async (input: { name: string; bytes: Uint8Array; mediaType: string }) => {
        saved.push(input);
        return { ok: true, data: { path: '/tmp/Blackout story map.json' } };
      },
    };
    render(<Harness initial={file} />);
    fireEvent.click(screen.getByRole('button', { name: 'JSON data' }));
    await screen.findByRole('status');
    expect(saved[0]!.name).toBe('Blackout story map.json');
    expect(saved[0]!.mediaType).toBe('application/json');
    const data = JSON.parse(new TextDecoder().decode(saved[0]!.bytes));
    expect(data.cards.map((card: { title: string }) => card.title)).toEqual(['Act one', 'The interview', 'She lies', 'He believes her']);
  });
});

describe('importing a map from JSON', () => {
  it('reads a file, asks where it goes, and opens it as a new map', async () => {
    const { sculptMapJsonText } = await import('@vcwriter/domain');
    const { file } = shaped();
    const text = sculptMapJsonText(file, file.boards![0]!);
    const target = createProjectFile({ title: 'Other', format: 'screenplay' });
    render(<Harness initial={target} />);
    const input = screen.getByLabelText('Story map JSON file') as HTMLInputElement;
    const chosen = new File([text], 'Blackout story map.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [chosen] } });
    const dialog = await screen.findByRole('dialog', { name: 'Import a story map' });
    expect(dialog.textContent).toContain('4 cards');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
    await screen.findByRole('status');
    expect(latest!.boards).toHaveLength(2);
    expect(cardTitles()).toEqual(['Act one', 'The interview', 'She lies', 'He believes her']);
    expect(screen.getByRole('combobox', { name: 'Which map' })).toBeTruthy();
  });

  it('says plainly when the file is not a story map', async () => {
    const { file } = shaped();
    render(<Harness initial={file} />);
    const input = screen.getByLabelText('Story map JSON file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['{"a":1}'], 'x.json', { type: 'application/json' })] } });
    expect((await screen.findByRole('status')).textContent).toContain('not a VC Writer story map');
    expect(latest!.boards).toHaveLength(1);
  });
});
