// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addMarker,
  addUnit,
  bookSettingsOf,
  createProjectFile,
  partsOf,
  tracksInOrder,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '@vcwriter/domain';
import { LayoutWindow } from '../components/LayoutWindow';
import { menusFor } from '../menus';
import { ROOM_PANES, paneTitle } from '../panes';

/**
 * The Layout room on the screen (addendum 20 §9).
 *
 * A test's document has no layout, so every block measures as one line and
 * the pages come out short — which is fine, because what these hold down is
 * the room, not the type: the parts are listed, the trim writes the settings,
 * the derived margins are said, and the story cannot be reordered from here.
 */

afterEach(cleanup);

let latest: ProjectFile | null = null;

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return <LayoutWindow file={file} open onClose={() => undefined} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel' });
  const track = tracksInOrder(file)[0]!;
  const first = unitsInStoryOrder(file)[0]!;
  const second = addUnit(file, { trackId: track.id, title: 'The Return', index: 1 });
  file = second.file;
  for (const [index, unit] of [first, second.unit].entries()) {
    file = addMarker(file, { unitId: unit.id, kind: 'chapter', title: index === 0 ? 'The Lamp' : 'The Return' }).file;
    const beat = addBeat(file, { unitId: unit.id, title: 'b' });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: {
        elements: [{ id: `p-${index}` as never, type: 'paragraph', text: `Chapter ${index + 1} begins.`, characterId: null, attributes: {} }],
      },
    });
  }
  return file;
};

describe('the room', () => {
  it('is a room like Research, and a book’s alone', () => {
    expect(ROOM_PANES).toContain('layout');
    expect(paneTitle('layout')).toBe('Layout');
    const items = (format: Parameters<typeof menusFor>[0]) =>
      menusFor(format)
        .flatMap((menu) => menu.items)
        .flatMap((item) => (item ? [item.command] : []));
    expect(items('novel')).toContain('window.layout');
    expect(items('instructional')).toContain('window.layout');
    expect(items('screenplay')).not.toContain('window.layout');
  });

  it('lists the parts in front of the story and behind it, and the chapters between', () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    expect(rail.getByRole('button', { name: /Half title/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /Title page/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /^Contents/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /About the author/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /Chapter 1/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /Chapter 2/ })).toBeDefined();
    expect(rail.getByText(/nothing here reorders it/)).toBeDefined();
  });

  it('writes the trim and says what was worked out from it', () => {
    render(<Harness initial={novel()} />);
    fireEvent.change(screen.getByLabelText('Trim size'), { target: { value: '6x9' } });
    expect(bookSettingsOf(latest as ProjectFile).trim).toEqual({ width: 6, height: 9 });
    expect(screen.getByText(/6 × 9 in\. Margins worked out from the trim/)).toBeDefined();
    // Nothing worked out was stored.
    expect(bookSettingsOf(latest as ProjectFile).margins).toEqual({ inside: null, outside: null, top: null, bottom: null });
  });

  it('takes a typed margin, says so, and lets it go again', () => {
    render(<Harness initial={novel()} />);
    fireEvent.change(screen.getByLabelText('Outside margin in inches'), { target: { value: '1' } });
    expect(bookSettingsOf(latest as ProjectFile).margins.outside).toBe(1);
    expect(screen.getByText(/outside 1 in \(typed\)/)).toBeDefined();
    fireEvent.click(screen.getByLabelText('Work out the outside margin again'));
    expect(bookSettingsOf(latest as ProjectFile).margins.outside).toBeNull();
  });

  it('adds a part, edits its words, and removes it after asking', () => {
    render(<Harness initial={novel()} />);
    fireEvent.change(screen.getByLabelText('Add a part'), { target: { value: 'dedication' } });
    expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'dedication')).toBe(true);
    fireEvent.change(screen.getByLabelText("The part's text"), { target: { value: 'For M.' } });
    expect(partsOf(latest as ProjectFile).find((part) => part.kind === 'dedication')?.text).toBe('For M.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'dedication')).toBe(false);
  });

  it('offers a once-only part only once', () => {
    render(<Harness initial={novel()} />);
    const options = Array.from(screen.getByLabelText('Add a part').querySelectorAll('option')).map((option) => option.value);
    expect(options).not.toContain('contents');
    expect(options).toContain('preface');
  });

  it('draws two facing pages from the laid book, with the running furniture', () => {
    render(<Harness initial={novel()} />);
    const sheets = document.querySelectorAll('.layout-sheet .bk-page');
    expect(sheets.length).toBeGreaterThan(0);
    // Turn to the second spread: a verso and a recto.
    fireEvent.click(screen.getByRole('button', { name: 'Next spread' }));
    expect(document.querySelector('.bk-page.verso')).not.toBeNull();
    expect(document.querySelector('.bk-page.recto')).not.toBeNull();
  });

  it('has the one way to export the book', () => {
    render(<Harness initial={novel()} />);
    expect(screen.getByRole('button', { name: 'Export the book…' })).toBeDefined();
  });
});
