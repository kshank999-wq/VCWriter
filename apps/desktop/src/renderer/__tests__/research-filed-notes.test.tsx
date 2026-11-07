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
