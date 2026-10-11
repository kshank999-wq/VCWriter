import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addGraphic,
  addMarker,
  addPart,
  addUnit,
  BOOK_END,
  blankPagesAt,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  takePictureLeaf,
  OWN_PAGE_ONLY_NOTE,
  pagePlace,
  pageRemoval,
  partsOf,
  pictureOffer,
  placeFigure,
  removePart,
  setBlankPages,
  SHEET,
  halfOf,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **A picture on the last page of the book** (addendum 20 §9ap, from Ken on
 * the final blank page of his collection: *still the same problem of if I add
 * a blank page, I can do nothing with it. I want to be able to add a vector
 * or a picture or have the same formatting as any other page. In this
 * instance, I need to add the final picture on page 173*).
 *
 * Every answer this room gives reads **forwards** — a picture stands in front
 * of something — which is the one direction with nothing to offer past the
 * last page of the book: §9aa's walk forward found nothing and §9ab's part
 * was not there, so the refusal named the mechanism (*nothing of the book
 * follows it*). True, and a poor answer to somebody pointing at a page their
 * book plainly has, which is §9ao's own finding one control over.
 *
 * So at the end of the book the picture looks **backwards**, and what it goes
 * after is the last thing the book has.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/**
 * Ken's shape: a collection of stories. `back` says whether the book keeps
 * its back matter, which is the whole of what decides the act — after the
 * story's last words the picture is a **figure**, and after a page of the
 * book it is another page of the book.
 */
const collection = (back: boolean): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'short_story', author: 'M. Shank' });
  const track = file.tracks[0]!.id;
  for (const title of ['In For A Pound', 'For The Love A Brother']) {
    const made = addUnit(file, { trackId: track, title: 'I.' });
    file = made.file;
    const beat = addBeat(file, { unitId: made.unit.id, title });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: {
        elements: [1, 2, 3].map((n) => para(`${title} para ${n}. ${'word '.repeat(80)}`)),
      } as never,
    });
    file = addMarker(file, { kind: 'chapter', unitId: made.unit.id, title }).file;
  }
  if (!back) for (const part of partsOf(file).filter((one) => halfOf(one) === 'back')) file = removePart(file, part.id);
  return file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 11 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

const offerOn = (file: ProjectFile, sheet: number) => {
  const { blocks, laid, rows } = lay(file);
  return pictureOffer(pagePlace(laid.pages, blocks, sheet), rows, sheet, 'stories');
};

/** The blank page a writer asked for at the end of the book (§9ao's BOOK_END). */
const endLeaf = (file: ProjectFile) => lay(file).rows.find((one) => one.blankFor === BOOK_END)!;

/** Exactly what the room's own act does with a story answer. */
const putPicture = (file: ProjectFile, offer: ReturnType<typeof pictureOffer>) => {
  const added = addGraphic(file, {
    name: 'final.png',
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    width: 1200,
    height: 1800,
  });
  const beat = added.file.beats.find((one) =>
    (one.manuscript.elements as readonly { id: string }[]).some((element) => element.id === offer.spot),
  )!;
  const made = placeFigure(added.file, {
    beatId: beat.id,
    assetId: added.asset.id,
    ...(offer.anchor === 'after'
      ? { afterElementId: offer.spot as never }
      : { beforeElementId: offer.spot as never }),
    attributes: { bookPlace: 'page' },
  });
  // Exactly the room's own act (§9ap): a picture is a page and takes the one
  // page it stands on.
  const out = offer.takesLeaf ? takePictureLeaf(made.file, offer.takesLeaf) : made.file;
  return { file: out, figureId: made.elementId as string };
};

