// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { addItem, addResearchItem, createOutline, createProjectFile, noteOnTrack, type ProjectFile } from '@vcwriter/domain';
import { ResearchWindow } from '../components/ResearchWindow';

/**
 * The outline beside the notes, and the rewrite screen (addendum 28 §7).
 *
 * From Ken: drag a note from the notes screen into a chapter, section,
 * subsection or idea down the right; double-click it there to rewrite it
 * beside the original, and place it on the track — after which it carries a
 * red ✕ and stands under *Used in the book*.
 */

afterEach(cleanup);

let latest: ProjectFile | null = null;

function Harness({ initial }: { initial: ProjectFile }) {
  const [file, setFile] = useState(initial);
  latest = file;
  return (
    <ResearchWindow
      file={file}
      open
      currentBeatId={null}
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

const book = () => {
  let file = createProjectFile({ title: 'Arithmetic', format: 'instructional' });
  const made = createOutline(file, { name: 'Outline' });
  file = made.file;
  const chapter = addItem(file, made.outline.id, { kind: 'chapter', title: 'Mathematics' });
  const section = addItem(chapter.file, made.outline.id, { kind: 'scene', title: 'Division', parentId: chapter.itemId! });
  const sub = addItem(section.file, made.outline.id, { kind: 'beat', title: 'Long division', parentId: section.itemId! });
  const idea = addItem(sub.file, made.outline.id, { kind: 'idea', title: 'Remainders', parentId: sub.itemId! });
  file = idea.file;
  file = addResearchItem(file, { categoryId: file.researchCategories[0]!.id, title: 'Bring down a digit', body: 'rough words from the phone' });
  return file;
};

/** jsdom has no DataTransfer, so the drag carries a stand-in. */
const dataTransfer = () => ({ setData: () => undefined, getData: () => '', effectAllowed: 'move', dropEffect: 'move' });

describe('research as folders', () => {
  it('shows the folders on All research, and opens one in a box of its own', () => {
    render(<Harness initial={book()} />);
    const grid = within(screen.getByLabelText('Research folders by category'));
    const first = latest!.researchCategories[0]!;
    fireEvent.click(grid.getByRole('button', { name: `Open ${first.name} in its own window` }));
    // No desktop bridge in the test, so it opens as a movable box.
    const box = within(screen.getByRole('dialog', { name: 'Research folder' }));
    fireEvent.click(box.getByText('Bring down a digit'));
    expect((box.getByLabelText('Note') as HTMLTextAreaElement).value).toBe('rough words from the phone');
  });
});

describe('the outline beside the notes', () => {
  it('shows chapters, sections, subsections and ideas, and takes a dragged note', () => {
    render(<Harness initial={book()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show every note instead' }));
    const outline = within(screen.getByLabelText('Outline folders'));
    for (const name of [/Mathematics/, /Division/, /Long division/, /Remainders/]) {
      expect(outline.getAllByRole('button', { name }).length).toBeGreaterThan(0);
    }

    const card = within(screen.getByLabelText('Notes')).getByText('Bring down a digit').closest('button')!;
    fireEvent.dragStart(card, { dataTransfer: dataTransfer() });
    const row = outline.getByRole('button', { name: /Unfold|Fold.*Long division/ }).closest('.research-outline-row')!;
    fireEvent.dragOver(row, { dataTransfer: dataTransfer() });
    fireEvent.drop(row, { dataTransfer: dataTransfer() });

    // Filed under Long division, and shown there.
    const filed = outline.getByText('Bring down a digit');
    expect(filed.closest('.research-outline-folder')!.textContent).toContain('Long division');
  });

  it('rewrites beside the original and places it on the track, with a red ✕ after', () => {
    render(<Harness initial={book()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show every note instead' }));
    const outline = within(screen.getByLabelText('Outline folders'));
    const card = within(screen.getByLabelText('Notes')).getByText('Bring down a digit').closest('button')!;
    fireEvent.dragStart(card, { dataTransfer: dataTransfer() });
    const row = outline.getByRole('button', { name: /Fold.*Long division/ }).closest('.research-outline-row')!;
    fireEvent.drop(row, { dataTransfer: dataTransfer() });

    fireEvent.doubleClick(outline.getByText('Bring down a digit'));
    const screenOf = within(screen.getByRole('dialog', { name: /Rewrite Bring down a digit/ }));
    expect(screenOf.getByLabelText('The original note').textContent).toContain('rough words from the phone');
    expect(screenOf.getByText('Not used yet')).toBeTruthy();

    fireEvent.change(screenOf.getByLabelText('Your rewrite'), { target: { value: 'Bring down the next digit.' } });
    // The original is untouched by the rewrite.
    expect(screenOf.getByLabelText('The original note').textContent).toContain('rough words from the phone');
    fireEvent.click(screenOf.getByRole('button', { name: 'Place on the track' }));

    expect(screenOf.getByText(/Used in the book/)).toBeTruthy();
    const note = latest!.researchItems.find((one) => one.title === 'Bring down a digit')!;
    expect(noteOnTrack(latest!, note)).toBe(true);
    const beat = latest!.beats.find((one) => one.id === note.usedInBeatIds[0])!;
    expect(beat.manuscript.elements.map((element) => element.text)).toEqual(['Bring down the next digit.']);

    // A red ✕ on the card, and it is under *Used in the book*.
    fireEvent.click(screenOf.getByRole('button', { name: 'Close the rewrite' }));
    expect(outline.getByLabelText('Used in the book')).toBeTruthy();
    const side = within(screen.getByLabelText('Research folders'));
    fireEvent.click(side.getByRole('button', { name: /Used in the book/ }));
    expect(within(screen.getByLabelText('Notes')).getByText('Bring down a digit')).toBeTruthy();
    fireEvent.click(side.getByRole('button', { name: /Not yet used/ }));
    expect(screen.queryByLabelText('Notes')).toBeNull();
  });
});
