# Logo files

The two illustrated lockups. These are the brand's primary identity from here
on — for the website, the applications, the store listings and anything that
comes after. The drawn SVG marks in `apps/web/src/app/wordmark.tsx` and
`apps/desktop/src/renderer/components/Brand.tsx` were placeholders standing in
until these existed.

Drop the files in this directory under exactly these names. The build copies
them into `apps/web/public/`; nothing reads them from here at runtime.

| File | Shape | Where it is used |
| --- | --- | --- |
| `vc-writer-horizontal.png` | wide, roughly 2.4 : 1 — the deco graphic on the left, `VC WRITER` on its plaque to the right | site header, email headers, anywhere with a wide strip |
| `vc-writer-stacked.png` | roughly square — the graphic above, `VC WRITER` on its plaque beneath | **the main logo**: landing hero, application splash, store listings, app icon source |

## Requirements

**A real alpha channel, not a matte.** This is the one that goes wrong. A PNG
exported over a white or black background still has fully opaque pixels; it
just happens to be the same colour as whatever it was exported against. Dropped
onto the site's near-black `--ink`, a white-matted logo renders as a bright
white rectangle around the artwork.

To check, on any machine with ImageMagick:

```sh
magick identify -format '%[channels]\n' vc-writer-stacked.png   # wants "srgba", not "srgb"
```

Or open it in a viewer that shows a checkerboard behind transparency. If the
area around the artwork is checkerboard, it is right; if it is solid white or
solid black, it needs re-exporting with transparency.

**Size.** At least 2000 px on the long edge for the horizontal lockup and at
least 1600 px square for the stacked one. They are downscaled for every use, so
larger is safe; smaller cannot be recovered.

**Nothing baked in.** No drop shadow onto a background colour, no outer glow
that assumes a dark backdrop, no padding beyond the artwork's own bounds. The
spotlights and stepped plinth that are part of the illustration are fine — they
are part of the drawing.

## Adding them

The quickest route, no tools needed:

1. Open <https://github.com/kshank999-wq/VCWriter> and switch to the branch
   `claude/vc-writer-dev-spec-ymc7zy`.
2. Navigate into `brand/logo/`.
3. **Add file → Upload files**, drag both PNGs in, commit to that branch.

Renaming them to the two names above before uploading saves a step, but it is
not essential — they can be renamed in place afterwards.
