// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  addBeat,
  addMarker,
  addUnit,
  bookNames,
  bookSettingsOf,
  createProjectFile,
  beginStory,
  contentsDivisions,
  figurePlacement,
  partsOf,
  setChapterPage,
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

  /** The rail's rows, in order, as a reader would read them down the list. */
  const railRows = (): string[] =>
    Array.from(document.querySelectorAll('.layout-tree .layout-part .layout-part-name')).map((one) => one.textContent ?? '');

  /** One row by its name — the button carries a grip before it, so the text is matched. */
  const railRow = (name: string): HTMLElement => {
    const found = Array.from(document.querySelectorAll('.layout-tree .layout-part .layout-part-name')).find(
      (one) => one.textContent === name,
    );
    if (!found) throw new Error(`No row called ${name}`);
    return found.closest('button') as HTMLElement;
  };

  /** Turn the spread until a page of the story is up, and choose it. */
  const chooseStoryPage = (): HTMLElement => {
    const next = screen.getByRole('button', { name: 'Next spread' });
    for (let turn = 0; turn < 14; turn += 1) {
      const story = (Array.from(document.querySelectorAll('.layout-sheet:not(.layout-no-sheet)')) as HTMLElement[]).find((one) =>
        one.querySelector('.bk-p'),
      );
      if (story) {
        fireEvent.click(story);
        return story;
      }
      fireEvent.click(next);
    }
    throw new Error('No page of the story was found');
  };

  it('is one list in the order the book is bound, with no headings and nothing else said', () => {
    render(<Harness initial={novel()} />);
    expect(railRows()).toEqual(['Half title', 'Title page', 'Copyright', 'Contents', 'The Lamp', 'The Return', 'About the author']);
    // The three headings and the sentence under them are gone (§9a, from Ken).
    const rail = document.querySelector('.layout-rail') as HTMLElement;
    expect(rail.querySelectorAll('h3')).toHaveLength(0);
    expect(rail.textContent).not.toMatch(/Front matter|Back matter|above the first paragraph|Picture facing/);
    // One list, and everything in it is one row.
    expect(rail.querySelectorAll('ul')).toHaveLength(1);
    expect(within(rail).getByRole('list', { name: 'The book' })).toBeDefined();
  });

  it('sits a picture under the chapter it is in, and says nothing about the kind', () => {
    let start = novel();
    start = updateBeat(start, start.beats[0]!.id, {
      manuscript: {
        elements: [
          { id: 'p-0' as never, type: 'paragraph', text: 'Chapter 1 begins.', characterId: null, attributes: {} },
          { id: 'f-1' as never, type: 'figure', text: 'The harbour', characterId: null, attributes: { assetId: 'a1' } },
        ],
      },
    });
    render(<Harness initial={start} />);
    expect(railRows()).toEqual(['Half title', 'Title page', 'Copyright', 'Contents', 'The Lamp', 'The harbour', 'The Return', 'About the author']);
    const picture = document.querySelector('.layout-rail-picture') as HTMLElement;
    expect(picture.textContent).toContain('The harbour');
    expect(picture.style.paddingLeft).toBe('16px');
  });

  /** Feed the room's one art-page picker a file, as the file dialog would. */
  const chooseArt = (name: string) => {
    const picker = screen.getByLabelText('Art page file') as HTMLInputElement;
    const art = new File(['PNG bytes'], name, { type: 'image/png' });
    Object.defineProperty(picker, 'files', { value: [art], configurable: true });
    fireEvent.change(picker);
  };

  it('opens the chapter’s own page on a double-click of its row', () => {
    const opened: string[] = [];
    render(<Harness initial={novel()} onOpenChapterPage={(markerId) => opened.push(markerId)} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    void rail;
    fireEvent.doubleClick(railRow('The Lamp'));
    expect(opened).toEqual([(latest as ProjectFile).markers[0]!.id]);
  });

  it('puts a picture into the page in hand, at the top of it, with the words moving down', async () => {
    render(<Harness initial={novel()} />);
    // Nothing chosen: the button refuses and says what to do first.
    const add = screen.getByRole('button', { name: '+ Picture' });
    expect(add.getAttribute('title')).toMatch(/Choose a page first/);
    // Choosing a page on the spread puts it in hand and outlines it.
    const sheet = document.querySelector('.layout-sheet:not(.layout-no-sheet)') as HTMLElement;
    fireEvent.click(sheet);
    await waitFor(() => expect(document.querySelector('.layout-sheet-chosen')).not.toBeNull());

    // Turn to a page of the story, where a picture can land.
    chooseStoryPage();
    const before = (latest as ProjectFile).beats[0]!.manuscript.elements.length;
    fireEvent.click(screen.getByRole('button', { name: '+ Picture' }));
    // Nothing is made until a picture arrives: a cancelled dialog leaves nothing.
    expect((latest as ProjectFile).beats.flatMap((beat) => beat.manuscript.elements).some((one) => one.type === 'figure')).toBe(false);
    chooseArt('harbour.png');
    await waitFor(() =>
      expect((latest as ProjectFile).beats.flatMap((beat) => beat.manuscript.elements).some((one) => one.type === 'figure')).toBe(true),
    );
    const file = latest as ProjectFile;
    const beat = file.beats.find((one) => one.manuscript.elements.some((element) => element.type === 'figure'))!;
    expect(beat.manuscript.elements.length).toBeGreaterThan(before - 1);
    // It went in before what was on the page, so the words moved down.
    const at = beat.manuscript.elements.findIndex((one) => one.type === 'figure');
    expect(beat.manuscript.elements[at + 1]?.type).toBe('paragraph');
    expect(file.assets![0]!.name).toBe('harbour.png');
  });

  /** The book-wide settings live behind one button on the bar (§9). */
  const openBookSettings = () => fireEvent.click(screen.getByRole('button', { name: 'Book settings…' }));

  it('keeps the whole book’s settings behind Book settings… on the bar, and out of the part column', () => {
    render(<Harness initial={novel()} />);
    // Nothing chosen: the column says where the book-wide settings went.
    expect(screen.queryByLabelText('Trim size')).toBeNull();
    expect(document.querySelector('.layout-inspector-hint')?.textContent).toMatch(/under Book settings… in the bar/);
    openBookSettings();
    const dialog = screen.getByRole('dialog', { name: 'Book settings' });
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(within(dialog).getByLabelText('Trim size')).toBeDefined();
    expect(within(dialog).getByLabelText('Body face')).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Running heads & page numbers' })).toBeDefined();
    // The spine is worked out and said, with nothing to set — and the sentence
    // names which row of the standard the trim falls in (§3b).
    expect(within(dialog).getByText(/The standard for a .+ puts the inside margin between/)).toBeDefined();
    expect(within(dialog).getByText(/more than the fore-edge for the spine/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close book settings' }));
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('gives a picture a page of its own inside the story, and a border when it is cut into the text', () => {
    let start = novel();
    const beat = start.beats[0]!;
    start = updateBeat(start, beat.id, {
      manuscript: {
        elements: [
          { id: 'p-0' as never, type: 'paragraph', text: 'Chapter 1 begins.', characterId: null, attributes: {} },
          { id: 'f-1' as never, type: 'figure', text: 'The harbour', characterId: null, attributes: { assetId: 'a1' } },
          { id: 'p-x' as never, type: 'paragraph', text: 'And carries on.', characterId: null, attributes: {} },
        ],
      },
    });
    render(<Harness initial={start} />);
    // The figure is on the rail; choosing it opens the picture's own fields.
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByRole('button', { name: /^The harbour/ }));
    expect((screen.getByLabelText('Figure place') as HTMLSelectElement).value).toBe('measure');
    // A page of its own, on the left-hand side of the spread.
    fireEvent.change(screen.getByLabelText('Figure place'), { target: { value: 'page' } });
    fireEvent.change(screen.getByLabelText('Which page'), { target: { value: 'verso' } });
    let placed = figurePlacement((latest as ProjectFile).beats[0]!.manuscript.elements[1]!);
    expect(placed).toMatchObject({ place: 'page', side: 'verso' });
    expect(screen.getByText(/The picture fills the page, edge to edge/)).toBeDefined();
    // Cut into the text instead: a width and a border, and no side question.
    fireEvent.change(screen.getByLabelText('Figure place'), { target: { value: 'right' } });
    expect(screen.queryByLabelText('Which page')).toBeNull();
    fireEvent.change(screen.getByLabelText('Border round the picture'), { target: { value: '20' } });
    placed = figurePlacement((latest as ProjectFile).beats[0]!.manuscript.elements[1]!);
    expect(placed).toMatchObject({ place: 'right', standoff: 2 });
  });

  it('draws the picture’s box on the page, taking its width and its side from the drag', () => {
    let start = novel();
    const beat = start.beats[0]!;
    start = updateBeat(start, beat.id, {
      manuscript: {
        elements: [
          { id: 'p-0' as never, type: 'paragraph', text: 'Chapter 1 begins.', characterId: null, attributes: {} },
          { id: 'f-1' as never, type: 'figure', text: 'The harbour', characterId: null, attributes: { assetId: 'a1' } },
          { id: 'p-x' as never, type: 'paragraph', text: 'And carries on.', characterId: null, attributes: {} },
        ],
      },
    });
    render(<Harness initial={start} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByRole('button', { name: /^The harbour/ }));
    const draw = screen.getByRole('button', { name: 'Draw the box…' });
    expect(draw.getAttribute('aria-pressed')).toBe('false');
    // The box is drawn on a page of the story, which is where a figure can go.
    const story = chooseStoryPage();
    fireEvent.click(draw);
    // The spread says it is waiting for a box.
    const sheet = story;
    expect(sheet.classList.contains('layout-sheet-drawing')).toBe(true);
    expect(screen.getByRole('button', { name: 'Drawing — drag on the page' })).toBeDefined();
    // jsdom measures nothing, so the sheet is given a rectangle to be read against.
    const rect = { left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    sheet.getBoundingClientRect = () => rect;
    sheet.setPointerCapture = () => undefined;
    // A box on the right-hand half, a third of the page across.
    fireEvent.pointerDown(sheet, { clientX: 240, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(sheet, { clientX: 360, clientY: 300, pointerId: 1 });
    expect(document.querySelector('.layout-draw-box')).not.toBeNull();
    fireEvent.pointerUp(sheet, { clientX: 360, clientY: 300, pointerId: 1 });
    const placed = figurePlacement((latest as ProjectFile).beats[0]!.manuscript.elements[1]!);
    expect(placed.place).toBe('right');
    expect(placed.span).toBeGreaterThan(0.2);
    // The drawing is over, and the box is gone.
    expect(document.querySelector('.layout-draw-box')).toBeNull();
    expect(screen.getByRole('button', { name: 'Draw the box…' })).toBeDefined();
  });

  it('writes the trim and says what was worked out from it', () => {
    render(<Harness initial={novel()} />);
    openBookSettings();
    fireEvent.change(screen.getByLabelText('Trim size'), { target: { value: '6x9' } });
    expect(bookSettingsOf(latest as ProjectFile).trim).toEqual({ width: 6, height: 9 });
    expect(screen.getByText(/6 × 9 in\. Margins worked out from the trim/)).toBeDefined();
    // Nothing worked out was stored.
    expect(bookSettingsOf(latest as ProjectFile).margins).toEqual({ inside: null, outside: null, top: null, bottom: null });
  });

  it('takes a typed margin, says so, and lets it go again', () => {
    render(<Harness initial={novel()} />);
    openBookSettings();
    fireEvent.change(screen.getByLabelText('Outside margin in inches'), { target: { value: '1' } });
    expect(bookSettingsOf(latest as ProjectFile).margins.outside).toBe(1);
    expect(screen.getByText(/outside 1 in \(typed\)/)).toBeDefined();
    fireEvent.click(screen.getByLabelText('Work out the outside margin again'));
    expect(bookSettingsOf(latest as ProjectFile).margins.outside).toBeNull();
  });

  it('adds a part, edits its words, and removes it after asking', () => {
    render(<Harness initial={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    const options = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
    expect(options.some((option) => option.startsWith('Contents'))).toBe(false);
    expect(options.some((option) => option.startsWith('Preface'))).toBe(true);
    // A novel is not offered a new story.
    expect(options.some((option) => option.startsWith('New story'))).toBe(false);
    // A kind is offered by its name alone: the note in the margin is gone (§9a).
    expect(options).toContain('Preface');
  });

  it('takes a part out from its row, after asking', () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByRole('button', { name: 'Remove Copyright' }));
    fireEvent.click(rail.getByRole('button', { name: 'Remove' }));
    expect(partsOf(latest as ProjectFile).map((part) => part.kind)).not.toContain('copyright');
    // And it can come back from the menu.
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
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

  it('sets how a division’s heading looks in Book settings, under the format’s own word', () => {
    render(<Harness initial={novel()} />);
    openBookSettings();
    const dialog = screen.getByRole('dialog', { name: 'Book settings' });
    // The fold is named for what this format divides into (§6a), and stands open.
    expect(within(dialog).getByRole('button', { name: 'Chapter openings' })).toBeDefined();
    // The setting itself, not a sentence pointing at another dialog.
    expect(within(dialog).getByRole('heading', { name: 'How every chapter page is set' })).toBeDefined();
    expect(within(dialog).getByLabelText('Chapter page face')).toBeDefined();
    fireEvent.change(within(dialog).getByLabelText('The number size'), { target: { value: '20' } });
    expect(bookNames(latest as ProjectFile)).toBeDefined();
    expect((latest as ProjectFile).settings.chapterPageStyle?.number?.size).toBe(20);

    // And **not** how it is placed (addendum 20 §9c, from Ken): where the
    // picture sits, how far down the heading falls and the air over the first
    // paragraph belong to the page, and are set by double-clicking it.
    expect(within(dialog).queryByLabelText('How far down the page')).toBeNull();
    expect(within(dialog).queryByRole('radiogroup', { name: 'Template' })).toBeNull();
    expect(dialog.textContent).toMatch(/double-click it in the book/);
  });

  it('calls a collection’s divisions stories, everywhere the word is used', () => {
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    file = beginStory(file, { title: 'The Road' }).file;
    render(<Harness initial={file} onOpenChapterPage={() => undefined} />);
    openBookSettings();
    const dialog = screen.getByRole('dialog', { name: 'Book settings' });
    expect(within(dialog).getByRole('button', { name: 'Story openings' })).toBeDefined();
    expect(within(dialog).getByRole('heading', { name: 'How every story page is set' })).toBeDefined();
    expect(dialog.textContent).not.toMatch(/chapter/i);
  });

  it('draws a box with nothing in it, and fills it afterwards', async () => {
    render(<Harness initial={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    const story = chooseStoryPage();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Draw a box for a picture…' }));
    expect(story.classList.contains('layout-sheet-drawing')).toBe(true);
    const rect = { left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    story.getBoundingClientRect = () => rect;
    story.setPointerCapture = () => undefined;
    fireEvent.pointerDown(story, { clientX: 240, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(story, { clientX: 360, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(story, { clientX: 360, clientY: 300, pointerId: 1 });

    // A figure with no picture in it: the box holds its place and says so.
    const box = (latest as ProjectFile).beats.flatMap((beat) => beat.manuscript.elements).find((one) => one.type === 'figure');
    expect(box).toBeDefined();
    expect(box!.attributes.assetId).toBeUndefined();
    expect(figurePlacement(box!).place).toBe('right');
    expect(screen.getByRole('heading', { name: 'An empty box' })).toBeDefined();

    // And the picture goes in afterwards, which is the order Ken asked for.
    fireEvent.click(screen.getByRole('button', { name: 'Choose a picture…' }));
    chooseArt('harbour.png');
    await waitFor(() => {
      const filled = (latest as ProjectFile).beats.flatMap((beat) => beat.manuscript.elements).find((one) => one.id === box!.id);
      expect(filled!.attributes.assetId).toBe((latest as ProjectFile).assets![0]!.id);
    });
  });

  it('brings a picture page to face the chapter it is dropped on', async () => {
    render(<Harness initial={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Picture on a page of its own…' }));
    // Nothing was chosen, so the menu refuses rather than guessing a page.
    expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'plate')).toBe(false);

    // A front-matter page in hand makes an art page there instead.
    const sheet = document.querySelector('.layout-sheet:not(.layout-no-sheet)') as HTMLElement;
    fireEvent.click(sheet);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Picture on a page of its own…' }));
    chooseArt('plate.png');
    await waitFor(() => expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'plate')).toBe(true));
    expect(partsOf(latest as ProjectFile).find((part) => part.kind === 'plate')!.inFront).toBe(true);
    // Its row is named after the picture rather than after the kind (§9a).
    expect(railRows()).toContain('plate.png');

    // Dragged onto a chapter, it comes to face that chapter.
    const drag = (from: HTMLElement, to: HTMLElement) => {
      fireEvent.dragStart(from, { dataTransfer: { setData: () => undefined } });
      fireEvent.dragOver(to);
      fireEvent.drop(to);
      fireEvent.dragEnd(from);
    };
    drag(railRow('plate.png').closest('li') as HTMLElement, railRow('The Return').closest('li') as HTMLElement);
    const plate = partsOf(latest as ProjectFile).find((part) => part.kind === 'plate')!;
    expect(plate.beforeMarkerId).toBe((latest as ProjectFile).markers[1]!.id);
    // And it is listed where it falls: just before that chapter.
    const rows = railRows();
    expect(rows.indexOf('plate.png')).toBe(rows.indexOf('The Return') - 1);
  });

  it('lists a collection’s stories as rows of the same list', () => {
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    file = beginStory(file, { title: 'The Road' }).file;
    file = beginStory(file, { title: 'The Harbour' }).file;
    render(<Harness initial={file} onOpenChapterPage={() => undefined} />);
    expect(railRows()).toContain('The Road');
    expect(railRows()).toContain('The Harbour');
    const rail = document.querySelector('.layout-rail') as HTMLElement;
    expect(rail.textContent).not.toMatch(/Story page|Picture facing/);
  });

  it('folds a group of settings behind its heading, and remembers', () => {
    render(<Harness initial={novel()} />);
    openBookSettings();
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
    openBookSettings();
    expect(screen.getByRole('button', { name: 'Type' }).getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Type' }));
  });

  it('names the book in Book settings, so the running heads stop printing the file’s name', () => {
    render(<Harness initial={novel()} />);
    // The project is named for its file, and that is what the pages carry.
    expect(bookNames(latest as ProjectFile).title).toBe('The Lamp');
    openBookSettings();
    const dialog = screen.getByRole('dialog', { name: 'Book settings' });
    fireEvent.change(within(dialog).getByLabelText('Book title'), { target: { value: 'The Drowned Bell' } });
    fireEvent.change(within(dialog).getByLabelText('Author'), { target: { value: 'M. Shank' } });
    fireEvent.change(within(dialog).getByLabelText('Publisher'), { target: { value: 'Lantern Press' } });
    const file = latest as ProjectFile;
    expect(bookNames(file)).toEqual({ title: 'The Drowned Bell', author: 'M. Shank', imprint: 'Lantern Press' });
    // The project keeps its own name; only the book is renamed.
    expect(file.project.title).toBe('The Lamp');
    expect(within(dialog).getByText(/Empty means the project’s own name/)).toBeDefined();
  });

  it('says on the title page what it will print and sends the writer to Book settings, and takes full-page art', async () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByRole('button', { name: /^Title page/ }));
    // Nothing says "nothing to type on it" any more, and the names are not offered twice.
    expect(screen.queryByText(/nothing to type on it/)).toBeNull();
    expect(screen.queryByLabelText('Book title')).toBeNull();
    expect(document.querySelector('.layout-inspector')?.textContent).toMatch(/This page prints/);
    fireEvent.change(screen.getByLabelText('Under the title'), { target: { value: 'A novel' } });
    expect((latest as ProjectFile).settings.titlePage.episode).toBe('A novel');
    // The button opens the one place the names are set.
    fireEvent.click(within(document.querySelector('.layout-inspector') as HTMLElement).getByRole('button', { name: 'Book settings…' }));
    expect(screen.getByRole('dialog', { name: 'Book settings' }).hasAttribute('open')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close book settings' }));
    let file = latest as ProjectFile;
    // The page's style: a template places it, a hand change reads as custom.
    expect((screen.getByLabelText('Page template') as HTMLSelectElement).value).toBe('classic');
    fireEvent.change(screen.getByLabelText('Page template'), { target: { value: 'high_left' } });
    file = latest as ProjectFile;
    const title = partsOf(file).find((part) => part.kind === 'title_page')!;
    expect(title.style).toMatchObject({ align: 'left', drop: 10 });
    fireEvent.change(screen.getByLabelText('How far down the page'), { target: { value: '20' } });
    expect((screen.getByLabelText('Page template') as HTMLSelectElement).value).toBe('custom');
    fireEvent.change(screen.getByLabelText('Title size'), { target: { value: '36' } });
    expect((partsOf(latest as ProjectFile).find((part) => part.kind === 'title_page')!.style as { title: { size: number } }).title.size).toBe(36);
    fireEvent.click(screen.getByRole('button', { name: 'Back to the page’s own look' }));
    expect(partsOf(latest as ProjectFile).find((part) => part.kind === 'title_page')!.style).toEqual({});
    // Full-page art: the picture joins the library and becomes the page.
    const picker = screen.getByLabelText('Title art file') as HTMLInputElement;
    const art = new File(['PNG bytes'], 'title-art.png', { type: 'image/png' });
    Object.defineProperty(picker, 'files', { value: [art], configurable: true });
    fireEvent.change(picker);
    await waitFor(() => expect((latest as ProjectFile).assets).toHaveLength(1));
    file = latest as ProjectFile;
    expect(partsOf(file).find((part) => part.kind === 'title_page')!.assetId).toBe(file.assets![0]!.id);
    expect(screen.getByRole('button', { name: 'Import other full page art…' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Set the words instead' }));
    expect(partsOf(latest as ProjectFile).find((part) => part.kind === 'title_page')!.assetId).toBeNull();
    // The half title says what it prints too, and offers no subtitle.
    fireEvent.click(rail.getByRole('button', { name: /^Half title/ }));
    expect(document.querySelector('.layout-inspector')?.textContent).toMatch(/This page prints/);
    expect(screen.queryByLabelText('Under the title')).toBeNull();
  });

  it('takes a chapter out and keeps every word, after saying what goes', () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByRole('button', { name: 'Remove The Return' }));
    expect(rail.getByText(/not a word is cut/)).toBeDefined();
    fireEvent.click(rail.getByRole('button', { name: 'Remove' }));
    expect(contentsDivisions(latest as ProjectFile).map((placed) => placed.marker.title)).toEqual(['The Lamp']);
    // The words are still there: the sections joined the chapter before them.
    expect((latest as ProjectFile).beats.flatMap((beat) => beat.manuscript.elements.map((one) => one.text))).toContain('Chapter 2 begins.');
    // The rail has a divider to drag, and starts wide enough to read a row
    // whole (addendum 20 §9b, from Ken: *the left toolbar needs to be sized so
    // you can see everything*). A machine that has dragged it keeps its own.
    expect(screen.getByRole('separator', { name: 'Rail width' })).toBeDefined();
    expect((document.querySelector('.layout-rail') as HTMLElement).style.flex).toBe('0 0 360px');
  });

  /**
   * Turning the leaf (addendum 20 §9b, from Ken: *next to the page on the left
   * and next to the page on the right, let's put a large arrow*).
   *
   * They stand **beside** the spread rather than in the foot, and the foot's
   * own small pair is gone: two answers to *turn the page* on one screen.
   */
  it('turns the page with an arrow either side of the spread', () => {
    render(<Harness initial={novel()} />);

    const back = screen.getByRole('button', { name: 'Previous spread' });
    const on = screen.getByRole('button', { name: 'Next spread' });
    const viewport = document.querySelector('.layout-viewport') as HTMLElement;
    expect(viewport.contains(back)).toBe(true);
    expect(viewport.contains(on)).toBe(true);
    // Not in the foot, which keeps the scrubber for moving a long way at once.
    const foot = document.querySelector('.layout-foot') as HTMLElement;
    expect(foot.contains(back)).toBe(false);
    expect(foot.querySelector('input[type="range"]')).toBeDefined();

    // The first spread has nothing before it; turning once gives it one.
    expect((back as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(on);
    expect((back as HTMLButtonElement).disabled).toBe(false);
  });

  it('takes a story added by accident away whole, its empty section with it', () => {
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    file = beginStory(file, { title: 'The Road' }).file;
    render(<Harness initial={file} onOpenChapterPage={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'New story' }));
    expect(storiesOf(latest as ProjectFile).map((story) => story.placed.marker.title)).toEqual(['The Road', 'New story']);
    const units = (latest as ProjectFile).units.length;
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByRole('button', { name: 'Remove New story' }));
    expect(rail.getByText(/Nothing is written in it/)).toBeDefined();
    fireEvent.click(rail.getByRole('button', { name: 'Remove' }));
    expect(storiesOf(latest as ProjectFile).map((story) => story.placed.marker.title)).toEqual(['The Road']);
    expect((latest as ProjectFile).units.length).toBe(units - 1);
  });

  it('opens a part in a dialog of its own on a double-click, with its page beside the fields', async () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.doubleClick(rail.getByRole('button', { name: /^Half title/ }));
    const dialog = screen.getByRole('dialog', { name: 'Part' });
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.querySelector('header strong')?.textContent).toBe('Half title');
    // The page as set: the same markup the spread draws.
    await waitFor(() => expect(dialog.querySelector('.layout-page-preview .bk-page')).not.toBeNull());
    expect(within(dialog).getByText(/a right-hand page/)).toBeDefined();
    // A half title has no words to cut a picture into, so the pictures are absent rather than refused.
    expect(within(dialog).queryByText('Pictures cut into the text')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close the part' }));
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('cuts a picture into a foreword’s text from the part’s dialog, beside the paragraph chosen', async () => {
    render(<Harness initial={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Foreword/ }));
    const foreword = partsOf(latest as ProjectFile).find((part) => part.kind === 'foreword')!;
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.doubleClick(rail.getByRole('button', { name: /^Foreword/ }));
    const dialog = screen.getByRole('dialog', { name: 'Part' });
    // No paragraph yet: nothing to cut into, said rather than offered.
    expect(within(dialog).getByText(/Write a paragraph first/)).toBeDefined();
    fireEvent.change(within(dialog).getByLabelText("The part's text"), { target: { value: 'One.\n\nTwo, beside the picture.\n\nThree.' } });
    const picker = within(dialog).getByLabelText('Part picture file') as HTMLInputElement;
    const art = new File(['PNG bytes'], 'harbour.png', { type: 'image/png' });
    Object.defineProperty(picker, 'files', { value: [art], configurable: true });
    fireEvent.change(picker);
    await waitFor(() => expect(partsOf(latest as ProjectFile).find((part) => part.id === foreword.id)!.insets).toHaveLength(1));
    let file = latest as ProjectFile;
    expect(file.assets![0]!.name).toBe('harbour.png');
    expect(partsOf(file).find((part) => part.id === foreword.id)!.insets[0]!.assetId).toBe(file.assets![0]!.id);
    // Beside the second paragraph, at the right, narrower.
    fireEvent.change(within(dialog).getByLabelText('Picture 1 paragraph'), { target: { value: '1' } });
    fireEvent.change(within(dialog).getByLabelText('Picture 1 side'), { target: { value: 'right' } });
    fireEvent.change(within(dialog).getByLabelText('Picture 1 width'), { target: { value: '25' } });
    file = latest as ProjectFile;
    expect(partsOf(file).find((part) => part.id === foreword.id)!.insets[0]).toMatchObject({ paragraph: 1, place: 'right', span: 0.25 });
    // Taken out again; the picture stays in the library.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Take picture 1 out' }));
    file = latest as ProjectFile;
    expect(partsOf(file).find((part) => part.id === foreword.id)!.insets).toHaveLength(0);
    expect(file.assets).toHaveLength(1);
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

  it('sets a chapter whose page is full-page art as the art alone, edge to edge', () => {
    let file = novel();
    const marker = file.markers[1]!;
    file = setChapterPage(file, marker.id, {
      include: true,
      template: 'full_page',
      image: { dataUrl: 'data:image/png;base64,ART0', name: 'The Return, painted', width: 100 },
      summary: 'Never set over the art.',
    });
    render(<Harness initial={file} />);
    // Turn until the art's page is on the spread.
    const next = screen.getByRole('button', { name: 'Next spread' });
    let found: Element | null = null;
    for (let turn = 0; turn < 12 && !found; turn += 1) {
      found = document.querySelector('.bk-leaf-art .bk-chapter-art');
      if (!found) fireEvent.click(next);
    }
    expect(found).not.toBeNull();
    expect(found!.getAttribute('alt')).toBe('The Return, painted');
    expect(document.querySelector('.bk-leaf-art .bk-chapter-summary')).toBeNull();
  });

  it('has the one way to export the book', () => {
    render(<Harness initial={novel()} />);
    expect(screen.getByRole('button', { name: 'Export the book…' })).toBeDefined();
  });
});
