import { useEffect, useRef } from 'react';
import { recordWriting, type ProjectFile } from '@vcwriter/domain';

/**
 * The clock behind the writing log (addendum 02 §15).
 *
 * It records that writing is happening, and nothing else. A sitting begins at
 * the first keystroke and is held open by the ticks that follow; when the
 * typing stops the ticks stop, and the gap is what closes the sitting. So the
 * log measures time spent writing rather than time spent with the app open,
 * which is the only figure worth having.
 *
 * Only keystrokes in something you can type into count. Clicking around the
 * timeline is not writing, and an evening of it should not read as one.
 */

/** How often a sitting in progress is written down. Well under the idle gap. */
const TICK_MS = 60_000;

const intoText = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable === true;
};

export const useWritingClock = (
  open: boolean,
  update: (mutate: (file: ProjectFile) => ProjectFile) => void,
): void => {
  const typing = useRef(false);

  useEffect(() => {
    if (!open) return undefined;

    const mark = () => update((file) => recordWriting(file, new Date().toISOString()));

    const onKey = (event: KeyboardEvent) => {
      if (!intoText(event.target)) return;
      // The first keystroke after a quiet spell opens the sitting there, so
      // the words of the first minute are counted from where they began.
      if (!typing.current) mark();
      typing.current = true;
    };

    const timer = window.setInterval(() => {
      if (!typing.current) return;
      typing.current = false;
      mark();
    }, TICK_MS);

    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearInterval(timer);
    };
  }, [open, update]);
};
