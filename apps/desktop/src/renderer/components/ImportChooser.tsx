import { importChoices, projectUntouched, type ImportKind, type ProjectFile } from '@vcwriter/domain';
import { useModal } from '../use-modal';

/**
 * What are you importing? (addendum 33, from Ken.)
 *
 * **The question comes before the file.** File ▸ Import a script… opened a
 * dialog titled for a screenplay with a format select two thirds of the way
 * down it, and File ▸ Add stories to the collection… was a second item
 * answering a second question — so a writer bringing in a novel met a screen
 * about scripts, and the control that decided what would actually be made was
 * the one nobody reads. One item on the menu now, and this is what it opens.
 *
 * **Two headings, because the rows cannot carry the fact.** The one thing a
 * writer wants to know before pressing anything here is whether this is going
 * to replace what they are looking at, and saying it on all eight rows is
 * saying it eight times. It is addendum 20 §9k's argument — *what a label
 * says is the one thing no row can* — and the headings are the writer's own
 * two questions: a project arriving, or something going into this one.
 *
 * It decides nothing itself: `importChoices` says what to offer, each row is
 * a kind, and the workspace routes it. A kind added to that list is a row
 * here the day it is written.
 */

interface ImportChooserProps {
  open: boolean;
  /**
   * The project that is open, or null on the welcome screen. It is the file
   * rather than the format (§10a) because the one sentence this screen owes a
   * writer with an empty project in front of them needs its **name** and
   * whether anything is in it, and two props that have to agree about one
   * project would be two answers to what is open.
   */
  file: ProjectFile | null;
  onClose(): void;
  onChoose(kind: ImportKind): void;
}

export function ImportChooser({ open, file, onClose, onChoose }: ImportChooserProps) {
  const dialog = useModal(open);
  const format = file?.project.format ?? null;
  const choices = importChoices(format);
  const making = choices.filter((choice) => choice.landing === 'project');
  const into = choices.filter((choice) => choice.landing === 'here');

  const row = (choice: (typeof choices)[number]) => (
    <li key={choice.kind}>
      <button
        type="button"
        className="import-choice"
        onClick={() => {
          onChoose(choice.kind);
          onClose();
        }}
      >
        <span className="import-choice-label">{choice.label}</span>
        {/* What it does, under the label rather than in a hover nobody sees
            (addendum 02 §6b's note on a menu item). */}
        <span className="import-choice-note">{choice.note}</span>
      </button>
    </li>
  );

  return (
    <dialog ref={dialog} className="track-dialog import-chooser" aria-label="Import" onClose={onClose}>
      {open ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">Import</span>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="page-setup-body">
            <h4>A new project</h4>
            {/* **What becomes of the one that is open** (addendum 33 §10,
                from Ken: *instead of adding it at the end it erased
                everything I did and all my work is gone*). It used to be
                written into the open project's own file. It is a project now
                — its own file, and the one in front of the writer saved and
                left where it is — and the heading could not say that on its
                own, so it is said once under it rather than on four rows. */}
            {format !== null ? (
              <p className="muted small">
                The project you have open is saved and stays as it is. This one opens in a file of its own.
              </p>
            ) : null}
            {/*
              **And where the one you have is empty, the row below fills it**
              (§10a, from Ken: *I named the project Dylan's Tales, but in the
              save it's calling it the name of the first script*).

              He had just made a collection and named it, and these rows are
              named for **what is being imported** while the row that would
              have filled it is named for **the act** — so the obvious press
              made a second project and left his named one behind, empty. The
              act is right and the sentence was missing: said before the press,
              naming the project in his own words, and pointing at the row
              rather than being a second one. It is a **route and only where
              the route exists**, so nothing is said where there is no row
              under *Into this project* to point at (addendum 10 §8).
            */}
            {file && into.length > 0 && projectUntouched(file) ? (
              <p className="muted small">
                “{file.project.title}” has nothing in it yet. This makes a second project beside it — the rows under{' '}
                <em>Into this project</em> fill the one you have.
              </p>
            ) : null}
            <ul className="import-choices">{making.map(row)}</ul>

            {into.length > 0 ? (
              <>
                <h4>Into this project</h4>
                <ul className="import-choices">{into.map(row)}</ul>
              </>
            ) : (
              // Absent rather than greyed, and said: a writer who came here
              // for their notes should be told where the door is rather than
              // left looking for a row that is not drawn.
              <p className="muted small">
                Notes, pictures and more stories go into a project that is open. Open or start one first.
              </p>
            )}
          </div>

          <footer className="page-setup-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}
