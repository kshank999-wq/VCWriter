import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The credits shipped with the program list what it actually carries (addendum 45 §4). */
describe('open-source credits', () => {
  it('are up to date with the installed packages', () => {
    const script = join(__dirname, '..', '..', '..', 'scripts', 'credits.mjs');
    expect(() => execFileSync('node', [script, '--check'], { stdio: 'pipe' })).not.toThrow();
  });
});
