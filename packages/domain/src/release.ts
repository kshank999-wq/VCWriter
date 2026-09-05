import type { Platform } from './entities/common.js';

/**
 * Deciding whether to update (spec §3.3).
 *
 * The client never holds a download URL — §19 is explicit that installers are
 * reached through entitlement checks or short-lived signed URLs, never a
 * permanently public address. So an update check answers one question: is there
 * a newer build for this platform that this machine can run? Fetching it is a
 * separate, authorised step.
 */

export interface PublishedBuild {
  platform: Platform;
  version: string;
  minimumOsVersion: string;
  releaseNotes: string;
  publishedAt: string | null;
  sha256: string;
}

/**
 * Compare two dotted version strings.
 *
 * Numeric parts compare numerically, so 1.10.0 is newer than 1.9.0 — string
 * comparison gets that backwards, and shipping an updater that refuses to
 * offer 1.10 to someone on 1.9 would be a quiet, long-lived bug. A build
 * carrying a pre-release suffix (`1.2.0-beta.1`) sorts before the release it
 * leads to.
 */
export const compareVersions = (a: string, b: string): number => {
  const split = (value: string): { parts: number[]; pre: string | null } => {
    const [core = '', ...rest] = value.trim().split('-');
    return {
      parts: core.split('.').map((part) => Number.parseInt(part, 10) || 0),
      pre: rest.length > 0 ? rest.join('-') : null,
    };
  };

  const left = split(a);
  const right = split(b);
  const length = Math.max(left.parts.length, right.parts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (left.parts[index] ?? 0) - (right.parts[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }

  // Same numbers: a pre-release is older than the release it precedes.
  if (left.pre === right.pre) return 0;
  if (left.pre === null) return 1;
  if (right.pre === null) return -1;
  return left.pre < right.pre ? -1 : 1;
};

export const isNewerVersion = (candidate: string, current: string): boolean =>
  compareVersions(candidate, current) > 0;

export type UpdateDecision =
  | { action: 'up_to_date' }
  | { action: 'no_build' }
  | { action: 'unsupported_os'; version: string; requires: string }
  | { action: 'update'; version: string; releaseNotes: string; sha256: string };

export interface UpdateCheckInput {
  currentVersion: string;
  platform: Platform;
  /** The OS version this machine reports, if the app can determine it. */
  osVersion?: string | null;
  builds: readonly PublishedBuild[];
}

/**
 * What the app should do about the published catalogue.
 *
 * Offering an update the machine cannot install is worse than offering none —
 * the writer downloads a hundred megabytes and gets an error — so a build whose
 * minimum OS is above this machine is reported as such rather than hidden or
 * offered.
 */
export const decideUpdate = (input: UpdateCheckInput): UpdateDecision => {
  const forPlatform = input.builds.filter((build) => build.platform === input.platform);
  if (forPlatform.length === 0) return { action: 'no_build' };

  const newest = forPlatform.reduce((best, build) =>
    compareVersions(build.version, best.version) > 0 ? build : best,
  );

  if (!isNewerVersion(newest.version, input.currentVersion)) return { action: 'up_to_date' };

  if (
    newest.minimumOsVersion.length > 0 &&
    input.osVersion &&
    compareVersions(input.osVersion, newest.minimumOsVersion) < 0
  ) {
    return { action: 'unsupported_os', version: newest.version, requires: newest.minimumOsVersion };
  }

  return {
    action: 'update',
    version: newest.version,
    releaseNotes: newest.releaseNotes,
    sha256: newest.sha256,
  };
};

/**
 * Whether a downloaded installer is the one that was published.
 *
 * A checksum mismatch means the bytes on disk are not the bytes that were
 * signed, whatever the reason — a truncated download, a proxy that rewrote it,
 * something worse. The only safe response is to refuse it, so this is a
 * comparison with no tolerance and no "probably fine" branch.
 */
export const checksumMatches = (expected: string, actual: string): boolean => {
  const normalise = (value: string) => value.trim().toLowerCase().replace(/^sha256[:-]/, '');
  const left = normalise(expected);
  const right = normalise(actual);
  // An empty expectation is not a match: a build published without a checksum
  // cannot be verified, and the caller must decide that deliberately.
  if (left.length === 0 || right.length === 0) return false;
  return left === right;
};
