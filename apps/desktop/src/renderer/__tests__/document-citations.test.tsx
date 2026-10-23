// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import {
  addReference,
  bringInReferences,
  updateReference,
  addBeat,
  addUnit,
  buildBookDocx,
  citationKeysInDoc,
  insertCitation,
  updateBeat,
  type ManuscriptElementId,
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
    await waitFor(() => expect(within(dialog).getByText(/already here, the same: link the two/)).toBeTruthy());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bring in 1 source and link 1 already here' }));
    expect(latest!.references.map((one) => one.title)).toEqual(['On Tides', 'The Moon']);
    expect(within(dialog).getByRole('status').textContent).toBe(
      '1 source brought in from The Sea, linked: a change to it here or there reaches the other; one source already here linked to The Sea.',
    );
    // Linked to the library it came from (§29), and the one already here too (§30).
    expect(latest!.references[1]!.link).toMatchObject({ path: '/sea.vcw', title: 'The Sea' });
    expect(latest!.references[0]!.link).toMatchObject({ path: '/sea.vcw', title: 'The Sea' });
  });
});

describe('a Word file with footnotes, inserted', () => {
  it('brings its notes in as citations, their source into References, numbered in the document', async () => {
    // A Word file with two footnotes citing one book: a book's own export.
    let book = createProjectFile({ title: 'The Sea', format: 'instructional' });
    const source = addReference(book, { type: 'book', title: 'On Tides', authors: ['Jones, Robert'], date: '2019', publisher: 'Sea Press', place: 'Boston' });
    book = source.file;
    const one = insertCitation(book, { referenceId: source.reference.id, locator: '12' });
    const two = insertCitation(one.file, { referenceId: source.reference.id, locator: '14' });
    book = two.file;
    const unit = addUnit(book, { trackId: book.tracks[0]!.id, title: 'One' });
    const beat = addBeat(unit.file, { unitId: unit.unit.id });
    book = updateBeat(beat.file, beat.beat.id, {
      manuscript: {
        elements: [{ id: crypto.randomUUID() as ManuscriptElementId, type: 'paragraph', text: `Tides follow the moon.${one.token} Twice a day.${two.token}`, characterId: null, attributes: {} }],
      },
    });
    const bytes = await buildBookDocx(book);
    const word = new File([new Uint8Array(bytes)], 'tides.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    render(<Harness start={letter('')} />);
    fireEvent.click(screen.getByRole('tab', { name: 'File' }));
    fireEvent.change(screen.getByLabelText('Choose a Word or text file to insert'), { target: { files: [word] } });
    await waitFor(() => expect(screen.getByText(/Inserted tides\.docx, with its 2 footnotes as citations/)).toBeTruthy());
    expect(latest!.references.map((one) => one.title)).toEqual(['On Tides']);
    expect(latest!.citations.map((one) => one.locator)).toEqual(['12', '14']);
    expect(keysNow()).toEqual(latest!.citations.map((one) => one.key));
    expect([...document.querySelectorAll('sup.wp-cite')].map((one) => one.getAttribute('data-marker'))).toEqual(['1', '2']);
  });
});

describe('notes at the foot of the printed page (§23)', () => {
  it('sets the pages before the PDF, each with the notes cited on it at its foot', async () => {
    const exportPdf = vi.fn(async () => ({ ok: true, data: { path: '/p/Letter.pdf', pageCount: 1 } }));
    (window as unknown as { vcwriter: unknown }).vcwriter = { exportPdf };
    const start = addReference(letter(), { title: 'On Tides', authors: ['Jones, Robert'] }).file;
    render(<Harness start={start} />);
    act(() => {
      editorOf().commands.setTextSelection(13);
    });
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    press('Insert citation');
    fireEvent.doubleClick(within(screen.getByRole('listbox', { name: 'Sources' })).getByRole('option'));
    fireEvent.click(screen.getByRole('tab', { name: 'File' }));
    press('PDF');
    await waitFor(() => expect(exportPdf).toHaveBeenCalled());
    const html = (exportPdf.mock.calls[0] as unknown as [{ html: string }])[0].html;
    expect(html).toContain('<section class="wp-page"><div class="wp-page-body"><p>Tides follow<sup class="wp-cite"><a href="#wp-note-1" id="wp-ref-1">1</a></sup> the moon.</p></div>');
    expect(html).toContain('<div class="wp-page-notes"><p class="wp-note" id="wp-note-1"><a href="#wp-ref-1">1.</a> Robert Jones, <em>On Tides</em>.</p></div>');
    // Not at the end as well.
    expect(html).not.toContain('<section class="wp-notes">');
  });
});

describe('the page view’s notes (§25)', () => {
  it('sets its pages without touching the words: nothing of the gaps is in the document', async () => {
    const start = addReference(letter(), { title: 'On Tides', authors: ['Jones, Robert'] }).file;
    render(<Harness start={start} />);
    act(() => {
      editorOf().commands.setTextSelection(13);
    });
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    press('Insert citation');
    fireEvent.doubleClick(within(screen.getByRole('listbox', { name: 'Sources' })).getByRole('option'));
    // The page view sets its pages a moment after the words settle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(editorOf().getHTML()).not.toContain('wp-page-gap');
    expect(JSON.stringify(latest!.documents[0]!.content)).not.toContain('gap');
    expect(screen.getByText('1 page')).toBeTruthy();
  });
});

describe('a library linked between projects (§29)', () => {
  const linkedPair = () => {
    let book = createProjectFile({ title: 'The Sea', format: 'instructional' });
    const made = addReference(book, { title: 'On Tides', authors: ['Jones, Robert'], date: '2019' });
    book = made.file;
    const letters = bringInReferences(letter(), book.references, null, { path: '/sea.vcw', title: 'The Sea' }).file;
    return { book, letters, sourceId: made.reference.id };
  };
  const bridge = (book: ProjectFile) => {
    const sendIntoProject = vi.fn(async () => ({ ok: true, data: { contentHash: 'y' } }));
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      readProject: vi.fn(async () => ({ ok: true, data: { path: '/sea.vcw', file: book, contentHash: 'x' } })),
      sendIntoProject,
      listProjects: vi.fn(async () => ({ ok: true, data: [] })),
    };
    return sendIntoProject;
  };
  const openLibrary = () => {
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    press('Sources & style');
  };

  it('takes a change made in the library it is linked to, when the library is opened', async () => {
    const { book, letters, sourceId } = linkedPair();
    bridge(updateReference(book, sourceId, { publisher: 'Sea Press' }));
    render(<Harness start={letters} />);
    openLibrary();
    await waitFor(() => expect(latest!.references[0]!.publisher).toBe('Sea Press'));
    expect(screen.getByRole('status').textContent).toBe('One source took a change from where it is linked.');
  });

  it('sends a change made here to the library, and says so', async () => {
    const { book, letters } = linkedPair();
    const send = bridge(book);
    const copy = letters.references[0]!;
    render(<Harness start={updateReference(letters, copy.id, { title: 'On Tides and Harbours' })} />);
    openLibrary();
    await waitFor(() => expect(send).toHaveBeenCalled());
    const sent = (send.mock.calls[0] as unknown as [{ path: string; file: ProjectFile; expectedHash: string }])[0];
    expect(sent.path).toBe('/sea.vcw');
    expect(sent.expectedHash).toBe('x');
    expect(sent.file.references[0]!.title).toBe('On Tides and Harbours');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('One change sent to the linked library.'));
  });

  it('asks which stands where both changed, and takes the library’s when told', async () => {
    const { book, letters, sourceId } = linkedPair();
    bridge(updateReference(book, sourceId, { date: '2020' }));
    const copy = letters.references[0]!;
    render(<Harness start={updateReference(letters, copy.id, { date: '2021' })} />);
    openLibrary();
    const conflicts = await screen.findByLabelText('Changed in both projects');
    expect(within(conflicts).getByText(/In The Sea:/).parentElement!.textContent).toContain('2020');
    fireEvent.click(within(conflicts).getByRole('button', { name: 'Take The Sea’s' }));
    await waitFor(() => expect(latest!.references[0]!.date).toBe('2020'));
    expect(screen.queryByLabelText('Changed in both projects')).toBeNull();
  });
});

