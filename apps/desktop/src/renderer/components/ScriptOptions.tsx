import { useEffect, useRef } from 'react';
import type { ScriptDisplay, ScriptLayout } from './StoryView';

/**
 * How the page itself looks (addendum 02 §6.2).
 *
 * Paper and ink are the writer's, not the program's. Some people write on
 * white, some on the cream a paperback is printed on, some on black at two
 * in the morning; the face and its size are the same kind of choice. None of
 * it is project data — a colleague opening the file should not inherit
 * somebody's dark mode — so it lives with the other per-machine preferences.
 *
 * The one thing that is *not* free here is the geometry. The column is sixty
 * characters of a monospaced face because that is what makes a page a page,
 * so the faces on offer are the ones a manuscript is actually set in, and
 * the size is a page zoom rather than a font size.
 */
export interface PageStyle {
  paper: string;
  ink: string;
  face: string;
  /** Off: the page takes the workspace's own colours instead. */
  on: boolean;
}

export const PAPER_FACES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "'Courier New', Courier, ui-monospace, monospace", label: 'Courier' },
  { value: "'Courier Prime', 'Courier New', Courier, monospace", label: 'Courier Prime' },
  { value: "'Consolas', 'Menlo', ui-monospace, monospace", label: 'Consolas' },
  { value: "'Georgia', 'Times New Roman', serif", label: 'Georgia' },
  { value: "'Times New Roman', Times, serif", label: 'Times' },
  { value: "'Iowan Old Style', 'Palatino Linotype', Palatino, serif", label: 'Palatino' },
];

export const PAPERS: ReadonlyArray<{ paper: string; ink: string; label: string }> = [
  { paper: '#ffffff', ink: '#000000', label: 'White' },
  { paper: '#f6f1e4', ink: '#111111', label: 'Cream' },
  { paper: '#eaeff2', ink: '#0d1b23', label: 'Cool grey' },
  { paper: '#1b1b1e', ink: '#e8e4d9', label: 'Night' },
];

export const DEFAULT_PAGE_STYLE: PageStyle = {
  on: true,
  paper: '#ffffff',
  ink: '#000000',
  face: PAPER_FACES[0]!.value,
};

interface ScriptOptionsProps {
  open: boolean;
  onClose(): void;
  style: PageStyle;
  onStyle(next: PageStyle): void;
  display: ScriptDisplay;
  onDisplay(next: ScriptDisplay): void;
  scriptLayout: ScriptLayout;
  onScriptLayout(next: ScriptLayout): void;
  /** A novel has no sluglines, so it is not offered the switch for them. */
  prose: boolean;
}

/**
 * The gear on the Script: everything about how the page looks, in one place
 * rather than strung across the bar above it.
 */
export function ScriptOptions({
  open,
  onClose,
  style,
  onStyle,
  display,
  onDisplay,
  scriptLayout,
  onScriptLayout,
  prose,
}: ScriptOptionsProps) {
  const panel = useRef<HTMLDivElement>(null);

  // Clicking anywhere else puts it away, which is what a popover should do.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // Deferred: the click that opened it must not be the one that shuts it.
    const timer = window.setTimeout(() => document.addEventListener('mousedown', away), 0);
    document.addEventListener('keydown', escape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open, onClose]);

  if (!open) return null;
  const noun = prose ? 'Chapter' : 'Scene';
  const toggle = (key: keyof ScriptDisplay) => onDisplay({ ...display, [key]: !display[key] });

  return (
    // Named apart from the gear that opens it, so "Page options" means the
    // control and nothing else.
    <div className="script-options-panel" ref={panel} role="dialog" aria-label="How the page looks">
      <h4>The page</h4>
      <div className="paper-swatches" role="group" aria-label="Paper">
        {PAPERS.map((choice) => (
          <button
            key={choice.label}
            type="button"
            className={style.on && style.paper === choice.paper ? 'paper-swatch on' : 'paper-swatch'}
            aria-label={choice.label}
            aria-pressed={style.on && style.paper === choice.paper}
            title={choice.label}
            style={{ background: choice.paper, color: choice.ink }}
            onClick={() => onStyle({ ...style, on: true, paper: choice.paper, ink: choice.ink })}
          >
            Aa
          </button>
        ))}
      </div>

      <div className="option-row">
        <label className="field">
          Paper
          <input
            type="color"
            aria-label="Paper colour"
            value={style.paper}
            onChange={(event) => onStyle({ ...style, on: true, paper: event.target.value })}
          />
        </label>
        <label className="field">
          Ink
          <input
            type="color"
            aria-label="Text colour"
            value={style.ink}
            onChange={(event) => onStyle({ ...style, on: true, ink: event.target.value })}
          />
        </label>
      </div>

      <label className="field">
        Typeface
        <select
          aria-label="Typeface"
          value={style.face}
          onChange={(event) => onStyle({ ...style, face: event.target.value })}
        >
          {PAPER_FACES.map((face) => (
            <option key={face.label} value={face.value}>
              {face.label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        The column stays sixty characters wide whatever the face: that is what makes a page a page. Use the size control
        beside the layout to make it bigger.
      </p>

      <h4>Layout</h4>
      <label className="field">
        The page is
        <select
          aria-label="Script layout"
          value={scriptLayout}
          onChange={(event) => onScriptLayout(event.target.value as ScriptLayout)}
        >
          <option value="flow">One continuous column</option>
          <option value="pages">Sheets of paper</option>
        </select>
      </label>

      <h4>What shows</h4>
      <div className="option-checks">
        {prose ? null : <Check label="Scene headings" on={display.headings} onClick={() => toggle('headings')} />}
        <Check label={`${noun} names`} on={display.sceneNames} onClick={() => toggle('sceneNames')} />
        <Check label="Beat names" on={display.beatNames} onClick={() => toggle('beatNames')} />
        <Check label={prose ? 'Chapter breaks' : 'Acts'} on={display.acts} onClick={() => toggle('acts')} />
        {scriptLayout === 'flow' ? (
          <Check label="Page breaks" on={display.pages} onClick={() => toggle('pages')} />
        ) : null}
      </div>
    </div>
  );
}

function Check({ label, on, onClick }: { label: string; on: boolean; onClick(): void }) {
  return (
    <label className="check">
      <input type="checkbox" aria-label={label} checked={on} onChange={onClick} />
      <span>{label}</span>
    </label>
  );
}
