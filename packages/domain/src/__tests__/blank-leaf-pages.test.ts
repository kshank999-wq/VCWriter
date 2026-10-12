import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addGraphic,
  addMarker,
  addPart,
  addUnit,
  blankOffer,
  blankPagesAt,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  designOffer,
  designPage,
  geometryOf,
  layPages,
  pageRemoval,
  pagePlace,
  partsOf,
  PICTURE_BY_DESIGNING,
  pictureOffer,
  removeBookPage,
  setBackBlank,
  setBlankPage,
  setBlankPages,
  SHEET,
  takePictureLeaf,
  updateBeat,
  type BeatId,
  type ProjectFile,
} from '../index.js';

/**
 * **Every page is a page you can put something on** (addendum 20 §9aa, from
 * Ken):
 *
 * > I'm trying to put a picture on a page that is blank and there's nothing I
 * > can do to edit it. So I don't want to put the picture at the end of the
 * > story. I want to put it on the page after, which is before the next
 * > chapter. But the page opposite of that, it just says blank… Every page
 * > should be editable… the functionality should not be there's a page and it
 * > snaps the picture to the page before it. It should be on the page that I
 * > set.
 *
 * Measured first, on a novel whose chapters open on a right-hand page: every
 * chapter ran one page and left the verso after it empty, and that leaf's own
 * screen carried **one sentence and one button** — no picture, no graphic, no
 * route to the chapter's page. The sentence told him to go to the page after
 * and put the picture there, from where the cutter would bring it back here:
 * two redirections to land where he pointed in the first place.
 *
 * The fix is `pagePlace`'s own sentence finished. A press on a page is
 * answered by reading what is **on** it; where nothing is on it, by reading
 * what it stands **in front of** — which is the same position, because a page
 * of its own takes the next page there is and so fills an empty leaf rather
 * than adding one. So it is the existing rule applied one page along, and
 * every act built on `pagePlace` is covered by it rather than one control
 * being taught about leaves.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A novel like Ken's: short chapters, each opening on a right-hand page. */
const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  const track = file.tracks[0]!.id;
  for (const title of ['The Road', 'Low Water', 'The Harbour']) {
    const made = addUnit(file, { trackId: track, title });
    file = made.file;
    const beat = addBeat(file, { unitId: made.unit.id, title });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [1, 2].map((n) => para(`${title} para ${n}. ${'word '.repeat(60)}`)) } as never,
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

const placeOn = (file: ProjectFile, sheet: number) => {
  const { blocks, laid } = lay(file);
  return pagePlace(laid.pages, blocks, sheet);
};

const offerOn = (file: ProjectFile, sheet: number) => {
  const { blocks, laid, rows } = lay(file);
  return pictureOffer(pagePlace(laid.pages, blocks, sheet), rows, sheet);
};

/** The one act a blank page takes (§9ar), read and then run. */
const designOn = (file: ProjectFile, sheet: number) => {
  const { blocks, laid, rows } = lay(file);
  return designOffer(pagePlace(laid.pages, blocks, sheet), rows, sheet);
};

const designAt = (file: ProjectFile, sheet: number) => {
  const { blocks, laid, rows } = lay(file);
  return designPage(file, pagePlace(laid.pages, blocks, sheet), rows, sheet);
};

/** The leaf the recto rule leaves between two chapters: Ken's page. */
const leafInStory = (file: ProjectFile) => {
  const rows = lay(file).rows;
  return rows.find((row) => row.blank && row.partId === null && row.markerId !== null)!;
};

const picture = (file: ProjectFile) =>
  addGraphic(file, { name: 'plate.png', data: 'data:image/png;base64,AAA', width: 800, height: 600 });

describe('what a blank leaf stands in front of', () => {
  it('answers with the element the page ahead opens with, and says that it did', () => {
    const file = novel();
    const leaf = leafInStory(file);
    const place = placeOn(file, leaf.sheet);
    const ahead = placeOn(file, leaf.sheet + 1);
    expect(place.elementId).toBe(ahead.elementId);
    expect(place.elementId).not.toBeNull();
    expect(place.standsBefore).toBe(leaf.sheet + 1);
  });

  it('says nothing of the sort on a page that answers for itself', () => {
    // The half of this worth asserting: `standsBefore` is what lets a caller
    // tell what a page **is** from what may be put on it, so a page of the
    // story must not carry one.
    const file = novel();
    const text = lay(file).rows.find((row) => row.says === 'Chapter opens')!;
    expect(placeOn(file, text.sheet).standsBefore).toBeNull();
  });

  it('does not claim the chapter opens on it', () => {
    /**
     * `opensMarkerId` **is** carried, because §9t's hoist needs to know the
     * leaf stands in front of a division's whole opening rather than between
     * a collection's two. `opensAlone` is **not**, and it is what gates the
     * control that leaves the back of a chapter's own page blank — two leaves
     * a sheet apart being two different sides of paper.
     */
    const file = novel();
    const leaf = leafInStory(file);
    const place = placeOn(file, leaf.sheet);
    expect(place.opensMarkerId).toBe(placeOn(file, leaf.sheet + 1).opensMarkerId);
    expect(place.opensAlone).toBe(false);
  });
});

