import { useRef, useState } from 'react';
import { SAVE_KIND_WORDS, saveOffer, type ProjectFile, type SaveKind } from '@vcwriter/domain';
import { ContextMenu, type MenuEntry } from './ContextMenu';

/**
 * Save as, and save a copy, from inside a room (addendum 29 §2, from Ken
 * sending §1's ask a second time word for word).
 *
 * **The feature was built and unreachable from every room**, which in this
 * project has meant one thing six times now (addendum 20 §15c, §16b, §16c,
 * addendum 25 §4d, §4f) and meant it again. §1 gave the rooms the File menu's
 * two accelerators and argued the keys were enough — *the program's acts and
 * not a focused field's*, which is addendum 02 §6c's reason for undo. That
 * argument is **right about where the act belongs and wrong about whether
 * anybody can find it**: undo's keys are the two every writer already knows,
 * and nothing about a room says a save-as is waiting behind one.
 *
 * Measured in the real preview before this was written: in all five rooms the
 * File button is **in the DOM and covered** by the room's own bar — Research
 * by its search box, the Sculptor and Layout by `sculptor-bar`, the Note
 * Sorter by its tabs, the Outliner by its tools. The shortcut fired in every
 * one of them. **So the act worked, every test passed, and there was no way to
 * see that it was there**, which from the writer's chair is the feature not
 * existing.
 *
 * It is **one component in five bars** rather than five buttons, for
 * `printing.ts`'s reason: a room that built its own would be a second answer
 * to what these two acts are, free to disagree the moment either changed. And
 * it opens the program's own `ContextMenu` rather than a popover of its own,
 * so a menu looks and behaves the same wherever it comes from.
 */

export interface RoomSaveProps {
  file: ProjectFile;
  /**
   * What the host does with the ask.
   *
   * In the workspace it is the project's own `saveAs`; in a popped-out room it
   * is relayed, because **a room does not write the file** (§7). Absent where
   * a host hands nothing down, which is this room's idiom for *not here*
   * (`onPopOut`'s shape) rather than a control that could only refuse.
   */
  onSaveAs(kind: SaveKind): void;
}

export function RoomSave({ file, onSaveAs }: RoomSaveProps) {
  const button = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  /**
   * The two offers, in the domain's own words — so the room says exactly what
   * the File menu says, and the sentence under each label is what a press
   * would do rather than a second description written here.
   */
  const entries: MenuEntry[] = (['as', 'copy'] as const).map((kind) => {
    const offer = saveOffer(file, kind);
    return {
      label: SAVE_KIND_WORDS[kind],
      note: offer.sentence,
      disabled: offer.allowed ? null : offer.sentence,
      onPick: () => onSaveAs(kind),
    };
  });

  return (
    <>
      <button
        ref={button}
        type="button"
        className="tool"
        aria-haspopup="menu"
        aria-expanded={at !== null}
        title="Save this project somewhere else, or leave a copy"
        onClick={() => {
          // Under its own left edge, so the menu hangs off the control that
          // opened it rather than appearing at the pointer — a bar button is
          // not a right-click.
          const box = button.current?.getBoundingClientRect();
          setAt(box ? { x: box.left, y: box.bottom + 2 } : { x: 0, y: 0 });
        }}
      >
        Save ▾
      </button>
      {at ? (
        <ContextMenu x={at.x} y={at.y} label="Save" entries={entries} onClose={() => setAt(null)} />
      ) : null}
    </>
  );
}
