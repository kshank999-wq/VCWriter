import {
  CAPTURE_CATEGORY_NAMES,
  captureTitle,
  inboxGroups,
  suggestRouting,
  type CaptureItem,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * The Mobile App inbox (addendum 09 §9, stage 1).
 *
 * What the phone caught, waiting to be put somewhere. **Nothing here has been
 * placed**: addendum 09 §1 is that the phone captures and the desktop places,
 * so every note in this list is still only a note, and it stays one until the
 * writer drags it or presses the button beside it.
 *
 * It lives inside the Research window rather than in a dialog of its own, and
 * that is the whole reason the drag works: the folders and the cast are both
 * down the left already, so *drag the note where it belongs* has somewhere to
 * land. A modal over the top would have had to grow its own list of
 * destinations, which is a menu pretending to be a drag.
 *
 * The suggestion under each note is the same `suggestRouting` the old approval
 * queue used — a proposal, said out loud with its reason, and the button takes
 * it in one press for anybody not using a mouse.
 */

interface MobileInboxProps {
  file: ProjectFile;
  captures: CaptureItem[];
  loading: boolean;
  error: string | null;
  /** Which note is being dragged, so the row can show it has left. */
  draggingId: string | null;
  onDragStart(capture: CaptureItem): void;
  onDragEnd(): void;
  /** Take the suggestion as it stands. */
  onAcceptSuggestion(capture: CaptureItem): void;
  onReject(capture: CaptureItem): void;
  onRefresh(): void;
}

export function MobileInbox({
  file,
  captures,
  loading,
  error,
  draggingId,
  onDragStart,
  onDragEnd,
  onAcceptSuggestion,
  onReject,
  onRefresh,
}: MobileInboxProps) {
  const groups = inboxGroups(captures);

  return (
    <div className="mobile-inbox">
      <header className="mobile-inbox-head">
        <p className="muted small">
          Caught on the phone. Drag a note onto a folder or somebody in the cast — nothing here is in the
          project yet.
        </p>
        <button type="button" className="ghost small" onClick={onRefresh} disabled={loading}>
          {loading ? 'Looking…' : 'Refresh'}
        </button>
      </header>

      {error ? <p className="muted small mobile-inbox-error">{error}</p> : null}

      {groups.length === 0 ? (
        <p className="muted empty-state">
          {loading ? 'Looking for notes…' : 'Nothing waiting. Notes sent from the phone arrive here.'}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.category ?? 'none'} className="review-group">
            <h4>
              {group.name}
              <span className="count muted">{group.captures.length}</span>
            </h4>
            <ul className="mobile-list">
              {group.captures.map((capture) => {
                const suggestion = suggestRouting(file, capture);
                return (
                  <li
                    key={capture.id}
                    className={draggingId === (capture.id as string) ? 'mobile-note lifted' : 'mobile-note'}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      // Some drop targets refuse a drag carrying nothing.
                      event.dataTransfer.setData('text/plain', capture.rawText);
                      onDragStart(capture);
                    }}
                    onDragEnd={onDragEnd}
                  >
                    <div className="mobile-note-head">
                      {/* The name they spoke, when they spoke one — it is what
                          the note is about. When they did not, there is no
                          heading at all: `captureTitle` falls back to the first
                          line, which would print the note twice. */}
                      {capture.subjectName ? (
                        <strong className="mobile-subject">{capture.subjectName}</strong>
                      ) : (
                        <span className="mobile-subject" />
                      )}
                      <span className="muted small">{when(capture.capturedAt)}</span>
                    </div>

                    <p className="mobile-text">{capture.rawText}</p>

                    <div className="mobile-note-foot">
                      <span className="muted small mobile-suggestion">{suggestion.reason}</span>
                      <button
                        type="button"
                        className="ghost small"
                        aria-label={`File ${label(capture)} where suggested`}
                        disabled={suggestion.decision === null}
                        onClick={() => onAcceptSuggestion(capture)}
                      >
                        File it there
                      </button>
                      <button
                        type="button"
                        className="ghost small"
                        aria-label={`Discard ${label(capture)}`}
                        title="Keeps the note and its text; it just stops waiting here."
                        onClick={() => onReject(capture)}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** What a note is called in an aria-label, which has to be readable aloud. */
const label = (capture: CaptureItem): string =>
  capture.subjectName?.trim() || captureTitle(capture);

/** The day it was caught. The hour is rarely the question. */
const when = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** The five names, for anywhere that lists them. */
export { CAPTURE_CATEGORY_NAMES };
