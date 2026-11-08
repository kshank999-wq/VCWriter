import { describe, expect, it } from 'vitest';
import { BEAT_COLUMN_CEILING, BEAT_COLUMN_FLOOR, BLOCK_BEAT_PADDING, TRACK_ZOOM_DEFAULT, ZOOM_CEILING, ZOOM_FLOOR, beatColumnWidthAt, columnBlockWidthAt, fitColumnZoom } from '../index.js';

/**
 * A book's board sizes the beat column (from Ken: *it'll stretch to a limit
 * … and then it shrinks to a limit to where it's narrow, but not a sliver*).
 */
describe('the beat column on a book board', () => {
  it('is the writer’s width at the default zoom', () => {
    expect(beatColumnWidthAt(TRACK_ZOOM_DEFAULT, 180)).toBe(180);
  });

  it('widens with the zoom up to a limit, and narrows to a floor that is not a sliver', () => {
    expect(beatColumnWidthAt(TRACK_ZOOM_DEFAULT * 1.5, 180)).toBe(270);
    expect(beatColumnWidthAt(ZOOM_CEILING, 180)).toBe(BEAT_COLUMN_CEILING);
    expect(beatColumnWidthAt(ZOOM_FLOOR, 180)).toBe(BEAT_COLUMN_FLOOR);
    expect(BEAT_COLUMN_FLOOR).toBeGreaterThanOrEqual(90);
  });

  it('keeps a width the writer dragged wider than the limit', () => {
    expect(beatColumnWidthAt(ZOOM_CEILING, 600)).toBe(600);
  });

  it('draws a section as its column and nothing more', () => {
    expect(columnBlockWidthAt(TRACK_ZOOM_DEFAULT, 180)).toBe(180 + BLOCK_BEAT_PADDING);
  });

  it('fits every section into the room, or stops at the floor and scrolls', () => {
    const zoom = fitColumnZoom(4, 800, 180);
    expect(columnBlockWidthAt(zoom, 180) * 4).toBeLessThanOrEqual(800);
    expect(beatColumnWidthAt(fitColumnZoom(40, 800, 180), 180)).toBe(BEAT_COLUMN_FLOOR);
  });
});
