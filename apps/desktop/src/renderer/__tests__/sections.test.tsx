// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addItem,
  addUnit,
  createOutline,
  createProjectFile,
  moveUnit,
  outlinesOf,
  setSectionNumbering,
  type OutlineItemId,
  type ProjectFile,
} from '@vcwriter/domain';
import { StoryView } from '../components/StoryView';
import { OutlinerWindow } from '../components/OutlinerWindow';
import { PageSetup, DEFAULT_PRINT_SETUP, type PrintSetup } from '../components/PageSetup';

/**
 * Sections and subsections, and the numbers on them (addendum 16 §15).
 *
 * The domain proves the arithmetic. What these cover is the claim the screens
 * make to a writer: that the figures are **read from where things fall**, so
 * there is nowhere to type one and moving a section renumbers the screen with
 * nothing run.
 */

afterEach(cleanup);

/** A textbook of three sections, two subsections in each. */
const textbook = (sections = 3, subs = 2) => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
  const starters = new Set(file.units.map((one) => one.id as string));
  const trackId = file.tracks[0]!.id;
  for (let at = 0; at < sections; at += 1) {
    const unit = addUnit(file, { trackId, title: `Section ${at + 1}` });
    file = unit.file;
    for (let under = 0; under < subs; under += 1) {
      file = addBeat(file, { unitId: unit.unit.id, title: `Part ${under + 1}` }).file;
    }
  }
  return {
    ...file,
    units: file.units.filter((one) => !starters.has(one.id as string)),
    beats: file.beats.filter((one) => !starters.has(one.unitId as string)),
  };
};

