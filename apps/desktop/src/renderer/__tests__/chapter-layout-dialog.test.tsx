// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  CHAPTER_LAYOUTS,
  addBeat,
  addMarker,
  addUnit,
  chapterLayoutOf,
  chapterPageStyleOf,
  createProjectFile,
  firstLineOf,
  markerNumbering,
  updateBeat,
  type ProjectFile,
} from '@vcwriter/domain';

import { ChapterLayoutDialog } from '../components/ChapterLayoutDialog';

// jsdom has no modal dialog, so the two calls the component makes are stubbed
// here rather than the component learning about the test.
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

/**
 * The chapter opening layout dialog (addendum 20 §14, from Ken's handoff).
 *
 * What these pin is the part a screenshot cannot: that **every control writes
 * a field that already existed**, so there is no second answer about what the
 * page says, and that a layout is chosen from the same list the print walks.
 */

const book = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  const first = file.units[0]!;
  file = addMarker(file, { unitId: first.id, kind: 'chapter', title: 'The Road' }).file;
  file = updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        { id: 'p1' as never, type: 'paragraph', text: 'The rain had not let up for three days.', characterId: null, attributes: {} },
      ],
    },
  });
  const two = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Second' });
  file = addBeat(two.file, { unitId: two.unit.id, title: 'b' }).file;
  return addMarker(file, { unitId: two.unit.id, kind: 'chapter', title: 'The Lane' }).file;
};

function Harness({ start, onFile }: { start: ProjectFile; onFile?: (file: ProjectFile) => void }) {
  const [file, setFile] = useState(start);
  return (
    <ChapterLayoutDialog
      file={file}
      open
      onClose={() => undefined}
      onUpdate={(change) =>
        setFile((current) => {
          const next = change(current);
          onFile?.(next);
          return next;
        })
      }
    />
  );
}

describe('the chapter opening layout', () => {
  it('offers every layout, from the same list the print walks', () => {
    render(<Harness start={book()} />);
    for (const layout of CHAPTER_LAYOUTS) {
      expect(screen.getByRole('button', { name: layout.name })).toBeTruthy();
    }
  });

  it('gives this chapter the layout that was picked', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book()} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Flush left' }));
    const file = seen as unknown as ProjectFile;
    expect(chapterLayoutOf(file, file.markers[0]!)).toBe('left');
    // And only this one: the other chapter still follows the book.
    expect(chapterLayoutOf(file, file.markers[1]!)).toBe('mid');
  });

  it('writes the book’s own numbering rather than a second field beside it', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book()} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('button', { name: 'IV' }));
    expect(markerNumbering(seen as unknown as ProjectFile)).toBe('roman');
  });

  it('writes the sink as inches, and lights the step that matches', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book()} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deep' }));
    const file = seen as unknown as ProjectFile;
    // Stored as a depth, not as a word: the word is read back from it.
    expect(chapterPageStyleOf(file).dropInches).toBeGreaterThan(1.5);
    expect(screen.getByRole('button', { name: 'Deep' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('sets the first line for the whole book, and says so', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book()} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Drop cap' }));
    expect(firstLineOf(seen as unknown as ProjectFile)).toBe('drop_cap');
    expect(screen.getByText(/whole book’s, so every chapter opens the same way/i)).toBeTruthy();
  });

  it('draws the chapter’s own first words under the opening, with the cut the print takes', () => {
    render(<Harness start={book()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Drop cap' }));
    const sheet = document.querySelector('.chl-sheet') as HTMLElement;
    // The writer's real prose, so the preview is a preview rather than a
    // picture — and the cap is the letter the book will set.
    expect(within(sheet).getByText(/rain had not let up/)).toBeTruthy();
    expect(sheet.querySelector('.chl-drop-cap')?.textContent).toBe('T');
  });

  it('hides the title control on a layout that shows the number only', () => {
    render(<Harness start={book()} />);
    expect(screen.getByLabelText('Chapter title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Numeral only' }));
    expect(screen.queryByLabelText('Chapter title')).toBeNull();
    expect(screen.getByText('This layout shows the number only.')).toBeTruthy();
  });

  it('says a layout has no graphic rather than offering sizes that do nothing', () => {
    render(<Harness start={book()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Classic sink' }));
    expect(screen.getByText(/This layout has no graphic/)).toBeTruthy();
    expect(screen.queryByLabelText('Small graphic')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Graphic above' }));
    expect(screen.getByLabelText('Small graphic')).toBeTruthy();
  });

  it('asks before setting every opening, where a chapter is set on its own', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book()} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('button', { name: 'With epigraph' }));
    fireEvent.click(screen.getByRole('button', { name: /^Every chapter opening$/ }));
    expect(screen.getByText(/1 chapter is set on their own|One chapter is set on their own/i)).toBeTruthy();
    // Picking another layout asks rather than clearing it silently.
    fireEvent.click(screen.getByRole('button', { name: 'Classic sink' }));
    expect(screen.getByRole('button', { name: 'Set every opening' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set every opening' }));
    const file = seen as unknown as ProjectFile;
    expect(chapterLayoutOf(file, file.markers[0]!)).toBe('classic');
    expect(chapterLayoutOf(file, file.markers[1]!)).toBe('classic');
  });
});
