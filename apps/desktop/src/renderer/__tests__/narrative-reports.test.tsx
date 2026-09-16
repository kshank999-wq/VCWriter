// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addChoice, addElement, createProjectFile, type ProjectFile } from '@vcwriter/domain';
import { Reports } from '../components/Reports';
import { menusFor } from '../menus';

/**
 * §18's reports on the screen (addendum 18 stage 9).
 *
 * The tab is **absent rather than greyed** on a format with no graph, and
 * every table is the same reading the map and the validator draw — so what
 * these hold is that the screen says what the graph says.
 */

afterEach(cleanup);

const options = { includeBeatTitles: false } as never;

const game = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Reactor', format: 'game' });
  const desk = addElement(file, { name: 'The desk' });
  file = desk.file;
  const door = addElement(file, { name: 'The server door' });
  file = door.file;
  file = addChoice(file, { elementId: desk.element.id, name: 'Go through', toElementId: door.element.id }).file;
  return file;
};

const show = (file: ProjectFile) =>
  render(
    <Reports
      file={file}
      open="narrative"
      onClose={() => undefined}
      onTab={() => undefined}
      printOptions={options}
      onShowUnusedResearch={() => undefined}
      onExportNarrative={() => undefined}
    />,
  );

describe('where the reports are offered', () => {
  /** Absent rather than greyed: a screenplay has no graph to report on. */
  it('is in the Reports menu of a game and nowhere else', () => {
    const items = (format: Parameters<typeof menusFor>[0]) =>
      menusFor(format)
        .flatMap((menu) => menu.items)
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map((item) => item.command);
    expect(items('game')).toContain('reports.narrative');
    expect(items('screenplay')).not.toContain('reports.narrative');
    expect(items(null)).not.toContain('reports.narrative');
  });

  it('shows the tab on a game', () => {
    show(game());
    expect(screen.getByRole('button', { name: 'Narrative design' })).toBeDefined();
  });
});

describe('what the tables say', () => {
  it('draws every report, with what is empty said rather than blank', () => {
    show(game());
    expect(screen.getByRole('heading', { name: 'Choices and consequences' })).toBeDefined();
    expect(screen.getByText('WHEN always → GO TO The server door')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Branches and convergence' })).toBeDefined();
    expect(screen.getByText('Nothing branches and nothing converges: this is a straight line.')).toBeDefined();
  });

  /**
   * Found by looking: the story figures were the *else* of the writing tab, so
   * a third tab drew them underneath its own tables.
   */
  it('does not draw the story statistics underneath it', () => {
    show(game());
    expect(screen.queryByText(/Pages are the pages this would print/)).toBeNull();
    expect(screen.queryByText('Setups unpaid')).toBeNull();
  });

  it('counts what the export would carry', () => {
    show(game());
    expect(screen.getByText(/2 nodes · 1 choice · 0 states and resources, with their own ids\./)).toBeDefined();
  });

  it('copies a report as CSV', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    show(game());
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy as CSV' })[0]!);
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]![0]).toContain('Node,Kind,Scene,Reachable');
  });

  it('copies the design as JSON, with the ids in it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const file = game();
    show(file);
    fireEvent.click(screen.getByRole('button', { name: 'Copy the design as JSON' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const parsed = JSON.parse(writeText.mock.calls[0]![0] as string);
    expect(parsed.format).toBe('vcwriter.narrative');
    expect(parsed.elements[0].id).toBe(file.narrativeElements[0]!.id);
  });
});
