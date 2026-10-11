import { describe, expect, it } from 'vitest';
import {
  INSET_RULE,
  INSET_SPAN,
  MEASURE_SPAN,
  addMarker,
  bookBlocks,
  bookNames,
  bookSettingsOf,
  createProjectFile,
  cutsIntoText,
  drawnFigurePlace,
  droppedFigurePlace,
  figurePlacement,
  geometryOf,
  layPages,
  pictureLines,
  placeBookFigure,
  renderBookBlock,
  sizeBookFigure,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **The picture placed rather than the box drawn** (addendum 20 §9ak, from
 * Ken: *maybe the best way is to insert a picture on the page and then resize
 * that picture to where you want it to be. You can move it around. You can
 * resize it with the corner pins, but it stays proportional to its original
 * dimensions. Then you place it on the page and the text will be cut around
 * that picture. Instead of trying to create a box first, which it seems to
 * cause errors… but we can make a rule that when you place a picture where
 * the text is going to cut around it, it has to be one of its borders aligned
 * with the margin… and can only be as wide as half of the text area. But if
 * there is a blank lower half of the page, that you can drag and drop it in
 * there and resize it and it won't touch the text*).
 *
 * Four rules, and three of them are one sentence each: a corner drag keeps
 * the picture's proportions, a picture the words run beside is flush to a
 * margin and at most **half** the measure, and one standing in the white
 * below them takes whatever width it is dragged to and the text is left
 * alone.
 */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ASSET = '22222222-2222-4222-8222-222222222222';

const para = (id: string, text: string) => ({
  id,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A chapter with a picture in the middle of it, and a picture nobody has filled. */
const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  file = {
    ...file,
    assets: [
      ...file.assets,
      { id: ASSET as never, kind: 'image', name: 'Harbour', data: PNG, width: 400, height: 200, altText: '', caption: '', createdAt: file.project.createdAt },
    ],
  } as ProjectFile;
  file = addMarker(file, { unitId: file.units[0]!.id, kind: 'chapter', title: 'The Road' }).file;
  return updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        para('p1', `One. ${'word '.repeat(60)}`),
        { id: 'f1' as never, type: 'figure', text: '', characterId: null, attributes: { assetId: ASSET } },
        para('p2', `Two. ${'word '.repeat(60)}`),
        { id: 'box' as never, type: 'figure', text: '', characterId: null, attributes: {} },
      ],
    },
  } as never);
};

const attributesOf = (file: ProjectFile, id: string): Record<string, unknown> =>
  file.beats[0]!.manuscript.elements.find((one) => (one.id as string) === id)!.attributes as Record<string, unknown>;

describe('a corner dragged on a picture', () => {
  it('sets the width and never the height, so the picture keeps its proportions', () => {
    /**
     * The whole of *it stays proportional to its original dimensions*: the
     * drag says how wide, and how tall follows from the file. A height is
     * never written for a figure with a picture in it, so there is nothing
     * for the picture to sit letterboxed inside.
     */
    const file = sizeBookFigure(placeBookFigure(novel(), 'f1', { place: 'left', span: 0.4 }), 'f1', 0.3, 0.9);
    expect(figurePlacement(file.beats[0]!.manuscript.elements[1]!).span).toBeCloseTo(0.3);
    expect(figurePlacement(file.beats[0]!.manuscript.elements[1]!).boxHeight).toBe(0);
    expect(attributesOf(file, 'f1').bookBoxHeight).toBeUndefined();
  });

  it('throws a drawn height away, because the drag has just said otherwise', () => {
    /**
     * **This is the *errors* in Ken's message.** §9aj taught the cutter to
     * keep the height a box was drawn to even once a picture arrived, which
     * is right for a box nobody has touched since — and a corner drag is the
     * one act that is a new statement about the size, so after it the drawn
     * height is a second answer. It goes: `boxHeight`'s own argument, that a
     * stored answer is for a figure nobody has given one and never for a
     * caller who has just mentioned the field.
     */
    const drawn = placeBookFigure(novel(), 'f1', { place: 'left', span: 0.4, boxHeight: 0.8 });
    expect(figurePlacement(drawn.beats[0]!.manuscript.elements[1]!).boxHeight).toBeCloseTo(0.8);
    const resized = sizeBookFigure(drawn, 'f1', 0.35);
    expect(figurePlacement(resized.beats[0]!.manuscript.elements[1]!).boxHeight).toBe(0);
    expect(figurePlacement(resized.beats[0]!.manuscript.elements[1]!).span).toBeCloseTo(0.35);
  });

  it('gives an empty box the height it was dragged to, there being no picture to take proportions from', () => {
    // §9af's finding unchanged, and the only kind of figure a corner has ever
    // given a height to.
    const file = sizeBookFigure(placeBookFigure(novel(), 'box', { place: 'right', span: 0.4 }), 'box', 0.3, 0.55);
    const placed = figurePlacement(file.beats[0]!.manuscript.elements[3]!);
    expect(placed.span).toBeCloseTo(0.3);
    expect(placed.boxHeight).toBeCloseTo(0.55);
  });

  it('changes nothing where the id names no element', () => {
    const file = novel();
    expect(sizeBookFigure(file, 'nothing-here', 0.3)).toBe(file);
  });
});

