// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addPart,
  addUnit,
  chapterPageStyleOf,
  createProjectFile,
  partStyleOf,
  partsOf,
  tracksInOrder,
  unitsInStoryOrder,
  updateBeat,
  updatePart,
  type BookPart,
  type ProjectFile,
} from '@vcwriter/domain';
import { BackMatterDialog } from '../components/BackMatterDialog';
import { DesignedPageDialog } from '../components/DesignedPageDialog';
import { ChapterStyleFields } from '../components/ChapterPageDialog';
import { PageStyle } from '../components/LayoutWindow';

/**
 * **The body text can be set, on every screen a writer types it into**
 * (addendum 20 §18, from Ken: *in any of the dialog boxes that you can add
 * text, right now only the headings can be stylized, but the body text needs
 * to be able to be stylized, centered, justified right, left, change the font,
 * change the size, also*).
 *
 * The domain's own suite says what a line of type now carries. What this pins
 * is the **gesture** (§15a), which is the whole of the report: the record held
 * most of the answer all along — a prose part's words have been a `LineStyle`
 * since §7a — and the controls were on the heading and nowhere else, so from
 * the writer's chair the body simply could not be set.
 *
 * It walks **every** screen that sets body text rather than the one the
 * report came off, in `cast-surfaces`' shape: one that grows a text box and
 * forgets the type fails here rather than shipping.
 *
 * **And the first draft of this test made that claim and walked three** (from
 * Ken, a second time: *on all the back matter and front matter, we need to be
 * able to where there's a heading and a text box. The text box needs to be
 * able to be centered or justified to the right or left also*). The fourth is
 * `PageStyle`, which is what a **foreword, a preface, an introduction, a
 * prologue, an epilogue, an afterword, the contents page and the index**
 * open — most of the front matter, and the pages §18 never asked about. The
 * `Ranged` select above the words there is the **heading's**, so a writer who
 * pressed it watched the heading move and correctly concluded the body could
 * not be ranged at all. A claim a test makes about its own coverage is worth
 * no more than the screens it actually renders.
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

const para = (text: string) => ({ id: crypto.randomUUID(), type: 'paragraph' as const, text, characterId: null, attributes: {} });

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' });
  const track = tracksInOrder(file)[0]!;
  const first = unitsInStoryOrder(file)[0]!;
  const beat = addBeat(file, { unitId: first.id, title: 'One' });
  file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [para('A lamp. '.repeat(40))] } as never });
  const second = addUnit(file, { trackId: track.id, title: 'The Return', index: 1 });
  return second.file;
};

const withPart = (kind: BookPart['kind'], text: string) => {
  const made = addPart(novel(), kind);
  const part = partsOf(made.file).find((one) => one.kind === kind)!;
  return { file: updatePart(made.file, part.id, { text }), partId: part.id };
};

let latest: ProjectFile | null = null;

function Back({ initial, partId }: { initial: ProjectFile; partId: string }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return (
    <BackMatterDialog
      file={file}
      part={partsOf(file).find((one) => one.id === partId) ?? null}
      laying={null}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      onClose={() => undefined}
      onPickPhoto={() => undefined}
      onTurn={() => undefined}
    />
  );
}

function Designed({ initial, partId }: { initial: ProjectFile; partId: string }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return (
    <DesignedPageDialog
      file={file}
      part={partsOf(file).find((one) => one.id === partId) ?? null}
      laying={null}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      onClose={() => undefined}
      onPickArt={() => undefined}
      onPickLogo={() => undefined}
      onPickImprint={() => undefined}
      onOpenBookSettings={() => undefined}
      onOpenCopyright={() => undefined}
      onTurn={() => undefined}
    />
  );
}

/**
 * The chapter page's type is **the book's**, one look for the whole book
 * (§12a), so its controls are `ChapterStyleFields` — one component the dialog
 * and the Layout room both render, which is why it is what this drives.
 */
