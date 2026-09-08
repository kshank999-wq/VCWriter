// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addResearchItem,
  addSetupPayoff,
  createProjectFile,
  type ProjectFile,
} from '@vcwriter/domain';
import { SetupsPanel } from '../components/SetupsPanel';

/**
 * Rendering smoke tests for the research and setups panels.
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
