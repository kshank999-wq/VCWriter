// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  addBeat,
  addGraphic,
  addMarker,
  addUnit,
  chapterPageStyleOf,
  createProjectFile,
  moveUnit,
  newId,
  unitsInStoryOrder,
  updateBeat,
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
  const trackId = file.tracks[0]!.id;
  for (const name of chapters) {
    const scene = addUnit(file, { trackId, title: name });
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
    const moved = moveUnit(start, { unitId: last.id, toTrackId: last.trackId, index: 0 });
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

/**
 * The chapter page for a book (addendum 19 §7): a summary, three templates as
 * a book setting with a per-chapter override, and a picture from the library.
 */
describe('the chapter page for a book', () => {
  const textbook = () => {
    let file = book(['Geometric optics', 'Wave optics'], 'instructional');
    file = addGraphic(file, { name: 'Snell’s law', data: 'data:image/png;base64,AAAA', width: 10, height: 10 }).file;
    return file;
  };

  it('has a summary box, and a novel does not', () => {
    render(<Harness start={textbook()} />);
    expect(screen.getByLabelText('Summary')).toBeTruthy();
    cleanup();
    render(<Harness start={book(['One'])} />);
    expect(screen.queryByLabelText('Summary')).toBeNull();
  });

  it('sets the template once for the book, and lets one chapter differ', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={textbook()} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByText('Give every chapter a page'));

    // Four tiles; the book's is the middle until chosen otherwise.
    const tiles = within(screen.getByRole('radiogroup', { name: 'Template' })).getAllByRole('radio');
    expect(tiles).toHaveLength(4);
    expect(tiles[1]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(tiles[0]!);
    expect(chapterPageStyleOf(seen as unknown as ProjectFile).template).toBe('graphic_top');

    // This chapter alone, at the foot; the other still follows the book.
    fireEvent.change(screen.getByLabelText('This chapter’s template'), { target: { value: 'graphic_bottom' } });
    const markers = (seen as unknown as ProjectFile).markers;
    expect(markers.map((marker) => marker.page.template)).toEqual(['graphic_bottom', 'book']);
    expect(screen.getByText(/This chapter has its own — graphic at the bottom/)).toBeTruthy();
  });

  it('takes the picture from the library and draws it on the sheet', () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={textbook()} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByText('Give every chapter a page'));
    const library = screen.getByLabelText('Graphic from the library') as HTMLSelectElement;
    const asset = (seen as unknown as ProjectFile).assets![0]!;
    fireEvent.change(library, { target: { value: asset.id as string } });

    const sheet = within(screen.getByLabelText('The page'));
    expect(sheet.getByRole('img').getAttribute('src')).toBe(asset.data);
    // The width is the page's own; the picture stays one picture in the file.
    expect((seen as unknown as ProjectFile).markers[0]!.page.assetId).toBe(asset.id);
    expect((seen as unknown as ProjectFile).markers[0]!.page.image).toBeNull();
  });
});

/**
 * Import full page art (addendum 19 §7, from Ken): the page made elsewhere
 * as a piece of art, brought in whole, and the chapter's template says so
 * in the same act.
 */
describe('full page art', () => {
  const pick = (name: string) => {
    const picker = screen.getByLabelText('Full page art file') as HTMLInputElement;
    const art = new File(['PNG bytes'], name, { type: 'image/png' });
    Object.defineProperty(picker, 'files', { value: [art], configurable: true });
    fireEvent.change(picker);
  };

  it('fills the page on a novel, and says the template is now the art', async () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book(['One', 'Two'])} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByText('Give every chapter a page'));
    fireEvent.click(screen.getByRole('button', { name: 'Import full page art…' }));
    pick('one-painted.png');
    await waitFor(() => expect((seen as unknown as ProjectFile).markers[0]!.page.template).toBe('full_page'));
    const page = (seen as unknown as ProjectFile).markers[0]!.page;
    expect(page.image?.name).toBe('one-painted.png');
    expect(page.image?.width).toBe(100);
    expect(page.image?.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    // The other chapter still follows the book.
    expect((seen as unknown as ProjectFile).markers[1]!.page.template).toBe('book');
    // The sheet draws the art and nothing else.
    const sheet = within(screen.getByLabelText('The page'));
    expect(sheet.getByRole('img').className).toBe('chapter-leaf-art');
    expect(sheet.queryByText('One')).toBeNull();
    expect(screen.getByText(/This page is its art, edge to edge/)).toBeTruthy();
  });

  it('puts the art in the library on a book, where every picture lives', async () => {
    let seen: ProjectFile | null = null;
    render(<Harness start={book(['Geometric optics'], 'instructional')} onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByText('Give every chapter a page'));
    pick('optics-plate.png');
    await waitFor(() => expect((seen as unknown as ProjectFile).markers[0]!.page.template).toBe('full_page'));
    const file = seen as unknown as ProjectFile;
    expect(file.assets).toHaveLength(1);
    expect(file.assets![0]!.name).toBe('optics-plate.png');
    expect(file.markers[0]!.page.assetId).toBe(file.assets![0]!.id);
    expect(file.markers[0]!.page.image).toBeNull();
  });
});

