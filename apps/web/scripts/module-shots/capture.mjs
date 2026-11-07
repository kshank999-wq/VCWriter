/**
 * Take the screenshot on each module's page on vc-writer.com (addendum 35 §7).
 *
 *   pnpm --filter @vcwriter/web shots
 *
 * Builds the browser preview, serves it, loads each demo project into the
 * preview's own browser storage, opens it as a writer would, and saves the
 * workspace to public/modules/<slug>.jpg. Rerun it whenever a screen changes,
 * and every module page shows the program as it is.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { demoProjects } from './demo-projects.mjs';

const web = resolve(import.meta.dirname, '..', '..');
const desktop = resolve(web, '..', 'desktop');
const built = resolve(desktop, 'out', 'preview');
const target = resolve(web, 'public', 'modules');

/** Where each module's picture goes: the slug its page has. */
const SLUGS = {
  screenplay: 'screenplay',
  series: 'series',
  novel: 'novel',
  instructional: 'instructional',
  stage_play: 'stage-play',
  short_story: 'short-stories',
  short_form: 'short-form',
  document: 'document',
};

if (!process.argv.includes('--no-build')) {
  execSync('pnpm exec vite build --config vite.preview.config.ts', { cwd: desktop, stdio: 'inherit' });
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.aff': 'text/plain', '.dic': 'text/plain' };

const server = createServer((request, response) => {
  const path = decodeURIComponent((request.url ?? '/').split('?')[0]).replace(/^\/preview\/?/, '');
  let file = resolve(built, path || 'preview.html');
  if (!file.startsWith(built) || !existsSync(file) || statSync(file).isDirectory()) file = resolve(built, 'preview.html');
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((done) => server.listen(0, done));
const base = `http://127.0.0.1:${server.address().port}/preview/`;

mkdirSync(target, { recursive: true });
const projects = demoProjects();
// A Chromium installed outside Playwright's own cache can be named here.
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});

try {
  for (const [format, file] of Object.entries(projects)) {
    const slug = SLUGS[format];
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(base);
    await page.waitForLoadState('networkidle');
    // Into the preview's own library, as if it had been saved there.
    await page.evaluate(async (record) => {
      await new Promise((done, fail) => {
        const opening = indexedDB.open('vcwriter-preview', 2);
        opening.onupgradeneeded = () => {
          const db = opening.result;
          if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'path' });
          if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('path', 'path');
        };
        opening.onerror = () => fail(opening.error);
        opening.onsuccess = () => {
          const tx = opening.result.transaction('projects', 'readwrite');
          tx.objectStore('projects').put(record);
          tx.oncomplete = () => {
            opening.result.close();
            done();
          };
          tx.onerror = () => fail(tx.error);
        };
      });
    }, { path: `browser://${file.project.title}.vcw`, file, contentHash: 'demo', savedAt: new Date().toISOString() });
    await page.reload();
    await page.waitForLoadState('networkidle');
    // The preview's own build strip is not part of the program.
    await page.addStyleTag({ content: '.preview-strip { display: none !important; }' });
    await page.getByText(file.project.title, { exact: false }).first().click();
    await page.waitForTimeout(2500);
    const out = resolve(target, `${slug}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
    console.log(`${slug}: ${out}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
