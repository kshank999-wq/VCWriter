// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILD_MOVED_ON, buildMovedOn } from '../late-module';
import { useBuildStanding } from '../use-build-standing';
import { StaleBuildNotice } from '../components/StaleBuildNotice';

/**
 * A page that has outlived its deployment (addendum 33 §9a).
 *
 * §9 fixed the failure and ended by telling Ken to reload, and the same report
 * came back word for word. The sentence in the dialog is honest and arrives
 * **after** a writer has chosen a file and been turned away; this is the half
 * that arrives before they press anything, so what is pinned here is the
 * reading's three refusals — the cases where it must say nothing at all,
 * because a notice that cries wolf is one that gets ignored on the day it is
 * right.
 */

afterEach(cleanup);

const script = (src: string) => {
  const tag = document.createElement('script');
  tag.type = 'module';
  tag.src = src;
  document.head.append(tag);
  return tag;
};

function Probe() {
  return <StaleBuildNotice movedOn={useBuildStanding()} />;
}

describe('what counts as the deployment having moved on', () => {
  it('is a flat refusal and nothing else', () => {
    expect(buildMovedOn(404)).toBe(true);
    expect(buildMovedOn(410)).toBe(true);
    // The page failing to ask is not an answer: a server having a bad minute,
    // a proxy, a gateway. None of it says anybody deployed anything.
    for (const status of [200, 204, 304, 401, 403, 429, 500, 502, 503, 504]) {
      expect(buildMovedOn(status), String(status)).toBe(false);
    }
  });
});

describe('the page asking after its own entry script', () => {
  let fetched: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetched = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetched);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.head.querySelectorAll('script').forEach((tag) => tag.remove());
  });

  it('says so when the file it was opened with is gone', async () => {
    script('http://localhost/preview/assets/index-OLD.js');
    render(<Probe />);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(screen.getByText(BUILD_MOVED_ON)).toBeTruthy());
    expect(fetched).toHaveBeenCalledWith(
      'http://localhost/preview/assets/index-OLD.js',
      expect.objectContaining({ method: 'HEAD', cache: 'no-store' }),
    );
  });

  it('says nothing while the file is still served', async () => {
    fetched.mockResolvedValue(new Response(null, { status: 200 }));
    script('http://localhost/preview/assets/index-NEW.js');
    render(<Probe />);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(screen.queryByText(BUILD_MOVED_ON)).toBeNull();
  });

  it('says nothing when it could not ask at all', async () => {
    // Offline, or a blocked network. The one answer this must never give.
    fetched.mockRejectedValue(new TypeError('Failed to fetch'));
    script('http://localhost/preview/assets/index-NEW.js');
    render(<Probe />);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(screen.queryByText(BUILD_MOVED_ON)).toBeNull();
  });

  it('asks at most once a minute however often the window is returned to', async () => {
    script('http://localhost/preview/assets/index-NEW.js');
    fetched.mockResolvedValue(new Response(null, { status: 200 }));
    render(<Probe />);
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
    }
    expect(fetched).toHaveBeenCalledTimes(1);
  });

  it('never asks where the page came off a disk', async () => {
    // The desktop loads its renderer from file://, where there is no
    // deployment to have moved on.
    const location = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...location, protocol: 'file:', reload: vi.fn() },
      configurable: true,
    });
    script('file:///app/assets/index-OLD.js');
    render(<Probe />);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(fetched).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', { value: location, configurable: true });
  });
});

describe('what the notice does about it', () => {
  it('reloads rather than telling anybody to', async () => {
    // §9's own fault: an instruction is not a fix. The flush is already on
    // `beforeunload`, so there is nothing to do first.
    const reload = vi.fn();
    const location = window.location;
    Object.defineProperty(window, 'location', { value: { ...location, reload }, configurable: true });
    render(<StaleBuildNotice movedOn />);
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalled();
    Object.defineProperty(window, 'location', { value: location, configurable: true });
  });

  it('can be put away, nothing here having stopped working', async () => {
    render(<StaleBuildNotice movedOn />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(BUILD_MOVED_ON)).toBeNull();
  });

  it('is absent where the page is current', () => {
    render(<StaleBuildNotice movedOn={false} />);
    expect(screen.queryByText(BUILD_MOVED_ON)).toBeNull();
  });
});

describe('every window that can go stale says so', () => {
  /**
   * The test §9 did not have, in the shape addendum 29 §2 named: the act can
   * be right and unreachable from the window somebody is standing in. Each of
   * these already carries the lapse bar, so the lapse bar is the list — a
   * window that says one and not the other is the gap.
   */
  const renderer = join(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (name: string) => readFileSync(join(renderer, name), 'utf8');

  for (const window of ['App.tsx', 'Satellite.tsx']) {
    it(`${window} mounts it beside the lapse bar`, () => {
      const source = read(window);
      expect(source).toContain('useBuildStanding');
      expect((source.match(/<StaleBuildNotice/g) ?? []).length).toBe(
        (source.match(/<WritingNotice/g) ?? []).length,
      );
    });
  }
});
