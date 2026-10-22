// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addBeat,
  addReference,
  addUnit,
  createProjectFile,
  insertCitation,
  updateBeat,
  type ManuscriptElementId,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { BeatBody } from '../components/BeatBody';
import { ReferencesPanel } from '../components/citations/ReferencesPanel';

/**
 * Citations in the writing (addendum 43): Insert Citation from the toolbar,
 * the right-click and the keyboard; the marker drawn in the line; a click on
 * it to change or remove it; and the References library in Research.
 */

afterEach(cleanup);

const LINE = 'Tides follow the moon.';

const para = (text: string) => ({ id: crypto.randomUUID() as ManuscriptElementId, type: 'paragraph' as const, text, characterId: null, attributes: {} });

const book = (format: ProjectFormat = 'instructional', lines = [LINE]) => {
  let file: ProjectFile = createProjectFile({ title: 'The Sea', format });
  const unit = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' });
  const beat = addBeat(unit.file, { unitId: unit.unit.id, title: 'a beat' });
  file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: lines.map(para) } });
  return { file, beatId: beat.beat.id };
};

let latest: ProjectFile | null = null;

function Writing({ start }: { start: ReturnType<typeof book> }) {
  const [file, setFile] = useState(start.file);
  latest = file;
  const beat = file.beats.find((one) => one.id === start.beatId)!;
  return <BeatBody file={file} beat={beat} toolbar onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

const line = () => screen.getAllByRole('textbox')[0] as HTMLTextAreaElement;
const textOf = () => latest!.beats.flatMap((beat) => beat.manuscript.elements).find((element) => element.text.includes('Tides'))!.text;
const caret = (at: number) => {
  const input = line();
  fireEvent.focus(input);
  input.setSelectionRange(at, at);
};

describe('inserting a citation', () => {
  it('from the right-click: a new source made in the dialog, a pinpoint, and the marker where the cursor was', () => {
    render(<Writing start={book()} />);
    caret(LINE.indexOf(' the moon'));
    fireEvent.contextMenu(line());
    fireEvent.click(screen.getByText('Insert citation…'));
    const dialog = screen.getByRole('dialog', { name: 'Insert citation' });
    fireEvent.change(within(dialog).getByLabelText('Search the library'), { target: { value: 'On Tides' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'New source…' }));
    fireEvent.change(within(dialog).getByLabelText('Authors'), { target: { value: 'Jones, Robert' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done with the source' }));
    fireEvent.change(within(dialog).getByLabelText('Pinpoint'), { target: { value: '12' } });
    expect(within(dialog).getByLabelText('As it will print').textContent).toBe('The note: Robert Jones, On Tides, 12.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Insert' }));

    const [citation] = latest!.citations;
    expect(citation).toMatchObject({ locator: '12' });
    expect(textOf()).toBe(`Tides follow[^${citation!.key}] the moon.`);
    expect(latest!.references[0]).toMatchObject({ title: 'On Tides', authors: ['Jones, Robert'] });
    // The token is drawn as its marker.
    expect(document.querySelector('.cite-chip')!.getAttribute('data-marker')).toBe('1');
  });

  it('from the toolbar and from Ctrl+Shift+C, choosing a source already in the library', () => {
    const start = book();
    start.file = addReference(start.file, { title: 'On Tides', authors: ['Jones, Robert'] }).file;
    render(<Writing start={start} />);
    caret(LINE.length);
    fireEvent.click(screen.getByRole('button', { name: 'Insert citation' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Sources' })).getByRole('option'));
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    caret(0);
    fireEvent.keyDown(line(), { key: 'C', ctrlKey: true, shiftKey: true });
    fireEvent.doubleClick(within(screen.getByRole('listbox', { name: 'Sources' })).getByRole('option'));
    const keys = latest!.citations.map((one) => one.key);
    expect(textOf()).toBe(`[^${keys[1]}]${LINE}[^${keys[0]}]`);
    // Renumbered by place in the text, not by when they were made.
    expect([...document.querySelectorAll('.cite-chip')].map((chip) => chip.getAttribute('data-marker'))).toEqual(['1', '2']);
  });

  it('is offered on an instructional book and nowhere else', () => {
    render(<Writing start={book('screenplay')} />);
    fireEvent.contextMenu(line());
    expect(screen.queryByText('Insert citation…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Insert citation' })).toBeNull();
  });
});

describe('a citation already in the text', () => {
  const cited = () => {
    const start = book();
    const made = addReference(start.file, { title: 'On Tides', authors: ['Jones, Robert'] });
    const citation = insertCitation(made.file, { referenceId: made.reference.id, locator: '12' });
    const beat = citation.file.beats.find((one) => one.id === start.beatId)!;
    const element = beat.manuscript.elements[0]!;
    start.file = updateBeat(citation.file, start.beatId, { manuscript: { elements: [{ ...element, text: `Tides${citation.token} follow the moon.` }] } });
    return { start, token: citation.token };
  };

  it('opens on a click on its marker, and its pinpoint can be changed', () => {
    const { start } = cited();
    render(<Writing start={start} />);
    caret('Tides'.length + 3);
    fireEvent.click(line());
    const dialog = screen.getByRole('dialog', { name: 'Citation' });
    expect((within(dialog).getByLabelText('Pinpoint') as HTMLInputElement).value).toBe('12');
    fireEvent.change(within(dialog).getByLabelText('Pinpoint'), { target: { value: '14' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(latest!.citations[0]!.locator).toBe('14');
    expect(latest!.citations).toHaveLength(1);
  });

  it('can be taken out, leaving the words and the source', () => {
    const { start } = cited();
    render(<Writing start={start} />);
    caret('Tides'.length + 3);
    fireEvent.click(line());
    fireEvent.click(screen.getByRole('button', { name: 'Remove citation' }));
    expect(textOf()).toBe(LINE.replace('Tides follow', 'Tides follow'));
    expect(latest!.references).toHaveLength(1);
    expect(document.querySelector('.cite-chip')).toBeNull();
  });
});

describe('References, in Research', () => {
  function Panel({ start }: { start: ProjectFile }) {
    const [file, setFile] = useState(start);
    latest = file;
    return <ReferencesPanel file={file} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
  }

  it('adds and fills a source, previews the notes and bibliography, and re-renders on a change of style', () => {
    const start = book();
    const made = addReference(start.file, { title: 'On Tides', authors: ['Jones, Robert'], date: '2019', publisher: 'Sea Press', place: 'Boston' });
    const citation = insertCitation(made.file, { referenceId: made.reference.id, locator: '12' });
    const element = citation.file.beats.find((one) => one.id === start.beatId)!.manuscript.elements[0]!;
    const file = updateBeat(citation.file, start.beatId, { manuscript: { elements: [{ ...element, text: `x${citation.token}` }] } });
    render(<Panel start={file} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add reference' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'The Moon' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2024-13' } });
    expect(screen.getByRole('alert').textContent).toBe('Write it as 2024, 2024-03 or 2024-03-15.');
    expect(latest!.references.map((one) => one.title)).toEqual(['On Tides', 'The Moon']);

    fireEvent.click(screen.getByRole('tab', { name: 'Notes & bibliography' }));
    expect(within(screen.getByLabelText('Notes')).getByRole('listitem').textContent).toBe('1 Robert Jones, On Tides (Boston: Sea Press, 2019), 12.');
    expect(within(screen.getByLabelText('Bibliography')).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Jones, Robert. On Tides. Boston: Sea Press, 2019.',
    ]);

    fireEvent.click(screen.getByRole('tab', { name: 'How the book cites' }));
    act(() => {
      fireEvent.change(screen.getByLabelText('Citation style'), { target: { value: 'apa' } });
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Notes & bibliography' }));
    expect(within(screen.getByLabelText('Notes')).getByRole('listitem').textContent).toBe('(Jones, 2019, p. 12)');
    expect(screen.getByRole('heading', { name: 'References' })).toBeTruthy();
  });
});
