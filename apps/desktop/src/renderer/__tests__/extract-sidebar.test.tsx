// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
import { extractRange } from '../document/extensions';

/**
 * **Extract & Organize** (addendum 42 §8), against the WP spec's own
 * acceptance tests:
 *
 * - EX-01: select, press a category, and the document is unchanged with one
 *   matching extract in the bin.
 * - EX-02: the press keeps the selection, and twenty captures need no dialog.
 * - EX-03: Gray, Hide and Normal never change the saved text.
 * - EX-04: a Math Instruction palette with four buttons persists.
 * - EX-05: overlapping captures are separate extracts with their own links.
 */

const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Element.prototype.getClientRects ??= noRects;
Range.prototype.getClientRects ??= noRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);

afterEach(cleanup);

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

const TEXT = 'Sarah never sleeps before two. The house creaks in the wind.';

const open = () => {
  const file = createProjectFile({ title: 'Notes', format: 'document' });
  render(<Harness start={setDocumentContent(file, mainDocument(file)!.id, textToDocContent(TEXT))} />);
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Extract & Organize' }));
};

const editorOf = (): Editor => (document.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;

/** Select some words of the paragraph, as a writer's drag would. */
const select = (words: string) => {
  const at = TEXT.indexOf(words);
  act(() => {
    editorOf().commands.setTextSelection({ from: 1 + at, to: 1 + at + words.length });
  });
};

const press = (label: string) => fireEvent.mouseDown(screen.getByRole('button', { name: `Extract into ${label}` }));

describe('capturing', () => {
  it('EX-01: leaves the document as it was, and one extract in the matching bin', () => {
    open();
    select('Sarah never sleeps before two.');
    press('Character');
    expect(latest!.extracts).toHaveLength(1);
    expect(latest!.extracts[0]!.textPlain).toBe('Sarah never sleeps before two.');
    expect(docPlainText(mainDocument(latest!)!.content)).toBe(TEXT);
    expect(screen.getByText('Added to Character (1).')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Bins' })).getByText('Character')).toBeTruthy();
  });

  it('EX-02: keeps the selection through the press, and takes twenty in a row with no dialog', () => {
    open();
    select('The house creaks');
    press('Idea');
    expect(editorOf().state.selection.from).toBe(1 + TEXT.indexOf('The house creaks'));
    for (let index = 0; index < 19; index += 1) {
      select(TEXT.slice(index, index + 5 + (index % 7)));
      press('Note');
    }
    expect(latest!.extracts).toHaveLength(20);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuses nothing silently: no selection says so, and the same words twice in one bin are warned of', () => {
    open();
    expect((screen.getByRole('button', { name: 'Extract into Idea' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Select text first, then press a category.')).toBeTruthy();
    select('The house creaks');
    press('Idea');
    select('The house creaks');
    press('Idea');
    expect(latest!.extracts).toHaveLength(1);
    expect(screen.getByText('That passage is already in Idea.')).toBeTruthy();
  });

  it('EX-05: overlapping captures are separate extracts, each with its own mark', () => {
    open();
    select('The house');
    press('Location');
    select('The house creaks in the wind.');
    press('Setup');
    const [location, setup] = latest!.extracts;
    expect(location!.id).not.toBe(setup!.id);
    expect(extractRange(editorOf().state.doc, location!.id)).toEqual({ from: 1 + TEXT.indexOf('The house'), to: 1 + TEXT.indexOf(' creaks') });
    expect(extractRange(editorOf().state.doc, setup!.id)).toEqual({ from: 1 + TEXT.indexOf('The house'), to: 1 + TEXT.length });
  });
});

describe('the source text', () => {
  it('EX-03: Gray and Hide change the view and never the saved words', () => {
    open();
    select('Sarah never sleeps before two.');
    press('Character');
    const saved = JSON.stringify(mainDocument(latest!)!.content);
    for (const mode of ['Gray', 'Hide', 'Normal']) {
      fireEvent.click(screen.getByRole('radio', { name: mode }));
      expect(JSON.stringify(mainDocument(latest!)!.content)).toBe(saved);
    }
    fireEvent.click(screen.getByRole('radio', { name: 'Hide' }));
    expect(document.querySelector('.wp-workspace')!.className).toContain('extracts-hide');
  });

  it('says when the passage has changed since it was taken, and can take the new words', () => {
    open();
    select('The house creaks');
    press('Idea');
    act(() => {
      // An edit inside the marked words.
      editorOf().chain().setTextSelection(1 + TEXT.indexOf('house') + 5).insertContent(' on the hill').run();
    });
    expect(screen.getByText('Source changed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update from source' }));
    expect(latest!.extracts[0]!.textPlain).toBe('The house on the hill creaks');
  });

  it('deletes the extract and its mark, and keeps every word', () => {
    open();
    select('The house creaks');
    press('Idea');
    const id = latest!.extracts[0]!.id;
    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete extract' }));
    expect(latest!.extracts).toEqual([]);
    expect(extractRange(editorOf().state.doc, id)).toBeNull();
    expect(docPlainText(mainDocument(latest!)!.content)).toBe(TEXT);
  });

  it('shows where an extract came from', () => {
    open();
    select('The house creaks');
    press('Idea');
    act(() => {
      editorOf().commands.setTextSelection(1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'The house creaks' }));
    const { from, to } = editorOf().state.selection;
    expect(editorOf().state.doc.textBetween(from, to)).toBe('The house creaks');
  });
});

describe('palettes of your own', () => {
  it('EX-04: makes Math Instruction with four buttons, which capture like any other', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'New…' }));
    fireEvent.change(screen.getByLabelText('New palette name'), { target: { value: 'Math Instruction' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    for (const label of ['Addition', 'Subtraction', 'Multiplication', 'Division']) {
      fireEvent.change(screen.getByLabelText('New button'), { target: { value: label } });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(latest!.extractPalettes.map((one) => one.name)).toEqual(['General Writing', 'Math Instruction']);
    select('two');
    press('Addition');
    expect(latest!.extracts).toHaveLength(1);
    // Switching palettes loses nothing (WP spec §5.3).
    fireEvent.change(screen.getByLabelText('Palette'), { target: { value: latest!.extractPalettes[0]!.id } });
    expect(latest!.extracts).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Extract into Character' })).toBeTruthy();
  });
});
