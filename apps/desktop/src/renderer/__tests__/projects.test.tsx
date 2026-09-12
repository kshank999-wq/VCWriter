// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectEntry } from '@vcwriter/domain';
import { ProjectsDialog } from '../components/ProjectsDialog';

/**
 * The project list, and the two askings (spec §4).
 *
 * Deleting a project is the one thing in the application that cannot be
 * undone, so what is worth testing is not that a row renders: it is that
 * **nothing is deleted by one click**, that the question names the project,
 * and that the project you have open is refused outright rather than handled.
 */

afterEach(cleanup);

const entry = (over: Partial<ProjectEntry> = {}): ProjectEntry => ({
  path: '/home/ken/blackout.vcw',
  title: 'Blackout',
  savedAt: '2026-09-10T10:00:00.000Z',
  sizeBytes: 48_000,
  missing: false,
  ...over,
});

const bridge = (entries: ProjectEntry[], deleted: { path?: string } = {}) => {
  const deleteProject = vi.fn(async (path: string) => {
    deleted.path = path;
    return { ok: true, data: { deleted: true, recoverable: true } };
  });
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    listProjects: vi.fn().mockResolvedValue({ ok: true, data: entries }),
    deleteProject,
  };
  return { deleteProject };
};

const show = (entries: ProjectEntry[], openPath: string | null = null) =>
  render(
    <ProjectsDialog
      open
      onClose={() => undefined}
      openPath={openPath}
      bin={{ name: 'Trash', recoverable: true }}
    />,
  );

describe('the list', () => {
  it('says what each project is, not where its file lives', async () => {
    bridge([entry(), entry({ path: '/home/ken/docks.vcw', title: 'The Docks' })]);
    show([]);

    expect(await screen.findByText('Blackout')).toBeTruthy();
    expect(screen.getByText('The Docks')).toBeTruthy();
    expect(screen.queryByText('/home/ken/blackout.vcw')).toBeNull();
  });

  it('says so when there is nothing on the machine yet', async () => {
    bridge([]);
    show([]);
    expect(await screen.findByText(/No projects on this machine yet/)).toBeTruthy();
  });

  it('keeps a file that has gone missing, because the row is the way to be rid of it', async () => {
    bridge([entry({ missing: true })]);
    show([]);
    expect(await screen.findByText('Blackout')).toBeTruthy();
    expect(screen.getByText(/missing/)).toBeTruthy();
  });
});

describe('nothing is deleted by one click', () => {
  it('asks, naming the project, and deletes nothing until it is answered', async () => {
    const seen = {} as { path?: string };
    const { deleteProject } = bridge([entry()], seen);
    show([]);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Blackout' }));
    expect(await screen.findByText('Delete “Blackout”?')).toBeTruthy();
    expect(deleteProject).not.toHaveBeenCalled();

    // And says where it goes, in this machine's word for it.
    expect(screen.getByText(/goes to the Trash/)).toBeTruthy();
  });

  it('keeps it when that is the answer', async () => {
    const { deleteProject } = bridge([entry()]);
    show([]);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Blackout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    await waitFor(() => expect(screen.queryByText('Delete “Blackout”?')).toBeNull());
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it('deletes it only when the second question is answered on purpose', async () => {
    const seen = {} as { path?: string };
    const { deleteProject } = bridge([entry()], seen);
    show([]);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Blackout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete it' }));

    await waitFor(() => expect(deleteProject).toHaveBeenCalledTimes(1));
    expect(seen.path).toBe('/home/ken/blackout.vcw');
    // And says what became of it, rather than leaving the writer guessing.
    expect(await screen.findByText(/is in the Trash/)).toBeTruthy();
  });
});

describe('the one that cannot go', () => {
  it('is the project this window has open, and it says why', async () => {
    bridge([entry()]);
    show([], '/home/ken/blackout.vcw');

    const button = await screen.findByRole('button', { name: 'Delete Blackout' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Close it first/)).toBeTruthy();
  });
});
