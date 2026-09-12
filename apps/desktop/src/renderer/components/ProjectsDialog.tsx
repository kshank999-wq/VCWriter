import { useCallback, useEffect, useState } from 'react';
import { useModal } from '../use-modal';
import {
  NO_PROJECTS,
  deleteRefusal,
  deleteRefusalText,
  deletionNote,
  deletionQuestion,
  projectName,
  projectSize,
  type ProjectEntry,
} from '@vcwriter/domain';

/**
 * The projects on this machine, and taking one away (spec §4).
 *
 * A writer accumulates projects — one real, three false starts, two imports of
 * the same PDF — and until now the only way to be rid of one was to go and
 * find the file. The list is in the File menu, where the rest of a project's
 * life already is.
 *
 * **Deleting is the one thing here that cannot be undone, so it is the one
 * thing that asks twice.** The row's Delete opens a question that names the
 * project and says where it goes; nothing happens until that is answered. The
 * confirming button is deliberately *not* where the row's Delete was, so the
 * second click cannot be the first one repeated.
 */

const when = (iso: string | null): string => {
  if (!iso) return '';
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export function ProjectsDialog({
  open,
  onClose,
  onChanged,
  openPath,
  bin,
}: {
  open: boolean;
  onClose(): void;
  /** Something went. Whoever else is showing this list should read it again. */
  onChanged?(): void;
  /** The project this window has open, which is the one that cannot go. */
  openPath: string | null;
  /**
   * What this platform does with a deleted file, in its own words.
   *
   * The desktop puts it in the platform's bin, where it can be put back; a
   * browser has no bin, so there it really is final — and the question says so
   * before it is asked rather than after it is answered.
   */
  bin: { name: string; recoverable: boolean };
}) {
  const [entries, setEntries] = useState<ProjectEntry[] | null>(null);
  const [asking, setAsking] = useState<ProjectEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const dialog = useModal(open);

  const load = useCallback(async () => {
    const result = await window.vcwriter.listProjects();
    if (result.ok && result.data) {
      setEntries(result.data);
      setError(null);
    } else {
      setEntries([]);
      setError(result.error ?? 'The list could not be read.');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setAsking(null);
    setSaid(null);
    void load();
  }, [open, load]);

  const remove = async (entry: ProjectEntry) => {
    setBusy(true);
    const result = await window.vcwriter.deleteProject(entry.path);
    setBusy(false);
    setAsking(null);

    if (!result.ok) {
      setError(result.error ?? 'It could not be deleted.');
      return;
    }
    setError(null);
    setSaid(
      result.data?.deleted
        ? result.data.recoverable
          ? `“${projectName(entry)}” is in the ${bin.name}.`
          : `“${projectName(entry)}” is gone.`
        : `“${projectName(entry)}” is off the list. The file was already gone.`,
    );
    await load();
    onChanged?.();
  };

  return (
    <dialog ref={dialog} className="lane-dialog projects-dialog" aria-label="Projects on this machine" onClose={onClose}>
      {open ? (
        <>
        <header className="lane-dialog-title">
          <span className="bar-title">Projects on this machine</span>
          <button type="button" className="ghost" aria-label="Close the project list" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="projects-body">
          {entries === null ? (
            <p className="muted small">Reading the list…</p>
          ) : entries.length === 0 ? (
            <p className="muted small">{NO_PROJECTS}</p>
          ) : (
            <ul className="projects-list">
              {entries.map((entry) => {
                const refusal = deleteRefusal({ entry, openPath });
                return (
                  <li key={entry.path} className={entry.missing ? 'project-row missing' : 'project-row'}>
                    <span className="project-who">
                      <strong>{projectName(entry)}</strong>
                      <span className="small block muted">
                        {[when(entry.savedAt), projectSize(entry)].filter(Boolean).join(' · ')}
                      </span>
                      {refusal ? <span className="small block muted">{deleteRefusalText(refusal)}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="ghost danger"
                      disabled={Boolean(refusal) || busy}
                      aria-label={`Delete ${projectName(entry)}`}
                      onClick={() => setAsking(entry)}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {said ? (
            <p className="notice small" role="status">
              {said}
            </p>
          ) : null}
          {error ? (
            <p className="error small" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="projects-foot">
          <p className="small muted">
            A project is the whole thing — its script, its research, its boards and its outlines.
          </p>
          <button type="button" className="button" onClick={onClose}>
            Done
          </button>
        </footer>

        {/* The second asking, over the list rather than beside it. It names the
            project, says where it goes, and its confirming button is nowhere
            near where the row's Delete was — so the second click cannot be the
            first one repeated. */}
        {asking ? (
          <div className="projects-sure" role="presentation" onClick={() => setAsking(null)}>
            <div
              className="sculpt-sure-dialog"
              role="alertdialog"
              aria-label={deletionQuestion(asking)}
              onClick={(event) => event.stopPropagation()}
            >
              <h3>{deletionQuestion(asking)}</h3>
              <p className="muted small">
                {deletionNote({ entry: asking, recoverable: bin.recoverable, binName: bin.name })}
              </p>
              <div className="sculpt-sure-row">
                <button type="button" className="button" disabled={busy} onClick={() => setAsking(null)}>
                  Keep it
                </button>
                <button type="button" className="ghost danger" disabled={busy} onClick={() => void remove(asking)}>
                  {busy ? 'Deleting…' : 'Delete it'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        </>
      ) : null}
    </dialog>
  );
}

export default ProjectsDialog;
