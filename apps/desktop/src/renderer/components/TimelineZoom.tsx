import {
  LANE_CEILING,
  LANE_FLOOR,
  ZOOM_CEILING,
  ZOOM_FLOOR,
  clampLane,
  clampZoom,
  fitZoom,
  fitsAt,
  type StorySpan,
} from '@vcwriter/domain';

/**
 * **The zoom, and the press that fits the whole story** (addendum 02 §4d,
 * from Ken: *the zoom needs to be able to compress it even more… all the way
 * down to where you can see everything on the screen*).
 *
 * One control for the plot tracks and the timeline viewer alike, because they
 * are two readings of the same axis and **two sliders with two ranges would
 * be two answers to how far a story may be compressed** — which is what they
 * were, each carrying its own `min={40} max={600}` written out by hand.
 *
 * *Fit* is a **reading** rather than a stored size (addendum 20 §9e in a
 * fourth room): what fits depends on the book and on the window, so widening
 * the pane or writing another chapter makes it mean something else with
 * nothing run. It is **a statement while it holds and a press once it does
 * not**, which is that section's own rule — the same word drawn the same way
 * in both states would be two states that look alike.
 */

export interface TimelineZoomProps {
  zoom: number;
  spans: readonly StorySpan[];
  /**
   * How much room the **blocks** have, in pixels.
   *
   * The parent measures it and hands it over rather than this component
   * looking for a scroller of its own, because the grid, its sticky head and
   * whatever it reserves at the tail are the parent's own layout — a control
   * in the toolbar guessing at them would be a second answer to how wide the
   * board is, free to disagree the first time either changed.
   */
  across: number;
  /** Pixels per second rather than per page, on a short-form board. */
  perSecond?: boolean;
  onZoom(zoom: number): void;
  /**
   * **The other axis** (§4e): how tall a beat is drawn. Beats build down a
   * lane and never wrap, so this says how much of one can be read — Ken's
   * *zoom fat and zoom flat*. Absent where a board has no lanes to grow.
   */
  lane?: number;
  onLane?(height: number): void;
}

export function TimelineZoom({ zoom, spans, across, perSecond = false, onZoom, lane, onLane }: TimelineZoomProps) {
  const room = Math.max(120, across);
  const fits = fitsAt(zoom, spans, room);

  return (
    <label className="zoom">
      <span className="muted">Zoom</span>
      <input
        type="range"
        min={ZOOM_FLOOR}
        max={ZOOM_CEILING}
        step={1}
        value={clampZoom(zoom)}
        aria-label={perSecond ? 'Timeline zoom, pixels per second' : 'Timeline zoom, pixels per page'}
        onChange={(event) => onZoom(clampZoom(Number(event.target.value)))}
      />
      {/* A statement while it holds, a press once it does not — raised rather
          than flat, because pressing it does something here (addendum 20 §9). */}
      {fits ? (
        <span className="muted zoom-fits">Fit</span>
      ) : (
        <button type="button" className="zoom-fit" title="Draw the whole story in the room there is" onClick={() => onZoom(fitZoom(spans, room))}>
          Fit
        </button>
      )}
      {/* The vertical zoom, beside the one it is the twin of rather than in a
          dialog on another screen. **Absent rather than greyed** where the
          host hands nothing down, which is this program's idiom for *this
          board has no lanes*. */}
      {lane !== undefined && onLane ? (
        <>
          <span className="muted zoom-down">Down</span>
          <input
            type="range"
            min={LANE_FLOOR}
            max={LANE_CEILING}
            step={1}
            value={clampLane(lane)}
            aria-label="Lane zoom, how tall a beat is drawn"
            onChange={(event) => onLane(clampLane(Number(event.target.value)))}
          />
        </>
      ) : null}
    </label>
  );
}
