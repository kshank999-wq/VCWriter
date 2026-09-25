// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addChoice,
  addElement,
  addObject,
  addVerb,
  createProjectFile,
  dropIntoLane,
  unitsInStoryOrder,
  updateVerb,
  type BeatId,
  type ProjectFile,
} from '@vcwriter/domain';
import { ResearchBody } from '../components/ResearchWindow';
import { Inspector } from '../components/Inspector';
import { NarrativeMapWindow } from '../components/NarrativeMapWindow';
import { NarrativePlayPanel } from '../components/NarrativePlayPanel';

/**
 * Addendum 25 stages 5–7 on the screen: objects, puzzles and places in the
 * Bible, triggers on the scene, choice behaviour and lines on the map, and
 * verbs in the simulator.
 */

afterEach(cleanup);

/** A game with one scene on the spine and a lever placed in it. */
const withLever = () => {
  let file: ProjectFile = { ...createProjectFile({ title: 'The Sunken Vault', format: 'game' }), units: [], beats: [] };
  const door = dropIntoLane(file, { card: 'scene', afterUnitId: null, name: 'The Vault Door' });
  file = door.file;
  const unit = unitsInStoryOrder(file)[0]!;
  const lever = addObject(file, { name: 'Rusted Lever', states: ['down', 'up'], placedAt: [unit.id as string] });
  file = lever.file;
  const pull = addVerb(file, lever.object.id, { name: 'Pull' });
  file = updateVerb(pull.file, lever.object.id, pull.verb.id, {
    effects: [{ kind: 'set', targetId: lever.object.stateId as string, value: 'up', timing: 'immediate', note: '' }],
  });
  return { file, beatId: door.element.boundBeatId as BeatId, nodeId: door.element.id };
};

function Harnessed<P extends { file: ProjectFile; onUpdate: (mutate: (current: ProjectFile) => ProjectFile) => void }>({
  initial,
  view,
}: {
  initial: ProjectFile;
  view: (props: { file: ProjectFile; onUpdate: P['onUpdate'] }) => JSX.Element;
}) {
  const [file, setFile] = useState(initial);
  return view({ file, onUpdate: (mutate) => setFile((current) => mutate(current)) });
}

describe('the Game Bible, stages 5 and 6', () => {
  it('makes an object, names its states, places it and gives it a verb', () => {
    const start = withLever().file;
    render(
      <Harnessed
        initial={start}
        view={({ file, onUpdate }) => <ResearchBody file={file} currentBeatId={null} onClose={() => undefined} onUpdate={onUpdate} />}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Interactive objects/ }));
    const lever = screen.getByRole('button', { name: /Rusted Lever/ });
    expect(lever.textContent).toContain('1 thing to do');
    expect(lever.textContent).toContain('Used');
    fireEvent.click(lever);
    expect(screen.getByDisplayValue('down, up')).toBeDefined();
    expect(screen.getByText('Rules ask about it as rusted_lever_state.')).toBeDefined();
    expect(screen.getByLabelText('Scene 1 · The Vault Door')).toHaveProperty('checked', true);

    fireEvent.click(screen.getByRole('button', { name: '+ Object' }));
    expect(screen.getAllByRole('button', { name: /Untitled/ }).length).toBe(1);
  });

  it('shows an object’s state as the object’s, not a state to remove', () => {
    render(
      <Harnessed
        initial={withLever().file}
        view={({ file, onUpdate }) => <ResearchBody file={file} currentBeatId={null} onClose={() => undefined} onUpdate={onUpdate} />}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^State/ }));
    fireEvent.click(screen.getByRole('button', { name: /rusted_lever_state/ }));
    expect(screen.getByText(/It belongs to the object/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Remove this state/ })).toBeNull();
  });

  it('makes a puzzle whose flag rules can ask about', () => {
    render(
      <Harnessed
        initial={withLever().file}
        view={({ file, onUpdate }) => <ResearchBody file={file} currentBeatId={null} onClose={() => undefined} onUpdate={onUpdate} />}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Puzzles/ }));
    fireEvent.click(screen.getByRole('button', { name: '+ Puzzle' }));
    fireEvent.click(screen.getByRole('button', { name: /Untitled/ }));
    fireEvent.change(screen.getByPlaceholderText('The Vault Door'), { target: { value: 'The Vault Door' } });
    expect(screen.getByText('Rules ask whether it is solved as the_vault_door_solved.')).toBeDefined();
    expect(screen.getByText('No solution written yet, so it is never checked.')).toBeDefined();
  });
});

