import { describe, expect, it } from 'vitest';
import {
  addMarker,
  createProjectFile,
  drawnFigurePlace,
  figurePlacement,
  moveFigureBefore,
  moveFigureTo,
  pictureLines,
  placeBookFigure,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **A picture lands where it is drawn** (addendum 20 §9z, from Ken: *I was
 * trying to fill the bottom of a last page of a section with a picture but it
 * doesn't allow me to move the picture around or place it somewhere — it
 * places it and then it's just stuck there*).
 *
 * Three faults under one report, and none of them is about the picture: a
 * figure could only ever be anchored **before** an element, so the foot of a
 * page whose text runs short — the one place he was reaching for — had no
 * anchor at all; a drawn box was **always cut into the text** however wide it
 * was drawn; and an empty box was **measured as a third of a page** whatever
 * size the drag gave it, so it rarely fitted where it was put and the cutter
 * moved it on.
 */

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  file = addMarker(file, { unitId: file.units[0]!.id, kind: 'chapter', title: 'The Road' }).file;
  return updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        { id: 'p1' as never, type: 'paragraph', text: 'One.', characterId: null, attributes: {} },
        { id: 'p2' as never, type: 'paragraph', text: 'Two.', characterId: null, attributes: {} },
        { id: 'f1' as never, type: 'figure', text: '', characterId: null, attributes: {} },
        { id: 'p3' as never, type: 'paragraph', text: 'Three.', characterId: null, attributes: {} },
      ],
    },
  });
};

const order = (file: ProjectFile): string[] =>
  file.beats[0]!.manuscript.elements.map((element) => element.id as string);

describe('where a picture is anchored', () => {
  it('stands after the last words, which is the foot of the page', () => {
    // The position the module could not express: everything after the words
    // and before whatever comes next. Without it a picture asked for in the
    // white under a section's closing line had nowhere to be but above it.
    const file = moveFigureTo(novel(), 'f1', { elementId: 'p3', after: true });
    expect(order(file)).toEqual(['p1', 'p2', 'p3', 'f1']);
  });

  it('stands in front of a paragraph where that is what was asked', () => {
    const file = moveFigureTo(novel(), 'f1', { elementId: 'p1', after: false });
    expect(order(file)).toEqual(['f1', 'p1', 'p2', 'p3']);
  });

  it('is one act, so the older spelling is the same insertion', () => {
    // `moveFigureBefore` is `moveFigureTo` with `after` false and nothing
    // else: two functions here would be two answers to where a picture goes.
    expect(order(moveFigureBefore(novel(), 'f1', 'p2'))).toEqual(order(moveFigureTo(novel(), 'f1', { elementId: 'p2', after: false })));
  });

  it('changes nothing where the anchor is the picture itself', () => {
    expect(order(moveFigureTo(novel(), 'f1', { elementId: 'f1', after: true }))).toEqual(order(novel()));
  });

  it('puts the picture down once, however many beats name the anchor', () => {
    /**
     * It inserted wherever the anchor was found (§9z), so a document holding
     * one id in two beats came back with **two pictures** — one act making a
     * second copy, which is the one failure a move may never have. Nothing
     * refuses a repeated id, so the act does not depend on one.
     */
    const start = novel();
    const file: ProjectFile = {
      ...start,
      beats: [
        ...start.beats,
        {
          ...start.beats[0]!,
          id: '9f1c0f3a-0000-4000-8000-000000000001' as never,
          manuscript: { elements: [{ id: 'p3' as never, type: 'paragraph', text: 'Again.', characterId: null, attributes: {} }] },
        },
      ],
    };
    const moved = moveFigureTo(file, 'f1', { elementId: 'p3', after: true });
    const all = moved.beats.flatMap((beat) => beat.manuscript.elements.filter((one) => (one.id as string) === 'f1'));
    expect(all).toHaveLength(1);
  });
});

describe('what a drawn box is', () => {
  it('is cut into the text at the side it was drawn, while it is narrow enough for words beside it', () => {
    expect(drawnFigurePlace(0.3, 'left')).toBe('left');
    expect(drawnFigurePlace(0.6, 'right')).toBe('right');
  });

  it('is across the measure once it is wider than an inset may be', () => {
    /**
     * The band's own number rather than a new one: `INSET_SPAN.max` is the
     * widest a picture can be cut in at and still leave a line of words, so
     * past it there is nothing to cut into. It used to be clamped to 60% and
     * called *cut in at the left*, which is a picture that cannot be what it
     * was drawn as.
     */
    expect(drawnFigurePlace(0.61, 'left')).toBe('measure');
    expect(drawnFigurePlace(1, 'right')).toBe('measure');
  });
});

describe('how tall an empty box is', () => {
  it('is a third of a page where nothing was drawn, as it always was', () => {
    // Every box made before this carries no drawn height, so none of them
    // moves — which the whole suite passing unedited is the proof of.
    expect(pictureLines(undefined, 300, 20, 30)).toBe(10);
  });

  it('is the box the writer drew, where they drew one', () => {
    // A share of the measure, so the markup's aspect ratio and the hole the
    // cutter keeps for it are the same number read twice.
    expect(pictureLines(undefined, 300, 20, 30, 0.5)).toBe(8);
    expect(pictureLines(undefined, 300, 20, 30, 0.2)).toBe(3);
  });

  it('is the picture’s own shape the moment there is one', () => {
    // §9m unchanged: only the width is dragged and the height follows from
    // the proportions, so the drawn height is read while the box is empty
    // and never after.
    const picture = { data: '', altText: '', width: 300, height: 150 };
    expect(pictureLines(picture, 300, 20, 30, 0.9)).toBe(pictureLines(picture, 300, 20, 30));
  });

  it('is kept on the record through every place a picture can take', () => {
    // It is the size the box was dragged to rather than anything about the
    // arrangement, so making it an inset and making it a measure figure
    // again does not lose it — and redrawing is not the only way back.
    let file = placeBookFigure(novel(), 'f1', { place: 'measure', boxHeight: 0.35 });
    expect(figurePlacement(file.beats[0]!.manuscript.elements[2]!).boxHeight).toBeCloseTo(0.35);
    file = placeBookFigure(file, 'f1', { place: 'left', span: 0.4 });
    expect(figurePlacement(file.beats[0]!.manuscript.elements[2]!).boxHeight).toBeCloseTo(0.35);
    file = placeBookFigure(file, 'f1', { place: 'measure' });
    expect(figurePlacement(file.beats[0]!.manuscript.elements[2]!).boxHeight).toBeCloseTo(0.35);
  });

  it('is absent on a figure nobody drew a box for', () => {
    expect(figurePlacement(novel().beats[0]!.manuscript.elements[2]!).boxHeight).toBe(0);
  });
});
