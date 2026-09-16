// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addChoice,
  addElement,
  addResource,
  createProjectFile,
  updateChoice,
  updateElement,
  type Effect,
  type ProjectFile,
} from '@vcwriter/domain';
import { NarrativeMapWindow } from '../components/NarrativeMapWindow';

/**
 * The simulator on the screen (addendum 18 stage 7 — §13).
 *
 * What these hold: a blocked choice **says why** rather than greying out in
 * silence, the state is watched as it moves, and a path that no longer works
 * says where it broke.
 */

afterEach(cleanup);

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  return (
    <NarrativeMapWindow
      file={file}
      open
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

const effect = (one: Partial<Effect> & Pick<Effect, 'kind' | 'targetId'>): Effect => ({
  value: '',
  timing: 'immediate',
  note: '',
  ...one,
});

/** The desk hands over a keycard; the door wants one. */
const reactor = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Reactor', format: 'game' });
  const card = addResource(file, { name: 'Keycard', kind: 'key_item', initial: 0 });
  file = card.file;
  const desk = addElement(file, { name: 'The desk' });
  file = desk.file;
  const door = addElement(file, { name: 'The server door' });
  file = updateElement(door.file, door.element.id, {
    conditions: {
      join: 'all',
      conditions: [{ subject: 'resource', subjectId: card.resource.id as string, op: 'at_least', value: '1' }],
      groups: [],
    },
  });
  const take = addChoice(file, { elementId: desk.element.id, name: 'Take the keycard', toElementId: door.element.id });
  file = updateChoice(take.file, take.choice.id, {
    effects: [effect({ kind: 'grant', targetId: card.resource.id as string, value: '1' })],
  });
  const leave = addChoice(file, { elementId: desk.element.id, name: 'Leave it', toElementId: door.element.id });
  file = leave.file;
  return file;
};

const play = () => fireEvent.click(screen.getByTitle('Walk the game as a player, and keep the path'));

describe('walking the game', () => {
  it('starts where the player starts and offers what is there', () => {
    render(<Harness initial={reactor()} />);
    play();
    fireEvent.click(screen.getByRole('button', { name: '▶ Walk it' }));
    expect(screen.getByRole('heading', { name: 'The desk' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Take the keycard' })).toBeDefined();
  });

  it('moves the state, and marks what has moved', () => {
    render(<Harness initial={reactor()} />);
    play();
    fireEvent.click(screen.getByRole('button', { name: '▶ Walk it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take the keycard' }));
    expect(screen.getByRole('heading', { name: 'The server door' })).toBeDefined();
    expect(screen.getByText('Keycard').closest('li')?.className).toContain('moved');
    expect(screen.getByText(/Keycard 0 → 1/)).toBeDefined();
  });

  /** §13's *explain why a choice is blocked* — never a grey control and silence. */
  it('says why a choice is not offered', () => {
    render(<Harness initial={reactor()} />);
    play();
    fireEvent.click(screen.getByRole('button', { name: '▶ Walk it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave it' }));
    // The door is shut without the keycard. The move did not happen, so it is
    // not written into the path — and the reason is said rather than nothing.
    expect(screen.getByText(/You cannot go that way/)).toBeDefined();
    expect(screen.getByText(/Keycard is at least 1/)).toBeDefined();
    expect(screen.getByText('Nothing walked yet.')).toBeDefined();
  });

  it('steps back by dropping the choice', () => {
    render(<Harness initial={reactor()} />);
    play();
    fireEvent.click(screen.getByRole('button', { name: '▶ Walk it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take the keycard' }));
    fireEvent.click(screen.getByRole('button', { name: '← Step back' }));
    expect(screen.getByRole('heading', { name: 'The desk' })).toBeDefined();
    expect(screen.getByText('Nothing walked yet.')).toBeDefined();
  });

  /** §9's *path preview*: the walk is drawn on the board beside the panel. */
  it('marks where the player is standing, and the way they came', () => {
    const { container } = render(<Harness initial={reactor()} />);
    play();
    fireEvent.click(screen.getByRole('button', { name: '▶ Walk it' }));
    expect(container.querySelectorAll('.narrmap-card.is-here')).toHaveLength(1);
    expect(container.querySelectorAll('.narrmap-link.walked')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Take the keycard' }));
    expect(container.querySelectorAll('.narrmap-link.walked')).toHaveLength(1);

    // Stepping back un-draws it, the picture being a reading of the path.
    fireEvent.click(screen.getByRole('button', { name: '← Step back' }));
    expect(container.querySelectorAll('.narrmap-link.walked')).toHaveLength(0);
  });

  it('keeps the path under a name, and says where it ends', () => {
    render(<Harness initial={reactor()} />);
    play();
    fireEvent.click(screen.getByRole('button', { name: '▶ Walk it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take the keycard' }));
    fireEvent.change(screen.getByLabelText('What this path is called'), { target: { value: 'The honest route' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByRole('button', { name: 'The honest route' })).toBeDefined();
    expect(screen.getByText('1 choice — stops at The server door.')).toBeDefined();
  });
});
