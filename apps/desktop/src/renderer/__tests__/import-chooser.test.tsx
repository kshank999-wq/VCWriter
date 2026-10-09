// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createProjectFile, importChoices, updateBeat, type ImportKind, type ProjectFormat } from '@vcwriter/domain';
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

/** A project of that format, or nothing open at all. */
const projectOf = (format: ProjectFormat | null, title = 'Dylan’s Tales') =>
  format === null ? null : createProjectFile({ title, format, author: 'K. Shank' });

const open = (format: ProjectFormat | null, handler?: (kind: ImportKind) => void) => {
  const onChoose = handler ? vi.fn(handler) : vi.fn();
  const onClose = vi.fn();
  render(<ImportChooser open file={projectOf(format)} onClose={onClose} onChoose={onChoose} />);
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
    // By the heading rather than by the words: §10a's sentence points at that
    // group **in its own words**, which is what makes it a route, so what is
    // pinned here is the heading itself.
    expect(screen.getByRole('heading', { name: 'A new project' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Into this project' })).toBeTruthy();
  });

  it('offers only the four that make a project with nothing open, and says why', () => {
    open(null);
    expect(screen.getByRole('button', { name: /A novel/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Notes/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Graphics/i })).toBeNull();
    expect(screen.queryByText('Into this project')).toBeNull();
    // Absent rather than greyed, and said: somebody who came here for their
    // notes is told where the door is rather than left hunting for a row.
    expect(screen.getByText(/Open or start one first/)).toBeTruthy();
  });

  /**
   * **The empty project in front of the writer** (§10a, from Ken: *I named
   * the project Dylan's Tales, but in the save it's calling it the name of
   * the first script… it's not maintaining the name that I give it*).
   *
   * These rows are named for what is being imported and the row that would
   * fill the project he had just made is named for the act, so the obvious
   * press made a second project and left his named one behind. The act is
   * right; what was missing is the sentence.
   */
  it('says the project in hand is empty, and points at the row that fills it', () => {
    const onChoose = vi.fn();
    render(<ImportChooser open file={projectOf('short_story')} onClose={vi.fn()} onChoose={onChoose} />);
    expect(screen.getByText(/has nothing in it yet/)).toBeTruthy();
    // In the writer's own words, which is the whole use of saying it.
    expect(screen.getByText(/Dylan’s Tales/)).toBeTruthy();
  });

  it('says nothing of the sort once there is work in it', () => {
    const made = projectOf('short_story')!;
    const written = updateBeat(made, made.beats[0]!.id, {
      manuscript: { elements: [{ id: 'p1' as never, type: 'paragraph', text: 'One.', characterId: null, attributes: {} }] } as never,
    });
    render(<ImportChooser open file={written} onClose={vi.fn()} onChoose={vi.fn()} />);
    expect(screen.queryByText(/has nothing in it yet/)).toBeNull();
  });

  it('closes behind the choice, so the screen it routes to is what is in front', () => {
    const { onChoose, onClose } = open('screenplay');
    fireEvent.click(screen.getByRole('button', { name: /A script/i }));
    expect(onChoose).toHaveBeenCalledWith('script');
    expect(onClose).toHaveBeenCalled();
  });
});
