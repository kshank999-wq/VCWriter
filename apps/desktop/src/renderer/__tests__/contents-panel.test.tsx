// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addMarker,
  addItem,
  addResearchItem,
  addUnit,
  createOutline,
  createProjectFile,
  findOutline,
  fileNoteUnder,
  updateUnit,
  type ProjectFile,
  type ProjectFormat,
  type ResearchItemId,
  type StoryMarkerId,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { ContentsPanel } from '../components/ContentsPanel';
import { ResearchWindow } from '../components/ResearchWindow';

/**
 * The table of contents in the research room (addendum 28 §4).
 *
 * The reading is the domain's and tested there. What these cover is what a
 * writer meets: that the room carries it on a book and not on a screenplay,
 * that the chapters read as Ken described them, that a note dropped on a box
 * is filed there, and that the light says which of the three states each note
 * is in — none of which a domain test can see.
 */

afterEach(cleanup);

/** Ken's own example: Chapter 1 Mathematics, 1.1 Division, 1.2 Multiplication. */
const book = (format: ProjectFormat = 'instructional') => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Arithmetic', format });
  const trackId = file.tracks[0]!.id;
  const seeded = file.units[0]!;
  file = updateUnit(file, seeded.id, { title: 'Division' });
  const units: StructuralUnitId[] = [seeded.id];
  for (const title of ['Multiplication', 'Fractions']) {
    const made = addUnit(file, { trackId, title });
    file = made.file;
    units.push(made.unit.id);
  }
  const one = addMarker(file, { unitId: units[0]!, kind: 'chapter', title: 'Mathematics' });
  file = one.file;
  const two = addMarker(file, { unitId: units[2]!, kind: 'chapter', title: 'Numbers' });
  file = two.file;
  return { file, units, chapters: [one.marker.id, two.marker.id] as StoryMarkerId[] };
};

const withNote = (file: ProjectFile, title: string) => {
  const next = addResearchItem(file, { categoryId: file.researchCategories[0]!.id, title });
  return { file: next, id: next.researchItems[next.researchItems.length - 1]!.id as ResearchItemId };
};

function Panel({
  start,
  dragging = null,
  onFile,
}: {
  start: ProjectFile;
  dragging?: { kind: 'item' | 'folder' | 'capture'; id: string } | null;
  onFile?(file: ProjectFile): void;
}) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return (
    <ContentsPanel
      file={file}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      dragging={dragging}
      onDragEnd={() => undefined}
    />
  );
}

