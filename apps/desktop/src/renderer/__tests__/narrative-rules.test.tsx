// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { addChoice, addElement, addState, createProjectFile, type ProjectFile } from '@vcwriter/domain';
import { NarrativeMapWindow } from '../components/NarrativeMapWindow';

/**
 * The rule builder on the screen (addendum 18 stage 5 — §15.2, §15.3).
 *
 * The claim under test is that a rule is built from controls and read back as
 * a sentence, with no text anybody has to get right: there is no box to type
 * an expression into, and what the sentence says is what the evaluator will
 * run, because they are the same object.
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

const withAKey = (): ProjectFile => {
  let file = game();
  file = addState(file, { key: 'has_key', kind: 'flag' }).file;
  const desk = addElement(file, { name: 'The desk' });
  file = desk.file;
  const room = addElement(file, { name: 'The safe room' });
  file = room.file;
  file = addChoice(file, { elementId: desk.element.id, name: 'Go through', toElementId: room.element.id }).file;
  return file;
};

describe('defining what the player carries', () => {
  /** The builder was useless without it: every condition asks about one. */
  it('makes a state, and the rule builder can then ask about it', () => {
    render(<Harness initial={game()} />);
    fireEvent.click(screen.getByTitle('The states and resources every rule asks about'));
    fireEvent.click(screen.getByRole('button', { name: '+ State' }));
    fireEvent.change(screen.getByLabelText("The state's name"), { target: { value: 'trust_mara' } });
    expect(screen.getByDisplayValue('trust_mara')).toBeDefined();
  });

  it('says out loud that a rename reaches every rule', () => {
    render(<Harness initial={game()} />);
    fireEvent.click(screen.getByTitle('The states and resources every rule asks about'));
    expect(screen.getByText(/a rule holds the state, not its name/)).toBeDefined();
  });
});

describe('WHEN', () => {
  it('builds a condition from controls and reads it back as a sentence', () => {
    render(<Harness initial={withAKey()} />);
    fireEvent.click(screen.getByText('The safe room'));

    const being = screen.getByRole('heading', { name: 'Being here' }).parentElement!;
    fireEvent.click(within(being).getAllByRole('button', { name: '+ Condition' })[0]!);
    // A flag has two values, so the control that picks one is a list rather
    // than a box somebody can spell wrong.
    fireEvent.change(within(being).getAllByLabelText('The value')[0]!, { target: { value: 'true' } });

    expect(screen.getByText('has_key is true')).toBeDefined();
  });

  it('says nothing is asked rather than showing an empty box', () => {
    render(<Harness initial={withAKey()} />);
    fireEvent.click(screen.getByText('The safe room'));
    expect(screen.getAllByText('Nothing asked, so this is open to everybody.').length).toBeGreaterThan(0);
    expect(screen.getByText('Anybody who gets here may be here.')).toBeDefined();
  });

  it('tells a designer with no states what to do first', () => {
    render(<Harness initial={addElement(game(), { name: 'The desk' }).file} />);
    fireEvent.click(screen.getByText('The desk'));
    expect(screen.getByText('Nothing to ask about yet — define a state or a resource first.')).toBeDefined();
    // And the control that would make a broken condition is absent, not greyed.
    expect(screen.queryByRole('button', { name: '+ Condition' })).toBeNull();
  });
});

describe('the three lines', () => {
  it('reads a choice back as WHEN / DO / GO TO', () => {
    render(<Harness initial={withAKey()} />);
    fireEvent.click(screen.getByText('The desk'));
    expect(screen.getByText('WHEN always → GO TO The safe room')).toBeDefined();
  });

  it('builds DO from controls, and the order is the rule', () => {
    render(<Harness initial={withAKey()} />);
    fireEvent.click(screen.getByText('The desk'));
    fireEvent.click(screen.getByLabelText('The rule for Go through'));

    const open = screen.getByText('DO').parentElement!;
    fireEvent.change(within(open).getByLabelText('Add an effect'), { target: { value: 'set' } });
    fireEvent.change(within(open).getAllByLabelText('The value')[0]!, { target: { value: 'true' } });
    expect(screen.getByText('WHEN always → DO set has_key to true → GO TO The safe room')).toBeDefined();

    fireEvent.change(within(open).getByLabelText('Add an effect'), { target: { value: 'add' } });
    fireEvent.change(within(open).getAllByLabelText('The value')[1]!, { target: { value: '5' } });
    expect(
      screen.getByText('WHEN always → DO set has_key to true, then add 5 to has_key → GO TO The safe room'),
    ).toBeDefined();

    // Moving one changes what the rule does, which is why it can be moved.
    fireEvent.click(within(open).getAllByLabelText('Move this earlier')[1]!);
    expect(
      screen.getByText('WHEN always → DO add 5 to has_key, then set has_key to true → GO TO The safe room'),
    ).toBeDefined();
  });

  it('sets where a choice goes, including nowhere', () => {
    render(<Harness initial={withAKey()} />);
    fireEvent.click(screen.getByText('The desk'));
    fireEvent.click(screen.getByLabelText('The rule for Go through'));
    fireEvent.change(screen.getByLabelText('Where this choice leads'), { target: { value: '' } });
    expect(screen.getByText('WHEN always → stay here')).toBeDefined();
  });
});

describe('what is deliberately not here', () => {
  /** §9's *logic without code*: there is nothing to type and nothing to parse. */
  it('has no box to write an expression in', () => {
    const { container } = render(<Harness initial={withAKey()} />);
    fireEvent.click(screen.getByText('The desk'));
    fireEvent.click(screen.getByLabelText('The rule for Go through'));

    const placeholders = [...container.querySelectorAll('input, textarea')].map((one) =>
      one.getAttribute('placeholder'),
    );
    expect(placeholders.some((one) => /script|code|expression|formula/i.test(one ?? ''))).toBe(false);
  });

  /**
   * The obvious feature, and it would be a lie: at authoring time there is no
   * state, because the player arrives carrying whatever their path gave them.
   */
  it('never says whether the rule is true right now', () => {
    render(<Harness initial={withAKey()} />);
    fireEvent.click(screen.getByText('The desk'));
    fireEvent.click(screen.getByLabelText('The rule for Go through'));
    for (const word of [/currently true/i, /currently false/i, /satisfied now/i, /would pass/i]) {
      expect(screen.queryByText(word)).toBeNull();
    }
  });
});
