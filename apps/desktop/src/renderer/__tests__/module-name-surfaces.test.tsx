// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createProjectFile, formatName, type ProjectFile, type ProjectFormat } from '@vcwriter/domain';
import { ResearchBody } from '../components/ResearchWindow';
import { LayoutWindow } from '../components/LayoutWindow';
import { NoteSorterWindow } from '../components/NoteSorterWindow';
import { SculptorWindow } from '../components/SculptorWindow';
import { OutlinerWindow } from '../components/OutlinerWindow';

/**
 * **Which module you are in, in every room** (addendum 35 §2, from Ken:
 * *whenever you enter a module, whether it be screenwriting, episodic, short
 * form, in the center, I want it to be titled, and it'll say novel, short
 * story collection, etc., just so you know what module you're in*).
 *
 * Nothing said it. The title bar carried the format in the **hover on the
 * project's name**, in the schema's own spelling, and the rooms said nothing —
 * so the one fact that decides what every noun on the screen means was the one
 * fact no screen printed.
 *
 * What is pinned is `room-save-surfaces`' shape and for its reason: **a room
 * covers the menu bar** (addendum 29 §2), so a name standing only on the title
 * bar is invisible from exactly the places a writer goes to do the work. A
 * seventh room added without one fails here rather than shipping silent.
 */

const book = (format: ProjectFormat): ProjectFile => createProjectFile({ title: 'Rooms', format });

const ROOMS: { name: string; draw: (file: ProjectFile) => JSX.Element }[] = [
  {
    name: 'Research',
    draw: (file) => <ResearchBody file={file} currentBeatId={null} onClose={() => undefined} onUpdate={() => undefined} />,
  },
  { name: 'Layout', draw: (file) => <LayoutWindow file={file} open onClose={() => undefined} onUpdate={() => undefined} /> },
  {
    name: 'Note Sorter',
    draw: (file) => <NoteSorterWindow file={file} open onClose={() => undefined} onUpdate={() => undefined} />,
  },
  { name: 'Sculptor', draw: (file) => <SculptorWindow file={file} open onClose={() => undefined} onUpdate={() => undefined} /> },
  { name: 'Outliner', draw: (file) => <OutlinerWindow file={file} open onClose={() => undefined} onUpdate={() => undefined} /> },
];

afterEach(cleanup);

describe('which module you are in', () => {
  for (const room of ROOMS) {
    it(`says it in ${room.name}`, () => {
      render(room.draw(book('novel')));
      const said = document.querySelector('.room-format');
      expect(said).not.toBeNull();
      expect(said?.textContent).toBe('Novel');
    });
  }

  it('says the format rather than the room, which every bar already names', () => {
    // The ask is *what module am I in*, and a bar that repeated its own name
    // in the middle would answer a question nobody has.
    render(ROOMS[1]!.draw(book('short_story')));
    expect(document.querySelector('.room-format')?.textContent).toBe('Short stories and collections');
    expect(screen.getAllByText('Layout').length).toBeGreaterThan(0);
  });

  it('reads one table, so no screen can name a format for itself', () => {
    /**
     * The label was written out on each screen that printed one, and the two
     * on the desktop had **already drifted** — *Instructional book* on the New
     * project grid against *Instructional or textbook* in the importer. What a
     * room prints is now the same string the grid a writer chose it from
     * prints.
     */
    for (const format of ['instructional', 'series', 'short_form'] as ProjectFormat[]) {
      cleanup();
      render(ROOMS[0]!.draw(book(format)));
      expect(document.querySelector('.room-format')?.textContent).toBe(formatName(format));
    }
    expect(formatName('instructional')).toBe('Instructional book');
  });
});
