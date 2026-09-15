/**
 * The control that takes a room out to a window of its own (addendum 02 §8).
 *
 * One component rather than one per room: the three rooms make the same offer
 * and the writer should meet the same mark in the same corner of each. It is
 * absent — never greyed — in a window that already *is* the room, because a
 * window has nowhere to pop out to, and that absence is what passing no
 * `onPopOut` means.
 */
export function PopOutButton({ what, onPopOut }: { what: string; onPopOut(): void }) {
  return (
    <button
      type="button"
      className="ghost"
      aria-label={`Open ${what} in its own window`}
      title={`Open ${what} in its own window — put it on another monitor`}
      onClick={onPopOut}
    >
      ⧉
    </button>
  );
}
