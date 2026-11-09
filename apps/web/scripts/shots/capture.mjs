/**
 * Take every screenshot on the shot list (addendum 35 §7, §8).
 *
 *   pnpm --filter @vcwriter/web shots                 all of them
 *   pnpm --filter @vcwriter/web shots -- sculptor     only the shots named
 *   pnpm --filter @vcwriter/web shots -- --no-build   reuse the last preview build
 *
 * Builds the browser preview, serves it, loads each shot's demo project into
 * the preview's own browser storage, opens it as a writer would, walks to the
 * screen the shot is of, and saves it to public/<out>/<id>.jpg. Rerun it
 * whenever a screen changes, and every picture shows the program as it is.
 * A shot that cannot reach its screen fails loudly rather than saving the
 * wrong one.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { demoProjects } from './demo-projects.mjs';
import { PHONE_NOTES, SHOTS } from './shot-list.mjs';

const web = resolve(import.meta.dirname, '..', '..');
const desktop = resolve(web, '..', 'desktop');
const built = resolve(desktop, 'out', 'preview');
const publicDir = resolve(web, 'public');
const named = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const chosen = named.length > 0 ? SHOTS.filter((shot) => named.includes(shot.id)) : SHOTS;

if (!process.argv.includes('--no-build')) {
  execSync('pnpm exec vite build --config vite.preview.config.ts', { cwd: desktop, stdio: 'inherit' });
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.aff': 'text/plain',
  '.dic': 'text/plain',
};

const server = createServer((request, response) => {
  const path = decodeURIComponent((request.url ?? '/').split('?')[0]).replace(/^\/preview\/?/, '');
  let file = resolve(built, path || 'preview.html');
  if (!file.startsWith(built) || !existsSync(file) || statSync(file).isDirectory()) file = resolve(built, 'preview.html');
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((done) => server.listen(0, done));
const base = `http://127.0.0.1:${server.address().port}/preview/`;

const projects = demoProjects();
// A Chromium installed outside Playwright's own cache can be named here.
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});

/** Put a project into the preview's own library, as if it had been saved there. */
const store = (page, file) =>
  page.evaluate(
    async (record) => {
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
    },
    { path: `browser://${file.project.title}.vcw`, file, contentHash: 'demo', savedAt: new Date().toISOString() },
  );

const step = async (page, action) => {
  if (action.page) {
    await page.getByRole('navigation', { name: 'Pages' }).getByRole('button', { name: action.page, exact: true }).click({ timeout: 5000 });
  } else if (action.click) {
    await page.getByRole('button', { name: action.click, exact: true }).first().click({ timeout: 5000 });
  } else if (action.dblclickNth) {
    const [selector, index] = action.dblclickNth;
    await page.locator(selector).nth(index).dblclick({ timeout: 5000 });
  } else if (action.button) {
    await page.getByRole('button', { name: action.button }).locator('visible=true').first().click({ timeout: 5000 });
  } else if (action.tab) {
    await page.getByRole('tab', { name: action.tab }).first().click({ timeout: 5000 });
  } else if (action.select) {
    await page.getByText(action.select, { exact: true }).locator('visible=true').first().click({ timeout: 5000 });
  } else if (action.label) {
    await page.getByLabel(action.label, { exact: true }).first().click({ timeout: 5000 });
  } else if (action.key) {
    for (let n = 0; n < (action.times ?? 1); n += 1) await page.keyboard.press(action.key);
  } else if (action.open) {
    await page.getByText(action.open, { exact: false }).locator('visible=true').first().dblclick({ timeout: 5000 });
  }
  await page.waitForTimeout(action.wait ?? 900);
};

const failed = [];
try {
  for (const shot of chosen) {
    const file = projects[shot.project];
    if (!file) throw new Error(`${shot.id}: no demo project for ${shot.project}`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
    const page = await context.newPage();
    if (shot.phone) {
      // The notes the phone sent, as the site's inbox route would hand them over.
      const stamp = '2026-11-02T09:30:00.000Z';
      const notes = PHONE_NOTES.map((note, index) => ({
        id: `demo-capture-${index + 1}`,
        userId: 'demo-writer',
        projectId: file.project.id,
        source: 'mobile_voice',
        capturedAt: stamp,
        audioAssetId: null,
        transcriptConfidence: null,
        inference: null,
        requestedRouting: null,
        subcategory: null,
        storyMarkerId: null,
        filedInto: null,
        clearedFromPhoneAt: null,
        status: 'pending',
        reviewedAt: null,
        resultRef: null,
        syncedAt: stamp,
        createdAt: stamp,
        updatedAt: stamp,
        ...note,
      }));
      await page.route('**/api/notes/inbox**', (route) => {
        const url = new URL(route.request().url());
        const body = url.searchParams.has('archive')
          ? { notes: [] }
          : url.searchParams.has('all')
            ? { notes, projects: [{ id: file.project.id, title: file.project.title }] }
            : { notes };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
    }
    try {
      await page.goto(base);
      await page.waitForLoadState('networkidle');
      await store(page, file);
      await page.reload();
      await page.waitForLoadState('networkidle');
      // The preview's own build strip is not part of the program.
      await page.addStyleTag({ content: '.preview-strip { display: none !important; }' });
      if (shot.start !== 'welcome') {
        await page.getByText(file.project.title, { exact: false }).first().click();
      }
      await page.waitForTimeout(2500);
      for (const action of shot.steps ?? []) await step(page, action);
      const folder = resolve(publicDir, shot.out);
      mkdirSync(folder, { recursive: true });
      const out = resolve(folder, `${shot.id}.jpg`);
      await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
      console.log(`${shot.id}: ${out}`);
    } catch (error) {
      failed.push(shot.id);
      console.error(`${shot.id}: FAILED — ${String(error.message).split('\n')[0]}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (failed.length > 0) {
  console.error(`Not taken: ${failed.join(', ')}`);
  process.exit(1);
}
