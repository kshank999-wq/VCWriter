/**
 * Cuts every application icon from the square icon artwork.
 *
 *   node brand/logo/icons.mjs
 *
 * The source is a full-bleed 1024 square: black canvas, the gold double
 * frame inset about 14px, square corners, no alpha. That is exactly right for
 * Windows and for a browser tab, both of which draw icons square. It is wrong
 * for one place — the macOS Dock, where every icon since Big Sur is a rounded
 * tile with transparent corners. A rounded mask over this art would clip the
 * frame's corners, so the Mac variant scales the art to sit inside a black
 * rounded tile instead, which reads as a framed picture on a tile.
 *
 * The maskable PWA icon is the same idea for a different reason: Android may
 * cut any shape out of it, guaranteeing only a circle of 80% diameter. Square
 * art has to fit inside that circle, so it is drawn at 290px on a black 512.
 *
 * Outputs are committed; re-run after replacing the source. The preview strip
 * is written to PREVIEW_DIR when set, so the result can be judged at the
 * sizes it will actually be seen at — which is the only honest test.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const SOURCE = join(here, 'VC-Writer-Google-App-Logo-1024x1024.png');

const page = await (await chromium.launch(
  process.env['CHROMIUM_PATH'] ? { executablePath: process.env['CHROMIUM_PATH'] } : {},
)).newPage();
await page.setContent('<!doctype html><body>');

const src = `data:image/png;base64,${(await readFile(SOURCE)).toString('base64')}`;

/**
 * Draw one icon. `tile` puts the art inside a rounded black tile on a
 * transparent canvas (macOS); `safeCircle` puts it inside the maskable safe
 * zone on a black canvas (PWA). Neither: the art fills the canvas.
 */
const draw = (size, mode) =>
  page.evaluate(
    async ({ src, size, mode }) => {
      const image = new Image();
      image.src = src;
      await image.decode();

      // Halve down first so the final draw is never more than a 2x reduction;
      // a single big step aliases the gold linework.
      let stage = document.createElement('canvas');
      stage.width = image.width;
      stage.height = image.height;
      stage.getContext('2d').drawImage(image, 0, 0);
      const target = mode === 'tile' ? Math.round(size * 0.6836) : mode === 'safeCircle' ? Math.round(size * 0.566) : size;
      while (stage.width / 2 > target) {
        const next = document.createElement('canvas');
        next.width = Math.round(stage.width / 2);
        next.height = Math.round(stage.height / 2);
        const context = next.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(stage, 0, 0, next.width, next.height);
        stage = next;
      }

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';

      if (mode === 'tile') {
        // Apple's grid: the tile is 824/1024 of the canvas, corner radius ~185/1024.
        const tile = size * (824 / 1024);
        const radius = size * (185 / 1024);
        const offset = (size - tile) / 2;
        context.fillStyle = '#000000';
        context.beginPath();
        context.roundRect(offset, offset, tile, tile, radius);
        context.fill();
        const inset = (size - target) / 2;
        context.drawImage(stage, inset, inset, target, target);
      } else if (mode === 'safeCircle') {
        context.fillStyle = '#000000';
        context.fillRect(0, 0, size, size);
        const inset = (size - target) / 2;
        context.drawImage(stage, inset, inset, target, target);
      } else {
        context.drawImage(stage, 0, 0, size, size);
      }
      return canvas.toDataURL('image/png');
    },
    { src, size, mode },
  );

const save = async (relative, dataUrl) => {
  const path = join(repo, relative);
  await mkdir(dirname(path), { recursive: true });
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(path, bytes);
  console.log(`${relative.padEnd(48)} ${(bytes.length / 1024).toFixed(0)} kB`);
};

const OUTPUTS = [
  // Desktop: electron-builder derives .ico and .icns from these.
  { out: 'apps/desktop/build/icon.png', size: 1024, mode: 'square' },
  { out: 'apps/desktop/build/icon-mac.png', size: 1024, mode: 'tile' },
  // Website: Next's file conventions for the favicon and the iOS home-screen
  // icon. iOS applies its own rounding, so the Apple one stays square. The
  // favicon is 192, not 512: every first visit downloads it, a tab draws it
  // at 16-48px, and at 512 this artwork is 420kB of PNG.
  { out: 'apps/web/src/app/icon.png', size: 192, mode: 'square' },
  { out: 'apps/web/src/app/apple-icon.png', size: 180, mode: 'square' },
  // VC Writer Notes, the phone app, via its web manifest.
  { out: 'apps/web/public/notes-icon-512.png', size: 512, mode: 'square' },
  { out: 'apps/web/public/notes-icon-maskable-512.png', size: 512, mode: 'safeCircle' },
];

for (const entry of OUTPUTS) await save(entry.out, await draw(entry.size, entry.mode));

// The preview: each icon at the size it is actually seen at.
if (process.env['PREVIEW_DIR']) {
  const cells = [
    ['Tab 16', 16, 'square'],
    ['Tab 32', 32, 'square'],
    ['Taskbar 48', 48, 'square'],
    ['iOS 60', 60, 'square'],
    ['Win 128', 128, 'square'],
    ['Dock 128', 128, 'tile'],
    ['Maskable 96 in circle', 96, 'safeCircle'],
  ];
  const images = [];
  for (const [label, size, mode] of cells) images.push({ label, size, mode, data: await draw(size, mode) });
  await page.setContent(`<!doctype html><body style="margin:0;background:#1a1a1a;font:12px system-ui;color:#aaa">
    <div style="display:flex;gap:28px;padding:24px;align-items:flex-end">
      ${images
        .map(
          (image) => `<div style="text-align:center">
            <div style="height:140px;display:flex;align-items:flex-end;justify-content:center">
              <img src="${image.data}" width="${image.size}" height="${image.size}" style="${image.mode === 'safeCircle' ? 'border-radius:50%' : ''}">
            </div>
            <div style="margin-top:8px">${image.label}</div>
          </div>`,
        )
        .join('')}
    </div></body>`);
  await page.setViewportSize({ width: 900, height: 220 });
  await page.screenshot({ path: join(process.env['PREVIEW_DIR'], 'icon-strip.png') });
  console.log('preview written');
}

await page.context().browser().close();
