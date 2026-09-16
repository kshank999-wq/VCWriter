// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addChoice,
  addElement,
  addState,
  createProjectFile,
  updateElement,
  type ProjectFile,
} from '@vcwriter/domain';
import { NarrativeMapWindow } from '../components/NarrativeMapWindow';

/**
 * Endings and the outcome matrix on the screen (addendum 18 stage 8 — §11).
 *
 * The matrix is read off the rules, so what these hold is that it says what
 * the rules say — and that a requirement and a weight stay apart, which is
 * §11's own sentence.
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

const twoEndings = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Reactor', format: 'game' });
  const trust = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
  file = trust.file;
  const start = addElement(file, { name: 'Cold open' });
  file = start.file;
  const stays = addElement(file, { name: 'She stays' });
  file = updateElement(stays.file, stays.element.id, {
    kind: 'ending',
    contributors: [
      { condition: { subject: 'state', subjectId: trust.state.id as string, op: 'at_least', value: '40' }, weight: 20, note: '' },
    ],
    threshold: 20,
  });
  const leaves = addElement(file, { name: 'She leaves' });
  file = updateElement(leaves.file, leaves.element.id, {
    kind: 'ending',
    conditions: {
      join: 'all',
      conditions: [{ subject: 'state', subjectId: trust.state.id as string, op: 'at_most', value: '10' }],
      groups: [],
    },
  });
  for (const to of [stays.element.id, leaves.element.id]) {
    file = addChoice(file, { elementId: start.element.id, toElementId: to }).file;
  }
  return file;
};

const endings = () => fireEvent.click(screen.getByTitle('What decides each ending, side by side'));

describe('the matrix', () => {
  it('draws a column per ending and a row per thing that decides one', () => {
    render(<Harness initial={twoEndings()} />);
    endings();
    expect(screen.getByText('2 endings · 1 scored · 1 thing decides them.')).toBeDefined();
    expect(screen.getByRole('columnheader', { name: /She stays/ })).toBeDefined();
    expect(screen.getByRole('rowheader', { name: 'trust_mara' })).toBeDefined();
  });

  /** §11's own sentence: *this is impossible without it* vs *this counts for twenty*. */
  it('keeps a requirement and a weight apart', () => {
    const { container } = render(<Harness initial={twoEndings()} />);
    endings();
    expect(screen.getByText('+20 if trust_mara is at least 40')).toBeDefined();
    expect(screen.getByText('needs trust_mara is at most 10')).toBeDefined();
    expect(container.querySelectorAll('.ending-matrix td.weighs')).toHaveLength(1);
    expect(container.querySelectorAll('.ending-matrix td.requires')).toHaveLength(1);
  });

  it('says which is scored and which is reached either way', () => {
    render(<Harness initial={twoEndings()} />);
    endings();
    expect(screen.getByText('needs 20')).toBeDefined();
    expect(screen.getByText('either way')).toBeDefined();
  });

  it('says there are no endings rather than drawing an empty grid', () => {
    render(<Harness initial={createProjectFile({ title: 'x', format: 'game' })} />);
    endings();
    expect(screen.getByText('No endings yet. A node marked as an ending is one.')).toBeDefined();
  });
});

describe('what earns an ending', () => {
  /** Absent rather than greyed: a scene has no ending to weigh. */
  it('is offered on an ending and nowhere else', () => {
    render(<Harness initial={twoEndings()} />);
    fireEvent.click(screen.getByText('Cold open'));
    expect(screen.queryByRole('heading', { name: 'What earns it' })).toBeNull();

    fireEvent.click(screen.getByText('She stays'));
    expect(screen.getByRole('heading', { name: 'What earns it' })).toBeDefined();
    expect(screen.getByLabelText('The score this ending needs')).toHaveProperty('value', '20');
  });

  it('adds a contributor with the same control the rules use', () => {
    render(<Harness initial={twoEndings()} />);
    fireEvent.click(screen.getByText('She leaves'));
    // Unscored until something counts towards it.
    expect(screen.getByText('Nothing counts towards it, so reaching it is enough.')).toBeDefined();
    expect(screen.queryByLabelText('The score this ending needs')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '+ Contributor' }));
    expect(screen.getByLabelText('The score this ending needs')).toBeDefined();
    // And it turns up in the matrix, read off the rule.
    endings();
    expect(screen.getAllByText(/\+10 if trust_mara/).length).toBe(1);
  });
});
