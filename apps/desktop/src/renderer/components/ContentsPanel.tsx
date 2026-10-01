import { useMemo, useState, type DragEvent } from 'react';
import {
  contentsNumber,
  contentsShelf,
  describeContents,
  describeContentsRow,
  describeProgress,
  fileNoteUnder,
  filingOffer,
  noteProgress,
  onlyLiving,
  placeKey,
  unfileNote,
  type ContentsRow,
  type NotePlace,
  type ProjectFile,
  type ResearchItem,
  type ResearchItemId,
  type StoryMarkerId,
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
  /**
   * Picking a note up off this screen's own shelf (addendum 28 §4c).
   *
   * **Without it there was nothing to drag.** This panel takes the whole of the
   * room's middle, so while it is showing, the note cards are not drawn
   * anywhere — the boxes were a drop target with no source on the screen, which
   * is the Outliner's own lesson (addendum 06 §3 put the research shelf *inside*
   * that room for exactly this reason) arriving one room over.
   */
  onDragNote?(id: ResearchItemId | null): void;
  /** Opening a note where it lives, which is still its folder. */
  onOpenNote?(item: ResearchItem): void;
  /**
   * Setting a chapter's own page — its title, its number and what it covers
   * (addendum 28 §4a, from Ken: *when you create a chapter in the table of
   * contents you will need to eventually put a title of what that's about*).
   *
   * **A route, never a second copy**: the screen that sets those is the
   * chapter page's own (`File ▸ Chapter page…`), and a second pair of boxes
   * here would be a second answer to what a chapter is called — the fault
   * addendum 20 §15c removed from Layout. Absent where the caller cannot
   * open it, which is this room's own idiom for *not here*.
   */
  onOpenChapter?(markerId: StoryMarkerId): void;
}

const LIGHTS = {
  written: 'In the book',
  planned: 'Placed',
  unfiled: 'Not placed',
} as const;

