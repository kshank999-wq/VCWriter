// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import {
  createProjectFile,
  docPlainText,
  mainDocument,
  setDocumentContent,
  textToDocContent,
  type ProjectFile,
} from '@vcwriter/domain';
import { DocumentWorkspace } from '../document/DocumentWorkspace';
import { documentCommands } from '../document/document-commands';
import { menusFor } from '../menus';
import { Welcome } from '../components/Welcome';

/**
 * **The word processor** (addendum 42).
 *
 * What is pinned is the writer's side: a Document card on the new-project
 * screen, a page that shows the document, typing that reaches the project,
 * a change from elsewhere (an undo, a sync) that reaches the page, the
 * ribbon acting on the selection, find counting matches, and menus that are
 * a word processor's rather than a story's.
 */

// jsdom lays nothing out, and ProseMirror measures the caret to scroll it
// into view. An empty measurement is what an unlaid page would give.
const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Element.prototype.getClientRects ??= noRects;
Range.prototype.getClientRects ??= noRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let latest: ProjectFile | null = null;
let replaceFile: ((next: ProjectFile) => void) | null = null;

function Harness({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  latest = file;
  replaceFile = setFile;
  const document = mainDocument(file)!;
  return (
    <DocumentWorkspace
      file={file}
      document={document}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      saveState="saved"
      onSave={() => undefined}
      onSaveAs={() => undefined}
    />
  );
}

const start = (text: string) => {
  const file = createProjectFile({ title: 'Letter', format: 'document' });
  return setDocumentContent(file, mainDocument(file)!.id, textToDocContent(text));
};

/** TipTap hangs the editor on its own element. */
const editorOf = (): Editor => (document.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;

describe('the new-project screen', () => {
  it('offers a Document', () => {
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      recentProjects: vi.fn(async () => ({ ok: true, data: [] })),
      projectsFolder: vi.fn(async () => ({ ok: true, data: null })),
    };
    render(
      <Welcome
        onCreate={() => undefined}
        onOpen={() => undefined}
        onImport={() => undefined}
        onProjects={() => undefined}
        onOpenPath={() => undefined}
        error={null}
      />,
    );
    expect(screen.getByRole('button', { name: /^Document/ })).toBeTruthy();
  });
});

describe('the menus', () => {
  it('are a word processor’s: Word export and Replace, and no story rooms', () => {
    const commands = menusFor('document').flatMap((menu) => menu.items.flatMap((item) => (item ? [item.command] : [])));
    expect(commands).toContain('file.exportDocx');
    expect(commands).toContain('editor.replace');
    expect(commands).not.toContain('window.sculptor');
    expect(commands).not.toContain('editor.storyGrid');
    expect(commands).not.toContain('file.titlePage');
  });
});

describe('the page', () => {
  it('shows the document and its counts', () => {
    render(<Harness start={start('Dear Ken,\nIt is raining.')} />);
    expect(screen.getByText('Dear Ken,')).toBeTruthy();
    expect(screen.getByText('5 words')).toBeTruthy();
  });

  it('hands what is typed to the project once typing settles', () => {
    vi.useFakeTimers();
    render(<Harness start={start('One')} />);
    act(() => {
      editorOf().chain().focus('end').insertContent(' two').run();
    });
    // Not yet: a burst of typing is one change, not one per key.
    expect(docPlainText(mainDocument(latest!)!.content)).toBe('One');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(docPlainText(mainDocument(latest!)!.content)).toBe('One two');
    expect(mainDocument(latest!)!.revision).toBeGreaterThan(1);
  });

  it('takes a change made elsewhere, such as an undo or a sync', () => {
    render(<Harness start={start('Before')} />);
    act(() => {
      const file = latest!;
      replaceFile!(setDocumentContent(file, mainDocument(file)!.id, textToDocContent('After')));
    });
    expect(editorOf().getText()).toBe('After');
  });

  it('makes the selection bold from the ribbon, keeping the selection', () => {
    render(<Harness start={start('Make this bold')} />);
    act(() => {
      editorOf().commands.setTextSelection({ from: 6, to: 10 });
    });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Bold' }));
    expect(editorOf().getHTML()).toContain('<strong>this</strong>');
    expect(editorOf().state.selection.from).toBe(6);
  });

  it('applies a heading from the Styles box', () => {
    render(<Harness start={start('Chapter')} />);
    act(() => {
      editorOf().commands.setTextSelection(2);
    });
    fireEvent.change(screen.getByLabelText('Style', { selector: 'select' }), { target: { value: 'h2' } });
    expect(editorOf().getHTML()).toContain('<h2');
  });

  it('counts what Find finds, and replaces every match', () => {
    render(<Harness start={start('the cat and the hat\nThe end')} />);
    act(() => documentCommands.current?.replace());
    fireEvent.change(screen.getByRole('textbox', { name: 'Find' }), { target: { value: 'the' } });
    expect(screen.getByText(/of 3/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Match case/ }));
    expect(screen.getByText(/of 2/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Replace with' }), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
    expect(editorOf().getText({ blockSeparator: '\n' })).toBe('a cat and a hat\nThe end');
  });

  it('gives the app’s Undo to the document', () => {
    render(<Harness start={start('Keep')} />);
    act(() => {
      editorOf().chain().focus('end').insertContent(' going').run();
    });
    act(() => documentCommands.current?.undo());
    expect(editorOf().getText()).toBe('Keep');
  });
});

/**
 * The right-hand menu (addendum 42 §16, from Ken: *it'll have the functions
 * that we talked about in a right-hand vertical menu along the right-hand side*).
 */
describe('the right-hand menu', () => {
  it('holds the writer’s tools, and Research opens from it', () => {
    const file = start('Dear Sam,');
    const research = vi.fn();
    render(
      <DocumentWorkspace
        file={file}
        document={mainDocument(file)!}
        onUpdate={() => undefined}
        saveState="saved"
        onSave={() => undefined}
        onSaveAs={() => undefined}
        onOpenResearch={research}
      />,
    );
    const rail = screen.getByRole('navigation', { name: 'Writer’s tools' });
    for (const name of ['Navigation pane', 'Research', 'Extract & Organize', 'Sources and style', 'Insert a citation', 'Find in document']) {
      expect(rail.querySelector(`[aria-label="${name}"]`)).toBeTruthy();
    }
    expect(rail.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Document');
    fireEvent.click(screen.getByRole('button', { name: 'Research' }));
    expect(research).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Navigation pane' }));
    expect(screen.getByRole('navigation', { name: 'Navigation' })).toBeTruthy();
  });
});

/** Footnotes and endnotes (addendum 42 §18). */
describe('footnotes and endnotes', () => {
  it('inserts a footnote from the References tab, and an endnote, into the document', async () => {
    render(<Harness start={start('The bridge is out.')} />);
    act(() => {
      editorOf().commands.focus('end');
    });
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Insert footnote' }));
    fireEvent.change(screen.getByLabelText('The note'), { target: { value: 'It fell in 1987.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Insert endnote' }));
    fireEvent.change(screen.getByLabelText('The note'), { target: { value: 'See the flood records.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    const notes: { kind: unknown; text: unknown }[] = [];
    editorOf().state.doc.descendants((node) => {
      if (node.type.name === 'footnote') notes.push({ kind: node.attrs['kind'], text: node.attrs['text'] });
    });
    expect(notes).toEqual([
      { kind: 'foot', text: 'It fell in 1987.' },
      { kind: 'end', text: 'See the flood records.' },
    ]);
    expect(editorOf().getHTML()).toContain('data-footnote=');
  });
});

/** A table of contents (addendum 42 §19). */
describe('the table of contents', () => {
  it('is inserted from the References tab and lists the document’s headings', async () => {
    const file = createProjectFile({ title: 'Letter', format: 'document' });
    const withHeadings = setDocumentContent(file, mainDocument(file)!.id, {
      type: 'doc',
      content: [
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 1, headingId: 'a' }, content: [{ type: 'text', text: 'Arrival' }] },
        { type: 'heading', attrs: { level: 2, headingId: 'b' }, content: [{ type: 'text', text: 'The Harbour' }] },
      ],
    });
    render(<Harness start={withHeadings} />);
    act(() => {
      editorOf().commands.setTextSelection(1);
    });
    fireEvent.click(screen.getByRole('tab', { name: 'References' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Table of contents' }));
    expect(editorOf().getHTML()).toContain('data-toc');
    await waitFor(() => {
      const table = document.querySelector('.wp-toc-block');
      expect(table?.textContent).toContain('Arrival');
      expect(table?.textContent).toContain('The Harbour');
    });
  });
});
