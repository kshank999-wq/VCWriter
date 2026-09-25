// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addUnit,
  createProjectFile,
  elementsOf,
  type BeatId,
  type ProjectFile,
} from '@vcwriter/domain';
import { ResearchBody } from '../components/ResearchWindow';
import { Inspector } from '../components/Inspector';
import { paneTitle } from '../panes';
import { menusFor } from '../menus';

/**
 * Addendum 25 §4.1–§4.2 on the screen: on a game, Research is the Game Bible
 * with a group of its own, and the far column carries the game's panels.
 * Neither changes anything on another format.
 */

afterEach(cleanup);

const game = (): ProjectFile => createProjectFile({ title: 'The Sunken Vault', format: 'game' });
const screenplay = (): ProjectFile => createProjectFile({ title: 'Cold Open', format: 'screenplay' });

function Bible({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  return (
    <ResearchBody
      file={file}
      currentBeatId={null}
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

function Far({ initial, beatId }: { initial: ProjectFile; beatId: BeatId | null }) {
  const [file, setFile] = useState(initial);
  return <Inspector file={file} selectedBeatId={beatId} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

const withBeat = (file: ProjectFile) => {
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'The Cave Mouth' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'Arrival' });
  return { file: beat.file, beatId: beat.beat.id };
};

describe('the Game Bible', () => {
  it('is Research, named for a game, with the game’s own group in the menu', () => {
    render(<Bible initial={game()} />);
    expect(screen.getByText('Game Bible')).toBeDefined();
    const menu = screen.getByRole('navigation', { name: 'Research folders' });
    expect(within(menu).getByText('The game')).toBeDefined();
    expect(within(menu).getByText('Items & resources')).toBeDefined();
    expect(within(menu).getByText('State')).toBeDefined();
    expect(within(menu).getByText('Quests & objectives')).toBeDefined();
    // Everything Research already had is still there: the Bible is not a second room.
    expect(within(menu).getAllByText('Locations').length).toBeGreaterThan(0);
  });

  it('is absent on a screenplay, where there is no game', () => {
    render(<Bible initial={screenplay()} />);
    expect(screen.queryByText('Game Bible')).toBeNull();
    expect(screen.queryByText('The game')).toBeNull();
  });

  it('makes an item, marks it not yet used, and edits it in the detail', () => {
    render(<Bible initial={game()} />);
    fireEvent.click(screen.getByRole('button', { name: /Items & resources/ }));
    fireEvent.click(screen.getByRole('button', { name: '+ Item' }));
    const card = screen.getByRole('button', { name: /Untitled/ });
    expect(card.textContent).toContain('Not yet used');
    fireEvent.click(card);
    fireEvent.change(screen.getByPlaceholderText('Old Lantern'), { target: { value: 'Vault Key' } });
    expect(screen.getByRole('button', { name: /Vault Key/ }).textContent).toContain('Consumable · not yet used');
  });

  it('is named Game Bible in the window menu and in its own window', () => {
    expect(paneTitle('research', 'game')).toBe('Game Bible');
    expect(paneTitle('research', 'screenplay')).toBe('Research');
    const window = menusFor('game').find((menu) => menu.label === 'Window')!;
    expect(window.items.some((item) => item !== null && 'label' in item && item.label === 'Game Bible in its own window')).toBe(true);
  });
});

describe('the far column on a game', () => {
  it('keeps the beat’s properties first, with the game panels down the edge', () => {
    const { file, beatId } = withBeat(game());
    render(<Far initial={file} beatId={beatId} />);
    const rail = screen.getByRole('navigation', { name: 'Game panels' });
    expect(within(rail).getAllByRole('button').map((one) => one.textContent)).toEqual([
      'Beat', 'Rules', 'World', 'Play', 'Checks', 'Endings', 'Built',
    ]);
    expect(within(rail).getByRole('button', { name: 'Beat' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('puts a beat on the Story Map from its Rules, and then shows the rule', () => {
    const { file, beatId } = withBeat(game());
    render(<Far initial={file} beatId={beatId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
    fireEvent.click(screen.getByRole('button', { name: 'Put this beat on the Story Map' }));
    expect(screen.getByText('Being here')).toBeDefined();
    expect(screen.getByText('Anybody who gets here may be here.')).toBeDefined();
  });

  it('says Game Studio does the building, and counts what it has built', () => {
    const { file, beatId } = withBeat(game());
    render(<Far initial={file} beatId={beatId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Built' }));
    expect(screen.getByText(/Binding the game to an engine happens in VC Game Studio/)).toBeDefined();
    expect(screen.getByText('Not built yet')).toBeDefined();
  });

  it('is the plain Inspector on a screenplay', () => {
    const { file, beatId } = withBeat(screenplay());
    render(<Far initial={file} beatId={beatId} />);
    expect(screen.queryByRole('navigation', { name: 'Game panels' })).toBeNull();
    expect(elementsOf(file)).toEqual([]);
  });
});