/**
 * A suggested chapter summary (addendum 19 §7), through the bridge: what
 * comes back is recorded where it cannot reach the author's words.
 */
describe('a suggested summary', () => {
  const bridge = (over: Partial<Record<string, unknown>> = {}) => {
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      learningAidStatus: async () => ({ ok: true, data: { available: true, reason: null } }),
      suggestLearningAid: async () => ({ ok: true, data: { text: 'Light, bent and focused.', questions: [] } }),
      ...over,
    };
  };
  afterEach(() => {
    delete (window as unknown as { vcwriter?: unknown }).vcwriter;
  });

  /** A textbook whose first chapter has a paragraph under it and the second nothing. */
  const written = () => {
    let file = book(['Geometric optics', 'Wave optics'], 'instructional');
    // The chapter's own unit, not the starter section that precedes the
    // first chapter and belongs to no chapter at all.
    const first = unitsInStoryOrder(file).find((unit) => unit.title === 'Geometric optics')!;
    const beat = addBeat(file, { unitId: first.id, title: 'Light' });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: {
        elements: [{ id: newId(), type: 'paragraph', text: 'Light travels in straight lines.', characterId: null, attributes: {} }],
      },
    });
    return file;
  };

  it('is not offered where the account cannot have one, and says why once', async () => {
    bridge({
      learningAidStatus: async () => ({ ok: true, data: { available: false, reason: 'Sign in to have a suggestion written' } }),
    });
    render(<Harness start={written()} />);
    await waitFor(() => expect(screen.getByText('Sign in to have a suggestion written')).toBeTruthy());
    expect(screen.queryByText(/Suggest a summary/)).toBeNull();
  });

  it('refuses a chapter with nothing under it, as the chapter’s own reason', async () => {
    bridge();
    render(<Harness start={written()} />);
    await waitFor(() => expect(screen.getByText('Suggest a summary')).toBeTruthy());
    fireEvent.click(screen.getByText('Wave optics'));
    const button = screen.getByText('Suggest a summary') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/nothing to summarise/)).toBeTruthy();
  });

  it('puts what comes back in the suggestion and never in the summary, until accepted', async () => {
    let seen: ProjectFile | null = null;
    bridge();
    render(<Harness start={written()} onFile={(file) => (seen = file)} />);
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'What the author wrote.' } });
    await waitFor(() => expect(screen.getByText('Suggest another summary')).toBeTruthy());
    fireEvent.click(screen.getByText('Suggest another summary'));

    await waitFor(() => {
      const page = (seen as unknown as ProjectFile).markers[0]!.page;
      expect(page.suggestedSummary).toBe('Light, bent and focused.');
      expect(page.summary).toBe('What the author wrote.');
    });

    // Accepting is the explicit act, and it hands the old wording back.
    fireEvent.click(screen.getByText('Use this'));
    expect((seen as unknown as ProjectFile).markers[0]!.page.summary).toBe('Light, bent and focused.');
    fireEvent.click(screen.getByText('Put it back'));
    expect((seen as unknown as ProjectFile).markers[0]!.page.summary).toBe('What the author wrote.');
  });
});

describe('a book with no chapters yet', () => {
  it('says so rather than drawing an empty form', () => {
    render(<Harness start={createProjectFile({ title: 'Untitled', format: 'novel' })} />);
    expect(screen.getByText(/no chapters yet/i)).toBeTruthy();
  });
});
