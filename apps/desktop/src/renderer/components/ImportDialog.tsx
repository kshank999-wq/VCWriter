import { useMemo, useRef, useState } from 'react';
import {
  appendImportedEpisode,
  appendImportedStory,
  buildProjectFromImport,
  docxToImport,
  ensureFirstEpisode,
  isCollection,
  isProseFormat,
  nounsFor,
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
import { bareName, countOf, shifted } from '../read-import';

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
 *
 * **Several files at once** (addendum 22 §4a): a series or a collection is
 * made of parts that arrive as separate documents, so on those two formats
 * the first file makes the project and each file after it is appended as
 * the next episode or story, on a page of its own, in the order listed —
 * which is the order chosen, or the order the arrows put them in. On any
 * other format a project is one document, and the rest are said to be left
 * out rather than silently dropped.
 */

interface ImportDialogProps {
  open: boolean;
  onClose(): void;
  /** Adopt the built project. It arrives unsaved: the writer says where. */
  onImported(file: ProjectFile): void;
}

/** A file as read: once, as a script; or a Word document, read for whichever format is chosen. */
type Source = { kind: 'script'; script: ImportedScript } | { kind: 'word'; doc: DocxDocument; title: string };

interface Part {
  name: string;
  source: Source;
}

type Stage =
  | { kind: 'waiting' }
  | { kind: 'reading'; count: number }
  | { kind: 'read'; parts: Part[]; failed: string[] }
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
  { value: 'short_story', label: 'Short stories and collections' },
  { value: 'instructional', label: 'Instructional or textbook' },
];

/** What a part reads as, for the format it is going into. */
const scriptOf = (part: Part, format: ProjectFormat): ImportedScript =>
  part.source.kind === 'script' ? part.source.script : docxToImport(part.source.doc, format, { title: part.source.title });

const readPart = async (chosen: File): Promise<Part> => {
  if (/\.fdx$/i.test(chosen.name)) {
    return { name: chosen.name, source: { kind: 'script', script: readFinalDraft(await chosen.text()) } };
  }
  if (/\.docx$/i.test(chosen.name)) {
    // Unzipped by the host, read by the domain (addendum 21 §2).
    const { readDocxParts } = await import('../read-docx');
    const doc = readDocx(await readDocxParts(await chosen.arrayBuffer()));
    return { name: chosen.name, source: { kind: 'word', doc, title: bareName(chosen.name) } };
  }
  if (/\.pdf$/i.test(chosen.name)) {
    // Loaded only when a PDF is actually chosen.
    const { readPdfLines } = await import('../read-pdf');
    const { lines, title } = await readPdfLines(await chosen.arrayBuffer());
    return { name: chosen.name, source: { kind: 'script', script: readLaidOutLines(lines, { title: title || bareName(chosen.name) }) } };
  }
  throw new Error('That is not a Final Draft document, a Word document or a PDF. Those are the three this reads.');
};