describe('the table of contents', () => {
  it('lists the chapters and sections as the book numbers them', () => {
    render(<Panel start={book().file} />);

    // Ken's example, and the numbers are derived rather than typed.
    expect(screen.getByRole('button', { name: /1\. Mathematics/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /1.1 Division/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /1.2 Multiplication/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /2\. Numbers/ })).toBeTruthy();
  });

  /**
   * One row, one spelling of its number. Driving it caught the box drawn `1`
   * standing an inch above a heading reading `1. Mathematics` — two answers to
   * how this chapter is numbered, from two places that each wrote it out.
   */
  it('draws the number as the heading sets it', () => {
    render(<Panel start={book().file} />);
    const chapter = screen.getByRole('button', { name: /1\. Mathematics/ });
    expect(chapter.querySelector('.toc-number')?.textContent).toBe('1.');
    const section = screen.getByRole('button', { name: /1.1 Division/ });
    expect(section.querySelector('.toc-number')?.textContent).toBe('1.1');
  });

  /** It reads the chapters; it does not make them. */
  it('offers no way to add a chapter, and says where they come from', () => {
    render(<Panel start={book().file} />);
    expect(screen.queryByText(/\+ Chapter/)).toBeNull();
    expect(screen.getByText(/The chapters are the Outliner's/)).toBeTruthy();
  });

  /**
   * The sentence may not deny what the boxes show (addendum 28 §3, §4b) — *No
   * chapters yet* standing over a box is two readings of one screen.
   */
  it('says there are no chapters yet, and where they are made', () => {
    const bare = createProjectFile({ title: 'Nothing yet', format: 'instructional' });
    render(<Panel start={bare} />);
    expect(screen.getByText(/no chapters yet/i)).toBeTruthy();
    expect(screen.getAllByText(/Outliner/).length).toBeGreaterThan(0);
  });

  /**
   * **§4b's route is gone** (Ken: *it has a section for the outliner that
   * creates chapter one. We don't need that anymore*). §4c lists the Outliner's
   * rows here instead, so a door out of the room is a worse answer than the
   * boxes being on the screen — and this asserts the door really went, a dead
   * control left beside a feature that replaces it being two answers.
   */
  it('has no door out to the Outliner', () => {
    render(<Panel start={book().file} />);
    expect(screen.queryByRole('button', { name: /Open the Outliner/ })).toBeNull();
  });
});

/**
 * The Outliner's chapters and sections, as boxes (addendum 28 §4c).
 *
 * Ken asked three times, and the reason is here rather than in the domain: the
 * reading was right about the manuscript and the writer plans in the Outliner,
 * so on his book the panel drew nothing he could drop a note on. What these
 * cover is the screen — that a plan is drawn, that it says it is one, and that
 * it takes a drop.
 */
describe('the planned chapters', () => {
  /** A book whose chapters exist only as Outliner rows. */
  const planned = () => {
    let file: ProjectFile = createProjectFile({ title: 'Planned', format: 'instructional' });
    const made = createOutline(file, { name: 'Outline' });
    file = made.file;
    const chapter = addItem(file, made.outline.id, { kind: 'chapter', title: 'Mathematics' });
    file = chapter.file;
    const section = addItem(file, made.outline.id, {
      kind: 'scene',
      parentId: chapter.itemId!,
      title: 'Division',
    });
    return { file: section.file, outlineId: made.outline.id };
  };

  it('draws them in a group of their own, named as plans', () => {
    render(<Panel start={planned().file} />);

    expect(screen.getByText(/Planned in the Outliner/)).toBeTruthy();
    const chapter = screen.getByRole('button', { name: /1\. Mathematics — planned/ });
    expect(chapter.className).toContain('planned');
    expect(screen.getByRole('button', { name: /1.1 Division — planned/ })).toBeTruthy();
  });

  /** The ask: somewhere to drop rough material before it is a chapter. */
  it('takes a note dropped on one', () => {
    const made = planned();
    const put = withNote(made.file, 'Two ways to divide');
    let seen: ProjectFile | null = null;
    render(
      <Panel
        start={put.file}
        dragging={{ kind: 'item', id: put.id as string }}
        onFile={(file) => (seen = file)}
      />,
    );

    fireEvent.drop(screen.getByRole('button', { name: /1.1 Division — planned/ }));

    const filed = (seen as unknown as ProjectFile).researchItems[0]!;
    expect(filed.place?.type).toBe('outline_item');
    expect(screen.getByText(/File “Two ways to divide” under 1.1 Division/)).toBeTruthy();
    // **Nothing in the Outliner moved** — Ken's *not necessarily a connection
    // between the outliner and the research*.
    const after = findOutline(seen as unknown as ProjectFile, made.outlineId)!;
    expect(after.items).toEqual(findOutline(made.file, made.outlineId)!.items);
  });

  /** It says what a drop here does not do, where the material goes. */
  it('says filing here changes nothing in the Outliner', () => {
    render(<Panel start={planned().file} />);
    expect(screen.getByText(/changes nothing in the Outliner/)).toBeTruthy();
  });
});

/**
 * The shelf of what is not placed yet (addendum 28 §4c).
 *
 * **The half that could fail silently.** This panel takes the whole of the
 * room's middle, so while it is showing the note cards are drawn nowhere — the
 * boxes were somewhere to drop with nothing on the screen to drop, which from
 * the writer's chair is the drag not working. A test that supplies `dragging`
 * as a prop cannot see that, which is why the first version had one and this is
 * the one that matters.
 */
describe('what there is to sort', () => {
  it('lists the notes nobody has placed, and files one by a press', () => {
    const made = book();
    const put = withNote(made.file, 'Long division worked example');
    let seen: ProjectFile | null = null;
    render(<Panel start={put.file} onFile={(file) => (seen = file)} />);

    const chip = screen.getByRole('button', { name: 'Long division worked example' });
    expect(chip.getAttribute('draggable')).toBe('true');

    // The press is the only path a keyboard can reach, and it needs a box.
    fireEvent.click(screen.getByRole('button', { name: /1.1 Division/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Long division worked example' }));

    const filed = (seen as unknown as ProjectFile).researchItems[0]!;
    expect(filed.place).toEqual({ type: 'unit', id: made.units[0] });
  });

  /** Absent once everything is placed: the header sentence already says so. */
  it('is absent where there is nothing loose', () => {
    render(<Panel start={book().file} />);
    expect(screen.queryByText(/Not placed yet/)).toBeNull();
  });
});

describe('filing a note on a box', () => {
  it('files it where it was dropped, and says what it did', () => {
    const made = book();
    const put = withNote(made.file, 'Long division worked example');
    let seen: ProjectFile | null = null;
    render(
      <Panel
        start={put.file}
        dragging={{ kind: 'item', id: put.id as string }}
        onFile={(file) => (seen = file)}
      />,
    );

    fireEvent.drop(screen.getByRole('button', { name: /1\. Mathematics/ }));

    const filed = (seen as unknown as ProjectFile).researchItems[0]!;
    expect(filed.place).toEqual({ type: 'story_marker', id: made.chapters[0] });
    // The note keeps the folder it was in: where in the book and which shelf
    // are two questions.
    expect(filed.categoryId).toBe(put.file.researchItems[0]!.categoryId);
    expect(screen.getByText(/File “Long division worked example” under 1. Mathematics/)).toBeTruthy();
  });

  it('refuses a second drop on the same box, in a sentence', () => {
    const made = book();
    const put = withNote(made.file, 'A note');
    const filed = fileNoteUnder(put.file, put.id, { kind: 'chapter', markerId: made.chapters[0]! });

    render(<Panel start={filed} dragging={{ kind: 'item', id: put.id as string }} />);
    fireEvent.drop(screen.getByRole('button', { name: /1\. Mathematics/ }));
    expect(screen.getByText(/already under/)).toBeTruthy();
  });
});

describe('the three lights', () => {
  it('draws placed and in-the-book differently', () => {
    const made = book();
    const planned = withNote(made.file, 'Why remainders confuse students');
    let file = fileNoteUnder(planned.file, planned.id, {
      kind: 'section',
      unitId: made.units[0]!,
    });

    const written = withNote(file, 'Long division worked example');
    file = fileNoteUnder(written.file, written.id, { kind: 'section', unitId: made.units[0]! });
    const beat = addBeat(file, { unitId: made.units[0]!, title: 'Long division' });
    file = {
      ...beat.file,
      researchItems: beat.file.researchItems.map((item) =>
        item.id === written.id ? { ...item, usedInBeatIds: [beat.beat.id] } : item,
      ),
    };

    render(<Panel start={file} />);
    fireEvent.click(screen.getByRole('button', { name: /1.1 Division/ }));

    expect(screen.getByText('Placed')).toBeTruthy();
    expect(screen.getByText('In the book')).toBeTruthy();
  });
});

function Room({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  return (
    <ResearchWindow
      file={file}
      open
      currentBeatId={null}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      onClose={() => undefined}
    />
  );
}

describe('the way in', () => {
  /**
   * The half that can fail silently: a panel nobody can reach reads exactly
   * like a panel nobody built (addendum 20 §15a).
   */
  it('stands at the top of the research menu on a book', () => {
    render(<Room start={book().file} />);
    const entry = screen.getByRole('button', { name: /Table of contents/ });
    expect(entry).toBeTruthy();

    fireEvent.click(entry);
    expect(screen.getByText(/The chapters are the Outliner's/)).toBeTruthy();
  });

  /** Absent rather than greyed: a screenplay has no chapters to file against. */
  it('is absent on a screenplay', () => {
    render(<Room start={book('screenplay').file} />);
    expect(screen.queryByRole('button', { name: /Table of contents/ })).toBeNull();
  });
});

describe("the way through to a chapter's own page", () => {
  /**
   * A route needs a test **per gesture**, not per screen (addendum 20 §15a).
   * The chapter page's own dialog has nine tests of its own and every one of
   * them opens it directly, so none of them can say whether a writer standing
   * in the table of contents can reach it — which is the half that reads as
   * the feature not being built.
   */
  const open = () => {
    render(<Room start={book().file} />);
    fireEvent.click(screen.getByRole('button', { name: /Table of contents/ }));
    return screen.getByRole('button', { name: /1\. Mathematics/ });
  };

  it('opens from the button under a chosen chapter', () => {
    const chapter = open();
    fireEvent.click(chapter);
    fireEvent.click(screen.getByRole('button', { name: /Set this chapter's page/ }));
    expect(screen.getByText(/This chapter’s page/)).toBeTruthy();
  });

  it('opens from a double-click on the box', () => {
    fireEvent.doubleClick(open());
    expect(screen.getByText(/This chapter’s page/)).toBeTruthy();
  });

  /** A section is not a chapter: it has no page and so no way through. */
  it('offers nothing on a section', () => {
    render(<Room start={book().file} />);
    fireEvent.click(screen.getByRole('button', { name: /Table of contents/ }));
    fireEvent.click(screen.getByRole('button', { name: /1.1 Division/ }));
    expect(screen.queryByRole('button', { name: /Set this chapter's page/ })).toBeNull();
  });
});
