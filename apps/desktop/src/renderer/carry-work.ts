import type { UsageLink } from '@vcwriter/domain';

/** What a usage link can belong to: a characterization item, or an arc point. */
type UsageOwnerKind = UsageLink['ownerKind'];

/**
 * Carrying a piece of somebody's plan to a beat (addendum 08 §13, his §10).
 *
 * §10 asks for *drag/drop or assign*. Stage 6 built the press and said why: a
 * press that names where something lands is the same act with fewer ways to
 * miss. That is true of the beat already **selected**, which is the whole of
 * what a press can reach — and reaching a beat that is *not* selected is
 * exactly what the drag adds. So both exist, and neither replaces the other.
 *
 * **The drop is claimed by type.** A beat takes a drop only when the drag
 * carries this MIME type, which is the difference between adding a convenience
 * and breaking editing: dragging a line of dialogue inside the manuscript is a
 * browser behaviour a writer already uses, and a beat that called
 * `preventDefault` on every drag would swallow it. `dataTransfer.types` is
 * readable during `dragover` where `getData` is not, so the type is the only
 * thing that can answer the question at the moment it has to be answered.
 *
 * That is also why the payload rides in `dataTransfer` rather than in a ref, as
 * the research shelf's does: this drag crosses two panes, and a ref in one
 * component is not readable from the other.
 */

/** Ours, and nothing else's. A beat ignores a drag that does not carry it. */
export const WORK_TYPE = 'application/x-vcwriter-character-work';

export interface CarriedWork {
  ownerKind: UsageOwnerKind;
  ownerId: string;
  /** What it is, for the drag image and for a title on the way past. */
  label: string;
}

/** Put a piece of work on a drag. */
export const carryWork = (transfer: DataTransfer, work: CarriedWork): void => {
  transfer.setData(WORK_TYPE, JSON.stringify(work));
  // Something has to be set in a type the platform recognises or some
  // environments refuse to begin the drag at all.
  transfer.setData('text/plain', work.label);
  // Copied, not moved: pinning leaves the item where it is and adds a usage
  // link, exactly as the press does (§2 — the colour is read, never set).
  transfer.effectAllowed = 'copy';
};

/** Whether this drag is one of ours, asked during `dragover` where only types are readable. */
export const carryingWork = (transfer: DataTransfer | null): boolean =>
  transfer !== null && Array.from(transfer.types).includes(WORK_TYPE);

/** What is being carried, or null for a drag that is not ours or is malformed. */
export const workCarried = (transfer: DataTransfer | null): CarriedWork | null => {
  if (!carryingWork(transfer)) return null;
  try {
    const parsed = JSON.parse(transfer!.getData(WORK_TYPE)) as Partial<CarriedWork>;
    if (typeof parsed.ownerId !== 'string' || typeof parsed.ownerKind !== 'string') return null;
    return {
      ownerKind: parsed.ownerKind as UsageOwnerKind,
      ownerId: parsed.ownerId,
      label: typeof parsed.label === 'string' ? parsed.label : '',
    };
  } catch {
    return null;
  }
};
