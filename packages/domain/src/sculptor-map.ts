import { COLUMN_WIDTH, type BoardLayout, type BoardReading } from './sculptor.js';
import type { SculptorNodeId } from './ids.js';

/**
 * The Sculptor's mini-map (addendum 03 §10, the last of stage 9).
 *
 * §10 asks for it in six words — *for a board bigger than the window* — and
 * those words are the whole specification, including when it should not be
 * there. A board that fits gets no map, because a map of what is already on
 * the screen is a picture of the screen.
 *
 * Three things shape what is here:
 *
 * - **It is a reading of the layout, never of the board.** It is handed the
 *   same `BoardLayout` the canvas draws, so a folded node is one row on the
 *   map as well, and a column the writer has hidden is not on it at all. A
 *   map showing cards the board is not drawing would be a map of a different
 *   board, which is worse than no map.
 * - **It carries the lighting too.** `readBoard`'s lit set comes in with the
 *   layout, and the map is the only place in the product where a writer can
 *   see that the thing they searched for is off the top of the window.
 * - **Everything is measured, nothing is positioned** (§4), so the scale is
 *   worked out from the board and the box it has to fit in, and the window
 *   rectangle is worked out from the pan. Nothing here is remembered.
 *
 * The view talks to this in **canvas units**, the same units `boardLayout`
 * produces; pixels and zoom stay in the component, as §14.2 asks.
 */

/** A rectangle on the map, in the map's own pixels. */
export interface MapBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What part of the board the window is showing, in canvas units. */
export interface BoardWindow {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MapCard {
  id: SculptorNodeId;
  /** False only where something is dimming the board and this is not lit. */
  lit: boolean;
  box: MapBox;
}

export interface MiniMap {
  /** The map's own size, which is the board fitted into the box it was given. */
  width: number;
  height: number;
  /** Map pixels to one canvas unit. */
  scale: number;
  cards: MapCard[];
  /** The window, drawn on the map. */
  window: MapBox;
}

/** The smallest a card may be drawn, so a beat on a long board is still a mark. */
const LEAST = 2;

/**
 * Is the board bigger than the window?
 *
 * The one question §10 asks, and the only thing that decides whether there is
 * a map. It is deliberately not a preference: a mini-map is not something a
 * writer should have to manage, it is something that turns up when the board
 * has outgrown the window and goes away when it has not.
 *
 * *Bigger* is **by a whole card**, in the board's own units — a column across,
 * a row down — rather than by a pixel. A board hanging an inch over the edge
 * of the window is still entirely legible, and a map of it is a sliver of two
 * marks that reads as debris in the corner rather than as a picture of
 * anything. The threshold is the board's own measure, not a taste.
 */
export const needsAMap = (layout: BoardLayout, window: BoardWindow): boolean =>
  layout.width > window.width + COLUMN_WIDTH || layout.height > window.height + 1;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), Math.max(low, high));

/**
 * The board, drawn small.
 *
 * `into` is the largest the map may be; the board is fitted inside it with its
 * proportions kept, so a tall thin board makes a tall thin map rather than a
 * squashed one. Null when the board fits the window, which is `needsAMap`
 * said once for the caller.
 */
export const miniMap = (
  layout: BoardLayout,
  reading: BoardReading,
  window: BoardWindow,
  into: { width: number; height: number },
): MiniMap | null => {
  if (!needsAMap(layout, window)) return null;
  if (layout.width <= 0 || layout.height <= 0) return null;

  const scale = Math.min(into.width / layout.width, into.height / layout.height);
  const width = layout.width * scale;
  const height = layout.height * scale;

  const cards = layout.nodes.map((laid) => ({
    id: laid.node.id,
    lit: !reading.dimming || reading.lit.has(laid.node.id as string),
    box: {
      x: laid.x * scale,
      y: laid.y * scale,
      width: Math.max(LEAST, laid.width * scale),
      height: Math.max(LEAST, laid.headHeight * scale),
    },
  }));

  // The window is clipped to the map rather than drawn hanging off it: a
  // rectangle half outside the picture says the board has moved, when what has
  // happened is that the canvas has been dragged past its own edge.
  const left = clamp(window.left * scale, 0, width);
  const top = clamp(window.top * scale, 0, height);

  return {
    width,
    height,
    scale,
    cards,
    window: {
      x: left,
      y: top,
      width: clamp(window.width * scale, 0, width - left),
      height: clamp(window.height * scale, 0, height - top),
    },
  };
};

/**
 * Where the board should be, given a press at a point on the map.
 *
 * The pressed point becomes the **middle** of the window, which is what
 * pressing somewhere on a map means everywhere else, and the result is held
 * on the board: a map may not scroll a writer past the edge of their own
 * story. Where the board fits an axis there is nothing to scroll on it, so
 * that axis comes back at zero.
 */
export const windowFromMap = (
  map: MiniMap,
  layout: BoardLayout,
  window: BoardWindow,
  at: { x: number; y: number },
): { left: number; top: number } => ({
  left: clamp(at.x / map.scale - window.width / 2, 0, Math.max(0, layout.width - window.width)),
  top: clamp(at.y / map.scale - window.height / 2, 0, Math.max(0, layout.height - window.height)),
});
