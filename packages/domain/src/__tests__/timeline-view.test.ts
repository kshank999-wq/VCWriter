import { describe, expect, it } from 'vitest';
import {
  BEAT_CHIP_MIN,
  MIN_SPAN_PAGES,
  BEAT_CHIP_MAX,
  LANE_CEILING,
  LANE_DEFAULT,
  LANE_FLOOR,
  clampLane,
  laneCarriesWords,
  laneHeight,
  ZOOM_CEILING,
  ZOOM_FLOOR,
  addMarker,
  addUnit,
  beatsAreChips,
  clampZoom,
  createProjectFile,
  describeSpanAt,
  divisionAt,
  fitZoom,
  fitsAt,
  spanWidth,
  storyLayout,
  tracksInOrder,
  unitsInStoryOrder,
  updateUnit,
  type ProjectFile,
  type StorySpan,
} from '../index.js';

/**
 * **The zoom that fits, and the zoom that stops** (addendum 02 §4d, from Ken:
 * *the zoom needs to be able to compress it even more… all the way down to
 * where you can see everything on the screen. And then you can zoom it all
 * the way out to where it's really big, to where you can see all the beats.
 * Right now, you can make the beats stretch way out, which is not needed*).
 *
 * Measured in the real room before a line was written: an 88-page novel at
 * the old default drew **14,269 pixels of track in a 773-pixel window**, and
 * at the slider's floor it still drew 1,600 — because a fixed 40-pixel floor
 * sat under every scene, so *everything on the screen* was arithmetically
 * impossible however far the slider went.
 */

const span = (pages: number): StorySpan => ({ pages } as StorySpan);

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' });
  const track = tracksInOrder(file)[0]!;
  const first = unitsInStoryOrder(file)[0]!;
  file = updateUnit(file, first.id, { title: 'The Road' });
  const second = addUnit(file, { trackId: track.id, title: 'Low Water', index: 1 });
  file = second.file;
  file = addMarker(file, { unitId: first.id, kind: 'chapter', title: 'The Road' }).file;
  return file;
};

describe('how far it goes', () => {
  it('compresses far below where it used to stop', () => {
    /**
     * Forty a page was the floor of the slider *and* the floor under every
     * scene. Forty chapters could not be drawn in less than 1,600 pixels,
     * in a stage seven hundred wide.
     */
    expect(ZOOM_FLOOR).toBeLessThan(40);
    expect(spanWidth(span(2.5), ZOOM_FLOOR)).toBeLessThan(40);
  });

  it('leaves every ordinary zoom exactly where it was', () => {
    /**
     * The proof the change is safe: `MIN_SPAN_PAGES` is half a page, so the
     * old 40-pixel floor fired only below a zoom of eighty — above that it
     * bound on nothing and lowering it moves nothing at all.
     */
    for (const zoom of [80, 120, 160, 200, 240]) {
      expect(spanWidth(span(0.1), zoom)).toBe(Math.round(MIN_SPAN_PAGES * zoom));
      expect(spanWidth(span(2.5), zoom)).toBe(Math.round(2.5 * zoom));
    }
  });

  it('has room to expand as well as to compress (§4e)', () => {
    /**
     * **Rewritten rather than worked around.** This pinned §4d's ceiling of
     * 240, which Ken's tech-check of the stage play found to be the fault: the
     * default sits at 160–180, so dragging left ran forty times smaller and
     * dragging right moved barely half as big again — *you can zoom in and
     * make it to where it's flat, to where you can barely see it*, and not the
     * other way. §4d capped the axis to stop **beats** stretching, and a beat
     * is already held by `BEAT_CHIP_MAX`, so the cap was protecting something
     * that had its own guard and cost the only end words are read at.
     *
     * What is asserted now is the **shape of the range** rather than a number:
     * the default has real room on both sides of it.
     */
    expect(clampZoom(10_000)).toBe(ZOOM_CEILING);
    expect(clampZoom(1)).toBe(ZOOM_FLOOR);
    // Room to expand that is worth dragging for: at least as much again as
    // the board opens with.
    expect(ZOOM_CEILING).toBeGreaterThanOrEqual(180 * 2);
    // And a chip is still a chip however wide the block is allowed to be.
    expect(BEAT_CHIP_MAX).toBeLessThan(ZOOM_CEILING);
  });
});

describe('fit is a reading', () => {
  it('is worked out from the book and the window every time', () => {
    /**
     * Nothing is stored: widen the pane, or write another chapter, and *Fit*
     * means something else with nothing run — addendum 20 §9e's rule in a
     * fourth room, and addendum 15 §15's *whole story means the whole story
     * fits*.
     */
    const spans = [span(8), span(8), span(8)];
    const fit = fitZoom(spans, 720);
    expect(spans.reduce((total, one) => total + spanWidth(one, fit), 0)).toBeLessThanOrEqual(720);
    // A wider window fits a bigger drawing of the same book.
    expect(fitZoom(spans, 1440)).toBeGreaterThan(fit);
    // And another chapter makes it smaller.
    expect(fitZoom([...spans, span(8)], 720)).toBeLessThan(fit);
  });

  it('lands on the floor where even that will not fit', () => {
    // As near as the screen can come, and still the most of it anybody can
    // be shown — rather than a number below the slider's own range.
    expect(fitZoom(Array.from({ length: 400 }, () => span(8)), 720)).toBe(ZOOM_FLOOR);
  });

  it('says whether it is fitting, which is what makes Fit a statement', () => {
    const spans = [span(8), span(8), span(8)];
    expect(fitsAt(fitZoom(spans, 720), spans, 720)).toBe(true);
    expect(fitsAt(ZOOM_CEILING, spans, 720)).toBe(false);
  });
});

