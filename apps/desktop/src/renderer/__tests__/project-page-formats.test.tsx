// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { builtElsewhere } from '@vcwriter/domain';
import { Welcome } from '../components/Welcome';

afterEach(cleanup);

/**
 * The project page's format cards (addendum 30).
 *
 * **What is tested is the gesture rather than the card** — addendum 20 §15a,
 * which this program has been taught four times: the card can read perfectly
 * and the complaint stands if pressing *Video game* still makes a project
 * here. So every assertion is about what a press does, and the one that
 * matters most is the last: `onCreate` can never be handed a format this
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
  it('stands in its place on the grid, as a door rather than a choice', () => {
    draw();
    const studio = builtElsewhere('game')!;
    const card = screen.getByRole('link', { name: /Video game/ });

    // An anchor, with the address the domain gives and nothing typed here.
    expect(card.getAttribute('href')).toBe(studio.url);
    expect(card.getAttribute('target')).toBe('_blank');
    // Never a toggle: a card that leaves the program may not announce itself
    // as one that selects.
    expect(card.getAttribute('aria-pressed')).toBe(null);
    // It says where it goes rather than what its parts are called. "Scenes and
    // beats" would be the wrong answer about a format this program does not
    // start.
    expect(card.textContent).toContain(studio.name);
    expect(card.textContent).toContain(studio.host);
    expect(card.textContent).not.toContain('Scenes and beats');
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
    fireEvent.click(screen.getByRole('link', { name: /Video game/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0]![0]!.format).not.toBe('game');
  });
});
