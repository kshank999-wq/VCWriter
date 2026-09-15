import { useMemo, useRef, useState } from 'react';
import {
  batchesInOrder,
  describeBatch,
  graphicsMadeBy,
  importFiles,
  itemsMadeBy,
  warningsIn,
  type ImportBatch,
  type ImportedFile,
  type ProjectFile,
  type ResearchCategoryId,
} from '@vcwriter/domain';

/**
 * The research importer (addendum 16 §4).
 *
 * The screen exists to show the thing §4 insists on: **what did not come in.**
 * An importer that reported only its successes would be technically honest and
 * would hide the three files nobody read, and the author would find out a year
 * later looking for a note that was never there.
 *
 * So the result of an import leads with what arrived and names every file that
 * did not, and the record of past imports stays on the screen — a batch is not
 * a toast that disappears while somebody is reading it.
 */
interface ImportNotesPanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/** Text out of a file, or a data URI where it is a picture. The host's half (§4). */
const readOne = (one: File): Promise<ImportedFile> =>
  new Promise((resolve) => {
    const reader = new FileReader();

    if (one.type.startsWith('image/')) {
      reader.onload = () => {
        const data = String(reader.result ?? '');
        const image = new Image();
        image.onload = () =>
          resolve({ name: one.name, dataUrl: data, width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve({ name: one.name, dataUrl: data });
        image.src = data;
      };
      // A picture that will not read at all still gets an entry, named.
      reader.onerror = () => resolve({ name: one.name });
      reader.readAsDataURL(one);
      return;
    }

    /**
     * Anything the browser can give us words from.
     *
     * Deliberately narrow: a `.docx` is a zip and reading it as text produces
     * mojibake rather than a note, so it is **left to be reported as skipped**
     * rather than imported as rubbish. Adding it later is a host-side
     * extractor and no change to the research model, which is §4's
     * extensibility point.
     */
    const textual = /\.(txt|md|markdown|mdown|csv|json|rtf|log)$/i.test(one.name) || one.type.startsWith('text/');
    if (!textual) {
      resolve({ name: one.name });
      return;
    }
    reader.onload = () => resolve({ name: one.name, text: String(reader.result ?? '') });
    reader.onerror = () => resolve({ name: one.name });
    reader.readAsText(one);
  });

export function ImportNotesPanel({ file, onUpdate }: ImportNotesPanelProps) {
  const shelves = useMemo(() => {
    const find = (key: string) => file.researchCategories.find((one) => one.systemKey === key)?.id ?? null;
    return { notes: find('notes'), inbox: find('inbox') };
  }, [file]);

  const past = useMemo(() => batchesInOrder(file), [file]);
  const [latest, setLatest] = useState<ImportBatch | null>(null);
  const [toInbox, setToInbox] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const take = async (chosen: FileList | null) => {
    if (!chosen || chosen.length === 0 || !shelves.notes) return;
    setBusy(true);
    const read = await Promise.all(Array.from(chosen).map(readOne));
    onUpdate((current) => {
      const done = importFiles(current, read, {
        notesCategoryId: shelves.notes as ResearchCategoryId,
        ...(shelves.inbox ? { inboxCategoryId: shelves.inbox as ResearchCategoryId } : {}),
        toInbox,
      });
      setLatest(done.batch);
      return done.file;
    });
    setBusy(false);
  };

  return (
    <div className="importer">
      <div className="panel-header">
        <h3>Bring in notes and graphics</h3>
        <span className="muted small">
          Notes land as research, pictures land in the graphics library. Nothing is written over.
        </span>
      </div>

      <div
        className={dragging ? 'importer-drop over' : 'importer-drop'}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void take(event.dataTransfer.files);
        }}
      >
        <p>{busy ? 'Reading…' : 'Drop files or a folder here'}</p>
        <button type="button" className="button" disabled={busy} onClick={() => picker.current?.click()}>
          Choose files…
        </button>
        <input
          ref={picker}
          type="file"
          multiple
          aria-label="Choose files to import"
          style={{ display: 'none' }}
          onChange={(event) => {
            void take(event.target.files);
            event.target.value = '';
          }}
        />
        {shelves.inbox ? (
          <label className="check">
            <input type="checkbox" checked={toInbox} onChange={(event) => setToInbox(event.target.checked)} />
            {/* §4's staging area, and a real shelf rather than a modal. */}
            <span>Hold them in Imported until I classify them</span>
          </label>
        ) : null}
      </div>

      <p className="muted small">
        Markdown is split on its headings, because those are divisions you already made. Plain text
        comes in whole — a blank line is not a heading, and un-splitting is harder than splitting.
      </p>

      {latest ? <BatchReport batch={latest} lead /> : null}

      {past.length > 0 ? (
        <section className="importer-history">
          <h4>Earlier imports</h4>
          {past
            .filter((one) => one.id !== latest?.id)
            .map((one) => (
              <BatchReport key={one.id} batch={one} />
            ))}
        </section>
      ) : null}
    </div>
  );
}

/**
 * What one import did.
 *
 * Every file that needs a look is **named**, which is the sentence the module
 * exists for. Files that came in fine are counted rather than listed: they are
 * in the research now, and a list of two hundred successes would bury the three
 * that matter.
 */
function BatchReport({ batch, lead = false }: { batch: ImportBatch; lead?: boolean }) {
  const missed = warningsIn(batch);
  return (
    <article className={lead ? 'note-import-batch lead' : 'note-import-batch'}>
      <h5>{describeBatch(batch)}</h5>
      <p className="muted small">
        {new Date(batch.createdAt).toLocaleString()} · {itemsMadeBy(batch)} notes ·{' '}
        {graphicsMadeBy(batch)} graphics
      </p>
      {missed.length > 0 ? (
        <ul className="note-import-warnings">
          {missed.map((one, at) => (
            <li key={`${one.name}-${at}`} className={one.outcome}>
              <span className="note-import-file">{one.name}</span>
              <span className="muted small">{one.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
