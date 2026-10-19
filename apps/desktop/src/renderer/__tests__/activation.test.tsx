// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { NOT_ACTIVATED_NOTICE, type DeskStanding } from '@vcwriter/domain';
import { ACTIVATED_EVENT, useWritingAccess } from '../use-writing-access';
import { WritingNotice } from '../components/WritingNotice';
import { ActivationDialog } from '../components/ActivationDialog';

/**
 * Read-only until activated (addendum 41 §10, from Ken).
 *
 * The rule is the domain's and is pinned there. What is pinned here is what
 * the writer meets: an unactivated copy refuses to write and says why, the
 * notice offers *Activate* rather than *Renew*, and activating from the dialog
 * makes the window writable without a restart.
 */

const host = (activated: boolean | null | undefined, standing: DeskStanding | null = null) => {
  const api: Record<string, unknown> = {
    licenseStanding: vi.fn(async () => ({ ok: true, data: standing })),
    activateLicense: vi.fn(async () => ({ ok: true, data: { activated: true } })),
  };
  if (activated !== undefined) api.licenseActivated = vi.fn(async () => ({ ok: true, data: activated }));
  (window as unknown as { vcwriter: unknown }).vcwriter = api;
  return api;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as unknown as { vcwriter?: unknown }).vcwriter;
});

const accessOn = async () => {
  const seen = renderHook(() => useWritingAccess());
  await act(async () => undefined);
  return seen;
};

describe('a computer that was never activated', () => {
  it('cannot be written in, and says why', async () => {
    host(false);
    const seen = await accessOn();
    expect(seen.result.current.writable).toBe(false);
    expect(seen.result.current.needsActivation).toBe(true);
    expect(seen.result.current.notice).toBe(NOT_ACTIVATED_NOTICE);
  });

  it('is writable where the host does not licence writing', async () => {
    // The browser preview answers null; an older host has no such method.
    for (const answer of [null, undefined]) {
      host(answer);
      const seen = await accessOn();
      expect(seen.result.current.writable).toBe(true);
      expect(seen.result.current.needsActivation).toBe(false);
      seen.unmount();
    }
  });

  it('becomes writable the moment it is activated, without a restart', async () => {
    const api = host(false);
    const seen = await accessOn();
    expect(seen.result.current.writable).toBe(false);
    api.licenseActivated = vi.fn(async () => ({ ok: true, data: true }));
    await act(async () => {
      window.dispatchEvent(new Event(ACTIVATED_EVENT));
    });
    expect(seen.result.current.writable).toBe(true);
  });
});

describe('the notice', () => {
  it('offers Activate, not Renew', () => {
    const onActivate = vi.fn();
    render(
      <WritingNotice
        access={{
          writable: false,
          notice: NOT_ACTIVATED_NOTICE,
          warning: false,
          needsActivation: true,
          recheck: () => undefined,
          checking: false,
        }}
        onActivate={onActivate}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Renew' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    expect(onActivate).toHaveBeenCalled();
  });
});

describe('the activation dialog', () => {
  it('asks a signed-out writer to sign in first', () => {
    host(false);
    render(
      <ActivationDialog
        open
        account={{ configured: true, signedIn: false, email: null }}
        onSignedIn={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate this computer' })).toBeNull();
  });

  it('activates a signed-in writer with one button, no serial needed', async () => {
    const api = host(false);
    const heard = vi.fn();
    window.addEventListener(ACTIVATED_EVENT, heard);
    render(
      <ActivationDialog
        open
        account={{ configured: true, signedIn: true, email: 'ken@example.com' }}
        onSignedIn={() => undefined}
        onClose={() => undefined}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activate this computer' }));
    });
    expect(api.activateLicense).toHaveBeenCalledWith('');
    expect(heard).toHaveBeenCalled();
    expect(screen.getByText('This computer is activated. You can write.')).toBeTruthy();
    window.removeEventListener(ACTIVATED_EVENT, heard);
  });

  it('says what the server said when no seat is free', async () => {
    const api = host(false);
    api.activateLicense = vi.fn(async () => ({
      ok: true,
      data: { activated: false, message: 'All 2 seats are in use.' },
    }));
    render(
      <ActivationDialog
        open
        account={{ configured: true, signedIn: true, email: 'ken@example.com' }}
        onSignedIn={() => undefined}
        onClose={() => undefined}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activate this computer' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('All 2 seats are in use.');
  });
});
