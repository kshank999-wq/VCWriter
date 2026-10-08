// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  bookBlocks,
  outOfContents,
  setChapterBlank,
  bookNames,
  bookSettingsOf,
  bookFontsOf,
  faceOfFont,
  createProjectFile,
  beginStory,
  contentsDivisions,
  backBlank,
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

/** jsdom has no `<dialog>` behaviour, and the room opens three of them. */
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(cleanup);

let latest: ProjectFile | null = null;

function Harness({
  initial,
  onOpenChapterPage,
  openOnKind,
}: {
  initial: ProjectFile;
  onOpenChapterPage?: (markerId: string) => void;
  openOnKind?: 'title_page' | 'copyright';
}) {
  const [file, setFile] = useState(initial);
  latest = file;
  return (
    <LayoutWindow
      file={file}
      open
      openOnKind={openOnKind ?? null}
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

  /**
   * Open a division's fold (§9o). A closed one hides **everything** under it —
   * its chapters, its pictures and its pages — so a picture in the writing is
   * one press away rather than listed under a shut chapter.
   */
  const openFold = (title: string) => {
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByLabelText(`Show what is under ${title}`));
  };

  /** One row by its name — the button carries a grip before it, so the text is matched. */
  const railRow = (name: string): HTMLElement => {
    const found = Array.from(document.querySelectorAll('.layout-tree .layout-part .layout-part-name')).find(
      (one) => one.textContent === name,
    );
    if (!found) throw new Error(`No row called ${name}`);
    return found.closest('button') as HTMLElement;
  };

  /** Turn the spread until a page of the story is up, without pressing it. */
  const turnToStoryPage = (): HTMLElement => {
    const next = screen.getByRole('button', { name: 'Next spread' });
    for (let turn = 0; turn < 14; turn += 1) {
      const story = (Array.from(document.querySelectorAll('.layout-sheet:not(.layout-no-sheet)')) as HTMLElement[]).find((one) =>
        one.querySelector('.bk-p'),
      );
      if (story) return story;
      fireEvent.click(next);
    }
    throw new Error('No page of the story was found');
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

  /**
   * §9a took two headings out and §9k puts three back, which only looks like
   * a reversal. What §9a removed were **rows that carried buttons and a
   * sentence** and said nothing about where anything was; what §9k adds is a
   * label per area, which is the one thing a row cannot say — and it is a
   * reading of the rows beside it rather than a structure of its own.
   */
  it('is one list in the order the book is bound, labelled by area and nothing else said', () => {
    render(<Harness initial={novel()} />);
    expect(railRows()).toEqual(['Half title', 'Title page', 'Copyright', 'Contents', 'The Lamp', 'The Return', 'About the author']);
    const rail = document.querySelector('.layout-rail') as HTMLElement;
    // The areas, in the order the book is bound.
    expect(Array.from(rail.querySelectorAll('.layout-rail-area')).map((one) => one.textContent)).toEqual([
      'Front matter',
      'The story',
      'Back matter',
    ]);
    // …and none of the extra wording §9a took out has come back with them.
    expect(rail.querySelectorAll('h3')).toHaveLength(0);
    expect(rail.textContent).not.toMatch(/above the first paragraph|Picture facing/);
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
    // Shut, the chapter hides what is in it (§9o) — the picture included.
    expect(railRows()).toEqual(['Half title', 'Title page', 'Copyright', 'Contents', 'The Lamp', 'The Return', 'About the author']);
    openFold('The Lamp');
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

  /**
   * The room opens the page **itself** (addendum 20 §9d).
   *
   * It used to hand the chapter to the workspace, and only a popped-out room
   * kept its own dialog — fine while the dialog could do nothing the room had
   * to help with. *Add custom graphic…* ended that: the box is drawn on the
   * spread behind the dialog, so the only screen that can offer it is the one
   * holding that spread.
   */
  it('opens the chapter’s own page on a double-click of its row, in the room', () => {
    const opened: string[] = [];
    render(<Harness initial={novel()} onOpenChapterPage={(markerId) => opened.push(markerId)} />);
    fireEvent.doubleClick(railRow('The Lamp'));

    const dialog = screen.getByRole('dialog', { name: 'Chapter page' });
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(within(dialog).getByRole('button', { name: 'Add custom graphic…' })).toBeDefined();
    // The workspace is not asked to open one as well: two dialogs for one act.
    expect(opened).toEqual([]);
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
    // Nothing chosen: there is no column at all (§9f), and the book-wide
    // settings are a button on the bar rather than a sentence pointing at one.
    expect(screen.queryByLabelText('Trim size')).toBeNull();
    expect(document.querySelector('.layout-inspector')).toBeNull();
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
    // The figure is under its chapter, so the chapter is opened first (§9o).
    // **A double-click opens it** (§9u): with the column gone, the picture's
    // fields are on the page it stands on, and the picture in hand is the one
    // that page's dialog is about.
    openFold('The Lamp');
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.doubleClick(rail.getByRole('button', { name: /^The harbour/ }));
    expect((screen.getByLabelText('Figure place') as HTMLSelectElement).value).toBe('measure');
    // A page of its own. **Which side is not asked** (§9j, from Ken: *you can
    // take the which page out and just make it whatever the selected page*):
    // the picture goes where it was put, and the one thing that side control
    // was really for — holding a leaf for a facing illustration — is the
    // blank-back box below, which is honest about what it does.
    fireEvent.change(screen.getByLabelText('Figure place'), { target: { value: 'page' } });
    expect(screen.queryByLabelText('Which page')).toBeNull();
    let placed = figurePlacement((latest as ProjectFile).beats[0]!.manuscript.elements[1]!);
    expect(placed).toMatchObject({ place: 'page' });
    expect(screen.getByText(/The picture fills the page, edge to edge/)).toBeDefined();
    fireEvent.click(screen.getByLabelText('Leave the back of the page blank'));
    expect(backBlank((latest as ProjectFile).beats[0]!.manuscript.elements[1]!)).toBe(true);
    // Cut into the text instead: a width and a border, and the back leaf
    // forgotten, a picture in the text having no back to leave.
    fireEvent.change(screen.getByLabelText('Figure place'), { target: { value: 'right' } });
    expect(screen.queryByLabelText('Leave the back of the page blank')).toBeNull();
    expect(backBlank((latest as ProjectFile).beats[0]!.manuscript.elements[1]!)).toBe(false);
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
    openFold('The Lamp');
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.doubleClick(rail.getByRole('button', { name: /^The harbour/ }));
    const draw = screen.getByRole('button', { name: 'Draw the box…' });
    expect(draw.getAttribute('aria-pressed')).toBe('false');
    // **Taking the tool up closes the page's dialog** (§9d, §9u): the box is
    // drawn on the spread the dialog was covering, so it gets out of the way.
    fireEvent.click(draw);
    expect((document.querySelector('.layout-page-dialog') as HTMLElement).hasAttribute('open')).toBe(false);
    // The box is drawn on a page of the story, which is where a figure can go.
    const sheet = turnToStoryPage();
    expect(sheet.classList.contains('layout-sheet-drawing')).toBe(true);
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
    // The tool is down, and the picture's own screen is a double-click away
    // again — which is the one way to it now (§9u).
    fireEvent.doubleClick(rail.getByRole('button', { name: /^The harbour/ }));
    expect(screen.getByRole('button', { name: 'Draw the box…' }).getAttribute('aria-pressed')).toBe('false');
  });

  /**
   * How big the spread is drawn (§9e). The room opened at a stored 0.55
   * whatever window it was opened in — a third of a wide screen, and more than
   * a laptop could hold. It fits now, and *Fit* is a state the foot says out
   * loud rather than a number the writer has to recognise.
   */
  it('fits the spread to the window, and says which of the two it is', () => {
    // jsdom lays nothing out, so the stage is measured for it.
    const client = (name: 'clientWidth' | 'clientHeight', value: number) =>
      Object.defineProperty(HTMLElement.prototype, name, { configurable: true, value });
    client('clientWidth', 1013);
    client('clientHeight', 959);
    try {
      render(<Harness initial={novel()} />);
      const zoom = screen.getByLabelText('Page zoom') as HTMLInputElement;
      // Nothing was chosen, so the size is a reading: the word says so and
      // there is nothing to press — absent rather than greyed.
      expect(screen.getByText('Fit')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Fit' })).toBeNull();
      const fitted = Number(zoom.value) / 100;
      expect(fitted).toBeGreaterThan(0.55);
      // And what is drawn really is inside the space it was fitted to.
      const box = document.querySelector('.layout-spread-box') as HTMLElement;
      expect(Number.parseFloat(box.style.width)).toBeLessThanOrEqual(1013);
      expect(Number.parseFloat(box.style.height)).toBeLessThanOrEqual(959);

      // A zoom set by hand is the writer's, and the same place is the way back.
      fireEvent.change(zoom, { target: { value: '40' } });
      expect((screen.getByLabelText('Page zoom') as HTMLInputElement).value).toBe('40');
      fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
      expect(Number((screen.getByLabelText('Page zoom') as HTMLInputElement).value) / 100).toBe(fitted);
      expect(screen.queryByRole('button', { name: 'Fit' })).toBeNull();
    } finally {
      // @ts-expect-error restoring jsdom's own getters
      delete HTMLElement.prototype.clientWidth;
      // @ts-expect-error restoring jsdom's own getters
      delete HTMLElement.prototype.clientHeight;
    }
  });

  /**
   * **There is no column at all** (§9u, from Ken: *since we can double click
   * any of the pages and it opens up the dialog box, let's remove the
   * right-hand menu. There's no need for it. It's just redundant*).
   *
   * §9f had already made it the selection's, so it stood only when something
   * was chosen — and what it then held was the screen the double-click opens.
   * A second copy of one screen is what this room keeps finding and removing;
   * this time the copy was the column itself.
   */
  it('has no column beside the spread, whatever is chosen', () => {
    render(<Harness initial={novel()} />);
    const gone = () => {
      expect(document.querySelector('.layout-inspector')).toBeNull();
      expect(screen.queryByLabelText('Inspector width')).toBeNull();
    };
    gone();
    // The double-click is the only way to what sets a page, so it is the one
    // thing on this screen that has to be told rather than seen.
    const note = document.querySelector('.layout-rail-note') as HTMLElement;
    expect(note.textContent).toMatch(/double-click opens what sets a page/);
    expect(note.textContent).not.toMatch(/Picture|Book settings/);

    // Choosing a part turns to its page and brings no column with it.
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.click(rail.getByRole('button', { name: /^Half title/ }));
    gone();
    expect(screen.queryByLabelText('Half title')).toBeNull();
    // The double-click opens the page's own screen (§9n).
    fireEvent.doubleClick(rail.getByRole('button', { name: /^Half title/ }));
    expect(screen.getByLabelText('Half title').hasAttribute('open')).toBe(true);
  });

  /**
   * One book, one page count (§9g). `estimatedPages` guesses a count from the
   * words because the gutter needs one before the book is laid; the guess used
   * to survive into the sentences, so the bar said *13 pages* while the margin
   * sentence beside it said *worked out from the trim and 9 pages*.
   */
  it('says the count the book has, not the guess the gutter was worked out from', () => {
    render(<Harness initial={novel()} />);
    const laid = document.querySelector('.layout-count')?.textContent ?? '';
    const count = Number(laid.match(/^(\d+)/)?.[1]);
    expect(count).toBeGreaterThan(0);

    openBookSettings();
    const dialog = screen.getByRole('dialog', { name: 'Book settings' });
    const said = dialog.textContent ?? '';
    expect(said).toContain(`the trim and ${count} page`);
    expect(said).toContain(`At ${count} page`);
  });

  /**
   * A page of the story gets a screen of its own (§9h, from Ken: *when you
   * click on a page it has a bunch of extra dialogue, like chapter pages…
   * trying to enter any information just changes title pages*).
   *
   * It had none: a page belongs to no record, so a press fell through to the
   * chapter in force or to the part whose pages it sat among.
   */
  it('drops a chapter down into its pages, and a page of the story does pictures and nothing else', () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);

    // Folded to begin with: a chapter is one row until somebody asks.
    expect(document.querySelectorAll('.layout-rail-page')).toHaveLength(0);
    // The fold on the **chapter**, named rather than taken as the first one on
    // the rail: since §17e a part folds too (it holds its own page and the leaf
    // its recto rule left in front of it), so *the first row with a fold* is
    // the half title.
    const chapter = document.querySelector('.layout-rail-chapter') as HTMLElement;
    fireEvent.click(within(chapter).getByLabelText(/^Show what is under /));
    const pages = document.querySelectorAll('.layout-rail-page');
    expect(pages.length).toBeGreaterThan(0);
    // **Each row is its page** (§9l, from Ken: *it should say page two, page
    // three, page four, page five*), with what stands on it after the number
    // where that is anything but plain text.
    expect(pages[0]!.textContent).toMatch(/^(⠿)?Page \w+/);
    for (const page of pages) expect(page.textContent).not.toMatch(/^Text/);
    /**
     * The first page a chapter folds open on may be the **empty leaf in front
     * of it** (§9w): a page under no row at all is one a writer cannot reach
     * from the rail, which is §9m's *every page is accounted for* and the
     * stray page Ken could not get rid of. What the rest of this is about is
     * a page of the story, so it is the first that carries one.
     */
    const story = (Array.from(pages) as HTMLElement[]).find((page) => !/Blank/.test(page.textContent ?? ''))!;
    expect(story).toBeTruthy();

    // Choosing one puts that page in hand and nothing else: the page's screen
    // is what a **double-click** opens (§9u), the column that used to answer a
    // single press being gone.
    // The row carries a name and a × (§9x), so the press names which.
    fireEvent.click(story.querySelector('.layout-rail-name') as HTMLElement);
    expect(document.querySelector('.layout-inspector')).toBeNull();
    fireEvent.doubleClick(story.querySelector('.layout-rail-name') as HTMLElement);
    const panel = document.querySelector('.layout-page-dialog') as HTMLElement;
    expect(panel.hasAttribute('open')).toBe(true);
    // What the panel used to say in prose is behind the ? (§9m, from Ken:
    // *all this extra text that's instructional can be a floating help box*),
    // and it floats rather than opening in the flow.
    expect(panel.textContent).not.toMatch(/this page’s alone/);
    fireEvent.click(within(panel).getByLabelText(/^About page /));
    expect(panel.textContent).toMatch(/this page’s alone/);
    expect(within(panel).getByRole('button', { name: 'Put a picture on this page…' })).toBeDefined();
    // And **Done** is gone (§9m): it did nothing the × did not.
    expect(within(panel).queryByRole('button', { name: 'Done' })).toBeNull();
    // How the page is set is a **way through** rather than a second copy
    // (§9l): the chapter page's own controls stay in the chapter page's
    // dialog, so two screens cannot disagree about how a chapter opens.
    expect(within(panel).getByRole('button', { name: 'Set this chapter’s page…' })).toBeDefined();
    // And nothing from the chapter's page or the book's settings is on it.
    expect(within(panel).queryByLabelText('Trim size')).toBeNull();
    expect(within(panel).queryByLabelText('The number size')).toBeNull();
    expect(panel.textContent).not.toMatch(/epigraph|Book title/i);
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

  /**
   * **A page made opens** (§9u). While there was a column the new part's
   * fields appeared in it the moment it was added; with the column gone,
   * adding a page would otherwise answer with a rail row and nothing else,
   * and a writer who has just made a preface is looking for somewhere to
   * type it.
   */
  it('adds a part, opens it, edits its words, and removes it after asking', () => {
    render(<Harness initial={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Preface/ }));
    expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'preface')).toBe(true);
    expect(screen.getByLabelText('Part').hasAttribute('open')).toBe(true);
    fireEvent.change(screen.getByLabelText("The part's text"), { target: { value: 'A word first.' } });
    expect(partsOf(latest as ProjectFile).find((part) => part.kind === 'preface')?.text).toBe('A word first.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(partsOf(latest as ProjectFile).some((part) => part.kind === 'preface')).toBe(false);
  });

  /**
   * A dedication is a **designed** page, so it has gone to its own screen
   * since §9n — and the older fields went on offering a second set for it
   * from the column. With the column gone there is one screen (§9u).
   */
  it('opens a designed page on its own screen rather than on the older fields', () => {
    render(<Harness initial={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Dedication/ }));
    expect(screen.getByLabelText('Dedication').hasAttribute('open')).toBe(true);
    expect(screen.getByLabelText('Part').hasAttribute('open')).toBe(false);
    expect(screen.queryByLabelText("The part's text")).toBeNull();
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

  /**
   * The copyright page's own dialog is reached from **both** gestures
   * (§15a, from Ken: *the new copyright page is not live*). It was
   * reachable from the inspector alone, so the double-click — the one
   * gesture the room documents for *open the thing that sets this page* —
   * landed on the free-text box the dialog replaces, and the whole feature
   * read as unbuilt. What this pins is the route rather than the dialog,
   * which has tests of its own.
   *
   * §15c finished it: the double-click goes **straight** to the screen
   * rather than through the older dialog, because a route that lands a
   * writer on the box the new screen replaces is a route they read as a
   * failure — which is exactly what Ken read it as.
   */
  it('opens the copyright page from the row, and from the double-click', () => {
    render(<Harness initial={novel()} />);
    const rail = document.querySelector('.layout-rail') as HTMLElement;
    const row = within(rail).getByRole('button', { name: /^Copyright/ });

    // One click chooses the row and opens nothing (§9u): the column that used
    // to carry a button through to this screen is gone, and with it the last
    // place the older fields could be reached from.
    fireEvent.click(row);
    expect(screen.queryByRole('button', { name: 'The copyright information…' })).toBeNull();
    expect(screen.getByLabelText('Copyright page').hasAttribute('open')).toBe(false);

    // The double-click opens that screen itself: one page, one gesture,
    // and the older dialog never stands in front of it.
    fireEvent.doubleClick(row);
    expect(screen.getByRole('button', { name: 'Trade standard' })).toBeTruthy();
    expect(screen.getByLabelText('Part').hasAttribute('open')).toBe(false);
    // The type the older dialog held is here, so nothing was left behind.
    const dialog = within(screen.getByLabelText('Copyright page'));
    expect(dialog.getByLabelText('Typeface')).toBeTruthy();
    expect(dialog.getByRole('button', { name: 'Italic' })).toBeTruthy();
    expect(dialog.getByLabelText('Letter spacing')).toBeTruthy();
  });

  /**
   * The room opens on a part when it is asked for (§16b, from Ken: *the title
   * page dialogue box not showing — probably same problem as copyright had*).
   * It was: *File ▸ Title page…* is the one route the menu documents, and on
   * a book it opened the **screenplay's** front page — Written by, Contact,
   * Draft date — so the panel he had just specified read as unbuilt.
   */
  it('opens on the part it was asked for, and the title page is the book’s', () => {
    render(<Harness initial={novel()} openOnKind="title_page" />);
    // The book's own screen, not the screenplay's front page.
    expect(screen.getByLabelText('Title page').hasAttribute('open')).toBe(true);
    expect(screen.getByText('5 of 7 shown')).toBeTruthy();
    expect(screen.queryByLabelText('Draft date')).toBeNull();
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

  /**
   * **The contents follows a reorder at once** (§9v, from Ken: *when you
   * reorder anything, in that left menu… right now it updates but you have to
   * erase and reload the page*).
   *
   * The rail reads the file and redrew immediately; the contents, the running
   * heads and every page number come off the **laying**, and what the laying
   * watched did not include where a unit falls — so a chapter dragged rekeyed
   * the units it moved without touching a word, and the room went on drawing
   * the book in the order it used to be in.
   */
  it('re-lays the book when a chapter is dragged, so the contents is the new order', () => {
    render(<Harness initial={addPart(novel(), 'contents').file} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    const row = (name: RegExp) => rail.getByRole('button', { name }).closest('li') as HTMLElement;
    const listed = () =>
      Array.from(document.querySelectorAll('.layout-sheet .bk-contents-title')).map((one) => one.textContent ?? '');
    // Turn the spread to the contents page, which is where the list is drawn.
    fireEvent.click(rail.getByRole('button', { name: /^Contents/ }));
    // The two chapters and the back matter after them.
    expect(listed()).toEqual(['The Lamp', 'The Return', 'About the author']);

    fireEvent.dragStart(row(/^Chapter 2/), { dataTransfer: { setData: () => undefined } });
    fireEvent.dragOver(row(/^Chapter 1/));
    fireEvent.drop(row(/^Chapter 1/));
    fireEvent.dragEnd(row(/^Chapter 2/));

    // The story order moved, and so did the page that lists it — with nothing
    // closed, nothing reopened and nothing reloaded.
    expect(unitsInStoryOrder(latest as ProjectFile).map((unit) => unit.title)).toEqual(['The Return', 'Chapter One']);
    expect(listed()).toEqual(['The Return', 'The Lamp', 'About the author']);
  });

  /**
   * **What the contents lists** (§9v, from Ken: *you need to be able to select
   * in the menu what is going to be in the table of contents… that can be done
   * in the contents dialog box*). Everything until somebody says otherwise.
   */
  it('ticks what the contents page lists, on the contents page’s own screen', () => {
    render(<Harness initial={addPart(novel(), 'contents').file} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.doubleClick(rail.getByRole('button', { name: /^Contents/ }));
    const picker = document.querySelector('.layout-contents-picker') as HTMLElement;
    expect(picker).not.toBeNull();
    expect(picker.textContent).toMatch(/Everything in the book/);
    const boxes = within(picker).getAllByRole('checkbox');
    expect(boxes.every((box) => (box as HTMLInputElement).checked)).toBe(true);

    // The list is the contents itself, in the book's order.
    const names = Array.from(picker.querySelectorAll('.layout-contents-name')).map((one) => one.textContent ?? '');
    expect(names.some((name) => name.includes('The Lamp'))).toBe(true);
    expect(names.some((name) => name.includes('The Return'))).toBe(true);

    // Untick one: the page stops printing it, and the row stays to be
    // ticked again — what is stored is only what was taken off.
    const at = names.findIndex((name) => name.includes('The Return'));
    fireEvent.click(boxes[at]!);
    expect([...outOfContents(latest as ProjectFile)]).toHaveLength(1);
    expect(picker.textContent).toMatch(/1 left off/);
    // The page beside the list, which is what the ticks are checked against.
    expect(
      Array.from(document.querySelectorAll('.layout-page-preview .bk-contents-title')).map((one) => one.textContent ?? ''),
    ).toEqual(['The Lamp', 'About the author']);
    // And back on again, which is the whole of why the row stays.
    fireEvent.click(within(picker).getAllByRole('checkbox')[at]!);
    expect(outOfContents(latest as ProjectFile).size).toBe(0);
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
    expect((latest as ProjectFile).settings.chapterPageStyle?.number).toMatchObject({ size: 20 });

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

  /**
   * **Which title goes on which top** (§7c, from Ken: *there's no way to
   * determine the title on one side or the other*).
   *
   * What this pins is the **gesture** rather than the control (§15a): the pair
   * that decides the two tops has existed since §7a, 1,300px further down this
   * dialog under a printer's word for the top of a page, and a writer who had
   * just typed the book title could not reach it. So the assertions that
   * matter are that each side has **its own** control and that both stand in
   * **the same fold as the title** — a test asking only whether a control
   * exists would have passed before this and after §7b alike.
   */
  it('gives each top its own control, in the fold where the titles are typed', () => {
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    file = beginStory(file, { title: 'The Road' }).file;
    render(<Harness initial={file} onOpenChapterPage={() => undefined} />);
    openBookSettings();
    const dialog = screen.getByRole('dialog', { name: 'Book settings' });
    const title = within(dialog).getByLabelText('Book title');
    const left = within(dialog).getByLabelText('Verso running head');
    const right = within(dialog).getByLabelText('Recto running head');
    // Two sides, two controls, both beside the titles they choose between.
    expect(left).not.toBe(right);
    expect(title.closest('.layout-fold')).toBe(left.closest('.layout-fold'));
    expect(title.closest('.layout-fold')).toBe(right.closest('.layout-fold'));
    expect(within(dialog).getByText('Top of left-hand pages')).toBeDefined();
    expect(within(dialog).getByText('Top of right-hand pages')).toBeDefined();

    // Each offers the same five, the division's title in the format's own noun.
    const options = within(right as HTMLElement).getAllByRole('option').map((one) => one.textContent);
    expect(options).toEqual(['The author', 'The book’s title', 'The story’s title', 'Words of your own', 'Nothing']);

    // The sides are set apart: one the book, the other the story.
    fireEvent.change(left, { target: { value: 'title' } });
    fireEvent.change(right, { target: { value: 'chapter' } });
    expect((latest as ProjectFile).settings.book?.runningHeads).toMatchObject({ verso: 'title', recto: 'chapter' });

    // And the sentence says what the two tops will print, in the book's words.
    fireEvent.change(title, { target: { value: 'Harbour Tales' } });
    expect(within(dialog).getByText('“Harbour Tales” on the left, “The Road” on the right.')).toBeDefined();

    // A side's own words are its own, and the box is absent until it is asked for.
    expect(within(dialog).queryByLabelText('Verso running head words')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Verso running head'), { target: { value: 'custom' } });
    fireEvent.change(within(dialog).getByLabelText('Verso running head words'), { target: { value: 'A Harbour Reader' } });
    expect((latest as ProjectFile).settings.book?.runningHeads).toMatchObject({ versoText: 'A Harbour Reader', recto: 'chapter' });
    expect(within(dialog).queryByLabelText('Recto running head words')).toBeNull();
  });

  /**
   * **One place, not two.** §7b left the pair in the furniture fold and put a
   * second control over the same two fields in *The book*, which is two folds
   * offering one choice — the confusion this was meant to end. The fold that
   * styles the heads now says what they will print and points at where the
   * choice is made.
   */
  it('leaves no second place to choose what the tops carry', () => {
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    file = beginStory(file, { title: 'The Road' }).file;
    render(<Harness initial={file} onOpenChapterPage={() => undefined} />);
    openBookSettings();
    const dialog = screen.getByRole('dialog', { name: 'Book settings' });
    expect(within(dialog).getAllByLabelText('Verso running head')).toHaveLength(1);
    expect(within(dialog).getAllByLabelText('Recto running head')).toHaveLength(1);
    const furniture = within(dialog).getByRole('button', { name: 'Running heads & page numbers' }).closest('.layout-fold')!;
    expect(within(furniture as HTMLElement).queryByLabelText('Verso running head')).toBeNull();
    // It is not blind to them: it says what they will print and where to choose.
    expect(furniture.textContent).toMatch(/on the left, .+ on the right/);
    expect(furniture.textContent).toMatch(/chosen in/);
    // And it keeps what it is for — how they are set, and where they sit.
    expect(within(furniture as HTMLElement).getByLabelText('Running head place')).toBeDefined();
    expect(within(furniture as HTMLElement).getByLabelText('Running head face')).toBeDefined();
  });

  it('names the division beside the book, so a top can carry something typed', () => {
    /**
     * §9y, from Ken: *the book title is now correct, but just underneath that,
     * we need to have the story title or chapter. And you should be able to
     * type that in instead of trying to take it from the actual file name.*
     *
     * The two tops choose between two titles, so both titles are typed where
     * the choice is made — and it is the **division's own title** through
     * `updateMarker`, one field with two doors, never a second string for the
     * running head alone.
     */
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    file = beginStory(file, { title: 'ken-harbour' }).file;
    render(<Harness initial={file} onOpenChapterPage={() => undefined} />);
    openBookSettings();
    const dialog = screen.getByRole('dialog', { name: 'Book settings' });
    const box = within(dialog).getByLabelText('Story title') as HTMLInputElement;
    // It stands in the same fold as the book's title, beside the two tops.
    expect(box.closest('.layout-fold')).toBe(within(dialog).getByLabelText('Book title').closest('.layout-fold'));
    expect(box.value).toBe('ken-harbour');
    fireEvent.change(box, { target: { value: 'The Harbour' } });
    expect(contentsDivisions(latest!)[0]!.marker.title).toBe('The Harbour');
    // And it is the format's own noun rather than the word *chapter*.
    expect(within(dialog).queryByLabelText('Chapter title')).toBeNull();
  });

  it('puts a blank page in from the Add button, in front of the page in hand', () => {
    /**
     * §9y, from Ken: *I want the ability to put a blank page anywhere. So in
     * the plus add button, I want to be able to put a blank page* — and then
     * *I'm trying to enter a blank page so the chapter opening moves a page.*
     *
     * The act is §9r's; what was missing is the route. It stood on the page's
     * own dialog and on a part's panel, so the button a writer presses to put
     * a page in did not offer one.
     */
    render(<Harness initial={novel()} />);
    // The menu stays up while a page is chosen, and its item is read again
    // for whatever is in hand — so the walk is a writer turning the pages.
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    const blankItem = () => screen.getByRole('menuitem', { name: /blank page/i }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: 'Next spread' });
    for (let turn = 0; turn < 14; turn += 1) {
      for (const sheet of Array.from(document.querySelectorAll('.layout-sheet:not(.layout-no-sheet)')) as HTMLElement[]) {
        fireEvent.click(sheet);
        const item = blankItem();
        if (item.disabled) {
          // Greyed with the reason in its title, never silently dead.
          expect(item.title).toBeTruthy();
          continue;
        }
        const before = latest!;
        fireEvent.click(item);
        expect(latest).not.toBe(before);
        // A leaf the **writer** put in — `blankFor` is what says so, and what
        // lets its own page take it away again (§9i).
        expect(bookBlocks(latest!).some((block) => block.kind === 'blank' && Boolean(block.blankFor))).toBe(true);
        return;
      }
      fireEvent.click(next);
    }
    throw new Error('No page of the book offered a blank leaf');
  });

  it('says why rather than offering a leaf where none can go', () => {
    // A control that can only refuse is one a writer stops trusting, so the
    // item is greyed with the reason in its title — `pictureOffer`'s shape.
    render(<Harness initial={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    const item = screen.getByRole('menuitem', { name: /blank page/i }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.title).toMatch(/Choose a page first/i);
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
    // **A picture goes in from the box itself** (§9m, from Ken: *there's
    // nothing that allows you to actually put a graphic in the box area*),
    // beside the ✗ and the ✓ rather than a panel away — and the box says
    // what it measures, and carries corners to drag. Since §9u this is the
    // whole answer on the spread: nothing opens a panel behind the box a
    // writer is still placing.
    expect(document.querySelector('.layout-placing-size')?.textContent).toMatch(/in/);
    expect(document.querySelectorAll('.layout-placing-grip')).toHaveLength(4);
    expect(document.querySelector('.layout-inspector')).toBeNull();

    // And the picture goes in afterwards, which is the order Ken asked for.
    fireEvent.click(screen.getByLabelText('Put a picture in this box'));
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

  /**
   * **The two rows that opened nothing** (§9u).
   *
   * A section and a picture are not records with screens of their own — a
   * chapter inside a story is a section whose heading opens a page (addendum
   * 22 §6), and a picture stands where it stands in the writing — so neither
   * had a double-click at all, which was survivable only while the column
   * answered a single press for them. Both open the page they stand on now.
   */
  it('opens a section and a graphic set over the page from their rows', () => {
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    file = beginStory(file, { title: 'The Road' }).file;
    const track = file.tracks[0]!.id;
    const made = addUnit(file, { trackId: track, title: 'II.' });
    file = made.file;
    const beat = addBeat(file, { unitId: made.unit.id, title: 'II.' });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: {
        elements: [
          // A graphic set over the page (§8c): it rides the block after it
          // without being one, so the row could not find the page it stands
          // on — no number beside it in the rail, and nothing to open.
          { id: 'g-1' as never, type: 'figure', text: 'A flourish', characterId: null, attributes: { assetId: 'a1', bookPlace: 'free' } },
          { id: 'p-1' as never, type: 'paragraph', text: 'The road again.', characterId: null, attributes: {} },
        ],
      },
    } as never);
    render(<Harness initial={file} onOpenChapterPage={() => undefined} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    const dialog = () => document.querySelector('.layout-page-dialog') as HTMLElement;

    openFold('The Road');
    // eslint-disable-next-line no-console
    fireEvent.doubleClick(railRow('II.'));

    expect(dialog().hasAttribute('open')).toBe(true);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));

    // And the free graphic, whose own fields are on the page it stands on.
    openFold('II.');
    // The row carries its page number, which is the visible half of the same
    // fix: without it `pageOf` found no page and there was nothing to open.
    expect(railRow('A flourish').textContent).toMatch(/2$/);
    fireEvent.doubleClick(rail.getByRole('button', { name: /^A flourish/ }));
    expect(dialog().hasAttribute('open')).toBe(true);
    expect((within(dialog()).getByLabelText('Figure place') as HTMLSelectElement).value).toBe('free');
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

  /**
   * **The half title and the title page have one screen** (§9u).
   *
   * Both are *block* pages, so both have opened the designed-page screen
   * since §9n — and the older fields went on offering a second set for
   * them, reachable from the column: a heading that was not a heading, a
   * sentence pointing at Book settings, a subtitle box beside the one §16d
   * built. That is the two-answers fault this room keeps finding, and the
   * column was what kept it alive. What each screen holds is pinned by
   * `designed-page-dialog.test.tsx`; what this pins is that there is one.
   */
  it('gives the title page and the half title one screen, and the older fields none', () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    for (const name of [/^Title page/, /^Half title/]) {
      const row = rail.getByRole('button', { name });
      // A press chooses the row and offers nothing to type.
      fireEvent.click(row);
      expect(screen.queryByText(/This page prints/)).toBeNull();
      expect(screen.queryByLabelText("The part's heading")).toBeNull();
      expect(screen.queryByLabelText('Title art file')).toBeNull();
      expect(screen.getByLabelText('Part').hasAttribute('open')).toBe(false);
      // The double-click opens the page's own screen, and it is the book's
      // fields that are on it (§16d: one value, two doors).
      fireEvent.doubleClick(row);
      const panel = document.querySelector('.designed-page-dialog') as HTMLElement;
      expect(panel.hasAttribute('open')).toBe(true);
      expect(panel.getAttribute('aria-label')).toBe(name.source.replace('^', ''));
      fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    }
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
   * A font of the writer's own (addendum 20 §6b, from Ken: *put an option to
   * import a font … download a font, select it from a browse, and add it to
   * your fonts*).
   *
   * The file is read by the host, so what is pinned here is the way in: the
   * fold, the browse, the name it takes, and that it joins the face list
   * without the book being re-set behind the writer's back.
   */
  it('takes a font in from a browse, and never chooses it for the writer', async () => {
    render(<Harness initial={novel()} />);
    openBookSettings();
    const dialog = screen.getByRole('dialog', { name: 'Book settings' });
    const before = bookSettingsOf(latest as ProjectFile).face;

    expect(within(dialog).getByText(/None yet/)).toBeDefined();
    const picker = within(dialog).getByLabelText('Font file') as HTMLInputElement;
    const font = new File(['fake font bytes'], 'EBGaramond-Regular.ttf', { type: 'font/ttf' });
    Object.defineProperty(picker, 'files', { value: [font], configurable: true });
    fireEvent.change(picker);
    await waitFor(() => expect(bookFontsOf(latest as ProjectFile)).toHaveLength(1));

    // Named after the file, tidied, and the format read off its extension.
    const added = bookFontsOf(latest as ProjectFile)[0]!;
    expect(added.family).toBe('EBGaramond Regular');
    expect(added.format).toBe('truetype');

    // In the face list — and the book is still in what it was set in.
    expect(within(dialog).getByRole('option', { name: /EBGaramond Regular — your own/ })).toBeDefined();
    expect(bookSettingsOf(latest as ProjectFile).face).toBe(before);

    // Until the writer says so.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use it' }));
    expect(bookSettingsOf(latest as ProjectFile).face).toBe(faceOfFont(added));
    expect(within(dialog).getByRole('button', { name: 'In use' })).toBeDefined();

    // And taking it out leaves the book printing, in the fallback.
    fireEvent.click(within(dialog).getByRole('button', { name: `Remove ${added.family}` }));
    expect(bookFontsOf(latest as ProjectFile)).toHaveLength(0);
    expect(within(dialog).getByText(/None yet/)).toBeDefined();
  });

  /**
   * The custom graphic (addendum 20 §9d, from Ken: *when you say add custom
   * graphic … the menu disappears and allows you to draw a box where you want
   * the graphic, and then the text will move around it*).
   *
   * The page dialog offers it, the dialog goes when it is pressed, and the
   * room is left drawing. Sliding and the two marks are a pointer gesture over
   * a laid page, which jsdom has no geometry for — they are driven in Chromium
   * instead, and what is pinned here is the way in and the way out.
   */
  it('offers the custom graphic on the page, and leaves the room drawing', () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.doubleClick(rail.getByRole('button', { name: /^Chapter 1/ }));

    const dialog = screen.getByRole('dialog', { name: 'Chapter page' });
    const draw = within(dialog).getByRole('button', { name: 'Add custom graphic…' });
    fireEvent.click(draw);

    // The dialog goes: the box is drawn on the spread it was covering.
    expect(screen.queryByRole('dialog', { name: 'Chapter page' })?.hasAttribute('open')).not.toBe(true);
    // And the room says it is waiting for the drag.
    expect(document.querySelector('.layout-sheet-drawing')).toBeDefined();
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

  /**
   * A **designed** page — one that is a block of words on a page of its own
   * — opens on its own screen now (§9n), which is the half title, the title
   * page, a dedication and an epigraph. A foreword still opens the older
   * fields, because those three sections are about placing a block and a
   * page that flows has none to place.
   */
  it('opens a designed page on its own screen, and a page that flows on the older fields', async () => {
    render(<Harness initial={novel()} />);
    const rail = within(document.querySelector('.layout-rail') as HTMLElement);
    fireEvent.doubleClick(rail.getByRole('button', { name: /^Half title/ }));
    const dialog = screen.getByRole('dialog', { name: 'Half title' });
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.querySelector('.dp-title strong')?.textContent).toBe('Half title');
    // The three sections, in order.
    expect(within(dialog).getByText('What goes on the page')).toBeDefined();
    expect(within(dialog).getByText('Placement')).toBeDefined();
    expect(within(dialog).getByText('Typography')).toBeDefined();
    // The page as set: the same markup the spread draws.
    await waitFor(() => expect(dialog.querySelector('.dp-sheet-box .bk-page')).not.toBeNull());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(dialog.hasAttribute('open')).toBe(false);

    // The contents flow, so they keep the fields the older dialog draws.
    fireEvent.doubleClick(rail.getByRole('button', { name: /^Contents/ }));
    expect(screen.getByRole('dialog', { name: 'Part' }).hasAttribute('open')).toBe(true);
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

  /**
   * **A page is a row with a × on it** (§9w, from Ken: *there's numbered
   * pages, page one, two, three. There's no way to delete those pages. There
   * needs to be a little X in the left menu allowing you to delete them*).
   *
   * §9a put a × on every row of the rail and meant it; the page rows came
   * afterwards (§9h) as a fold *under* a row rather than as rows, so they were
   * the only thing in this room with neither a × nor a grip. What these hold
   * down is the **gesture** rather than the act — the domain's own tests prove
   * `pageRemoval` — because a page row drawn without a × reads exactly like
   * the feature not being there, which is what he reported (addendum 20 §15a).
   */
  const openPages = (): HTMLElement[] => {
    // Only the folds that are shut, or a second call would close them again.
    for (let pass = 0; pass < 6; pass += 1) {
      const shut = document.querySelector('.layout-rail-fold[aria-expanded="false"]');
      if (!shut) break;
      fireEvent.click(shut);
    }
    return Array.from(document.querySelectorAll('.layout-rail-page')) as HTMLElement[];
  };
  /**
   * The pages **of the story**, which is what these are about. Since §17e a
   * part folds too, so the front matter's own leaves are rows of the rail as
   * well — and they come first, which is what the plain *the first page row*
   * these used to take now finds. The front matter numbers in roman and the
   * story in arabic, so the figure says which is which.
   */
  const storyPages = (): HTMLElement[] => openPages().filter((row) => /Page \d/.test(row.textContent ?? ''));

  it('gives every page row a ×, which is the whole of the report', () => {
    /**
     * §9w built this and made it **absent** on a chapter opening and on a
     * page of prose, which between them are every page of a story — so Ken
     * sent the report back word for word: *there's numbered pages, page one,
     * two, three. There's no way to delete those pages.*
     */
    render(<Harness initial={novel()} />);
    const pages = openPages();
    expect(pages.length).toBeGreaterThan(1);
    for (const row of pages) {
      expect(within(row).queryByLabelText(/^Remove page /), row.textContent ?? '').not.toBeNull();
    }
  });

  it('cuts the words on a page of the story, said before the press', () => {
    // His *stray page that has a bunch of information on it*: writing as far
    // as the manuscript is concerned, and no other screen will take it out.
    render(<Harness initial={novel()} />);
    const words = storyPages().find((row) => !/Blank|Illustration/.test(row.textContent ?? ''))!;
    expect(words).toBeTruthy();
    const before = latest!.beats.flatMap((beat) => beat.manuscript.elements).length;
    fireEvent.click(within(words).getByLabelText(/^Remove page /));
    expect(words.textContent).toMatch(/cut from the manuscript|takes the break out|words stay/);
    fireEvent.click(within(words).getByRole('button', { name: 'Remove' }));
    expect(latest!.beats.flatMap((beat) => beat.manuscript.elements).length).toBeLessThanOrEqual(before);
  });

  it('takes the leaf the writer put in away from its own row', () => {
    // §9r's own act, asked for on the second chapter, so the leaf falls inside
    // the first chapter's run and the rail lists it.
    const file = novel();
    const second = contentsDivisions(file)[1]!;
    render(<Harness initial={setChapterBlank(file, second.marker.id as string, 'before', true)} />);
    const leaf = storyPages().find((row) => /Blank/.test(row.textContent ?? ''));
    expect(leaf).toBeTruthy();
    fireEvent.click(within(leaf as HTMLElement).getByLabelText(/^Remove page /));
    // Asked once inline, with what would go said beside it.
    expect((leaf as HTMLElement).textContent).toMatch(/blank page goes|opens on whichever page comes next/i);
    fireEvent.click(within(leaf as HTMLElement).getByRole('button', { name: 'Remove' }));
    expect(document.querySelector('.layout-rail')).toBeTruthy();
  });

  it('carries the same act in the page’s own dialog', () => {
    /**
     * He described that dialog as *a very small dialogue box… put a picture,
     * draw a box for a picture, add a vector graphic* — pictures and nothing
     * else, on the screen he had opened to get rid of the page (§9x).
     */
    render(<Harness initial={novel()} />);
    const words = storyPages().find((row) => !/Blank|Illustration/.test(row.textContent ?? ''))!;
    fireEvent.doubleClick(words.querySelector('.layout-rail-name') as HTMLElement);
    const panel = document.querySelector('.layout-page-dialog') as HTMLElement;
    const act = within(panel).getByRole('button', { name: 'Take this page away' });
    fireEvent.click(act);
    expect(panel.textContent).toMatch(/cut from the manuscript|takes the break out|words stay/);
    expect(within(panel).getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('refuses + Picture where there is nowhere, rather than acting anyway', () => {
    /**
     * The fault Ken reported (§9w): on a page with nothing of the book on it
     * the Add menu refused and said *Choose a page first* while this button
     * carried the same words **in its title and acted anyway** — putting an
     * art page at the back of the book. One reading now, so the two agree.
     */
    render(<Harness initial={novel()} />);
    const button = document.querySelector('button.layout-add') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/Choose a page first/);
    // And it is live the moment a page of the story is in hand.
    chooseStoryPage();
    expect((document.querySelector('button.layout-add') as HTMLButtonElement).disabled).toBe(false);
  });

  it('gives a picture page a grip, and a page of words none', () => {
    // *It should be draggable so you can move things around if you wanted to,
    // the pages. Especially the pages that you import or pictures that you
    // import* — the landing is `moveFigureBefore`, the act redrawing the
    // box already ran, so this is a second door rather than a second answer.
    render(<Harness initial={novel()} />);
    for (const row of openPages()) {
      const picture = /Illustration/.test(row.textContent ?? '');
      expect(row.getAttribute('draggable')).toBe(String(picture));
    }
  });
});

/**
 * **The drawing tool puts itself down** (addendum 20 §9p, from Ken: *after
 * drawing a box and placing a picture, I tried to reselect it and I can't
 * select it, delete it, or manipulate it in any way*).
 *
 * The room refuses every press on the spread while a box is being drawn, and
 * four of the five ways out of the drag left the tool armed — so a press that
 * drew nothing stranded the writer with a spread that answered nothing and
 * said nothing about why.
 */
describe('drawing a box that never happens', () => {
  it('puts the tool down when a press draws nothing, so the spread answers again', () => {
    render(<Harness initial={novel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the book' }));
    // Any page will do: nothing is ever drawn here, and the drawing state is
    // the whole spread's.
    const story = document.querySelector('.layout-sheet:not(.layout-no-sheet)') as HTMLElement;
    fireEvent.click(story);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Draw a box for a picture…' }));
    expect(story.classList.contains('layout-sheet-drawing')).toBe(true);

    const rect = { left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    story.getBoundingClientRect = () => rect;
    story.setPointerCapture = () => undefined;
    // A press and a release in one place draws no box at all.
    fireEvent.pointerDown(story, { clientX: 240, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(story, { clientX: 240, clientY: 100, pointerId: 1 });

    // The tool is down, rather than left armed with nothing saying so.
    expect(story.classList.contains('layout-sheet-drawing')).toBe(false);
    // And the spread takes a press again, which is what was lost: while the
    // tool was armed every click on a page returned before selecting one.
    fireEvent.click(story);
    expect(document.querySelector('.layout-sheet-chosen')).toBeTruthy();
  });
});