describe('a beat is a chip or a tick', () => {
  it('asks the block’s own width rather than the zoom', () => {
    /**
     * The first draft asked the zoom, and driving the real board caught it:
     * on a novel imported a chapter to a section, an eight-page block drew
     * ticks at a zoom where it had three hundred pixels to spare. A long
     * chapter showing its beats beside a two-line scene showing ticks is not
     * two vocabularies — it is the truth about the two of them.
     */
    expect(beatsAreChips(spanWidth(span(8), 40))).toBe(true);
    expect(beatsAreChips(spanWidth(span(0.5), 40))).toBe(false);
    expect(beatsAreChips(BEAT_CHIP_MIN)).toBe(true);
    expect(beatsAreChips(BEAT_CHIP_MIN - 1)).toBe(false);
  });
});

describe('what a block says when you cannot read it', () => {
  it('gives the chapter, which is what Ken asked a hover for', () => {
    const file = novel();
    const [first, second] = unitsInStoryOrder(file);
    expect(divisionAt(file, first!.id as string)).toMatch(/The Road/);
    // The chapter carries forward: the next section is still in it.
    expect(divisionAt(file, second!.id as string)).toMatch(/The Road/);
  });

  it('does not say the same name twice', () => {
    /**
     * A chapter marker sits on the unit the chapter opens with, and that
     * unit is called what the chapter is called — so the first draft read
     * *Chapter 1 — The Road · Chapter: The Road*, one answer said twice on
     * one line (addendum 28 §4a's fault, in a tooltip).
     */
    const file = novel();
    const [first, second] = unitsInStoryOrder(file);
    const said = describeSpanAt(file, first!.id as string);
    expect(said).toMatch(/The Road/);
    expect(said.match(/The Road/g)).toHaveLength(1);
    // Where they differ, both are said: the chapter, then the section.
    expect(describeSpanAt(file, second!.id as string)).toMatch(/The Road.*Low Water/);
  });

  it('says nothing about a chapter where there is none', () => {
    const bare = createProjectFile({ title: 'Loose', format: 'screenplay' });
    const only = unitsInStoryOrder(bare)[0]!;
    expect(divisionAt(bare, only.id as string)).toBeNull();
    expect(describeSpanAt(bare, only.id as string)).toMatch(/Scene/);
  });

  it('carries the keys after it, one hover being one answer', () => {
    const file = novel();
    const unit = unitsInStoryOrder(file)[0]!;
    expect(describeSpanAt(file, unit.id as string, 'Click to select')).toMatch(/· Click to select$/);
  });
});

describe('the layout the board is drawn from', () => {
  it('still gives a span per scene, which nothing here changed', () => {
    const file = novel();
    expect(storyLayout(file).spans).toHaveLength(unitsInStoryOrder(file).length);
  });
});

/**
 * **The vertical zoom** (addendum 02 §4e, from Ken: *we need a vertical zoom
 * for the chapter lanes. basically it'll just keep building the beats, the
 * sections, the subsections down for each chapter. It won't wrap*).
 */
describe('the lane, down', () => {
  it('clamps to a tick you can count and a row you can read', () => {
    expect(clampLane(1)).toBe(LANE_FLOOR);
    expect(clampLane(10_000)).toBe(LANE_CEILING);
    expect(clampLane(LANE_DEFAULT)).toBe(LANE_DEFAULT);
  });

  it('says whether a beat drawn this tall can carry its name', () => {
    // Read off the drawn size rather than off the slider, which is
    // `beatsAreChips`' own rule for the other axis: what a beat can say is a
    // fact about the box it is in.
    expect(laneCarriesWords(LANE_FLOOR)).toBe(false);
    expect(laneCarriesWords(LANE_CEILING)).toBe(true);
    expect(laneCarriesWords(LANE_DEFAULT)).toBe(true);
  });

  it('makes a lane as tall as what is in it, and stores nothing', () => {
    // A chapter of twenty beats is a tall lane and a two-beat scene beside it
    // is short, which is the truth about the two of them — the same argument
    // §4d made about width, on the other axis.
    expect(laneHeight(20, 22)).toBe(440);
    expect(laneHeight(2, 22)).toBe(44);
    // Adding a beat makes it taller with nothing run.
    expect(laneHeight(3, 22)).toBeGreaterThan(laneHeight(2, 22));
    // And the floor is honoured where a row has to hold something anyway.
    expect(laneHeight(0, 22, 18)).toBe(18);
  });

  it('is a second axis rather than a count of columns', () => {
    /**
     * The whole of the change: beats used to stack `DEFAULT_BEATS_PER_COLUMN`
     * deep and then start a column **beside** them, so a chapter of twelve
     * beats drew three times wider than its pages and pushed every track under
     * it out to match. There is no such number any more — the width of a block
     * is its pages, and this is how tall the beats in it are drawn.
     */
    for (const beats of [1, 5, 6, 12, 40]) {
      expect(laneHeight(beats, LANE_DEFAULT)).toBe(beats * LANE_DEFAULT);
    }
  });
});
