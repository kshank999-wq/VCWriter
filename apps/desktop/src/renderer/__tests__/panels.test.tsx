// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addResearchItem,
  addSetupPayoff,
  beatsInStoryOrder,
  createProjectFile,
  type ProjectFile,
} from '@vcwriter/domain';
import { StructureBoard } from '../components/StructureBoard';
import { ResearchPanel } from '../components/ResearchPanel';
import { SetupsPanel } from '../components/SetupsPanel';

/**
 * Rendering smoke tests for the Phase 2 panels.
 *
 * These exercise the wiring a reviewer cannot check by reading — that each
 * panel mounts, that the buttons reach the domain mutations, and that the
 * reversible states really do come back — without pretending to be a
 * substitute for using the app.
 */

afterEach(cleanup);

/** Hosts a panel with real project state so a click's effect is observable. */
function Harness({
  initial,
  children,
}: {
  initial: ProjectFile;
  children: (file: ProjectFile, update: (mutate: (current: ProjectFile) => ProjectFile) => void) => React.ReactNode;
}) {
  const [file, setFile] = useState(initial);
  return <>{children(file, (mutate) => setFile((current) => mutate(current)))}</>;
}

describe('structure board', () => {
  const project = () => createProjectFile({ title: 'Lighthouse', format: 'screenplay' });

  it('draws lanes, scenes and beats, and adds a beat inside its scene', () => {
    render(
      <Harness initial={project()}>
        {(file, update) => (
          <StructureBoard
            file={file}
            selectedBeatId={beatsInStoryOrder(file)[0]?.id ?? null}
            onSelectBeat={() => undefined}
            onUpdate={update}
          />
        )}
      </Harness>,
    );

    expect(screen.getByText('Main Plot')).toBeDefined();
    expect(screen.getByText('Opening beat')).toBeDefined();

    fireEvent.click(screen.getByTitle('Add beat'));
    expect(screen.getAllByText(/beat/i).length).toBeGreaterThan(1);
    expect(screen.getByText('New beat')).toBeDefined();
  });

  it('collapses a lane and brings it back', () => {
    render(
      <Harness initial={project()}>
        {(file, update) => (
          <StructureBoard file={file} selectedBeatId={null} onSelectBeat={() => undefined} onUpdate={update} />
        )}
      </Harness>,
    );

    fireEvent.click(screen.getByLabelText('Collapse Main Plot'));
    expect(screen.queryByText('Opening beat')).toBeNull();

    fireEvent.click(screen.getByLabelText('Expand Main Plot'));
    expect(screen.getByText('Opening beat')).toBeDefined();
  });

  it('renames a lane in place', () => {
    render(
      <Harness initial={project()}>
        {(file, update) => (
          <StructureBoard file={file} selectedBeatId={null} onSelectBeat={() => undefined} onUpdate={update} />
        )}
      </Harness>,
    );

    fireEvent.click(screen.getByText('Main Plot'));
    const input = screen.getByLabelText('Lane name');
    fireEvent.change(input, { target: { value: 'A story' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('A story')).toBeDefined();
  });
});

describe('research panel', () => {
  const projectWithNote = () => {
    const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    return addResearchItem(file, { categoryId: ideas.id, title: 'A revolver in the drawer' });
  };

  it('moves a note to used and restores it, with the record surviving both', () => {
    render(
      <Harness initial={projectWithNote()}>
        {(file, update) => <ResearchPanel file={file} currentBeatId={null} onUpdate={update} />}
      </Harness>,
    );

    // The seeded default categories are present, Ideas among them (§7.1).
    fireEvent.click(screen.getByText('Ideas'));
    fireEvent.click(screen.getByText('A revolver in the drawer'));
    fireEvent.click(screen.getByRole('button', { name: /mark used/i }));

    // Gone from the working inventory…
    expect(screen.queryByText('A revolver in the drawer')).toBeNull();
    expect(screen.getByRole('tab', { name: /unused \(0\)/i })).toBeDefined();

    // …but present under Used, and restorable.
    fireEvent.click(screen.getByRole('tab', { name: /used \(1\)/i }));
    fireEvent.click(screen.getByText('A revolver in the drawer'));
    fireEvent.click(screen.getByRole('button', { name: /restore to unused/i }));

    fireEvent.click(screen.getByRole('tab', { name: /unused \(1\)/i }));
    expect(screen.getByText('A revolver in the drawer')).toBeDefined();
  });

  it('adds a category and keeps archived ones out of the working view', () => {
    render(
      <Harness initial={createProjectFile({ title: 'Lighthouse', format: 'screenplay' })}>
        {(file, update) => <ResearchPanel file={file} currentBeatId={null} onUpdate={update} />}
      </Harness>,
    );

    fireEvent.click(screen.getByTitle('Add category'));
    expect(screen.getByText('New category')).toBeDefined();

    const row = screen.getByText('New category').closest('li')!;
    fireEvent.click(within(row).getByTitle('Archive category'));
    expect(screen.queryByText('New category')).toBeNull();

    fireEvent.click(screen.getByLabelText(/show archived/i));
    expect(screen.getByText('New category')).toBeDefined();
  });
});

describe('setups and payoffs panel', () => {
  it('tracks a setup, records the payoff, then reopens it with the setup intact', () => {
    const initial = addSetupPayoff(createProjectFile({ title: 'Lighthouse', format: 'screenplay' }), {
      title: 'The revolver',
    });

    render(
      <Harness initial={initial}>
        {(file, update) => <SetupsPanel file={file} currentBeatId={null} onUpdate={update} />}
      </Harness>,
    );

    fireEvent.change(screen.getByLabelText('New setup'), { target: { value: 'Drawer opens in act one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add setup' }));
    expect(screen.getByDisplayValue('Drawer opens in act one')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Payoff'), { target: { value: 'Fired in the finale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record payoff' }));
    expect(screen.getByText('Fired in the finale')).toBeDefined();
    expect(screen.getByRole('tab', { name: /active \(1\)/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /reopen/i }));
    // The obligation is outstanding again and its setup point is still there.
    expect(screen.getByLabelText('Payoff')).toBeDefined();
    expect(screen.getByDisplayValue('Drawer opens in act one')).toBeDefined();
  });
});
