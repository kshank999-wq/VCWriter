import type { EbookPackage } from './ebook.js';

/**
 * The device preview (addendum 23 §9): the package's own files, shown at
 * the size of a screen a reader holds, with the reader's font size in the
 * reader's hand.
 *
 * It shows the *file*, not the book — the XHTML the package carries with
 * its stylesheet inlined and its pictures put back — so what is on the
 * screen is what the store receives, and a fault in the markup is seen here
 * rather than on a customer's Kindle. The pagination is one honest
 * approximation: a reflowable file is set in columns the width of the
 * screen and turned a column at a time, which is what a reading system does
 * and not what any one of them does exactly. A fixed-layout page is scaled
 * to fit, as every reader scales it.
 */

export interface PreviewDevice {
  id: string;
  name: string;
  /** The screen in CSS pixels, as a reading app lays them out (a 300 ppi e-ink screen is about a third of that). */
  width: number;
  height: number;
  note: string;
}

export const PREVIEW_DEVICES: readonly PreviewDevice[] = [
  { id: 'kindle', name: 'Kindle 6.8″', width: 412, height: 549, note: 'Paperwhite and Kindle: e-ink, one page at a time' },
  { id: 'kobo', name: 'Kobo / NOOK 6″', width: 429, height: 579, note: 'Kobo Clara and NOOK GlowLight' },
  { id: 'phone', name: 'Phone 6.1″', width: 390, height: 844, note: 'Kindle, Apple Books and Play Books on a phone' },
  { id: 'tablet', name: 'Tablet 11″', width: 820, height: 1180, note: 'iPad and Android tablets' },
];

/** The reader's font sizes, as a fraction of the reader's default. */
export const PREVIEW_SIZES: readonly number[] = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75];

const pictureUrls = (pkg: EbookPackage): Map<string, string> => {
  const map = new Map<string, string>();
  for (const image of pkg.images) map.set(image.href, image.dataUrl);
  if (pkg.cover) map.set(pkg.cover.href, pkg.cover.dataUrl);
  return map;
};

const cssOf = (pkg: EbookPackage): string => {
  const css = pkg.entries.find((entry) => entry.path.endsWith('.css'));
  return css && typeof css.data === 'string' ? css.data : '';
};

/**
 * One section of the package as a document for a frame the size of the
 * device: the stylesheet inlined, the pictures put back, the reader's font
 * size applied. A reflowable section is set in screen-wide columns inside
 * `#flow`; the frame turns them by scrolling that element a screen at a
 * time and counts them by its width.
 */
export const previewDocument = (pkg: EbookPackage, href: string, device: PreviewDevice, size = 1): string | null => {
  const entry = pkg.entries.find((one) => one.path === `OEBPS/${href}`);
  if (!entry || typeof entry.data !== 'string') return null;
  const pictures = pictureUrls(pkg);
  const base = href.split('/').slice(0, -1);
  const resolve = (relative: string): string => {
    const parts = [...base];
    for (const piece of relative.split('/')) {
      if (piece === '..') parts.pop();
      else if (piece !== '.') parts.push(piece);
    }
    return parts.join('/');
  };
  const body = /<body([^>]*)>([\s\S]*)<\/body>/.exec(entry.data);
  if (!body) return null;
  const bodyAttributes = body[1] ?? '';
  const inner = (body[2] ?? '').replace(/(src|href)="([^"]+)"/g, (whole, attribute: string, value: string) => {
    if (attribute !== 'src') return whole;
    const url = pictures.get(resolve(value));
    return url ? `src="${url}"` : whole;
  });
  const css = cssOf(pkg);

  if (pkg.layout === 'fixed' && pkg.pages) {
    const scale = Math.min(device.width / pkg.pages.width, device.height / pkg.pages.height);
    return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html, body { width: ${device.width}px; height: ${device.height}px; background: #444; overflow: hidden; }
#page { width: ${pkg.pages.width}px; height: ${pkg.pages.height}px; transform: scale(${scale.toFixed(4)}); transform-origin: top left; position: absolute; left: ${((device.width - pkg.pages.width * scale) / 2).toFixed(1)}px; top: ${((device.height - pkg.pages.height * scale) / 2).toFixed(1)}px; background: #fff; }
</style></head><body${bodyAttributes}><div id="page">${inner}</div></body></html>`;
  }

  // The reader's font size is the root's; everything in the stylesheet is
  // relative to it, which is the point of the stylesheet.
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html { font-size: ${Math.round(size * 100)}%; }
html, body { margin: 0; padding: 0; width: ${device.width}px; height: ${device.height}px; overflow: hidden; background: #fff; }
#flow { height: ${device.height}px; width: ${device.width}px; column-width: ${device.width}px; column-gap: 0; column-fill: auto; overflow: hidden; }
#flow > * { padding-left: 5%; padding-right: 5%; box-sizing: border-box; }
#flow img { max-width: 90%; max-height: ${Math.round(device.height * 0.9)}px; }
</style></head><body><div id="flow">${inner}</div></body></html>`;
};

/** The sections a preview may turn to: the reading order, cover first. */
export const previewSections = (pkg: EbookPackage): { href: string; title: string }[] =>
  pkg.sections.filter((section) => section.id !== 'nav').map((section) => ({ href: section.href, title: section.title }));
