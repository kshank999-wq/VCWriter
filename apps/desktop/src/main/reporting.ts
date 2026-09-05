import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildErrorReport,
  isWorthReporting,
  type ErrorContext,
  type ErrorSurface,
} from '@vcwriter/domain';
import { accessToken } from './cloud';

/**
 * Crash reporting (spec §14).
 *
 * Three rules, in this order of importance:
 *
 *  1. **Off unless the writer turns it on.** A word processor that phones home
 *     by default has decided something on the writer's behalf that is not its
 *     to decide. The setting starts off and there is no "on by default after
 *     the first crash".
 *  2. **Never the work.** The report is built by the domain's redactor, whose
 *     output has no field for manuscript content and whose text fields have
 *     had paths, URLs and addresses removed. The server redacts again.
 *  3. **Never make a crash worse.** Every function here swallows its own
 *     failures. A reporter that throws inside an uncaught-exception handler
 *     turns a recoverable error into a dead application.
 */

const SITE_URL = process.env['MAIN_VITE_SITE_URL'] ?? 'https://vc-writer.com';

const settingsPath = () => join(app.getPath('userData'), 'reporting.json');

interface ReportingSettings {
  enabled: boolean;
}

let cached: ReportingSettings | null = null;

export const reportingSettings = async (): Promise<ReportingSettings> => {
  if (cached) return cached;
  try {
    const raw = JSON.parse(await readFile(settingsPath(), 'utf8')) as Partial<ReportingSettings>;
    cached = { enabled: raw.enabled === true };
  } catch {
    // No file yet, or an unreadable one. Either way: off.
    cached = { enabled: false };
  }
  return cached;
};

export const setReportingEnabled = async (enabled: boolean): Promise<ReportingSettings> => {
  cached = { enabled };
  try {
    await mkdir(app.getPath('userData'), { recursive: true });
    await writeFile(settingsPath(), JSON.stringify(cached), 'utf8');
  } catch {
    // The choice still holds for this run; it just will not survive a restart.
  }
  return cached;
};

const context = (surface: ErrorSurface): ErrorContext => ({
  appVersion: app.getVersion(),
  platform: process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : process.platform,
  osVersion: process.getSystemVersion?.() ?? '',
  surface,
});

/**
 * Send one report, if the writer has opted in and it is worth sending.
 *
 * Returns whether anything was sent, which is what the tests assert on: the
 * interesting property is that a report is *not* sent when the setting is off.
 */
export const reportError = async (cause: unknown, surface: ErrorSurface): Promise<boolean> => {
  try {
    const settings = await reportingSettings();
    if (!settings.enabled) return false;

    const report = buildErrorReport(cause, context(surface));
    if (!isWorthReporting(report)) return false;

    // Attribution is a bonus, not a requirement: a crash before sign-in is
    // still worth knowing about, and asking for a token must not throw here.
    const token = await accessToken().catch(() => null);

    const response = await fetch(`${SITE_URL}/api/telemetry`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(report),
    });
    return response.ok;
  } catch {
    // A crash reporter that can crash is not a crash reporter.
    return false;
  }
};

/**
 * Attach the process-level handlers.
 *
 * Both handlers report and then let the application carry on. An uncaught
 * exception in the main process is not automatically fatal in Electron, and
 * quitting on one would throw away whatever the writer has not saved — which
 * is a far worse outcome than an application in a slightly odd state with its
 * autosave still running.
 */
export const installCrashHandlers = (): void => {
  process.on('uncaughtException', (error) => {
    void reportError(error, 'main');
  });
  process.on('unhandledRejection', (reason) => {
    void reportError(reason, 'main');
  });
};
