import { useRef, useState } from 'react';
import {
  buildProjectFromImport,
  readFinalDraft,
  readLaidOutLines,
  type ImportedCharacter,
  type ImportedLocation,
  type ImportedScene,
  type ImportedScript,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

/**
 * Importing somebody else's script (addendum 02 §18).
 *
 * The dialog reads the file, then **shows what it found before it makes
 * anything**: how many scenes, who is in it and how much each of them
 * speaks, where it happens, and whatever the reader was unsure of. An
 * importer that goes straight to a finished project asks the writer to
 * audit a hundred pages to find out whether it worked.
 *
 * Two readers behind it. A Final Draft document says what every line is, so
 * nothing is guessed. A PDF says only where each line sits — which in a
 * screenplay is very nearly as good, because the format is the indentation —
 * and anything it had to work out from shape is counted and said.
 */

interface ImportDialogProps {
  open: boolean;
  onClose(): void;
  /** Adopt the built project. It arrives unsaved: the writer says where. */
  onImported(file: ProjectFile): void;
}

type Stage =
  | { kind: 'waiting' }
  | { kind: 'reading'; name: string }
  | { kind: 'read'; name: string; script: ImportedScript }
  | { kind: 'failed'; message: string };

const FORMATS: ReadonlyArray<{ value: ProjectFormat; label: string }> = [
  { value: 'screenplay', label: 'Screenplay' },
  { value: 'series', label: 'Series or episodic' },
  { value: 'stage_play', label: 'Stage play' },
  { value: 'short_form', label: 'Short form' },
];

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const dialog = useModal(open);
  const picker = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'waiting' });
  const [format, setFormat] = useState<ProjectFormat>('screenplay');
  const [fileCast, setFileCast] = useState(true);
  const [keepLocations, setKeepLocations] = useState(true);

  const read = async (chosen: File) => {
    setStage({ kind: 'reading', name: chosen.name });
    try {
      if (/\.fdx$/i.test(chosen.name)) {
        setStage({ kind: 'read', name: chosen.name, script: readFinalDraft(await chosen.text()) });
        return;
      }
      if (/\.pdf$/i.test(chosen.name)) {
        // Loaded only when a PDF is actually chosen.
        const { readPdfLines } = await import('../read-pdf');
        const { lines, title } = await readPdfLines(await chosen.arrayBuffer());
        setStage({
          kind: 'read',
          name: chosen.name,
          script: readLaidOutLines(lines, { title: title || chosen.name.replace(/\.pdf$/i, '') }),
        });
        return;
      }
      setStage({
        kind: 'failed',
        message: 'That is neither a Final Draft document nor a PDF. Those are the two this reads.',
      });
    } catch (error) {
      setStage({ kind: 'failed', message: error instanceof Error ? error.message : 'That file could not be read.' });
    }
  };

  const finish = () => {
    if (stage.kind !== 'read') return;
    const built = buildProjectFromImport(stage.script, { format, fileCast, keepLocations });
    onImported(built.file);
    setStage({ kind: 'waiting' });
    onClose();
  };

  const close = () => {
    setStage({ kind: 'waiting' });
    onClose();
  };

  return (
    <dialog ref={dialog} className="lane-dialog import-dialog" aria-label="Import a script" onClose={close}>
      {open ? (
        <>
          <header className="lane-dialog-title">
            <span className="bar-title">Import a script</span>
            <button type="button" className="ghost" aria-label="Close" onClick={close}>
              ×
            </button>
          </header>

          <div className="page-setup-body">
            <input
              ref={picker}
              type="file"
              accept=".fdx,.pdf,application/pdf"
              aria-label="Script file"
              className="import-picker"
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                if (chosen) void read(chosen);
              }}
            />

            {stage.kind === 'waiting' ? (
              <p className="muted">
                A Final Draft document (<code>.fdx</code>) or a PDF. Final Draft says what every line is, so nothing is
                guessed. A PDF is read from where each line sits on the page — which is what a screenplay&rsquo;s
                format actually is — and anything worked out that way is marked.
              </p>
            ) : null}

            {stage.kind === 'reading' ? <p className="muted">Reading {stage.name}…</p> : null}

            {stage.kind === 'failed' ? (
              <p className="error" role="alert">
                {stage.message}
              </p>
            ) : null}

            {stage.kind === 'read' ? <Found script={stage.script} /> : null}

            {stage.kind === 'read' ? (
              <>
                <h4>What to make of it</h4>
                <label className="field">
                  Format
                  <select
                    aria-label="Format"
                    value={format}
                    onChange={(event) => setFormat(event.target.value as ProjectFormat)}
                  >
                    {FORMATS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    aria-label="File the cast"
                    checked={fileCast}
                    onChange={(event) => setFileCast(event.target.checked)}
                  />
                  <span>File the cast under main, recurring and minor by how much they speak</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    aria-label="Keep the locations"
                    checked={keepLocations}
                    onChange={(event) => setKeepLocations(event.target.checked)}
                  />
                  <span>Write each location up under Research → Locations</span>
                </label>
              </>
            ) : null}
          </div>

          <footer className="page-setup-actions">
            <button type="button" className="ghost" onClick={close}>
              Cancel
            </button>
            <button type="button" className="ghost" onClick={() => picker.current?.click()}>
              {stage.kind === 'read' ? 'Choose another…' : 'Choose a file…'}
            </button>
            <button type="button" className="primary" disabled={stage.kind !== 'read'} onClick={finish}>
              Import
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}

/** What the reader found, before anything is made from it. */
function Found({ script }: { script: ImportedScript }) {
  const scenes = script.scenes.filter((scene: ImportedScene) => scene.heading.trim().length > 0).length;
  const speeches = script.characters.reduce(
    (total: number, person: ImportedCharacter) => total + person.speeches,
    0,
  );

  return (
    <div className="import-found">
      <div className="report-figures">
        <Figure label="Scenes" value={String(scenes)} />
        <Figure label="Characters" value={String(script.characters.length)} />
        <Figure label="Locations" value={String(script.locations.length)} />
        <Figure label="Speeches" value={String(speeches)} />
      </div>

      {script.title ? (
        <p className="muted small">
          {script.title}
          {script.author ? ` — ${script.author}` : ''}
        </p>
      ) : null}

      {script.characters.length > 0 ? (
        <>
          <h4>Who is in it</h4>
          <ul className="import-list">
            {script.characters.slice(0, 12).map((person: ImportedCharacter) => (
              <li key={person.name}>
                <span>{person.name}</span>
                <span className="muted">
                  {person.speeches} {person.speeches === 1 ? 'speech' : 'speeches'} · {person.scenes}{' '}
                  {person.scenes === 1 ? 'scene' : 'scenes'}
                </span>
              </li>
            ))}
            {script.characters.length > 12 ? (
              <li className="muted">and {script.characters.length - 12} more</li>
            ) : null}
          </ul>
        </>
      ) : null}

      {script.locations.length > 0 ? (
        <>
          <h4>Where it happens</h4>
          <ul className="import-list">
            {script.locations.slice(0, 8).map((place: ImportedLocation) => (
              <li key={place.name}>
                <span>{place.name}</span>
                <span className="muted">
                  {place.scenes} {place.scenes === 1 ? 'scene' : 'scenes'}
                  {place.where === 'unknown' ? '' : ` · ${place.where}`}
                </span>
              </li>
            ))}
            {script.locations.length > 8 ? <li className="muted">and {script.locations.length - 8} more</li> : null}
          </ul>
        </>
      ) : null}

      {script.warnings.length > 0 ? (
        <>
          <h4>Worth a look</h4>
          <ul className="import-warnings">
            {script.warnings.map((warning: string) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-figure">
      <span className="report-figure-value">{value}</span>
      <span className="report-figure-label">{label}</span>
    </div>
  );
}
