# Brand

VC Writer is a companion to VC Film Studio and shares its look: black, gold and
a deep red, in an art deco register. The mark is a stepped, gilded frame with a
sunburst behind it; the interface borrows the materials and the geometry, not
the ornament — a writing tool has to get out of the way, and a screen covered
in filigree does not.

## Palette

Taken from the VC Film Studio mark. Every value below is defined once as a
custom property in each application's stylesheet; nothing in a component
names a colour directly.

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#070604` | The page. Not pure black: a whisper of warmth so gold reads as metal, not yellow |
| `--panel` | `#100e09` | Raised surfaces: sidebars, cards, the title bar |
| `--panel-2` | `#181509` | A second step up: inputs, hovered rows, group headers |
| `--border` | `#3a3018` | Hairlines. Dark gold-brown rather than grey, so rules belong to the palette |
| `--gold` | `#c9a45c` | The working accent: headings, selected states, primary buttons |
| `--gold-bright` | `#e8c872` | Highlights, hover, the top edge of a gradient |
| `--gold-deep` | `#8a6f2f` | Shadowed gold, secondary rules |
| `--red` | `#8b1c1c` | The one warm counterpoint: destructive actions, the deco diamond, "used" markers |
| `--red-deep` | `#4d0f0f` | Shadowed red |
| `--text` | `#f1e7cf` | Body text: cream, not white |
| `--muted` | `#a3946f` | Secondary text, labels, counts |

The manuscript page in print preview stays white with black text. It is a
representation of paper and is exempt from the palette.

## Type

Headings are geometric, uppercase and letter-spaced — the deco convention. No
web font is loaded: the site's content security policy allows no external
fonts, and the desktop should not depend on a download either. The stack picks
up Futura or Avenir on macOS and Century Gothic on Windows, and falls back to
the system geometric sans.

```css
--display: 'Futura', 'Avenir Next', 'Century Gothic', 'Josefin Sans', 'Segoe UI', system-ui, sans-serif;
```

Body text is the system sans. The manuscript is Courier, because that is what
a screenplay is.

Heading rules: uppercase, `letter-spacing: 0.18em`, weight 600, gold. Section
labels the same at 11–12px in `--muted`.

## Geometry

- Corners are square or barely rounded (2px). Deco is straight lines.
- Rules are 1px hairlines in `--border`; an important rule is a double line —
  1px gold, 3px gap, 1px `--gold-deep`.
- The stepped corner motif from the mark appears once per surface at most, as
  a `::before` on a card or a header, never on every element.
- One red element per screen is enough.

## Layout

The desktop workspace follows the layout of a beat-based screenwriting board:
the manuscript on the left, and on the right a timeline strip of every beat in
story order above the lanes, where each lane is a horizontal row of scene
groups and each group is a column of stacked beats. Selecting a beat anywhere
opens it on the left.

## The logo

Two illustrated lockups, in [`brand/logo/`](../brand/logo/README.md):

- **Stacked** — the deco graphic with `VC WRITER` on its plaque beneath, on a
  transparent ground. This is *the* logo: the landing hero, the application
  splash, store listings, and the source the app icon is cut from.
- **Horizontal** — the same graphic with the plaque set to its right, for
  headers and any other wide strip.

Both are raster artwork — a gold art deco `VC` monogram against a fluted
sunburst, a period typewriter with a page in the platen, a stack of pages, and
a pair of stage lights throwing beams from the stepped plinth. Reach for the
stacked one unless the space is genuinely wider than it is tall.

### The drawn wordmark

Before those files existed both applications drew "VC WRITER" as inline SVG —
the display stack inside a stepped gold frame with the red deco diamond
beneath. That mark survives where an image would be wrong: anywhere a
downloaded asset cannot be relied on, and at sizes too small for the
illustration to read. It is deliberately a sibling of the VC Film Studio mark
rather than a copy — the two products should look related, not identical.

## Promotional material

A poster and a set of social graphics in this style live in
[`brand/`](../brand/README.md), rendered from the same tokens. They use Josefin
Sans and Limelight — both OFL — because a baked-in image needs a genuinely deco
face, whereas the applications must not depend on a font download.
