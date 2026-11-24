import { app, shell } from 'electron';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, chmod, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import {
  checksumMatches,
  decideUpdate,
  updateFailureReason,
  updateOutcome,
  type PublishedBuild,
  type UpdateDecision,
} from '@vcwriter/domain';
import { devicePlatform } from './device';
import { macBundleOf, macInstallScript, WINDOWS_INSTALL_ARGS } from './update-install';

/**
 * **Updates, as VC Composer does them** (spec §3.3, addendum 48).
 *
 *  - **Check**: `/api/releases` (no sign-in) says whether a newer build is
 *    published for this platform.
 *  - **Download**: through the account (`/api/downloads/<platform>`, a
 *    short-lived link — §19 forbids a permanent public installer URL), into
 *    the app's own Updates folder. The bytes must match the SHA-256 the
 *    catalogue recorded, or they are deleted before anything can run them.
 *  - **Install and restart**: Windows runs the signed installer silently over
 *    this copy and opens the new one; macOS replaces the app from the disk
 *    image once this copy has quit, then opens it (`update-install.ts`).
 *  - **Remembered**: a downloaded update waits in the Updates folder and goes
 *    in at the next start when it could not go in now; the start after an
 *    install says whether it went in, and if not, why.
 */

const SITE_URL = process.env['MAIN_VITE_SITE_URL'] ?? 'https://vc-writer.com';

export interface UpdateStatus {
  decision: UpdateDecision;
  currentVersion: string;
}

/** What the start-up asks: the setting, a download waiting, and how the last install went. */
export interface UpdateState {
  currentVersion: string;
  automatic: boolean;
  /** A downloaded, verified update not yet installed. */
  ready: string | null;
  /** The last install, reported once at the start after it. */
  report: { outcome: 'installed' | 'failed'; version: string; reason: string | null; log: string | null; installer: boolean } | null;
}

interface StoredState {
  automatic?: boolean;
  ready?: { path: string; version: string } | null;
  tried?: { path: string; version: string } | null;
}

const folder = (): string => join(app.getPath('userData'), 'Updates');
const stateFile = (): string => join(folder(), 'state.json');
const logFile = (): string => join(folder(), 'install.log');

const readState = async (): Promise<StoredState> => {
  try {
    return JSON.parse(await readFile(stateFile(), 'utf8')) as StoredState;
  } catch {
    return {};
  }
};

const writeState = async (next: StoredState): Promise<void> => {
  await mkdir(folder(), { recursive: true });
  await writeFile(stateFile(), JSON.stringify(next, null, 2));
};

const exists = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

const osVersion = (): string | null => {
  // Electron reports the OS release; on macOS that is already the marketing
  // version, on Windows it is the build number, which is what release rows use.
  const release = process.getSystemVersion?.();
  return typeof release === 'string' && release.length > 0 ? release : null;
};

export const checkForUpdate = async (): Promise<UpdateStatus> => {
  const platform = devicePlatform();
  const currentVersion = app.getVersion();
  if (!platform) return { decision: { action: 'no_build' }, currentVersion };

  const response = await fetch(`${SITE_URL}/api/releases`);
  if (!response.ok) throw new Error(`vc-writer.com could not be asked about updates (${response.status})`);

  const payload = (await response.json()) as { builds?: PublishedBuild[] };
  return {
    decision: decideUpdate({ currentVersion, platform, osVersion: osVersion(), builds: payload.builds ?? [] }),
    currentVersion,
  };
};

export interface DownloadedUpdate {
  path: string;
  version: string;
  verified: boolean;
}

/**
 * Fetch the installer through the entitlement-checked download endpoint,
 * reporting progress, and verify it before it is ever run. A verified download
 * is remembered, so it can go in at the next start if not now.
 */
export const downloadUpdate = async (input: {
  accessToken: string;
  expectedSha256: string;
  version: string;
  onProgress?: (fraction: number) => void;
}): Promise<DownloadedUpdate> => {
  const platform = devicePlatform();
  if (!platform) throw new Error('This platform has no published builds.');

  // Already here and checked: nothing to fetch again.
  const state = await readState();
  if (state.ready?.version === input.version && (await exists(state.ready.path))) {
    const bytes = await readFile(state.ready.path);
    if (checksumMatches(input.expectedSha256, createHash('sha256').update(bytes).digest('hex'))) {
      input.onProgress?.(1);
      return { path: state.ready.path, version: input.version, verified: true };
    }
  }

  const authorised = await fetch(`${SITE_URL}/api/downloads/${platform}`, {
    headers: { authorization: `Bearer ${input.accessToken}` },
  });
  const payload = (await authorised.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!authorised.ok || !payload?.url) {
    throw new Error(payload?.error ?? `The download could not be authorised (${authorised.status})`);
  }

  const installer = await fetch(payload.url);
  if (!installer.ok || !installer.body) throw new Error(`The installer could not be downloaded (${installer.status})`);
  const total = Number(installer.headers.get('content-length') ?? 0);
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = installer.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total > 0) input.onProgress?.(Math.min(1, received / total));
  }
  const bytes = Buffer.concat(chunks);

  const verified = checksumMatches(input.expectedSha256, createHash('sha256').update(bytes).digest('hex'));
  if (!verified) {
    // Never written to disk. What arrived is not what was published, and an
    // installer that failed its check left lying about invites running it.
    throw new Error(
      'The downloaded update did not match its published checksum, so it was thrown away. Try again; if it keeps happening, download VC Writer from your account page.',
    );
  }

  // One installer kept at a time: the old ones are only disk space.
  await mkdir(folder(), { recursive: true });
  for (const name of await readdir(folder())) {
    if (/\.(exe|dmg)$/i.test(name)) await rm(join(folder(), name), { force: true });
  }
  const extension = platform === 'windows' ? 'exe' : 'dmg';
  const path = join(folder(), `VC-Writer-${input.version}.${extension}`);
  await writeFile(path, bytes);
  await writeState({ ...(await readState()), ready: { path, version: input.version } });
  input.onProgress?.(1);
  return { path, version: input.version, verified };
};

