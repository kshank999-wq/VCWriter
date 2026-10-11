import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  blankHold,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  pagePlace,
  pageRemoval,
  pictureOffer,
  placeBookFigure,
  placeFigure,
  setBackBlank,
  setBlankPage,
  setSheetBefore,
  partsOf,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **A picture on a page the book is keeping blank** (addendum 20 §9al, from
 * Ken: *these blank pages are treated as special somehow, where they're not.
 * They need to be like every other page, where I can add a graphic… And I
 * should be able to pick a page, even if it's the back of a text page or the
 * back of a chapter page, and add something to it*).
 *
 * Three leaves refused: the back of a picture, the back of a page whose own
 * screen asked for one, and the sheet the book leaves between two whole
 * works. Each named in a sentence the switch that would free it — honest, and
 * a detour, the writer having pointed at a page and been sent to another
 * screen to turn something off before they could come back and do what they
 * had just asked for. §9ae settled it one control over: **where a rule holds
 * the page, the act frees the rule.**
 *
 * What these pin is the half that could go wrong quietly: **what it costs in
 * pages**, which is the one thing this whole run of reports is about.
 */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ASSET = '22222222-2222-4222-8222-222222222222';

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const withArt = (file: ProjectFile): ProjectFile =>
  ({
    ...file,
    assets: [
      ...file.assets,
      { id: ASSET as never, kind: 'image', name: 'Harbour', data: PNG, width: 400, height: 300, altText: '', caption: '', createdAt: file.project.createdAt },
    ],
  }) as ProjectFile;

