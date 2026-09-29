import {
  CAPTURE_CATEGORY_NAMES,
  captureTitle,
  groupOffer,
  inboxGroups,
  suggestRouting,
  type CaptureItem,
  type InboxSubgroup,
  type ProjectFile,
  type ProjectFormat,
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
  /**
   * File a whole spoken group at once (addendum 09 §12).
   *
   * **This is the one place the taxonomy grows**, and it grows here rather than
   * on the phone: saying the word made nothing, and a folder is created by
   * somebody pressing a button while looking at what is about to go in it.
   */
  onFileGroup(category: string | null, group: string): void;
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
  onFileGroup,
}: MobileInboxProps) {
  // The project's own words for the structural two (addendum 09 §10): the
  // desktop has always known the format and had never passed it, so a scene
  // note was headed *Scene or chapter* on a screenplay that has scenes.
  const groups = inboxGroups(captures, file.project.format as ProjectFormat);

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
        groups.map((group) => {
          const notes = (list: CaptureItem[]) => (
            <ul className="mobile-list">
              {list.map((capture) => (
                <Note
                  key={capture.id}
                  file={file}
                  capture={capture}
                  lifted={draggingId === (capture.id as string)}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onAcceptSuggestion={onAcceptSuggestion}
                  onReject={onReject}
                />
              ))}
            </ul>
          );

          return (
            <section key={group.category ?? 'none'} className="review-group">
              <h4>
                {group.name}
                <span className="count muted">{group.captures.length}</span>
              </h4>

              {/* Divided by what the writer said on the walk, where they said
                  anything — `under` is empty otherwise, so a category nobody
                  grouped reads exactly as it did before §12. */}
              {group.under.length > 0
                ? group.under.map((sub) => (
                    <div key={sub.group ?? 'ungrouped'} className="mobile-subgroup">
                      <GroupHead
                        file={file}
                        captures={captures}
                        category={group.category}
                        sub={sub}
                        onFileGroup={onFileGroup}
                      />
                      {notes(sub.captures)}
                    </div>
                  ))
                : notes(group.captures)}
            </section>
          );
        })
      )}
    </div>
  );
}

/**
 * One spoken group's heading, and the press that files the lot (§12).
 *
 * The sentence is `groupOffer`'s and never this component's — it says whether
 * the folder is already there, how many notes would go, and the reason there is
 * no button where there cannot be one, which is `trackRemoval`'s shape.
 * **Absent rather than greyed** for the notes nobody grouped: there is no
 * folder to make out of *no group*.
 */
function GroupHead({
  file,
  captures,
  category,
  sub,
  onFileGroup,
}: {
  file: ProjectFile;
  captures: CaptureItem[];
  category: string | null;
  sub: InboxSubgroup;
  onFileGroup(category: string | null, group: string): void;
}) {
  if (!sub.group) {
    return (
      <div className="mobile-subgroup-head">
        <h5 className="muted">{sub.name}</h5>
        <span className="count muted">{sub.captures.length}</span>
      </div>
    );
  }
  const offer = groupOffer(file, captures, category, sub.group);
  return (
    <div className="mobile-subgroup-head">
      <h5>{sub.name}</h5>
      <span className="count muted">{sub.captures.length}</span>
      {offer.parentId && offer.count > 0 ? (
        <button
          type="button"
          className="ghost small"
          title={offer.why}
          onClick={() => onFileGroup(category, sub.group as string)}
        >
          {offer.existingId ? `File all ${offer.count}` : `Make ${sub.name} and file all ${offer.count}`}
        </button>
      ) : (
        <span className="muted small">{offer.why}</span>
      )}
    </div>
  );
}

/** One waiting note, wherever it is drawn. */
function Note({
  file,
  capture,
  lifted,
  onDragStart,
  onDragEnd,
  onAcceptSuggestion,
  onReject,
}: {
  file: ProjectFile;
  capture: CaptureItem;
  lifted: boolean;
  onDragStart(capture: CaptureItem): void;
  onDragEnd(): void;
  onAcceptSuggestion(capture: CaptureItem): void;
  onReject(capture: CaptureItem): void;
}) {
  const suggestion = suggestRouting(file, capture);
  return (
    <li
      className={lifted ? 'mobile-note lifted' : 'mobile-note'}
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
        {/* The name they spoke, when they spoke one — it is what the note is
            about. When they did not, there is no heading at all:
            `captureTitle` falls back to the first line, which would print the
            note twice. */}
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
