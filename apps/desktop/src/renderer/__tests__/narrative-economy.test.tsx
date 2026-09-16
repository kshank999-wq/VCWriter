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
 * Progression on the screen (addendum 18 stage 6 — §7, §8).
 *
 * The question a designer could not ask before this stage: *I have written
 * "needs a keycard" in four places; is there anywhere that gives one?*
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

const keycardGame = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Reactor', format: 'game' });
  const card = addResource(file, { name: 'Keycard', kind: 'key_item', initial: 0 });
  file = card.file;
  const desk = addElement(file, { name: 'The desk' });
  file = desk.file;
  const door = addElement(file, { name: 'The server door' });
  file = door.file;
  const take = addChoice(file, { elementId: desk.element.id, name: 'Take it', toElementId: door.element.id });
  file = updateChoice(take.file, take.choice.id, {
    effects: [effect({ kind: 'grant', targetId: card.resource.id as string, value: '1' })],
  });
  // And the door asks for it, which is §8's dependency as an ordinary rule.
  file = updateElement(file, door.element.id, {
    conditions: {
      join: 'all',
      conditions: [{ subject: 'resource', subjectId: card.resource.id as string, op: 'at_least', value: '1' }],
      groups: [],
    },
  });
  return file;
};

describe('the economy under a resource', () => {
  it('says where it comes from, read off the graph', () => {
    render(<Harness initial={keycardGame()} />);
    fireEvent.click(screen.getByTitle('The states and resources every rule asks about'));
    expect(screen.getByText('1 source · 1 rule asks about it.')).toBeDefined();
    expect(screen.getByText('From: Take it (1)')).toBeDefined();
  });

  it('says so plainly when the player cannot get one', () => {
    let file = createProjectFile({ title: 'The Reactor', format: 'game' });
    file = addResource(file, { name: 'Railgun', kind: 'weapon' }).file;
    render(<Harness initial={file} />);
    fireEvent.click(screen.getByTitle('The states and resources every rule asks about'));
    // Nobody has used it yet, which is not the same as having designed it badly.
    expect(screen.getByText('Nothing in the game mentions it yet.')).toBeDefined();
  });

  /** The three §7 fields that are not readings, and no others. */
  it('offers a tier, a scarcity target and what it replaces', () => {
    render(<Harness initial={keycardGame()} />);
    fireEvent.click(screen.getByTitle('The states and resources every rule asks about'));
    expect(screen.getByLabelText('Progression tier for Keycard')).toBeDefined();
    expect(screen.getByLabelText('Scarcity target for Keycard')).toBeDefined();
    expect(screen.getByLabelText('What Keycard replaces')).toBeDefined();
    // And nothing asks for what the graph already knows.
    expect(screen.queryByLabelText(/acquisition point/i)).toBeNull();
  });

  it('counts the whole economy above the list', () => {
    render(<Harness initial={keycardGame()} />);
    fireEvent.click(screen.getByTitle('The states and resources every rule asks about'));
    expect(screen.getByText('1 resource.')).toBeDefined();
  });
});

describe('the progression', () => {
  /** The heading is absent where nothing is ranked: one *Unranked* says nothing. */
  it('groups by tier, and only once there is a tier', () => {
    let file = keycardGame();
    render(<Harness initial={file} />);
    fireEvent.click(screen.getByTitle('The states and resources every rule asks about'));
    expect(screen.queryByText('Unranked')).toBeNull();

    fireEvent.change(screen.getByLabelText('Progression tier for Keycard'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Resource' }));
    expect(screen.getByText('Tier 2')).toBeDefined();
    expect(screen.getByText('Unranked')).toBeDefined();
  });
});

describe('§9’s overlay', () => {
  /** It dims; it never hides. A graph with holes is a different game. */
  it('lights the nodes a resource touches and dims the rest', () => {
    let file = keycardGame();
    file = addElement(file, { name: 'The roof' }).file;
    const { container } = render(<Harness initial={file} />);
    fireEvent.click(screen.getByTitle('The states and resources every rule asks about'));

    expect(container.querySelectorAll('.narrmap-card.dim')).toHaveLength(0);
    fireEvent.click(screen.getByText('Light it on the map'));

    // Every node is still drawn, and the one the keycard never touches is dim.
    expect(container.querySelectorAll('.narrmap-card')).toHaveLength(3);
    expect(container.querySelectorAll('.narrmap-card.dim')).toHaveLength(1);

    fireEvent.click(screen.getByText('Stop lighting it on the map'));
    expect(container.querySelectorAll('.narrmap-card.dim')).toHaveLength(0);
  });
});
