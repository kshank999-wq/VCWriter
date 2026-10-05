import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The two things the stores refuse a submission over (addendum 27 §15).
 *
 * **Read off the source rather than off a rendered screen**, which is this
 * file's own standing argument one step further: the screens are React Native
 * and need a simulator, so what can be pinned here is what is written down —
 * and that is enough, because both of these fail by being *absent*. A purchase
 * screen with no terms link looks exactly like one nobody has added yet, and
 * the only person who finds out is a reviewer. (The idiom is the webhook gate's
 * in addendum 32 §9 and the checkout body's in addendum 31 §4: where a thing
 * cannot be exercised, assert its source.)
 *
 * The second half is the one that will actually regress. `site()` was written
 * out twice before this — in `host/api.ts` and again in `Account` — and a
 * third copy is one keystroke away the next time a screen wants to link
 * somewhere. A second copy is the older copy, and nothing on the screen says
 * which.
 */

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string): string => readFileSync(join(src, relative), 'utf8');

describe('the purchase screen, as guideline 3.1.2 asks for it', () => {
  const screen = read('screens/Subscribe.tsx');

  it('links to the terms of use', () => {
    expect(screen).toContain('/terms');
    expect(screen).toContain('Terms of Use');
  });

  it('links to the privacy policy', () => {
    expect(screen).toContain('/privacy');
    expect(screen).toContain('Privacy Policy');
  });

  it('builds both out of the one site address rather than typing one in', () => {
    // A link hard-coded to vc-writer.com works in production and silently
    // points at the wrong place in every other build, which is the one failure
    // nobody checking a staging build would think to look for.
    expect(screen).not.toContain('https://vc-writer.com');
    expect(screen).toContain("from '../host/api'");
  });

  it('says the two things a recurring charge has to say', () => {
    // Length and renewal. The price is the shop's and is read from it, so it
    // is deliberately not asserted here.
    expect(screen).toContain('renews itself');
    expect(screen).toMatch(/cancel/i);
  });
});

describe('where the site is', () => {
  it('is answered in exactly one place', () => {
    const files = [
      'host/api.ts',
      'screens/Account.tsx',
      'screens/Subscribe.tsx',
    ];
    const defined = files.filter((one) => /const site = \(\): string =>/.test(read(one)));
    expect(defined).toEqual(['host/api.ts']);
  });
});
