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
  /** The reading app's own default type size on this screen, in CSS pixels. */
  fontPx: number;
  note: string;
}

export const PREVIEW_DEVICES: readonly PreviewDevice[] = [
  { id: 'kindle', name: 'Kindle 6.8″', width: 412, height: 549, fontPx: 16, note: 'Paperwhite and Kindle: e-ink, one page at a time' },
  { id: 'kobo', name: 'Kobo / NOOK 6″', width: 429, height: 579, fontPx: 16, note: 'Kobo Clara and NOOK GlowLight' },
  { id: 'phone', name: 'Phone 6.1″', width: 390, height: 844, fontPx: 17, note: 'Kindle, Apple Books and Play Books on a phone' },
  // A tablet's reading app sets bigger type and wider margins than a phone's;
  // at a phone's sixteen pixels a page of a novel reads as a page of notes.
  { id: 'tablet', name: 'Tablet 11″', width: 820, height: 1180, fontPx: 21, note: 'iPad and Android tablets' },
];

/** The reader's font sizes, as a fraction of the reader's default. */
export const PREVIEW_SIZES: readonly number[] = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75];

const escapeText = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

  /**
   * **A page that is one picture** (§13) fills the screen: no reading-app
   * header or footer, no margins, the picture centred as large as it goes.
   */
  if (/class="art"/.test(bodyAttributes)) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html, body { margin: 0; padding: 0; width: ${device.width}px; height: ${device.height}px; overflow: hidden; background: #fff; }
#flow { width: ${device.width}px; height: ${device.height}px; display: flex; align-items: center; justify-content: center; }
#flow section { width: 100%; height: 100%; }
#flow div.art-page { height: ${device.height}px; }
#flow img { max-width: ${device.width}px; max-height: ${device.height}px; }
</style></head><body class="art"><div id="flow">${inner}</div></body></html>`;
  }

  /**
   * The reader's font size is the root's; everything in the stylesheet is
   * relative to it, which is the point of the stylesheet.
   *
   * **And the margins are the book's** (§12, from Ken: *the margins are right
   * at the edge… but the pictures aren't right to the edge*). The pagination
   * here is CSS columns, where a padding on the container falls outside
   * **all** the columns rather than inside each — so the body's own padding
   * has to be lifted onto the children, and the numbers lifted are the
   * stylesheet's rather than a second set invented here. Two answers to *how
   * wide is the margin* is exactly what made the preview disagree with the
   * file it exists to show.
   */
  const margins = pkg.margins ?? { side: '5%', head: '2em', foot: '2em' };
  /**
   * **What the reading app draws round every screen** (§13, from Ken: *on a
   * page with text, there's no room at the top or the bottom … and there's
   * no titles on the tops of each page*). A reflowable book cannot carry a
   * running head or a folio — the reading app draws its own, the title above
   * and where you are below — and every app keeps a band clear at the head
   * and foot of each screen. The preview draws the same bands, so the text
   * stops short of the edges on every screen and not only on the first.
   * `#folio` is filled in by the frame as it turns.
   */
  const band = Math.round(device.height * 0.065);
  const section = pkg.sections.find((one) => one.href === href);
  const running = section && (section.kind === 'chapter' || section.kind === 'body') ? section.title : pkg.metadata.title;
  const flowHeight = device.height - band * 2;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html { font-size: ${Math.round(size * device.fontPx)}px; }
html, body { margin: 0; padding: 0; width: ${device.width}px; height: ${device.height}px; overflow: hidden; background: #fff; position: relative; }
#head, #folio { position: absolute; left: 0; right: 0; height: ${band}px; line-height: ${band}px; text-align: center; font-size: ${Math.max(10, Math.round(device.fontPx * 0.7))}px; color: #777; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 ${margins.side}; box-sizing: border-box; font-family: inherit; }
#head { top: 0; font-style: italic; }
#folio { bottom: 0; }
#flow { position: absolute; top: ${band}px; left: 0; height: ${flowHeight}px; width: ${device.width}px; column-width: ${device.width}px; column-gap: 0; column-fill: auto; overflow: hidden; }
#flow > * { padding-left: ${margins.side}; padding-right: ${margins.side}; box-sizing: border-box; }
#flow > *:first-child { padding-top: ${margins.head}; }
#flow > *:last-child { padding-bottom: ${margins.foot}; }
/* The one cap that is the device's rather than the book's: a picture taller
   than the screen is a picture nobody can see. The width is the stylesheet's. */
#flow img { max-height: ${Math.round(flowHeight * 0.92)}px; }
#flow div.art-page { height: auto; }
/* A chapter inside a story starts a new screen, as the stylesheet's page break asks. */
#flow h2.section-open { break-before: column; }
</style></head><body><div id="head">${escapeText(running)}</div><div id="flow">${inner}</div><div id="folio"></div></body></html>`;
};

/** The sections a preview may turn to: the reading order, cover first. */
export const previewSections = (pkg: EbookPackage): { href: string; title: string }[] =>
  pkg.sections.filter((section) => section.id !== 'nav').map((section) => ({ href: section.href, title: section.title }));
