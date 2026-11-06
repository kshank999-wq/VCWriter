import { CARD_HEIGHT, CARD_WIDTH, type MapPicture } from './sculptor.js';

/**
 * The minimap (addendum 03 v2 §3): the whole open map in a small box, the
 * window onto it drawn as a frame, and a press on it moving the canvas there.
 * Canvas pixels in, box pixels out.
 */

export interface MapBox {
  width: number;
  height: number;
}

/** The part of the canvas on screen, in canvas pixels. */
export interface BoardWindow {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MapCard {
  id: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MiniMap {
  width: number;
  height: number;
  scale: number;
  cards: MapCard[];
  frame: { x: number; y: number; width: number; height: number };
}

/** Whether the map is bigger than the window, which is when a minimap earns its corner. */
export const needsAMap = (picture: MapPicture, window: BoardWindow): boolean =>
  picture.width > window.width + 1 || picture.height > window.height + 1;

export const miniMap = (picture: MapPicture, window: BoardWindow, box: MapBox): MiniMap => {
  const worldWidth = Math.max(picture.width, 1);
  const worldHeight = Math.max(picture.height, 1);
  const scale = Math.min(box.width / worldWidth, box.height / worldHeight);
  return {
    width: worldWidth * scale,
    height: worldHeight * scale,
    scale,
    cards: picture.cards.map((card) => ({
      id: card.node.id as string,
      kind: card.node.kind,
      x: card.x * scale,
      y: card.y * scale,
      width: Math.max(2, CARD_WIDTH * scale),
      height: Math.max(2, CARD_HEIGHT * scale),
    })),
    frame: {
      x: window.left * scale,
      y: window.top * scale,
      width: window.width * scale,
      height: window.height * scale,
    },
  };
};

/** Where the window goes when the map is pressed at a point: centred on it. */
export const windowFromMap = (map: MiniMap, window: BoardWindow, at: { x: number; y: number }): BoardWindow => ({
  ...window,
  left: at.x / map.scale - window.width / 2,
  top: at.y / map.scale - window.height / 2,
});
