/**
 * A part of the program that is fetched when it is first needed
 * (addendum 33 §9).
 *
 * Nearly all of the renderer is one bundle. **The PDF reader is not**, pdf.js
 * being a megabyte and a half that most sittings never want — and the price of
 * that split is a failure a writer cannot act on. A chunk is named by a hash
 * of its contents, so a deployment replaces every one of them; a page that has
 * been open since before the last deployment asks for a file that is no longer
 * there, and the browser says *Failed to fetch dynamically imported module*,
 * to somebody who has just chosen a file.
 *
 * So it is **said rather than thrown**. `late` wraps the `import()` and
 * nothing else, which is what makes the reading honest: the modules behind it
 * do no work at load, so anything that comes out of here is the fetch and not
 * the module. Where a split buys little — the Word reader is under three
 * kilobytes — the answer is not a better sentence but no split at all, and
 * those readers are imported plainly.
 */

/**
 * Said where a part of the program could not be fetched. It names the usual
 * cause rather than only the symptom, because *reload the page* is the whole
 * of what a writer can do about it — and it is true of a dropped connection
 * too, which is why it says *usually*.
 */
export const STALE_PAGE_REFUSAL =
  'Part of the program could not be loaded. VC Writer was most likely updated after this page was opened. Reload the page and try again.';

/**
 * Said at the top of the window where this page has outlived the deployment
 * it was opened against — **before** anything is pressed, which is the whole
 * point: the refusal above is honest and arrives too late to be useful, since
 * by then the writer has chosen a file and been turned away. It states the
 * fact and the button does the act; telling somebody to reload is an
 * instruction rather than a fix.
 */
export const BUILD_MOVED_ON =
  'VC Writer has been updated. This page is still running the version it opened with.';

/**
 * Whether an answer about this page's own entry script says the deployment has
 * moved on. **Only a flat refusal counts**: a hashed file that is gone is gone,
 * while a timeout, a 500 or no network at all is the page failing to ask and is
 * no evidence that anything changed (addendum 32 §8's rule — being unable to
 * ask is not a lapse).
 */
export const buildMovedOn = (status: number): boolean => status === 404 || status === 410;

/** Fetch a part of the program, and say so where it cannot be had. */
export const late = async <T>(load: () => Promise<T>): Promise<T> => {
  try {
    return await load();
  } catch (cause) {
    // The writer gets the sentence; the console keeps what actually happened,
    // which is a chunk name and of no use to anybody reading a dialog.
    console.error('A part of the program did not load', cause);
    throw new Error(STALE_PAGE_REFUSAL);
  }
};
