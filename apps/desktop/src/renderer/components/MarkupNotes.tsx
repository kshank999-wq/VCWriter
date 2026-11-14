import { MARK_KIND_NAMES, type MarkupNote } from '@vcwriter/domain';

/**
 * **Markup notes**, down the right of the writing screen (from Ken, 13
 * November: *it'll list that note in the margin, or it'll create a collapsible
 * margin that you can turn on and off… they'll be numbered. And when you
 * address the note, it can be hid just like the notes from the research
 * section. They'll be called markup notes*).
 *
 * One line for every mark on this beat's markup drafts, numbered as the
 * circle on the page is. **Addressed** ticks one off; **Hide addressed** (on
 * by default, as *Hide used notes* is) takes the ticked ones off the list and
 * their circles off the page. A click on a note goes to its words. The panel
 * folds to a narrow strip.
 */
export function MarkupNotes({
  notes,
  open,
  onOpenChange,
  hideAddressed,
  onHideAddressed,
  onAddressed,
  onShow,
  missing,
}: {
  notes: ReadonlyArray<MarkupNote>;
  open: boolean;
  onOpenChange(open: boolean): void;
  hideAddressed: boolean;
  onHideAddressed(hide: boolean): void;
  onAddressed(note: MarkupNote, addressed: boolean): void;
  /** Go to the note's words on the page. */
  onShow(note: MarkupNote): void;
  /** Notes whose words are no longer in this draft, by number. */
  missing: ReadonlySet<number>;
}) {
  const waiting = notes.filter((one) => !one.mark.addressed).length;
  const shown = hideAddressed ? notes.filter((one) => !one.mark.addressed) : notes;

  if (!open) {
    return (
      <aside className="element-notes markup-notes folded" aria-label="Markup notes">
        <button
          type="button"
          className="ghost element-notes-unfold"
          title="Show the markup notes"
          aria-label={`Show markup notes (${waiting} to address)`}
          onClick={() => onOpenChange(true)}
        >
          <span className="element-notes-strip">Markup</span>
          {waiting > 0 ? <span className="element-notes-badge">{waiting}</span> : null}
        </button>
      </aside>
    );
  }

  return (
    <aside className="element-notes markup-notes" aria-label="Markup notes">
      <header className="element-notes-head">
        <h4>
          Markup notes <span className="muted small">{waiting} to address</span>
        </h4>
        <button type="button" className="ghost small" aria-label="Fold the markup notes away" title="Fold the markup notes away" onClick={() => onOpenChange(false)}>
          ›
        </button>
      </header>
      <label className="element-notes-hide">
        <input type="checkbox" checked={hideAddressed} onChange={(event) => onHideAddressed(event.target.checked)} /> Hide addressed
      </label>
      <ol className="markup-note-list">
        {shown.map((note) => (
          <li key={`${note.revisionId}:${note.mark.id}`} className={`markup-note${note.mark.addressed ? ' addressed' : ''}`}>
            <button
              type="button"
              className="mark-num"
              title={missing.has(note.number) ? 'Its words are no longer in this draft' : 'Go to it on the page'}
              onClick={() => onShow(note)}
            >
              {note.number}
            </button>
            <span className="markup-note-text">
              <span
                className={`marked-kind marked-kind-${note.mark.kind}`}
                style={note.mark.kind === 'highlight' ? { background: note.mark.colour } : undefined}
              >
                {MARK_KIND_NAMES[note.mark.kind]}
              </span>{' '}
              {note.quote.trim() ? <q>{note.quote.trim().slice(0, 90)}</q> : null}
              {note.mark.kind === 'suggest' ? <span> → “{note.mark.replacement}”</span> : null}
              {note.mark.note.trim() ? <span className="markup-note-said">{note.mark.note.trim()}</span> : null}
              <span className="muted small markup-note-by">
                {note.markedBy || note.revisionName}
                {missing.has(note.number) ? ' · no longer in this draft' : ''}
              </span>
              <label className="markup-note-done">
                <input type="checkbox" checked={note.mark.addressed} onChange={(event) => onAddressed(note, event.target.checked)} /> Addressed
              </label>
            </span>
          </li>
        ))}
      </ol>
      {hideAddressed && notes.length > shown.length ? (
        <p className="muted small">
          {notes.length - shown.length} addressed {notes.length - shown.length === 1 ? 'note is' : 'notes are'} hidden.
        </p>
      ) : null}
    </aside>
  );
}
