// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  createProjectFile,
  partStyleOf,
  partTemplateOf,
  bookNames,
  partsOf,
  publisherOf,
  setBookSettings,
  updatePart,
  setTitlePage,
  titlePageFieldsOf,
  titleTemplateOf,
  type ProjectFile,
} from '@vcwriter/domain';

import { DesignedPageDialog } from '../components/DesignedPageDialog';

/**
 * The designed page's own screen (addendum 20 §9n, from Ken's handoff).
 *
 * What these pin is the three decisions: the mode is read off the record,
 * a template is a **height** with the alignment beside it, and Cancel puts
 * back the page as it stood when the screen opened.
 */

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

const book = (): ProjectFile =>
  setTitlePage(createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' }), {
    title: 'Villain’s Tales',
  });

const halfTitle = (file: ProjectFile) => partsOf(file).find((part) => part.kind === 'half_title')!;
const titlePage = (file: ProjectFile) => partsOf(file).find((part) => part.kind === 'title_page')!;

function Harness({
  onFile,
  picked,
  kind = 'half_title',
  start,
}: {
  onFile?: (file: ProjectFile) => void;
  picked?: string[];
  kind?: 'half_title' | 'title_page';
  start?: () => ProjectFile;
}) {
  const [file, setFile] = useState(start ?? book);
  return (
    <DesignedPageDialog
      file={file}
      part={kind === 'title_page' ? titlePage(file) : halfTitle(file)}
      laying={null}
      onUpdate={(change) =>
        setFile((current) => {
          const next = change(current);
          onFile?.(next);
          return next;
        })
      }
      onClose={() => undefined}
      onPickLogo={() => picked?.push('logo')}
      onPickArt={() => picked?.push('art')}
      onPickImprint={() => picked?.push('imprint')}
      onOpenCopyright={() => picked?.push('copyright')}
      onOpenBookSettings={() => picked?.push('settings')}
      onTurn={() => undefined}
    />
  );
}