/** A format that is made of parts, each of which may arrive as its own file. */
const takesSeveral = (format: ProjectFormat): boolean => format === 'series' || isCollection(format);

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const dialog = useModal(open);
  const picker = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'waiting' });
  const [format, setFormat] = useState<ProjectFormat>('screenplay');
  const [fileCast, setFileCast] = useState(true);
  const [keepLocations, setKeepLocations] = useState(true);
  // One story or many (addendum 22 §2): only the short-story format asks.
  const [stories, setStories] = useState<'one' | 'many'>('one');

  const parts = stage.kind === 'read' ? stage.parts : [];
  // What was read, as the format it is going into: the first file, which
  // is the one the project is made from.
  const script = useMemo<ImportedScript | null>(() => (parts[0] ? scriptOf(parts[0], format) : null), [parts, format]);
  // A book is offered only when every file is a Word document.
  const allWord = parts.length > 0 && parts.every((part) => part.source.kind === 'word');
  const formats = allWord ? [...FORMATS, ...PROSE_FORMATS] : FORMATS;

  const read = async (chosen: FileList) => {
    const files = Array.from(chosen);
    setStage({ kind: 'reading', count: files.length });
    const read: Part[] = [];
    const failed: string[] = [];
    for (const one of files) {
      try {
        read.push(await readPart(one));
      } catch (error) {
        const message = error instanceof Error ? error.message : `${one.name} could not be read.`;
        failed.push(files.length === 1 ? message : `${one.name}: ${message}`);
      }
    }
    if (read.length === 0) {
      setStage({ kind: 'failed', message: failed[0] ?? 'That file could not be read.' });
      return;
    }
    if (!read.every((part) => part.source.kind === 'word') && isProseFormat(format)) setFormat('screenplay');
    setStage({ kind: 'read', parts: read, failed });
  };

  const move = (index: number, by: -1 | 1) => {
    if (stage.kind !== 'read') return;
    setStage({ ...stage, parts: shifted(stage.parts, index, by) });
  };

  const drop = (index: number) => {
    if (stage.kind !== 'read') return;
    const left = stage.parts.filter((_part, at) => at !== index);
    setStage(left.length === 0 ? { kind: 'waiting' } : { ...stage, parts: left });
  };

  const finish = () => {
    if (!script || stage.kind !== 'read') return;
    let built = buildProjectFromImport(script, { format, fileCast, keepLocations, stories }).file;
    // A series' first script is its first episode, on a page of its own,
    // so that what follows is the second (addendum 22 §4a).
    if (format === 'series') built = ensureFirstEpisode(built, { title: script.title || bareName(stage.parts[0]!.name) });
    if (takesSeveral(format)) {
      for (const part of stage.parts.slice(1)) {
        const next = scriptOf(part, format);
        const title = next.title || bareName(part.name);
        const added = format === 'series' ? appendImportedEpisode(built, next, { title }) : appendImportedStory(built, next, { title });
        if (added) built = added.file;
      }
    }
    onImported(built);
    setStage({ kind: 'waiting' });
    onClose();
  };

  const close = () => {
    setStage({ kind: 'waiting' });
    onClose();
  };

  const nouns = nounsFor(format);
  const partNoun = format === 'series' ? 'episode' : isCollection(format) ? 'story' : null;
  // The noun table calls a series' work a script, which is true of each
  // episode and not of what the files together make.
  const wholeNoun = format === 'series' ? 'series' : nouns.work.toLowerCase();

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
              multiple
              accept=".fdx,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-label="Script file"
              className="import-picker"
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) void read(event.target.files);
              }}
            />

            {stage.kind === 'waiting' ? (
              <p className="muted">
                A Final Draft document (<code>.fdx</code>), a Word document (<code>.docx</code>) or a PDF. Final Draft
                says what every line is, so nothing is guessed. A Word document keeps its formatting — the face and
                size each paragraph was set in — and is read by its headings for a book and by its indents for a
                script. A PDF is read from where each line sits on the page — which is what a screenplay&rsquo;s
                format actually is — and anything worked out that way is marked. Choose several files to bring in a
                series or a collection one part after another, each on a page of its own.
              </p>
            ) : null}

            {stage.kind === 'reading' ? (
              <p className="muted">Reading {stage.count === 1 ? 'the document' : `${stage.count} documents`}…</p>
            ) : null}

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
                {/* The short-story format holds one story or many, and a
                    document cannot say which it is (addendum 22 §2): its
                    headings divide one story into sections, or begin a story
                    each. Asked here, where it is decided. */}
                {format === 'short_story' ? (
                  <fieldset className="import-stories">
                    <legend>What the {parts.length > 1 ? 'first document' : 'document'} is</legend>
                    <label>
                      <input type="radio" name="import-stories" aria-label="One story" checked={stories === 'one'} onChange={() => setStories('one')} />
                      One story — its headings divide it into sections, and the first names it.
                    </label>
                    <label>
                      <input type="radio" name="import-stories" aria-label="A collection" checked={stories === 'many'} onChange={() => setStories('many')} />
                      A collection — each chapter heading begins a story
                      {script ? ` (${script.scenes.filter((scene) => scene.heading.trim().length > 0).length} of them here)` : ''}. More can be added later from
                      File ▸ Add stories to the collection…
                    </label>
                  </fieldset>
                ) : null}
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

                {/* Several files (addendum 22 §4a): the order they are listed
                    in is the order they go in, and on a format made of one
                    document the rest are said to be left out. */}
                {stage.kind === 'read' && parts.length > 1 ? (
                  <div className="import-more">
                    {partNoun ? (
                      <>
                        <h4>{parts.length} files, in order</h4>
                        <ol className="import-list import-order" aria-label="Files in order">
                          {parts.map((part, index) => {
                            const one = scriptOf(part, format);
                            const counted = countOf(one);
                            const title = one.title || bareName(part.name);
                            return (
                              <li key={`${part.name}-${index}`}>
                                <span className="import-order-title">
                                  <span className="muted">{index + 1}.</span> {title}
                                </span>
                                <span className="muted">
                                  {counted.divisions} {counted.divisions === 1 ? nouns.unit.toLowerCase() : nouns.unitPlural.toLowerCase()} ·{' '}
                                  {counted.words.toLocaleString('en-US')} {counted.words === 1 ? 'word' : 'words'}
                                </span>
                                <span className="import-order-moves">
                                  <button type="button" className="ghost small" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost small"
                                    aria-label={`Move ${title} down`}
                                    disabled={index === parts.length - 1}
                                    onClick={() => move(index, 1)}
                                  >
                                    ↓
                                  </button>
                                </span>
                                <button type="button" className="ghost small" aria-label={`Leave out ${title}`} onClick={() => drop(index)}>
                                  ×
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                        <p className="muted small">
                          The first makes the {wholeNoun}; each after it is the next {partNoun}, on a page of its own.
                        </p>
                      </>
                    ) : (
                      <p className="muted small" role="note">
                        {parts.length - 1 === 1 ? 'One more file was chosen and' : `${parts.length - 1} more files were chosen and`} will be left out: a{' '}
                        {nouns.work.toLowerCase()} is one document. Choose <em>Series or episodic</em> or <em>Short stories and collections</em> to
                        bring them in one after another.
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            {stage.kind === 'read' && stage.failed.length > 0 ? (
              <>
                <h4>Not read</h4>
                <ul className="import-warnings">
                  {stage.failed.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <footer className="page-setup-actions">
            <button type="button" className="ghost" onClick={close}>
              Cancel
            </button>
            <button type="button" className="ghost" onClick={() => picker.current?.click()}>
              {script ? 'Choose others…' : 'Choose files…'}
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
