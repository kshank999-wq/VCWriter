// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { importChoices, type ImportKind } from '@vcwriter/domain';
import { ImportChooser } from '../components/ImportChooser';
import { MENUS } from '../menus';

/**
 * What are you importing? (addendum 33.)
 *
 * **What is pinned here is the gesture rather than the dialog** — addendum 20
 * §15a, which this program has been taught five times: the import screens can
 * all be perfect and the complaint stands if the one menu item does not reach
 * them. So this walks the rows a writer is actually offered, and asserts that
 * every one of them answers with a kind: a row drawn and wired to nothing
 * reads exactly like the feature not being there.
 */

afterEach(cleanup);

const open = (format: Parameters<typeof importChoices>[0], handler?: (kind: ImportKind) => void) => {
  const onChoose = handler ? vi.fn(handler) : vi.fn();
  const onClose = vi.fn();
  render(<ImportChooser open format={format} onClose={onClose} onChoose={onChoose} />);
  return { onChoose, onClose };
};

describe('the import chooser', () => {
  it('is what the File menu’s one Import item opens', () => {
    const file = MENUS.find((menu) => menu.id === 'file')!;
    const imports = file.items.filter((item) => item && item.command === 'file.import');
    expect(imports).toHaveLength(1);
    expect(imports[0]!.label).toBe('Import…');
  });

  it('draws a button for every kind it offers, and answers with that kind', () => {
    for (const format of ['screenplay', 'novel', 'short_story', 'series', 'instructional'] as const) {
      cleanup();
      const answered: ImportKind[] = [];
      open(format, (kind: ImportKind) => answered.push(kind));
      const kinds = importChoices(format).map((choice) => choice.kind);
      for (const choice of importChoices(format)) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(choice.label, 'i') }));
      }
      expect(answered).toEqual(kinds);
    }
  });

  it('says what each one does under its label', () => {
    open('novel');
    for (const choice of importChoices('novel')) {
      expect(screen.getByText(choice.note)).toBeTruthy();
    }
  });

  it('separates what makes a project from what goes into this one', () => {
    // The question the old two-item menu answered only by being pressed.
    open('short_story');
    expect(screen.getByText('A new project')).toBeTruthy();
    expect(screen.getByText('Into this project')).toBeTruthy();
  });

  it('offers only the four that make a project with nothing open, and says why', () => {
    open(null);
    expect(screen.getByRole('button', { name: /A novel/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Notes, into Research/i })).toBeNull();
    expect(screen.queryByText('Into this project')).toBeNull();
    // Absent rather than greyed, and said: somebody who came here for their
    // notes is told where the door is rather than left hunting for a row.
    expect(screen.getByText(/Open or start one first/)).toBeTruthy();
  });

  it('closes behind the choice, so the screen it routes to is what is in front', () => {
    const { onChoose, onClose } = open('screenplay');
    fireEvent.click(screen.getByRole('button', { name: /A script/i }));
    expect(onChoose).toHaveBeenCalledWith('script');
    expect(onClose).toHaveBeenCalled();
  });
});
