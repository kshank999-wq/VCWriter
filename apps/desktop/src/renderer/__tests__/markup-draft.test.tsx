// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addUnit,
  bringInMarkup,
  createProjectFile,
  markFromSelection,
  updateBeat,
  type Beat,
  type BeatId,
  type Mark,
  type ProjectFile,
} from '@vcwriter/domain';
import { BeatWriter } from '../components/BeatWriter';

/**
 * A markup brought into the script, as a writer meets it in the beat
 * (addendum 07 §27.2): a draft named for the writer in the Draft menu, read
 * beside the working draft with its marks drawn, and sent to the archive once
 * it has been dealt with.
 */

afterEach(cleanup);

const line = (id: string, text: string) => ({ id, type: 'action', text, characterId: null, attributes: {} });

const marked = (): { file: ProjectFile; beatId: BeatId } => {
  const empty = createProjectFile({ title: 'Room', format: 'screenplay' });
  const scene = addUnit({ ...empty, units: [], beats: [] }, { trackId: empty.tracks[0]!.id, title: 'INT. HOUSE - NIGHT' });
  const made = addBeat(scene.file, { unitId: scene.unit.id, title: 'The door' });
  const base = updateBeat(made.file, made.beat.id, { manuscript: { elements: [line('e1', 'She opens the door.')] } } as never);
  const source = updateBeat(base, made.beat.id, { manuscript: { elements: [line('e1', 'She kicks the door open.')] } } as never);
  const mark = markFromSelection({
    id: 'm1',
    elementId: 'e1',
    text: 'She kicks the door open.',
    start: 4,
    end: 9,
    kind: 'suggest',
    replacement: 'shoulders',
  }) as Mark;
  const result = bringInMarkup(base, { source, marks: [mark], label: 'MA markup', markedBy: 'Ken' });
  return { file: result.file, beatId: made.beat.id };
};

function Writer({ start, beatId }: { start: ProjectFile; beatId: BeatId }) {
  const [file, setFile] = useState(start);
  const beat = file.beats.find((one) => one.id === beatId) as Beat;
  return (
    <BeatWriter
      file={file}
      beat={beat}
      onUpdate={(change) => setFile((current) => change(current))}
      onSelect={() => undefined}
    />
  );
}

describe('a markup draft in the beat', () => {
  it('is listed under Markups, named for the writer, and opens beside the working draft with its marks', () => {
    const { file, beatId } = marked();
    render(<Writer start={file} beatId={beatId} />);
    const menu = screen.getByLabelText('Draft') as HTMLSelectElement;
    const option = Array.from(menu.querySelectorAll('optgroup[label="Markups"] option')).find((one) =>
      one.textContent?.includes('MA markup'),
    ) as HTMLOptionElement;
    expect(option).toBeTruthy();

    fireEvent.change(menu, { target: { value: option.value } });

    // Read beside, not swapped in: the working draft still says what it said.
    expect(screen.getByText('MA markup — markup')).toBeTruthy();
    expect(screen.getByText('shoulders')).toBeTruthy();
    expect(screen.getByText(/One mark by Ken/)).toBeTruthy();
  });

  it('goes to the archive once dealt with, and is kept there', () => {
    const { file, beatId } = marked();
    render(<Writer start={file} beatId={beatId} />);
    const menu = screen.getByLabelText('Draft') as HTMLSelectElement;
    const value = (menu.querySelector('optgroup[label="Markups"] option') as HTMLOptionElement).value;
    fireEvent.change(menu, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: /send to archive/i }));
    expect(menu.querySelector('optgroup[label="Markups"]')).toBeNull();
    expect(menu.querySelector('optgroup[label="Archive"] option')?.textContent).toContain('MA markup');
  });
});