export function ContentsPanel({
  file,
  onUpdate,
  dragging,
  onDragEnd,
  onOpenNote,
  onOpenChapter,
  onDragNote,
}: ContentsPanelProps) {
  const rows = useMemo(() => contentsShelf(file), [file]);
  const said = useMemo(() => describeContents(file), [file]);
  /** Everything nobody has placed yet — what the shelf holds. */
  const loose = useMemo(
    () => onlyLiving(file.researchItems).filter((item) => noteProgress(file, item) === 'unfiled'),
    [file],
  );

  /** Which box is open. About this minute, so it is remembered nowhere. */
  const [open, setOpen] = useState<NotePlace | null>(null);
  /** The box the pointer is over while something is in the air. */
  const [over, setOver] = useState<string | null>(null);
  /** What the last drop did, said because a drop that does nothing must say so. */
  const [said_, setSaid] = useState<string | null>(null);

  // `placeKey` is the domain's — three kinds of place since §4c, and a key
  // written out here would be a second answer to which box is which.
  const keyOf = placeKey;

  const chosen = open ? rows.find((row) => keyOf(row.place) === keyOf(open)) ?? null : null;

  /**
   * The two groups (§4c). The manuscript's chapters and sections first, then
   * the Outliner's rows that are still plans — **never interleaved**, a plan
   * having no place in the story order to be interleaved at.
   */
  const inBook = rows.filter((row) => !row.planned);
  const plans = rows.filter((row) => row.planned);

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

  /**
   * File by a press, into whichever box is chosen.
   *
   * **The press is the act and the drag is the browser's** (addendum 26 §2) —
   * the drag is the gesture Ken asked for and a press is the only path a
   * keyboard can reach, so the chip is one control with two doors rather than
   * a second list beside it. It reads the same `filingOffer` the drop does.
   */
  const fileInto = (itemId: ResearchItemId, place: NotePlace) => {
    const offer = filingOffer(file, itemId, place);
    setSaid(offer.says);
    if (!offer.may) return;
    onUpdate((current) => fileNoteUnder(current, itemId, place));
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
          row.depth === 0 ? 'chapter' : 'section',
          row.planned ? 'planned' : '',
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
        aria-label={[
          describeContentsRow(row, file),
          // Said in the name as well as drawn, because *planned* is the one
          // thing about a box that is not in its words (§4c).
          row.planned ? 'planned' : '',
          row.notes.length > 0
            ? `${row.notes.length} note${row.notes.length === 1 ? '' : 's'}`
            : '',
        ]
          .filter(Boolean)
          .join(' — ')}
        aria-pressed={chosen ? keyOf(chosen.place) === key : false}
        onClick={() => setOpen(chosen && keyOf(chosen.place) === key ? null : row.place)}
        onDoubleClick={() => {
          if (row.place.kind === 'chapter') onOpenChapter?.(row.place.markerId);
        }}
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
        <span className="toc-number">{contentsNumber(row) || '—'}</span>
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

      {/* **What there is to sort** (addendum 28 §4c). Without it the boxes were
          a place to drop with nothing on the screen to drop: this panel takes
          the whole of the room's middle, so while it is showing, the note cards
          are drawn nowhere. Absent once everything is placed, the header
          sentence already saying so. */}
      {loose.length > 0 ? (
        <section className="toc-shelf" aria-label="Notes not placed yet">
          <h5>
            Not placed yet
            <span className="muted small">
              {' · '}
              {chosen
                ? `drag one onto a box, or press it to file it under ${describeContentsRow(chosen, file)}`
                : 'drag one onto a box, or choose a box and press one'}
            </span>
          </h5>
          <ul className="toc-loose">
            {loose.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="toc-chip"
                  draggable
                  onDragStart={() => onDragNote?.(item.id)}
                  onDragEnd={() => onDragNote?.(null)}
                  // One control, two doors: the drag Ken asked for, and the
                  // press a keyboard can reach. With no box chosen it opens the
                  // note where it lives rather than refusing — a control that
                  // can only refuse is one a writer stops trusting.
                  onClick={() => (chosen ? fileInto(item.id, chosen.place) : onOpenNote?.(item))}
                  title={chosen ? filingOffer(file, item.id, chosen.place).says : item.title}
                >
                  {item.title || <em>Untitled</em>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <p className="muted">
          Nothing to list yet. Chapters and sections are made in the Outliner, and turn up here
          once they are.
        </p>
      ) : (
        <>
          {inBook.length > 0 ? (
            <section className="toc-group">
              {/* Named only where there is a second group to tell it from:
                  a heading over the only list on the screen says nothing. */}
              {plans.length > 0 ? <h5>In the book</h5> : null}
              <div className="toc-boxes">{inBook.map(box)}</div>
            </section>
          ) : null}
          {/* The plans (§4c). A heading rather than a mixed list, because a
              chapter the book has and one that is still a row in the Outliner
              are two different things — and this is where Ken's rough material
              goes, so it carries the sentence that says nothing is reached by
              dropping on it. */}
          {plans.length > 0 ? (
            <section className="toc-group toc-plans">
              <h5>
                Planned in the Outliner
                <span className="muted small"> · not in the book yet</span>
              </h5>
              <div className="toc-boxes">{plans.map(box)}</div>
              <p className="toc-plans-note">
                Filing a note here changes nothing in the Outliner. When you add the chapter to
                the track its notes come with it.
              </p>
            </section>
          ) : null}
        </>
      )}

      {said_ ? <p className="small toc-said">{said_}</p> : null}

      {chosen ? (
        <section className="toc-under">
          <h4>{describeContentsRow(chosen, file)}</h4>
          {chosen.summary ? <p className="muted small">{chosen.summary}</p> : null}

          {onOpenChapter && chosen.place.kind === 'chapter' ? (
            <div className="toc-route">
              <button
                type="button"
                className="ghost small"
                onClick={() =>
                  chosen.place.kind === 'chapter' ? onOpenChapter(chosen.place.markerId) : undefined
                }
              >
                Set this chapter's page…
              </button>
              {/* Under the control it belongs to rather than running on beside
                  it: which control a note is about is said by the gap
                  (addendum 09 §14a). It has a rule of its own rather than
                  reaching for `.small`, which has never had one on its own in
                  this stylesheet — that addendum's finding, and it would have
                  drawn at full body colour between the button and the notes. */}
              <p className="toc-route-note">
                Its title, whether the number prints, and what it covers. A double-click on
                the box above opens the same screen.
              </p>
            </div>
          ) : null}

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
