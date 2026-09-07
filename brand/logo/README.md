# Logo files

The two illustrated lockups. These are the brand's primary identity from here
on — for the website, the applications, the store listings and anything that
comes after. The drawn SVG marks in `apps/web/src/app/wordmark.tsx` and
`apps/desktop/src/renderer/components/Brand.tsx` were placeholders standing in
until these existed.

| File | Canvas | Artwork | Used for |
| --- | --- | --- | --- |
| `VC-Writer-Horizontal-Transparent.png` | 1983 × 793 | 1841 × 571 at (72, 72) | site header |
| `VC-Writer-Stacked-Transparent.png` | 1254 × 1254 | 1235 × 966 at (10, 118) | **the main logo**: landing hero |

Both are RGBA with genuine transparency — all four corners measure alpha 0,
and a little over half of each canvas is fully transparent.

Nothing serves these directly: at 2.2 MB and 1.4 MB they are the masters.
`node brand/logo/derive.mjs` cuts what the site loads into
`apps/web/public/`, and that script carries the reasoning for the crop
boxes and the format. Re-run it after replacing a master; do not hand-edit
its outputs.

## If you replace a master

**A real alpha channel, not a matte.** A PNG exported over white still has
fully opaque pixels; it just happens to be white. On this site's near-black
ground that renders as a bright rectangle around the artwork. Check with:

```sh
magick identify -format '%[channels]\n' VC-Writer-Stacked-Transparent.png   # wants "srgba"
```

**Re-measure the crop boxes.** `derive.mjs` hard-codes the alpha bounding
boxes above. New artwork almost certainly sits differently on its canvas, and
a stale box will clip an edge or leave dead margin.

**At least 2000 px on the long edge.** Everything is downscaled from these, so
larger is safe and smaller cannot be recovered.
