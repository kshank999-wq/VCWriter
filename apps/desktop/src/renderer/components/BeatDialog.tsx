import { findBeat, type BeatId, type ProjectFile } from '@vcwriter/domain';
import { BeatWriter } from './BeatWriter';
import { useModal } from '../use-modal';

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
 */
export function BeatDialog({ file, beatId, onClose, onUpdate, onSelect, onPopOut }: BeatDialogProps) {
  const beat = beatId ? findBeat(file, beatId) : undefined;
  const dialog = useModal(Boolean(beat));
  return (
    <dialog ref={dialog} className="writer-dialog" aria-label="Beat" onClose={onClose}>
      {beat ? (
        <BeatWriter
          file={file}
          beat={beat}
          onClose={onClose}
          onUpdate={onUpdate}
          {...(onSelect ? { onSelect } : {})}
          {...(onPopOut ? { onPopOut: () => onPopOut(beat.id) } : {})}
        />
      ) : null}
    </dialog>
  );
}