/**
 * **The whole of this block is overturned by §9ar**, from Ken after the
 * fourth report of the same thing (*I tried to put a picture on page 68 and
 * it put it on the right on page 69 for some reason… it just keeps going in
 * circles and it never gets fixed*), and then with the answer (*if we just
 * use the design a page function, it works fine. So instead of trying to do
 * it the other way, we'll just make sure that the only way to do it is to
 * design a page*).
 *
 * Every test below asserted *a picture may be asked for on a blank page*,
 * which was true, built three times and reported broken three times —
 * because the picture route decides where it lands **from the record it
 * anchors to**, in three different branches, and never from the page the
 * writer pointed at. Measured over three book shapes: designing landed on
 * the sheet pointed at on fourteen of seventeen blank pages with the book
 * the length it was, and the three it did not are the second page of a
 * separating sheet, which is one object taken away whole and whose note
 * says so before the press.
 *
 * So what is pinned now is the route and the act behind it. These are
 * **rewritten rather than worked around**: each one pinned the fault as a
 * requirement, which is why four reports could not shift it.
 */
describe('a picture asked for on a blank leaf', () => {
  it('is refused, and the refusal is the route rather than a dead end', () => {
    const file = novel();
    const offer = offerOn(file, leafInStory(file).sheet);
    expect(offer.refusal).toBe(PICTURE_BY_DESIGNING);
    expect(offer.refusal).toMatch(/Design this page/);
    // And the act it names is on offer on that very page, or the sentence
    // points at nothing (addendum 10 §8).
    expect(designOn(file, leafInStory(file).sheet).refusal).toBeNull();
  });

  it('lands on that leaf by the one route, and the book does not grow', () => {
    /**
     * The whole of *it should be on the page that I set*, kept — and now
     * true of the act a writer actually presses. The leaf is stood in rather
     * than added to, which is what the cutter has always done with an empty
     * page.
     */
    const file = novel();
    const leaf = leafInStory(file);
    const before = lay(file).rows;
    const made = designAt(file, leaf.sheet);
    const after = lay(made.file).rows;
    expect(after).toHaveLength(before.length);
    expect(after.find((row) => row.sheet === leaf.sheet)!.partId).toBe(made.partId);
  });

  it('is answered on every blank leaf of the story, which is what the report was', () => {
    /**
     * **Walking the book rather than the one page the report named** (§9x's
     * own lesson, and the one assertion in this file that needed no change of
     * argument — only of which act it walks for). Every chapter of a book
     * whose chapters open on a right-hand page leaves a leaf behind it, so
     * *the page I want* is not one page but most of the empty ones in the
     * book.
     */
    const file = novel();
    const rows = lay(file).rows;
    const leaves = rows.filter((row) => row.blank && row.partId === null && row.markerId !== null);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(offerOn(file, leaf.sheet).refusal).toBe(PICTURE_BY_DESIGNING);
      const design = designOn(file, leaf.sheet);
      expect(design.refusal, `no act on the blank page at sheet ${leaf.sheet}`).toBeNull();
      expect(designAt(file, leaf.sheet).partId).not.toBeNull();
    }
  });

  /**
   * **Overturned twice.** §9aa asserted the refusal as a requirement and
   * §9al overturned it — *where a rule holds the page, the act frees the
   * rule* — and what is kept here is that rule with the act that now carries
   * it: designing frees exactly what the picture used to free, and says the
   * same sentence before the press, which is why one copy of it serves both
   * (§9aq).
   */
  it('frees the rule holding a leaf kept empty on purpose, and says so first', () => {
    const file = novel();
    const text = lay(file).rows.find((row) => row.says === 'Chapter opens' && row.sheet > 4)!;
    // The back of a chapter's own page (§9r): a leaf asked for by the page in
    // front of it, which is the record the act reaches.
    const marker = placeOn(file, text.sheet).opensMarkerId as string;
    const asked = setBackBlank(file, marker, true);
    const back = lay(asked).rows.find((row) => row.blankBack)!;
    expect(back).toBeTruthy();
    const design = designOn(asked, back.sheet);
    expect(design.refusal).toBeNull();
    expect(design.frees).toEqual({ id: marker, rule: 'back' });
    expect(design.note).toMatch(/kept empty/);
    expect(design.note).toMatch(/printed on that back/);
    // And the press really turns the switch off rather than only promising to.
    const made = designAt(asked, back.sheet);
    expect(lay(made.file).rows.some((row) => row.blankBack)).toBe(false);
  });
});

