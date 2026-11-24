/**
 * **What installing an update runs** (addendum 48), kept apart from Electron
 * so it can be read and tested on its own.
 *
 * - **Windows** runs the signed NSIS installer silently: `/S` installs over
 *   this copy in the folder it was installed to, `--updated` keeps the
 *   writer's shortcuts as they arranged them, and `--force-run` opens the new
 *   VC Writer when it is done.
 * - **macOS** cannot replace an app that is running, so a small script waits
 *   for this copy to quit, mounts the disk image, puts the new app where the
 *   old one was (keeping the old one until the new one is in place, and
 *   putting it back if the copy fails), and opens it. Every step goes into a
 *   log; a step that stops writes a `FAILED:` line, which the next start reads
 *   out to the writer.
 *
 * Projects and settings live outside the app and are never touched.
 */

export const WINDOWS_INSTALL_ARGS: readonly string[] = ['/S', '--updated', '--force-run'];

/** Quoted for a POSIX shell: everything literal. */
export const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/** The `.app` bundle an executable inside `Contents/MacOS` belongs to, or null. */
export const macBundleOf = (executable: string): string | null => {
  const match = /^(.*?\.app)\/Contents\/MacOS\/[^/]+$/.exec(executable);
  return match ? match[1]! : null;
};

export const macInstallScript = (input: { pid: number; dmg: string; app: string; log: string }): string => {
  const q = shellQuote;
  return [
    '#!/bin/bash',
    '# Installs a VC Writer update once the running copy has quit (written by VC Writer).',
    `PID=${Math.trunc(input.pid)}`,
    `DMG=${q(input.dmg)}`,
    `APP=${q(input.app)}`,
    `LOG=${q(input.log)}`,
    'MNT="$(mktemp -d "${TMPDIR:-/tmp}/vcwriter-update.XXXXXX")" || MNT=""',
    'OLD="$APP.updating"',
    'say() { echo "$(date "+%Y-%m-%d %H:%M:%S") $*" >> "$LOG"; }',
    'fail() { echo "FAILED: $*" >> "$LOG"; hdiutil detach "$MNT" -quiet -force >/dev/null 2>&1; open "$APP"; exit 1; }',
    ': > "$LOG"',
    'say "Waiting for VC Writer to quit"',
    'for _ in $(seq 1 240); do kill -0 "$PID" 2>/dev/null || break; sleep 0.25; done',
    'kill -0 "$PID" 2>/dev/null && fail "VC Writer did not quit"',
    '[ -n "$MNT" ] || fail "no folder could be made to open the disk image in"',
    'say "Opening the disk image"',
    'hdiutil attach -nobrowse -readonly -noautoopen -mountpoint "$MNT" "$DMG" >> "$LOG" 2>&1 || fail "the disk image would not open"',
    'NEW="$(find "$MNT" -maxdepth 1 -name "*.app" | head -n 1)"',
    '[ -n "$NEW" ] || fail "there was no app in the disk image"',
    'say "Replacing $APP"',
    'rm -rf "$OLD"',
    'mv "$APP" "$OLD" || fail "the old copy could not be moved aside (is the folder writable?)"',
    'if ! ditto "$NEW" "$APP" >> "$LOG" 2>&1; then rm -rf "$APP"; mv "$OLD" "$APP"; fail "the new copy could not be written"; fi',
    'rm -rf "$OLD"',
    'xattr -dr com.apple.quarantine "$APP" >/dev/null 2>&1',
    'hdiutil detach "$MNT" -quiet >/dev/null 2>&1',
    'say "Installed; opening VC Writer"',
    'open "$APP"',
    '',
  ].join('\n');
};
