/**
 * Error reporting (spec §14: structured error reporting without logging
 * manuscript content unnecessarily).
 *
 * A crash report has to say enough to find the bug and nothing at all about
 * what the writer was working on. Two things leak manuscript content into a
 * naive report: file paths, which carry project titles and often the writer's
 * real name, and error messages, which quote whatever value they choked on.
 *
 * So the shape below has no field for project content, and everything that
 * does go in passes through `redact` first. The redaction lives here rather
 * than in the desktop application because the receiving route applies it a
 * second time: the sender is the least trusted half, and a report that arrives
 * with a path still in it must not be stored with one.
 */

export type ErrorSurface = 'main' | 'renderer' | 'web';

export interface ErrorReport {
  appVersion: string;
  platform: string;
  osVersion: string;
  errorName: string;
  errorMessage: string;
  stack: string;
  surface: ErrorSurface;
}

/** How much of a report we are willing to store, per field. */
const LIMITS = { message: 500, stack: 4000, short: 80 } as const;

const PLACEHOLDER = '<path>';

/**
 * A path may contain spaces — `Documents\The Lighthouse.vcw` — and that is
 * precisely the part worth removing, because the filename is the project's
 * title. So a run of path characters continues across a space when what
 * follows still looks like a path: another separator, or a file extension
 * ending the run. The lookahead spans a few words, which is what a title is.
 *
 * The pattern deliberately over-reaches rather than under-reaches. Redacting a
 * few words of an error message costs a little context in triage; leaving half
 * a filename in costs the writer their privacy.
 */
const TOKEN = String.raw`[^\s"'()\[\]]`;
const RUN_END = String.raw`(?![^\s"'()\[\],;])`;
const CONTINUES = String.raw`(?:[\\/]|\.[A-Za-z0-9]{1,6}${RUN_END})`;
// `:` is excluded from the body so a stack frame keeps its `:line:column`.
const PATH_BODY = String.raw`(?:[^\s"'()\[\]:]| (?=(?:${TOKEN}+ ){0,3}${TOKEN}*${CONTINUES}))*`;
const DOCUMENT_SUFFIX = String.raw`\.(?:vcw|vcwbak|json|txt|md|fdx|pdf|docx|rtf)`;

const path = (prefix: string, suffix = ''): RegExp =>
  new RegExp(`${prefix}${PATH_BODY}${suffix}`, 'g');

const REDACTIONS: Array<[RegExp, string]> = [
  // URLs first: a signed download URL contains slashes, and a path rule would
  // otherwise chew through the middle of one and leave the scheme behind.
  [/\bhttps?:\/\/[^\s"'()\[\]]+/g, PLACEHOLDER],
  [path(String.raw`\\\\`), PLACEHOLDER], // UNC share
  [path(String.raw`[A-Za-z]:[\\/]`), PLACEHOLDER], // Windows drive
  [path(String.raw`(?:file:\/\/)?\/(?:Users|home|root|var|private|tmp|Volumes|mnt|media|Applications)\/`), PLACEHOLDER],
  // A relative path that names a document: `projects/My Great Novel.vcw`.
  [path(`${TOKEN}*[/\\\\]`, DOCUMENT_SUFFIX), PLACEHOLDER],
  // Email addresses identify the writer; a report is already tied to an
  // account when there is one, and to nobody when there is not.
  [/\b[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}\b/g, '<email>'],
  // A run of placeholders reads as one.
  [/(?:<path>[\\/]?)+/g, PLACEHOLDER],
];

/**
 * Replace anything that looks like a filesystem path, a URL or an address.
 *
 * Applied to every free-text field, including stack traces — a stack's frames
 * are the useful part (function names, line and column numbers all survive),
 * the absolute paths in them are not.
 */
export const redact = (text: string): string =>
  REDACTIONS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);

const trim = (text: string, limit: number): string => {
  // Bound the input before scanning it. An error that interpolated a whole
  // scene is exactly the case this module exists for, and everything past the
  // limit is discarded anyway — redacting megabytes to throw them away would
  // only give a crash handler a second way to hurt.
  const clean = redact(text.slice(0, limit * 4)).replace(/\s+$/g, '');
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
};

export interface ErrorContext {
  appVersion: string;
  platform: string;
  osVersion: string;
  surface: ErrorSurface;
}

/**
 * Build a report from a thrown value.
 *
 * Takes `unknown` because that is what a crash handler is actually given: an
 * unhandled rejection is frequently a string, an object, or nothing useful at
 * all, and a reporter that assumed `Error` would throw inside the crash path.
 */
export const buildErrorReport = (cause: unknown, context: ErrorContext): ErrorReport => {
  const error = cause instanceof Error ? cause : null;
  const message = error?.message ?? (typeof cause === 'string' ? cause : String(cause ?? ''));

  return {
    appVersion: trim(context.appVersion, LIMITS.short),
    platform: trim(context.platform, LIMITS.short),
    osVersion: trim(context.osVersion, LIMITS.short),
    errorName: trim(error?.name ?? 'Error', LIMITS.short),
    errorMessage: trim(message, LIMITS.message),
    stack: trim(error?.stack ?? '', LIMITS.stack),
    surface: context.surface,
  };
};

/**
 * Re-apply the limits and redaction to a report that arrived from a client.
 *
 * The desktop redacts before sending, and this runs again on the way into the
 * database. Both are cheap; missing one would be permanent.
 */
export const sanitiseErrorReport = (report: ErrorReport): ErrorReport => ({
  appVersion: trim(report.appVersion, LIMITS.short),
  platform: trim(report.platform, LIMITS.short),
  osVersion: trim(report.osVersion, LIMITS.short),
  errorName: trim(report.errorName, LIMITS.short),
  errorMessage: trim(report.errorMessage, LIMITS.message),
  stack: trim(report.stack, LIMITS.stack),
  surface: report.surface,
});

/**
 * Reports the writer would gain nothing from sending.
 *
 * A cancelled fetch during shutdown and an offline sync attempt are conditions,
 * not defects; sending them costs the writer bandwidth and buries the real
 * crashes in triage.
 */
const NOT_WORTH_SENDING = [
  /\bERR_INTERNET_DISCONNECTED\b/i,
  /\bENOTFOUND\b/,
  /\bECONNREFUSED\b/,
  /\bfetch failed\b/i,
  /\baborted\b/i,
  /\boperation was cancelled\b/i,
];

export const isWorthReporting = (report: ErrorReport): boolean => {
  if (report.errorMessage.trim().length === 0 && report.stack.trim().length === 0) return false;
  const haystack = `${report.errorName}: ${report.errorMessage}`;
  return !NOT_WORTH_SENDING.some((pattern) => pattern.test(haystack));
};
