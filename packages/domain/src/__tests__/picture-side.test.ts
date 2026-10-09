import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addGraphic,
  addMarker,
  addUnit,
  blankReason,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  pageRemoval,
  pagePlace,
  pictureOffer,
  placeBookFigure,
  placeFigure,
  setBackBlank,
  updateBeat,
  type BeatId,
  type ProjectFile,
} from '../index.js';

/**
 * **Which side of the leaf a picture page falls on** (addendum 22 §9a, from
 * Ken: *at the end of the story, I tried to add a picture on the back of a
 * page. But when I added the picture, it only would add it on the right-hand
 * side of the page. I wanted the picture to be on page 66*).
 *
 * The cause is one line. `leafToItself` — *the writer asked for a blank
 * back* — beat the side outright, so ticking that switch moved the picture to
 * the next right-hand page: **a control about what is behind a page deciding
 * which page it is**, with nothing saying so. And §9j had taken the *Which
 * page* control out, for the good reason that it asked a question the gesture
 * had already answered, so after it there was no way to ask for a verso at
 * all and the tick was the only thing that could move a picture between
 * sides.
 *
 * The back-blank default stays: where a writer has said nothing about the
 * side, a picture that leaves its back blank still takes a recto, so no book
 * made before this moves — which is why the whole suite passed unedited.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  const track = file.tracks[0]!.id;
  for (const title of ['The Road', 'Low Water', 'The Harbour']) {
    const made = addUnit(file, { trackId: track, title });
    file = made.file;
    const beat = addBeat(file, { unitId: made.unit.id, title });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => para(`${title} para ${n}. ${'word '.repeat(60)}`)) } as never,
    });
    file = addMarker(file, { kind: 'chapter', unitId: made.unit.id as never, title }).file;
  }
  return file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

/**
 * Put a picture of its own on a page in the middle of the story, the way the
 * room does it: the offer says where, and `placeFigure` puts it there.
 */
const pictureOn = (file: ProjectFile, sheet: number) => {
  const { blocks, laid, rows } = lay(file);
  const offer = pictureOffer(pagePlace(laid.pages, blocks, sheet), rows, sheet);
  const spot = (offer.pageSpot ?? offer.spot) as string;
  expect(spot).toBeTruthy();
  const beat = file.beats.find((one) => one.manuscript.elements.some((el) => (el.id as string) === spot))!;
  const added = addGraphic(file, { name: 'plate.png', data: 'data:image/png;base64,AAA', width: 800, height: 600 });
  const made = placeFigure(added.file, {
    beatId: beat.id as BeatId,
    assetId: added.asset.id,
    beforeElementId: spot as never,
    attributes: { bookPlace: 'page' },
  });
  expect(made.elementId).toBeTruthy();
  return { file: made.file, figureId: made.elementId as string };
};

/** The page the picture stands on, by sheet — odd is a recto, even a verso. */
const pageOfPicture = (file: ProjectFile, figureId: string): number =>
  lay(file).rows.find((row) => row.figureId === figureId)!.sheet;

/** A page in the middle of a chapter, so nothing else is deciding the side. */
const midStory = (file: ProjectFile): number => {
  const rows = lay(file).rows;
  const found = rows.find((row) => row.says === 'Text' && row.partId === null && row.sheet > 2);
  if (!found) throw new Error(`no plain story page: ${rows.map((r) => `${r.sheet}:${r.says}:${r.partId ?? '-'}`).join(' ')}`);
  return found.sheet;
};

describe('which side of the leaf a picture page takes', () => {
  it('takes whichever page it falls on when nothing is asked for', () => {
    const file = novel();
    const put = pictureOn(file, midStory(file));
    // Nothing is forced: it stands where it stands in the writing.
    expect(pageOfPicture(put.file, put.figureId)).toBeGreaterThan(0);
  });

  it('takes a left-hand page when one is asked for, which is the report', () => {
    const file = novel();
    const put = pictureOn(file, midStory(file));
    const verso = placeBookFigure(put.file, put.figureId, { place: 'page', side: 'verso' });
    expect(pageOfPicture(verso, put.figureId) % 2).toBe(0);
    const recto = placeBookFigure(put.file, put.figureId, { place: 'page', side: 'recto' });
    expect(pageOfPicture(recto, put.figureId) % 2).toBe(1);
  });

  /**
   * **The switch that used to decide it.** A back-blank with no side asked
   * for still takes a recto — the default, so nothing existing moves — and a
   * side asked for is no longer overruled by it.
   */
  it('still takes a right-hand page for a blank back where no side is asked for', () => {
    const file = novel();
    const put = pictureOn(file, midStory(file));
    const backed = setBackBlank(put.file, put.figureId, true);
    expect(pageOfPicture(backed, put.figureId) % 2).toBe(1);
  });

  it('keeps the left-hand page even with a blank back asked for', () => {
    const file = novel();
    const put = pictureOn(file, midStory(file));
    const both = setBackBlank(placeBookFigure(put.file, put.figureId, { place: 'page', side: 'verso' }), put.figureId, true);
    expect(pageOfPicture(both, put.figureId) % 2).toBe(0);
  });
});

describe('where the blank back falls', () => {
  /**
   * **A leaf is a recto and the verso behind it** (§9j, Ken's own
   * correction), so the other side of a picture on a **left-hand** page is
   * the page **in front** of it — the same rule read in the direction it was
   * never read in.
   */
  it('goes behind a right-hand picture and in front of a left-hand one', () => {
    const file = novel();
    const put = pictureOn(file, midStory(file));

    const onRecto = setBackBlank(put.file, put.figureId, true);
    const atRecto = pageOfPicture(onRecto, put.figureId);
    const rectoRows = lay(onRecto).rows;
    expect(rectoRows.find((row) => row.sheet === atRecto + 1)!.blank).toBe(true);

    const onVerso = setBackBlank(placeBookFigure(put.file, put.figureId, { place: 'page', side: 'verso' }), put.figureId, true);
    const atVerso = pageOfPicture(onVerso, put.figureId);
    const versoRows = lay(onVerso).rows;
    // In front of it, and really the other side of the same sheet: the blank
    // is the recto and the picture the verso behind it.
    expect(versoRows.find((row) => row.sheet === atVerso - 1)!.blank).toBe(true);
    expect((atVerso - 1) % 2).toBe(1);
    expect(atVerso % 2).toBe(0);
  });

  it('is read as a picture’s back from either side, rather than as somebody’s setting', () => {
    const file = novel();
    const put = pictureOn(file, midStory(file));
    const onVerso = setBackBlank(placeBookFigure(put.file, put.figureId, { place: 'page', side: 'verso' }), put.figureId, true);
    const rows = lay(onVerso).rows;
    const at = pageOfPicture(onVerso, put.figureId);
    // The leaf in front: a reading that looked only backwards called this
    // *the page in front of it is set to leave its back blank*, which is a
    // different leaf's reason entirely.
    expect(blankReason(rows, at - 1)).toBe('back');
    const removal = pageRemoval(onVerso, rows, at - 1);
    expect(removal.what).toBe('back');
    expect(removal.id).toBe(put.figureId);
    expect(removal.comfort).toContain('after it');
  });
});
