import { describe, expect, it, vi } from 'vitest';

/**
 * A note's id never depends on a `crypto` global (addendum 27 §19, from Ken's
 * build 7: *Could not save on this phone: Property 'crypto' doesn't exist*).
 */

describe('a note’s id', () => {
  it('comes from Expo’s crypto module', async () => {
    vi.resetModules();
    vi.doMock('expo-crypto', () => ({ randomUUID: () => 'from-expo' }));
    const { newClientCaptureId } = await import('../host/ids');
    expect(newClientCaptureId()).toBe('from-expo');
  });

  it('is still made where neither Expo’s module nor a crypto global exists', async () => {
    vi.resetModules();
    vi.doMock('expo-crypto', () => ({
      randomUUID: () => {
        throw new Error('no native module');
      },
    }));
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const { newClientCaptureId } = await import('../host/ids');
      expect(newClientCaptureId()).toMatch(/^capture-\d+-[a-z0-9]+$/);
    } finally {
      if (saved) Object.defineProperty(globalThis, 'crypto', saved);
    }
  });

  it('is no longer made by naming a bare `crypto` anywhere in the app', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((one) =>
        one.isDirectory() ? (one.name === '__tests__' ? [] : walk(join(dir, one.name))) : [join(dir, one.name)],
      );
    const offenders = walk(join(__dirname, '..'))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => /(^|[^.\w])crypto\s*(\?\.|\.)/m.test(readFileSync(file, 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')));
    expect(offenders).toEqual([]);
  });
});