describe('a trigger on the scene', () => {
  it('is written in the systemic layer and read back as a rule', () => {
    const { file, beatId } = withLever();
    render(
      <Harnessed
        initial={file}
        view={({ file: now, onUpdate }) => <Inspector file={now} selectedBeatId={beatId} onUpdate={onUpdate} />}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Scene' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Trigger' }));
    fireEvent.change(screen.getByLabelText('The trigger'), { target: { value: 'Water drains' } });
    expect(screen.getByText('WHEN always → DO nothing yet (once)')).toBeDefined();
    // The object placed here is read into the same layer.
    expect(screen.getByText('Pull → set rusted_lever_state to up')).toBeDefined();
  });
});

describe('choices on the map', () => {
  it('can be once only, and a node’s choices can be made mutually exclusive', () => {
    let file = withLever().file;
    const node = file.narrativeElements[0]!;
    file = addChoice(file, { elementId: node.id, name: 'Side with Mara' }).file;
    file = addChoice(file, { elementId: node.id, name: 'Side with the Warden' }).file;
    render(
      <Harnessed
        initial={file}
        view={({ file: now, onUpdate }) => <NarrativeMapWindow file={now} open onClose={() => undefined} onUpdate={onUpdate} />}
      />,
    );
    fireEvent.click(screen.getAllByText('The Vault Door').find((one) => one.closest('.narrmap-card'))!);
    fireEvent.click(screen.getByRole('button', { name: 'Only one of these' }));
    const [first] = screen.getAllByRole('button', { name: /The rule for Side with Mara/ });
    fireEvent.click(first!);
    expect(screen.getByText('WHEN the_vault_door_choice is (nothing) → DO set the_vault_door_choice to Side with Mara → stay here')).toBeDefined();
    expect(screen.getByText('WHEN the_vault_door_choice is (nothing) → DO set the_vault_door_choice to Side with the Warden → stay here')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Only once'));
    expect(screen.getByLabelText('Only once')).toHaveProperty('checked', true);
  });

  it('gives an unbound conversation its own lines', () => {
    const start = withLever().file;
    const talk = addElement(start, { name: 'Mara at the fire', kind: 'conversation' });
    render(
      <Harnessed
        initial={talk.file}
        view={({ file: now, onUpdate }) => <NarrativeMapWindow file={now} open onClose={() => undefined} onUpdate={onUpdate} />}
      />,
    );
    fireEvent.click(screen.getByText('Mara at the fire'));
    fireEvent.click(screen.getByRole('button', { name: '+ Line' }));
    fireEvent.change(screen.getByLabelText('The line'), { target: { value: 'They were here.' } });
    expect(screen.getByDisplayValue('They were here.')).toBeDefined();
  });
});

describe('the simulator', () => {
  it('offers what can be done to the objects here, and remembers it', () => {
    const { file } = withLever();
    render(
      <Harnessed
        initial={file}
        view={({ file: now, onUpdate }) => <NarrativePlayPanel file={now} onUpdate={onUpdate} onClose={() => undefined} />}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Walk it/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pull Rusted Lever' }));
    expect(screen.getAllByText('Pull Rusted Lever').length).toBeGreaterThan(1);
    expect(screen.getByText(/rusted_lever_state = up/)).toBeDefined();
  });
});
