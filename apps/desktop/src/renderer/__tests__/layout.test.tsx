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
  beginStory,
  contentsDivisions,
  partsOf,
  storiesOf,
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

function Harness({ initial, onOpenChapterPage }: { initial: ProjectFile; onOpenChapterPage?: (markerId: string) => void }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return (
    <LayoutWindow
      file={file}
      open
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      onOpenChapterPage={onOpenChapterPage}
    />
  );
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
    expect(rail.getByRole('button', { name: /^Half title/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /^Title page/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /^Contents/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /^About the author/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /^Chapter 1/ })).toBeDefined();
    expect(rail.getByRole('button', { name: /^Chapter 2/ })).toBeDefined();
    expect(rail.getByText(/Drag a chapter to move it/)).toBeDefined();
    // The page between the parts of the book: one row per chapter, saying how it opens.
    expect(rail.getAllByText('Chapter page')).toHaveLength(2);
    expect(rail.getAllByText(/above the first paragraph/)).toHaveLength(2);
  });

  it('puts a picture on the page facing a chapter, and opens the chapter’s own page, from the chapter’s row', () => {
    const opened: string[] = [];
    render(<Harness initial={novel()} onOpenChapterPage={(markerId) => opened.push(markerId)} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    // Two chapters, two of each action.
    expect(rail.getAllByRole('button', { name: '+ Picture facing' })).toHaveLength(2);
    fireEvent.click(rail.getAllByRole('button', { name: '+ Picture facing' })[1]!);
    const plate = partsOf(latest as ProjectFile).find((part) => part.kind === 'plate');
    expect(plate?.beforeMarkerId).toBe((latest as ProjectFile).markers[1]?.id);
    // Listed where it falls, before the second chapter, and selected for its picture.
    const names = rail.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.findIndex((name) => name.includes('Platepicture'))).toBeGreaterThan(-1);
    expect(names.findIndex((name) => name.includes('Platepicture'))).toBeLessThan(names.findIndex((name) => name.includes('Chapter 2')));
    expect(screen.getByLabelText('Plate picture')).toBeDefined();
    expect((screen.getByLabelText('Plate place') as HTMLSelectElement).value).toBe(plate?.beforeMarkerId);
    fireEvent.click(rail.getAllByRole('button', { name: 'Chapter page…' })[0]!);
    expect(opened).toEqual([(latest as ProjectFile).markers[0]?.id]);
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
    fireEvent.click(screen.getByRole('button', { name: 'Add a part' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Dedication/ }));
    expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'dedication')).toBe(true);
    fireEvent.change(screen.getByLabelText("The part's text"), { target: { value: 'For M.' } });
    expect(partsOf(latest as ProjectFile).find((part) => part.kind === 'dedication')?.text).toBe('For M.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'dedication')).toBe(false);
  });

  it('offers a once-only part only once', () => {
    render(<Harness initial={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a part' }));
    const options = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
    expect(options.some((option) => option.startsWith('Contents'))).toBe(false);
    expect(options.some((option) => option.startsWith('Preface'))).toBe(true);
    // A novel is not offered a new story.
    expect(options.some((option) => option.startsWith('A new story'))).toBe(false);
  });

  it('takes a part out from its row, after asking', () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByRole('button', { name: 'Remove Copyright' }));
    fireEvent.click(rail.getByRole('button', { name: 'Remove' }));
    expect(partsOf(latest as ProjectFile).map((part) => part.kind)).not.toContain('copyright');
    // And it can come back from the menu.
    fireEvent.click(screen.getByRole('button', { name: 'Add a part' }));
    expect(screen.getAllByRole('menuitem').some((item) => (item.textContent ?? '').startsWith('Copyright'))).toBe(true);
  });

  it('drags a part within its half, and a chapter as a block', () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    const row = (name: RegExp) => rail.getByRole('button', { name }).closest('li') as HTMLElement;
    const drag = (from: HTMLElement, to: HTMLElement) => {
      fireEvent.dragStart(from, { dataTransfer: { setData: () => undefined } });
      fireEvent.dragOver(to);
      fireEvent.drop(to);
      fireEvent.dragEnd(from);
    };
    drag(row(/^Contents/), row(/^Title page/));
    expect(partsOf(latest as ProjectFile).map((part) => part.kind).slice(0, 4)).toEqual(['half_title', 'contents', 'title_page', 'copyright']);
    // A chapter dragged onto the one before it goes first, and its scenes with it.
    const before = contentsDivisions(latest as ProjectFile).map((placed) => placed.marker.title);
    expect(before).toEqual(['The Lamp', 'The Return']);
    drag(row(/^Chapter 2/), row(/^Chapter 1/));
    expect(contentsDivisions(latest as ProjectFile).map((placed) => placed.marker.title)).toEqual(['The Return', 'The Lamp']);
    expect(unitsInStoryOrder(latest as ProjectFile).map((unit) => unit.title)).toEqual(['The Return', 'Chapter One']);
  });

  it('offers a new story on a collection, and lists the stories with a page between them', () => {
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    file = beginStory(file, { title: 'The Road' }).file;
    file = beginStory(file, { title: 'The Harbour' }).file;
    render(<Harness initial={file} onOpenChapterPage={() => undefined} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    expect(rail.getAllByText('Story page')).toHaveLength(2);
    expect(rail.getAllByRole('button', { name: 'Story page…' })).toHaveLength(2);
    expect(rail.getAllByRole('button', { name: '+ Picture facing' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Add a part' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^A new story/ }));
    expect(storiesOf(latest as ProjectFile).map((story) => story.placed.marker.title)).toEqual(['The Road', 'The Harbour', 'New story']);
  });

  it('folds a group of settings behind its heading, and remembers', () => {
    render(<Harness initial={novel()} />);
    const head = screen.getByRole('button', { name: 'Type' });
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText('Body face')).toBeDefined();
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByLabelText('Body face')).toBeNull();
    // The other groups are untouched, and the fold is a preference of the machine.
    expect(screen.getByLabelText('Trim size')).toBeDefined();
    cleanup();
    render(<Harness initial={novel()} />);
    expect(screen.getByRole('button', { name: 'Type' }).getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Type' }));
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
