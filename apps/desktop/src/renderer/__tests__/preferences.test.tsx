// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { applyScheme, SCHEMES, schemeById } from '../themes';
import { Preferences } from '../components/Preferences';

afterEach(cleanup);

describe('colour schemes', () => {
  it('puts a scheme on the root as the tokens the stylesheet reads', () => {
    const root = document.createElement('div');
    applyScheme('slate', root);
    expect(root.style.getPropertyValue('--gold')).toBe(schemeById('slate').tokens.gold);
    expect(root.style.getPropertyValue('--ink')).toBe('#0f141b');
    expect(root.dataset['scheme']).toBe('slate');

    applyScheme('parchment', root);
    expect(root.style.colorScheme).toBe('light');
  });

  it('falls back to the brand scheme for an unknown id', () => {
    expect(schemeById('neon').id).toBe('gold');
    expect(SCHEMES.map((scheme) => scheme.id)).toEqual([
      'gold',
      'graphite',
      'slate',
      'parchment',
      'green',
      'cobalt',
    ]);
  });

  /**
   * **The accent tokens are a shape, and getting it backwards is invisible.**
   * `goldBright` is the most emphatic against the surface, so on a dark scheme
   * it is lighter than `gold` and on a light one it is darker; `goldDeep` is a
   * fill and goes the other way. A scheme that read the names literally would
   * print its most important words at its lowest contrast and nothing would
   * fail — so this asks it of **every** scheme, which is how the next one is
   * covered the day it is written.
   */
  it('keeps bright emphatic and deep a fill, whichever way the scheme runs', () => {
    const lum = (hex: string): number => {
      const channel = (at: number): number => {
        const c = parseInt(hex.slice(at, at + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    };

    // Named in the result rather than compared bare, so a failure says which
    // scheme has it backwards rather than that a 1 was a -1.
    const way = SCHEMES.map((scheme) => {
      const { gold, goldBright, goldDeep } = scheme.tokens;
      return {
        id: scheme.id,
        bright: Math.sign(lum(goldBright) - lum(gold)),
        deep: Math.sign(lum(goldDeep) - lum(gold)),
      };
    });

    expect(way).toEqual(
      SCHEMES.map((scheme) => ({
        id: scheme.id,
        bright: scheme.appearance === 'dark' ? 1 : -1,
        deep: scheme.appearance === 'dark' ? -1 : 1,
      })),
    );
  });

  /** The two Ken asked for, by the colours his references actually carry. */
  it('carries the green and the cobalt', () => {
    expect(schemeById('green').appearance).toBe('light');
    expect(schemeById('green').tokens.goldDeep).toBe('#3fb950');
    expect(schemeById('cobalt').appearance).toBe('dark');
    expect(schemeById('cobalt').tokens.goldDeep).toBe('#0075f8');
  });
});

describe('preferences panel', () => {
  it('offers every scheme and the paper toggle, and reports choices', () => {
    const onScheme = vi.fn();
    const onPaper = vi.fn();
    render(<Preferences open onClose={() => undefined} scheme="gold" onScheme={onScheme} paper onPaper={onPaper}
          beatsPerColumn={5}
          onBeatsPerColumn={() => {}} />);

    // Every scheme, read off the list rather than counted here — the literal
    // 4 was what made adding one an edit to a test about something else.
    expect(screen.getAllByRole('radio')).toHaveLength(SCHEMES.length);
    expect(screen.getByRole('radio', { name: /Gold/ }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: /Graphite/ }));
    expect(onScheme).toHaveBeenCalledWith('graphite');

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onPaper).toHaveBeenCalledWith(false);
  });
});
