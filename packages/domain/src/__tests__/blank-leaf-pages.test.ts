import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addGraphic,
  addMarker,
  addPart,
  addUnit,
  blankOffer,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  pagePlace,
  partsOf,
  pictureOffer,
  placeFigure,
  setBackBlank,
  setBlankPage,
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

describe('a picture asked for on a blank leaf', () => {
  it('is offered, where §9w refused and sent the writer a page along', () => {
    const file = novel();
    const offer = offerOn(file, leafInStory(file).sheet);
    expect(offer.refusal).toBeNull();
    expect(offer.of).toBe('story');
    expect(offer.spot).not.toBeNull();
  });

  it('lands on that leaf, and the book does not grow', () => {
    /**
     * The whole of *it should be on the page that I set*. The leaf is filled
     * rather than added to, which is what the cutter has always done with an
     * empty page — the only thing that was wrong is that nobody could ask it
     * to from the page it happens on.
     */
    const file = novel();
    const leaf = leafInStory(file);
    const before = lay(file).rows.length;
    const added = picture(file);
    const offer = offerOn(added.file, leaf.sheet);
    const beat = added.file.beats.find((one) =>
      one.manuscript.elements.some((element) => (element.id as string) === offer.spot),
    )!;
    const made = placeFigure(added.file, {
      beatId: beat.id as BeatId,
      assetId: added.asset.id,
      beforeElementId: offer.spot as never,
      attributes: offer.beforeOpening ? { bookPlace: 'page', bookBeforeOpening: true } : { bookPlace: 'page' },
    });
    const after = lay(made.file).rows;
    expect(after).toHaveLength(before);
    expect(after.find((row) => row.sheet === leaf.sheet)!.says).toBe('Illustration');
  });

  it('takes a page of its own and nothing else', () => {
    /**
     * A box is cut into the words and a graphic is set over them, so on a page
     * with no words both would ride a block that is on the page ahead and draw
     * **there** — §9w's own fault wearing two more controls. The room makes
     * them absent on this answer.
     */
    const file = novel();
    expect(offerOn(file, leafInStory(file).sheet).ownPageOnly).toBe(true);
    const text = lay(file).rows.find((row) => row.says === 'Text' || row.says === 'Chapter opens')!;
    expect(offerOn(file, text.sheet).ownPageOnly).toBe(false);
  });

  it('is offered on every blank leaf of the story, which is what the report was', () => {
    /**
     * **Walking the book rather than the one page the report named** (§9x's
     * own lesson). Every chapter of a book whose chapters open on a right-hand
     * page leaves a leaf behind it, so *the page I want* is not one page but
     * most of the empty ones in the book — and a test that asked about the
     * first would have passed over a second kind that still answered nothing.
     */
    const file = novel();
    const rows = lay(file).rows;
    const leaves = rows.filter((row) => row.blank && row.partId === null && row.markerId !== null);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      const offer = offerOn(file, leaf.sheet);
      expect(offer.refusal).toBeNull();
      expect(offer.spot).not.toBeNull();
    }
  });

  it('is refused on a leaf kept empty on purpose, naming the switch rather than the recto rule', () => {
    const file = novel();
    const text = lay(file).rows.find((row) => row.says === 'Chapter opens' && row.sheet > 4)!;
    // The back of a chapter's own page (§9r), which is the switch the refusal
    // has to name — a leaf asked for by the page in front of it.
    const asked = setBackBlank(file, placeOn(file, text.sheet).opensMarkerId as string, true);
    const back = lay(asked).rows.find((row) => row.blankBack)!;
    expect(back).toBeTruthy();
    const offer = offerOn(asked, back.sheet);
    expect(offer.spot).toBeNull();
    expect(offer.refusal).toMatch(/kept empty/);
    expect(offer.refusal).toMatch(/page in front/);
  });
});

