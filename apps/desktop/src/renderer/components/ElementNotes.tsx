import { useState } from 'react';
import { noteUsed, type OutlineItem, type ProjectFile, type ResearchItem } from '@vcwriter/domain';

/**
 * The notes for one part of the story, down the right of its screen (from
 * Ken): the scene or section box, and the beat or subsection writing screen.
 *
 * It holds every note filed to that part — the ones dropped on it in
 * Research's outline and the ones from VC Writer Notes sorted into it. A
 * note not yet used has a red mark; one that has been used, green. **Hide
 * used notes** (on by default) takes the green ones away; off, they come
 * back, at the foot of the list. A double-click opens the note to rewrite
 * and place. The panel folds to a narrow strip.
 *
 * Under a beat or subsection it also lists the outline's rows beneath it —
 * anything deeper than a beat is written in the beat's own screen rather
 * than standing on the track (from Ken: *anything beneath that will be in a
 * right hand menu with the beat or subsection writing screen*).
 */
export function ElementNotes({
  file,
  notes,
  rows = [],
  placeWord,
  onOpen,
}: {
  file: ProjectFile;
  notes: ReadonlyArray<ResearchItem>;
  /** Outline rows beneath this part, written into it rather than placed on the track. */
  rows?: ReadonlyArray<OutlineItem>;
  /** What placing a note does here, for the hint: "add it as a beat", "place its text". */
  placeWord: string;
  onOpen(note: ResearchItem): void;
}) {
  const [open, setOpen] = useState(() => read('vcw-element-notes-open', true));
  const [hideUsed, setHideUsed] = useState(() => read('vcw-element-notes-hide-used', true));
  const keep = (key: string, value: boolean) => {
    try {
      window.localStorage.setItem(key, value ? '1' : '0');
    } catch {
      // A browser that keeps nothing still folds and hides for this visit.
    }
  };

  const marked = notes.map((note) => ({ note, used: noteUsed(file, note) }));
  // Unused first, in the order they were filed; used ones after, at the foot.
  const shown = [...marked.filter((one) => !one.used), ...(hideUsed ? [] : marked.filter((one) => one.used))];
  const waiting = marked.filter((one) => !one.used).length;

  if (!open) {
    return (
      <aside className="element-notes folded" aria-label="Notes">
        <button
          type="button"
          className="ghost element-notes-unfold"
          title="Show the notes for this part"
          aria-label={`Show notes (${waiting} not used)`}
          onClick={() => {
            setOpen(true);
            keep('vcw-element-notes-open', true);
          }}
        >
          <span className="element-notes-strip">Notes</span>
          {waiting > 0 ? <span className="element-notes-badge">{waiting}</span> : null}
        </button>
      </aside>
    );
  }

  return (
    <aside className="element-notes" aria-label="Notes">
      <header className="element-notes-head">
        <h4>
          Notes <span className="muted small">{waiting} not used</span>
        </h4>
        <button
          type="button"
          className="ghost small"
          aria-label="Hide the notes"
          title="Fold the notes away"
          onClick={() => {
            setOpen(false);
            keep('vcw-element-notes-open', false);
          }}
        >
          ›
        </button>
      </header>
      <label className="element-notes-hide">
        <input
          type="checkbox"
          checked={hideUsed}
          onChange={(event) => {
            setHideUsed(event.target.checked);
            keep('vcw-element-notes-hide-used', event.target.checked);
          }}
        />{' '}
        Hide used notes
      </label>
      {notes.length === 0 ? (
        <p className="muted small">
          No notes filed here yet. Drop one on this part in Research&rsquo;s outline, or sort one here from VC Writer
          Notes.
        </p>
      ) : (
        <>
          <p className="muted small">Double-click a note to rewrite it and {placeWord}.</p>
          <ul className="element-notes-list">
            {shown.map(({ note, used }) => (
              <li key={note.id}>
                <button
                  type="button"
                  className={`element-note${used ? ' used' : ' waiting'}`}
                  title={used ? 'Used — double-click to open it again' : 'Not used yet — double-click to rewrite and place it'}
                  onDoubleClick={() => onOpen(note)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(note);
                  }}
                >
                  <span className="element-note-dot" aria-label={used ? 'Used' : 'Not used yet'} />
                  <span className="element-note-text">
                    <strong>{note.title || 'Untitled note'}</strong>
                    {note.body.trim() ? <span className="element-note-body">{note.body.trim()}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hideUsed && marked.length > shown.length ? (
            <p className="muted small">
              {marked.length - shown.length} used {marked.length - shown.length === 1 ? 'note is' : 'notes are'} hidden.
            </p>
          ) : null}
        </>
      )}
      {rows.length > 0 ? (
        <section className="element-notes-rows">
          <h5>Beneath this in the outline</h5>
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <strong>{row.title || 'Untitled'}</strong>
                {row.body.trim() ? <span className="element-note-body">{row.body.trim()}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

const read = (key: string, fallback: boolean): boolean => {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
};