describe('the designed page’s screen', () => {
  it('names the page, shows the book’s title read-only, and sends the writer to Book settings to change it', () => {
    const picked: string[] = [];
    render(<Harness picked={picked} />);
    expect(screen.getByText('Half title')).toBeTruthy();
    expect(screen.getByText('Villain’s Tales')).toBeTruthy();
    // The title is the **book's**, so there is one place to type it.
    expect(screen.queryByLabelText('Title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit in Book settings' }));
    expect(picked).toEqual(['settings']);
  });

  it('reads the mode off the page, and a tile is the act rather than a flag', () => {
    const picked: string[] = [];
    render(<Harness picked={picked} />);
    expect(screen.getByRole('button', { name: /^Title text/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Logotype/ }));
    // Choosing it opens the picker: what the page carries is what decides
    // the mode, so nothing is set until a picture arrives.
    expect(picked).toEqual(['logo']);
    fireEvent.click(screen.getByRole('button', { name: /^Full-page art/ }));
    expect(picked).toEqual(['logo', 'art']);
  });

  it('places by height, and the alignment is its own control', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    /* The name appears twice on purpose — on its thumbnail and as what is
       in force — so the one that says *which* is asked for by its place. */
    const inForce = () => document.querySelector('.dp-says')?.textContent ?? '';
    // A page nobody has touched reads as a template rather than as custom.
    expect(inForce()).toBe('Upper third');
    fireEvent.click(screen.getByRole('button', { name: /Low/ }));
    let style = partStyleOf(halfTitle(seen as unknown as ProjectFile));
    expect(style.drop).toBe(62);
    // Ranging it left leaves it where it is: the template is the height.
    fireEvent.click(screen.getByRole('button', { name: 'Left' }));
    style = partStyleOf(halfTitle(seen as unknown as ProjectFile));
    expect(style.align).toBe('left');
    expect(partTemplateOf(style)).toBe('low');
    expect(inForce()).toBe('Low');
  });

  it('reads Custom once the height is dragged, and says how far the page has been taken', () => {
    render(<Harness />);
    expect(screen.getByText('Matches the front-matter style')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Height on the page'), { target: { value: '44' } });
    expect(screen.getByText('Custom · placed by hand')).toBeTruthy();
    expect(screen.getByText('1 change from the front-matter style')).toBeTruthy();
    // Leaf by leaf, so a writer who set three things is told three.
    fireEvent.click(screen.getByRole('button', { name: 'Small caps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    expect(screen.getByText('3 changes from the front-matter style')).toBeTruthy();
  });

  it('puts the page back as it stood when the screen opened', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    fireEvent.change(screen.getByLabelText('Height on the page'), { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    expect(partStyleOf(halfTitle(seen as unknown as ProjectFile)).drop).toBe(70);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const style = partStyleOf(halfTitle(seen as unknown as ProjectFile));
    expect(style.drop).toBe(33);
    expect(style.align).toBe('center');
  });

  it('clears the page’s own settings with Reset', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Rule under the title' }));
    expect(partStyleOf(halfTitle(seen as unknown as ProjectFile)).rule).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to page style' }));
    expect(halfTitle(seen as unknown as ProjectFile).style).toEqual({});
    expect(screen.getByText('Matches the front-matter style')).toBeTruthy();
  });
});

/**
 * **The title page's own half** (addendum 20 §16, from Ken's handoff). It is
 * the same screen grown rather than a second one, so what these pin is the
 * three things that make it the title page's: the elements say where their
 * words come from, an element switched off keeps them, and the arrangement is
 * a pair of heights read back.
 */
describe('the title page', () => {
  const withHouse = (): ProjectFile => setBookSettings(book(), { imprint: 'Lamplight Books' });

  it('lists the seven, saying which are required and how many show', () => {
    render(<Harness kind="title_page" start={withHouse} />);
    const names = Array.from(document.querySelectorAll('.dp-element-head strong')).map((one) => one.textContent);
    expect(names).toEqual([
      'Book title',
      'Subtitle',
      'Author’s name',
      'Translator or editor',
      'Edition',
      'Publisher name or mark',
      'Publisher location',
    ]);
    // Two required and three of the five on: the page's own count.
    expect(screen.getByText('5 of 7 shown')).toBeTruthy();
    expect(document.querySelectorAll('.dp-required')).toHaveLength(2);
  });

  /**
   * **Every row is a real box** (§16d, the handoff's §8.1: *editing the title
   * or author here updates Book settings, and the reverse*).
   *
   * §16 offered buttons through to Book settings and the copyright page
   * instead, on the ground that a value should be named once. But a box here
   * writes the **same field**, so it is still named once: one value with two
   * doors, which is what two-way sync means and what a route cannot give.
   */
  it('types the title here and the book is renamed, which is the sync', () => {
    let seen: ProjectFile | null = null;
    render(<Harness kind="title_page" onFile={(file) => (seen = file)} start={withHouse} />);
    fireEvent.change(screen.getByLabelText('Book title'), { target: { value: 'The Lamp' } });
    // The same field Book settings writes, so the two cannot disagree.
    expect((seen as unknown as ProjectFile).settings.titlePage.title).toBe('The Lamp');
    expect(bookNames(seen as unknown as ProjectFile).title).toBe('The Lamp');
  });

  it('types the publisher here and the copyright page has it', () => {
    let seen: ProjectFile | null = null;
    render(<Harness kind="title_page" onFile={(file) => (seen = file)} start={withHouse} />);
    fireEvent.change(screen.getByLabelText('Publisher or imprint name'), { target: { value: 'Lamplight' } });
    fireEvent.change(screen.getByLabelText('Publisher location'), { target: { value: 'Hull' } });
    const house = publisherOf(seen as unknown as ProjectFile, partsOf(seen as unknown as ProjectFile));
    expect(house.name).toBe('Lamplight');
    expect(house.place).toBe('Hull');
  });

  it('keeps an element’s words when it is switched off', () => {
    let seen: ProjectFile | null = null;
    render(<Harness kind="title_page" onFile={(file) => (seen = file)} start={withHouse} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Show the translator or editor' }));
    fireEvent.change(screen.getByLabelText('Translator or editor'), { target: { value: 'Jane Doe' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Show the translator or editor' }));
    const fields = titlePageFieldsOf(titlePage(seen as unknown as ProjectFile));
    expect(fields.shows.contributor).toBe(false);
    // Switched off is not emptied: the two are different intentions.
    expect(fields.contributor).toBe('Jane Doe');
  });

  it('reads the arrangement off the pair, and offers the author a height only when it has one', () => {
    let seen: ProjectFile | null = null;
    render(<Harness kind="title_page" onFile={(file) => (seen = file)} start={withHouse} />);
    expect(document.querySelector('.dp-says')?.textContent).toBe('Stacked');
    // Absent rather than greyed: under the title, there is nothing to move.
    expect(screen.queryByLabelText('Author height')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Classic/ }));
    expect(screen.getByLabelText('Author height')).toBeTruthy();
    expect(titleTemplateOf(partStyleOf(titlePage(seen as unknown as ProjectFile)))).toBe('classic');
    // The alignment keeps its own control, and the reading asks all three
    // numbers: Classic ranged left **is** Flush left, which is the handoff's
    // fourth arrangement rather than a page nobody can name.
    fireEvent.click(screen.getByRole('button', { name: 'Left' }));
    expect(titleTemplateOf(partStyleOf(titlePage(seen as unknown as ProjectFile)))).toBe('flush_left');
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    expect(titleTemplateOf(partStyleOf(titlePage(seen as unknown as ProjectFile)))).toBeNull();
  });

  it('says a missing publisher rather than refusing it', () => {
    render(<Harness kind="title_page" />);
    expect(screen.getByText(/No publisher name or mark/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' }).hasAttribute('disabled')).toBe(false);
  });

  /**
   * **A logotype replaces the title, not the page** (§16c, from Ken: *the new
   * title page box is not coming through* — he was looking at a title page
   * set as full-page art).
   *
   * §9n hid the type wherever the page carried a picture, which is right on
   * the half title, where a logotype *is* the whole content. On the title
   * page it stands where the title would and six of the seven go on
   * printing, so hiding them made the print draw things the screen would not
   * let anybody reach.
   */
  it('keeps the elements under a logotype, six of them still printing', () => {
    const withLogo = (): ProjectFile => {
      const file = withHouse();
      return updatePart(file, titlePage(file).id, { logoAssetId: 'logo-1' });
    };
    render(<Harness kind="title_page" start={withLogo} />);
    expect(document.querySelectorAll('.dp-element-head strong')).toHaveLength(7);
    // The title's own row says what stands there instead of the words.
    expect(screen.getByText('A logotype stands here. The words are not set.')).toBeTruthy();
    // And the type is still the author's and the subtitle's to set.
    expect(screen.getByLabelText('Author size in points')).toBeTruthy();
  });

  it('says why a page of art has none of them, and how to get them back', () => {
    const withArt = (): ProjectFile => {
      const file = withHouse();
      return updatePart(file, titlePage(file).id, { assetId: 'art-1' });
    };
    render(<Harness kind="title_page" start={withArt} />);
    // Nothing prints, so nothing is offered — but absent with the reason
    // said, or a writer hunts for a panel they were told they had.
    expect(document.querySelectorAll('.dp-element-head strong')).toHaveLength(0);
    expect(screen.getByText(/None of the seven elements print/)).toBeTruthy();
    expect(screen.getByText(/Choose Title text or Logotype to set them/)).toBeTruthy();
  });

  /**
   * **The three faults Ken hit typing into this panel**, each in its own
   * right and all of them invisible to a test that only pressed buttons.
   */
  it('keeps the caret in the box while a whole word is typed', () => {
    // The control was a component declared inside the body, so every render
    // made a new component *type*, React remounted the subtree, and the
    // input a writer was typing into was thrown away at each keystroke.
    // What pins it is the DOM node's identity across a change.
    render(<Harness kind="title_page" start={withHouse} />);
    const box = screen.getByLabelText('Subtitle');
    fireEvent.change(box, { target: { value: 'S' } });
    expect(screen.getByLabelText('Subtitle')).toBe(box);
    fireEvent.change(box, { target: { value: 'St' } });
    expect(screen.getByLabelText('Subtitle')).toBe(box);
  });

  it('takes a space, every box of it', () => {
    // `titlePageOf` and `publisherOf` trim, being readings for the page, so
    // a box bound to one lost the trailing space and the space bar did
    // nothing — *the publisher location won't allow input*.
    let seen: ProjectFile | null = null;
    render(<Harness kind="title_page" onFile={(file) => (seen = file)} start={withHouse} />);
    for (const [label, word] of [
      ['Subtitle', 'Stories of '],
      ['Author’s name', 'Marion '],
      ['Book title', 'The Lamp '],
      ['Publisher location', 'Portland, '],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: word } });
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(word);
    }
    expect(seen).not.toBeNull();
  });

  it('shows the book’s own name as a placeholder rather than as the value', () => {
    // A fallback arriving as a value reads as somebody's typing: it appends
    // to what you type and comes straight back when you clear it.
    render(<Harness kind="title_page" start={withHouse} />);
    const author = screen.getByLabelText('Author’s name') as HTMLInputElement;
    expect(author.value).toBe('');
    expect(author.placeholder).toBe('M. Shank');
    // The title *has* been typed on this fixture, so it is a value — which
    // is the other half of the rule: what was typed shows as typed.
    const title = screen.getByLabelText('Book title') as HTMLInputElement;
    expect(title.value).toBe('Villain’s Tales');
    expect(title.placeholder).toBe('Villain’s Tales');
  });

  it('says which type the size control sets', () => {
    // From Ken: *there needs to be a font size for the title text*. It was
    // there and read *Size*, beside an *Author size* that named itself.
    render(<Harness kind="title_page" start={withHouse} />);
    expect(screen.getByLabelText('Title size in points')).toBeTruthy();
    expect(screen.getByText(/The subtitle is set from the title’s size/)).toBeTruthy();
    cleanup();
    // A half title has one line of type, so there is nothing to tell apart.
    render(<Harness />);
    expect(screen.getByLabelText('Size in points')).toBeTruthy();
  });

  it('gives the author a size of its own, which the half title never had', () => {
    render(<Harness kind="title_page" start={withHouse} />);
    expect(screen.getByLabelText('Author size in points')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Italic subtitle' })).toBeTruthy();
    cleanup();
    render(<Harness />);
    expect(screen.queryByLabelText('Author size in points')).toBeNull();
  });
});

/**
 * **The back of the leaf** (addendum 20 §17d, from Ken: *on the title page,
 * there needs to be an option to leave the back of the page blank, because it
 * could be a printed page on different paper*).
 *
 * The laying is the domain's and tested there. What these cover is that the
 * control is on the screen, that it says what it would do either way, and
 * that the sentence which used to state the old answer as a fixed convention
 * no longer does.
 */
describe('leaving the back of a page blank', () => {
  it('offers it, and writes it on the part', () => {
    let seen: ProjectFile | null = null;
    render(<Harness kind="title_page" onFile={(file) => (seen = file)} />);
    const control = screen.getByLabelText('Leave the back of this page blank');
    expect(control.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(control);
    expect(titlePage(seen as unknown as ProjectFile).backBlank).toBe(true);
  });

  it('says what happens to the copyright page, both ways round', () => {
    render(<Harness kind="title_page" />);
    expect(screen.getByText(/which by convention is the copyright page/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Leave the back of this page blank'));
    expect(screen.getByText(/the copyright page moves to the next left-hand page/)).toBeTruthy();
    expect(screen.getByText(/printed on different paper/)).toBeTruthy();
  });

  it('no longer states the copyright page’s side as a fixed convention', () => {
    // It was one until this shipped; a screen going on saying so would be
    // the settled-rule-in-a-sentence fault §5e keeps finding.
    render(<Harness kind="title_page" />);
    expect(screen.queryByText(/The copyright page goes on its back/)).toBeNull();
  });

  it('offers it on the half title too, that being a leaf of its own', () => {
    render(<Harness kind="half_title" />);
    expect(screen.getByLabelText('Leave the back of this page blank')).toBeTruthy();
  });
});