describe('the leaf the writer put in', () => {
  const withLeaf = () => {
    const file = novel();
    const text = lay(file).rows.find((row) => row.says === 'Chapter opens' && row.sheet > 4)!;
    const spot = placeOn(file, text.sheet).opensMarkerId as string;
    return { file: setBlankPage(file, spot, true), spot };
  };

  it('is named by the offer, so the act can take it as the picture goes in', () => {
    /**
     * A leaf and a page of its own are the same mechanism pointed two ways
     * (§9i), so they are the same page: a writer who asked for a leaf here and
     * now says what stands on it meant one page. Left in, the leaf would slide
     * behind the picture and read as the picture having landed a page early.
     */
    const { file, spot } = withLeaf();
    const leaf = lay(file).rows.find((row) => row.blankFor !== null)!;
    expect(offerOn(file, leaf.sheet).takesLeaf).toBe(spot);
  });

  it('is not claimed on a leaf the cutter left, which is filled rather than removed', () => {
    const file = novel();
    expect(offerOn(file, leafInStory(file).sheet).takesLeaf).toBeNull();
  });

  it('gives one page rather than two once the picture is in', () => {
    const { file, spot } = withLeaf();
    const leaf = lay(file).rows.find((row) => row.blankFor !== null)!;
    const offer = offerOn(file, leaf.sheet);
    const added = picture(file);
    const beat = added.file.beats.find((one) =>
      one.manuscript.elements.some((element) => (element.id as string) === offer.spot),
    )!;
    const made = placeFigure(added.file, {
      beatId: beat.id as BeatId,
      assetId: added.asset.id,
      beforeElementId: offer.spot as never,
      attributes: { bookPlace: 'page' },
    });
    const kept = lay(made.file).rows;
    const taken = lay(setBlankPage(made.file, offer.takesLeaf as string, false)).rows;
    // Keeping the leaf leaves the book with **both** — the picture and the
    // leaf the writer asked for, which is the picture reading as a page early.
    expect(kept.some((row) => row.says === 'Illustration')).toBe(true);
    expect(kept.some((row) => row.blankFor !== null)).toBe(true);
    // Taking it is what they asked for: one page, with the picture on it.
    expect(taken.some((row) => row.says === 'Illustration')).toBe(true);
    expect(taken.some((row) => row.blankFor !== null)).toBe(false);
    expect(taken.length).toBeLessThan(kept.length);
  });
});

describe('a blank page asked for a blank page', () => {
  it('is refused with the reason, rather than hanging a second leaf on the page ahead', () => {
    /**
     * §9aa makes a leaf answer with a **record**, which this act would hang
     * another leaf on — and two blanks in front of one page is not what
     * anybody means by *put a blank page here* while standing on a blank page.
     */
    const file = novel();
    const { blocks, laid, rows } = lay(file);
    const leaf = leafInStory(file);
    const offer = blankOffer(pagePlace(laid.pages, blocks, leaf.sheet), rows, leaf.sheet);
    expect(offer.act).toBeNull();
    expect(offer.spot).toBeNull();
    expect(offer.refusal).toMatch(/blank already/);
    expect(offer.refusal).toMatch(/right-hand page/);
  });

  it('still takes away the leaf the writer put in', () => {
    const file = novel();
    const text = lay(file).rows.find((row) => row.says === 'Chapter opens' && row.sheet > 4)!;
    const asked = setBlankPage(file, placeOn(file, text.sheet).opensMarkerId as string, true);
    const { blocks, laid, rows } = lay(asked);
    const leaf = rows.find((row) => row.blankFor !== null)!;
    const offer = blankOffer(pagePlace(laid.pages, blocks, leaf.sheet), rows, leaf.sheet);
    expect(offer.act).toBe('Take this blank page away');
  });
});

describe('a leaf among the front and back pages', () => {
  it('takes a page of art, standing where the leaf is', () => {
    /**
     * The walk forward stops at a part without answering with it, because a
     * part's picture is its own art or an inset in its words: put there, a
     * picture asked for on the leaf would draw on the page ahead.
     *
     * **§9ab corrects where that left the writer.** §9aa refused and named a
     * route — *+ Add puts one in, and its row drags to where you want it* —
     * which is the two-step detour §9aa was written to remove, and is what
     * Ken reported as being locked out of the page. The leaf answers with a
     * **position** instead: a page of art goes in front of the part it stands
     * before, which is one press.
     */
    const file = addPart(novel(), 'dedication', { title: 'Dedication' }).file;
    const rows = lay(file).rows;
    const leaf = rows.find((row) => row.blank && row.markerId === null)!;
    expect(leaf).toBeTruthy();
    const offer = offerOn(file, leaf.sheet);
    expect(offer.refusal).toBeNull();
    // Not a record to hang a picture from — a place to put a page.
    expect(offer.spot).toBeNull();
    expect(offer.newPageBefore).toBe(rows.find((row) => row.sheet > leaf.sheet && row.partId !== null)!.partId);
    // And it is a page of its own, as every leaf is (§9aa).
    expect(offer.ownPageOnly).toBe(true);
  });

  it('puts the page of art where the leaf was, rather than at the end of its half', () => {
    const file = addPart(novel(), 'dedication', { title: 'Dedication' }).file;
    const leaf = lay(file).rows.find((row) => row.blank && row.markerId === null)!;
    const before = offerOn(file, leaf.sheet).newPageBefore as string;
    const made = addPart(file, 'plate', { inFront: true }, before);
    const order = partsOf(made.file).map((part) => part.id);
    expect(order[order.indexOf(before) - 1]).toBe(made.partId);
  });
});
