import { describe, expect, it } from 'vitest';
import { pictureLines } from '../index.js';

/**
 * **A box that was drawn keeps its height** (addendum 20 §9aj, from Ken:
 * *I want to put a picture at the bottom of the last page where there's a
 * blank space. So I draw the box… what this does is it cuts the text on the
 * two pages in half, shifts text to the following page, and wants to put it
 * always on the right-hand page*).
 *
 * §9z made the drawn height the measurement **while the box was empty** and
 * handed it straight back to the picture's own proportions the moment one
 * arrived, which is what `pictureLines` did: `boxHeight` was consulted only
 * in the no-picture branch. His own numbers are the fixture — a 4.19 in text
 * block, a box drawn 4.08 in tall, and a portrait illustration.
 */

/** His book: a 5½ × 8½ trim, 4.19 in of measure, 20 pt leading, 35 lines. */
const WIDE = 4.19 * 96;
const LEAD = 20;
const PER_PAGE = 35;
/** The carriage plate: taller than it is wide. */
const TALL = { data: '', altText: '', width: 1000, height: 1600 };
/** The box he drew, as a share of the measure. */
const DRAWN = 4.08 / 4.19;

describe('how tall a picture is', () => {
  it('keeps the box the writer drew, rather than the picture’s own shape', () => {
    const inTheBox = pictureLines(TALL, WIDE, LEAD, PER_PAGE, DRAWN);
    // 4.08 in of a 20 pt leading is twenty lines, which is the hole he drew
    // in the white under four paragraphs.
    expect(inTheBox).toBe(20);
    // What it did before: the picture's own 6.70 in, which is 33 lines of a
    // 35-line page — so the text was cut across two pages and the picture
    // went to a page of its own.
    expect(pictureLines(TALL, WIDE, LEAD, PER_PAGE, 0)).toBe(33);
    expect(inTheBox).toBeLessThan(PER_PAGE - 10);
  });

  it('still reads the picture where no box was drawn, so nothing already in a book moves', () => {
    expect(pictureLines(TALL, WIDE, LEAD, PER_PAGE, 0)).toBe(33);
    const wide = { ...TALL, width: 1600, height: 1000 };
    expect(pictureLines(wide, WIDE, LEAD, PER_PAGE, 0)).toBe(13);
  });

  it('still holds a drawn box open for a picture that has not been chosen', () => {
    expect(pictureLines(undefined, WIDE, LEAD, PER_PAGE, DRAWN)).toBe(20);
    // And with neither, the third of a page a box has stood at since §9a.
    expect(pictureLines(undefined, WIDE, LEAD, PER_PAGE, 0)).toBe(12);
  });

  /**
   * The half that makes it a *fit* rather than a squash: the markup gives the
   * box its own ratio and the picture is contained inside it.
   */
  it('fits the picture inside the box rather than stretching it', () => {
    expect(pictureLines(TALL, WIDE, LEAD, PER_PAGE, DRAWN)).toBe(
      pictureLines({ ...TALL, width: 1600, height: 1000 }, WIDE, LEAD, PER_PAGE, DRAWN),
    );
  });
});
