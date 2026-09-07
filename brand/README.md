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

Cut from the square icon artwork in [`logo/`](logo/README.md) by
`node brand/logo/icons.mjs`; the script writes them straight into the
applications and, with `PREVIEW_DIR` set, a strip showing each one at the
size it is actually seen at.

| Output | Size | Notes |
| --- | --- | --- |
| `apps/desktop/build/icon.png` | 1024 | Windows: full-bleed square; electron-builder derives the `.ico` |
| `apps/desktop/build/icon-mac.png` | 1024 | macOS: the art inside a black rounded tile with transparent corners, on Apple's grid; electron-builder derives the `.icns` |
| `apps/web/src/app/icon.png` | 192 | Favicon, full-bleed |
| `apps/web/src/app/apple-icon.png` | 180 | iOS home screen; iOS rounds it itself |
| `apps/web/public/notes-icon-512.png` | 512 | VC Writer Notes install icon |
| `apps/web/public/notes-icon-maskable-512.png` | 512 | Same, with the art inside the 80% safe circle for Android's masks |
