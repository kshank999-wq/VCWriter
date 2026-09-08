import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small per-machine preferences: panel sizes, what is shown, zoom, scheme.
 * These are not project data (a colleague opening the file should not inherit
 * my divider position), so they live in the renderer's storage rather than in
 * the document. Every read is guarded: storage can be absent or refuse.
 */
export const readPreference = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(`vcwriter.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

export const writePreference = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(`vcwriter.${key}`, JSON.stringify(value));
  } catch {
    // Storage refused: the preference simply does not survive the session.
  }
};

export const usePreference = <T>(key: string, fallback: T): [T, (next: T) => void] => {
  const [value, setValue] = useState<T>(() => readPreference(key, fallback));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      writePreference(key, next);
    },
    [key],
  );
  return [value, set];
};

interface SplitOptions {
  key: string;
  /** Pixels for the first pane, or a fraction of the container when under 1. */
  initial: number;
  min: number;
  /** Leave at least this much for whatever is on the other side. */
  reserve: number;
  /** `x`: the divider moves left–right and sizes a column. `y`: up–down, a row. */
  axis?: 'x' | 'y';
}

/**
 * A draggable divider. The size is the first pane's, in pixels, clamped so
 * neither side can be dragged out of existence; it is remembered per machine.
 * The divider element's parent is the container the size is measured in.
 */
export const useSplit = ({ key, initial, min, reserve, axis = 'x' }: SplitOptions) => {
  const [stored, setStored] = usePreference<number | null>(key, null);
  // The live size during a drag is state; storage is written once, on release.
  const [live, setLive] = useState<number | null>(null);
  const size = live ?? stored;
  const setSize = setStored;
  const container = useRef<HTMLElement | null>(null);
  const dragging = useRef(false);
  const extent = () => {
    const box = container.current?.getBoundingClientRect();
    if (box) return axis === 'x' ? box.width : box.height;
    return axis === 'x' ? window.innerWidth : window.innerHeight;
  };
  const resolved = size ?? (initial < 1 ? Math.round(initial * extent()) : initial);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    dragging.current = true;
    container.current = event.currentTarget.parentElement;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragging.current || !container.current) return;
      const box = container.current.getBoundingClientRect();
      const along = axis === 'x' ? event.clientX - box.left : event.clientY - box.top;
      const total = axis === 'x' ? box.width : box.height;
      setLive(Math.round(Math.min(Math.max(along, min), total - reserve)));
    },
    [axis, min, reserve],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    setLive((current) => {
      if (current !== null) setStored(current);
      return null;
    });
  }, [setStored]);

  // The window can shrink under a remembered size; keep the other side alive.
  useEffect(() => {
    const clamp = () => {
      const available = extent();
      if (resolved > available - reserve) setSize(Math.max(min, available - reserve));
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, min, reserve, setSize]);

  return { size: resolved, dividerProps: { onPointerDown, onPointerMove, onPointerUp } };
};
