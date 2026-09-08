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
 */

export type SchemeId = 'gold' | 'graphite' | 'slate' | 'parchment';

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
