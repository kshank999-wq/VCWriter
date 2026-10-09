import { describe, expect, it } from 'vitest';
import {
  INSET_SPAN,
  INSET_STANDOFF,
  bookPageRows,
  createProjectFile,
  figurePlacement,
  headElement,
  movePictureTo,
  pagePlace,
  pictureOffer,
  placeBookFigure,
  placeFigure,
  topElement,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **The box a writer drew** (addendum 20 §9af, from Ken: *it doesn't allow me
 * to move the box anywhere. It doesn't allow me to resize it. And it pops the
 * box on the wrong page… I was trying on page 85. It ended up putting the box
 * on page 84*).
 *
 * The slide and the corner are a drag, and jsdom gives every box a zero rect,
 * so those were driven in the real room and the measurements are in the
 * addendum. What is here is the half a test can hold: that a placement says
 * only what it changes, and that the head of a page is the first thing that
 * begins on it.
 */

const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });

/** A novel with one picture cut into its words, so the figure is real. */
const withBox = (span: number, standoff: number): { file: ProjectFile; id: string } => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  file = updateBeat(file, file.beats[0]!.id, {
    manuscript: { elements: [para('p1', 'One.'), para('p2', 'Two.')] },
  });
  const made = placeFigure(file, {
    beatId: file.beats[0]!.id,
    beforeElementId: 'p2' as never,
    attributes: { bookPlace: 'left', bookSpan: span, bookStandoff: standoff, bookBoxHeight: 0.7 },
  });
  return { file: made.file, id: made.elementId as string };
};

const placementOf = (file: ProjectFile, id: string) =>
  figurePlacement(file.beats.flatMap((beat) => beat.manuscript.elements).find((one) => (one.id as string) === id)!);

describe('a placement says what it changes', () => {
  it('keeps the width a box was drawn to when only its side is given', () => {
    /**
     * The slide passes a placement carrying nothing but `place`, so this is
     * every slide: the width came back as `INSET_SPAN.default` and the border
     * as the default with it. Measured in the room before the fix — a box
     * dropped at 46% of the measure read *1.67 × 3.21 in · 40% of the
     * measure* afterwards, and 40% is not a width anybody chose.
     */
    const { file, id } = withBox(0.46, 0.9);
    const slid = placeBookFigure(file, id, { place: 'right' });
    expect(placementOf(slid, id).place).toBe('right');
    expect(placementOf(slid, id).span).toBeCloseTo(0.46, 5);
    expect(placementOf(slid, id).standoff).toBeCloseTo(0.9, 5);
    // And the drawn height, which has been read back off the element since
    // §9z — the argument this fix is the rest of.
    expect(placementOf(slid, id).boxHeight).toBeCloseTo(0.7, 5);
  });

  it('still takes a width when one is given, and defaults only where the figure has none', () => {
    const { file, id } = withBox(0.46, 0.9);
    expect(placementOf(placeBookFigure(file, id, { place: 'left', span: 0.3 }), id).span).toBeCloseTo(0.3, 5);

    let bare = createProjectFile({ title: 'Bare', format: 'novel', author: 'M. Shank' });
    bare = updateBeat(bare, bare.beats[0]!.id, { manuscript: { elements: [para('p1', 'One.')] } });
    const made = placeFigure(bare, { beatId: bare.beats[0]!.id, beforeElementId: 'p1' as never, attributes: {} });
    const inset = placeBookFigure(made.file, made.elementId as string, { place: 'left' });
    expect(placementOf(inset, made.elementId as string).span).toBeCloseTo(INSET_SPAN.default, 5);
    expect(placementOf(inset, made.elementId as string).standoff).toBeCloseTo(INSET_STANDOFF.default, 5);
  });
});

/**
 * Hand-made pages, as the laying's own tests use: the rules are about which
 * piece a page opens with, and made-up line counts say that exactly.
 */
const BLOCKS = [
  { id: 'm1', kind: 'chapter_opening' },
  { id: 'p1', kind: 'paragraph' },
  { id: 'p2', kind: 'paragraph' },
  { id: 'p3', kind: 'paragraph' },
] as never;

/** Page 1 opens the chapter and p1 runs onto page 2; p2 begins there. */
const SPLIT = [
  { sheet: 1, counted: '1', pieces: [{ blockId: 'm1', from: 0, to: 8 }, { blockId: 'p1', from: 0, to: 12, cut: true }] },
  { sheet: 2, counted: '2', pieces: [{ blockId: 'p1', from: 12, to: 20, cut: true }, { blockId: 'p2', from: 0, to: 9 }] },
  { sheet: 3, counted: '3', pieces: [{ blockId: 'p3', from: 0, to: 9 }] },
] as never;

/** Page 2 is the middle of one long paragraph and nothing else. */
const MIDDLE = [
  { sheet: 1, counted: '1', pieces: [{ blockId: 'p1', from: 0, to: 30, cut: true }] },
  { sheet: 2, counted: '2', pieces: [{ blockId: 'p1', from: 30, to: 60, cut: true }] },
  { sheet: 3, counted: '3', pieces: [{ blockId: 'p1', from: 60, to: 70, cut: true }, { blockId: 'p2', from: 0, to: 9 }] },
] as never;