describe('a source already here, linked when brought in (§30)', () => {
  it('shows what differs, and links it taking the other project’s facts when told', async () => {
    let book = createProjectFile({ title: 'The Sea', format: 'instructional' });
    book = addReference(book, { title: 'On Tides', authors: ['Jones, Robert'], date: '2019' }).file;
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      listProjects: vi.fn(async () => ({ ok: true, data: [{ path: '/sea.vcw', title: 'The Sea', savedAt: null, sizeBytes: null, missing: false }] })),
      readProject: vi.fn(async () => ({ ok: true, data: { path: '/sea.vcw', file: book, contentHash: 'x' } })),
      sendIntoProject: vi.fn(async () => ({ ok: true, data: { contentHash: 'y' } })),
      pickProject: vi.fn(async () => ({ ok: true, data: null })),
    };
    const start = addReference(letter(), { title: 'On Tides', authors: ['Jones, Robert'], date: '2021' }).file;
    render(<Harness start={start} />);
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    press('Bring in sources');
    const dialog = screen.getByRole('dialog', { name: 'Bring in sources' });
    await waitFor(() => expect(within(dialog).getByRole('option', { name: 'The Sea' })).toBeTruthy());
    fireEvent.change(within(dialog).getByLabelText('Project to bring sources from'), { target: { value: '/sea.vcw' } });
    await waitFor(() => expect(within(dialog).getByText(/already here, but not the same: date 2021 here, 2019 there/)).toBeTruthy());
    // Left unlinked unless the writer says otherwise.
    expect((within(dialog).getByRole('button', { name: /^Bring in/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Link On Tides'), { target: { value: 'theirs' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Link 1 already here' }));
    expect(latest!.references[0]).toMatchObject({ date: '2019', link: { path: '/sea.vcw' } });
  });
});
