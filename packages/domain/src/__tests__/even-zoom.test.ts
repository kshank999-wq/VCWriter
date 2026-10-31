import { describe, expect, it } from 'vitest';
import { BEAT_CHIP_MIN, CHIP_FULL_ZOOM, blockWidthAt, chipWidthAt, spanWidth, type StorySpan } from '../index.js';

/**
 * The zoom scales sections and beats evenly (from Ken: *the zoom is still
 * wonky and zooms sections and beats unevenly*).
 */
const span = (pages: number) => ({ pages }) as unknown as StorySpan;

describe('an even zoom', () => {
  it('draws a chip at the writer’s width at the starting zoom and above, smaller below', () => {
    expect(chipWidthAt(CHIP_FULL_ZOOM, 180)).toBe(180);
    expect(chipWidthAt(400, 180)).toBe(180);
    expect(chipWidthAt(CHIP_FULL_ZOOM / 2, 180)).toBe(90);
  });

  it('gives an unwritten section room for its chips, the same as a written one', () => {
    const zoom = 120;
    const chip = chipWidthAt(zoom, 180);
    expect(chip).toBeGreaterThanOrEqual(BEAT_CHIP_MIN);
    // Half a page of nothing would be 60px; it is as wide as a chip column.
    expect(blockWidthAt(span(0), zoom, 180, 4)).toBe(chip + 10);
    // Three pages are wider than a chip column, so the pages decide.
    expect(blockWidthAt(span(3), zoom, 180, 3)).toBe(spanWidth(span(3), zoom));
  });

  it('takes the page width alone once chips are too small to read, so the book still fits', () => {
    const zoom = 20;
    expect(chipWidthAt(zoom, 180)).toBeLessThan(BEAT_CHIP_MIN);
    expect(blockWidthAt(span(0), zoom, 180, 4)).toBe(spanWidth(span(0), zoom));
  });
});
