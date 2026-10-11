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
 * It walks **every** dialog that takes body text rather than the one the
 * report came off, in `cast-surfaces`' shape: a fifth screen that grows a text
 * box and forgets the type fails here rather than shipping.
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
