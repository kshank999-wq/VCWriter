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

export type SchemeId = 'gold' | 'finaldraft' | 'windows' | 'slate' | 'parchment' | 'green';

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

/**
 * **Bold, not washed out** (from Ken, 7 November: *punch up the contrast in
 * the others — they seem faded, which is hard on the eyes when everything
 * looks washed out … the colors are not bold and the blacks are faded*).
 * Every dark scheme's ink is now close to true black, every light scheme's
 * type close to true black, and the accents are saturated. The test asks it
 * of every scheme: body text at least 7:1 on the ink, secondary text and the
 * accent at least 4.5:1 on a panel.
 *
 * Cobalt and Graphite are gone (Graphite read as the gold look in grey); a
 * saved choice of either falls back to Gold. Final Draft–style and
 * Windows-style are new, for writers who want the room they are used to; the
 * word processor already looks like Word.
 */
export const SCHEMES: readonly Scheme[] = [
  {
    id: 'gold',
    name: 'Gold',
    description: 'The VC Writer look: black, gold, a deep red.',
    appearance: 'dark',
    tokens: {
      ink: '#050402',
      panel: '#0e0c07',
      panel2: '#18150b',
      border: '#4a3c1c',
      gold: '#d4ad62',
      goldBright: '#f0d07a',
      goldDeep: '#8a6f2f',
      red: '#a11f1f',
      redDeep: '#4d0f0f',
      text: '#f6edd6',
      muted: '#b8a77d',
    },
  },
  {
    id: 'finaldraft',
    name: 'Final Draft style',
    description: 'Grey working chrome round a white page, with deep blue accents, like the screenwriting program most writers know.',
    appearance: 'light',
    tokens: {
      ink: '#a3a8b0',
      panel: '#dcdfe3',
      panel2: '#c9cdd3',
      border: '#7f868f',
      gold: '#0f3f8c',
      goldBright: '#062a63',
      goldDeep: '#2f74d0',
      red: '#a50f17',
      redDeep: '#e48a8f',
      text: '#07080a',
      muted: '#30353c',
    },
  },
  {
    id: 'windows',
    name: 'Windows style',
    description: 'The standard Windows look: white and light grey, black type, Windows blue.',
    appearance: 'light',
    tokens: {
      ink: '#eeeeee',
      panel: '#ffffff',
      panel2: '#e5e5e5',
      border: '#a8a8a8',
      gold: '#005a9e',
      goldBright: '#003b6f',
      goldDeep: '#0078d4',
      red: '#c42b1c',
      redDeep: '#f1a79f',
      text: '#000000',
      muted: '#3d3d3d',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Deep blue-black with a vivid sky accent.',
    appearance: 'dark',
    tokens: {
      ink: '#03060a',
      panel: '#0a1018',
      panel2: '#131d2a',
      border: '#36506d',
      gold: '#5db4ff',
      goldBright: '#a8d8ff',
      goldDeep: '#2a78c8',
      red: '#e5534b',
      redDeep: '#6e1f1f',
      text: '#f5f9fd',
      muted: '#adbfd3',
    },
  },
  {
    id: 'parchment',
    name: 'Parchment',
    description: 'A light interface: cream surfaces, near-black type, a strong bronze accent.',
    appearance: 'light',
    tokens: {
      ink: '#fbf6e9',
      panel: '#f1e7d1',
      panel2: '#e5d7b9',
      border: '#a8936a',
      gold: '#6a4a0e',
      goldBright: '#452f03',
      goldDeep: '#b8862b',
      red: '#9e1414',
      redDeep: '#d97a7a',
      text: '#0d0a04',
      muted: '#4a3f2b',
    },
  },
  {
    id: 'green',
    name: 'Green',
    description: 'A bright light interface: white cards on grey, black type, a bold green.',
    appearance: 'light',
    tokens: {
      ink: '#edf0f3',
      panel: '#ffffff',
      panel2: '#e1e5ea',
      border: '#b3bcc8',
      gold: '#0e6a2a',
      goldBright: '#074d1c',
      goldDeep: '#2ea043',
      red: '#b42318',
      redDeep: '#e08a82',
      text: '#06090d',
      muted: '#3b4452',
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
