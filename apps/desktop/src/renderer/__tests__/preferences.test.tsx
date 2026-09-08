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
    expect(SCHEMES.map((scheme) => scheme.id)).toEqual(['gold', 'graphite', 'slate', 'parchment']);
  });
});

describe('preferences panel', () => {
  it('offers every scheme and the paper toggle, and reports choices', () => {
    const onScheme = vi.fn();
    const onPaper = vi.fn();
    render(<Preferences open onClose={() => undefined} scheme="gold" onScheme={onScheme} paper onPaper={onPaper} />);

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: /Gold/ }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: /Graphite/ }));
    expect(onScheme).toHaveBeenCalledWith('graphite');

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onPaper).toHaveBeenCalledWith(false);
  });
});
