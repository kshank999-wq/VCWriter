import { useCallback, useRef, useState } from 'react';
import type { BeatId, LaneId, StructuralUnitId } from '@vcwriter/domain';

/**
 * Drag and drop for the structure board (spec §5.1–§5.3).
 *
 * The payload is held in a ref rather than in `dataTransfer`, because the
 * `dragover` handler needs to know *what* is being dragged in order to decide
 * whether a target is a legal drop — and `dataTransfer.getData` is empty during
 * dragover by design. `dataTransfer` still gets a text payload so the drag
 * starts at all.
 */

export type DragPayload =
  | { kind: 'beat'; id: BeatId; fromUnitId: StructuralUnitId }
  | { kind: 'unit'; id: StructuralUnitId; fromLaneId: LaneId }
  | { kind: 'lane'; id: LaneId };

export type DropEdge = 'before' | 'after';

export interface DropTarget {
  /** Identifies the element being hovered, so only that row draws an indicator. */
  overId: string;
  edge: DropEdge;
}

/** Which half of the element the pointer is in. */
export const edgeFor = (event: React.DragEvent, orientation: 'vertical' | 'horizontal' = 'vertical'): DropEdge => {
  const box = event.currentTarget.getBoundingClientRect();
  if (orientation === 'horizontal') {
    return event.clientX < box.left + box.width / 2 ? 'before' : 'after';
  }
  return event.clientY < box.top + box.height / 2 ? 'before' : 'after';
};

/** Index in `siblings` that a drop on `overIndex`'s `edge` corresponds to. */
export const indexForDrop = (overIndex: number, edge: DropEdge): number =>
  edge === 'before' ? overIndex : overIndex + 1;

/**
 * Moving an item within its own list shifts the target index down by one once
 * the item is lifted out, so a drop "after the item below me" is a real move
 * rather than a no-op.
 */
export const adjustForSameList = (targetIndex: number, currentIndex: number | null): number =>
  currentIndex !== null && currentIndex < targetIndex ? targetIndex - 1 : targetIndex;

export interface UseDragDrop {
  payload: DragPayload | null;
  dropTarget: DropTarget | null;
  begin(payload: DragPayload, event: React.DragEvent): void;
  end(): void;
  hover(overId: string, edge: DropEdge): void;
  clearHover(overId: string): void;
}

export const useDragDrop = (): UseDragDrop => {
  const payloadRef = useRef<DragPayload | null>(null);
  const [payload, setPayload] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const begin = useCallback((next: DragPayload, event: React.DragEvent) => {
    payloadRef.current = next;
    setPayload(next);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', next.id);
  }, []);

  const end = useCallback(() => {
    payloadRef.current = null;
    setPayload(null);
    setDropTarget(null);
  }, []);

  const hover = useCallback((overId: string, edge: DropEdge) => {
    setDropTarget((current) =>
      current?.overId === overId && current.edge === edge ? current : { overId, edge },
    );
  }, []);

  const clearHover = useCallback((overId: string) => {
    setDropTarget((current) => (current?.overId === overId ? null : current));
  }, []);

  return { payload, dropTarget, begin, end, hover, clearHover };
};

/** Class name for a row that is currently a drop target. */
export const dropClass = (dropTarget: DropTarget | null, id: string): string =>
  dropTarget?.overId === id ? ` drop-${dropTarget.edge}` : '';

// ------------------------------------------- the Outliner (addendum 06 §8)

/**
 * Where a row dropped on another one lands.
 *
 * A tree needs a third answer the structure board does not: *inside*. A drop
 * has to be able to say **sibling or child**, because "under the beat" and
 * "after the beat" are different sentences about the story and the writer is
 * choosing between them as they let go.
 */
export type OutlineZone = 'before' | 'into' | 'after';

/**
 * How much of a row's height, top and bottom, means *beside it* rather than
 * *inside it*.
 *
 * **A third each, and deliberately equal.** Reordering wants the edges and
 * nesting wants the middle, and both are ordinary things to be doing, so
 * neither gets the larger target. Halves would leave nowhere to aim for
 * *inside*; a quarter puts each edge under seven pixels on a 26-pixel row,
 * which is finer than a hand can reliably hit.
 */
export const ZONE_EDGE = 1 / 3;

/** Which of the three zones a pointer at `y` is in, over a row of that box. */
export const zoneAt = (y: number, top: number, height: number): OutlineZone => {
  if (height <= 0) return 'into';
  const into = (y - top) / height;
  if (into < ZONE_EDGE) return 'before';
  if (into > 1 - ZONE_EDGE) return 'after';
  return 'into';
};

/** The same, read off a drag event over the row it is on. */
export const zoneFor = (event: React.DragEvent): OutlineZone => {
  const box = event.currentTarget.getBoundingClientRect();
  return zoneAt(event.clientY, box.top, box.height);
};

/**
 * How far a list scrolls itself while something is dragged near its edge, and
 * how close to the edge counts.
 *
 * Without this a long outline cannot be dragged through at all: the row you
 * want is off the screen and there is no way to reach it while holding the
 * one you are carrying (§8, "smooth auto-scroll while dragging long
 * outlines").
 */
export const SCROLL_EDGE = 48;
export const SCROLL_STEP = 14;

/** How far to scroll a box whose pointer is at `y`: zero anywhere but the edges. */
export const scrollNudge = (y: number, top: number, bottom: number): number => {
  if (y < top + SCROLL_EDGE) return -SCROLL_STEP;
  if (y > bottom - SCROLL_EDGE) return SCROLL_STEP;
  return 0;
};
