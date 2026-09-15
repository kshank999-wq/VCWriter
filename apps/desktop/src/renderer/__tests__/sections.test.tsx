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
  const laneId = file.lanes[0]!.id;
  for (let at = 0; at < sections; at += 1) {
    const unit = addUnit(file, { laneId, title: `Section ${at + 1}` });
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
    const moved = moveUnit(file, { unitId: third.id, toLaneId: third.laneId, index: 0 });
    render(<Book start={moved} />);

    const numbers = screen.getAllByTitle('Section number, worked out from where it falls');
    expect(numbers.map((one) => one.textContent)).toEqual(['1', '2', '3']);
    // …and the one that moved is now the first, carrying 1.1 under it.
    expect(screen.getAllByTitle('Subsection number, worked out from where it falls')[0]!.textContent).toBe('1.1');
  });

  it('numbers nothing on a screenplay', () => {
    let file: ProjectFile = createProjectFile({ title: 'A Script', format: 'screenplay' });
    file = addUnit(file, { laneId: file.lanes[0]!.id, title: 'One' }).file;
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
    file = addUnit(file, { laneId: file.lanes[0]!.id, title: 'One' }).file;
    render(<Setup start={file} />);
    expect(screen.queryByText('Numbering')).toBeNull();
    expect(screen.queryByLabelText(/are numbered$/)).toBeNull();
  });
});
