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
