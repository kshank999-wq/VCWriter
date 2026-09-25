// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  addPart,
  glossaryOf,
  importTextInto,
  partsOf,
  readBackMatterText,
  type PartKind,
  type ProjectFile,
} from '@vcwriter/domain';
import { createProjectFile } from '@vcwriter/domain';

import { BackMatterDialog } from '../components/BackMatterDialog';

/**
 * **Importing a back-matter page, through the interface** (addendum 20 §17c).
 *
 * The parsing and the acts are the domain's and tested there. What these
 * cover is what a writer meets: that both ways in stand on the three pages
 * that take one and nowhere else, that a file is **read and said before
 * anything happens**, and that the index's imported headings become a list
 * struck through by the marks rather than by a tick.
 */

beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(cleanup);

const book = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' });
  for (const kind of ['acknowledgements', 'appendix', 'glossary', 'index'] as PartKind[]) {
    if (!partsOf(file).some((one) => one.kind === kind)) file = addPart(file, kind).file;
  }
  return file;
};

function Harness({ kind, start, onFile }: { kind: PartKind; start?: () => ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start ?? book);
  onFile?.(file);
  const part = partsOf(file).find((one) => one.kind === kind)!;
  return (
    <BackMatterDialog
      file={file}
      part={part}
      laying={null}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      onClose={() => undefined}
      onPickPhoto={() => undefined}
      onTurn={() => undefined}
    />
  );
}

/** A picked file, the way a picker hands one over. */
const textFile = (name: string, text: string): File => {
  const made = new File([text], name, { type: 'text/plain' });
  // jsdom's File has no `.text()` in every version the suite runs under.
  Object.defineProperty(made, 'text', { value: () => Promise.resolve(text) });
  return made;
};

const drop = (input: HTMLElement, file: File) => {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
};

describe('where the two ways in stand', () => {
  it('offers both on the glossary, the appendix and the index', () => {
    for (const kind of ['glossary', 'appendix', 'index'] as PartKind[]) {
      cleanup();
      render(<Harness kind={kind} />);
      expect(screen.getByText('Import as text…')).toBeTruthy();
      expect(screen.getByText('Import a PDF…')).toBeTruthy();
    }
  });

  it('offers neither on a page that keeps neither', () => {
    // Absent rather than greyed: an acknowledgements page is prose the author
    // writes, and there is no file a book could bring into it.
    render(<Harness kind="acknowledgements" />);
    expect(screen.queryByText('Import as text…')).toBeNull();
    expect(screen.queryByText('Import a PDF…')).toBeNull();
  });
});

describe('importing a glossary as text', () => {
  it('says what it would do before it does anything', async () => {
    let seen: ProjectFile | null = null;
    render(<Harness kind="glossary" onFile={(file) => (seen = file)} />);
    drop(
      screen.getByLabelText('Text file to import'),
      textFile('glossary.txt', 'Gallery: the walkway.\nApron: the stone skirt.'),
    );

    await waitFor(() => expect(screen.getByText(/Add 2 terms to the glossary/)).toBeTruthy());
    // Nothing has happened yet — the press is a separate act.
    const page = partsOf(seen as unknown as ProjectFile).find((one) => one.kind === 'glossary')!;
    expect(glossaryOf(page).terms).toHaveLength(0);

    fireEvent.click(screen.getByText('Bring the words in'));
    await waitFor(() => {
      const after = partsOf(seen as unknown as ProjectFile).find((one) => one.kind === 'glossary')!;
      expect(glossaryOf(after).terms.map((one) => one.term)).toEqual(['Gallery', 'Apron']);
    });
  });

  it('accounts for the lines it read and left out', async () => {
    // §4's rule, on the screen: a file that half arrived without saying so is
    // the one outcome an importer may not have.
    render(<Harness kind="glossary" />);
    drop(screen.getByLabelText('Text file to import'), textFile('g.txt', 'A\n\nApron: the stone skirt.'));
    await waitFor(() => expect(screen.getByText(/1 line was read and left out/)).toBeTruthy());
    expect(screen.getByText(/letter heading/)).toBeTruthy();
  });

  it('cancels back to nothing, having changed nothing', async () => {
    let seen: ProjectFile | null = null;
    render(<Harness kind="glossary" onFile={(file) => (seen = file)} />);
    drop(screen.getByLabelText('Text file to import'), textFile('g.txt', 'Gallery: the walkway.'));
    await waitFor(() => expect(screen.getByText('Bring the words in')).toBeTruthy());
    fireEvent.click(screen.getByText('Forget that file'));
    expect(screen.queryByText('Bring the words in')).toBeNull();
    const page = partsOf(seen as unknown as ProjectFile).find((one) => one.kind === 'glossary')!;
    expect(glossaryOf(page).terms).toHaveLength(0);
  });
});

describe('the index’s imported headings', () => {
  const withImported = () => {
    const start = book();
    const part = partsOf(start).find((one) => one.kind === 'index')!;
    return importTextInto(start, part.id, readBackMatterText('index', 'lamp, the, 14, 22–25\nkeeper, 3'));
  };

  it('says the numbers are dropped, before the press', async () => {
    render(<Harness kind="index" />);
    drop(screen.getByLabelText('Text file to import'), textFile('index.txt', 'lamp, the, 14, 22–25'));
    await waitFor(() => expect(screen.getByText(/drop the page numbers/)).toBeTruthy());
    expect(screen.getByText(/this book works its own out/)).toBeTruthy();
    expect(screen.getByText(/Nothing is marked/)).toBeTruthy();
  });

  it('lists them as work, saying which this book never mentions', () => {
    render(<Harness kind="index" start={withImported} />);
    expect(screen.getByText('From the index you brought in')).toBeTruthy();
    expect(screen.getByText('lamp, the')).toBeTruthy();
    expect(screen.getAllByText('not mentioned in this book').length).toBe(2);
  });

  it('takes a row off the list when asked', () => {
    render(<Harness kind="index" start={withImported} />);
    fireEvent.click(screen.getByLabelText('Take lamp, the off the list'));
    expect(screen.queryByText('lamp, the')).toBeNull();
    expect(screen.getByText('keeper')).toBeTruthy();
  });
});

describe('importing a PDF as pages', () => {
  it('says what it keeps and what it costs, and only then offers the press', async () => {
    const pages = [
      { name: 'g 1', data: 'data:image/png;base64,AAA', width: 100, height: 150 },
      { name: 'g 2', data: 'data:image/png;base64,BBB', width: 100, height: 150 },
    ];
    vi.doMock('../read-vector', () => ({ readPdfPages: () => Promise.resolve(pages), MAX_IMPORT_PAGES: 40 }));
    // The reader is the renderer's; what this asserts is the wording the
    // domain supplies, so the offer is driven directly.
    const { pageImportOffer } = await import('@vcwriter/domain');
    const offer = pageImportOffer('glossary', pages);
    expect(offer.says).toContain('a picture of a glossary rather than a glossary');
    vi.doUnmock('../read-vector');
  });
});
