import { findBeat, nounsFor, outlineRowForBeat, sculptorNodeForBeat, type BeatId, type ProjectFile } from '@vcwriter/domain';
import { BeatWriter } from './BeatWriter';
import { useModal } from '../use-modal';
import { useMovedDialog } from '../use-moved-dialog';
import { useRef } from 'react';
import { usePreference } from '../use-split';

interface BeatDialogProps {
  file: ProjectFile;
  beatId: BeatId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Writing in a beat makes it the selection, so the rest of the app follows. */
  onSelect?(beatId: BeatId): void;
  /** Move this beat to a window of its own (addendum 02 §8). */
  onPopOut?(beatId: BeatId): void;
  /** Go to the Outliner at this beat's row. */
  onGoToOutline?(beatId: BeatId): void;
  onGoToSculptor?(beatId: BeatId): void;
  /** Open another beat here: a passage, or back to its subsection. */
  onOpenBeat?(beatId: BeatId): void;
}

/**
 * The writing screen over the workspace: double-clicking a beat opens it
 * here. The screen itself is `BeatWriter`, which is the same component the
 * beat's own window draws — a beat moved to a second monitor is the identical
 * page, in a window instead of over one.
 *
 * **It moves** (addendum 02 §6d, from Ken: *when you open a beat, you should
 * be able to grab the top bar and drag it around*). Where it stands is a fact
 * about this minute and is **kept nowhere** — not in the project, which is the
 * writing, and not on the machine, because a screen that opens somewhere the
 * writer left it a fortnight ago is one they have to find. A fresh beat opens
 * centred, which is where a dialog belongs until somebody says otherwise.
 *
 * The second half of Ken's sentence — *and be able to drag it to another
 * screen* — is the ⧉ in the bar rather than this: a page drawn inside a window
 * cannot leave it, and what leaves is a window of its own, which the workspace
 * has made since §8. So this moves it on the desk and that puts it on the
 * other monitor, and the two are not the same gesture however alike they read.
 *
 * The moving itself is `useMovedDialog`, which was written out here and is now
 * every dialog's (addendum 28 §6a).
 */
export function BeatDialog({ file, beatId, onClose, onUpdate, onSelect, onPopOut, onGoToOutline, onGoToSculptor, onOpenBeat }: BeatDialogProps) {
  const beat = beatId ? findBeat(file, beatId) : undefined;
  const dialog = useModal(Boolean(beat));
  // A different beat is a fresh screen, so it opens where a dialog opens.
  const { placed, grab, pin } = useMovedDialog(dialog, beatId);
  /**
   * **Its size, by its corner** (from Ken, 21 November: *put a little drag in
   * the corner so you can resize the window as you want to… make the text
   * bigger and easier to work and make the window the appropriate size*).
   * Remembered, so it opens the size it was left.
   */
  const [size, setSize] = usePreference<{ width: number; height: number } | null>('writerWindowSize', null);
  const sizing = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = dialog.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    event.stopPropagation();
    pin();
    sizing.current = { x: event.clientX, y: event.clientY, width: box.width, height: box.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resize = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = sizing.current;
    const box = dialog.current?.getBoundingClientRect();
    if (!start || !box) return;
    setSize({
      width: Math.round(Math.min(Math.max(start.width + event.clientX - start.x, 560), window.innerWidth - box.left - 4)),
      height: Math.round(Math.min(Math.max(start.height + event.clientY - start.y, 360), window.innerHeight - box.top - 4)),
    });
  };
  const endResize = () => {
    sizing.current = null;
  };

  return (
    <dialog
      ref={dialog}
      className="writer-dialog"
      aria-label={nounsFor(file.project.format).sub}
      // Moved, it is placed rather than centred; untouched, the browser
      // centres it and no style of ours says otherwise.
      style={{ ...placed, ...(size ? { width: `min(${size.width}px, calc(100vw - 8px))`, height: `min(${size.height}px, calc(100vh - 8px))` } : {}) }}
      onClose={onClose}
    >
      {beat ? (
        <BeatWriter
          file={file}
          beat={beat}
          onClose={onClose}
          onUpdate={onUpdate}
          onGrab={grab}
          {...(onSelect ? { onSelect } : {})}
          {...(onOpenBeat ? { onOpenBeat } : {})}
          {...(onPopOut ? { onPopOut: () => onPopOut(beat.id) } : {})}
          {...(onGoToOutline && outlineRowForBeat(file, beat.id) ? { onGoToOutline: () => onGoToOutline(beat.id) } : {})}
          onGoToSculptor={onGoToSculptor && sculptorNodeForBeat(file, beat.id) ? () => onGoToSculptor(beat.id) : null}
        />
      ) : null}
      <div
        className="writer-resize"
        role="separator"
        aria-label="Resize the window"
        title="Drag to make the window bigger or smaller · double-click for the usual size"
        onPointerDown={startResize}
        onPointerMove={resize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onDoubleClick={() => setSize(null)}
      />
    </dialog>
  );
}
