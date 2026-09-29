// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addSortCategory,
  addSource,
  beginSession,
  cardsIn,
  createProjectFile,
  extractToCategory,
  outlinesOf,
  researchCategoriesInOrder,
  sortCategories,
  sortingSessions,
  sourcesOf,
  unsortedOf,
  type ProjectFile,
} from '@vcwriter/domain';
import { NoteSorterWindow } from '../components/NoteSorterWindow';
import { menusFor } from '../menus';
import { ROOM_PANES, paneTitle } from '../panes';

/**
 * The Note Sorter on the screen (addendum 26 §4).
 *
 * What these hold down is the gestures rather than the type. Three of them are
 * the module's promises, and each is the sort of thing that reads exactly like
 * the feature not being there: **the press files a passage** (the drag is the
 * handoff's gesture and jsdom has no selection to drag, so the press is what a
 * test can hold and is also what a keyboard can reach), **nothing is created by
 * looking**, and **the room is reachable** — the route, which three revisions
 * running found to be the thing that was missing while the screen worked
 * (addendum 20 §15c, §16b, §16c).
 */

afterEach(cleanup);

let latest: ProjectFile | null = null;

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return (
    <NoteSorterWindow
      file={file}
      open
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

const FIRST = 'Rule one: the villain thinks he is the hero.';
const PAGE = [FIRST, '', 'Dialogue is two people not saying what they mean, at speed.'].join('\n');

/** A project with a sitting, a source and two categories. */
const sorting = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Guide', format: 'novel' });
  const begun = beginSession(file, 'Villain’s Guide · brainstorm');
  file = begun.file;
  file = addSource(file, {
    sessionId: begun.session.id,
    name: 'Brainstorm',
    text: PAGE,
    kind: 'paste',
  }).file;
  file = addSortCategory(file, { sessionId: begun.session.id, name: 'Character' }).file;
  file = addSortCategory(file, { sessionId: begun.session.id, name: 'Dialogue' }).file;
  return file;
};

