import { useEffect, useMemo, useState } from 'react';
import {
  REFERENCE_TYPE_NAMES,
  bringInReferences,
  factDifferences,
  linkExisting,
  referenceFingerprint,
  sameSourceIn,
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
  /**
   * **What to do with each source this library already has** (§30), by the
   * other library's id: leave it, or link it — keeping this project's facts,
   * or taking the other's. One that agrees is linked as it stands.
   */
  const [linking, setLinking] = useState<Map<string, 'no' | 'ours' | 'theirs'>>(new Map());

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

  /** Each source this library already has, matched to its copy here, and how the two stand. */
  const matches = useMemo(() => {
    if (!source || !offered) return [];
    return offered.already.map((there) => {
      const here = sameSourceIn(file, there);
      const agree = here ? referenceFingerprint(here) === referenceFingerprint(there) : false;
      return { there, here, agree, differences: here && !agree ? factDifferences(here, there) : [] };
    });
  }, [source, offered, file]);
  const choiceFor = (match: (typeof matches)[number]): 'no' | 'ours' | 'theirs' =>
    linking.get(match.there.id) ?? (match.agree && !match.here?.link ? 'ours' : 'no');
  const toLink = matches.filter((match) => match.here && !match.here.link && choiceFor(match) !== 'no');

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
    const library = { path: source.path, title: source.file.project.title };
    const link = linked ? library : null;
    const links = toLink.map((match) => ({ localId: (match.here as Reference).id, there: match.there, keep: choiceFor(match) as 'ours' | 'theirs' }));
    onUpdate((current) =>
      links.reduce(
        (sofar, one) => linkExisting(sofar, one.localId, one.there, library, one.keep),
        count > 0 ? bringInReferences(current, source.file.references, wanted, link).file : current,
      ),
    );
    const said = [
      count > 0 ? `${count} ${count === 1 ? 'source' : 'sources'} brought in from ${title}${linked ? `, linked: a change to ${count === 1 ? 'it' : 'them'} here or there reaches the other` : ''}` : '',
      links.length > 0 ? `${links.length === 1 ? 'one source' : `${links.length} sources`} already here linked to ${title}` : '',
    ].filter(Boolean);
    setDone(`${said.join('; ')}.`.replace(/^./, (first) => first.toUpperCase()));
    setLinking(new Map());
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
              {matches.map((match) => (
                <li key={match.there.id} className="refs-have">
                  <span>
                    <span className="cite-who">{referenceCreator(match.there) || '—'}</span>{' '}
                    <span className="cite-title">{match.there.title || (match.there.asWritten ? <InlineText text={match.there.asWritten} /> : 'Untitled source')}</span>
                  </span>
                  {match.here?.link ? (
                    <span className="muted small">
                      already here,{' '}
                      {match.here.link.path === source?.path ? 'linked to it' : `linked to ${match.here.link.title || 'another project'}`}
                    </span>
                  ) : match.agree ? (
                    <label className="muted small">
                      <input
                        type="checkbox"
                        checked={choiceFor(match) !== 'no'}
                        onChange={(event) => setLinking((current) => new Map(current).set(match.there.id, event.target.checked ? 'ours' : 'no'))}
                      />{' '}
                      already here, the same: link the two
                    </label>
                  ) : (
                    <span className="refs-have-differs">
                      <span className="muted small">
                        already here, but not the same:{' '}
                        {match.differences.map((one) => `${one.field} ${one.here || '(none)'} here, ${one.there || '(none)'} there`).join('; ')}
                      </span>
                      <select
                        aria-label={`Link ${match.there.title || 'this source'}`}
                        value={choiceFor(match)}
                        onChange={(event) => setLinking((current) => new Map(current).set(match.there.id, event.target.value as 'no' | 'ours' | 'theirs'))}
                      >
                        <option value="no">Leave it unlinked</option>
                        <option value="ours">Link, keeping this project’s</option>
                        <option value="theirs">Link, taking {source?.file.project.title || 'that project'}’s</option>
                      </select>
                    </span>
                  )}
                </li>
              ))}
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
          <button type="button" className="primary" disabled={ticked === 0 && toLink.length === 0} onClick={bring}>
            {ticked > 0 || toLink.length === 0 ? `Bring in ${ticked > 0 ? `${ticked} ` : ''}${ticked === 1 ? 'source' : 'sources'}` : ''}
            {ticked > 0 && toLink.length > 0 ? ' and ' : ''}
            {toLink.length > 0 ? `${ticked > 0 ? 'link' : 'Link'} ${toLink.length} already here` : ''}
          </button>
        </footer>
      </div>
    </div>
  );
}
