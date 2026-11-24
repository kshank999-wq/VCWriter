// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Updates, as VC Composer has them (addendum 48): Help → Check for Updates,
 * the quiet look after start-up, and the start after an install.
 */

beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(cleanup);

const offer = {
  ok: true,
  data: {
    currentVersion: '1.0.60',
    decision: { action: 'update', version: '1.0.61', releaseNotes: 'Updates install themselves.', sha256: 'abc' },
  },
};

let api: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.resetModules();
  api = {
    checkForUpdate: vi.fn(async () => offer),
    downloadUpdate: vi.fn(async () => ({ ok: true, data: { path: '/u/VC-Writer-1.0.61.exe', version: '1.0.61', verified: true } })),
    installUpdate: vi.fn(async () => ({ ok: true, data: true })),
    updateState: vi.fn(async () => ({ ok: true, data: { currentVersion: '1.0.60', automatic: true, ready: null, report: null } })),
    setAutomaticUpdates: vi.fn(async () => ({ ok: true, data: true })),
    openUpdateInstaller: vi.fn(async () => ({ ok: true, data: true })),
    showUpdateLog: vi.fn(async () => ({ ok: true, data: true })),
    onUpdateProgress: vi.fn(() => () => undefined),
  };
  (window as unknown as { vcwriter: unknown }).vcwriter = api;
});

const load = async (signedIn = true) => {
  const module = await import('../updates');
  const saveNow = vi.fn(async () => undefined);
  const signIn = vi.fn();
  module.updates.configure({ signedIn: () => signedIn, saved: () => true, saveNow, signIn });
  return { ...module, saveNow, signIn };
};

describe('Help → Check for Updates', () => {
  it('says what is new, then downloads, saves and installs on Install and Restart', async () => {
    const { updates, UpdateDialog, saveNow } = await load();
    render(<UpdateDialog />);
    await act(async () => updates.openDialog());
    expect(await screen.findByText('VC Writer 1.0.61 is available. You have 1.0.60.')).toBeTruthy();
    expect(screen.getByText('Updates install themselves.')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Install updates automatically/ })).toHaveProperty('checked', true);

    await userEvent.click(screen.getByRole('button', { name: 'Install and Restart' }));
    await waitFor(() => expect(api['installUpdate']).toHaveBeenCalled());
    expect(api['downloadUpdate']).toHaveBeenCalledWith({ expectedSha256: 'abc', version: '1.0.61' });
    expect(saveNow).toHaveBeenCalled();
  });

  it('asks a writer who is signed out to sign in, as the download goes through the account', async () => {
    const { updates, UpdateDialog, signIn } = await load(false);
    render(<UpdateDialog />);
    await act(async () => updates.openDialog());
    await userEvent.click(await screen.findByRole('button', { name: 'Sign In to Install…' }));
    expect(signIn).toHaveBeenCalled();
    expect(api['downloadUpdate']).not.toHaveBeenCalled();
  });

  it('says so when this copy is up to date', async () => {
    api['checkForUpdate']!.mockResolvedValue({ ok: true, data: { currentVersion: '1.0.61', decision: { action: 'up_to_date' } } });
    const { updates, UpdateDialog } = await load();
    render(<UpdateDialog />);
    await act(async () => updates.openDialog());
    expect(await screen.findByText('VC Writer 1.0.61 is up to date.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Install and Restart' })).toHaveProperty('disabled', true);
  });
});

describe('by itself', () => {
  it('downloads in the background and, with the writer at the keys, waits for the next start', async () => {
    const { updates, UpdateNotice } = await load();
    render(<UpdateNotice />);
    await act(async () => {
      await updates.start();
      await updates.lookQuietly();
    });
    expect(api['downloadUpdate']).toHaveBeenCalled();
    expect(api['installUpdate']).not.toHaveBeenCalled();
    expect(
      screen.getByText('VC Writer 1.0.61 is downloaded: it installs by itself the next time VC Writer starts.'),
    ).toBeTruthy();
    // And can go in now, if the writer says so.
    await userEvent.click(screen.getByRole('button', { name: 'Install and Restart' }));
    await waitFor(() => expect(api['installUpdate']).toHaveBeenCalled());
  });

  it('installs one downloaded last time as the app starts', async () => {
    api['updateState']!.mockResolvedValue({ ok: true, data: { currentVersion: '1.0.60', automatic: true, ready: '1.0.61', report: null } });
    const { updates } = await load();
    await act(async () => updates.start());
    expect(api['installUpdate']).toHaveBeenCalled();
    expect(api['checkForUpdate']).not.toHaveBeenCalled();
  });

  it('with automatic installs off, offers it instead', async () => {
    api['updateState']!.mockResolvedValue({ ok: true, data: { currentVersion: '1.0.60', automatic: false, ready: '1.0.61', report: null } });
    const { updates, UpdateNotice } = await load();
    render(<UpdateNotice />);
    await act(async () => updates.start());
    expect(api['installUpdate']).not.toHaveBeenCalled();
    expect(screen.getByText('VC Writer 1.0.61 is downloaded and ready to install.')).toBeTruthy();
  });
});

describe('the start after an install', () => {
  it('says it went in', async () => {
    api['updateState']!.mockResolvedValue({
      ok: true,
      data: { currentVersion: '1.0.61', automatic: true, ready: null, report: { outcome: 'installed', version: '1.0.61', reason: null, log: null, installer: false } },
    });
    const { updates, UpdateNotice } = await load();
    render(<UpdateNotice />);
    await act(async () => updates.start());
    expect(screen.getByText('VC Writer is updated to 1.0.61.')).toBeTruthy();
  });

  it('says it did not, why, and offers the installer by hand', async () => {
    api['updateState']!.mockResolvedValue({
      ok: true,
      data: {
        currentVersion: '1.0.60',
        automatic: true,
        ready: null,
        report: { outcome: 'failed', version: '1.0.61', reason: 'the new copy could not be written', log: '/u/install.log', installer: true },
      },
    });
    const { updates, UpdateNotice } = await load();
    render(<UpdateNotice />);
    await act(async () => updates.start());
    expect(
      screen.getByText(
        'The update to VC Writer 1.0.61 did not install (the new copy could not be written). You can run its installer by hand.',
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Run the installer' }));
    expect(api['openUpdateInstaller']).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Show what happened' }));
    expect(api['showUpdateLog']).toHaveBeenCalled();
  });
});
