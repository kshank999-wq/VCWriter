import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { macBundleOf, macInstallScript, shellQuote, WINDOWS_INSTALL_ARGS } from '../update-install';

const run = promisify(execFile);

describe('what an update runs (addendum 48)', () => {
  it('runs the Windows installer silently over this copy, then opens it', () => {
    expect(WINDOWS_INSTALL_ARGS).toEqual(['/S', '--updated', '--force-run']);
  });

  it('finds the app bundle from its executable', () => {
    expect(macBundleOf('/Applications/VC Writer.app/Contents/MacOS/VC Writer')).toBe('/Applications/VC Writer.app');
    expect(macBundleOf('/usr/bin/node')).toBeNull();
  });

  it('quotes paths so a space or an apostrophe is only a character', () => {
    expect(shellQuote("Ken's Mac/VC Writer.app")).toBe(`'Ken'\\''s Mac/VC Writer.app'`);
  });

  /**
   * The Mac script, run for real against stand-ins for hdiutil, ditto, open and
   * xattr: it waits for the app to quit, puts the new app where the old one
   * was, and opens it — and when the copy fails, the old app is put back and
   * the log says why.
   */
  const sandbox = async (dittoFails: boolean) => {
    const root = await mkdtemp(join(tmpdir(), 'vcw-update-'));
    const bin = join(root, 'bin');
    await mkdir(bin);
    const fake = async (name: string, body: string) => {
      await writeFile(join(bin, name), `#!/bin/bash\n${body}\n`);
      await chmod(join(bin, name), 0o755);
    };
    await fake(
      'hdiutil',
      'if [ "$1" = attach ]; then while [ $# -gt 0 ]; do [ "$1" = -mountpoint ] && mnt="$2"; shift; done; mkdir -p "$mnt/VC Writer.app/Contents"; echo new > "$mnt/VC Writer.app/Contents/version"; fi; exit 0',
    );
    await fake('ditto', dittoFails ? 'exit 1' : 'cp -R "$1" "$2"');
    await fake('open', `echo "$1" >> '${join(root, 'opened')}'`);
    await fake('xattr', 'exit 0');
    const app = join(root, "Ken's Apps", 'VC Writer.app');
    await mkdir(join(app, 'Contents'), { recursive: true });
    await writeFile(join(app, 'Contents', 'version'), 'old');
    const dmg = join(root, 'VC-Writer-1.0.61-mac.dmg');
    await writeFile(dmg, 'dmg');
    const log = join(root, 'install.log');
    const script = join(root, 'install.sh');
    // A process that has already quit.
    await writeFile(script, macInstallScript({ pid: 999999, dmg, app, log }));
    await run('/bin/bash', [script], { env: { ...process.env, PATH: `${bin}:${process.env['PATH']}` } }).catch(() => undefined);
    return { app, log, opened: join(root, 'opened') };
  };

  it.skipIf(process.platform === 'win32')('replaces the app and opens it', async () => {
    const { app, log, opened } = await sandbox(false);
    expect(await readFile(join(app, 'Contents', 'version'), 'utf8')).toBe('new\n');
    expect(existsSync(`${app}.updating`)).toBe(false);
    expect(await readFile(log, 'utf8')).toContain('Installed; opening VC Writer');
    expect((await readFile(opened, 'utf8')).trim()).toBe(app);
  });

  it.skipIf(process.platform === 'win32')('puts the old app back when the copy fails, and says why', async () => {
    const { app, log, opened } = await sandbox(true);
    expect(await readFile(join(app, 'Contents', 'version'), 'utf8')).toBe('old');
    expect(await readFile(log, 'utf8')).toContain('FAILED: the new copy could not be written');
    expect((await readFile(opened, 'utf8')).trim()).toBe(app);
  });
});
