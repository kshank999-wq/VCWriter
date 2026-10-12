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
  designOffer,
  designPage,
  geometryOf,
  layPages,
  pagePlace,
  pageRemoval,
  PICTURE_BY_DESIGNING,
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

/** The one act a blank page takes (§9ar): read it, and run it. */
const designAt = (file: ProjectFile, sheet: number) => {
  const { laid, blocks, rows } = lay(file);
  return designOffer(pagePlace(laid.pages, blocks, sheet), rows, sheet, 'stories');
};

const designOn = (file: ProjectFile, sheet: number) => {
  const { laid, blocks, rows } = lay(file);
  return designPage(file, pagePlace(laid.pages, blocks, sheet), rows, sheet, 'stories');
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

/**
 * **The act is the design and no longer the picture** (§9ar, from Ken: *if we
 * just use the design a page function, it works fine… we'll just make sure
 * that the only way to do it is to design a page*).
 *
 * §9al's rule — *where a rule holds the page, the act frees the rule* — is
 * what these pin and it is untouched; what changed under them is **which act
 * carries it**, the picture having had three landing rules for a blank page
 * and none of them the writer's own press. `designPage` frees exactly the
 * same rules and says the same sentence, which is why one copy of it serves
 * both (§9aq) and why these needed their subject changed and not their
 * argument.
 */
describe('a page of your own, on a leaf the book is keeping blank', () => {
  it('is offered rather than refused, and says what it would free', () => {
    const file = collection();
    const offer = designAt(file, blankAt(file, 'between'));
    expect(offer.refusal).toBeNull();
    expect(offer.frees).toEqual({ id: file.markers[1]!.id as string, rule: 'sheet' });
    // And the picture, asked for on the same page, names this act.
    expect(offerAt(file, blankAt(file, 'between')).refusal).toBe(PICTURE_BY_DESIGNING);
  });

  it('says what the press will cost before the press', () => {
    const file = collection();
    const offer = designAt(file, blankAt(file, 'between'));
    // The format's own plural, handed down: nothing names a unit itself.
    expect(offer.note).toContain('between stories');
    /**
     * **Rewritten rather than worked around** (§9aq). It pinned *facing the
     * one that follows*, which was measured for a picture and is **not** true
     * of a page the writer sets: that is a block taking the next page there
     * is, so on the same collection it lands where the sheet's front was with
     * the book the length it was, where the art came back a page shorter. One
     * rule, two acts, one sentence — so the clause that holds for only one of
     * them is left out rather than said to both (§9ae's *the note gives no
     * number*). What the sentence must still do is say the sheet goes.
     */
    expect(offer.note).toContain('That sheet goes');
  });

  it('says the other sentence on a back, which is a different cost', () => {
    const { file } = backBlankTitlePage();
    const offer = designAt(file, blankAt(file, 'page_back'));
    expect(offer.refusal).toBeNull();
    expect(offer.frees?.rule).toBe('back');
    // One sentence for both acts now (§9aq), so the subject is what you put
    // here rather than a picture.
    expect(offer.note).toContain('printed on that back');
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
    expect(designAt(file, gap.sheet).frees).toBeNull();
  });

  it('frees nothing on the writer’s own sheet, which the page takes', () => {
    let file = collection();
    const unit = unitsInStoryOrder(file)[1]!;
    const element = file.beats.find((beat) => beat.unitId === unit.id)!.manuscript.elements[0]!;
    file = setBlankPage(file, element.id as string, true);
    const offer = designAt(file, blankAt(file, 'writer'));
    expect(offer.frees).toBeNull();
    expect(offer.leafId).toBe(element.id as string);
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
    /**
     * **Driven through the act the room runs** (§9ar). This ran
     * `setBackBlank` and then `addPart('plate')` by hand, which is §9ap's own
     * warning — *a test pinning an act no screen runs is worse than a failing
     * one* — and it went on passing after the room had stopped offering a
     * picture on a blank page at all. One press now: the switch goes and the
     * page of the writer's own stands where the leaf was.
     *
     * **The end-to-end count is what is asserted** rather than the state
     * between the two halves — the leaf is the only page in question and
     * where it falls is the cutter's, so an intermediate count says nothing a
     * writer would notice.
     */
    const { file } = backBlankTitlePage();
    const was = pages(file);
    const sheet = blankAt(file, 'page_back');
    const made = designOn(file, sheet);
    expect(made.refusal).toBeNull();
    expect(pages(made.file)).toBe(was);
    // On the page pointed at, which is the claim every one of these reports
    // has been about.
    expect(lay(made.file).rows.find((row) => row.partId === made.partId)!.sheet).toBe(sheet);
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
  it('puts the page where the separating sheet was, and the book is shorter rather than longer', () => {
    /**
     * **The arithmetic is kept and the act is the one a writer presses**
     * (§9ar). It was measured for a picture — one sheet off, one page back in
     * — and the same holds of a page of the writer's own, which is a block
     * taking the next page there is. The half this was written to catch is
     * still what it catches: the first draft gave the picture its own blank
     * back on §9ad's rule, and the next work opening recto (§9j) made the
     * book come back **one page longer** than the sheet it replaced.
     */
    const file = collection();
    const was = pages(file);
    const story = file.markers[1]!.id as string;
    const freed = pages(setSheetBefore(file, story, false));
    expect(freed).toBe(was - 2);
    const made = designOn(file, blankAt(file, 'between'));
    expect(made.refusal).toBeNull();
    /**
     * **And it costs nothing beyond freeing the sheet, which the picture did
     * not manage** — measured at 19 → 17, the same as taking the separation
     * away by hand. The sheet's two pages go, and the page of the writer's
     * own **stands in the gap the recto rule then leaves** rather than adding
     * one to it (§9ac's *the first blank asked for in that gap takes its
     * place*, said of a page). The picture came back at 18, a page longer,
     * for want of being able to stand in a gap at all.
     */
    expect(pages(made.file)).toBe(freed);
  });

  it('leaves that page facing the work that follows', () => {
    // Which is what a reader sees, and more of a separation than two blank
    // pages rather than less — the reason this is an act and not a refusal.
    const file = collection();
    const made = designOn(file, blankAt(file, 'between'));
    const { rows } = lay(made.file);
    const own = rows.find((row) => row.partId === made.partId)!;
    expect(rows.find((row) => row.sheet === own.sheet + 1)?.says).toBe('Chapter opens');
  });

  it('changes nothing in a book nobody has asked anything of', () => {
    // The whole suite passing unedited is the other half of this; here it is
    // said once, because a reading added to `pictureOffer` must not move a
    // page by being asked.
    const file = collection();
    expect(pages(file)).toBe(pages(placeBookFigure(file, 'nothing-here', { place: 'measure' })));
  });
});
