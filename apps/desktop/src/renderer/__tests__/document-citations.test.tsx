// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import {
  addReference,
  citationKeysInDoc,
  createProjectFile,
  mainDocument,
  setDocumentContent,
  textToDocContent,
  type ProjectFile,
} from '@vcwriter/domain';
import { DocumentWorkspace } from '../document/DocumentWorkspace';

/**
 * Citing in the word processor (addendum 43 §11): the ribbon's References
 * tab, the same dialog the manuscript uses, markers drawn where they stand, a
 * bibliography that fills itself, and another project's sources brought in.
 */

const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Element.prototype.getClientRects ??= noRects;
Range.prototype.getClientRects ??= noRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);

afterEach(() => {
  cleanup();
});

let latest: ProjectFile | null = null;

function Harness({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  latest = file;
  return (
    <DocumentWorkspace
      file={file}
      document={mainDocument(file)!}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      saveState="saved"
      onSave={() => undefined}
      onSaveAs={() => undefined}
    />
  );
}

const letter = (text = 'Tides follow the moon.') => {
  const file = createProjectFile({ title: 'Letter', format: 'document' });
  return setDocumentContent(file, mainDocument(file)!.id, textToDocContent(text));
};

const editorOf = (): Editor => (document.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;
const press = (name: string) => fireEvent.mouseDown(screen.getByRole('button', { name }));
const keysNow = () => citationKeysInDoc(editorOf().getJSON() as never);

describe('citing in a document', () => {
  it('inserts a citation from References on the ribbon, with a source made in the dialog, and draws its marker', () => {
    render(<Harness start={letter()} />);
    act(() => {
      editorOf().commands.setTextSelection(13);
    });
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    press('Insert citation');
    const dialog = screen.getByRole('dialog', { name: 'Insert citation' });
    fireEvent.change(within(dialog).getByLabelText('Search the library'), { target: { value: 'On Tides' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'New source…' }));
    fireEvent.change(within(dialog).getByLabelText('Authors'), { target: { value: 'Jones, Robert' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done with the source' }));
    fireEvent.change(within(dialog).getByLabelText('Pinpoint'), { target: { value: '12' } });
    expect(within(dialog).getByLabelText('As it will print').textContent).toBe('The note: Robert Jones, On Tides, 12.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Insert' }));

    const [citation] = latest!.citations;
    expect(keysNow()).toEqual([citation!.key]);
    expect(editorOf().getText()).toBe('Tides follow the moon.');
    expect(document.querySelector('sup.wp-cite')!.getAttribute('data-marker')).toBe('1');
    expect(screen.getByText(/1 citation · 1 source in the library/)).toBeTruthy();
  });

  it('numbers by place, opens on Ctrl+Shift+C, and puts a bibliography that fills itself where the cursor is', () => {
    const start = addReference(letter(), { title: 'On Tides', authors: ['Jones, Robert'], date: '2019', publisher: 'Sea Press', place: 'Boston' }).file;
    render(<Harness start={start} />);
    act(() => {
      editorOf().commands.setTextSelection(23);
    });
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    press('Insert citation');
    fireEvent.doubleClick(within(screen.getByRole('listbox', { name: 'Sources' })).getByRole('option'));
    act(() => {
      editorOf().commands.setTextSelection(1);
    });
    fireEvent.keyDown(document.querySelector('.ProseMirror')!, { key: 'C', ctrlKey: true, shiftKey: true });
    fireEvent.doubleClick(within(screen.getByRole('listbox', { name: 'Sources' })).getByRole('option'));
    // Renumbered by place: the one made second stands first.
    expect([...document.querySelectorAll('sup.wp-cite')].map((one) => one.getAttribute('data-marker'))).toEqual(['1', '2']);
    expect(keysNow()).toEqual([latest!.citations[1]!.key, latest!.citations[0]!.key]);

    act(() => {
      editorOf().commands.setTextSelection(editorOf().state.doc.content.size - 1);
    });
    press('Bibliography');
    const block = document.querySelector('.wp-bibliography-block')!;
    expect(block.textContent).toContain('Bibliography');
    expect(block.textContent).toContain('Jones, Robert. On Tides. Boston: Sea Press, 2019.');
  });

  it('opens a citation on a click on its marker, and takes it out leaving the words', async () => {
    const start = addReference(letter(), { title: 'On Tides', authors: ['Jones, Robert'] }).file;
    render(<Harness start={start} />);
    act(() => {
      editorOf().commands.setTextSelection(6);
    });
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    press('Insert citation');
    fireEvent.doubleClick(within(screen.getByRole('listbox', { name: 'Sources' })).getByRole('option'));
    const key = latest!.citations[0]!.key;
    // The node's click handler, as ProseMirror calls it.
    act(() => {
      const storage = (editorOf().storage as unknown as { citation: { onOpen: (key: string) => void } }).citation;
      storage.onOpen(key);
    });
    const dialog = screen.getByRole('dialog', { name: 'Citation' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove citation' }));
    expect(keysNow()).toEqual([]);
    expect(editorOf().getText()).toBe('Tides follow the moon.');
    expect(latest!.references).toHaveLength(1);
  });
});

describe('another project’s library', () => {
  it('brings its sources in from References, the ones already here left out', async () => {
    let book = createProjectFile({ title: 'The Sea', format: 'instructional' });
    book = addReference(book, { title: 'On Tides', authors: ['Jones, Robert'] }).file;
    book = addReference(book, { title: 'The Moon', authors: ['Lee, Ada'] }).file;
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      listProjects: vi.fn(async () => ({ ok: true, data: [{ path: '/sea.vcw', title: 'The Sea', savedAt: null, sizeBytes: null, missing: false }] })),
      readProject: vi.fn(async () => ({ ok: true, data: { path: '/sea.vcw', file: book, contentHash: 'x' } })),
      pickProject: vi.fn(async () => ({ ok: true, data: null })),
    };
    const start = addReference(letter(), { title: 'On Tides', authors: ['Jones, Robert'] }).file;
    render(<Harness start={start} />);
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    press('Bring in sources');
    const dialog = screen.getByRole('dialog', { name: 'Bring in sources' });
    await waitFor(() => expect(within(dialog).getByRole('option', { name: 'The Sea' })).toBeTruthy());
    fireEvent.change(within(dialog).getByLabelText('Project to bring sources from'), { target: { value: '/sea.vcw' } });
    await waitFor(() => expect(within(dialog).getByText('already in this library')).toBeTruthy());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bring in 1 source' }));
    expect(latest!.references.map((one) => one.title)).toEqual(['On Tides', 'The Moon']);
    expect(within(dialog).getByRole('status').textContent).toBe('1 source brought in from The Sea.');
  });
});
