// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addUnit,
  createProjectFile,
  markForIndex,
  updateBeat,
  type ManuscriptElementId,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { BeatBody } from '../components/BeatBody';
import { EditorPanel } from '../components/EditorPanel';
import { menusFor } from '../menus';

/**
 * The book index through the interface (addendum 10 §6, §7).
 *
 * The reading and the page numbers are the domain's, and tested there. What
 * these cover is what a writer meets: that the right-click offers to index a
 * passage in a book and does not in a screenplay, that filing one puts it in
 * the index with a page number nobody typed, and that the screen managing it
 * can unfile, cross-reference and rename.
 */

afterEach(cleanup);

const para = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A book with one scene of prose in it. */
const book = (format: ProjectFormat = 'novel') => {
  let file: ProjectFile = createProjectFile({ title: 'The Lighthouse Keeper', format });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
  const elements = ['The lamp turned all night.', 'Maeve did not sleep.'].map(para);
  file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements } });
  return { file, beatId: beat.beat.id, elements };
};

function Writing({ format, onFile }: { format: ProjectFormat; onFile?(file: ProjectFile): void }) {
  const [made] = useState(() => book(format));
  const [file, setFile] = useState(made.file);
  onFile?.(file);
  const beat = file.beats.find((one) => one.id === made.beatId)!;
  return <BeatBody file={file} beat={beat} onUpdate={(mutate) => setFile((current) => mutate(current))} />;
}

describe('indexing a passage from the writing', () => {
  it('offers it on a book and not on a screenplay', () => {
    render(<Writing format="novel" />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    expect(screen.getByText('Index this…')).toBeTruthy();

    cleanup();
    render(<Writing format="screenplay" />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    // Absent rather than greyed: the true thing is that this format has no
    // index at all, and a disabled line says *not yet*.
    expect(screen.queryByText('Index this…')).toBeNull();
    expect(screen.getByText('Add to a character’s characterization…')).toBeTruthy();
  });

  it('files it under the heading the writer types, keeping the passage as the quote', () => {
    let seen: ProjectFile | null = null;
    render(<Writing format="novel" onFile={(file) => (seen = file)} />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    fireEvent.click(screen.getByText('Index this…'));

    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'lamp, the' } });
    fireEvent.change(screen.getByLabelText('Sub-heading'), { target: { value: 'turning of' } });
    fireEvent.click(screen.getByText('Index it'));

    const marks = (seen as unknown as ProjectFile).indexMarks;
    expect(marks).toHaveLength(1);
    expect(marks[0]!.term).toBe('lamp, the');
    expect(marks[0]!.subTerm).toBe('turning of');
    // The writer's words for the heading, the page's words for the quote.
    expect(marks[0]!.quote).toBe('The lamp turned all night.');
  });

  it('will not file one with no heading', () => {
    render(<Writing format="novel" />);
    fireEvent.contextMenu(screen.getAllByRole('textbox')[0]!);
    fireEvent.click(screen.getByText('Index this…'));

    expect((screen.getByText('Index it') as HTMLButtonElement).disabled).toBe(true);
  });
});

function Screen({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return (
    <EditorPanel
      file={file}
      currentUnitId={file.units[0]!.id}
      openOn="index"
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

/** A book with one passage already filed under one heading. */
const indexed = () => {
  const made = book();
  return markForIndex(made.file, {
    term: 'lamp, the',
    beatId: made.beatId,
    elementId: made.elements[0]!.id as ManuscriptElementId,
    quote: 'The lamp turned all night.',
  }).file;
};

describe('the screen that manages the index', () => {
  it('is a tab on a book and not on a screenplay', () => {
    render(<Screen start={indexed()} />);
    expect(screen.getByRole('tab', { name: /Index/ })).toBeTruthy();

    cleanup();
    const script = book('screenplay');
    render(<Screen start={script.file} />);
    expect(screen.queryByRole('tab', { name: /Index/ })).toBeNull();
  });

  it('shows a page number nobody typed, and never offers to type one', () => {
    render(<Screen start={indexed()} />);
    fireEvent.click(screen.getByRole('button', { name: /lamp, the/ }));

    // The passage is on page one of a one-page book, worked out from the
    // layout rather than stored anywhere: once beside the heading as its run,
    // and once beside the mark itself.
    expect(screen.getAllByText('1')).toHaveLength(2);
    // There is no rebuild, because there is nothing stored to rebuild.
    expect(screen.queryByText(/rebuild/i)).toBeNull();
    expect(screen.queryByLabelText(/page number/i)).toBeNull();
  });

  it('unfiles a mark, and the heading goes with the last of them', () => {
    let seen: ProjectFile | null = null;
    render(<Screen start={indexed()} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('button', { name: /lamp, the/ }));
    fireEvent.click(screen.getByText('Unfile'));

    expect((seen as unknown as ProjectFile).indexMarks).toHaveLength(0);
    // Said twice — the line under the title and the empty list — which is the
    // screen agreeing with itself.
    expect(screen.getAllByText(/Nothing is indexed yet/).length).toBeGreaterThan(0);
  });

  it('renames a heading everywhere at once', () => {
    let seen: ProjectFile | null = null;
    render(<Screen start={indexed()} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('button', { name: /lamp, the/ }));
    fireEvent.click(screen.getByText('Rename this heading…'));
    fireEvent.change(screen.getByLabelText('New heading'), { target: { value: 'lamps' } });
    fireEvent.click(screen.getByText('Rename it everywhere'));

    expect((seen as unknown as ProjectFile).indexMarks[0]!.term).toBe('lamps');
  });

  it('adds a cross-reference, which belongs to the index rather than to a passage', () => {
    let seen: ProjectFile | null = null;
    render(<Screen start={indexed()} onFile={(file) => (seen = file)} />);
    fireEvent.change(screen.getByLabelText('Cross-reference heading'), { target: { value: 'lantern' } });
    fireEvent.change(screen.getByLabelText('Points at'), { target: { value: 'lamp, the' } });
    fireEvent.click(screen.getByText('Add it'));

    const refs = (seen as unknown as ProjectFile).indexRefs;
    expect(refs).toHaveLength(1);
    expect(refs[0]!.kind).toBe('see');
    expect(refs[0]!.target).toBe('lamp, the');
  });

  it('lists a mark whose passage has been cut rather than dropping it', () => {
    const start = markForIndex(indexed(), {
      term: 'Maeve',
      beatId: book().beatId,
      elementId: crypto.randomUUID() as ManuscriptElementId,
      quote: 'a passage that has gone',
    }).file;
    render(<Screen start={start} />);

    expect(screen.getByText(/Pointing at writing that has gone/)).toBeTruthy();
    expect(screen.getByText(/a passage that has gone/)).toBeTruthy();
  });
});

describe('the Editor menu', () => {
  it('carries the index on a book and not on a screenplay', () => {
    const commands = (format: ProjectFormat | null) =>
      menusFor(format).flatMap((menu) => menu.items.filter(Boolean).map((item) => item!.command));

    expect(commands('novel')).toContain('editor.index');
    expect(commands('short_story')).toContain('editor.index');
    expect(commands('screenplay')).not.toContain('editor.index');
    expect(commands('series')).not.toContain('editor.index');
  });
});