describe('the Mark up switch', () => {
  it('turns the page into a markable copy, and saves the marks as a draft named for whoever made them', () => {
    const { file, beatId } = marked();
    render(<Writer start={file} beatId={beatId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark up' }));

    // Select words on the page the way a reader would, then highlight them.
    const line = document.querySelector('.marking-page [data-line]') as HTMLElement;
    const text = line.firstChild!.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 4);
    range.setEnd(text, 9);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }));
    expect(screen.getByText(/Highlight “opens”/)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ken Shank' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as markup draft' }));

    // Back to writing, with the new markup read beside it and listed as one.
    expect(screen.getByText('KS markup — markup')).toBeTruthy();
    expect(screen.getByText(/One mark by Ken Shank/)).toBeTruthy();
    const menu = screen.getByLabelText('Draft') as HTMLSelectElement;
    expect(Array.from(menu.querySelectorAll('optgroup[label="Markups"] option')).map((one) => one.textContent)).toContain('KS markup ✎');
  });
});

describe('drafts side by side', () => {
  /** A beat with its working draft and two kept drafts, all different. */
  const threeDrafts = (): { file: ProjectFile; beatId: BeatId } => {
    const empty = createProjectFile({ title: 'Drafts', format: 'screenplay' });
    const scene = addUnit({ ...empty, units: [], beats: [] }, { trackId: empty.tracks[0]!.id, title: 'INT. ROOM - DAY' });
    const made = addBeat(scene.file, { unitId: scene.unit.id, title: 'One' });
    const beat = made.file.beats.find((one) => one.id === made.beat.id)!;
    const revision = (id: string, name: string, text: string) => ({
      id,
      name,
      manuscript: { elements: [line(`${id}-e`, text)] },
      savedAt: '2026-11-10T00:00:00.000Z',
      marks: [],
      markedBy: '',
      archived: false,
    });
    const file = updateBeat(made.file, made.beat.id, {
      manuscript: { elements: [line('w-e', 'Working words.')] },
      revisions: [...beat.revisions, revision('d1', 'Draft 1', 'First words.'), revision('d2', 'Draft 2', 'Second words.')],
    } as never);
    return { file, beatId: made.beat.id };
  };

  it('puts a third draft across the page, and both compared drafts can be typed in', () => {
    const { file, beatId } = threeDrafts();
    render(<Writer start={file} beatId={beatId} />);
    fireEvent.click(screen.getByLabelText('Compare'));
    fireEvent.click(screen.getByRole('button', { name: '+ Third' }));
    expect(document.querySelector('.writer-body.three-across')).toBeTruthy();
    expect(screen.getByText('Draft 1 — editing')).toBeTruthy();
    expect(screen.getByText('Draft 2 — editing')).toBeTruthy();
    // No compared page is read-only any more.
    const pages = Array.from(document.querySelectorAll('.writer-sheet.compared textarea'));
    expect(pages.length).toBeGreaterThan(0);
  });

  it('saves typing in a compared draft into that draft, and leaves the working draft alone', () => {
    const { file, beatId } = threeDrafts();
    let latest = file;
    function Watch() {
      const [now, setNow] = useState(file);
      latest = now;
      const beat = now.beats.find((one) => one.id === beatId) as Beat;
      return <BeatWriter file={now} beat={beat} onUpdate={(change) => setNow((current) => change(current))} onSelect={() => undefined} />;
    }
    render(<Watch />);
    fireEvent.click(screen.getByLabelText('Compare'));
    const box = Array.from(document.querySelectorAll('.writer-sheet.compared textarea')).find(
      (one) => (one as HTMLTextAreaElement).value === 'First words.',
    ) as HTMLTextAreaElement;
    expect(box).toBeTruthy();
    fireEvent.change(box, { target: { value: 'First words, rewritten.' } });
    const beat = latest.beats.find((one) => one.id === beatId)!;
    expect(beat.revisions.find((one) => one.id === 'd1')!.manuscript.elements[0]!.text).toBe('First words, rewritten.');
    expect(beat.manuscript.elements[0]!.text).toBe('Working words.');
  });
});
