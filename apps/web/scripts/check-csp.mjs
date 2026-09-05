import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

/**
 * Loads the built site in a real browser and fails if the content security
 * policy blocks anything.
 *
 * This exists because of a bug that nothing else in the suite could catch. The
 * policy carries a per-request nonce, and `strict-dynamic` makes `'self'`
 * inert for scripts — so a page that is statically prerendered ships HTML with
 * no nonce in it, and the browser refuses *every* script on that page. The
 * build succeeds. Typecheck succeeds. Every unit test passes. The landing page
 * and the sign-in page are simply dead in the browser.
 *
 * The only way to know is to open it, so this opens it.
 */

const PORT = Number(process.env['CSP_CHECK_PORT'] ?? 3210);
const PAGES = ['/', '/signin', '/download', '/notes', '/account', '/purchase/complete'];

const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // The check is about headers and scripts, not data. Real keys are not
      // needed and must not be required to run it.
      NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? 'anon-key-for-the-csp-check',
    },
  },
);

const stop = () => {
  if (!server.killed) server.kill('SIGTERM');
};
process.on('exit', stop);
process.on('SIGINT', () => {
  stop();
  process.exit(130);
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await delay(500);
  }
  throw new Error('The site did not start within 30 seconds');
};

let failures = 0;

try {
  await waitForServer();

  const browser = await chromium.launch(
    process.env['CHROMIUM_PATH'] ? { executablePath: process.env['CHROMIUM_PATH'] } : {},
  );

  for (const path of PAGES) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const blocked = [];

    page.on('console', (message) => {
      if (message.type() === 'error' && /Content Security Policy|Refused to (load|execute)/i.test(message.text())) {
        blocked.push(message.text());
      }
    });

    await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle' });

    // A page whose scripts were blocked still renders its server HTML, so the
    // real test is whether React attached to it. Waited for, not snapshotted:
    // a page that mounts client-only (/notes) hydrates a beat after network
    // idle, and on a slow runner that beat is enough to miss.
    const hydrated = await page
      .waitForFunction(
        () =>
          Array.from(document.querySelectorAll('body *')).some((element) =>
            Object.keys(element).some((key) => key.startsWith('__react')),
          ),
        undefined,
        { timeout: 8000 },
      )
      .then(() => true)
      .catch(() => false);

    if (blocked.length > 0) {
      failures += 1;
      console.error(`✗ ${path} — ${blocked.length} script(s) blocked by the policy`);
      for (const entry of blocked.slice(0, 3)) console.error(`    ${entry.slice(0, 200)}`);
    } else if (!hydrated) {
      failures += 1;
      console.error(`✗ ${path} — nothing blocked, but React never attached within 8s`);
    } else {
      console.log(`✓ ${path}`);
    }

    await context.close();
  }

  await browser.close();
} finally {
  stop();
}

if (failures > 0) {
  console.error(`\n${failures} page(s) failed.`);
  console.error('A blocked script usually means a prerendered page without the nonce — see docs/security-review.md.');
  process.exit(1);
}

console.log('\nContent security policy is clean on every page checked.');
