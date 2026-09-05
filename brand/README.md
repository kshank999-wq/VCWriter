# Promotional artboards

Poster and social graphics in the VC Film Studio style, drawn from the tokens
in [docs/brand.md](../docs/brand.md). Everything is one HTML file with a board
per format; the renderer opens it in Chromium and screenshots each board at its
exact pixel size.

```bash
pnpm --filter @vcwriter/brand render            # every board → exports/
pnpm --filter @vcwriter/brand render poster     # just the ones matching "poster"
```

| Board | Size | For |
| --- | --- | --- |
| `poster-2400x3600` | 2400 × 3600 | Print at 8 × 12 in (300 dpi) or 16 × 24 in (150 dpi) |
| `social-square-1080` | 1080 × 1080 | Instagram, Facebook |
| `social-square-features-1080` | 1080 × 1080 | A second post: what it does |
| `social-story-1080x1920` | 1080 × 1920 | Instagram/Facebook story, TikTok |
| `social-landscape-1200x630` | 1200 × 630 | Open Graph preview, X, LinkedIn |
| `banner-1500x500` | 1500 × 500 | X / profile header |

## Application icons

`icon.html` holds the icons, rendered the same way:

```bash
BOARDS=icon.html pnpm --filter @vcwriter/brand render
```

| Board | Goes to | Notes |
| --- | --- | --- |
| `app-icon-1024` | `apps/desktop/build/icon.png` | Rounded tile with a margin, transparent corners; electron-builder derives `.icns` and `.ico` |
| `web-icon-512` | `apps/web/src/app/icon.png` | Favicon and PWA icon, full-bleed |
| `apple-icon-180` | `apps/web/src/app/apple-icon.png` | iOS rounds it itself |

The VC Writer Notes icons are hand-written SVG in `apps/web/public/`: the same
tile with the lines of a note in place of the monogram, so the two read as a
pair. One trap worth knowing: a gradient stroke on a perfectly horizontal path
renders as nothing, because the path has no height for the gradient to map
onto — the rules are solid gold for that reason.

`exports/` is committed so the finished files are downloadable from GitHub
without a checkout. To change a board, edit `artboards.html`, re-render, and
commit the new PNGs with it.

The fonts in `fonts/` are used only here (see `fonts/LICENSE.md`). The
applications use the system geometric stack instead, so nothing here changes
how the product looks.
