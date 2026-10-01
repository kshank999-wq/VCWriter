import { useEffect, useRef } from 'react';
import type { ProjectFile, ResearchCategoryId, ResearchItem } from '@vcwriter/domain';
import { useModal } from '../use-modal';
import { useMovedDialog } from '../use-moved-dialog';

/**
 * The note's own screen, in the middle (addendum 28 §6).
 *
 * From Ken: *when you create a note, I would like a dialog box in the center
 * that you can type into, like a beat in a script or something, because trying
 * to type it into the sidebar, it just doesn't feel right.*
 *
 * **It is a feeling with a measurement under it.** Driven at 1440×900, pressing
 * *+ Note* put the writing box at **287 × 204** in a 320px column pinned to the
 * right edge, with **860px of the middle of the screen empty** — and left focus
 * **on the + Note button**, so the act made a note called *New note* and then
 * did nothing whatever to help a writer write it. A research note is a thing
 * somebody composes, and this room was treating it as a property of a
 * selection.
 *
 * So a note opens where a beat opens: the middle, with the cursor in it. It is
 * the beat dialog's own chrome rather than a second idea of what a writing
 * screen is — the name across the top, the words under it, Escape and × to
 * close, and **saved as you type**, which is what the room already does and why
 * there is no *Save* here to imply otherwise.
 *
 * **It is not a second copy of the aside.** `NoteFields` is one component drawn
 * in both, writing the same fields through the same calls — *a second control
 * onto one field* (addendum 20 §16d) rather than two screens that could come to
 * disagree, which is the fault §15c removed from Layout and §9m settled with
 * `ChapterStyleFields`. What differs is the size of the box and where the
 * cursor lands, which is the whole of Ken's complaint.
 *
 * **And its bar moves** (§6a, from Ken: *make the top bar draggable too*),
 * which is the beat's own gesture and is now literally the beat's own code —
 * `useMovedDialog`, lifted out of `BeatDialog` rather than written a second
 * time here. *Like a beat in a script* turns out to be a claim about what the
 * screen can do as well as where it stands.
 */
export function NoteDialog({
  file,
  item,
  startOn,
  children,
  onClose,
}: {
  file: ProjectFile;
  /** The note being written, or null when nothing is open. */
  item: ResearchItem | null;
  /**
   * Where the cursor goes, which **the act decides rather than the route**
   * (addendum 25 §4e's `onOpenCharacter`): a note just made is unnamed, so the
   * title is focused and selected and the first keystroke replaces the name the
   * program gave it; a note opened to be read or added to is already named, so
   * the writing takes the cursor.
   */
  startOn: 'title' | 'body';
  /** `NoteFields`, supplied by the room so this holds no second copy of them. */
  children(refs: {
    titleRef: React.RefObject<HTMLInputElement>;
    bodyRef: React.RefObject<HTMLTextAreaElement>;
  }): React.ReactNode;
  onClose(): void;
}) {
  const dialog = useModal(item !== null);
  // A different note is a fresh screen, so it opens centred like any dialog.
  const { placed, grab } = useMovedDialog(dialog, item?.id);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Ken's sentence is *a dialog box you can type into*, so it arrives ready to
  // be typed into. The id is in the dependencies because opening a second note
  // without closing the first is one open dialog and two notes, and the cursor
  // belongs in the one now in hand.
  useEffect(() => {
    if (!item) return;
    const box = startOn === 'title' ? titleRef.current : bodyRef.current;
    if (!box) return;
    box.focus();
    // Selected rather than merely focused: the name is the program's (*New
    // note*), so the first keystroke should replace it rather than append to
    // it — addendum 20 §16e's rule that a field says what was typed.
    if (startOn === 'title' && box instanceof HTMLInputElement) box.select();
  }, [item?.id, startOn]);

  if (!item) return null;

  return (
    <dialog
      ref={dialog}
      className="note-dialog"
      aria-label={item.title || 'Note'}
      // Moved, it is placed rather than centred; untouched, the browser
      // centres it and no style of ours says otherwise.
      style={placed}
      onClose={onClose}
      onCancel={onClose}
    >
      <header className="bar-grab" onPointerDown={grab}>
        <span className="note-dialog-where muted">
          {file.researchCategories.find((category) => category.id === item.categoryId)?.name ?? 'Research'}
        </span>
        <span className="note-dialog-saved muted small">✓ Saved as you type</span>
        <button type="button" className="ghost" aria-label="Close the note" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="note-dialog-body">{children({ titleRef, bodyRef })}</div>
    </dialog>
  );
}

export type { ResearchCategoryId };
