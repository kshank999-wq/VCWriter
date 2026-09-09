import { useEffect, useRef } from 'react';
import { SCHEMES, type SchemeId } from '../themes';

interface PreferencesProps {
  open: boolean;
  onClose(): void;
  scheme: SchemeId;
  onScheme(id: SchemeId): void;
  paper: boolean;
  onPaper(on: boolean): void;
  beatsPerColumn: number;
  onBeatsPerColumn(count: number): void;
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
  beatsPerColumn,
  onBeatsPerColumn,
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

      <section>
        <h3>Lanes</h3>
        <label className="field">
          <span>Beats before a new column</span>
          <input
            type="number"
            min={1}
            max={20}
            value={beatsPerColumn}
            aria-label="Beats before a new column"
            onChange={(event) => {
              const count = Number(event.target.value);
              if (Number.isFinite(count)) onBeatsPerColumn(Math.min(20, Math.max(1, Math.round(count))));
            }}
          />
        </label>
        <p className="muted small">
          Beats stack down a scene until this many, then the next one starts a column beside them and the scene grows
          wider. A scene of twelve beats reads as three short columns rather than one you cannot see the end of.
        </p>
      </section>

      <footer className="muted">Preferences are kept on this computer, not in the project.</footer>
    </dialog>
  );
}
