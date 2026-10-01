import { findBeat, nounsFor, type BeatId, type ProjectFile } from '@vcwriter/domain';
import { BeatWriter } from './BeatWriter';
import { useModal } from '../use-modal';
import { useMovedDialog } from '../use-moved-dialog';

interface BeatDialogProps {
  file: ProjectFile;
  beatId: BeatId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Writing in a beat makes it the selection, so the rest of the app follows. */
  onSelect?(beatId: BeatId): void;
  /** Move this beat to a window of its own (addendum 02 §8). */
  onPopOut?(beatId: BeatId): void;
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
export function BeatDialog({ file, beatId, onClose, onUpdate, onSelect, onPopOut }: BeatDialogProps) {
  const beat = beatId ? findBeat(file, beatId) : undefined;
  const dialog = useModal(Boolean(beat));
  // A different beat is a fresh screen, so it opens where a dialog opens.
  const { placed, grab } = useMovedDialog(dialog, beatId);

  return (
    <dialog
      ref={dialog}
      className="writer-dialog"
      aria-label={nounsFor(file.project.format).sub}
      // Moved, it is placed rather than centred; untouched, the browser
      // centres it and no style of ours says otherwise.
      style={placed}
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
          {...(onPopOut ? { onPopOut: () => onPopOut(beat.id) } : {})}
        />
      ) : null}
    </dialog>
  );
}
