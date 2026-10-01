// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addItem,
  createOutline,
  createProjectFile,
  outlineCaseOf,
  type OutlineItemId,
  type ProjectFile,
} from '@vcwriter/domain';
import { OutlinerWindow } from '../components/OutlinerWindow';

/**
 * How the Outliner's rows are named, and the row shape under it (addendum 19
 * §10), from Ken: *sometimes it puts a box around it. Sometimes it forces
 * capitalization. Sometimes it does both. Please check to make sure it's
 * consistent.*
 *
 * The casing rules are the domain's and tested there. What these cover is
 * what a writer meets: that the setting is on the bar, that choosing it
 * renames what is already written, that leaving a box brings a row up to the
 * case, and that **every kind of row is the same shape** — which is the half
 * no domain test can see and the half the complaint was about.
 */

afterEach(cleanup);

/** One row of every kind a textbook offers. */
const outlined = () => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Arithmetic', format: 'instructional' });
  const made = createOutline(file, { name: 'The book' });
  file = made.file;
  const put = (parentId: OutlineItemId | null, kind: string, title: string) => {
    const next = addItem(file, made.outline.id, { parentId, kind, title });
    file = next.file;
    return next.itemId!;
  };
  const chapter = put(null, 'chapter', 'mathematics and its parts');
  const section = put(chapter, 'scene', 'long division and remainders');
  put(section, 'beat', 'why the remainder confuses students');
  put(section, 'note', 'pair with the Hans Gruber example');
  put(section, 'idea', 'open with a worked page');
  return file;
};

function Outliner({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  return (
    <OutlinerWindow
      file={file}
      open
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

const names = () =>
  (screen.getAllByRole('textbox') as HTMLTextAreaElement[])
    .filter((box) => box.classList.contains('outline-title'))
    .map((box) => box.value);

describe('one row shape, whatever the kind', () => {
  /**
   * The complaint, pinned. Four kinds had four treatments — a chapter with no
   * box, a section with a box, a subsection with a box and no capitals, a
   * note with a box of a third fill — and no rule a writer could state. The
   * box says *this is where you type*, which is true of every row alike.
   */
  it('gives every row a box', () => {
    const { container } = render(<Outliner start={outlined()} />);
    const rows = [...container.querySelectorAll('.outline-row')];
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(row.querySelector('.outline-box')).toBeTruthy();
  });

  /**
   * And nothing is shouted into place. A row's name travels into the marker,
   * the unit or the beat when it is promoted, so capitals laid on in a
   * stylesheet made the outline say one thing and the book print another —
   * which is why the markup carries the words exactly as they are stored.
   */
  it('draws the words exactly as they are stored', () => {
    render(<Outliner start={outlined()} />);
    expect(names()[0]).toBe('mathematics and its parts');
    expect(names()[1]).toBe('long division and remainders');
  });
});

describe('choosing how the rows are named', () => {
  const chooseCase = (how: string) =>
    fireEvent.change(screen.getByLabelText('How the rows are named'), { target: { value: how } });

  it('stands on the bar and opens on As typed', () => {
    render(<Outliner start={outlined()} />);
    const select = screen.getByLabelText('How the rows are named') as HTMLSelectElement;
    expect(select.value).toBe('as_typed');
    expect([...select.options].map((option) => option.textContent)).toEqual([
      'As typed',
      'Title Case',
      'Sentence case',
    ]);
  });

  /** A setting that reached only rows typed next would read as a dead one. */
  it('names what is already written', () => {
    render(<Outliner start={outlined()} />);
    chooseCase('title');

    expect(names()[0]).toBe('Mathematics and Its Parts');
    expect(names()[1]).toBe('Long Division and Remainders');
    expect(names()[2]).toBe('Why the Remainder Confuses Students');
  });

  it('brings a row typed afterwards up to the case when it is left', () => {
    render(<Outliner start={outlined()} />);
    chooseCase('title');

    const box = (screen.getAllByRole('textbox') as HTMLTextAreaElement[]).filter((one) =>
      one.classList.contains('outline-title'),
    )[2]!;
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'a page about remainders' } });
    fireEvent.blur(box);

    expect(names()[2]).toBe('A Page About Remainders');
  });

  /**
   * The fault driving it found: under sentence case a capital taken off on
   * blur would be taken off again every time the writer put it back, and no
   * rule can tell a surname from an ordinary word. Lowering belongs to the
   * act that asks for it and to nothing else.
   */
  it('never takes a capital off a row the writer is merely leaving', () => {
    render(<Outliner start={outlined()} />);
    chooseCase('sentence');

    const box = (screen.getAllByRole('textbox') as HTMLTextAreaElement[]).filter((one) =>
      one.classList.contains('outline-title'),
    )[3]!;
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'pair with the Hans Gruber example' } });
    fireEvent.blur(box);

    expect(names()[3]).toBe('Pair with the Hans Gruber example');
  });

  it('keeps the choice on the project', () => {
    let seen: ProjectFile | null = null;
    function Watched() {
      const [file, setFile] = useState(outlined());
      seen = file;
      return (
        <OutlinerWindow
          file={file}
          open
          onClose={() => undefined}
          onUpdate={(mutate) => setFile((current) => mutate(current))}
        />
      );
    }
    render(<Watched />);
    chooseCase('sentence');
    expect(outlineCaseOf(seen as unknown as ProjectFile)).toBe('sentence');
  });
});
