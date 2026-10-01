import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

/** Keep a moved screen on the desk: its bar must stay reachable. */
const onDesk = (at: number, span: number, within: number): number =>
  Math.min(Math.max(at, 8 - span + 120), within - 120);

/**
 * Grabbing a screen's top bar and moving it on the desk (addendum 02 §6d).
 *
 * **One gesture, one copy.** This was `BeatDialog`'s and is now every
 * dialog's, because a second hand-written drag is a second answer to *how
 * far did the pointer move and where may a screen stand* — free to disagree
 * the first time either is touched, which is the fault this project has
 * removed from printing, from the face table and from the running heads.
 *
 * Three rules come with it, and they are the hook's rather than each
 * screen's:
 *
 * - **Where it stands is kept nowhere** — not in the project, which is the
 *   writing, and not on the machine either, because a screen that opens
 *   where it was left a fortnight ago is one you go looking for. A fresh
 *   screen opens centred, which is where a dialog belongs until somebody
 *   says otherwise, and `opensFresh` is what makes it fresh (a different
 *   beat, a different note).
 * - **Being moved is the one state that places it.** A `<dialog>` is centred
 *   by the browser, so untouched it carries no style of ours at all.
 * - **A control is a control.** A press on the name, a picker, a switch or
 *   the × is that control's and never the start of a drag, or naming a beat
 *   would slide the screen out from under the pointer. The guard lives here
 *   because it is the same rule on every bar; it was written out by hand in
 *   `BeatWriter` and would have been written out again below.
 */
export function useMovedDialog(
  dialog: RefObject<HTMLDialogElement | null>,
  opensFresh: unknown,
): {
  /** The style the dialog wears once it has been moved, and nothing before. */
  placed: CSSProperties | undefined;
  /** Put this on the bar: `onPointerDown={grab}`. */
  grab(event: ReactPointerEvent<HTMLElement>): void;
} {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const from = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => setAt(null), [opensFresh]);

  const grab = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('input, button, select, textarea, label')) return;
    const box = dialog.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    from.current = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const start = from.current;
      const box = dialog.current?.getBoundingClientRect();
      if (!start || !box) return;
      setAt({
        left: onDesk(start.left + event.clientX - start.x, box.width, window.innerWidth),
        top: Math.min(Math.max(start.top + event.clientY - start.y, 0), window.innerHeight - 40),
      });
    };
    const drop = () => {
      from.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', drop);
    };
  }, [dialog]);

  return {
    placed: at ? { position: 'fixed', margin: 0, left: `${at.left}px`, top: `${at.top}px` } : undefined,
    grab,
  };
}
