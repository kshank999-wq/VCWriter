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
  sessionCards,
  sortCategories,
  sortingSessions,
  sourcesOf,
  suggestPlacements,
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

afterEach(() => {
  cleanup();
  // The suggestions switch is remembered per machine (which is the point), so
  // a test that turns it off reaches every test after it through storage.
  try {
    window.localStorage.clear();
  } catch {
    // A private window has none. Nothing here depends on it.
  }
});

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
  // Without the format's standard categories (addendum 26 §16a). These tests
  // are about the acts over a named pair, and counting ten more would make
  // every assertion a statement about the seed list; the seeding is tested in
  // the domain, where it lives.
  file = {
    ...begun.file,
    researchCategories: begun.file.researchCategories.filter(
      (one) => (one.sessionId as string) !== (begun.session.id as string) || one.systemKey !== null,
    ),
  };
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

    expect(screen.getByRole('tab', { name: 'Gather' }).getAttribute('aria-selected')).toBe('true');
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
    fireEvent.click(screen.getByRole('tab', { name: 'Sort' }));

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
    fireEvent.click(screen.getByRole('tab', { name: 'Sort' }));

    const stack = [...document.querySelectorAll('.ns-stack, .ns-chip')].find((one) =>
      one.textContent?.includes('Dialogue'),
    ) as HTMLElement;
    expect(stack.getAttribute('title')).toContain('Highlight a passage');

    fireEvent.click(stack);
    expect(screen.getByText('Highlight some words first.')).toBeTruthy();
    expect(cardsIn(latest!, sortCategories(latest!, sortingSessions(latest!)[0]!.id)[1]!.id)).toHaveLength(0);
  });

  it('draws the four display modes, and greying is one of them rather than the text', () => {
    render(<Harness initial={sorting()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Sort' }));

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
    fireEvent.click(screen.getByRole('tab', { name: 'Refine' }));

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
    // One in each, because a category with nothing in it is not offered
    // (addendum 26 §16b) and this test is about the words rather than that.
    const dialogue = sortCategories(file, session.id).find((one) => one.name === 'Dialogue')!;
    file = extractToCategory(file, {
      sourceId: sourcesOf(file, session.id)[0]!.id,
      from: FIRST.length + 2,
      to: PAGE.length,
      categoryId: dialogue.id,
    }).file;

    render(<Harness initial={file} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Send to Outliner' }));

    // The words are the noun table's: a novel's rungs are Chapter and Passage.
    expect(screen.getByText(/2 chapters · 2 notes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send to Outliner' }));

    const outline = outlinesOf(latest!)[0]!;
    expect(outline.items.map((one) => one.kind)).toEqual(['scene', 'note', 'scene', 'note']);
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
    const dialogue = sortCategories(file, session.id).find((one) => one.name === 'Dialogue')!;
    file = extractToCategory(file, {
      sourceId: sourcesOf(file, session.id)[0]!.id,
      from: FIRST.length + 2,
      to: PAGE.length,
      categoryId: dialogue.id,
    }).file;

    render(<Harness initial={file} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Send to Outliner' }));

    // Switching off the category that holds the card takes the card with it.
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    expect(screen.getAllByText('not sent')).toHaveLength(2);
    expect(screen.getByText(/1 chapter · 1 note/)).toBeTruthy();

    // With every row off, the screen says so rather than reading as ready.
    for (const tick of screen.getAllByRole('checkbox')) {
      if ((tick as HTMLInputElement).checked) fireEvent.click(tick);
    }
    expect(screen.getByText(/Nothing is ticked/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Send to Outliner' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('suggests where the unsorted passages belong, and moves nothing until approved', () => {
    render(<Harness initial={sorting()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Sort' }));

    // The categories are named Character and Dialogue, and the page has a
    // paragraph about each — so the panel has something to say from the names
    // alone, before anything at all has been filed.
    const before = suggestPlacements(latest!, sortingSessions(latest!)[0]!.id);
    expect(before.length).toBeGreaterThan(0);
    expect(screen.getByText(/Nothing moves until you approve/)).toBeTruthy();

    // Every row says why, in a fact about the writer's own categories.
    const rows = document.querySelectorAll('.ns-suggest-rows > li');
    expect(rows.length).toBe(before.length);
    for (const row of rows) expect(row.textContent).toMatch(/is named for|cards? uses?/);

    // Reading it changed nothing.
    expect(sessionCards(latest!, sortingSessions(latest!)[0]!.id)).toHaveLength(0);

    // Ticking one and approving is the ordinary extraction. The row's own tick,
    // named for what it would do — the panel's switch is a checkbox too.
    fireEvent.click(screen.getByRole('checkbox', { name: /^Put “/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve 1' }));

    const session = sortingSessions(latest!)[0]!;
    expect(sessionCards(latest!, session.id)).toHaveLength(1);
    // And it stops being suggested, nothing having been stored to say so.
    expect(suggestPlacements(latest!, session.id)).toHaveLength(before.length - 1);
  });

  it('the panel switches off, and says what it would do rather than going blank', () => {
    render(<Harness initial={sorting()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Sort' }));

    // Named for what it switches rather than for which way it is turned.
    const settings = screen.getByRole('checkbox', {
      name: 'Suggest where unsorted passages belong',
    }) as HTMLInputElement;
    expect(settings.checked).toBe(true);
    fireEvent.click(settings);

    expect(document.querySelectorAll('.ns-suggest-rows > li')).toHaveLength(0);
    expect(screen.getByText(/Turn it on and the unsorted passages/)).toBeTruthy();
  });

  it('putting one aside says so rather than claiming nothing matched', () => {
    render(<Harness initial={sorting()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Sort' }));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss all' }));
    expect(document.querySelectorAll('.ns-suggest-rows > li')).toHaveLength(0);
    // The sentence a writer who has just dismissed things must not be given.
    expect(screen.queryByText(/looks enough like any of your categories/)).toBeNull();
    expect(screen.getByText(/put aside for now/)).toBeTruthy();
    // And there is a way back, dismissing being about this minute.
    fireEvent.click(screen.getByRole('button', { name: 'Bring them back' }));
    expect(document.querySelectorAll('.ns-suggest-rows > li').length).toBeGreaterThan(0);
  });

  it('proposes a new category, makes it empty, and stops proposing it', () => {
    render(<Harness initial={sorting()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Sort' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest new categories' }));

    // This page has nothing repeated often enough, and the panel says so
    // rather than offering a guess to fill the space.
    expect(screen.getByText(/Nothing repeats often enough/)).toBeTruthy();
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

  /**
   * The handoff's furniture (addendum 26 §16b).
   *
   * Ken's report was that the mockups had not been used, and he was right:
   * every act worked and the screen did not look like the comps. So this pins
   * the pieces a restyle is most likely to lose again — **things that carry
   * information** rather than colours, because a colour test is a screenshot
   * written badly and these are the parts a writer reads.
   */
  it('draws the handoff’s card, its source reference, and the four ways in', () => {
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

    // Gather: the four tiles, and the loud fifth.
    for (const way of ['Import a file', 'Paste text', 'Type directly', 'VC Writer notes']) {
      expect(screen.getByRole('button', { name: new RegExp(way) })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: /Raw dictation session/ })).toBeTruthy();
    // §6's promise, where somebody about to sort reads it, and the way in.
    expect(screen.getByText(/Sorting never cuts or deletes/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start sorting' })).toBeTruthy();

    // Sort: the card carries its lineage on its face — *Brainstorm ¶1* — which
    // is what makes it an index card rather than a coloured box.
    fireEvent.click(screen.getByRole('tab', { name: 'Sort' }));
    expect(screen.getAllByText('Brainstorm ¶1').length).toBeGreaterThan(0);
    // An untouched category is a chip with its count, and there is a way to
    // make another beside them.
    expect(screen.getByRole('button', { name: '+ New' })).toBeTruthy();

    // Refine: the four acts on one row, and the card's own three fields.
    fireEvent.click(screen.getByRole('tab', { name: 'Refine' }));
    fireEvent.click(screen.getAllByText('Character')[0]!);
    fireEvent.click(screen.getAllByText(FIRST)[0]!);
    for (const act of [/Split/, /Merge/]) {
      expect(screen.getByRole('button', { name: act })).toBeTruthy();
    }
    expect(screen.getByLabelText('Move this card to')).toBeTruthy();
    expect(screen.getByLabelText('Also show this card in')).toBeTruthy();
    // A tag is a thing you take off, so it is a pill rather than a comma.
    expect(screen.getByLabelText('Add a tag')).toBeTruthy();
    // And the comment: a note *about* the card, which the record had nowhere
    // for until this. Typing in it never reaches the working text.
    const comment = screen.getByPlaceholderText('A note to yourself about this card');
    fireEvent.change(comment, { target: { value: 'Pair with the opening?' } });
    const card = latest!.researchItems.find((one) => one.title.startsWith('Rule one'))!;
    expect(card.comment).toBe('Pair with the opening?');
    expect(card.body).toBe(FIRST);
  });
});
