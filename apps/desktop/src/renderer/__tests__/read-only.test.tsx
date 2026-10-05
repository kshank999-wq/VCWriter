// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createProjectFile, updateBeat, type DeskStanding, type ProjectFile } from '@vcwriter/domain';
import { useProject } from '../use-project';
import { useLinkedProject } from '../use-linked-project';
import { useWritingAccess } from '../use-writing-access';
import { WritingNotice } from '../components/WritingNotice';

/**
 * Read-only when the subscription has lapsed (addendum 32 §8, from Ken).
 *
 * What is pinned here is **the act and not the rule** — the rule is
 * `writing-standing.test.ts`', and a program that knows perfectly well it is
 * read-only and takes the keystroke anyway is exactly the fault this would ship
 * with. So each of these asks the question the writer does: did the document
 * change?
 *
 * The satellite has one of its own, deliberately. It applies a mutation
 * **locally before proposing it**, so it is the one window where a missing
 * guard shows as words appearing and then vanishing.
 */

const DAY = 86_400_000;

const LAPSED: DeskStanding = {
  status: 'expired',
  expiresAt: '2026-05-01T00:00:00.000Z',
  checkedAt: new Date().toISOString(),
  // Seen long enough ago that the week is up and it bites now.
  seenLapsedAt: new Date(Date.now() - 30 * DAY).toISOString(),
};

const LIVE: DeskStanding = {
  status: 'active',
  expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
  checkedAt: new Date().toISOString(),
  seenLapsedAt: null,
};

const host = (standing: DeskStanding | null, answers = true) => {
  const api = {
    licenseStanding: vi.fn(async () => (answers ? { ok: true, data: standing } : { ok: false })),
    saveProject: vi.fn(async () => ({ ok: true, data: { contentHash: 'x', written: true } })),
    link: { send: vi.fn(), subscribe: vi.fn(() => () => undefined) },
  };
  (window as unknown as { vcwriter: unknown }).vcwriter = api;
  return api;
};

beforeEach(() => host(null));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as unknown as { vcwriter?: unknown }).vcwriter;
});

/**
 * The workspace's document, on a machine with this standing.
 *
 * The project arrives through `replace`, which is the sync merge's door and
 * takes a whole document — exactly what is wanted, and deliberately **not**
 * guarded by read-only (a merge the writer did not make has nowhere else to
 * land), so the seeding itself cannot be what is refused.
 */
const opened = async (standing: DeskStanding | null) => {
  host(standing);
  const seen = renderHook(() => {
    const access = useWritingAccess();
    return { access, project: useProject(access.writable) };
  });
  // The standing comes from the host, which answers with a promise even where
  // it is only reading a file.
  await act(async () => undefined);
  const file = createProjectFile({ title: 'Lapsed', format: 'screenplay' });
  act(() => seen.result.current.project.replace(file));
  return { seen, beatId: file.beats[0]!.id };
};

const titleNow = (file: ProjectFile | null): string => file?.beats[0]?.title ?? '';

describe('the document on a lapsed copy', () => {
  it('refuses every mutation at the one place they all go through', async () => {
    const { seen, beatId } = await opened(LAPSED);
    expect(seen.result.current.access.writable).toBe(false);
    act(() => {
      seen.result.current.project.update((current) => updateBeat(current, beatId, { title: 'Changed' }));
    });
    expect(titleNow(seen.result.current.project.file)).toBe('Opening beat');
  });

  it('takes the same mutation while the subscription is paid', async () => {
    // The other half of the assertion above: a test that only watched nothing
    // happen would pass against a hook that had stopped working altogether.
    const { seen, beatId } = await opened(LIVE);
    expect(seen.result.current.access.writable).toBe(true);
    act(() => {
      seen.result.current.project.update((current) => updateBeat(current, beatId, { title: 'Changed' }));
    });
    expect(titleNow(seen.result.current.project.file)).toBe('Changed');
  });

  it('offers no undo, there being nothing to take back', async () => {
    const { seen, beatId } = await opened(LAPSED);
    act(() => {
      seen.result.current.project.update((current) => updateBeat(current, beatId, { title: 'Changed' }));
    });
    expect(seen.result.current.project.canUndo).toBe(false);
    expect(seen.result.current.project.canRedo).toBe(false);
  });

  it('writes where the host has heard nothing at all', async () => {
    // A fresh install, a copy that has not signed in, an account with no
    // licence, or the browser preview — every one of which has always been
    // writable. An absence is never read as a lapse.
    const { seen, beatId } = await opened(null);
    act(() => {
      seen.result.current.project.update((current) => updateBeat(current, beatId, { title: 'Changed' }));
    });
    expect(titleNow(seen.result.current.project.file)).toBe('Changed');
  });

  it('writes where the host could not answer', async () => {
    // Offline, signed out, a 500. None of them is evidence that anybody has
    // stopped paying.
    host(LAPSED, false);
    const seen = renderHook(() => useWritingAccess());
    await act(async () => undefined);
    expect(seen.result.current.writable).toBe(true);
  });
});

describe('a room on the other monitor', () => {
  it('asks the machine for itself rather than asking the workspace', async () => {
    host(LAPSED);
    const seen = renderHook(() => {
      const access = useWritingAccess();
      return { access, project: useLinkedProject(access.writable) };
    });
    await act(async () => undefined);
    expect(seen.result.current.access.writable).toBe(false);
    expect(seen.result.current.project.update).toBeTypeOf('function');
    const api = window.vcwriter as unknown as { licenseStanding: ReturnType<typeof vi.fn> };
    expect(api.licenseStanding).toHaveBeenCalled();
  });
});

const access = (over: { writable: boolean; notice: string | null; warning: boolean }) => ({
  ...over,
  recheck: () => undefined,
  checking: false,
});

describe('what the writer is told', () => {
  it('says nothing while the subscription is paid', () => {
    render(<WritingNotice access={access({ writable: true, notice: null, warning: false })} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('can be put away while it is only a warning', () => {
    render(<WritingNotice access={access({ writable: true, notice: 'Ends soon.', warning: true })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Ends soon.')).toBeNull();
  });

  it('cannot be put away once it is the reason nothing can be typed', () => {
    // The one notice a writer has to be able to find at any moment.
    render(<WritingNotice access={access({ writable: false, notice: 'Read-only.', warning: false })} />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Renew' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
  });
});
