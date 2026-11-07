// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addResearchItem, createProjectFile, type ProjectFile } from '@vcwriter/domain';
import { NoteRewrite } from '../components/NoteRewrite';
import { documentCommands, type DocumentCommands } from '../document/document-commands';

/**
 * In a word processor a note is placed on the page, not on a track (from Ken:
 * *it should say place on page, and then it adds it to the page … where the
 * cursor is at*).
 */
afterEach(() => {
  cleanup();
  documentCommands.current = null;
});

let latest: ProjectFile | null = null;

function Harness({ initial, onClose, onPlaced }: { initial: ProjectFile; onClose(): void; onPlaced(): void }) {
  const [file, setFile] = useState(initial);
  latest = file;
  const item = file.researchItems.at(-1)!;
  return (
    <NoteRewrite
      file={file}
      item={item}
      currentBeatId={null}
      onClose={onClose}
      onPlacedOnPage={onPlaced}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

const withNote = (format: 'document' | 'novel') => {
  const base = createProjectFile({ title: 'Letters', format });
  return addResearchItem(base, { categoryId: base.researchCategories[0]!.id, title: 'Opening', body: 'Dear reader,' });
};

describe('a note in a Document project', () => {
  it('says Place on page and puts the words in the document', () => {
    const insertText = vi.fn(() => true);
    documentCommands.current = { insertText } as unknown as DocumentCommands;
    const onClose = vi.fn();
    const onPlaced = vi.fn();
    render(<Harness initial={withNote('document')} onClose={onClose} onPlaced={onPlaced} />);
    expect(screen.queryByRole('button', { name: /track/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Place on page' }));
    expect(insertText).toHaveBeenCalledWith('Dear reader,');
    expect(latest!.researchItems.at(-1)!.usage).toBe('used');
    expect(onClose).toHaveBeenCalled();
    expect(onPlaced).toHaveBeenCalled();
  });

  it('says why when no document is open to take it', () => {
    render(<Harness initial={withNote('document')} onClose={() => undefined} onPlaced={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Place on page' }));
    expect(screen.getByRole('status').textContent).toMatch(/Open the document/);
    expect(latest!.researchItems.at(-1)!.usage).toBe('unused');
  });

  it('still places on the track in a story project', () => {
    render(<Harness initial={withNote('novel')} onClose={() => undefined} onPlaced={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Place on the track' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Place on page' })).toBeNull();
  });
});