describe('how wide a picture the text runs round may be', () => {
  it('is half the measure at most, which is the rule the screens say', () => {
    expect(INSET_SPAN.max).toBe(0.5);
    // One copy of the sentence, so the band and the screens cannot part.
    expect(INSET_RULE).toContain('half the measure');
    expect(INSET_RULE).toContain('flush to one margin');
  });

  it('is clamped there however wide the corner is dragged', () => {
    const file = sizeBookFigure(placeBookFigure(novel(), 'f1', { place: 'right', span: 0.4 }), 'f1', 0.95);
    expect(figurePlacement(file.beats[0]!.manuscript.elements[1]!).span).toBe(0.5);
  });

  it('is a picture across the measure past that, rather than a narrower cut-in', () => {
    // `drawnFigurePlace` reads the band, so the line is in one place: a
    // picture too wide for words beside it is not a picture with words beside
    // it, whichever gesture asked for it.
    expect(drawnFigurePlace(0.5, 'left')).toBe('left');
    expect(drawnFigurePlace(0.55, 'left')).toBe('measure');
  });

  it('is flush to the margin it cuts in at, which is what the markup says', () => {
    const file = placeBookFigure(novel(), 'f1', { place: 'left', span: 0.4 });
    const wrapped = bookBlocks(file).find((block) => block.inset)!;
    expect(wrapped.inset?.place).toBe('left');
    const settings = bookSettingsOf(file);
    const html = renderBookBlock(wrapped, {
      settings,
      geometry: geometryOf(settings, 40),
      pictures: new Map([[ASSET, { data: PNG, altText: '', width: 400, height: 200 }]]),
      names: bookNames(file),
      contents: [],
    } as never);
    // A float at the left is flush to the left margin by being a float; the
    // markup names the side and the width and nothing about where it starts.
    expect(html).toContain('bk-inset bk-inset-left');
    expect(html).toContain('width:40%');
  });
});

