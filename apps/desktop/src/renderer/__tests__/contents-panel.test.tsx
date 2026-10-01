// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addMarker,
  addResearchItem,
  addUnit,
  createProjectFile,
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
  onOpenOutliner,
}: {
  start: ProjectFile;
  dragging?: { kind: 'item' | 'folder' | 'capture'; id: string } | null;
  onFile?(file: ProjectFile): void;
  /** The way through to where chapters are made (addendum 28 §4b). */
  onOpenOutliner?(): void;
}) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return (
    <ContentsPanel
      file={file}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      dragging={dragging}
      onDragEnd={() => undefined}
      {...(onOpenOutliner ? { onOpenOutliner } : {})}
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
   * Updated rather than worked around (addendum 28 §4b): it spelled the old
   * sentence out, and the sentence changed because it was **denying what the
   * boxes showed** — *No chapters yet* over a box. What it must still do is
   * say the book has no chapters and where they are made; what it may no
   * longer do is pretend the screen is empty.
   */
  it('says there are no chapters yet, and where they are made', () => {
    const bare = createProjectFile({ title: 'Nothing yet', format: 'instructional' });
    const went = vi.fn();
    render(<Panel start={bare} onOpenOutliner={went} />);
    expect(screen.getByText(/no chapters yet/i)).toBeTruthy();
    // And the way there is a control rather than a word in a sentence.
    const door = screen.getByRole('button', { name: 'Open the Outliner' });
    fireEvent.click(door);
    expect(went).toHaveBeenCalled();
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
