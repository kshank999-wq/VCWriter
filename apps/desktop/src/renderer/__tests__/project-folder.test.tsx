// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Welcome } from '../components/Welcome';

/**
 * Where it goes, on the page it is set from (addendum 34).
 *
 * The question was always asked — by a save dialog that opened once Create was
 * pressed — so what is pinned here is the half that was missing: that the
 * **page** says where the project will land, that changing it is one press
 * from there, and that a host with no folders says so instead of quietly
 * drawing nothing. The last is the one that fails silently: a row that is
 * absent reads exactly like a feature nobody built (addendum 09 §15).
 */

const api = (over: Record<string, unknown> = {}) => {
  const ok = (data: unknown) => Promise.resolve({ ok: true, data });
  return {
    recentProjects: vi.fn(() => ok([])),
    projectsFolder: vi.fn(() => ok({ path: '/Users/ken/Documents/VC Writer', canChoose: true })),
    chooseProjectsFolder: vi.fn(() => ok({ path: '/Users/ken/Dropbox/Scripts', canChoose: true })),
    ...over,
  };
};

const open = (over: Record<string, unknown> = {}) => {
  const bridge = api(over);
  (window as unknown as { vcwriter: unknown }).vcwriter = bridge;
  const onCreate = vi.fn();
  render(
    <Welcome
      onCreate={onCreate}
      onOpen={vi.fn()}
      onImport={vi.fn()}
      onProjects={vi.fn()}
      onOpenPath={vi.fn()}
      error={null}
    />,
  );
  return { bridge, onCreate };
};

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('the New project page', () => {
  it('says where the project will be written', async () => {
    open();
    await waitFor(() => expect(screen.getByText('/Users/ken/Documents/VC Writer')).toBeTruthy());
    expect(screen.getByText('Where it goes')).toBeTruthy();
  });

  it('names a cloud drive as a folder, which is what one is', async () => {
    open();
    await waitFor(() => expect(screen.getByText(/cloud drive/i)).toBeTruthy());
  });

  it('changes it from here, in one press', async () => {
    const { bridge } = open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change…' })).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: 'Change…' }));
    expect(bridge.chooseProjectsFolder).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('/Users/ken/Dropbox/Scripts')).toBeTruthy());
  });

  it('keeps the folder it had when the picker is dismissed', async () => {
    // A writer who changed their mind has not asked for anything to move.
    const { bridge } = open({
      chooseProjectsFolder: vi.fn(() =>
        Promise.resolve({ ok: true, data: { path: '/Users/ken/Documents/VC Writer', canChoose: true } }),
      ),
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change…' })).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: 'Change…' }));
    expect(bridge.chooseProjectsFolder).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('/Users/ken/Documents/VC Writer')).toBeTruthy());
  });

  it('says where they go where there are no folders, and offers no press', async () => {
    open({ projectsFolder: vi.fn(() => Promise.resolve({ ok: true, data: { path: null, canChoose: false } })) });
    await waitFor(() => expect(screen.getByText(/this browser’s own storage/i)).toBeTruthy());
    // And why there is nothing to press, rather than a row drawing nothing.
    expect(screen.getByText(/choosing where they go is the desktop/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change…' })).toBeNull();
  });

  it('stands between the format and the button, being part of making the project', async () => {
    open();
    await waitFor(() => expect(screen.getByText('Where it goes')).toBeTruthy());
    const panel = screen.getByText('New project').closest('section');
    const order = [...(panel?.querySelectorAll('legend, button.primary') ?? [])].map((node) =>
      (node.textContent ?? '').trim(),
    );
    expect(order).toEqual(['Format', 'Where it goes', 'Create project']);
  });

  it('asks the host rather than drawing a folder of its own before it answers', () => {
    // A guessed path on the screen would be a second answer to the one
    // question this row exists to settle.
    open({ projectsFolder: vi.fn(() => new Promise(() => undefined)) });
    expect(screen.getByText('Asking this machine…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change…' })).toBeNull();
  });

  it('draws no row at all where the host cannot say, and goes on working', async () => {
    // A bridge without the method must not take the screen down with it
    // (addendum 25 §4g): the rest of the page is somebody's way into their
    // work, and this row is the least of what is on it.
    open({ projectsFolder: undefined });
    await waitFor(() => expect(screen.queryByText('Where it goes')).toBeNull());
    expect(screen.getByRole('button', { name: 'Create project' })).toBeTruthy();
  });
});
