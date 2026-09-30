import { useMemo, useState, type DragEvent } from 'react';
import {
  contentsShelf,
  describeContents,
  describeContentsRow,
  describeProgress,
  fileNoteUnder,
  filingOffer,
  noteProgress,
  unfileNote,
  type ContentsRow,
  type NotePlace,
  type ProjectFile,
  type ResearchItem,
  type ResearchItemId,
} from '@vcwriter/domain';

/**
 * The table of contents, in the research room (addendum 28 §4).
 *
 * From Ken: *the research section on the top will have table of contents and
 * it will list them in boxes. So when you select that, and you put anything in
 * the notes section, you can just drop it in and it'll show up in the research
 * section.*
 *
 * **It defines nothing.** The chapters are the Outliner's — this is a reading
 * of them, drawn as somewhere to put things. That is the whole of why there is
 * no *+ Chapter* here: a second screen that made chapters would be a second
 * answer to what this book's chapters are, and the room has removed exactly
 * that fault twice (addendum 20 §15c, §9u). A press that would need one says
 * where to go instead.
 *
 * Two things it shows that a folder cannot:
 *
 *  - **Where in the book a note belongs**, rather than which shelf it is on.
 *    A note keeps its folder; these are two questions and both are answered.
 *  - **How far along each one is** — `noteProgress`, read every time, so
 *    cutting the beat a note fed turns it back with nothing run. That is the
 *    light Ken asked for *like in a screenplay*, and it is the Character
 *    Creator's rule rather than the flag research used to carry.
 */
interface ContentsPanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** What is being dragged in the room, so a box can light up for it. */
  dragging: { kind: 'item' | 'folder' | 'capture'; id: string } | null;
  onDragEnd(): void;
  /** Opening a note where it lives, which is still its folder. */
  onOpenNote?(item: ResearchItem): void;
}

const LIGHTS = {
  written: 'In the book',
  planned: 'Placed',
  unfiled: 'Not placed',
} as const;

export function ContentsPanel({ file, onUpdate, dragging, onDragEnd, onOpenNote }: ContentsPanelProps) {
  const rows = useMemo(() => contentsShelf(file), [file]);
  const said = useMemo(() => describeContents(file), [file]);

  /** Which box is open. About this minute, so it is remembered nowhere. */
  const [open, setOpen] = useState<NotePlace | null>(null);
  /** The box the pointer is over while something is in the air. */
  const [over, setOver] = useState<string | null>(null);
  /** What the last drop did, said because a drop that does nothing must say so. */
  const [said_, setSaid] = useState<string | null>(null);

  const keyOf = (place: NotePlace) =>
    place.kind === 'chapter' ? `c:${place.markerId}` : `s:${place.unitId}`;

  const chosen = open ? rows.find((row) => keyOf(row.place) === keyOf(open)) ?? null : null;

  const drop = (row: ContentsRow) => {
    setOver(null);
    onDragEnd();
    if (!dragging || dragging.kind !== 'item') return;
    const itemId = dragging.id as ResearchItemId;
    // The sentence is the domain's and is read before the act, so the screen
    // cannot promise something `fileNoteUnder` then refuses.
    const offer = filingOffer(file, itemId, row.place);
    setSaid(offer.says);
    if (!offer.may) return;
    onUpdate((current) => fileNoteUnder(current, itemId, row.place));
    setOpen(row.place);
  };

  const box = (row: ContentsRow) => {
    const key = keyOf(row.place);
    const lit = dragging?.kind === 'item' && over === key;
    return (
      <button
        type="button"
        key={key}
        className={[
          'toc-box',
          row.place.kind === 'chapter' ? 'chapter' : 'section',
          lit ? 'over' : '',
          chosen && keyOf(chosen.place) === key ? 'chosen' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        // Named for what it is, because the number and the title are two
        // elements with only a CSS gap between them — read straight off the
        // markup a screen reader says *1Mathematics*. `describeContentsRow`
        // is the one sentence that names a row, so the name said aloud and
        // the heading drawn under the boxes cannot disagree.
        aria-label={
          row.notes.length > 0
            ? `${describeContentsRow(row, file)} — ${row.notes.length} note${row.notes.length === 1 ? '' : 's'}`
            : describeContentsRow(row, file)
        }
        aria-pressed={chosen ? keyOf(chosen.place) === key : false}
        onClick={() => setOpen(chosen && keyOf(chosen.place) === key ? null : row.place)}
        onDragOver={(event: DragEvent<HTMLElement>) => {
          if (dragging?.kind !== 'item') return;
          event.preventDefault();
          setOver(key);
        }}
        onDragLeave={() => setOver((was) => (was === key ? null : was))}
        onDrop={(event) => {
          event.preventDefault();
          drop(row);
        }}
      >
        <span className="toc-number">{row.number || '—'}</span>
        <span className="toc-title">{row.title || <em>Untitled</em>}</span>
        {/* The count is what the box is for: how much is waiting here. A box
            with nothing in it says nothing rather than drawing a 0, which on a
            fresh book would be a wall of zeroes saying the same thing. */}
        {row.notes.length > 0 ? (
          <span className="toc-count">
            {row.notes.length}
            {row.written > 0 ? <span className="toc-done"> · {row.written} in</span> : null}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="toc-panel">
      <header className="toc-head">
        <p className="muted small">{said}</p>
        <p className="muted small">
          The chapters are the Outliner's. Drop a note on one to say where in the book it
          belongs — the note keeps the folder it is in.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="muted">
          Nothing to list yet. Add chapters and sections in the Outliner and they turn up
          here.
        </p>
      ) : (
        <div className="toc-boxes">{rows.map(box)}</div>
      )}

      {said_ ? <p className="small toc-said">{said_}</p> : null}

      {chosen ? (
        <section className="toc-under">
          <h4>{describeContentsRow(chosen, file)}</h4>
          {chosen.summary ? <p className="muted small">{chosen.summary}</p> : null}

          {chosen.notes.length === 0 ? (
            <p className="muted small">
              Nothing filed here yet. Drag a note onto the box above.
            </p>
          ) : (
            <ul className="toc-notes">
              {chosen.notes.map((item) => {
                const progress = noteProgress(file, item);
                return (
                  <li key={item.id} className={`toc-note ${progress}`}>
                    <span className={`toc-light ${progress}`} aria-hidden="true" />
                    <button
                      type="button"
                      className="toc-note-name"
                      onClick={() => onOpenNote?.(item)}
                    >
                      {item.title}
                    </button>
                    <span className="toc-note-state muted small" title={describeProgress(progress)}>
                      {LIGHTS[progress]}
                    </span>
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => onUpdate((current) => unfileNote(current, item.id))}
                    >
                      Take it off
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
