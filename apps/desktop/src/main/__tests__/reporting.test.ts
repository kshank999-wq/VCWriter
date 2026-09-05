import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let userData = '';

vi.mock('electron', () => ({
  app: {
    getPath: () => userData,
    getVersion: () => '1.2.3',
  },
}));

vi.mock('../cloud', () => ({
  accessToken: async () => {
    throw new Error('Not signed in');
  },
}));

const fetchMock = vi.fn();

/**
 * A fresh module for each test, over a fresh user-data directory. The setting
 * is cached in module scope, so re-importing is the only honest way to ask
 * "what does a new installation do?".
 */
const load = async () => {
  userData = await mkdtemp(join(tmpdir(), 'vcwriter-reporting-'));
  vi.resetModules();
  return import('../reporting');
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('error reporting', () => {
  it('is off on a new installation', async () => {
    // The assertion that matters most here: a crash must not be the thing that
    // turns reporting on.
    const { reportError, reportingSettings } = await load();

    expect((await reportingSettings()).enabled).toBe(false);
    expect(await reportError(new Error('boom'), 'main')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a redacted report once enabled', async () => {
    const { reportError, setReportingEnabled } = await load();
    await setReportingEnabled(true);

    const error = new Error(String.raw`ENOENT: open 'C:\Users\Kevin\The Lighthouse.vcw'`);
    error.stack = `${error.message}\n    at saveProject (C:\\Users\\Kevin\\app\\out\\main\\index.js:12:3)`;

    expect(await reportError(error, 'main')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, string>;

    expect(body['errorMessage']).not.toContain('Lighthouse');
    expect(body['errorMessage']).not.toContain('Kevin');
    expect(body['stack']).not.toContain('Kevin');
    expect(body['stack']).toContain('at saveProject');
    expect(body['appVersion']).toBe('1.2.3');
    expect(body['surface']).toBe('main');
    expect(Object.keys(body)).not.toContain('project');
  });

  it('sends without a token rather than failing when signed out', async () => {
    const { reportError, setReportingEnabled } = await load();
    await setReportingEnabled(true);

    expect(await reportError(new Error('boom'), 'renderer')).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('authorization');
  });

  it('does not report a dropped connection', async () => {
    const { reportError, setReportingEnabled } = await load();
    await setReportingEnabled(true);

    expect(await reportError(new Error('fetch failed'), 'main')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws, whatever it is handed', async () => {
    // It runs inside an uncaught-exception handler. Throwing here would turn a
    // survivable error into a dead application.
    const { reportError, setReportingEnabled } = await load();
    await setReportingEnabled(true);
    fetchMock.mockRejectedValue(new Error('network is down'));

    await expect(reportError(undefined, 'main')).resolves.toBe(false);
    await expect(reportError({ weird: true }, 'main')).resolves.toBe(false);
  });

  it('remembers the choice across a restart', async () => {
    const first = await load();
    await first.setReportingEnabled(true);

    // Same directory, new module: this is what the next launch sees.
    vi.resetModules();
    const second = await import('../reporting');
    expect((await second.reportingSettings()).enabled).toBe(true);
  });
});
