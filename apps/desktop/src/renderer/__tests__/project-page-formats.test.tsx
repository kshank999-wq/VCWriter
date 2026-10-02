// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { builtElsewhere } from '@vcwriter/domain';
import { Welcome } from '../components/Welcome';

afterEach(cleanup);

/**
 * The project page's formats, and the advertisement beside them (addendum 30).
 *
 * **What is tested is the gesture rather than the card** — addendum 20 §15a,
 * which this program has been taught four times: the screen can read perfectly
 * and the complaint stands if a writer who wants to write a game still ends up
 * making one here. So the assertions are about what a press does, and the one
 * that matters most is the last: `onCreate` can never be handed a format this
 * program does not start.
 */
const draw = (onCreate = vi.fn()) => {
  // The screen reads the recents when it mounts; nothing here is about them.
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    recentProjects: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  };
  render(
    <Welcome
      onCreate={onCreate}
      onOpen={() => undefined}
      onImport={() => undefined}
      onProjects={() => undefined}
      onOpenPath={() => undefined}
      error={null}
    />,
  );
  return onCreate;
};

describe('a format built in another program', () => {
  it('is not among the formats, every one of which is a choice', () => {
    draw();
    // Seven cards, and all seven are toggles: there is no card on the grid
    // that does something other than choose a format (§2a).
    const cards = screen.getAllByRole('button').filter((one) => one.className.includes('format-option'));
    expect(cards).toHaveLength(7);
    for (const card of cards) expect(card.getAttribute('aria-pressed')).toBeTypeOf('string');
    expect(screen.queryByRole('button', { name: /Video game/ })).toBe(null);
  });

  it('is advertised instead, in one sentence with one way out', () => {
    draw();
    const studio = builtElsewhere('game')!;
    expect(screen.getByText(/Need to write a narrative interaction script\?/)).toBeTruthy();

    const go = screen.getByRole('link', { name: new RegExp(`See ${studio.name}`) });
    expect(go.getAttribute('href')).toBe(studio.url);
    expect(go.getAttribute('target')).toBe('_blank');
    // The address is said on the screen rather than left in a hover nobody
    // sees (addendum 02 §6b).
    expect(screen.getByText(studio.host)).toBeTruthy();
  });

  it('leaves every other card a choice that still selects', () => {
    draw();
    const novel = screen.getByRole('button', { name: /Novel/ });
    expect(novel.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(novel);
    expect(screen.getByRole('button', { name: /Novel/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('cannot be created here, however the page is pressed', () => {
    const onCreate = draw();
    fireEvent.change(screen.getByPlaceholderText('Untitled'), { target: { value: 'Ashfall' } });
    fireEvent.click(screen.getByRole('link', { name: /See VC Game Studio/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0]![0]!.format).not.toBe('game');
  });
});
