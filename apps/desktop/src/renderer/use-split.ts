import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small per-machine preferences: panel widths, what is shown, zoom. These are
 * not project data (a colleague opening the file should not inherit my
 * divider position), so they live in the renderer's storage rather than in
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
  initial: number;
  min: number;
  /** Leave at least this much for whatever is on the other side. */
  reserve: number;
}

/**
 * A draggable divider. The width is the left pane's, in pixels, clamped so
 * neither side can be dragged out of existence; it is remembered per machine.
 */
export const useSplit = ({ key, initial, min, reserve }: SplitOptions) => {
  const [width, setWidth] = usePreference(key, initial);
  const container = useRef<HTMLElement | null>(null);
  const dragging = useRef(false);

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
      const next = Math.round(Math.min(Math.max(event.clientX - box.left, min), box.width - reserve));
      setWidth(next);
    },
    [min, reserve, setWidth],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // The window can shrink under a remembered width; keep the right side alive.
  useEffect(() => {
    const clamp = () => {
      const available = container.current?.getBoundingClientRect().width ?? window.innerWidth;
      if (width > available - reserve) setWidth(Math.max(min, available - reserve));
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [width, min, reserve, setWidth]);

  return { width, dividerProps: { onPointerDown, onPointerMove, onPointerUp } };
};
