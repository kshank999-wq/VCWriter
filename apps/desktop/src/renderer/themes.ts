/**
 * Colour schemes for the interface (addendum 02 §12, Preferences).
 *
 * Every colour the stylesheets use is one of these tokens, so a scheme is a
 * set of token values and nothing more. "Gold" is the brand as docs/brand.md
 * defines it and the default; the others keep the same geometry and type and
 * change only the materials, for writers who want a neutral editing-room grey,
 * a cooler blue, or a light interface. The Script's paper is a separate
 * preference: a page is white under any scheme unless the writer says
 * otherwise.
 *
 * **The three accent tokens are a shape rather than three shades.** The names
 * are the brand's and the meaning is the stylesheet's: `gold` is the accent as
 * **type**, `goldBright` is the most **emphatic** against the surface, and
 * `goldDeep` is the accent as a **fill or an edge** (`background`,
 * `border-color`). So on a dark scheme bright is lighter and deep is darker,
 * and on a light one that inverts — Parchment's `goldBright` is its *darkest*
 * bronze, because what is emphatic on cream is dark. A scheme that read the
 * names literally would print its most important words at its lowest contrast.
 */

export type SchemeId = 'gold' | 'graphite' | 'slate' | 'parchment' | 'green' | 'cobalt';

export interface Scheme {
  id: SchemeId;
  name: string;
  description: string;
  /** Which way system controls (scrollbars, selects) should render. */
  appearance: 'dark' | 'light';
  tokens: {
    ink: string;
    panel: string;
    panel2: string;
    border: string;
    gold: string;
    goldBright: string;
    goldDeep: string;
    red: string;
    redDeep: string;
    text: string;
    muted: string;
  };
}

export const SCHEMES: readonly Scheme[] = [
  {
    id: 'gold',
    name: 'Gold',
    description: 'The VC Writer look: black, gold, a deep red.',
    appearance: 'dark',
    tokens: {
      ink: '#070604',
      panel: '#100e09',
      panel2: '#181509',
      border: '#3a3018',
      gold: '#c9a45c',
      goldBright: '#e8c872',
      goldDeep: '#8a6f2f',
      red: '#8b1c1c',
      redDeep: '#4d0f0f',
      text: '#f1e7cf',
      muted: '#a3946f',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Editing-room greys with a warm accent.',
    appearance: 'dark',
    tokens: {
      ink: '#19191b',
      panel: '#212124',
      panel2: '#2a2a2e',
      border: '#3b3b41',
      gold: '#d6a94e',
      goldBright: '#eec46e',
      goldDeep: '#9a7a35',
      red: '#a33a3a',
      redDeep: '#5a1e1e',
      text: '#e8e8e6',
      muted: '#9a9a9f',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Cool blue-grey with a sky accent.',
    appearance: 'dark',
    tokens: {
      ink: '#0f141b',
      panel: '#151c25',
      panel2: '#1d2631',
      border: '#2e3a48',
      gold: '#7fb2e5',
      goldBright: '#a6cbf1',
      goldDeep: '#4f7ba8',
      red: '#b04a4a',
      redDeep: '#5c2323',
      text: '#e4eaf1',
      muted: '#8d9bad',
    },
  },
  {
    id: 'parchment',
    name: 'Parchment',
    description: 'A light interface: cream surfaces, dark type, bronze accent.',
    appearance: 'light',
    tokens: {
      ink: '#f4f0e6',
      panel: '#ebe5d8',
      panel2: '#e1dac9',
      border: '#c9bfa8',
      gold: '#8a6f2f',
      goldBright: '#6b5522',
      goldDeep: '#a98b48',
      red: '#8b1c1c',
      redDeep: '#c46a6a',
      text: '#1f1a12',
      muted: '#6f6553',
    },
  },
  {
    id: 'green',
    name: 'Green',
    description: 'A bright light interface: white cards on grey, green accent.',
    appearance: 'light',
    // Sampled off Ken's reference rather than guessed at: the page is #f5f6f8,
    // the cards white, the rules #dfe2e8, the green #3fb950, the type #1b1f27.
    // The one thing the picture cannot say is which green goes in which token,
    // and that is the shape above: #3fb950 is lovely as a pill and reads at
    // 2.5:1 as text, so it is the **fill** and the darker greens carry the
    // words. This is the only scheme whose panel is *lighter* than its ink —
    // a white card on a grey page, which is what the reference draws.
    tokens: {
      ink: '#f5f6f8',
      panel: '#ffffff',
      panel2: '#eceef2',
      border: '#dfe2e8',
      gold: '#1a7f37',
      goldBright: '#116329',
      goldDeep: '#3fb950',
      red: '#b42318',
      redDeep: '#d98b84',
      text: '#1b1f27',
      muted: '#5f6877',
    },
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    description: 'Charcoal panels with a saturated blue, the way a cutting room looks.',
    appearance: 'dark',
    // The second reference, measured: #3d3d3d dialogs over #252527 panels,
    // white type, #939393 beside it, and a blue that is vivid rather than
    // Slate's soft one — #0075f8 on the button, #2579b1 on the chrome. The
    // **blue title bar is deliberately not reproduced**: a scheme is eleven
    // tokens, the bar is `--panel` like every other surface, and painting one
    // element from a picture would be a twelfth token nothing else could read.
    tokens: {
      ink: '#1b1b1d',
      panel: '#252527',
      panel2: '#3d3d3d',
      border: '#4a4a4e',
      gold: '#4ea1f0',
      goldBright: '#7cbcff',
      goldDeep: '#0075f8',
      red: '#cf5a4e',
      redDeep: '#5f2520',
      text: '#f0f1f2',
      muted: '#a0a0a4',
    },
  },
];

export const DEFAULT_SCHEME: SchemeId = 'gold';

export const schemeById = (id: string): Scheme => SCHEMES.find((scheme) => scheme.id === id) ?? SCHEMES[0]!;

const TOKEN_NAMES: Record<keyof Scheme['tokens'], string> = {
  ink: '--ink',
  panel: '--panel',
  panel2: '--panel-2',
  border: '--border',
  gold: '--gold',
  goldBright: '--gold-bright',
  goldDeep: '--gold-deep',
  red: '--red',
  redDeep: '--red-deep',
  text: '--text',
  muted: '--muted',
};

/**
 * Put a scheme's tokens on the root element. Inline custom properties win
 * over the stylesheet's `:root` block, so nothing in the CSS changes; the
 * default scheme is exactly the stylesheet's own values.
 */
export const applyScheme = (id: SchemeId, root: HTMLElement = document.documentElement): void => {
  const scheme = schemeById(id);
  for (const [key, name] of Object.entries(TOKEN_NAMES) as Array<[keyof Scheme['tokens'], string]>) {
    root.style.setProperty(name, scheme.tokens[key]);
  }
  root.style.colorScheme = scheme.appearance;
  root.dataset['scheme'] = scheme.id;
};