describe('the leaf the writer put in', () => {
  const withLeaf = () => {
    const file = novel();
    const text = lay(file).rows.find((row) => row.says === 'Chapter opens' && row.sheet > 4)!;
    const spot = placeOn(file, text.sheet).opensMarkerId as string;
    return { file: setBlankPage(file, spot, true), spot };
  };

  it('is named by the offer, so the act can take it as the page goes in', () => {
    /**
     * A leaf and a page of its own are the same mechanism pointed two ways
     * (§9i), so they are the same page: a writer who asked for a leaf here and
     * now says what stands on it meant one page. Left in, the leaf would slide
     * behind the new page and read as it having landed a page early.
     */
    const { file, spot } = withLeaf();
    const leaf = lay(file).rows.find((row) => row.blankFor !== null)!;
    expect(designOn(file, leaf.sheet).leafId).toBe(spot);
  });

  it('is not claimed on a leaf the cutter left, which is filled rather than removed', () => {
    const file = novel();
    expect(designOn(file, leafInStory(file).sheet).leafId).toBeNull();
  });

  it('keeps the sheet when the page goes on it: the page in front, blank behind', () => {
    /**
     * **One page out and one back in** (§9ap, whose argument survives the
     * route changing under it). The sheet is two pages, one of them is now
     * the writer's own page and the other is still theirs, with its own × in
     * the rail — so the book is exactly as long as it was, on either parity.
     */
    const { file } = withLeaf();
    const leaf = lay(file).rows.find((row) => row.blankFor !== null)!;
    const made = designAt(file, leaf.sheet);
    const rows = lay(made.file).rows;
    const at = rows.findIndex((row) => row.partId === made.partId);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(rows[at]!.sheet).toBe(leaf.sheet);
    expect(rows[at + 1]!.blank).toBe(true);
    expect(rows).toHaveLength(lay(file).rows.length);
  });
});