describe('a picture standing in the white below the words', () => {
  it('may be narrowed, which a picture across the measure could not be', () => {
    /**
     * It had no width at all: `placeBookFigure` stripped `bookSpan` on the
     * way in, so a corner dragged on a picture at the foot of a page was
     * thrown away before it reached the record. `MEASURE_SPAN` is its band
     * and its default is the whole measure.
     */
    expect(MEASURE_SPAN.default).toBe(1);
    const file = sizeBookFigure(novel(), 'f1', 0.45);
    expect(figurePlacement(file.beats[0]!.manuscript.elements[1]!).place).toBe('measure');
    expect(figurePlacement(file.beats[0]!.manuscript.elements[1]!).span).toBeCloseTo(0.45);
  });

  it('writes nothing down while it is the whole measure, so no book already set moves', () => {
    const file = sizeBookFigure(novel(), 'f1', 1);
    expect(attributesOf(file, 'f1')).toEqual({ assetId: ASSET });
    expect(figurePlacement(file.beats[0]!.manuscript.elements[1]!).span).toBe(1);
  });

  it('carries its width onto the block and into the markup, centred', () => {
    const file = sizeBookFigure(novel(), 'f1', 0.4);
    const block = bookBlocks(file).find((one) => one.kind === 'figure' && one.id === 'f1')!;
    expect(block.span).toBeCloseTo(0.4);
    const settings = bookSettingsOf(file);
    const html = renderBookBlock(block, {
      settings,
      geometry: geometryOf(settings, 40),
      pictures: new Map([[ASSET, { data: PNG, altText: '', width: 400, height: 200 }]]),
      names: bookNames(file),
      contents: [],
    } as never);
    expect(html).toContain('width:40.000%');
    expect(html).toContain('margin-left:auto;margin-right:auto');
  });

  it('carries no width while it is the whole measure, so the markup is what it was', () => {
    const file = novel();
    const block = bookBlocks(file).find((one) => one.kind === 'figure' && one.id === 'f1')!;
    expect(block.span).toBeUndefined();
    const settings = bookSettingsOf(file);
    const html = renderBookBlock(block, {
      settings,
      geometry: geometryOf(settings, 40),
      pictures: new Map([[ASSET, { data: PNG, altText: '', width: 400, height: 200 }]]),
      names: bookNames(file),
      contents: [],
    } as never);
    expect(html).not.toContain('margin-left:auto');
  });

  it('takes a hole the size of the width it now has', () => {
    /**
     * The measurement and the markup are one number read twice: a picture at
     * half the measure is half as tall as it was, so the cutter must keep
     * half the hole — or the page would reserve the full-measure height for
     * it and the white Ken is filling would still be there.
     */
    const picture = { data: PNG, altText: '', width: 400, height: 200 };
    const whole = pictureLines(picture, 400, 20, 35);
    const half = pictureLines(picture, 400, 20, 35, 0, 0.5);
    expect(whole).toBe(10);
    expect(half).toBe(5);
    // A drawn height is already a share of the measure, so a span does not
    // scale it twice.
    expect(pictureLines(picture, 400, 20, 35, 0.5, 0.5)).toBe(pictureLines(picture, 400, 20, 35, 0.5));
  });

  it('shortens the book rather than lengthening it, which is what the white was for', () => {
    const full = novel();
    const narrowed = sizeBookFigure(full, 'f1', 0.4);
    const lay = (file: ProjectFile): number => {
      const blocks = bookBlocks(file);
      const measured = new Map(
        blocks.map((block) => [
          block.id,
          block.kind === 'figure'
            ? pictureLines({ data: PNG, altText: '', width: 400, height: 200 }, 400, 20, 35, block.boxHeight ?? 0, block.span ?? 1) + 1
            : block.kind === 'paragraph'
              ? 9
              : 4,
        ]),
      );
      const settings = bookSettingsOf(file);
      return layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file)).pages.length;
    };
    expect(lay(narrowed)).toBeLessThanOrEqual(lay(full));
  });
});

describe('whether the words have anything to run round it', () => {
  it('says so where there is a paragraph after it', () => {
    const file = placeBookFigure(novel(), 'f1', { place: 'left', span: 0.4 });
    expect(cutsIntoText(bookBlocks(file), 'f1')).toBe(true);
  });

  it('says so where there is not, which §8 draws across the measure and said nowhere', () => {
    /**
     * An inset with nothing after it is pushed as a block of its own and
     * draws full width — §8's rule since the inset was built, and right,
     * there being no words to run beside it. What was missing is the
     * **sentence**: a writer who asks for the text to run round a picture at
     * the end of a chapter gets a full-measure picture and no reason, and
     * concludes the side did not take.
     */
    let file = novel();
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: {
        elements: [
          para('p1', 'One.'),
          { id: 'f1' as never, type: 'figure', text: '', characterId: null, attributes: { assetId: ASSET } },
        ],
      },
    } as never);
    file = placeBookFigure(file, 'f1', { place: 'right', span: 0.4 });
    expect(cutsIntoText(bookBlocks(file), 'f1')).toBe(false);
    // And the block really is the standalone figure, which is what the
    // sentence is about.
    expect(bookBlocks(file).some((block) => block.kind === 'figure' && block.id === 'f1')).toBe(true);
  });

  it('is false for a picture that is not an inset at all', () => {
    expect(cutsIntoText(bookBlocks(novel()), 'f1')).toBe(false);
  });
});

describe('what a picture dropped on the page becomes', () => {
  it('is a picture across the measure where it lands below the words', () => {
    // `after` is set only where the pointer was past every block on the page,
    // which is the white Ken is filling: there is nothing there to cut into.
    expect(droppedFigurePlace('left', { elementId: 'p2', after: true })).toBe('measure');
    expect(droppedFigurePlace('right', { elementId: 'p2', after: true })).toBe('measure');
  });

  it('cuts in at the side it was dropped where it lands in the words', () => {
    expect(droppedFigurePlace('left', { elementId: 'p2', after: false })).toBe('left');
    expect(droppedFigurePlace('right', { elementId: 'p2', after: false })).toBe('right');
  });

  it('cuts in at that side where the drop named no block at all', () => {
    // A page with no text block to read: the side is all there is to go on.
    expect(droppedFigurePlace('right', null)).toBe('right');
  });
});
