import { app, shell } from 'electron';
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checksumMatches, decideUpdate, type PublishedBuild, type UpdateDecision } from '@vcwriter/domain';
import { devicePlatform } from './device';

/**
 * Checking for and fetching updates (spec §3.3).
 *
 * Two constraints shape this rather than an off-the-shelf auto-updater:
 *
 *  - §19 forbids permanently public installer URLs, and the download is behind
 *    an entitlement check. A static update feed cannot express that.
 *  - The bytes must be verified. A checksum mismatch means what arrived is not
 *    what was signed, and the only safe response is to refuse it — which is why
 *    the download is discarded rather than "probably fine".
 *
 * So the flow is deliberate rather than silent: check, tell the writer what
 * changed, download with the same signed URL the account page would give them,
 * verify, then hand the installer to the operating system. Nothing is installed
 * behind the writer's back mid-sentence.
 */

const SITE_URL = process.env['MAIN_VITE_SITE_URL'] ?? 'https://vc-writer.com';

export interface UpdateStatus {
  decision: UpdateDecision;
  currentVersion: string;
}

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
  if (!response.ok) throw new Error(`The release catalogue could not be read (${response.status})`);

  const payload = (await response.json()) as { builds?: PublishedBuild[] };
  return {
    decision: decideUpdate({
      currentVersion,
      platform,
      osVersion: osVersion(),
      builds: payload.builds ?? [],
    }),
    currentVersion,
  };
};

export interface DownloadedUpdate {
  path: string;
  version: string;
  verified: boolean;
}

/**
 * Fetch the installer through the entitlement-checked download endpoint and
 * verify it before it is ever run.
 */
export const downloadUpdate = async (input: {
  accessToken: string;
  expectedSha256: string;
  version: string;
}): Promise<DownloadedUpdate> => {
  const platform = devicePlatform();
  if (!platform) throw new Error('This platform has no published builds.');

  const authorised = await fetch(`${SITE_URL}/api/downloads/${platform}`, {
    headers: { authorization: `Bearer ${input.accessToken}` },
  });
  const payload = (await authorised.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!authorised.ok || !payload?.url) {
    throw new Error(payload?.error ?? `The download could not be authorised (${authorised.status})`);
  }

  const installer = await fetch(payload.url);
  if (!installer.ok) throw new Error(`The installer could not be downloaded (${installer.status})`);
  const bytes = Buffer.from(await installer.arrayBuffer());

  const actual = createHash('sha256').update(bytes).digest('hex');
  const verified = checksumMatches(input.expectedSha256, actual);
  if (!verified) {
    // Do not keep it. What is on disk is not what was published, and leaving a
    // rejected installer around invites someone running it later.
    throw new Error(
      'The downloaded installer did not match its published checksum, so it has been discarded. Try again, and if it keeps happening, download from your account page.',
    );
  }

  const directory = join(tmpdir(), 'vcwriter-updates');
  await mkdir(directory, { recursive: true });
  const extension = platform === 'windows' ? 'exe' : 'dmg';
  const path = join(directory, `VCWriter-${input.version}.${extension}`);
  await writeFile(path, bytes);

  return { path, version: input.version, verified };
};

/** Hand the verified installer to the OS and step out of its way. */
export const runInstaller = async (path: string): Promise<void> => {
  const error = await shell.openPath(path);
  if (error) throw new Error(error);
  // Windows installers cannot replace files the running app holds open.
  setTimeout(() => app.quit(), 1000);
};
