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
    expect(root.style.getPropertyValue('--ink')).toBe(schemeById('slate').tokens.ink);
    expect(root.dataset['scheme']).toBe('slate');

    applyScheme('parchment', root);
    expect(root.style.colorScheme).toBe('light');
  });

  it('falls back to the brand scheme for an unknown id', () => {
    expect(schemeById('neon').id).toBe('gold');
    expect(SCHEMES.map((scheme) => scheme.id)).toEqual([
      'gold',
      'finaldraft',
      'windows',
      'slate',
      'parchment',
      'green',
    ]);
    // A saved choice of a scheme that has gone falls back to Gold.
    expect(schemeById('cobalt').id).toBe('gold');
    expect(schemeById('graphite').id).toBe('gold');
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

  /**
   * **Bold, not washed out** (from Ken: *the blacks are faded … more
   * contrast with dark blacks and bolder color*). Asked of every scheme, so
   * the next one is held to it the day it is written.
   */
  it('keeps every scheme high in contrast', () => {
    const lum = (hex: string): number => {
      const channel = (at: number): number => {
        const c = parseInt(hex.slice(at, at + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    const weak = SCHEMES.flatMap((scheme) => {
      const t = scheme.tokens;
      const checks: Array<[string, number, number]> = [
        ['text on ink', ratio(t.text, t.ink), 7],
        ['text on panel', ratio(t.text, t.panel), 7],
        ['muted on panel', ratio(t.muted, t.panel), 4.5],
        ['accent on panel', ratio(t.gold, t.panel), 4.5],
      ];
      return checks.filter(([, got, want]) => got < want).map(([what, got]) => `${scheme.id}: ${what} ${got.toFixed(2)}`);
    });
    expect(weak).toEqual([]);
  });

  it('carries the Final Draft and Windows looks Ken asked for', () => {
    expect(schemeById('finaldraft').appearance).toBe('light');
    expect(schemeById('windows').tokens.goldDeep).toBe('#0078d4');
    expect(schemeById('green').appearance).toBe('light');
  });
});

describe('preferences panel', () => {
  it('offers every scheme and the paper toggle, and reports choices', () => {
    const onScheme = vi.fn();
    const onPaper = vi.fn();
    render(<Preferences open onClose={() => undefined} scheme="gold" onScheme={onScheme} paper onPaper={onPaper} />);

    // Every scheme, read off the list rather than counted here — the literal
    // 4 was what made adding one an edit to a test about something else.
    expect(screen.getAllByRole('radio')).toHaveLength(SCHEMES.length);
    expect(screen.getByRole('radio', { name: /Gold/ }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: /Windows style/ }));
    expect(onScheme).toHaveBeenCalledWith('windows');

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onPaper).toHaveBeenCalledWith(false);
  });
});
