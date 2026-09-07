/**
 * The illustrated lockups (docs/brand.md, brand/logo/).
 *
 * Plain `<img>` rather than `next/image`: these are two fixed-size decorative
 * assets already cut to the sizes they are drawn at by `brand/logo/derive.mjs`,
 * so the optimiser has nothing left to do and would only add a request through
 * `/_next/image` on every page. Width and height are stated so the header and
 * hero do not reflow as they load.
 */

const HORIZONTAL = { width: 720, height: 223 };
const STACKED = { width: 800, height: 626 };

/** The wide lockup, for the site header. */
export function Wordmark() {
  return (
    <img
      src="/logo-horizontal.webp"
      width={HORIZONTAL.width}
      height={HORIZONTAL.height}
      alt="VC Writer"
      className="wordmark-image"
      // The header is above the fold and is the page's first impression; the
      // browser should not wait to discover it.
      fetchPriority="high"
    />
  );
}

/**
 * The stacked lockup — the main mark — for the landing page hero.
 *
 * Empty alt: the headline beside it already says what the product is, and the
 * header's lockup has named it once. A screen reader repeating "VC Writer" a
 * third time is noise, so this is decorative.
 */
export function Emblem() {
  return (
    <img
      src="/logo-stacked.webp"
      width={STACKED.width}
      height={STACKED.height}
      alt=""
      className="emblem"
      fetchPriority="high"
    />
  );
}
