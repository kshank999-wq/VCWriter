// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { createProjectFile, mainDocument, setDocumentContent, textToDocContent, type ProjectFile } from '@vcwriter/domain';
import { DocumentWorkspace } from '../document/DocumentWorkspace';

/**
 * The Word basics Ken listed (addendum 42 §15): headers, footers and page
 * numbers; shapes; One page and Page width; the font library; dictating and
 * reading aloud.
 */

const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Element.prototype.getClientRects ??= noRects;
Range.prototype.getClientRects ??= noRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as unknown as { vcwriter?: unknown }).vcwriter;
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

const TEXT = 'The ferry docks at noon.\nShe leaves before dawn.';
const editorOf = (): Editor => (document.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;
const open = () => {
  const file = createProjectFile({ title: 'Notes', format: 'document' });
  render(<Harness start={setDocumentContent(file, mainDocument(file)!.id, textToDocContent(TEXT))} />);
};
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const press = (name: string) => fireEvent.mouseDown(screen.getByRole('button', { name }));
const doc = () => mainDocument(latest!)!;

describe('headers, footers and page numbers', () => {
  it('writes a footer with fields, shows it on the page, and prints it in the page margin', async () => {
    const exportPdf = vi.fn(async () => ({ ok: true, data: { path: '/p/Notes.pdf', pageCount: 1 } }));
    (window as unknown as { vcwriter: unknown }).vcwriter = { exportPdf };
    open();
    tab('Insert');
    press('Header & footer');
    const right = screen.getByLabelText('Footer, right');
    fireEvent.focus(right);
    fireEvent.change(right, { target: { value: 'Page ' } });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Page number' }));
    fireEvent.change(screen.getByLabelText('Header, left'), { target: { value: '{title}' } });
    expect(doc().headerFooter.footer.right).toBe('Page {page}');
    expect(within(screen.getByLabelText('Footer')).getByText('Page 1')).toBeTruthy();

    tab('File');
    await act(async () => {
      press('PDF');
    });
    const html = (exportPdf.mock.calls[0] as unknown as [{ html: string }])[0].html;
    expect(html).toContain('@bottom-right { content: "Page " counter(page);');
  });

  it('puts page numbers where the gallery says, and takes them out again', () => {
    open();
    tab('Insert');
    fireEvent.change(screen.getByLabelText('Page numbers'), { target: { value: 'bottom-right-of' } });
    expect(doc().headerFooter.footer.right).toBe('Page {page} of {pages}');
    expect(within(screen.getByLabelText('Footer')).getByText('Page 1 of 1')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Page numbers'), { target: { value: 'none' } });
    expect(doc().headerFooter.footer.right).toBe('');
    expect(screen.queryByLabelText('Footer')).toBeNull();
  });
});

describe('shapes', () => {
  it('inserts a shape as a picture at its own size, in the fill chosen', async () => {
    open();
    tab('Insert');
    press('Shapes');
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Fill #ed7d31' }));
    await act(async () => {
      press('Insert oval');
    });
    await waitFor(() => expect(editorOf().getJSON().content!.some((block) => block.type === 'image')).toBe(true));
    const image = editorOf().getJSON().content!.find((block) => block.type === 'image')!;
    expect(image.attrs).toMatchObject({ alt: 'Oval', width: 168 });
    const svg = atob(String(image.attrs!['src']).split(',')[1]!);
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('fill="#ed7d31"');
  });
});

describe('the view', () => {
  it('offers One page and Page width, in the View tab and the status bar', () => {
    open();
    tab('View');
    const ribbon = screen.getByRole('tabpanel', { name: 'View' });
    fireEvent.mouseDown(within(ribbon).getByRole('button', { name: 'One page' }));
    expect(within(ribbon).getByRole('button', { name: 'One page', pressed: true })).toBeTruthy();
    // The status bar's own, beside the zoom slider.
    fireEvent.click(within(screen.getByLabelText('Status')).getByRole('button', { name: 'Page width' }));
    expect(within(screen.getByLabelText('Status')).getByRole('button', { name: 'Page width' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(ribbon).getByRole('button', { name: 'One page', pressed: false })).toBeTruthy();
  });

  it('lists fonts by kind, and every font on the computer when asked', async () => {
    vi.stubGlobal('queryLocalFonts', async () => [{ family: 'Zapfino' }, { family: 'Avenir Next' }, { family: 'Zapfino' }]);
    open();
    const font = screen.getByRole('combobox', { name: 'Font' }) as HTMLSelectElement;
    await waitFor(() => expect([...font.querySelectorAll('optgroup')].map((group) => group.label)).toEqual(['Serif', 'Sans serif', 'Monospace', 'Script and display']));
    await act(async () => {
      fireEvent.change(font, { target: { value: '__more-fonts' } });
    });
    await waitFor(() => expect([...font.querySelectorAll('optgroup')].at(-1)!.label).toBe('On this computer'));
    expect([...font.querySelectorAll('optgroup')].at(-1)!.textContent).toBe('Avenir NextZapfino');
  });
});

describe('speech', () => {
  it('reads aloud from the cursor, a paragraph at a time, choosing each as it is read', async () => {
    const spoken: string[] = [];
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        rate = 1;
        voice: unknown = null;
        constructor(public text: string) {}
      },
    );
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      cancel: () => undefined,
      speak: (utterance: { text: string; onend: () => void }) => {
        spoken.push(utterance.text);
        setTimeout(() => utterance.onend(), 0);
      },
    });
    open();
    act(() => {
      editorOf().commands.setTextSelection(3);
    });
    tab('Review');
    await act(async () => {
      press('Read aloud');
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(spoken).toEqual(['The ferry docks at noon.', 'She leaves before dawn.']);
  });

  it('types what is dictated at the cursor', () => {
    const made: { onresult: (event: unknown) => void }[] = [];
    vi.stubGlobal(
      'webkitSpeechRecognition',
      class {
        lang = '';
        continuous = false;
        interimResults = false;
        onresult: ((event: unknown) => void) | null = null;
        onerror = null;
        onend: (() => void) | null = null;
        constructor() {
          made.push(this as never);
        }
        start() {}
        stop() {
          this.onend?.();
        }
      },
    );
    open();
    act(() => {
      editorOf().commands.setTextSelection(1 + 'The ferry docks at noon.'.length);
    });
    tab('Review');
    press('Dictate');
    expect(screen.getByRole('button', { name: 'Stop dictating', pressed: true })).toBeTruthy();
    act(() => {
      made[0]!.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'The gulls are loud.' }], { isFinal: true })] });
    });
    expect(editorOf().getText()).toContain('The ferry docks at noon. The gulls are loud.');
  });
});
