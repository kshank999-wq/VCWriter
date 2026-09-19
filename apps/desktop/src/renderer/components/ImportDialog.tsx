import { useMemo, useRef, useState } from 'react';
import {
  buildProjectFromImport,
  docxToImport,
  isProseFormat,
  readDocx,
  readFinalDraft,
  readLaidOutLines,
  type DocxDocument,
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
 * Three readers behind it. A Final Draft document says what every line is, so
 * nothing is guessed. A PDF says only where each line sits — which in a
 * screenplay is very nearly as good, because the format is the indentation —
 * and anything it had to work out from shape is counted and said. A Word
 * document (addendum 21) is read by its headings for a book and by its
 * indents for a script, so what it is read *as* follows the format chosen
 * here — the document is kept and read again when the format changes.
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
  /** Read once, as a script. */
  | { kind: 'read'; name: string; script: ImportedScript }
  /** A Word document: read for whichever format is chosen. */
  | { kind: 'word'; name: string; doc: DocxDocument; title: string }
  | { kind: 'failed'; message: string };

const FORMATS: ReadonlyArray<{ value: ProjectFormat; label: string }> = [
  { value: 'screenplay', label: 'Screenplay' },
  { value: 'series', label: 'Series or episodic' },
  { value: 'stage_play', label: 'Stage play' },
  { value: 'short_form', label: 'Short form' },
];

/** Only a Word document can come in as a book: a PDF's lines say where, not what. */
const PROSE_FORMATS: ReadonlyArray<{ value: ProjectFormat; label: string }> = [
  { value: 'novel', label: 'Novel' },
  { value: 'short_story', label: 'Short story' },
  { value: 'instructional', label: 'Instructional or textbook' },
];

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const dialog = useModal(open);
  const picker = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'waiting' });
  const [format, setFormat] = useState<ProjectFormat>('screenplay');
  const [fileCast, setFileCast] = useState(true);
  const [keepLocations, setKeepLocations] = useState(true);

  // What was read, as the format it is going into.
  const script = useMemo<ImportedScript | null>(() => {
    if (stage.kind === 'read') return stage.script;
    if (stage.kind === 'word') return docxToImport(stage.doc, format, { title: stage.title });
    return null;
  }, [stage, format]);
  const formats = stage.kind === 'word' ? [...FORMATS, ...PROSE_FORMATS] : FORMATS;

  const read = async (chosen: File) => {
    setStage({ kind: 'reading', name: chosen.name });
    try {
      if (/\.fdx$/i.test(chosen.name)) {
        if (isProseFormat(format)) setFormat('screenplay');
        setStage({ kind: 'read', name: chosen.name, script: readFinalDraft(await chosen.text()) });
        return;
      }
      if (/\.docx$/i.test(chosen.name)) {
        // Unzipped by the host, read by the domain (addendum 21 §2).
        const { readDocxParts } = await import('../read-docx');
        const doc = readDocx(await readDocxParts(await chosen.arrayBuffer()));
        setStage({ kind: 'word', name: chosen.name, doc, title: chosen.name.replace(/\.docx$/i, '') });
        return;
      }
      if (/\.pdf$/i.test(chosen.name)) {
        if (isProseFormat(format)) setFormat('screenplay');
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
        message: 'That is not a Final Draft document, a Word document or a PDF. Those are the three this reads.',
      });
    } catch (error) {
      setStage({ kind: 'failed', message: error instanceof Error ? error.message : 'That file could not be read.' });
    }
  };

  const finish = () => {
    if (!script) return;
    const built = buildProjectFromImport(script, { format, fileCast, keepLocations });
    onImported(built.file);
    setStage({ kind: 'waiting' });
    onClose();
  };

  const close = () => {
    setStage({ kind: 'waiting' });
    onClose();
  };

  return (
    <dialog ref={dialog} className="track-dialog import-dialog" aria-label="Import a script" onClose={close}>
      {open ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">Import a script</span>
            <button type="button" className="ghost" aria-label="Close" onClick={close}>
              ×
            </button>
          </header>

          <div className="page-setup-body">
            <input
              ref={picker}
              type="file"
              accept=".fdx,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-label="Script file"
              className="import-picker"
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                if (chosen) void read(chosen);
              }}
            />

            {stage.kind === 'waiting' ? (
              <p className="muted">
                A Final Draft document (<code>.fdx</code>), a Word document (<code>.docx</code>) or a PDF. Final Draft
                says what every line is, so nothing is guessed. A Word document keeps its formatting — the face and
                size each paragraph was set in — and is read by its headings for a book and by its indents for a
                script. A PDF is read from where each line sits on the page — which is what a screenplay&rsquo;s
                format actually is — and anything worked out that way is marked.
              </p>
            ) : null}

            {stage.kind === 'reading' ? <p className="muted">Reading {stage.name}…</p> : null}

            {stage.kind === 'failed' ? (
              <p className="error" role="alert">
                {stage.message}
              </p>
            ) : null}

            {script ? <Found script={script} prose={isProseFormat(format)} /> : null}

            {script ? (
              <>
                <h4>What to make of it</h4>
                <label className="field">
                  Format
                  <select
                    aria-label="Format"
                    value={format}
                    onChange={(event) => setFormat(event.target.value as ProjectFormat)}
                  >
                    {formats.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {/* A book has no cast list to file and no sluglines to write
                    up, so the two choices are absent rather than greyed. */}
                {isProseFormat(format) ? null : (
                  <>
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
                )}
              </>
            ) : null}
          </div>

          <footer className="page-setup-actions">
            <button type="button" className="ghost" onClick={close}>
              Cancel
            </button>
            <button type="button" className="ghost" onClick={() => picker.current?.click()}>
              {script ? 'Choose another…' : 'Choose a file…'}
            </button>
            <button type="button" className="primary" disabled={!script} onClick={finish}>
              Import
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}

/** What the reader found, before anything is made from it. */
function Found({ script, prose }: { script: ImportedScript; prose: boolean }) {
  const scenes = script.scenes.filter((scene: ImportedScene) => scene.heading.trim().length > 0).length;
  const speeches = script.characters.reduce(
    (total: number, person: ImportedCharacter) => total + person.speeches,
    0,
  );

  const elements = script.scenes.flatMap((scene: ImportedScene) => scene.elements);
  const count = (type: string) => elements.filter((element) => element.type === type).length;

  return (
    <div className="import-found">
      <div className="report-figures">
        {/* A script's divisions are scenes whatever format it is going into;
            a Word document read as a book divides at its chapter headings, and
            what is counted under them is what a book is made of. */}
        <Figure label={prose ? 'Chapters' : 'Scenes'} value={String(scenes)} />
        {prose ? (
          <>
            <Figure label="Paragraphs" value={String(count('paragraph') + count('blockquote'))} />
            <Figure label="Headings" value={String(count('heading'))} />
            <Figure label="Pictures" value={String(count('figure'))} />
          </>
        ) : (
          <>
            <Figure label="Characters" value={String(script.characters.length)} />
            <Figure label="Locations" value={String(script.locations.length)} />
            <Figure label="Speeches" value={String(speeches)} />
          </>
        )}
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
                  {/* Somebody the action names and never gives a line to is in
                      the cast on purpose (§18); "0 speeches" reads like the
                      reader failed to find their lines. */}
                  {person.speeches === 0
                    ? 'named in the action'
                    : `${person.speeches} ${person.speeches === 1 ? 'speech' : 'speeches'}`}{' '}
                  · {person.scenes} {person.scenes === 1 ? 'scene' : 'scenes'}
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