describe('the Note Sorter room', () => {
  it('is a room, named in the one place that names a pane', () => {
    expect(ROOM_PANES).toContain('sorter');
    expect(paneTitle('sorter')).toBe('Note Sorter');
  });

  it('is reachable from the Window menu on every format', () => {
    for (const format of ['novel', 'screenplay', 'instructional', 'game'] as const) {
      const window_ = menusFor(format).find((menu) => menu.label === 'Window');
      expect(window_?.items.some((item) => item && item.command === 'window.sorter')).toBe(true);
    }
  });

  it('opens on Gather and makes nothing by being looked at', () => {
    const bare = createProjectFile({ title: 'Nothing yet', format: 'novel' });
    render(<Harness initial={bare} />);

    expect(screen.getByRole('tab', { name: '1 Gather' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Nothing put in yet/)).toBeTruthy();
    // `beginArc`'s rule (addendum 25 §4f): the record waits for an act.
    expect(sortingSessions(latest!)).toHaveLength(0);
    expect(researchCategoriesInOrder(latest!).length).toBeGreaterThan(0);
  });

  it('starts the sitting when something is put in, with its unsorted pile', () => {
    const bare = createProjectFile({ title: 'Nothing yet', format: 'novel' });
    render(<Harness initial={bare} />);

    fireEvent.change(screen.getByPlaceholderText(/Paste a page of notes/), {
      target: { value: 'A villain who is right.' },
    });
    fireEvent.change(screen.getByLabelText('What to call it'), { target: { value: 'Scraps' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add it' }));

    const sessions = sortingSessions(latest!);
    expect(sessions).toHaveLength(1);
    expect(sourcesOf(latest!, sessions[0]!.id).map((one) => one.name)).toEqual(['Scraps']);
    expect(unsortedOf(latest!, sessions[0]!.id)).toBeTruthy();
    // And it is not on the research shelf.
    expect(researchCategoriesInOrder(latest!).some((one) => one.name === 'Unsorted')).toBe(false);
  });

  it('files the highlighted passage when a category is pressed, and never cuts the source', () => {
    render(<Harness initial={sorting()} />);
    fireEvent.click(screen.getByRole('tab', { name: '2 Sort' }));

    const page = document.querySelector('.ns-page') as HTMLElement;
    const piece = page.querySelector('[data-from]') as HTMLElement;
    // jsdom has no real selection over a text node, so the range is made the
    // way the room reads one: an offset off `data-from`.
    const range = document.createRange();
    range.setStart(piece.firstChild!, 0);
    range.setEnd(piece.firstChild!, FIRST.length);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.mouseUp(page);

    fireEvent.click(screen.getByRole('button', { name: /Character/ }));

    const session = sortingSessions(latest!)[0]!;
    const character = sortCategories(latest!, session.id).find((one) => one.name === 'Character')!;
    const held = cardsIn(latest!, character.id);
    expect(held).toHaveLength(1);
    expect(held[0]!.body).toBe(FIRST);
    // Not a character of the source moved.
    expect(sourcesOf(latest!, session.id)[0]!.text).toBe(PAGE);
  });

  it('says what a press would do before it is pressed, and refuses with nothing chosen', () => {
    render(<Harness initial={sorting()} />);
    fireEvent.click(screen.getByRole('tab', { name: '2 Sort' }));

    const stack = screen.getByRole('button', { name: /Dialogue/ });
    expect(stack.getAttribute('title')).toContain('Highlight a passage');

    fireEvent.click(stack);
    expect(screen.getByText('Highlight some words first.')).toBeTruthy();
    expect(cardsIn(latest!, sortCategories(latest!, sortingSessions(latest!)[0]!.id)[1]!.id)).toHaveLength(0);
  });

  it('draws the four display modes, and greying is one of them rather than the text', () => {
    render(<Harness initial={sorting()} />);
    fireEvent.click(screen.getByRole('tab', { name: '2 Sort' }));

    const modes = screen.getByRole('group', { name: 'What to show of the source' });
    expect(
      within(modes)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Everything', 'Grey sorted', 'Hide sorted', 'Unsorted only']);

    const before = (document.querySelector('.ns-page') as HTMLElement).textContent;
    fireEvent.click(within(modes).getByRole('button', { name: 'Hide sorted' }));
    // Nothing is sorted yet, so hiding what is sorted hides nothing at all —
    // which is the point: the modes read one list and change no text.
    expect((document.querySelector('.ns-page') as HTMLElement).textContent).toBe(before);
  });

  it('shows the pile in Refine without a way to delete it', () => {
    render(<Harness initial={sorting()} />);
    fireEvent.click(screen.getByRole('tab', { name: '3 Refine' }));

    expect(screen.getByText('Unsorted')).toBeTruthy();
    expect(screen.getByText(/Where a deleted category’s cards land/)).toBeTruthy();
    // A × for each of the writer's two, and none for the pile.
    expect(screen.getAllByRole('button', { name: /^Delete / }).map((one) => one.getAttribute('aria-label'))).toEqual([
      'Delete Character',
      'Delete Dialogue',
    ]);
  });

  it('sends the plan into the Outliner, the cards staying here', () => {
    let file = sorting();
    const session = sortingSessions(file)[0]!;
    const character = sortCategories(file, session.id).find((one) => one.name === 'Character')!;
    file = extractToCategory(file, {
      sourceId: sourcesOf(file, session.id)[0]!.id,
      from: 0,
      to: FIRST.length,
      categoryId: character.id,
    }).file;

    render(<Harness initial={file} />);
    fireEvent.click(screen.getByRole('tab', { name: '4 Send to Outliner' }));

    // The words are the noun table's: a novel's rungs are Chapter and Passage.
    expect(screen.getByText(/2 chapters · 1 note/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send to Outliner' }));

    const outline = outlinesOf(latest!)[0]!;
    expect(outline.items.map((one) => one.kind)).toEqual(['scene', 'note', 'scene']);
    // A row references its card rather than copying it.
    expect(outline.items[1]!.source?.type).toBe('research_item');
    expect(cardsIn(latest!, character.id)).toHaveLength(1);
  });

  it('a row switched off takes what is under it, said rather than implied', () => {
    let file = sorting();
    const session = sortingSessions(file)[0]!;
    const character = sortCategories(file, session.id).find((one) => one.name === 'Character')!;
    file = extractToCategory(file, {
      sourceId: sourcesOf(file, session.id)[0]!.id,
      from: 0,
      to: FIRST.length,
      categoryId: character.id,
    }).file;

    render(<Harness initial={file} />);
    fireEvent.click(screen.getByRole('tab', { name: '4 Send to Outliner' }));

    // Switching off the category that holds the card takes the card with it.
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    expect(screen.getAllByText('not sent')).toHaveLength(2);
    expect(screen.getByText(/1 chapter$/)).toBeTruthy();

    // With every row off, the screen says so rather than reading as ready.
    for (const tick of screen.getAllByRole('checkbox')) {
      if ((tick as HTMLInputElement).checked) fireEvent.click(tick);
    }
    expect(screen.getByText(/Nothing is ticked/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Send to Outliner' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('searches the raw notes and the cards together, and goes to each', () => {
    let file = sorting();
    const session = sortingSessions(file)[0]!;
    const character = sortCategories(file, session.id).find((one) => one.name === 'Character')!;
    file = extractToCategory(file, {
      sourceId: sourcesOf(file, session.id)[0]!.id,
      from: 45,
      to: PAGE.length,
      categoryId: character.id,
    }).file;

    render(<Harness initial={file} />);
    fireEvent.change(screen.getByLabelText('Search every source and every card'), {
      target: { value: 'dialogue' },
    });

    expect(screen.getByText('raw')).toBeTruthy();
    expect(screen.getByText('card')).toBeTruthy();
  });
});
