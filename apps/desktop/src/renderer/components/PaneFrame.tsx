import { PANE_NAMES, SLOT_IDS, SLOT_NAMES, slotOf, type Arrangement, type PaneId, type SlotId } from '../panes';

interface PaneFrameProps {
  pane: PaneId;
  arrangement: Arrangement;
  onMove(pane: PaneId, to: SlotId): void;
  /** The section is in a window of its own; the workspace holds its place. */
  detached: boolean;
  onDetach(): void;
  onAttach(): void;
  /** Which section is being dragged, so a target can show it will take it. */
  dragging: PaneId | null;
  onDragStart(pane: PaneId): void;
  onDragEnd(): void;
  onDrop(onto: PaneId): void;
  children: React.ReactNode;
}

/**
 * The strip along the top of a section, and the section under it
 * (addendum 02 §8).
 *
 * It is deliberately thin — a section's own controls are inside it, and this
 * is only about *where the section is*. Three things live here: its name,
 * which doubles as the grip you drag it by; a menu of the four places, so the
 * arrangement can be changed without a mouse; and the control that takes the
 * section out into a window of its own.
 *
 * Dragging one section onto another swaps them. There is no notion of an
 * empty place or a section pushed off the edge: four sections, four places,
 * and every rearrangement is a permutation of them.
 */
export function PaneFrame({
  pane,
  arrangement,
  onMove,
  detached,
  onDetach,
  onAttach,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  children,
}: PaneFrameProps) {
  const name = PANE_NAMES[pane];
  const target = dragging !== null && dragging !== pane;

  return (
    <section
      className={`pane pane-${pane}${target ? ' drop-target' : ''}${detached ? ' detached' : ''}`}
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
          aria-label={detached ? `Bring ${name} back` : `Open ${name} in its own window`}
          title={detached ? `Bring ${name} back into the workspace` : `Open ${name} in its own window`}
          onClick={detached ? onAttach : onDetach}
        >
          {detached ? '⇤' : '⧉'}
        </button>
      </header>

      {detached ? (
        <div className="pane-away">
          <p className="muted">{name} is in a window of its own.</p>
          <button type="button" className="ghost" onClick={onAttach}>
            Bring it back
          </button>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
