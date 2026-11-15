// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addItem,
  createOutline,
  createProjectFile,
  keepLinked,
  passagesOf,
  promoteAll,
  type BeatId,
  type OutlineItemId,
  type ProjectFile,
} from '@vcwriter/domain';
import { BeatWriter } from '../components/BeatWriter';
import { MasterPanel } from '../components/MasterPanel';

/**
 * A book's passages (from Ken, 15 November): rows below a subsection print
 * under it with no heading, and are listed in the subsection's screen to
 * rename, open and add to.
 */

afterEach(cleanup);

const book = (): ProjectFile => {
  let file: ProjectFile = createProjectFile({ title: 'Villains', format: 'instructional' });
  const starters = new Set(file.units.map((one) => one.id as string));
  file = { ...file, units: [], beats: file.beats.filter((one) => !starters.has(one.unitId as string)) };
  const made = createOutline(file, { name: 'Outline' });
  file = made.file;
  const id = made.outline.id;
  const rows: Record<string, OutlineItemId> = {};
  const add = (key: string, kind: string, title: string, parent?: string) => {
    const r = addItem(file, id, { kind, title, ...(parent ? { parentId: rows[parent]! } : {}) });
    file = r.file;
    rows[key] = r.itemId!;
  };
  add('s1', 'scene', 'Publishers');
  add('b1', 'beat', 'Big boys', 's1');
  add('bb1', 'beat', 'Major houses', 'b1');
  add('bb2', 'beat', 'Major studios', 'b1');
  add('b2', 'beat', 'Independents', 's1');
  return promoteAll(file, id).file;
};

const beatTitled = (file: ProjectFile, title: string) => file.beats.find((beat) => beat.title === title)!;

function Writer({ initial, title }: { initial: ProjectFile; title: string }) {
  const [file, setFile] = useState(initial);
  const [open, setOpen] = useState<BeatId>(beatTitled(initial, title).id);
  const beat = file.beats.find((one) => one.id === open)!;
  return (
    <>
      <span data-testid="open">{beat.title}</span>
      <span data-testid="passages">{passagesOf(file, beatTitled(file, 'Big boys').id).map((one) => one.title).join('|')}</span>
      <BeatWriter file={file} beat={beat} onUpdate={(mutate) => setFile((current) => keepLinked(current, mutate(current)))} onOpenBeat={setOpen} />
    </>
  );
}

describe('passages of a subsection', () => {
  it('print in the manuscript with no heading of their own', () => {
    const file = book();
    render(
      <MasterPanel
        file={file}
        selectedBeatId={null}
        onSelectBeat={() => undefined}
        onUpdate={() => undefined}
        focusMode={false}
        focusTitleBeatId={null}
        onTitleFocused={() => undefined}
        dictationShortcut={null}
      />,
    );
    const headings = [...document.querySelectorAll('.book-heading.subsection')].map((node) => node.textContent ?? '');
    expect(headings.some((text) => text.includes('Big Boys'))).toBe(true);
    expect(headings.some((text) => text.includes('Independents'))).toBe(true);
    expect(headings.some((text) => text.includes('Major Houses'))).toBe(false);
    expect(headings.some((text) => text.includes('Major Studios'))).toBe(false);
    expect(screen.queryByDisplayValue('Major houses')).toBeNull();
  });

  it('are listed beside the subsection’s page, to open, rename and add to', () => {
    render(<Writer initial={book()} title="Big boys" />);
    expect(screen.getByRole('heading', { name: 'Passages' })).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Major houses'), { target: { value: 'The Big Five' } });
    expect(screen.getByTestId('passages').textContent).toBe('The Big Five|Major studios');
    // Reordered from the list, and the page follows.
    fireEvent.click(screen.getByRole('button', { name: 'Move The Big Five down' }));
    expect(screen.getByTestId('passages').textContent).toBe('Major studios|The Big Five');
    expect((screen.getByRole('button', { name: 'Move The Big Five down' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move The Big Five up' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Passage' }));
    expect(screen.getByTestId('passages').textContent).toBe('The Big Five|Major studios|New passage');

    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]!);
    expect(screen.getByTestId('open').textContent).toBe('The Big Five');
    expect(screen.getByText(/A passage of/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Back to the subsection/ }));
    expect(screen.getByTestId('open').textContent).toBe('Big boys');
  });
});
