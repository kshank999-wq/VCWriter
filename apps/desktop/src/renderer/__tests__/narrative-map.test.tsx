// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addChoice,
  addElement,
  createProjectFile,
  elementsOf,
  choicesOf,
  updateElement,
  type ProjectFile,
} from '@vcwriter/domain';
import { NarrativeMapWindow } from '../components/NarrativeMapWindow';
import { menusFor } from '../menus';

/**
 * The narrative canvas on the screen (addendum 18 stage 4).
 *
 * What these hold down is what driving the real renderer keeps catching: a
 * reading that is right in the domain and absent from the picture. The card
 * has to *say* what the graph knows, the badge has to carry stage 3's
 * findings, and the room has to be **absent** on a format with no graph.
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

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

const diamond = (): ProjectFile => {
  let file = game();
  const start = addElement(file, { name: 'Cold open' });
  file = start.file;
  const vent = addElement(file, { name: 'The vent' });
  file = vent.file;
  const bridge = addElement(file, { name: 'The bridge' });
  file = updateElement(bridge.file, bridge.element.id, { kind: 'ending' });
  file = addChoice(file, { elementId: start.element.id, name: 'Climb', toElementId: vent.element.id }).file;
  file = addChoice(file, { elementId: vent.element.id, name: 'Crawl on', toElementId: bridge.element.id }).file;
  return file;
};

describe('the canvas', () => {
  it('draws a card for every node, and what the graph says about it', () => {
    render(<Harness initial={diamond()} />);
    expect(screen.getByText('Cold open')).toBeDefined();
    expect(screen.getByText('The bridge')).toBeDefined();
    // Read, never typed: the card says where it ends.
    expect(screen.getAllByText(/ends here/).length).toBeGreaterThan(0);
  });

  /** §1, said out loud rather than left for somebody to discover. */
  it('tells the designer there is nothing to drag', () => {
    render(<Harness initial={diamond()} />);
    expect(
      screen.getByText(/The layout is read from the graph — draw a connection and a node moves by itself\./),
    ).toBeDefined();
  });

  it('counts the graph in the bar', () => {
    render(<Harness initial={diamond()} />);
    expect(screen.getByText('3 nodes · 2 connections.')).toBeDefined();
  });

  it('says the board is empty rather than showing an empty box', () => {
    render(<Harness initial={game()} />);
    expect(screen.getAllByText('Nothing on the board yet. Add a node to start the graph.').length).toBe(2);
  });
});

describe('the node beside it', () => {
  it('opens on the node that was clicked, with its choices', () => {
    render(<Harness initial={diamond()} />);
    fireEvent.click(screen.getByText('Cold open'));
    expect(screen.getByLabelText("The node's name")).toHaveProperty('value', 'Cold open');
    expect(screen.getByDisplayValue('Climb')).toBeDefined();
    expect(screen.getByText('→ The vent')).toBeDefined();
  });

  it('adds a node and selects it, so the next thing typed lands on it', () => {
    render(<Harness initial={game()} />);
    fireEvent.click(screen.getByTitle('Add a node to the graph'));
    const name = screen.getByLabelText("The node's name");
    fireEvent.change(name, { target: { value: 'Cold open' } });
    expect(screen.getByText('Cold open')).toBeDefined();
    // And the first node made is where the player starts.
    expect(screen.getByLabelText(/start here|The player can start here/)).toBeDefined();
  });

  /**
   * The connection is drawn by pressing one node and then the other, because
   * there is nothing to drag and dragging a line would be the one exception.
   */
  it('joins two nodes, and the picture follows', () => {
    let file = game();
    file = addElement(file, { name: 'Cold open' }).file;
    file = addElement(file, { name: 'The vault' }).file;
    const { container } = render(<Harness initial={file} />);

    // The second node is stranded until something leads to it, and is drawn
    // as one rather than left off the picture.
    expect(container.querySelectorAll('.narrmap-card.stranded')).toHaveLength(1);

    fireEvent.click(screen.getByText('Cold open'));
    fireEvent.click(screen.getByTitle('Draw a connection: press this, then the node it leads to'));
    fireEvent.click(screen.getByText('The vault'));

    expect(container.querySelectorAll('.narrmap-card.stranded')).toHaveLength(0);
    expect(screen.getByText('2 nodes · 1 connection.')).toBeDefined();
  });

  /** Stage 3 on the node it is about, rather than in a list somewhere else. */
  it('shows what the checks say about the selected node', () => {
    let file = game();
    const start = addElement(file, { name: 'Cold open' });
    file = addChoice(start.file, { elementId: start.element.id, name: 'Shrug' }).file;
    render(<Harness initial={file} />);

    fireEvent.click(screen.getByText('Cold open'));
    expect(screen.getByText(/has nowhere to go and is not marked as an ending/)).toBeDefined();
    expect(screen.getByText('Shrug at Cold open changes nothing and leads nowhere.')).toBeDefined();
    // And the count is on the card.
    expect(screen.getByText('2')).toBeDefined();
  });

  it('removes a node, keeping the choice that led to it', () => {
    const file = diamond();
    render(<Harness initial={file} />);
    fireEvent.click(screen.getByText('The vent'));
    fireEvent.click(screen.getByText('Remove this node'));
    expect(screen.queryByText('The vent')).toBeNull();
    expect(screen.getByText('Cold open')).toBeDefined();
  });
});

describe('the filters', () => {
  it('search by name', () => {
    render(<Harness initial={diamond()} />);
    fireEvent.change(screen.getByLabelText('Find a node by its name or note'), { target: { value: 'vent' } });
    expect(screen.getByText('The vent')).toBeDefined();
    expect(screen.queryByText('Cold open')).toBeNull();
  });

  it('can drop what nothing reaches, and show it again', () => {
    let file = diamond();
    file = addElement(file, { name: 'The vault' }).file;
    render(<Harness initial={file} />);
    expect(screen.getByText('The vault')).toBeDefined();
    fireEvent.click(screen.getByText('Show what nothing reaches'));
    expect(screen.queryByText('The vault')).toBeNull();
  });
});

describe('where the room is offered', () => {
  /**
   * **Absent rather than greyed.** A screenplay has no graph and never will,
   * and a disabled item says *not yet* about something that is not coming.
   */
  it('is in the Window menu of a game and nowhere else', () => {
    const items = (format: Parameters<typeof menusFor>[0]) =>
      menusFor(format)
        .flatMap((menu) => menu.items)
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map((item) => item.command);

    expect(items('game')).toContain('window.narrative');
    expect(items('screenplay')).not.toContain('window.narrative');
    expect(items('novel')).not.toContain('window.narrative');
    expect(items(null)).not.toContain('window.narrative');
  });
});

describe('what a change to the graph does', () => {
  /** The whole claim of stage 4, from the screen's end. */
  it('moves a card without anybody arranging it', () => {
    const file = diamond();
    const before = elementsOf(file).length;
    render(<Harness initial={file} />);

    fireEvent.click(screen.getByText('Cold open'));
    fireEvent.click(screen.getByTitle('Draw a connection: press this, then the node it leads to'));
    fireEvent.click(screen.getByText('The bridge'));

    // Nothing was dragged and no position was written; the bridge is now one
    // step from the start rather than two.
    expect(elementsOf(file).length).toBe(before);
    expect(choicesOf(file)).toHaveLength(2);
    expect(screen.getByText('3 nodes · 3 connections · 1 converging.')).toBeDefined();
  });
});
