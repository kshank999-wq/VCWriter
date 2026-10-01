// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createProjectFile, type ProjectFile } from '@vcwriter/domain';
import { ResearchBody } from '../components/ResearchWindow';
import { LayoutWindow } from '../components/LayoutWindow';
import { NoteSorterWindow } from '../components/NoteSorterWindow';
import { SculptorWindow } from '../components/SculptorWindow';
import { OutlinerWindow } from '../components/OutlinerWindow';

/**
 * Save as, and save a copy, reachable from every room (addendum 29 §2).
 *
 * **This is the test the first version did not have, and its absence is the
 * whole story.** §1 built both acts, proved them, and put them on the File
 * menu plus two accelerators — and a room covers the menu bar, so in all five
 * rooms the act worked and could not be seen. Every test passed throughout.
 *
 * So what is pinned here is not that the acts work (§1's tests do that) but
 * that **each room draws a way to reach them** — `cast-surfaces`' shape, where
 * what goes wrong is never the act but a surface that quietly does not offer
 * it. A sixth room added without one fails here rather than shipping.
 */

const book = (): ProjectFile => createProjectFile({ title: 'Rooms', format: 'novel' });

const ROOMS: { name: string; draw: (onSaveAs?: (kind: 'as' | 'copy') => void) => JSX.Element }[] = [
  {
    name: 'Research',
    draw: (onSaveAs) => (
      <ResearchBody
        file={book()}
        currentBeatId={null}
        onClose={() => undefined}
        onUpdate={() => undefined}
        {...(onSaveAs ? { onSaveAs } : {})}
      />
    ),
  },
  {
    name: 'Layout',
    draw: (onSaveAs) => (
      <LayoutWindow file={book()} open onClose={() => undefined} onUpdate={() => undefined} {...(onSaveAs ? { onSaveAs } : {})} />
    ),
  },
  {
    name: 'Note Sorter',
    draw: (onSaveAs) => (
      <NoteSorterWindow
        file={book()}
        open
        onClose={() => undefined}
        onUpdate={() => undefined}
        {...(onSaveAs ? { onSaveAs } : {})}
      />
    ),
  },
  {
    name: 'Sculptor',
    draw: (onSaveAs) => (
      <SculptorWindow file={book()} open onClose={() => undefined} onUpdate={() => undefined} {...(onSaveAs ? { onSaveAs } : {})} />
    ),
  },
  {
    name: 'Outliner',
    draw: (onSaveAs) => (
      <OutlinerWindow file={book()} open onClose={() => undefined} onUpdate={() => undefined} {...(onSaveAs ? { onSaveAs } : {})} />
    ),
  },
];

afterEach(cleanup);

describe('every room can save the project somewhere else', () => {
  for (const room of ROOMS) {
    it(`${room.name} draws the control`, () => {
      render(room.draw(() => undefined));
      expect(screen.getByRole('button', { name: /^Save/ })).toBeTruthy();
    });
  }

  /**
   * **Absent rather than greyed** where the host hands nothing down, which is
   * `onPopOut`'s own idiom: a control that could only refuse is one a writer
   * stops trusting.
   */
  it('is absent where the host gives it nothing to do', () => {
    render(ROOMS[0]!.draw(undefined));
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
  });

  /** The press reaches the host, with the kind it names. */
  it('asks for the kind the writer picked', () => {
    const asked = vi.fn();
    render(ROOMS[4]!.draw(asked));
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));

    // The menu is the program's own ContextMenu, so the items read exactly as
    // the File menu's do — which is the point of not building a second one.
    const copy = screen.getByRole('menuitem', { name: /Save a copy/ });
    fireEvent.click(copy);
    expect(asked).toHaveBeenCalledWith('copy');
  });
});