describe('a blank page asked for on a blank page', () => {
  /**
   * **Another leaf, rather than a refusal** (§9ac, from Ken: *you should be
   * able to just put as many pages in between as you want*).
   *
   * §9aa made a leaf answer with a **record**, and §9r refused a second leaf
   * on the ground that two blanks in front of one page is not what anybody
   * means. Ken means it: between the end of one story and the next he wants a
   * picture page, a blank behind it and the story's own page, which is three
   * sheets where the room would give one. So the flag is a count and the act
   * is *put another one in*; taking one away is the page's own × (§9x), which
   * is one act in one place rather than a button whose words flip.
   */
  it('offers another, and each one is exactly one more page', () => {
    const file = novel();
    const { blocks, laid, rows } = lay(file);
    const leaf = leafInStory(file);
    const offer = blankOffer(
      pagePlace(laid.pages, blocks, leaf.sheet),
      rows,
      leaf.sheet,
      pagePlace(laid.pages, blocks, leaf.sheet + 1),
    );
    expect(offer.refusal).toBeNull();
    expect(offer.before.spot).not.toBeNull();
    expect(offer.pages).toBe(0);
    // **What a press puts in is one page, and two of them are a sheet**
    // (§9an), said before it is pressed.
    expect(offer.note).toMatch(/Put two in and nothing moves/);
    /**
     * **Each sheet is exactly two pages, and the side nothing is on changes**
     * (§9ad). §9ac asserted one page per leaf and had to measure the opening's
     * sheet rather than the book's length, because standing the recto rule
     * down made the total depend on the parity; two pages is an even number,
     * so the book's length, the opening's page **and the side it opens on**
     * are all answerable here.
     */
    const spot = offer.before.spot as string;
    const opens = (one: ProjectFile) => lay(one).rows.find((row) => row.markerId === spot && row.says === 'Chapter opens')!.sheet;
    const at = opens(file);
    const pages = lay(file).rows.length;
    for (const want of [1, 2, 3]) {
      const asked = setBlankPages(file, spot, want * SHEET);
      expect(lay(asked).rows.filter((row) => row.blankFor === spot)).toHaveLength(want * 2);
      expect(opens(asked)).toBe(at + want * 2);
      expect(lay(asked).rows.length).toBe(pages + want * 2);
      // The opening keeps the side of the paper it was on.
      expect(opens(asked) % 2).toBe(at % 2);
    }
  });

  it('says how many stand there, and offers to take one away', () => {
    const file = novel();
    const text = lay(file).rows.find((row) => row.says === 'Chapter opens' && row.sheet > 4)!;
    const asked = setBlankPages(file, placeOn(file, text.sheet).opensMarkerId as string, 2 * SHEET);
    const { blocks, laid, rows } = lay(asked);
    const leaf = rows.find((row) => row.blankFor !== null)!;
    const offer = blankOffer(
      pagePlace(laid.pages, blocks, leaf.sheet),
      rows,
      leaf.sheet,
      pagePlace(laid.pages, blocks, leaf.sheet + 1),
    );
    expect(offer.before.act).toBe('A blank page before this one');
    expect(offer.pages).toBe(2 * SHEET);
    expect(offer.fewer).toBe('Take one away');
  });

  /**
   * **One page, and not the run** (§9ac, and corrected by §9ao). This asserted
   * that a × took a whole **sheet**, which §9ad settled and §9an then broke
   * from the other side without noticing: §9an made *the unit a page and the
   * choice a side*, so the Add menu puts one page in while the × went on
   * taking two — the one act in the room that undid more than its opposite
   * did. One in, one out; two presses still make a sheet and two × still take
   * it, which the second half of this asserts.
   */
  it('takes one page and not the run, when a × is pressed on one of them', () => {
    const file = novel();
    const text = lay(file).rows.find((row) => row.says === 'Chapter opens' && row.sheet > 4)!;
    const spot = placeOn(file, text.sheet).opensMarkerId as string;
    const asked = setBlankPages(file, spot, 3 * SHEET);
    const rows = lay(asked).rows;
    const leaf = rows.find((row) => row.blankFor !== null)!;
    const after = removeBookPage(asked, leaf, pageRemoval(asked, rows, leaf.sheet));
    expect(lay(after).rows.filter((row) => row.blankFor !== null)).toHaveLength(3 * SHEET - 1);
    // And a second press takes the other side of that leaf.
    const twice = removeBookPage(after, leaf, pageRemoval(after, lay(after).rows, leaf.sheet));
    expect(lay(twice).rows.filter((row) => row.blankFor !== null)).toHaveLength(2 * SHEET);
  });
});

describe('a leaf among the front and back pages', () => {
  /**
   * **§9ab's page of art is gone and the leaf keeps the answer** (§9ar).
   *
   * §9aa refused here and named a route — *+ Add puts one in, and its row
   * drags to where you want it* — which was the two-step detour it existed to
   * remove, so §9ab gave the leaf a page of art in one press. That was right
   * about the complaint and was a **third landing rule for a blank page**,
   * which is what four reports have been about; the leaf is a page the design
   * route reaches, so it takes the same act as every other blank page in the
   * book and `newPageBefore` is no longer answered here at all.
   *
   * Nothing is lost: the page it makes stands where the leaf stood and its
   * own screen offers the picture and the full-page art, which is more than
   * the art page gave.
   */
  it('takes the same page of your own as every other blank page', () => {
    const file = addPart(novel(), 'dedication', { title: 'Dedication' }).file;
    const rows = lay(file).rows;
    const leaf = rows.find((row) => row.blank && row.markerId === null)!;
    expect(leaf).toBeTruthy();
    const offer = offerOn(file, leaf.sheet);
    expect(offer.refusal).toBe(PICTURE_BY_DESIGNING);
    expect(offer.newPageBefore).toBeNull();
    expect(designOn(file, leaf.sheet).refusal).toBeNull();
  });

  it('puts that page where the leaf was, rather than at the end of its half', () => {
    const file = addPart(novel(), 'dedication', { title: 'Dedication' }).file;
    const rows = lay(file).rows;
    const leaf = rows.find((row) => row.blank && row.markerId === null)!;
    const made = designAt(file, leaf.sheet);
    expect(partsOf(made.file).some((part) => part.id === made.partId)).toBe(true);
    /**
     * **Asserted on the page rather than on the order of the parts list**
     * (§9ar). §9ab's page of art was placed *by that order*, so the test for
     * it read the list; a page of your own is anchored to the record it
     * stands in front of, which is the whole of why it lands where it was
     * asked for — so what is pinned is the sheet the writer pointed at and
     * the book still being the length it was, which is the claim a writer
     * can check and the one every report has been about.
     */
    const after = lay(made.file).rows;
    expect(after.find((row) => row.partId === made.partId)!.sheet).toBe(leaf.sheet);
    expect(after).toHaveLength(rows.length);
  });
});
