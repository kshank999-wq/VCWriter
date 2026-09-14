// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addMarker,
  addUnit,
  chapterPageStyleOf,
  createProjectFile,
  moveUnit,
  unitsInStoryOrder,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { ChapterPageDialog } from '../components/ChapterPageDialog';
import { menusFor } from '../menus';

/**
 * The chapter page, from File → Chapter page (addendum 02 §12a).
 *
 * The typography itself is tested in the domain. What these cover is the split
 * a writer meets: **the look is the book's and the words are the chapter's**,
 * and **there is nowhere to type a number** — the list shows the one each
 * chapter would print, worked out from where it falls.
 */

afterEach(cleanup);

const book = (chapters: string[], format: ProjectFormat = 'novel') => {
  let file: ProjectFile = createProjectFile({ title: 'The Drowned Bell', format });
  const laneId = file.lanes[0]!.id;
  for (const name of chapters) {
    const scene = addUnit(file, { laneId, title: name });
    file = addMarker(scene.file, { unitId: scene.unit.id, kind: 'chapter', title: name }).file;
  }
  return file;
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
  it('is under File, and only where a book has leaves between its chapters', () => {
    const commands = (format: ProjectFormat | null) =>
      menusFor(format).flatMap((menu) => menu.items.filter(Boolean).map((item) => item!.command));

    expect(commands('novel')).toContain('file.chapterPage');
    expect(commands('short_story')).toContain('file.chapterPage');
    expect(commands('series')).toContain('file.chapterPage');
    expect(commands('screenplay')).not.toContain('file.chapterPage');
  });

  it('sits beside the title page, being the same kind of thing', () => {
    const file = menusFor('novel').find((menu) => menu.id === 'file')!;
    const items = file.items.filter(Boolean).map((item) => item!.command);
    expect(items[items.indexOf('file.titlePage') + 1]).toBe('file.chapterPage');
  });
});

describe('the chapter list', () => {
  it('shows the number each one would print, worked out rather than typed', () => {
    render(<Harness start={book(['The Lamp', 'The Wreck', 'Dr Hale'])} />);
    const list = within(screen.getByLabelText('Chapters'));

    expect(list.getByText('Chapter 1')).toBeTruthy();
    expect(list.getByText('Chapter 3')).toBeTruthy();
    // There is nowhere to type one, which is the point.
    expect(screen.queryByLabelText(/chapter number/i)).toBeNull();
  });

  it('renumbers when the story is reordered', () => {
    const start = book(['The Lamp', 'The Wreck', 'Dr Hale']);
    const last = unitsInStoryOrder(start).at(-1)!;
    const moved = moveUnit(start, { unitId: last.id, toLaneId: last.laneId, index: 0 });
    render(<Harness start={moved} />);

    const rows = screen.getAllByRole('button').filter((node) => node.className.includes('chapter-page-pick'));
    expect(rows[0]!.textContent).toContain('Chapter 1');
    expect(rows[0]!.textContent).toContain('Dr Hale');
  });

  it('gives every chapter a page in one act', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book(['One', 'Two', 'Three'])} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByText('Give every chapter a page'));

    expect((seen as unknown as ProjectFile).markers.every((marker) => marker.page.include)).toBe(true);
  });
});

describe('what belongs to the chapter and what belongs to the book', () => {
  it('names one chapter without touching another', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book(['One', 'Two'])} onFile={(file) => (seen = file)} />);
    fireEvent.change(screen.getByLabelText('Chapter name'), { target: { value: 'The Drowned Bell' } });

    const named = (seen as unknown as ProjectFile).markers;
    expect(named.map((marker) => marker.title)).toEqual(['The Drowned Bell', 'Two']);
  });

  it('sets the type once, for the whole book', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book(['One', 'Two'])} onFile={(file) => (seen = file)} />);
    fireEvent.change(screen.getByLabelText('Face'), { target: { value: 'serif' } });
    fireEvent.change(screen.getByLabelText('The name size'), { target: { value: '24' } });
    fireEvent.click(screen.getByLabelText('The name italic'));

    const style = chapterPageStyleOf(seen as unknown as ProjectFile);
    expect(style.face).toBe('serif');
    expect(style.title.size).toBe(24);
    expect(style.title.italic).toBe(true);
    // Nowhere to disagree with it chapter by chapter.
    expect(screen.queryByText(/this chapter’s face/i)).toBeNull();
  });

  it('draws the sheet in the book’s own type', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book(['One'])} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByText('Give every chapter a page'));
    fireEvent.change(screen.getByLabelText('The name case'), { target: { value: 'small_caps' } });

    const sheet = within(screen.getByLabelText('The page'));
    const block = sheet.getByText('Chapter 1').closest('.chapter-leaf-block') as HTMLElement;
    // The same custom properties the printed page carries.
    expect(block.style.getPropertyValue('--chapter-title-variant')).toBe('small-caps');
    expect(chapterPageStyleOf(seen as unknown as ProjectFile).title.case).toBe('small_caps');
  });

  it('says where the number comes from rather than leaving it to be hunted for', () => {
    render(<Harness start={book(['One'])} />);
    expect(screen.getByText(/worked out from where the chapter falls/i)).toBeTruthy();
  });
});

describe('a book with no chapters yet', () => {
  it('says so rather than drawing an empty form', () => {
    render(<Harness start={createProjectFile({ title: 'Untitled', format: 'novel' })} />);
    expect(screen.getByText(/no chapters yet/i)).toBeTruthy();
  });
});
