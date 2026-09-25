import { useEffect, useState } from 'react';
import { beatPeek, describePeek, type BeatPeek, type ProjectFile } from '@vcwriter/domain';

/**
 * **The beat under the pointer, read without opening it** (addendum 02 §4c,
 * from Ken: *when you hover over a beat in a scene, I want to be able to see
 * the entire description of the beat… and these changes need to be
 * universal*).
 *
 * **Universal is the whole design.** A card built into the timeline would
 * have to be built again in the scene dialog, the Outliner, the Sculptor, the
 * Script and three panels — six more answers to *what is in this beat*, and a
 * seventh surface built next month with none. So this is **one listener over
 * the whole window**: a row says which beat it is with `data-beat`, and the
 * card follows from that. Adding the hover to a new screen is adding one
 * attribute, and forgetting it is the only way to be without it.
 *
 * It is mounted once per window — the workspace and every popped-out room —
 * because a room on the other monitor must not be able to do less than the
 * panel it came out of.
 *
 * Three rules. **It never covers the row it describes**: it stands to the
 * side, and flips when there is no room. **It goes on any press or key**,
 * being for reading and never for acting — a card that survived a click would
 * sit over the thing the click was about. And **nothing about it is stored**,
 * so it cannot be stale and there is no state to get wrong.
 */

/** Long enough that running the pointer across a track draws nothing. */
const WAIT_MS = 260;
const CARD_WIDTH = 340;
const GAP = 12;

interface Standing {
  peek: BeatPeek;
  /** What the keys on this row do, where the row says so (`data-keys`). */
  keys: string;
  /** Where the row is, so the card can stand beside it. */
  box: { left: number; right: number; top: number; bottom: number };
}

export function BeatPeekLayer({ file }: { file: ProjectFile }) {
  const [standing, setStanding] = useState<Standing | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let over: string | null = null;

    const drop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      over = null;
      setStanding(null);
    };

    const onOver = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const row = target?.closest?.('[data-beat]') as HTMLElement | null;
      const id = row?.dataset.beat ?? null;
      if (!id) {
        if (over) drop();
        return;
      }
      if (id === over) return;
      if (timer) clearTimeout(timer);
      over = id;
      timer = setTimeout(() => {
        // Read at the moment it is shown rather than when the pointer
        // arrived, so a card never describes a beat as it was.
        const peek = beatPeek(file, id);
        if (!peek) return;
        const box = row!.getBoundingClientRect();
        setStanding({
          peek,
          keys: row!.dataset.keys ?? '',
          box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
        });
      }, WAIT_MS);
    };

    // A press or a key is the writer doing something, and a card standing
    // over what they are doing is in the way.
    window.addEventListener('pointerover', onOver, true);
    window.addEventListener('pointerdown', drop, true);
    window.addEventListener('keydown', drop, true);
    window.addEventListener('scroll', drop, true);
    window.addEventListener('blur', drop);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointerover', onOver, true);
      window.removeEventListener('pointerdown', drop, true);
      window.removeEventListener('keydown', drop, true);
      window.removeEventListener('scroll', drop, true);
      window.removeEventListener('blur', drop);
    };
  }, [file]);

  if (!standing) return null;
  const { peek, keys, box } = standing;
  // Beside the row, flipped where the window ends. The card is tall enough to
  // hold a whole description, so it is placed from the top and allowed to
  // scroll rather than being cut off.
  const room = window.innerWidth - box.right - GAP;
  const left = room >= CARD_WIDTH ? box.right + GAP : Math.max(GAP, box.left - CARD_WIDTH - GAP);
  const top = Math.min(Math.max(GAP, box.top), Math.max(GAP, window.innerHeight - 260));

  return (
    <div className="beat-peek" role="tooltip" style={{ left, top, width: CARD_WIDTH }}>
      <strong className="beat-peek-title">{peek.title}</strong>
      <span className="muted small beat-peek-where">{describePeek(peek)}</span>
      {peek.summary ? (
        // **Whole, never cut** — the sentence a writer cannot otherwise read
        // without opening the beat is the entire point of the card.
        <p className="beat-peek-summary">{peek.summary}</p>
      ) : peek.standsIn ? (
        <>
          <span className="muted small">Nothing described yet. It opens:</span>
          <p className="beat-peek-opening">{peek.opening}</p>
        </>
      ) : (
        <p className="muted small">Nothing described, and nothing written yet.</p>
      )}
      {peek.summary && peek.opening ? <p className="beat-peek-opening">{peek.opening}</p> : null}
      {/* What the row's own keys do, which the native tooltip used to say —
          here rather than beside, two tooltips on one row being two answers. */}
      {keys ? <span className="beat-peek-keys">{keys}</span> : null}
    </div>
  );
}
