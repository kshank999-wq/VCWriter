import { defineConfig } from 'vitest/config';

/**
 * What can be tested here without a device.
 *
 * The screens and the host services are React Native and native modules, which
 * need a simulator rather than a runner — so what is covered here is the
 * arithmetic, and **everything that decides anything is covered in the domain
 * already**, by the same 2,500 tests the website runs against. That is the
 * whole argument for having built it this way.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