/** A collection like Ken's: two stories, each divided into chapters. */
const collection = (): ProjectFile => {
  let file = withArt(createProjectFile({ title: 'Harbour Tales', format: 'short_story', author: 'M. Shank' }));
  const track = file.tracks[0]!.id;
  const story = (title: string, chapters: number) => {
    const ids: string[] = [];
    for (let at = 0; at < chapters; at += 1) {
      const made = addUnit(file, { trackId: track, title: `${at + 1}` });
      file = made.file;
      ids.push(made.unit.id as string);
      const beat = addBeat(file, { unitId: made.unit.id, title: `${title} ${at + 1}` });
      file = updateBeat(beat.file, beat.beat.id, {
        manuscript: { elements: [1, 2, 3].map((n) => para(`${title} ${at + 1} para ${n}. ${'word '.repeat(60)}`)) },
      } as never);
    }
    file = addMarker(file, { kind: 'chapter', unitId: ids[0] as never, title }).file;
  };
  story('The Harbour', 2);
  story('In For A Pound', 2);
  return addPart(file, 'appendix', { title: 'Appendix' }).file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

const pages = (file: ProjectFile): number => lay(file).laid.pages.length;

/** The first blank page whose reason is this one. */
const blankAt = (file: ProjectFile, why: string): number => {
  const { rows } = lay(file);
  const found = rows.find((row) => row.blank && blankHold(rows, row.sheet)?.why === why);
  if (!found) throw new Error(`No ${why} leaf in this book`);
  return found.sheet;
};

/** The title page with its back left blank (§17d), which is Ken's own case. */
const backBlankTitlePage = (): { file: ProjectFile; partId: string } => {
  const start = collection();
  const part = partsOf(start).find((one) => one.kind === 'title_page')!;
  return { file: setBackBlank(start, part.id, true), partId: part.id };
};

/** A page of its own standing in front of the second story's opening. */
const pictureBeforeSecondStory = (file: ProjectFile, from: ProjectFile) => {
  const unit = unitsInStoryOrder(file).find((one) => (one.id as string) === (from.markers[1]!.unitId as string))!;
  const beat = file.beats.find((one) => one.unitId === unit.id)!;
  return placeFigure(file, {
    beatId: beat.id,
    assetId: ASSET as never,
    beforeElementId: beat.manuscript.elements[0]!.id,
    attributes: { bookPlace: 'page' },
  });
};

const offerAt = (file: ProjectFile, sheet: number) => {
  const { laid, blocks, rows } = lay(file);
  return pictureOffer(pagePlace(laid.pages, blocks, sheet), rows, sheet, 'stories');
};

describe('what holds a page blank', () => {
  it('names the writer’s own sheet and the act that takes it away', () => {
    let file = collection();
    const unit = unitsInStoryOrder(file)[1]!;
    const element = file.beats.find((beat) => beat.unitId === unit.id)!.manuscript.elements[0]!;
    file = setBlankPage(file, element.id as string, true);
    const sheet = blankAt(file, 'writer');
    expect(blankHold(lay(file).rows, sheet)).toEqual({ why: 'writer', id: element.id as string, frees: 'leaf' });
  });

  it('names the work the separating sheet belongs to', () => {
    const file = collection();
    const sheet = blankAt(file, 'between');
    const hold = blankHold(lay(file).rows, sheet)!;
    expect(hold.why).toBe('between');
    expect(hold.frees).toBe('sheet');
    expect(hold.id).toBe(file.markers[1]!.id as string);
  });

  it('names the page in front where a back was asked for', () => {
    // §17e's own case, and Ken's words: *the back of a text page or the back
    // of a chapter page*. `setBackBlank` reads which of the three
    // collections the id names, so the part answers the same way.
    const { file, partId } = backBlankTitlePage();
    const sheet = blankAt(file, 'page_back');
    const hold = blankHold(lay(file).rows, sheet)!;
    expect(hold.frees).toBe('back');
    expect(hold.id).toBe(partId);
  });

  it('is nothing at all on a page that is not blank', () => {
    const file = collection();
    const { rows } = lay(file);
    const written = rows.find((row) => !row.blank && row.elementIds.length > 0)!;
    expect(blankHold(rows, written.sheet)).toBeNull();
  });

  /**
   * **The × and the picture reach the same record**, which is the whole
   * reason for one reading: `pageRemoval` worked this out for itself and
   * `pictureOffer` could not reach the walk at all.
   */
  it('is the same record the page’s own × reaches', () => {
    const file = collection();
    const sheet = blankAt(file, 'between');
    const { rows } = lay(file);
    expect(pageRemoval(file, rows, sheet).id).toBe(blankHold(rows, sheet)!.id);
  });
});

describe('a picture asked for on a leaf the book is keeping blank', () => {
  it('is offered rather than refused, and says what it would free', () => {
    const file = collection();
    const offer = offerAt(file, blankAt(file, 'between'));
    expect(offer.refusal).toBeNull();
    expect(offer.frees).toEqual({ id: file.markers[1]!.id as string, rule: 'sheet' });
  });

  it('says what the press will cost before the press', () => {
    const file = collection();
    const offer = offerAt(file, blankAt(file, 'between'));
    // The format's own plural, handed down: nothing names a unit itself.
    expect(offer.note).toContain('between stories');
    expect(offer.note).toContain('facing the one that follows');
  });

  it('says the other sentence on a back, which is a different cost', () => {
    const { file } = backBlankTitlePage();
    const offer = offerAt(file, blankAt(file, 'page_back'));
    expect(offer.refusal).toBeNull();
    expect(offer.frees?.rule).toBe('back');
    expect(offer.note).toContain('prints on that back');
    expect(offer.note).toContain('no other page moves');
  });

  /**
   * **The cutter's own gap is filled rather than freed** (§9aa). A verso left
   * in front of a chapter that opens on a right-hand page is not held by a
   * switch anybody set — the picture takes the page and the book does not
   * grow — so there is nothing to free and the note says that instead.
   */
  it('frees nothing on the leaf the recto rule leaves, which is filled', () => {
    const file = collection();
    const { rows } = lay(file);
    const gap = rows.find((row) => row.blank && blankHold(rows, row.sheet)?.why === 'recto');
    if (!gap) return;
    const offer = offerAt(file, gap.sheet);
    expect(offer.frees).toBeNull();
  });

  it('frees nothing on the writer’s own sheet, which the picture takes', () => {
    let file = collection();
    const unit = unitsInStoryOrder(file)[1]!;
    const element = file.beats.find((beat) => beat.unitId === unit.id)!.manuscript.elements[0]!;
    file = setBlankPage(file, element.id as string, true);
    const offer = offerAt(file, blankAt(file, 'writer'));
    expect(offer.frees).toBeNull();
    expect(offer.takesLeaf).toBe(element.id as string);
  });
});

describe('what the act costs the book', () => {
  /**
   * **Printing on a back moves nothing.** The leaf stays where it is and
   * keeps the side of the paper it had; only the switch goes. This is the
   * measurement the whole report is about — a picture that cost pages is what
   * §9aj and §9ad were both written for.
   */
  it('leaves the book exactly as long when a back is printed on', () => {
    const { file, partId } = backBlankTitlePage();
    const was = pages(file);
    /**
     * The act: the switch goes and a page of art stands where the leaf was.
     * **The end-to-end count is what is asserted** rather than the state
     * between the two halves — the leaf is the only page in question and
     * where it falls is the cutter's, so an intermediate count says nothing
     * a writer would notice.
     */
    const freed = setBackBlank(file, partId, false);
    const made = addPart(freed, 'plate', { assetId: ASSET, inFront: true }, partsOf(freed).find((one) => one.kind === 'copyright')?.id ?? null);
    expect(pages(made.file)).toBe(was);
  });

  /**
   * **A separating sheet goes and the picture stands in its place** — and
   * this is the half that was **measured rather than reasoned about**. The
   * first draft gave the picture its own blank back on §9ad's rule (one sheet
   * off, two pages back in), which is right for the writer's own sheet, where
   * nothing forces the leaf onto a side. Here the next work opens on a
   * right-hand page, so a picture asked to leave its back blank takes a recto
   * (§9j): the book came back **one page longer** than the sheet it replaced.
   */
  it('puts the picture where the separating sheet was, and the book is shorter rather than longer', () => {
    const file = collection();
    const was = pages(file);
    const story = file.markers[1]!.id as string;
    const freed = setSheetBefore(file, story, false);
    expect(pages(freed)).toBe(was - 2);
    const made = pictureBeforeSecondStory(freed, file);
    // One page for the picture where two were blank.
    expect(pages(made.file)).toBe(was - 1);
    // And the back blank, which the first draft wrote, costs two more.
    expect(pages(setBackBlank(made.file, made.elementId as string, true))).toBe(was + 1);
  });

  it('leaves the picture facing the work that follows', () => {
    // Which is what a reader sees, and more of a separation than two blank
    // pages rather than less — the reason this is an act and not a refusal.
    const file = collection();
    const story = file.markers[1]!.id as string;
    const made = pictureBeforeSecondStory(setSheetBefore(file, story, false), file);
    const { rows } = lay(made.file);
    const art = rows.find((row) => row.figureId === (made.elementId as string))!;
    expect(rows.find((row) => row.sheet === art.sheet + 1)?.says).toBe('Chapter opens');
  });

  it('changes nothing in a book nobody has asked anything of', () => {
    // The whole suite passing unedited is the other half of this; here it is
    // said once, because a reading added to `pictureOffer` must not move a
    // page by being asked.
    const file = collection();
    expect(pages(file)).toBe(pages(placeBookFigure(file, 'nothing-here', { place: 'measure' })));
  });
});
