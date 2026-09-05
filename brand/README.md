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

`exports/` is not committed — it is a build product, and a poster PNG is ten
megabytes. To change a board, edit `artboards.html` and re-render.

The fonts in `fonts/` are used only here (see `fonts/LICENSE.md`). The
applications use the system geometric stack instead, so nothing here changes
how the product looks.