describe('a picture on the last page of the book', () => {
  it('refused before this, with the mechanism named', () => {
    // The sentence Ken was looking at, which is why the report reads *I can
    // do nothing with it*: it is true about the walk forward and says nothing
    // a writer can act on.
    const file = collection(false);
    const { blocks, laid, rows } = lay(file);
    const last = rows[rows.length - 1]!;
    // Before the change the page past the story answered with nothing at all.
    // What pins the change is the page *after* it: a leaf the writer asked
    // for, where every field below is new.
    expect(pagePlace(laid.pages, blocks, last.sheet).lastElementId ?? null).toBeNull();
  });

  it('answers with the last words of the story, after them', () => {
    const file = setBlankPages(collection(false), BOOK_END, SHEET);
    const leaf = endLeaf(file);
    const offer = offerOn(file, leaf.sheet);
    expect(offer.refusal).toBeNull();
    expect(offer.of).toBe('story');
    // **The one place this room reads backwards** (§9ap).
    expect(offer.anchor).toBe('after');
    // And it is the story's own last element, so no part is made.
    expect(offer.newPageBefore).toBeNull();
    const words = unitsInStoryOrder(file);
    const beats = file.beats.filter((one) => one.unitId === words[words.length - 1]!.id);
    const elements = beats[beats.length - 1]!.manuscript.elements as readonly { id: string }[];
    expect(offer.spot).toBe(elements[elements.length - 1]!.id);
  });

  it('reads that element from the blocks, so the book’s last paragraph counts', () => {
    /**
     * **Measured rather than reasoned about** (§9ap). The first draft read
     * the element off the page behind — `elementIds` on a row — and a row's
     * list holds what stands **whole** on it, so the final paragraph of a
     * book, which very often begins on the page before, was on neither list:
     * the answer came back as the second-to-last element and the picture went
     * in one paragraph early, pushing the last words over the page.
     */
    const file = setBlankPages(collection(false), BOOK_END, SHEET);
    const { blocks, laid, rows } = lay(file);
    const leaf = endLeaf(file);
    const place = pagePlace(laid.pages, blocks, leaf.sheet);
    const bodies = blocks.filter((one) => one.kind === 'paragraph');
    expect(place.lastElementId).toBe(bodies[bodies.length - 1]!.id);
    // And the page behind it really does carry only a tail, which is the
    // shape that caught it.
    const behind = rows.find((one) => one.sheet === leaf.sheet - 1)!;
    expect(behind.elementIds?.includes(place.lastElementId as string) ?? false).toBe(false);
  });

  it('puts the picture on the page that was pointed at, and moves no words', () => {
    const file = setBlankPages(collection(false), BOOK_END, SHEET);
    const before = lay(file);
    const leaf = endLeaf(file);
    const offer = offerOn(file, leaf.sheet);
    // **The leaf is the picture's page** (§9aa): the writer asked for one page
    // and then said what is on it, so the sheet goes as the picture arrives.
    expect(offer.takesLeaf).toBe(BOOK_END);
    const done = putPicture(file, offer);
    const after = lay(done.file);
    const art = after.rows.find((one) => one.figureId === done.figureId)!;
    // The page he pointed at, and not the page after it.
    expect(art.counted).toBe(leaf.counted);
    // The story's last page is where it was, with the same words on it.
    const was = before.rows.find((one) => one.sheet === leaf.sheet - 1)!;
    const now = after.rows.find((one) => one.sheet === art.sheet - 1)!;
    expect(now.elementIds).toEqual(was.elementIds);
    // **Exactly as long as it was**: one sheet off, the picture and its own
    // blank back in.
    expect(after.rows).toHaveLength(before.rows.length);
  });

  it('and does the same where one page was asked for, which is the commonest shape', () => {
    /**
     * **The Add menu puts one page in at a time** (§9an), so this is what a
     * writer actually has in hand — and until §9ap both screens took two off
     * the leaf, so it survived and the picture landed on the page after it.
     */
    const file = setBlankPages(collection(false), BOOK_END, 1);
    const before = lay(file);
    const leaf = endLeaf(file);
    const done = putPicture(file, offerOn(file, leaf.sheet));
    const after = lay(done.file);
    const art = after.rows.find((one) => one.figureId === done.figureId)!;
    // The page he pointed at, and the book exactly as long as it was.
    expect(art.counted).toBe(leaf.counted);
    expect(after.rows).toHaveLength(before.rows.length);
    // And no blank left standing anywhere at the end of it.
    expect(after.rows[after.rows.length - 1]!.figureId).toBe(done.figureId);
  });

  it('gives that page a × that takes the picture away', () => {
    const file = setBlankPages(collection(false), BOOK_END, SHEET);
    const offer = offerOn(file, endLeaf(file).sheet);
    const done = putPicture(file, offer);
    const after = lay(done.file);
    const art = after.rows.find((one) => one.figureId === done.figureId)!;
    // §9x's rule: no page row is without one.
    expect(pageRemoval(done.file, after.rows, art.sheet).refusal).toBeNull();
  });

  it('appends a page of art where the book ends in back matter', () => {
    /**
     * **A part is not the answer where the story ends the book**, and this is
     * the other half of that: where a *part* ends it, another page of the book
     * is exactly right, and `BOOK_END` is the position — it names no part, so
     * `addPart` puts the plate last.
     */
    const file = setBlankPages(collection(true), BOOK_END, SHEET);
    const offer = offerOn(file, endLeaf(file).sheet);
    expect(offer.refusal).toBeNull();
    expect(offer.of).toBeNull();
    expect(offer.spot).toBeNull();
    expect(offer.newPageBefore).toBe(BOOK_END);
    const made = addPart(file, 'plate', { assetId: 'a1', inFront: false }, offer.newPageBefore as string);
    const parts = partsOf(made.file);
    // Last of all, which is where the leaf stood.
    expect(parts[parts.length - 1]!.id).toBe(made.partId);
  });

  it('says why a blank page takes the picture and not the other two', () => {
    /**
     * **Absence is this room's idiom for *this does not apply here*** and on
     * a blank page it reads as nothing applying at all, which is the whole of
     * *I can do nothing with it*. So the reason stands where the two controls
     * are, and it names the route: the picture is what turns this leaf into a
     * page of the book.
     */
    const file = setBlankPages(collection(false), BOOK_END, SHEET);
    const offer = offerOn(file, endLeaf(file).sheet);
    expect(offer.ownPageOnly).toBe(true);
    /**
     * **And it names what this page can have rather than a route to the other
     * two.** The first draft said *the picture above makes it a page of the
     * book, and then both are offered here* — true of this reading and not of
     * the screen, where a page that **is** a picture draws the figure's own
     * section instead of these controls; a sentence promising a control the
     * next press does not produce is worse than the absence it explains.
     */
    expect(OWN_PAGE_ONLY_NOTE).toMatch(/a picture that is the page itself/);
    expect(OWN_PAGE_ONLY_NOTE).not.toMatch(/offered here/);
  });

  it('takes the one page it stands on, whatever else the writer asked for', () => {
    /**
     * **§9ad's answer left standing after §9an changed the unit** (§9ap). Both
     * screens took **two** pages off the leaf and asked for the picture's own
     * back blank whatever stood there, which was right while a leaf was a
     * sheet — and the Add menu has put one page in at a time since §9an, so
     * on the commonest shape the clamp kept the leaf and the picture landed on
     * the *next* page: measured in the real room, *12 Blank · 13 Illustration
     * · 14 Blank*, with the book two pages longer than before.
     *
     * A picture is a page and takes the one page it stands on. The rest of the
     * leaves stand where the writer left them, each with its own × in the
     * rail, which is what makes §9ad's *a separating sheet with art on it*
     * true on both parities rather than on one.
     */
    const file = setBlankPages(collection(false), BOOK_END, 3);
    const once = takePictureLeaf(file, BOOK_END);
    expect(blankPagesAt(once, BOOK_END)).toBe(2);
    // And nothing standing takes nothing, so a caller cannot make a negative.
    expect(blankPagesAt(takePictureLeaf(collection(false), BOOK_END), BOOK_END)).toBe(0);
  });

  it('leaves every other page reading forwards', () => {
    // The field is `before` everywhere else, which is what keeps every act
    // built on this offer exactly as it was.
    const file = collection(true);
    const { blocks, laid, rows } = lay(file);
    for (const row of rows) {
      const offer = pictureOffer(pagePlace(laid.pages, blocks, row.sheet), rows, row.sheet, 'stories');
      expect(offer.anchor).toBe('before');
    }
  });
});
