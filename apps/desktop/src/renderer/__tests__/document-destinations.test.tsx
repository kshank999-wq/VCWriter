// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import {
  addResearchItem,
  buildExtractBundle,
  createExtract,
  createProjectFile,
  ensureExtractPalettes,
  mainDocument,
  newId,
  palettesOf,
  categoriesOf,
  serializeExtractBundle,
  setDocumentContent,
  textToDocContent,
  type ExtractId,
  type ProjectFile,
} from '@vcwriter/domain';
import { DocumentWorkspace } from '../document/DocumentWorkspace';

/**
 * Destinations (addendum 42 §11): where each extract goes, chosen per row;
 * adding to or replacing an existing item, with replace confirmed first; a
 * project found by Browse; and the portable bundle back in.
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

const TEXT = 'The old house on Cutter Street creaks.';
const editorOf = (): Editor => (document.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;

/** The Lamp, with something already on its Locations shelf. */
const lamp = (): ProjectFile => {
  const file = createProjectFile({ title: 'The Lamp', format: 'novel' });
  const locations = file.researchCategories.find((category) => category.systemKey === 'locations')!;
  return addResearchItem(file, { categoryId: locations.id, title: 'The house', body: 'Grey shingles.' });
};

const bridge = (target: ProjectFile, extra: Record<string, unknown> = {}) => {
  const sendIntoProject = vi.fn(async () => ({ ok: true, data: { contentHash: 'h2' } }));
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    listProjects: async () => ({ ok: true, data: [{ path: '/p/lamp.vcw', title: 'The Lamp', savedAt: null, sizeBytes: null, missing: false }] }),
    readProject: async (path: string) => ({ ok: true, data: { path, file: target, contentHash: 'h1' } }),
    sendIntoProject,
    ...extra,
  };
  return sendIntoProject;
};

const writtenOf = (send: ReturnType<typeof vi.fn>): ProjectFile =>
  (send.mock.calls[0] as unknown as [{ file: ProjectFile }])[0].file;

const openWithExtract = async () => {
  const file = createProjectFile({ title: 'Notes', format: 'document' });
  render(<Harness start={setDocumentContent(file, mainDocument(file)!.id, textToDocContent(TEXT))} />);
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Extract & Organize' }));
  act(() => {
    editorOf().commands.setTextSelection({ from: 1, to: 1 + 'The old house on Cutter Street'.length });
  });
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Extract into Location' }));
};

const toLamp = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Send…' }));
  await screen.findByRole('option', { name: 'The Lamp' });
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Destination project'), { target: { value: '/p/lamp.vcw' } });
  });
  await screen.findByText('Into The Lamp');
};

describe('destinations', () => {
  it('sends a row where the writer chooses, not where its kind would', async () => {
    const target = lamp();
    const send = bridge(target);
    await openWithExtract();
    await toLamp();
    const where = screen.getByLabelText('Where The old house on Cutter Street goes') as HTMLSelectElement;
    expect(where.selectedOptions[0]!.text).toBe('Research › Locations');
    const themes = [...where.options].find((option) => option.text === 'Research › Themes')!;
    fireEvent.change(where, { target: { value: themes.value } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send 1' }));
    });
    const written = writtenOf(send);
    const shelf = written.researchCategories.find((category) => category.systemKey === 'themes')!;
    expect(written.researchItems.at(-1)).toMatchObject({ categoryId: shelf.id, body: 'The old house on Cutter Street' });
  });

  it('adds to an existing item, and asks before replacing one', async () => {
    const target = lamp();
    const send = bridge(target);
    await openWithExtract();
    await toLamp();
    const as = screen.getByLabelText('As what, for The old house on Cutter Street') as HTMLSelectElement;
    const house = target.researchItems.at(-1)!;
    fireEvent.change(as, { target: { value: `replace:${house.id}` } });
    const button = screen.getByRole('button', { name: 'Send 1' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/Replace the words of one item in The Lamp/)).toBeTruthy();

    fireEvent.change(as, { target: { value: `append:${house.id}` } });
    expect(button.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(button);
    });
    const written = writtenOf(send);
    expect(written.researchItems).toHaveLength(target.researchItems.length);
    expect(written.researchItems.find((item) => item.id === house.id)!.body).toBe('Grey shingles.\n\nThe old house on Cutter Street');
    expect(screen.getByText('Sent to The Lamp › Research › Locations › “The house” (added to)')).toBeTruthy();
  });

  it('finds a project anywhere with Browse', async () => {
    const elsewhere = createProjectFile({ title: 'Far Shore', format: 'screenplay' });
    bridge(elsewhere, {
      listProjects: async () => ({ ok: true, data: [] }),
      pickProject: async () => ({ ok: true, data: { path: '/elsewhere/far.vcw' } }),
    });
    await openWithExtract();
    fireEvent.click(screen.getByRole('button', { name: 'Send…' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Browse…' }));
    });
    await screen.findByText('Into Far Shore');
    expect((screen.getByLabelText('Destination project') as HTMLSelectElement).value).toBe('/elsewhere/far.vcw');
  });

  it('imports a bundle from another document, once', async () => {
    bridge(lamp());
    // A bundle made elsewhere: one idea.
    let other = ensureExtractPalettes(createProjectFile({ title: 'Other', format: 'document' }));
    const idea = categoriesOf(other, palettesOf(other)[0]!.id).find((category) => category.kind === 'idea')!;
    other = createExtract(other, { id: newId<ExtractId>(), documentId: mainDocument(other)!.id, categoryId: idea.id, textPlain: 'A signal.' }).file;
    const bundle = new File([serializeExtractBundle(buildExtractBundle(other))], 'other.json', { type: 'application/json' });

    await openWithExtract();
    const input = screen.getByLabelText('Import bundle') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [bundle] } });
    });
    await waitFor(() => expect(latest!.extracts).toHaveLength(2));
    expect(screen.getByText('Imported 1 extract from other.json.')).toBeTruthy();
    await act(async () => {
      fireEvent.change(input, { target: { files: [bundle] } });
    });
    await waitFor(() => expect(screen.getByText(/Nothing new in other.json/)).toBeTruthy());
    expect(latest!.extracts).toHaveLength(2);
  });
});
