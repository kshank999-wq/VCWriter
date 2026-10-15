import { useEffect, useRef } from 'react';
import { isProseFormat, nounsFor, type ProjectFormat } from '@vcwriter/domain';
import { SCHEMES, type SchemeId } from '../themes';

interface PreferencesProps {
  open: boolean;
  onClose(): void;
  scheme: SchemeId;
  onScheme(id: SchemeId): void;
  paper: boolean;
  onPaper(on: boolean): void;
  /**
   * The open project's format, where one is open (addendum 37).
   *
   * Only so this screen can say **where** a script's house style is set. It
   * is not one of these: a format is a fact about the document that travels
   * in the project, and two people opening one play must not print two
   * different page counts — which is what this dialog's own footer says.
   */
  format?: ProjectFormat | null;
}

/**
 * Per-machine preferences (addendum 02 §12). Appearance only for now: the
 * colour scheme and whether the Script is drawn as paper. These are not
 * project settings — a collaborator opening the file should not inherit
 * anyone's colours — so they live in the renderer's storage.
 */
export function Preferences({
  open,
  onClose,
  scheme,
  onScheme,
  paper,
  onPaper,
  format = null,
}: PreferencesProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      if (typeof node.showModal === 'function') node.showModal();
      else node.setAttribute('open', '');
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog ref={dialog} className="preferences" aria-label="Preferences" onClose={onClose}>
      <header>
        <h2>Preferences</h2>
        <button type="button" className="ghost" onClick={onClose} aria-label="Close preferences">
          ×
        </button>
      </header>

      <section>
        <h3>Colour scheme</h3>
        <div className="scheme-grid" role="radiogroup" aria-label="Colour scheme">
          {SCHEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === scheme}
              className={option.id === scheme ? 'scheme selected' : 'scheme'}
              onClick={() => onScheme(option.id)}
            >
              <span
                className="scheme-swatch"
                aria-hidden="true"
                style={{ background: option.tokens.ink, borderColor: option.tokens.border }}
              >
                <span style={{ background: option.tokens.panel }} />
                <span style={{ background: option.tokens.gold }} />
                <span style={{ background: option.tokens.text }} />
              </span>
              <span className="scheme-name">{option.name}</span>
              <span className="scheme-description">{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>The page</h3>
        <label className="toggle">
          <input type="checkbox" checked={paper} onChange={(event) => onPaper(event.target.checked)} />
          Draw the pages on white paper with black text, whatever the scheme
        </label>
      </section>

      {/* **The Tracks section is gone** (addendum 02 §4e). It set *Cards
          before a new column*, and beats no longer wrap into a second column
          at all — so it was a control storing a number the board never read,
          which is the fault `columns` on a part's style was taken out for
          (addendum 20 §17). How tall a lane is drawn is a **zoom**, and it
          belongs on the board beside the one that says how wide, not in a
          dialog on another screen. */}
      {/* **A route, and only where the route exists** (addendum 10 §8).
          Ken looked for the stage play's formatting here (addendum 37), which
          is the right instinct and the wrong record: this dialog's own footer
          says why. So it says where instead — on a script alone, a prose
          project having no house style to set. */}
      {format && !isProseFormat(format) ? (
        <section>
          <h3>Script format</h3>
          <p className="field-note">
            How this {nounsFor(format).work.toLowerCase()} is set on the page — the cue, the speech and the
            stage directions — is the project’s rather than this computer’s, so it is in{' '}
            <strong>File ▸ Page setup</strong> under <em>Script format</em>.
          </p>
        </section>
      ) : null}

      <footer className="muted">Preferences are kept on this computer, not in the project.</footer>
    </dialog>
  );
}
