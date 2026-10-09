// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addGraphic,
  addMarker,
  addUnit,
  bookBlocks,
  bookNames,
  bookSettingsOf,
  chapterPageStyleOf,
  createProjectFile,
  geometryOf,
  placeBookFigure,
  placeFigure,
  titlePageOf,
  updateBeat,
  type BeatId,
  type ProjectFile,
} from '@vcwriter/domain';
import { measureBlocks } from '../book-typeset';

/**
 * **What goes into the measure box** (addendum 20 §9ai, from Ken: *it keeps
 * crashing when I try to enter the ISBN in the copyright dialogue box*).
 *
 * Every change to the book re-lays it, and laying it is
 * `box.innerHTML = every block of it`. A picture's lines have never come from
 * that box — a page of art measures as a whole page and a figure measures
 * through `pictureLines` — and the bytes went in anyway, so a book with art in
 * it wrote megabytes of base64 per keystroke to be decoded and thrown away.
 * Measured on a hundred-page novel with three 4 MB illustrations: **16.10 MB
 * of markup against 0.07, 159 ms a laying against 7**, with every measurement
 * identical.
 *
 * A test's document has no layout, so what is pinned here is what is
 * **written** rather than what comes back — which is the half that can go
 * wrong, since a picture put back into the box reads exactly like this fix
 * never having been made.
 */

const data = (bytes: number) => `data:image/png;base64,${'A'.repeat(bytes)}`;
const DATA = data(4096);

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A novel with one picture in it, placed however the caller asks. */
const bookWithPicture = (place: 'page' | 'left', bytes = 4096): { file: ProjectFile; figureId: string } => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' });
  const track = file.tracks[0]!.id;
  const made = addUnit(file, { trackId: track, title: 'The Road' });
  file = made.file;
  const beat = addBeat(file, { unitId: made.unit.id, title: 'The Road' });
  file = updatedBeat(beat.file, beat.beat.id);
  file = addMarker(file, { kind: 'chapter', unitId: made.unit.id as never, title: 'The Road' }).file;
  const added = addGraphic(file, { name: 'plate.png', data: data(bytes), width: 1000, height: 1400 });
  const holder = added.file.beats.find((one) => one.manuscript.elements.length > 0)!;
  const placed = placeFigure(added.file, {
    beatId: holder.id as BeatId,
    assetId: added.asset.id,
    beforeElementId: holder.manuscript.elements[0]!.id as never,
    attributes: { bookPlace: place === 'page' ? 'page' : 'left' },
  });
  const figureId = placed.elementId as string;
  return {
    file: place === 'page' ? placed.file : placeBookFigure(placed.file, figureId, { place: 'left', span: 0.4 }),
    figureId,
  };
};

const updatedBeat = (file: ProjectFile, beatId: string): ProjectFile =>
  updateBeat(file, beatId as BeatId, {
    manuscript: { elements: [1, 2, 3, 4].map((n) => para(`Paragraph ${n}. ${'word '.repeat(40)}`)) } as never,
  });

/** Measure, catching every string the box is handed. */
const written = (file: ProjectFile): string => {
  const blocks = bookBlocks(file);
  const settings = bookSettingsOf(file);
  const box = document.createElement('div');
  const held: string[] = [];
  Object.defineProperty(box, 'innerHTML', {
    configurable: true,
    get: () => '',
    set: (value: string) => {
      if (value) held.push(value);
    },
  });
  measureBlocks(box, blocks, {
    settings,
    geometry: geometryOf(settings, file.project.format, 40),
    chapterStyle: chapterPageStyleOf(file),
    paragraphStyle: 'indented',
    pictures: new Map(
      (file.assets ?? []).map((asset) => [
        asset.id as string,
        { data: asset.data, altText: asset.altText, width: asset.width, height: asset.height },
      ]),
    ),
    names: bookNames(file),
    titlePage: titlePageOf(file.project, file.settings),
    contents: [],
    index: null,
  });
  return held.join('');
};

describe('the measure box', () => {
  it('leaves a page of art out of the measurement, which never looked at it', () => {
    const { file } = bookWithPicture('page');
    const markup = written(file);
    // The item is there — the blocks and the items are read side by side —
    // and nothing is in it, the box never having been read for a page.
    expect(markup).toContain('class="bk-item"');
    expect(markup).not.toContain('bk-plate-art');
    expect(markup).not.toContain(DATA);
    // The whole of it: what is written does not grow with the picture, so a
    // book of plates costs the measurement no more than a book of none.
    expect(written(bookWithPicture('page', 400_000).file).length).toBe(markup.length);
  });

  it('keeps a cut-in picture, whose reach really is read off the box', () => {
    const { file } = bookWithPicture('left');
    expect(written(file)).toContain(DATA);
  });
});