describe('the head of a page is the first thing that begins on it', () => {
  it('is not the tail of a paragraph that began on the page before', () => {
    /**
     * The fault Ken reported. Everything built on this answer puts its thing
     * *in front of* the element, so answering with the tail sent a picture —
     * and a blank sheet — back to wherever that paragraph began. Measured in
     * the room before the fix: *Put a blank sheet here…* on page 12 took page
     * 11 from 1,538 characters to 781.
     */
    expect(pagePlace(SPLIT, BLOCKS, 2).elementId).toBe('p2');
    expect(headElement(SPLIT[1] as never, new Map((BLOCKS as never as { id: string }[]).map((one) => [one.id, one as never])))).toBe('p2');
    // And nothing further back for an act here to reach.
    expect(pagePlace(SPLIT, BLOCKS, 2).elementBegins).toBeNull();
  });

  it('is the same element as the top of the page wherever nothing runs onto it', () => {
    // Which is most pages, and is why no existing book moves.
    for (const sheet of [1, 3]) {
      const place = pagePlace(SPLIT, BLOCKS, sheet);
      expect(place.topElementId).toBe(place.elementId);
    }
  });

  it('and a page of its own goes in at the break at the top of the page', () => {
    /**
     * Two positions rather than two answers (§9af): a plate is *reached*
     * rather than placed and waits for the next leaf (§9q), so anchored in
     * front of the tail it is reached on the page before and takes this one,
     * with that page left exactly as full as it was.
     */
    expect(pagePlace(SPLIT, BLOCKS, 2).topElementId).toBe('p1');
    expect(topElement(SPLIT[1] as never, new Map((BLOCKS as never as { id: string }[]).map((one) => [one.id, one as never])))).toBe('p1');
  });

  it('answers with the tail where the page is nothing but a tail, and says where it reaches', () => {
    // Silence would take every act off the page, which is §9aa's own fault.
    const place = pagePlace(MIDDLE, BLOCKS, 2);
    expect(place.elementId).toBe('p1');
    expect(place.elementBegins).toBe(1);
  });

  it('is the one reading a row and a place both ask', () => {
    // The row kept its own copy — *which is `pagePlace`'s answer for one
    // sheet*, said in its own doc while skipping neither a stand-in nor a
    // tail — so the two disagreed about where a picture dropped here goes in.
    const rows = bookPageRows(SPLIT, BLOCKS);
    expect(rows.map((row) => row.elementId)).toEqual(['p1', 'p2', 'p3']);
    expect(rows[1]!.elementId).toBe(pagePlace(SPLIT, BLOCKS, 2).elementId);
  });
});

describe('what a picture asked for on such a page is offered', () => {
  it('names the paragraph that begins there, and the break above it for a page of its own', () => {
    const rows = bookPageRows(SPLIT, BLOCKS);
    const offer = pictureOffer(pagePlace(SPLIT, BLOCKS, 2), rows, 2);
    expect(offer.spot).toBe('p2');
    expect(offer.pageSpot).toBe('p1');
    expect(offer.refusal).toBeNull();
  });

  it('says where a box will really stand where the page is the middle of one paragraph', () => {
    const rows = bookPageRows(MIDDLE, BLOCKS);
    const offer = pictureOffer(pagePlace(MIDDLE, BLOCKS, 2), rows, 2);
    expect(offer.note).toContain('page 1');
    expect(offer.note).toContain('middle of one paragraph');
    // Said, never refused (§9w's own answer to this shape).
    expect(offer.refusal).toBeNull();
    expect(offer.spot).toBe('p1');
  });

  it('says nothing about it on an ordinary page', () => {
    const rows = bookPageRows(SPLIT, BLOCKS);
    expect(pictureOffer(pagePlace(SPLIT, BLOCKS, 3), rows, 3).note).toBeNull();
    // A sentence on most pages of a novel would be noise, which is the whole
    // reason the two positions are a reading rather than a warning.
    expect(pictureOffer(pagePlace(SPLIT, BLOCKS, 2), rows, 2).note).toBeNull();
  });
});

describe('moving a picture reads what the picture is', () => {
  const offer = { spot: 'p2', pageSpot: 'p1', of: 'story' as const, beforeOpening: false, note: null, takesLeaf: null, ownPageOnly: false, newPageBefore: null, refusal: null };
  const order = (file: ProjectFile) => file.beats.flatMap((beat) => beat.manuscript.elements).map((one) => one.id as string);

  it('takes a box cut into the text to the paragraph that begins on the page', () => {
    const { file, id } = withBox(0.46, INSET_STANDOFF.default);
    expect(order(movePictureTo(file, id, offer))).toEqual(['p1', id, 'p2']);
  });

  it('and a page of its own to the break at the top of it', () => {
    // No caller has to choose, which is what keeps the rail's two drops and
    // the dialog's three buttons from disagreeing.
    const { file, id } = withBox(0.46, INSET_STANDOFF.default);
    const plate = placeBookFigure(file, id, { place: 'page' });
    expect(order(movePictureTo(plate, id, offer))).toEqual([id, 'p1', 'p2']);
  });
});
