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
