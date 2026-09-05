import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * Renders every artboard in artboards.html to brand/exports/<name>.png at its
 * exact pixel size.
 *
 *   node brand/render.mjs            # all boards
 *   node brand/render.mjs poster     # boards whose name contains "poster"
 *
 * Served over a local HTTP port rather than file:// so the @font-face files
 * load. Set CHROMIUM_PATH to use a specific browser binary.
 */

const root = fileURLToPath(new URL('.', import.meta.url));
const filter = process.argv[2] ?? '';
const TYPES = { '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png' };

const server = createServer(async (request, response) => {
  const path = join(root, decodeURIComponent(new URL(request.url, 'http://x').pathname));
  try {
    const body = await readFile(path);
    response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

await mkdir(join(root, 'exports'), { recursive: true });

const browser = await chromium.launch(
  process.env['CHROMIUM_PATH'] ? { executablePath: process.env['CHROMIUM_PATH'] } : {},
);
const page = await browser.newPage({ viewport: { width: 2600, height: 1200 }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/artboards.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const boards = await page.$$('.board');
for (const board of boards) {
  const name = await board.getAttribute('data-name');
  if (!name.includes(filter)) continue;
  await board.screenshot({ path: join(root, 'exports', `${name}.png`) });
  console.log(`✓ exports/${name}.png`);
}

await browser.close();
server.close();
