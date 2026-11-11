// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addItem,
  addResearchItem,
  createOutline,
  createProjectFile,
  fileNoteUnder,
  type ProjectFile,
} from '@vcwriter/domain';
import { OutlineSidebar } from '../components/OutlineSidebar';
import { NoteRewrite } from '../components/NoteRewrite';

/**
 * Notes dropped on a part of the outline, opened from it (from Ken: *you open
 * that chapter, section, scene, and it has another right-hand list of those
 * notes … you double-click those, and that's where you can rewrite it, and
 * then you can add it as a beat*).
 */
afterEach(cleanup);

const filed = () => {
  let file = createProjectFile({ title: 'Night', format: 'screenplay' });
  const made = createOutline(file);
  const row = addItem(made.file, made.outline.id, { kind: 'scene', title: 'The cemetery' });
  file = addResearchItem(row.file, { categoryId: row.file.researchCategories[0]!.id, title: 'Johnny has the car keys', body: 'In his pocket when he falls.' });
  const note = file.researchItems.at(-1)!;
  return fileNoteUnder(file, note.id, { kind: 'plan', itemId: row.itemId! });
};

describe('a part of the outline in Research', () => {
  it('opens its notes from its name, and folds from its arrow', () => {
    const onOpenFolder = vi.fn();
    render(
      <OutlineSidebar
        file={filed()}
        dragging={null}
        selectedId={null}
        onFile={() => undefined}
        onDragNote={() => undefined}
        onSelect={() => undefined}
        onRewrite={() => undefined}
        onHide={() => undefined}
        onOpenFolder={onOpenFolder}
      />,
    );
    expect(screen.getByText('Johnny has the car keys')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open The cemetery' }));
    expect(onOpenFolder).toHaveBeenCalledWith(expect.objectContaining({ title: 'The cemetery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fold The cemetery' }));
    expect(screen.queryByText('Johnny has the car keys')).toBeNull();
  });

  it('adds a note opened from there as a beat in that part', () => {
    let latest: ProjectFile | null = null;
    function Harness() {
      const [file, setFile] = useState(filed);
      latest = file;
      return (
        <NoteRewrite
          file={file}
          item={file.researchItems.at(-1)!}
          currentBeatId={null}
          placeLabel="Add as beat in The cemetery"
          onClose={() => undefined}
          onUpdate={(mutate) => setFile((current) => mutate(current))}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add as beat in The cemetery' }));
    const beat = latest!.beats.find((one) => one.title === 'Johnny has the car keys');
    expect(beat).toBeTruthy();
    expect(latest!.units.find((unit) => unit.id === beat!.unitId)?.title).toBe('The cemetery');
  });
});

describe('folding the outline in Research like the Outliner (from Ken, 11 November)', () => {
  it('keeps the fold on the outline row, so it lasts and the Outliner folds with it', async () => {
    const { foldFolders } = await import('@vcwriter/domain');
    let latest: ProjectFile | null = null;
    function Harness() {
      const [file, setFile] = useState(filed);
      latest = file;
      return (
        <OutlineSidebar
          file={file}
          dragging={null}
          selectedId={null}
          onFile={() => undefined}
          onDragNote={() => undefined}
          onSelect={() => undefined}
          onRewrite={() => undefined}
          onHide={() => undefined}
          onFold={(folders, collapsed) => setFile((current) => foldFolders(current, folders, collapsed))}
        />
      );
    }
    const first = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByText('Johnny has the car keys')).toBeNull();
    const row = latest!.outlines![0]!.items.find((item) => item.title === 'The cemetery')!;
    expect(row.collapsed).toBe(true);

    // Opened again from the same project: still folded.
    first.unmount();
    render(
      <OutlineSidebar
        file={latest!}
        dragging={null}
        selectedId={null}
        onFile={() => undefined}
        onDragNote={() => undefined}
        onSelect={() => undefined}
        onRewrite={() => undefined}
        onHide={() => undefined}
        onFold={() => undefined}
      />,
    );
    expect(screen.queryByText('Johnny has the car keys')).toBeNull();
    expect(screen.getByRole('button', { name: 'Unfold The cemetery' })).toBeTruthy();
  });
});

describe('taking a note back out of the outline (from Ken, 11 November)', () => {
  it('sends a filed note back to the notes from the outline column', async () => {
    const { unfileNote } = await import('@vcwriter/domain');
    let latest: ProjectFile | null = null;
    function Harness() {
      const [file, setFile] = useState(filed);
      latest = file;
      return (
        <OutlineSidebar
          file={file}
          dragging={null}
          selectedId={null}
          onFile={() => undefined}
          onDragNote={() => undefined}
          onSelect={() => undefined}
          onRewrite={() => undefined}
          onHide={() => undefined}
          onBackToNotes={(note) => setFile((current) => unfileNote(current, note.id))}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to notes: Johnny has the car keys' }));
    expect(screen.queryByText('Johnny has the car keys')).toBeNull();
    const note = latest!.researchItems.find((one) => one.title === 'Johnny has the car keys')!;
    expect(note.place).toBeNull();
  });
});

describe('the Research column in the Outliner shows only what is sorted (from Ken, 11 November)', () => {
  it('shows nothing until a part is chosen, then only the notes sorted into it', async () => {
    const { ResearchShelf } = await import('../components/ResearchShelf');
    const { addResearchItem: add } = await import('@vcwriter/domain');
    let file = filed();
    file = add(file, { categoryId: file.researchCategories[0]!.id, title: 'An unsorted idea', body: 'Not sorted anywhere.' });
    const row = file.outlines![0]!.items.find((item) => item.title === 'The cemetery')!;
    const onOpenNote = vi.fn();
    const shown = render(<ResearchShelf file={file} from="outline" reveal={null} onCarry={vi.fn()} onOpenNote={onOpenNote} />);
    expect(screen.queryByText('An unsorted idea')).toBeNull();
    expect(screen.queryByText('Johnny has the car keys')).toBeNull();
    expect(screen.getByText(/Choose a section or subsection/)).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
    shown.unmount();

    render(
      <ResearchShelf
        file={file}
        from="outline"
        reveal={null}
        onCarry={vi.fn()}
        onOpenNote={onOpenNote}
        chosenRow={{ place: { kind: 'plan', itemId: row.id }, label: 'The cemetery' }}
      />,
    );
    expect(screen.getByText('Johnny has the car keys')).toBeTruthy();
    expect(screen.queryByText('An unsorted idea')).toBeNull();
    fireEvent.doubleClick(screen.getByText('Johnny has the car keys'));
    expect(onOpenNote).toHaveBeenCalledWith(expect.objectContaining({ title: 'Johnny has the car keys' }));
  });
});
