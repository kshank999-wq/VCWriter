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

  /** Feed the room's one art-page picker a file, as the file dialog would. */
  const chooseArt = (name: string) => {
    const picker = screen.getByLabelText('Art page file') as HTMLInputElement;
    const art = new File(['PNG bytes'], name, { type: 'image/png' });
    Object.defineProperty(picker, 'files', { value: [art], configurable: true });
    fireEvent.change(picker);
  };

  it('puts a picture on the page facing a chapter from a file, and opens the chapter’s own page, from the chapter’s row', async () => {
    const opened: string[] = [];
    render(<Harness initial={novel()} onOpenChapterPage={(markerId) => opened.push(markerId)} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    // Two chapters, two of each action.
    expect(rail.getAllByRole('button', { name: '+ Picture facing' })).toHaveLength(2);
    fireEvent.click(rail.getAllByRole('button', { name: '+ Picture facing' })[1]!);
    // Nothing is made until a picture arrives: a cancelled dialog leaves no empty page.
    expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'plate')).toBe(false);
    chooseArt('facing-two.png');
    await waitFor(() => expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'plate')).toBe(true));
    const file = latest as ProjectFile;
    const plate = partsOf(file).find((part) => part.kind === 'plate')!;
    expect(plate.beforeMarkerId).toBe(file.markers[1]?.id);
    expect(plate.assetId).toBe(file.assets![0]!.id);
    expect(file.assets![0]!.name).toBe('facing-two.png');
    // Listed where it falls, before the second chapter, and selected.
    const names = rail.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.findIndex((name) => name.includes('Art pagepicture'))).toBeGreaterThan(-1);
    expect(names.findIndex((name) => name.includes('Art pagepicture'))).toBeLessThan(names.findIndex((name) => name.includes('Chapter 2')));
    expect((screen.getByLabelText('Plate place') as HTMLSelectElement).value).toBe(plate.beforeMarkerId);
    expect(screen.getByRole('button', { name: 'Choose another picture…' })).toBeDefined();
    fireEvent.click(rail.getAllByRole('button', { name: 'Chapter page…' })[0]!);
    expect(opened).toEqual([file.markers[0]?.id]);
  });

  it('adds an art page to the front matter or the back from the menu, the picture filling the page wherever it goes', async () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByRole('button', { name: 'Add a part' }));
    const menu = within(screen.getByRole('menu', { name: 'Parts to add' }));
    // The plain kind is not offered; the two places are, and each opens the picker.
    expect(menu.queryByRole('menuitem', { name: /^Art page — / })).toBeNull();
    fireEvent.click(menu.getByRole('menuitem', { name: /^Art page in the front matter/ }));
    chooseArt('title-art.png');
    await waitFor(() => expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'plate')).toBe(true));
    let plate = partsOf(latest as ProjectFile).find((part) => part.kind === 'plate')!;
    expect(plate.inFront).toBe(true);
    expect(plate.beforeMarkerId).toBeNull();
    expect(within(rail.getByRole('list', { name: 'Front matter' })).getByRole('button', { name: /^Art page/ })).toBeDefined();
    expect((screen.getByLabelText('Plate place') as HTMLSelectElement).value).toBe('front');
    // The description prints nowhere and the fields say so.
    expect(screen.getByLabelText('Art page description')).toBeDefined();
    expect(screen.getByText(/The picture is the page, edge to edge/)).toBeDefined();
    // Where moves it: to the back, and to face a chapter.
    fireEvent.change(screen.getByLabelText('Plate place'), { target: { value: 'back' } });
    plate = partsOf(latest as ProjectFile).find((part) => part.kind === 'plate')!;
    expect(plate.inFront).toBe(false);
    expect(within(rail.getByRole('list', { name: 'Back matter' })).getByRole('button', { name: /^Art page/ })).toBeDefined();
    fireEvent.change(screen.getByLabelText('Plate place'), { target: { value: (latest as ProjectFile).markers[0]!.id }, });
    plate = partsOf(latest as ProjectFile).find((part) => part.kind === 'plate')!;
    expect(plate.beforeMarkerId).toBe((latest as ProjectFile).markers[0]!.id);
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
    // The spine is worked out and said, with nothing to set.
    expect(within(dialog).getByText(/for the spine, worked out from \d+ pages?/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close book settings' }));
    expect(dialog.hasAttribute('open')).toBe(false);
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

  it('opens the chapter page from its row, and takes a leaf off after asking', () => {
    const opened: string[] = [];
    let file = novel();
    file = setChapterPage(file, file.markers[0]!.id, { epigraph: 'A lamp is a lamp.' });
    render(<Harness initial={file} onOpenChapterPage={(markerId) => opened.push(markerId)} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    expect(rail.getAllByText(/a leaf of its own/)).toHaveLength(1);
    // The row's name opens the page; the × asks, then takes the leaf off.
    fireEvent.click(rail.getAllByRole('button', { name: /^Chapter page.*a leaf of its own/ })[0]!);
    expect(opened).toEqual([file.markers[0]!.id]);
    fireEvent.click(rail.getByRole('button', { name: 'Take the chapter page off' }));
    fireEvent.click(rail.getByRole('button', { name: 'Take it off' }));
    expect((latest as ProjectFile).markers[0]!.page.epigraph).toBe('');
    expect(rail.queryByText(/a leaf of its own/)).toBeNull();
    // The rail has a divider to drag, starting half an inch wider than it was.
    const divider = screen.getByRole('separator', { name: 'Rail width' });
    expect(divider).toBeDefined();
    expect((document.querySelector('.layout-rail') as HTMLElement).style.flex).toBe('0 0 288px');
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
    fireEvent.click(screen.getByRole('button', { name: 'Add a part' }));
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
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    expect(rail.getAllByText(/a leaf of its own/)).toHaveLength(1);
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