/** The start-up's question; reading the last install's report also clears it. */
export const updateState = async (): Promise<UpdateState> => {
  const state = await readState();
  const currentVersion = app.getVersion();
  let report: UpdateState['report'] = null;
  const tried = state.tried ?? null;
  const outcome = updateOutcome(tried?.version ?? null, currentVersion);
  if (tried && outcome !== 'none') {
    const log = await readFile(logFile(), 'utf8').catch(() => null);
    report = {
      outcome,
      version: tried.version,
      reason: log ? updateFailureReason(log) : null,
      log: log !== null ? logFile() : null,
      installer: await exists(tried.path),
    };
  }
  let ready = state.ready ?? null;
  // Installed, or gone from the folder: nothing is waiting any more.
  if (ready && (updateOutcome(ready.version, currentVersion) !== 'failed' || !(await exists(ready.path)))) ready = null;
  // A failed install is never retried by itself (that could loop); it is reported, and offered by hand.
  if (report?.outcome === 'failed') ready = null;
  if (report?.outcome === 'installed') {
    for (const name of await readdir(folder()).catch(() => [] as string[])) {
      if (/\.(exe|dmg)$/i.test(name)) await rm(join(folder(), name), { force: true });
    }
  }
  if (tried || ready !== (state.ready ?? null)) await writeState({ ...state, tried: null, ready });
  return { currentVersion, automatic: state.automatic ?? true, ready: ready?.version ?? null, report };
};

export const setAutomaticUpdates = async (on: boolean): Promise<void> => {
  await writeState({ ...(await readState()), automatic: on });
};

/**
 * **Install the waiting update and restart.** Empty on success, and the app
 * then quits for the installer; otherwise why not. On a Mac whose app folder
 * cannot be written the disk image is opened instead, for a drag.
 */
export const installUpdate = async (): Promise<string> => {
  const state = await readState();
  const ready = state.ready;
  if (!ready || !(await exists(ready.path))) return 'There is no downloaded update to install. Check for updates first.';
  if (!app.isPackaged) return 'This copy of VC Writer was not installed by an installer, so it cannot update itself.';
  const platform = devicePlatform();

  if (platform === 'windows') {
    const child = spawn(ready.path, [...WINDOWS_INSTALL_ARGS], { detached: true, stdio: 'ignore' });
    child.unref();
  } else if (platform === 'macos') {
    const bundle = macBundleOf(app.getPath('exe'));
    if (!bundle) return 'VC Writer could not find its own app to replace.';
    try {
      await access(dirname(bundle), constants.W_OK);
      await access(bundle, constants.W_OK);
    } catch {
      await shell.openPath(ready.path);
      return `VC Writer's folder cannot be written from here, so the disk image is open instead: drag VC Writer to ${basename(dirname(bundle))}, replacing the old one.`;
    }
    const script = join(folder(), 'install.sh');
    await writeFile(script, macInstallScript({ pid: process.pid, dmg: ready.path, app: bundle, log: logFile() }));
    await chmod(script, 0o755);
    spawn('/bin/bash', [script], { detached: true, stdio: 'ignore' }).unref();
  } else {
    return 'VC Writer updates itself on Windows and macOS.';
  }

  await writeState({ ...state, ready: null, tried: { path: ready.path, version: ready.version } });
  // Out of the installer's way: Windows cannot replace files the running app holds.
  setTimeout(() => app.quit(), 400);
  return '';
};

/** The installer of the last update, opened by hand (after a failed install). */
export const openUpdateInstaller = async (): Promise<string> => {
  const files = (await readdir(folder()).catch(() => [] as string[])).filter((name) => /\.(exe|dmg)$/i.test(name));
  if (files.length === 0) {
    await shell.openExternal(`${SITE_URL}/account`);
    return '';
  }
  return shell.openPath(join(folder(), files[0]!));
};

/** The install log, shown in its folder. */
export const showUpdateLog = (): void => {
  shell.showItemInFolder(logFile());
};
