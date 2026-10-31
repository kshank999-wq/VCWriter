import { useEffect, useRef } from 'react';
import type { ProjectFile, StructuralUnitId } from '@vcwriter/domain';
import { ReadBackPanel } from './ReadBackPanel';
import { useMovedDialog } from '../use-moved-dialog';

/**
 * **Read back, over the main screen** (from Ken: *the readback function needs
 * to happen on the main screen. So it could be a dialog box that pops up
 * instead of a full screen*).
 *
 * A window that floats over the workspace rather than a page that replaces
 * it: the script stays where it was behind it, the box moves by its bar, and
 * closing it stops the reading. Not modal, so the page underneath can still
 * be scrolled and edited while it reads.
 */
export function ReadBackDialog({
  open,
  file,
  currentUnitId,
  onUpdate,
  onClose,
}: {
  open: boolean;
  file: ProjectFile;
  currentUnitId: StructuralUnitId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { placed, grab } = useMovedDialog(dialog, open);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      if (typeof node.show === 'function') node.show();
      else node.setAttribute('open', '');
    } else if (!open && node.open) {
      if (typeof node.close === 'function') node.close();
      else node.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog ref={dialog} className="readback-dialog" aria-label="Read back" style={placed} onClose={onClose}>
      <header className="readback-dialog-bar bar-grab" onPointerDown={grab}>
        <strong>Read back</strong>
        <span className="muted small">Drag this bar to move it</span>
        <button type="button" className="room-exit readback-exit" onClick={onClose} aria-label="Close read back">
          Close
        </button>
      </header>
      {open ? <ReadBackPanel file={file} currentUnitId={currentUnitId} onUpdate={onUpdate} /> : null}
    </dialog>
  );
}
