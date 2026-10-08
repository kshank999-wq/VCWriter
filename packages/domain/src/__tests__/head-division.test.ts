import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  setBookSettings,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **The division in force along the top** (addendum 20 §9y, from Ken: *at the
 * top right-hand pages, it's supposed to be story title, and it says
 * contents*).
 *
 * Measured on his own collection before a line was written: the recto is set
 * to *The story’s title* and the contents page prints **Contents**, because
 * the part's own name sat in the slot the division's title is read from — one
 * field carrying two facts. The story's pages were right throughout, which is
 * why it showed on one page and read as the setting not working.
 *
 * A part's page is not in a division, so it carries none: a side set to it
 * prints nothing there rather than something else under its name. That also
 * stops the leak the other way — a part's name, or the last story's, being
 * the title in force on everything after it.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const head = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'heading' as const,
  text,
  characterId: null,
  attributes: {},
});

/** Ken's book: a collection of stories, a contents page in front, an index behind. */
const collection = (): ProjectFile => {
  let file = createProjectFile({ title: 'Harbour Tales', format: 'short_story', author: 'K. Shank' });
  const track = file.tracks[0]!.id;
  const story = (title: string, chapters: string[]) => {
    const ids: string[] = [];
    for (const chapter of chapters) {
      const made = addUnit(file, { trackId: track, title: chapter });
      file = made.file;
      ids.push(made.unit.id as string);
      const beat = addBeat(file, { unitId: made.unit.id, title: `${title} ${chapter}` });
      file = updateBeat(beat.file, beat.beat.id, {
        manuscript: {
          elements: [head(chapter), ...[1, 2, 3].map((n) => para(`${title} ${chapter} para ${n}. ${'word '.repeat(70)}`))],
        } as never,
      });
    }
    file = addMarker(file, { kind: 'chapter', unitId: ids[0] as never, title }).file;
  };
  story('The Harbour', ['I.', 'II.']);
  story('In For A Pound', ['I.']);
  file = addPart(file, 'foreword', { title: 'Foreword', text: `${'word '.repeat(400)}` }).file;
  return setBookSettings(file, {
    runningHeads: { verso: 'title', recto: 'chapter', versoText: '', rectoText: '', place: 'centre' },
  });
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

describe('what the top of a page says it is in', () => {
  it('prints no division title on a page of the front matter, where there is no division', () => {
    // Ken's own report: the contents page printed *Contents* under a control
    // reading *The story’s title*.
    const { laid, rows } = lay(collection());
    const parts = laid.pages.filter((page) => {
      const row = rows.find((one) => one.sheet === page.sheet);
      return row?.partId !== null && row !== undefined;
    });
    expect(parts.length).toBeGreaterThan(3);
    for (const page of parts) {
      expect(page.chapterTitle).toBe('');
      expect(page.runningHead).not.toBe('Contents');
      expect(page.runningHead).not.toBe('Foreword');
    }
  });

  it('prints each story’s own title on the story’s pages, which was already right', () => {
    const { laid, rows } = lay(collection());
    const story = laid.pages.filter((page) => {
      const row = rows.find((one) => one.sheet === page.sheet);
      return row?.markerId !== null && row !== undefined && !page.blank && !page.display && !page.opens;
    });
    const inForce = new Set(story.map((page) => page.chapterTitle));
    expect(inForce.has('The Harbour')).toBe(true);
    expect(inForce.has('In For A Pound')).toBe(true);
    // And a recto head carries whichever story its own page is in.
    for (const page of story.filter((one) => one.side === 'recto')) {
      expect(page.runningHead).toBe(page.chapterTitle);
      expect(page.runningHead).not.toBe('');
    }
    // The verso carries the book, which is the other half of §7c's pair.
    for (const page of story.filter((one) => one.side === 'verso')) expect(page.runningHead).toBe('Harbour Tales');
  });

  it('never lets a part’s name become the title in force for what follows it', () => {
    // The leak is how *Contents* could reach a page of the story at all: a
    // block with no title of its own leaves the last one standing.
    const { laid } = lay(collection());
    for (const page of laid.pages) {
      expect(page.chapterTitle).not.toBe('Contents');
      expect(page.chapterTitle).not.toBe('Foreword');
      expect(page.chapterTitle).not.toBe('Index');
    }
  });

  it('leaves the words the writer typed alone, a page of a part included', () => {
    // *Words of your own* is not read off the book, so it is the one content
    // a part's page still carries — the writer said exactly what to print.
    let file = collection();
    file = setBookSettings(file, {
      runningHeads: { verso: 'title', recto: 'custom', versoText: '', rectoText: 'Harbour Tales', place: 'centre' },
    });
    const { laid, rows } = lay(file);
    const part = laid.pages.find((page) => {
      const row = rows.find((one) => one.sheet === page.sheet);
      return row?.partId !== null && row !== undefined && !page.blank && !page.display && !page.opens && page.side === 'recto';
    });
    expect(part?.runningHead).toBe('Harbour Tales');
  });
});