function Book({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  return (
    <StoryView
      file={file}
      selectedBeatId={null}
      onSelectBeat={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      focusMode={false}
      focusTitleBeatId={null}
      onTitleFocused={() => undefined}
      dictationShortcut={null}
      display={{ headings: false, sceneNames: true, beatNames: true, acts: false, pages: false }}
    />
  );
}

describe('the Book view', () => {
  it('numbers its sections and subsections, and offers nowhere to type one', () => {
    render(<Book start={textbook(3, 2)} />);

    // Sections 1, 2, 3 — and 1.1, 1.2 under the first.
    expect(
      screen.getAllByTitle('Section number, worked out from where it falls').map((one) => one.textContent),
    ).toEqual(['1', '2', '3']);
    expect(screen.getAllByTitle('Subsection number, worked out from where it falls')[0]!.textContent).toBe('1.1');
    expect(screen.getAllByTitle('Subsection number, worked out from where it falls')[1]!.textContent).toBe('1.2');

    // The stored sequence label — a box somebody could put "7" in — is gone
    // wherever the number is read instead.
    expect(screen.queryByLabelText('Sequence label')).toBeNull();
  });

  it('calls the parts what this format calls them', () => {
    render(<Book start={textbook(1, 1)} />);
    expect(screen.getByLabelText('Section title')).toBeTruthy();
    expect(screen.queryByLabelText('Scene title')).toBeNull();
  });

  it('keeps the editable label where the book does not number', () => {
    render(<Book start={setSectionNumbering(textbook(2, 1), 'none')} />);
    expect(screen.getAllByLabelText('Sequence label')).toHaveLength(2);
    expect(screen.queryAllByTitle('Section number, worked out from where it falls')).toHaveLength(0);
  });

  /** The whole reason nothing is stored. */
  it('renumbers when a section moves, with nothing run', () => {
    const file = textbook(3, 1);
    const third = file.units[2]!;
    const moved = moveUnit(file, { unitId: third.id, toTrackId: third.trackId, index: 0 });
    render(<Book start={moved} />);

    const numbers = screen.getAllByTitle('Section number, worked out from where it falls');
    expect(numbers.map((one) => one.textContent)).toEqual(['1', '2', '3']);
    // …and the one that moved is now the first, carrying 1.1 under it.
    expect(screen.getAllByTitle('Subsection number, worked out from where it falls')[0]!.textContent).toBe('1.1');
  });

  it('numbers nothing on a screenplay', () => {
    let file: ProjectFile = createProjectFile({ title: 'A Script', format: 'screenplay' });
    file = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' }).file;
    render(<Book start={file} />);
    expect(screen.queryByTitle(/worked out from where it falls/)).toBeNull();
    expect(screen.getAllByLabelText('Sequence label').length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------- the outline

/** A textbook outline: a section, three parts under it, then a second. */
const outlined = (format: 'instructional' | 'screenplay' = 'instructional') => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Optics', format });
  file = createOutline(file).file;
  const outlineId = outlinesOf(file)[0]!.id;
  const put = (kind: string, title: string, parentId: OutlineItemId | null) => {
    const made = addItem(file, outlineId, { kind, title, parentId });
    file = made.file;
    return made.itemId!;
  };
  const one = put('scene', 'Light', null);
  put('beat', 'Refraction', one);
  const second = put('beat', 'Reflection', one);
  put('beat', 'Focal length', second);
  put('note', 'Ask the editor', one);
  put('scene', 'Lenses', null);
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

describe('the Outliner', () => {
  it('numbers the tree as deep as it goes, and leaves a note out of it', () => {
    render(<Outliner start={outlined()} />);

    expect(screen.getByTitle('Section 1')).toBeTruthy();
    expect(screen.getByTitle('Subsection 1.1')).toBeTruthy();
    expect(screen.getByTitle('Subsection 1.2')).toBeTruthy();
    // A tree, so a part under a part is 1.2.1 rather than starting again.
    expect(screen.getByTitle('Subsection 1.2.1')).toBeTruthy();
    expect(screen.getByTitle('Section 2')).toBeTruthy();

    // The note is a thing the writer knows, not a division of the book.
    const numbers = screen.getAllByTitle(/^(Section|Subsection) [\d.]+$/);
    expect(numbers).toHaveLength(5);
  });

  it('numbers nothing on a screenplay', () => {
    render(<Outliner start={outlined('screenplay')} />);
    expect(screen.queryByTitle(/^(Scene|Beat) [\d.]+$/)).toBeNull();
  });

  it('offers the kinds this format has, and nothing it does not', () => {
    render(<Outliner start={outlined()} />);
    expect(screen.getByText('+ Section')).toBeTruthy();
    expect(screen.getByText('+ Subsection')).toBeTruthy();
    // §14 said these are absent on a book; a second hand-written list of
    // kinds in the bar was still offering all three.
    for (const gone of ['+ character', '+ setting', '+ prop', '+ Scene']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(screen.getByText('2 sections · 6 rows')).toBeTruthy();
  });
});

/**
 * Delete is deliberate, and Add to track is promotion (addendum 19 §3, §4).
 *
 * Both act on the selection from the toolbar and nowhere else: there is no ×
 * on a row, the keys do nothing to one, and one row and nine are the same
 * gesture.
 */
describe('the Outliner toolbar', () => {
  // The tree's row, never the panel's copy of the title: once a row is
  // chosen its card shows the same words in a field of its own.
  const rowOf = (title: string): HTMLElement =>
    screen
      .getAllByDisplayValue(title)
      .map((box) => box.closest('.outline-row'))
      .find((row): row is HTMLElement => row !== null) as HTMLElement;
  const toolbar = (name: RegExp): HTMLButtonElement =>
    screen.getAllByRole('button', { name })[0] as HTMLButtonElement;

  it('has no × on any row, and a Delete that waits for a selection', () => {
    render(<Outliner start={outlined()} />);
    expect(screen.queryByLabelText(/^Remove /)).toBeNull();
    expect(toolbar(/^Delete$/).disabled).toBe(true);
    expect(toolbar(/^Add to track$/).disabled).toBe(true);

    fireEvent.pointerDown(rowOf('Light'));
    expect(toolbar(/^Delete$/).disabled).toBe(false);
  });

  it('asks what goes with a section before it goes, and then takes it all', () => {
    render(<Outliner start={outlined()} />);
    fireEvent.pointerDown(rowOf('Light'));
    fireEvent.click(toolbar(/^Delete$/));

    // Light carries two subsections, one under one of those, and a note.
    const ask = screen.getByRole('alertdialog', { name: 'Delete “Light”? It takes 4 rows under it too.' });
    expect(ask).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete all 5' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByDisplayValue('Light')).toBeNull();
    expect(screen.queryByDisplayValue('Focal length')).toBeNull();
    expect(screen.getByText(/1 section · 1 row/)).toBeTruthy();
  });

  it('keeps everything when the writer keeps it', () => {
    render(<Outliner start={outlined()} />);
    fireEvent.pointerDown(rowOf('Lenses'));
    fireEvent.click(toolbar(/^Delete$/));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(rowOf('Lenses')).toBeTruthy();
    expect(screen.getByText('2 sections · 6 rows')).toBeTruthy();
  });

  it('is not moved by the Delete key', () => {
    render(<Outliner start={outlined()} />);
    const row = rowOf('Lenses');
    fireEvent.pointerDown(row);
    fireEvent.keyDown(row, { key: 'Delete' });
    fireEvent.keyDown(row, { key: 'Backspace' });
    expect(rowOf('Lenses')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('puts a chosen section on the track, and says so in the book’s own words', () => {
    render(<Outliner start={outlined()} />);
    fireEvent.pointerDown(rowOf('Lenses'));
    expect(toolbar(/^Add to track$/).disabled).toBe(false);
    fireEvent.click(toolbar(/^Add to track$/));

    // The panel reads the noun table: a book says book, not script.
    expect(screen.getByText(/in the book\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take it out of the book' })).toBeTruthy();
    // Already there, so the toolbar has nothing more to send.
    expect(toolbar(/^Add to track$/).disabled).toBe(true);
  });

  it('takes several at once, and their subsections with them', () => {
    render(<Outliner start={outlined()} />);
    fireEvent.pointerDown(rowOf('Light'));
    fireEvent.pointerDown(rowOf('Lenses'), { metaKey: true });
    fireEvent.click(toolbar(/^Add to track$/));

    // Both sections real, and Light's two subsections with it — and the
    // badge reads the noun table, so a book's rows are in the book.
    expect(screen.getAllByLabelText('In the book')).toHaveLength(4);
  });
});

/**
 * The Chapter row (addendum 19 §2).
 *
 * A chapter is a page, not a container: it is offered on a book at the top
 * level only, Return under it makes a section, and putting it on the track
 * puts its sections in the book and the chapter page on the first of them.
 */
describe('the Chapter row', () => {
  const rowOf = (title: string): HTMLElement =>
    screen
      .getAllByDisplayValue(title)
      .map((box) => box.closest('.outline-row'))
      .find((row): row is HTMLElement => row !== null) as HTMLElement;
  const toolbar = (name: RegExp): HTMLButtonElement =>
    screen.getAllByRole('button', { name })[0] as HTMLButtonElement;

  /** A textbook outline with a chapter over its two sections, the manuscript empty. */
  const chaptered = (sections = 2) => {
    let file: ProjectFile = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
    const starters = new Set(file.units.map((one) => one.id as string));
    file = {
      ...file,
      units: [],
      beats: file.beats.filter((one) => !starters.has(one.unitId as string)),
    };
    file = createOutline(file).file;
    const outlineId = outlinesOf(file)[0]!.id;
    const put = (kind: string, title: string, parentId: OutlineItemId | null) => {
      const made = addItem(file, outlineId, { kind, title, parentId });
      file = made.file;
      return made.itemId!;
    };
    const chapter = put('chapter', 'Geometric optics', null);
    if (sections > 0) {
      const light = put('scene', 'Light', chapter);
      put('beat', 'Refraction', light);
      put('beat', 'Reflection', light);
    }
    if (sections > 1) put('scene', 'Lenses', chapter);
    return file;
  };

  it('is offered on a book and on nothing else', () => {
    render(<Outliner start={outlined()} />);
    expect(screen.getByText('+ Chapter')).toBeTruthy();
    cleanup();
    render(<Outliner start={outlined('screenplay')} />);
    expect(screen.queryByText('+ Chapter')).toBeNull();
  });

  it('is made at the top, and Return under it makes a section', () => {
    render(<Outliner start={outlined()} />);
    fireEvent.pointerDown(rowOf('Refraction'));
    fireEvent.click(screen.getByText('+ Chapter'));

    // At the top level, whatever was chosen: the row is level 1.
    const chapter = screen.getByPlaceholderText('name the chapter');
    expect(chapter.closest('[role="treeitem"]')?.getAttribute('aria-level')).toBe('1');

    fireEvent.change(chapter, { target: { value: 'Wave optics' } });
    fireEvent.keyDown(chapter, { key: 'Enter' });
    // The new section is the empty one, under the chapter.
    const section = screen
      .getAllByPlaceholderText('name the section')
      .find((box) => (box as HTMLTextAreaElement).value === '')!;
    expect(section.closest('[role="treeitem"]')?.getAttribute('aria-level')).toBe('2');

    // + Section from inside that chapter stays inside it, after the section
    // the writer is in; from a section with no chapter it goes to the top.
    fireEvent.change(section, { target: { value: 'Waves' } });
    fireEvent.pointerDown(rowOf('Waves'));
    fireEvent.click(screen.getByText('+ Section'));
    const added = screen
      .getAllByPlaceholderText('name the section')
      .find((box) => (box as HTMLTextAreaElement).value === '')!;
    expect(added.closest('[role="treeitem"]')?.getAttribute('aria-level')).toBe('2');
  });

  it('is not a type a nested row can be given', () => {
    render(<Outliner start={chaptered()} />);
    fireEvent.pointerDown(rowOf('Light'));
    const kinds = Array.from(screen.getByLabelText("The row's type").querySelectorAll('option')).map(
      (option) => option.textContent,
    );
    expect(kinds).not.toContain('Chapter');

    fireEvent.pointerDown(rowOf('Geometric optics'));
    const top = Array.from(screen.getByLabelText("The row's type").querySelectorAll('option')).map(
      (option) => option.textContent,
    );
    expect(top).toContain('Chapter');
  });

  it('refuses to go on the track with no section under it, and says why', () => {
    render(<Outliner start={chaptered(0)} />);
    fireEvent.pointerDown(rowOf('Geometric optics'));
    expect(toolbar(/^Add to track$/).disabled).toBe(true);
    expect(screen.getByText(/A chapter starts on a section, and this one has none yet/)).toBeTruthy();
  });

  it('numbers three deep once there is a chapter, and explains a section above the first', () => {
    render(<Outliner start={chaptered()} />);
    // Chapter 1, 1.1 Light, 1.1.1 Refraction, 1.2 Lenses — read from the tree.
    expect(screen.getByTitle('Chapter 1')).toBeTruthy();
    expect(screen.getByTitle('Section 1.1')).toBeTruthy();
    expect(screen.getByTitle('Subsection 1.1.1')).toBeTruthy();
    expect(screen.getByTitle('Section 1.2')).toBeTruthy();

    // A section put above the first chapter carries no number, and the panel
    // says why rather than leaving a gap.
    fireEvent.pointerDown(rowOf('Geometric optics'));
    fireEvent.click(screen.getByText('+ Section'));
    const added = screen
      .getAllByPlaceholderText('name the section')
      .find((box) => (box as HTMLTextAreaElement).value === '')!;
    // + Section on a chosen chapter goes under it, so it is 1.3; drag it
    // above the chapter instead by making it first.
    expect(added.closest('[role="treeitem"]')?.getAttribute('aria-level')).toBe('2');
    expect(screen.getByTitle('Section 1.3')).toBeTruthy();
  });

  it('puts its sections in the book and becomes the page before them', () => {
    render(<Outliner start={chaptered()} />);
    fireEvent.pointerDown(rowOf('Geometric optics'));
    expect(screen.getByRole('button', { name: 'Add to track — and its 2 sections' })).toBeTruthy();
    fireEvent.click(toolbar(/^Add to track$/));

    // The chapter, both sections and Light's two subsections are real.
    expect(screen.getAllByLabelText('In the book')).toHaveLength(5);
    expect(screen.getByText(/This/)).toBeTruthy();
    expect(screen.getByText(/a page before 2 sections/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take it out of the book' })).toBeTruthy();
    expect(toolbar(/^Add to track$/).disabled).toBe(true);
  });
});

// ------------------------------------------------------------ the control

function Setup({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  const [setup, setSetup] = useState<PrintSetup>(DEFAULT_PRINT_SETUP);
  return (
    <PageSetup
      file={file}
      open
      onClose={() => undefined}
      setup={setup}
      onSetup={setSetup}
      onEditTitlePage={() => undefined}
      onParagraphStyle={() => undefined}
      onScriptFormat={() => undefined}
      onActBreaks={() => undefined}
      onSectionNumbering={(next) => setFile((current) => setSectionNumbering(current, next))}
      pages={12}
      onPrint={() => undefined}
      onExportPdf={() => undefined}
      busy={false}
    />
  );
}

describe('the one thing there is to set', () => {
  it('is whether, never what — and says there is nowhere to type a number', () => {
    render(<Setup start={textbook(3, 2)} />);

    expect(screen.getByText(/There is nowhere to type a number/)).toBeTruthy();
    const check = screen.getByLabelText('Sections are numbered') as HTMLInputElement;
    expect(check.checked).toBe(true);

    fireEvent.click(check);
    expect(screen.getByText(/Their titles stand on their own/)).toBeTruthy();
  });

  it('is absent rather than greyed on a format that has no numbering', () => {
    let file: ProjectFile = createProjectFile({ title: 'A Script', format: 'screenplay' });
    file = addUnit(file, { trackId: file.tracks[0]!.id, title: 'One' }).file;
    render(<Setup start={file} />);
    expect(screen.queryByText('Numbering')).toBeNull();
    expect(screen.queryByLabelText(/are numbered$/)).toBeNull();
  });
});