function Chapter({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return <ChapterStyleFields file={file} marker={null} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

/**
 * The panel a prose page and a page that flows open (§18, second reading) —
 * reached through `PartDialog`, which is where Ken's report came from.
 */
function Page({ initial, partId }: { initial: ProjectFile; partId: string }) {
  const [file, setFile] = useState(initial);
  latest = file;
  const part = partsOf(file).find((one) => one.id === partId);
  return part ? <PageStyle file={file} part={part} onUpdate={(mutate) => setFile((current) => mutate(current))} /> : null;
}

/** The style the page resolves to now, which is what the control wrote. */
const styleOf = (partId: string) => partStyleOf(partsOf(latest as ProjectFile).find((one) => one.id === partId)!);

describe('the body text, on every screen that takes it', () => {
  it('ranges a back-matter page’s words, which had a size and nothing else', () => {
    /**
     * Measured before the change: *About the author* offered a Typeface and a
     * Text size for its words and no case, no weight, no slope, no tracking
     * and nowhere at all to say how they were ranged — the Left/Centred/Right
     * above them being the **heading's**.
     */
    const { file, partId } = withPart('about_the_author', 'She writes at night.');
    render(<Back initial={file} partId={partId} />);
    const dialog = document.querySelector('dialog') as HTMLElement;

    fireEvent.change(within(dialog).getByLabelText('The words alignment'), { target: { value: 'justify' } });
    expect(styleOf(partId).line.align).toBe('justify');

    // And the rest of a line of type, which the heading had all along.
    fireEvent.change(within(dialog).getByLabelText('The words case'), { target: { value: 'small_caps' } });
    fireEvent.click(within(dialog).getByLabelText('The words italic'));
    expect(styleOf(partId).line.case).toBe('small_caps');
    expect(styleOf(partId).line.italic).toBe(true);
  });

  it('sets a back-matter page’s words in a face the heading is not', () => {
    const { file, partId } = withPart('about_the_author', 'She writes at night.');
    render(<Back initial={file} partId={partId} />);
    const dialog = document.querySelector('dialog') as HTMLElement;
    fireEvent.change(within(dialog).getByLabelText('The words face'), { target: { value: 'gill_sans' } });
    expect(styleOf(partId).line.face).toBe('gill_sans');
    // The page's own face is untouched: two questions, two answers.
    expect(styleOf(partId).face).toBe(partStyleOf({ kind: 'about_the_author', style: {} }).face);
  });

  it('starts at the page’s own, so nothing is chosen until somebody chooses', () => {
    /**
     * Null is the state every line begins in, and the control says so in its
     * first option rather than pre-selecting one of the four — a list whose
     * default sits last reads as though something has been picked.
     */
    const { file, partId } = withPart('about_the_author', 'She writes at night.');
    render(<Back initial={file} partId={partId} />);
    const dialog = document.querySelector('dialog') as HTMLElement;
    expect((within(dialog).getByLabelText('The words alignment') as HTMLSelectElement).value).toBe('');
    expect((within(dialog).getByLabelText('The words face') as HTMLSelectElement).value).toBe('');
  });

  it('sets the lines under a dedication’s words, which no screen could reach', () => {
    const { file, partId } = withPart('dedication', 'For Mara.\n— and for the lighthouse');
    render(<Designed initial={file} partId={partId} />);
    const dialog = document.querySelector('dialog') as HTMLElement;
    fireEvent.change(within(dialog).getByLabelText('The lines under them alignment'), { target: { value: 'right' } });
    fireEvent.change(within(dialog).getByLabelText('The lines under them size'), { target: { value: '9' } });
    expect(styleOf(partId).line.align).toBe('right');
    expect(styleOf(partId).line.size).toBe(9);
  });

  it('sets the two sizes of a page of your own, which is what “big, then small” is', () => {
    /**
     * **Both halves were built and the pair read as one size** (§9as, from
     * Ken: *you should be able to size the text independently. So you can
     * highlight it and make like something big and then have the rest
     * small*).
     *
     * The first line takes `title` and every line under it takes `line`, and
     * both have had controls since §18 — **measured in the real room the two
     * sizes stood 341 pixels apart**, at y=945 and y=1286 in a 900-pixel
     * window, with a case, a style, a tracking, a rule and a switch between
     * them, so neither was on the screen at once. The first group was
     * hand-rolled while the second used `LineFields`: two answers to *what is
     * a line of type* on one card, and the reason they could sit that far
     * apart. One shape now, named, one after the other — 163 pixels, measured
     * again.
     *
     * What this pins is the **gesture**: a writer can set the two
     * independently, from controls that name which line each one is.
     */
    const { file, partId } = withPart('dedication', 'A BIG TITLE\nand the rest, small.');
    render(<Designed initial={file} partId={partId} />);
    const dialog = document.querySelector('dialog') as HTMLElement;
    fireEvent.change(within(dialog).getByLabelText('The first line size'), { target: { value: '24' } });
    fireEvent.change(within(dialog).getByLabelText('The lines under them size'), { target: { value: '9' } });
    expect(styleOf(partId).title.size).toBe(24);
    expect(styleOf(partId).line.size).toBe(9);
    // And each group is a whole line of type, named for the line it sets.
    for (const name of ['The first line case', 'The first line italic', 'The lines under them case', 'The lines under them face']) {
      expect(within(dialog).queryByLabelText(name), name).not.toBeNull();
    }
  });

  it('numbers its sections by counting them, rather than four times by hand', () => {
    /**
     * Driving a dedication caught two sections both numbered **3** —
     * *Typography* and *The leaves around this page* — because each card
     * wrote its own number while two of the four are conditional (§9as).
     */
    const { file, partId } = withPart('dedication', 'For Mara.');
    render(<Designed initial={file} partId={partId} />);
    const dialog = document.querySelector('dialog') as HTMLElement;
    const numbers = Array.from(dialog.querySelectorAll('.dp-num')).map((one) => one.textContent);
    expect(numbers).toEqual(numbers.map((_, at) => String(at + 1)));
    expect(numbers.length).toBeGreaterThan(2);
  });

  it('ranges a chapter page’s epigraph, and leaves the number alone', () => {
    render(<Chapter initial={novel()} />);
    fireEvent.change(screen.getByLabelText('The lines under it alignment'), { target: { value: 'center' } });
    expect(chapterPageStyleOf(latest as ProjectFile).epigraph.align).toBe('center');
    /**
     * **The number and the name get none**, which is the other half of the
     * rule: a chapter opening's own layout places those, so a second answer
     * here could only disagree with it — *absent rather than greyed*, this
     * room's idiom for a control that does not apply.
     */
    expect(screen.queryByLabelText('The number alignment')).toBeNull();
    expect(screen.queryByLabelText('The name alignment')).toBeNull();
  });

  it('ranges a foreword’s words, which is the screen §18 never walked', () => {
    /**
     * The front matter's prose pages open `PartDialog`, not the back-matter
     * screen, so §18's alignment and face never reached them. Measured on the
     * panel before the change: a Size, a Case, a bold, an italic and a
     * tracking for *The words*, and nowhere at all to range them.
     */
    const { file, partId } = withPart('foreword', 'Before we begin.');
    render(<Page initial={file} partId={partId} />);
    fireEvent.change(screen.getByLabelText('The words alignment'), { target: { value: 'justify' } });
    fireEvent.change(screen.getByLabelText('The words face'), { target: { value: 'gill_sans' } });
    expect(styleOf(partId).line.align).toBe('justify');
    expect(styleOf(partId).line.face).toBe('gill_sans');
    // The heading's own `Ranged` is untouched: two questions, two answers.
    expect(styleOf(partId).align).toBe(partStyleOf({ kind: 'foreword', style: {} }).align);
  });

  it('ranges the entries on a page that flows', () => {
    /**
     * A contents page and an index run to as many pages as they need, so the
     * pair is the heading and **the entries** — the same two lines said of a
     * list, which is why they take the same control rather than a third.
     */
    const { file, partId } = withPart('contents', '');
    render(<Page initial={file} partId={partId} />);
    fireEvent.change(screen.getByLabelText('The entries alignment'), { target: { value: 'right' } });
    expect(styleOf(partId).line.align).toBe('right');
  });

  it('offers justified, which the page’s own alignment never could', () => {
    const { file, partId } = withPart('about_the_author', 'She writes at night.');
    render(<Back initial={file} partId={partId} />);
    const dialog = document.querySelector('dialog') as HTMLElement;
    const words = [...(within(dialog).getByLabelText('The words alignment') as HTMLSelectElement).options].map((one) => one.value);
    expect(words).toEqual(['', 'left', 'center', 'right', 'justify']);
    // The page ranges a block that has been placed on it, and nothing in a
    // book justifies a heading — so there is no fourth chip up there.
    expect(within(dialog).queryByRole('button', { name: 'Justified' })).toBeNull();
  });
});
