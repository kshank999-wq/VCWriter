import { PANE_NAMES, SLOT_IDS, SLOT_NAMES, slotOf, type Arrangement, type PaneId, type SlotId } from '../panes';

interface PaneFrameProps {
  pane: PaneId;
  arrangement: Arrangement;
  onMove(pane: PaneId, to: SlotId): void;
  onDetach(): void;
  /** Which section is being dragged, so a target can show it will take it. */
  dragging: PaneId | null;
  onDragStart(pane: PaneId): void;
  onDragEnd(): void;
  onDrop(onto: PaneId): void;
  /** What the sections are called in this format — "Manuscript" in prose. */
  names?: Record<PaneId, string>;
  children: React.ReactNode;
}

/**
 * The strip along the top of a section, and the section under it
 * (addendum 02 §8).
 *
 * It is deliberately thin — a section's own controls are inside it, and this
 * is only about *where the section is*. Three things live here: its name,
 * which doubles as the grip you drag it by; a menu of the places, so the
 * arrangement can be changed without a mouse; and the control that takes the
 * section out into a window of its own.
 *
 * Dragging one section onto another swaps them. There is no notion of an
 * empty place or a section pushed off the edge: every rearrangement is a
 * permutation of the sections that are here.
 *
 * A section that has gone to its own window is not drawn here at all — the
 * workspace closes over its place and the rest take the room — so this
 * component never has to represent an absence.
 */
export function PaneFrame({
  pane,
  arrangement,
  onMove,
  onDetach,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  names = PANE_NAMES,
  children,
}: PaneFrameProps) {
  const name = names[pane];
  const target = dragging !== null && dragging !== pane;

  return (
    <section
      className={`pane pane-${pane}${target ? ' drop-target' : ''}`}
      aria-label={name}
      onDragOver={(event) => {
        if (target) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!target) return;
        event.preventDefault();
        onDrop(pane);
      }}
    >
      <header
        className="pane-grip"
        draggable
        onDragStart={(event) => {
          onDragStart(pane);
          event.dataTransfer?.setData?.('text/plain', pane);
        }}
        onDragEnd={onDragEnd}
      >
        <span className="pane-name" title={`Drag ${name} onto another section to swap them`}>
          {name}
        </span>
        <label className="pane-place">
          <span className="visually-hidden">Move {name}</span>
          <select
            aria-label={`Move ${name}`}
            value={slotOf(arrangement, pane)}
            onChange={(event) => onMove(pane, event.target.value as SlotId)}
          >
            {SLOT_IDS.map((slot) => (
              <option key={slot} value={slot}>
                {SLOT_NAMES[slot]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="pane-out"
          aria-label={`Open ${name} in its own window`}
          title={`Open ${name} in its own window — put it on another monitor`}
          onClick={onDetach}
        >
          ⧉
        </button>
      </header>

      {children}
    </section>
  );
}
