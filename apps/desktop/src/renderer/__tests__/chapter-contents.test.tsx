// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addMarker,
  addUnit,
  chapterPageStyleOf,
  createProjectFile,
  updateUnit,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { ChapterPageDialog } from '../components/ChapterPageDialog';

/**
 * **A chapter opening that says what is in the chapter** (addendum 36, from
 * Ken: *for each chapter a title page that allows you to outline what's in
 * the chapter and add text such as what you'll be covering*).
 *
 * What is pinned here is the **gesture** rather than the control (addendum 20
 * §15a): a writer who opens *File ▸ Chapter page…* on a textbook must be able
 * to find the switch, and the sheet beside it must then show what the book
 * will print. A list that works and cannot be reached from that dialog reads
 * exactly like the feature never having been built.
 */

afterEach(cleanup);

/** A book with one chapter over three named sections. */
const book = (format: ProjectFormat = 'instructional'): ProjectFile => {
  let file = createProjectFile({ title: 'Mathematics', format });
  const trackId = file.tracks[0]!.id;
  file = updateUnit(file, file.units[0]!.id, { title: 'What light is' });
  for (const title of ['Reflection', 'Refraction']) {
    file = addUnit(file, { trackId, title }).file;
  }
  return addMarker(file, { unitId: file.units[0]!.id, kind: 'chapter', title: 'Light' }).file;
};

function Harness({ start, onFile }: { start: ProjectFile; onFile?(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile?.(file);
  return (
    <ChapterPageDialog
      file={file}
      open
      onClose={() => undefined}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
    />
  );
}

describe('the way in', () => {
  it('stands on the chapter page dialog, saying what it would list', () => {
    render(<Harness start={book()} />);
    const tick = screen.getByRole('checkbox', { name: /List what each chapter covers/i });
    expect(tick).toBeTruthy();
    // Named rather than counted: *lists 3 sections* says nothing about
    // whether they are the three the writer meant.
    expect(screen.getByText(/1\.1 What light is/)).toBeTruthy();
    expect(screen.getByText(/1\.3 Refraction/)).toBeTruthy();
  });

  it('stands among what the page says rather than among the type', () => {
    // Driven first, it sat at y = 2104 in a dialog 2,662 px tall — behind a
    // scroll nothing announces, which is §15c's and §7b's own fault. The
    // controls run in the order the page prints: the number, the name, the
    // epigraph, the summary, then this.
    render(<Harness start={book()} />);
    const tick = screen.getByRole('checkbox', { name: /List what each chapter covers/i });
    const type = screen.getByRole('heading', { name: /How every chapter page is set/i });
    const summary = screen.getByLabelText(/^Summary$/i);
    expect(summary.compareDocumentPosition(tick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tick.compareDocumentPosition(type) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is absent where the book does not number its sections, the reason in its place', () => {
    // A novel numbers nothing, so a switch here could only ever do nothing.
    render(<Harness start={book('novel')} />);
    expect(screen.queryByRole('checkbox', { name: /List what each/i })).toBeNull();
  });
});

describe('ticking it', () => {
  it('puts the chapter’s sections on the page beside the control', () => {
    let latest: ProjectFile | null = null;
    render(<Harness start={book()} onFile={(file) => (latest = file)} />);

    // The writer's own path: give the chapter a page, then say what goes on
    // it. Both presses are on this one screen.
    fireEvent.click(screen.getByRole('checkbox', { name: /Open this chapter with a page of its own/i }));

    // Nothing on the sheet before the press: a book already set is laid
    // exactly as it was.
    expect(document.querySelector('.chapter-leaf-contents')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /List what each chapter covers/i }));

    const list = document.querySelector('.chapter-leaf-contents');
    expect(list).toBeTruthy();
    expect(Array.from(list!.querySelectorAll('li')).map((row) => row.textContent)).toEqual([
      '1.1What light is',
      '1.2Reflection',
      '1.3Refraction',
    ]);
    expect(chapterPageStyleOf(latest as unknown as ProjectFile).showContents).toBe(true);
  });

  it('heads the list, in the format’s own words until the writer types theirs', () => {
    render(<Harness start={book()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Open this chapter with a page of its own/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /List what each chapter covers/i }));

    expect(document.querySelector('.chapter-leaf-contents-head')?.textContent).toBe('In this chapter');

    // The box is empty and says so in its placeholder, rather than handing
    // the default back as though somebody had typed it (§16e).
    const box = screen.getByLabelText(/The words over the list/i) as HTMLInputElement;
    expect(box.value).toBe('');
    expect(box.placeholder).toBe('In this chapter');

    fireEvent.change(box, { target: { value: 'What you will cover' } });
    expect(document.querySelector('.chapter-leaf-contents-head')?.textContent).toBe('What you will cover');
  });

  it('gives the list its own type, a contents line being a line of type', () => {
    render(<Harness start={book()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /List what each chapter covers/i }));
    // The controls appear with the list and not before it: a size for
    // something the book does not print is a control that lies.
    expect(screen.getByLabelText(/The contents size/i)).toBeTruthy();
  });
});
