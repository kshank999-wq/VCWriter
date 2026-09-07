/**
 * Cuts the web and application assets from the two source lockups.
 *
 *   node brand/logo/derive.mjs
 *
 * The sources are 1983x793 and 1254x1254 at 2.2MB and 1.4MB. Serving either
 * to a browser to draw a 52px-tall header would be absurd, so everything the
 * site loads is derived here and committed. Re-run this after replacing a
 * source; do not hand-edit the outputs.
 *
 * Two things this does that a plain resize would not:
 *
 * 1. Crops to the artwork's alpha bounding box first. Both sources carry dead
 *    transparent margin — the horizontal one has 72px at the top and 150px at
 *    the bottom, so laying it out by its canvas would sit the artwork visibly
 *    high in its box and waste a fifth of the height.
 *
 * 2. Halves repeatedly before the final draw. One big downscale in a single
 *    step aliases the fine gold linework — the fluted arc and the typewriter
 *    keys are exactly the frequencies that break up.
 *
 * Chromium rather than a native image library because Playwright is already a
 * dependency here and an ImageMagick or Pillow install is not.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

const HORIZONTAL = join(here, 'VC-Writer-Horizontal-Transparent.png');
const STACKED = join(here, 'VC-Writer-Stacked-Transparent.png');

/** Alpha bounding boxes, measured from the sources. */
const CROP = {
  horizontal: { x: 72, y: 72, width: 1841, height: 571 },
  stacked: { x: 10, y: 118, width: 1235, height: 966 },
};

/**
 * WebP, not PNG. These are gradient-heavy illustrations — brushed gold, soft
 * spotlight bloom — which is close to the worst case for PNG's lossless
 * palette. Measured on this artwork: the header lockup is 267 kB as PNG and
 * 46 kB as WebP at q0.92, and the hero 693 kB against 94 kB. A seven-fold
 * saving on every page load is not worth arguing about, and WebP with alpha
 * has been in every browser since Safari 14.
 */
const OUTPUTS = [
  {
    source: HORIZONTAL,
    crop: CROP.horizontal,
    out: 'apps/web/public/logo-horizontal.webp',
    width: 720,
    note: 'header, drawn at up to 240px wide — 3x',
  },
  {
    source: STACKED,
    crop: CROP.stacked,
    out: 'apps/web/public/logo-stacked.webp',
    width: 800,
    note: 'landing hero, drawn at up to 360px wide',
  },
];

const QUALITY = 0.92;

const page = await (await chromium.launch(
  process.env['CHROMIUM_PATH'] ? { executablePath: process.env['CHROMIUM_PATH'] } : {},
)).newPage();

const dataUrl = async (path) => `data:image/png;base64,${(await readFile(path)).toString('base64')}`;

/**
 * Draw in the page: crop, halve down to within 2x of the target, then the
 * final draw. `fit` letterboxes into a square instead of filling the width.
 */
const render = async (source, crop, target, fit, quality) =>
  page.evaluate(
    async ({ src, crop, target, fit, quality }) => {
      const image = new Image();
      image.src = src;
      await image.decode();

      const make = (w, h) => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        return { canvas, context };
      };

      // Crop to the artwork.
      let { canvas, context } = make(crop.width, crop.height);
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

      const scale = fit
        ? Math.min(target.width / crop.width, target.height / crop.height)
        : target.width / crop.width;
      const finalWidth = Math.round(crop.width * scale);
      const finalHeight = Math.round(crop.height * scale);

      // Halve until one more halving would undershoot.
      while (canvas.width / 2 > finalWidth) {
        const next = make(Math.max(1, Math.round(canvas.width / 2)), Math.max(1, Math.round(canvas.height / 2)));
        next.context.drawImage(canvas, 0, 0, next.canvas.width, next.canvas.height);
        canvas = next.canvas;
        context = next.context;
      }

      const out = make(target.width, target.height ?? finalHeight);
      out.context.drawImage(
        canvas,
        Math.round((out.canvas.width - finalWidth) / 2),
        Math.round((out.canvas.height - finalHeight) / 2),
        finalWidth,
        finalHeight,
      );
      return out.canvas.toDataURL('image/webp', quality);
    },
    { src: source, crop, target, fit, quality },
  );

const save = async (target, base64) => {
  const path = join(repo, target);
  await writeFile(path, Buffer.from(base64.split(',')[1], 'base64'));
  const { size } = await import('node:fs/promises').then((fs) => fs.stat(path));
  return size;
};

await page.setContent('<!doctype html><body>');

for (const entry of OUTPUTS) {
  const src = await dataUrl(entry.source);
  const height = Math.round((entry.crop.height / entry.crop.width) * entry.width);
  const image = await render(src, entry.crop, { width: entry.width, height }, false, QUALITY);
  const size = await save(entry.out, image);
  console.log(`${entry.out.padEnd(40)} ${entry.width}x${height}  ${(size / 1024).toFixed(0)} kB   (${entry.note})`);
}

await page.context().browser().close();
