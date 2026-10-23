import { useEffect, useMemo, useState } from 'react';
import {
  REFERENCE_TYPE_NAMES,
  bringInReferences,
  referenceCreator,
  type ProjectFile,
  type Reference,
} from '@vcwriter/domain';
import { InlineText } from './InlineText';

/**
 * **Bring in sources from another project** (addendum 43 §11): the library a
 * book was cited from, shared with the report written about it, or the other
 * way round.
 *
 * Choose a project — one on the list, or any `.vcw` on the computer — and its
 * library is shown with what this one already has marked, every other live
 * source ticked. *Bring in* copies the ticked ones into this library — linked
 * to the one they came from, unless the writer says otherwise, so a change
 * on either side reaches the other (§29).
 */

interface ProjectEntry {
  path: string;
  title: string;
}

interface BringInSourcesDialogProps {
  file: ProjectFile;
  /** Where the open project is kept, so it is not offered as its own source. */
  projectPath?: string | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
}

export function BringInSourcesDialog({ file, projectPath = null, onUpdate, onClose }: BringInSourcesDialogProps) {
  const [projects, setProjects] = useState<ProjectEntry[] | null>(null);
  const [source, setSource] = useState<{ path: string; file: ProjectFile } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** Whether the copies stay linked to the library they came from (addendum 43 §29). */
  const [linked, setLinked] = useState(true);

  useEffect(() => {
    let live = true;
    void window.vcwriter.listProjects().then((result) => {
      if (!live) return;
      setProjects(result.ok && result.data ? result.data.filter((entry) => entry.path !== projectPath && !entry.missing).map((entry) => ({ path: entry.path, title: entry.title })) : []);
    });
    return () => {
      live = false;
    };
  }, [projectPath]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [onClose]);

  /** What the chosen library holds, split into what is new here and what this library has already. */
  const offered = useMemo(() => {
    if (!source) return null;
    const live = source.file.references.filter((one) => one.archivedAt === null);
    const { already } = bringInReferences(file, live);
    const here = new Set(already.map((one) => one.id));
    return { fresh: live.filter((one) => !here.has(one.id)), already: live.filter((one) => here.has(one.id)) };
  }, [source, file]);

  const read = async (path: string) => {
    setError(null);
    setDone(null);
    const result = await window.vcwriter.readProject(path);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'That project could not be read.');
      return;
    }
    if (result.data.file.project.id === file.project.id) {
      setError('That is this project.');
      return;
    }
    setSource({ path, file: result.data.file });
    setPicked(new Set(result.data.file.references.filter((one) => one.archivedAt === null).map((one) => one.id)));
  };

  const browse = async () => {
    const chosen = await window.vcwriter.pickProject();
    if (!chosen.ok) {
      setError(chosen.error ?? 'That project could not be chosen.');
      return;
    }
    if (chosen.data) void read(chosen.data.path);
  };

  const bring = () => {
    if (!source || !offered) return;
    const wanted = new Set(offered.fresh.filter((one) => picked.has(one.id)).map((one) => one.id));
    const count = wanted.size;
    const title = source.file.project.title || 'that project';
    const link = linked ? { path: source.path, title: source.file.project.title } : null;
    onUpdate((current) => bringInReferences(current, source.file.references, wanted, link).file);
    setDone(`${count} ${count === 1 ? 'source' : 'sources'} brought in from ${title}${linked ? `, linked: a change to ${count === 1 ? 'it' : 'them'} here or there reaches the other` : ''}.`);
  };

  const row = (reference: Reference, have: boolean) => (
    <li key={reference.id} className={have ? 'refs-have' : ''}>
      <label>
        <input
          type="checkbox"
          disabled={have}
          checked={!have && picked.has(reference.id)}
          onChange={(event) =>
            setPicked((current) => {
              const next = new Set(current);
              if (event.target.checked) next.add(reference.id);
              else next.delete(reference.id);
              return next;
            })
          }
        />
        <span className="cite-who">{referenceCreator(reference) || '—'}</span>
        <span className="cite-title">{reference.title || (reference.asWritten ? <InlineText text={reference.asWritten} /> : 'Untitled source')}</span>
        <span className="muted small">{have ? 'already in this library' : [REFERENCE_TYPE_NAMES[reference.type], reference.date.slice(0, 4)].filter(Boolean).join(' · ')}</span>
      </label>
    </li>
  );

  const ticked = offered ? offered.fresh.filter((one) => picked.has(one.id)).length : 0;

  return (
    <div className="cite-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="cite-dialog refs-bring" role="dialog" aria-modal="true" aria-label="Bring in sources">
        <header>
          <h2>Bring in sources from another project</h2>
          <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="muted small">
          Each source comes in as a copy of its own, linked to the library it came from unless you say otherwise. A source this library already has is not
          brought in twice.
        </p>
        <div className="refs-bring-from">
          <select
            aria-label="Project to bring sources from"
            value={source?.path ?? ''}
            onChange={(event) => event.target.value && void read(event.target.value)}
          >
            <option value="">{projects === null ? 'Finding your projects…' : projects.length === 0 ? 'No other projects yet' : 'Choose a project…'}</option>
            {(projects ?? []).map((entry) => (
              <option key={entry.path} value={entry.path}>
                {entry.title || 'Untitled'}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void browse()}>
            Browse…
          </button>
        </div>
        {error ? (
          <p className="cite-warning" role="alert">
            {error}
          </p>
        ) : null}
        {offered ? (
          offered.fresh.length + offered.already.length === 0 ? (
            <p className="muted small">That project’s library is empty.</p>
          ) : (
            <ul className="refs-bring-list" aria-label="Sources in that library">
              {offered.fresh.map((one) => row(one, false))}
              {offered.already.map((one) => row(one, true))}
            </ul>
          )
        ) : null}
        {offered && offered.fresh.length > 0 ? (
          <label className="check refs-bring-link">
            <input type="checkbox" checked={linked} onChange={(event) => setLinked(event.target.checked)} /> Keep them linked to{' '}
            {source?.file.project.title || 'that project'}: a change made to a source in either project reaches the other when its library is next
            opened
          </label>
        ) : null}
        {done ? (
          <p className="muted small" role="status">
            {done}
          </p>
        ) : null}
        <footer>
          <span className="spacer" />
          <button type="button" className="ghost" onClick={onClose}>
            {done ? 'Done' : 'Cancel'}
          </button>
          <button type="button" className="primary" disabled={ticked === 0} onClick={bring}>
            Bring in {ticked > 0 ? ticked : ''} {ticked === 1 ? 'source' : 'sources'}
          </button>
        </footer>
      </div>
    </div>
  );
}
