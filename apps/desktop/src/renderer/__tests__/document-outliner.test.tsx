// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import {
  createProjectFile,
  docPlainText,
  headingsOf,
  mainDocument,
  setDocumentContent,
  type DocNode,
  type ProjectFile,
} from '@vcwriter/domain';
import { DocumentWorkspace } from '../document/DocumentWorkspace';

/**
 * The Outliner tab and sending extracts (addendum 42 §9, §10).
 *
 * - OL-01: headings make linked rows; reorganising in the Outliner moves the
 *   sections and loses no text.
 * - TR-01: an extract sent to another of the writer's projects is written
 *   there and carries a receipt here.
 * - TR-03: a send that fails to write records nothing.
 */

const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Element.prototype.getClientRects ??= noRects;
Range.prototype.getClientRects ??= noRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);

afterEach(() => {
  cleanup();
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
      projectPath="/p/notes.vcw"
    />
  );
}

const para = (text: string): DocNode => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const heading = (level: number, text: string): DocNode => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });

const BODY: DocNode = {
  type: 'doc',
  content: [heading(1, 'Arrival'), para('The ferry docks.'), heading(1, 'Departure'), para('She leaves.')],
};

const editorOf = (): Editor => (document.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;

const open = async (content: DocNode = BODY) => {
  const file = createProjectFile({ title: 'Notes', format: 'document' });
  render(<Harness start={setDocumentContent(file, mainDocument(file)!.id, content)} />);
  // The headings are given their ids once the editor is up.
  await waitFor(() => expect(editorOf().getJSON().content![0]!.attrs!['headingId']).toBeTruthy());
  // And handed to the project when the typing pause would have passed.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
};

describe('the Outliner tab', () => {
  it('OL-01: lists the headings, and moving a row moves its section with every word', async () => {
    await open();
    fireEvent.click(screen.getByRole('tab', { name: 'Outliner' }));
    expect(screen.getByRole('region', { name: 'Outliner' })).toBeTruthy();
    expect(screen.getByDisplayValue('Arrival')).toBeTruthy();
    expect(screen.getByDisplayValue('Departure')).toBeTruthy();

    fireEvent.pointerDown(screen.getByDisplayValue('Departure').closest('[role="treeitem"], li, .outline-row') ?? screen.getByDisplayValue('Departure'));
    fireEvent.click(screen.getByRole('button', { name: 'Move Departure up' }));
    const content = mainDocument(latest!)!.content;
    expect(docPlainText(content).split('\n')).toEqual(['Departure', 'She leaves.', 'Arrival', 'The ferry docks.']);
    // The page follows too.
    expect(editorOf().getText().indexOf('Departure')).toBeLessThan(editorOf().getText().indexOf('Arrival'));
  });

  it('renames a heading from its row', async () => {
    await open();
    fireEvent.click(screen.getByRole('tab', { name: 'Outliner' }));
    fireEvent.change(screen.getByDisplayValue('Arrival'), { target: { value: 'Landfall' } });
    expect(headingsOf(mainDocument(latest!)!.content).map((one) => one.text)).toEqual(['Landfall', 'Departure']);
  });

  it('numbers the headings when asked, without touching their words', async () => {
    await open();
    fireEvent.click(screen.getByRole('tab', { name: 'Outliner' }));
    fireEvent.change(screen.getByLabelText('Heading numbering'), { target: { value: 'outline' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Document' }));
    const marks = [...document.querySelectorAll('.wp-heading-number')].map((one) => one.textContent);
    expect(marks).toEqual(['I.', 'II.']);
    expect(headingsOf(mainDocument(latest!)!.content).map((one) => one.text)).toEqual(['Arrival', 'Departure']);
  });
});

describe('sending extracts to a project', () => {
  const capture = () => {
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Extract & Organize' }));
    act(() => {
      editorOf().commands.setTextSelection({ from: 1, to: 1 + 'Arrival'.length });
    });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Extract into Location' }));
  };

  const bridge = (write: { ok: boolean; error?: string }) => {
    const target = createProjectFile({ title: 'The Lamp', format: 'novel' });
    const sendIntoProject = vi.fn(async () => (write.ok ? { ok: true, data: { contentHash: 'h2' } } : { ok: false, error: write.error }));
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      listProjects: async () => ({
        ok: true,
        data: [
          { path: '/p/notes.vcw', title: 'Notes', savedAt: null, sizeBytes: null, missing: false },
          { path: '/p/lamp.vcw', title: 'The Lamp', savedAt: null, sizeBytes: null, missing: false },
        ],
      }),
      readProject: async () => ({ ok: true, data: { path: '/p/lamp.vcw', file: target, contentHash: 'h1' } }),
      sendIntoProject,
    };
    return sendIntoProject;
  };

  it('TR-01: offers the writer’s other projects, writes the extract there, and keeps a receipt', async () => {
    const send = bridge({ ok: true });
    await open();
    capture();
    fireEvent.click(screen.getByRole('button', { name: 'Send…' }));
    const picker = screen.getByLabelText('Destination project') as HTMLSelectElement;
    await waitFor(() => expect([...picker.options].map((one) => one.text)).toEqual(['This project (Notes)', 'The Lamp']));
    await act(async () => {
      fireEvent.change(picker, { target: { value: '/p/lamp.vcw' } });
    });
    expect(await screen.findByText('Research › Locations')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send 1' }));
    });
    expect(send).toHaveBeenCalledTimes(1);
    const written = (send.mock.calls[0] as unknown as [{ file: ProjectFile; expectedHash: string }])[0];
    expect(written.expectedHash).toBe('h1');
    expect(written.file.researchItems.map((item) => item.body)).toEqual(['Arrival']);
    expect(latest!.extracts[0]!.sentTo).toHaveLength(1);
    expect(latest!.extracts[0]!.status).toBe('exported');
    expect(screen.getByText('Sent to The Lamp › Research › Locations')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Send extracts' })).toBeNull();
  });

  it('TR-03: a write that fails records nothing and says why', async () => {
    bridge({ ok: false, error: 'The Lamp changed while you were choosing. Nothing was sent; try again.' });
    await open();
    capture();
    fireEvent.click(screen.getByRole('button', { name: 'Send…' }));
    await screen.findByRole('option', { name: 'The Lamp' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Destination project'), { target: { value: '/p/lamp.vcw' } });
    });
    await screen.findByText('Into The Lamp');
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Send 1' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('Nothing was sent');
    expect(latest!.extracts[0]!.sentTo).toEqual([]);
  });

  it('sends into this project, and a move takes the extract out of the bin but leaves the words', async () => {
    bridge({ ok: true });
    await open();
    capture();
    fireEvent.click(screen.getByRole('button', { name: 'Send…' }));
    fireEvent.click(screen.getByRole('radio', { name: /Move/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move 1' }));
    });
    expect(latest!.extracts).toEqual([]);
    expect(latest!.researchItems.map((item) => item.body)).toEqual(['Arrival']);
    expect(docPlainText(mainDocument(latest!)!.content)).toBe('Arrival\nThe ferry docks.\nDeparture\nShe leaves.');
    expect(document.querySelector('.wp-extract')).toBeNull();
  });

  it('adds an extract to the outline as a linked row', async () => {
    bridge({ ok: true });
    await open();
    capture();
    fireEvent.click(screen.getByRole('button', { name: 'Add to outline' }));
    expect(screen.getByText('Added to the outline.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Outliner' }));
    expect(screen.getAllByDisplayValue('Arrival')).toHaveLength(2);
  });
});
