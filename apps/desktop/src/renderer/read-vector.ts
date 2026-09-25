import { openPdfDocument } from './pdf-runtime';

/**
 * A **PDF read as a picture** (addendum 20 §16a, from Ken: *the ISBN barcode
 * needs to be able to import a PDF, because that's how it's exported from the
 * actual vendor*).
 *
 * A retail barcode arrives from the vendor as vector artwork, and a data URI
 * of a PDF in an `<img>` draws nothing — in the room's preview, in the
 * exported PDF or in the eBook. So the page is **drawn once, here, at print
 * resolution**, and what the library keeps is an ordinary picture like every
 * other: the rest of the program needs to know nothing about PDFs, and
 * `barcodeResolution` reads the dots it is given and answers honestly.
 *
 * It renders at `TARGET_DPI` against the page's own size in points, so a
 * barcode drawn 2 inches wide comes in at 2 × 600 pixels rather than at
 * whatever a screen happens to be. That is the whole reason to rasterise
 * here rather than let the browser do it at 96.
 *
 * **Only the first page**, because a vendor's file is one mark. A PDF of a
 * whole cover would come in as its first page, which is what a writer who
 * chose it in a picture picker asked for.
 */

/** What a printer wants. A barcode at less than 300 is refused by retailers. */
const TARGET_DPI = 600;

/** A PDF page is measured in points, 72 to the inch. */
const POINTS_PER_INCH = 72;

/** No side longer than this, so a poster-sized page cannot make a 200MB canvas. */
const MAX_SIDE = 6000;

/** Whether this file is one this reader can draw. */
export const isVectorPicture = (file: File): boolean =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

/**
 * Whether this is artwork we recognise and **cannot** draw, so the screen can
 * say what to do instead of reporting *not a picture file*.
 *
 * EPS is PostScript. Nothing in the app can rasterise it — pdf.js reads PDF
 * and Chromium reads neither — and there is no honest way to accept one: a
 * stored EPS would draw as an empty box in the preview, in the printed book
 * and in the eBook alike. So it is **refused with the one-step fix named**,
 * which is the only kind of refusal worth having.
 */
export const VECTOR_REFUSAL: Record<string, string> = {
  eps: 'An EPS cannot be drawn here. Open it and save it as a PDF — most vendors will send one if you ask, and any design app will export one.',
  ai: 'An Illustrator file cannot be drawn here. Save it as a PDF — Illustrator writes one directly.',
  ps: 'A PostScript file cannot be drawn here. Save it as a PDF and bring that in.',
};

export const vectorRefusal = (file: File): string | null => {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  return VECTOR_REFUSAL[extension] ?? null;
};

/**
 * The first page of a PDF, drawn at print resolution and handed back in the
 * shape `readPicture` gives — so the caller stores it exactly as it stores a
 * PNG, and nothing downstream learns that PDFs exist.
 */
export const readPdfPicture = async (file: File): Promise<{ data: string; width: number; height: number }> => {
  const bytes = await file.arrayBuffer();
  const { document, done } = await openPdfDocument(bytes);
  try {
    const page = await document.getPage(1);
    // The page at its own size, then scaled so an inch of paper becomes
    // TARGET_DPI pixels — capped, so a large page loses resolution rather
    // than the app losing memory.
    const natural = page.getViewport({ scale: 1 });
    const wanted = TARGET_DPI / POINTS_PER_INCH;
    const longest = Math.max(natural.width, natural.height) * wanted;
    const scale = longest > MAX_SIDE ? MAX_SIDE / Math.max(natural.width, natural.height) : wanted;
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    // **The canvas, not its context.** pdf.js takes one or the other and
    // says so: the context is the backwards-compatible form, kept for
    // callers that already had one. `background` is why the white is not
    // painted by hand — pdf.js clears the canvas itself, so a fill before
    // the render would be wiped, and a barcode that came in on transparent
    // would scan as nothing.
    await page.render({ canvas, viewport, background: '#ffffff' } as never).promise;
    return { data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally {
    await done();
  }
};
