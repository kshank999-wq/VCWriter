import { useEffect, useMemo, useRef, useState } from 'react';
import {
  REFERENCE_TYPE_NAMES,
  addReference,
  archiveReference,
  bibliographyHeadingOf,
  citationCounts,
  citationNotes,
  citationOccurrences,
  citationInText,
  citationSettingsOf,
  danglingCitations,
  duplicateReference,
  mergeReferences,
  possibleDuplicates,
  referenceBibliography,
  referenceCreator,
  referencesOf,
  removeReference,
  referenceTypeSchema,
  setCitationSettings,
  tagsInLibrary,
  updateReference,
  usesFootnotes,
  type CitationSettings,
  type ProjectFile,
  type ReferenceId,
  type ReferenceType,
  addPart,
  bibliographyOf,
  partsOf,
  occurrencesIn,
  fromWordReadable,
  isLinkedLibrary,
  linkedLibraries,
  relinkLibrary,
  settleLink,
  syncLinkedLibrary,
  unlinkReference,
  type LinkConflict,
  fromWordUnread,
  recogniseFromWord,
} from '@vcwriter/domain';
import { InlineText } from './InlineText';
import { ReferenceForm } from './ReferenceForm';
import { BringInSourcesDialog } from './BringInSourcesDialog';

/**
 * **References** (addendum 43, spec §3 and §5): the instructional book's
 * Reference Library, in Research.
 *
 * Down the left, the library: search, the kind of source, a tag, the archive.
 * On the right, the source chosen, to fill in; above it, Add, Duplicate,
 * Archive, Delete (only for a source nothing cites) and, where two sources
 * look like one, Merge. Below, how the book cites (the style, the markers,
 * the bibliography) and what it will print: every note in order and the
 * bibliography, rebuilt as anything changes.
 */

interface ReferencesPanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  readOnly?: boolean;
  /**
   * A word-processor document the notes and bibliography are previewed for
   * (addendum 43 §11); absent on a book, which previews its story.
   */
  documentId?: string | null;
  /** Where the open project is kept, so Bring in does not offer it as its own source. */
  projectPath?: string | null;
}

type View = 'library' | 'settings' | 'preview';

export function ReferencesPanel({ file, onUpdate, readOnly = false, documentId = null, projectPath = null }: ReferencesPanelProps) {
  const [bringing, setBringing] = useState(false);
  const [view, setView] = useState<View>('library');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ReferenceType | 'all'>('all');
  const [tag, setTag] = useState('');
  const [archived, setArchived] = useState(false);
  const [chosenId, setChosenId] = useState<ReferenceId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const list = useMemo(() => referencesOf(file, { query, type, tag: tag || undefined, archived }), [file, query, type, tag, archived]);
  const counts = useMemo(() => citationCounts(file), [file]);
  const duplicates = useMemo(() => possibleDuplicates(file), [file]);
  const dangling = useMemo(() => danglingCitations(file), [file]);
  const chosen = file.references.find((reference) => reference.id === chosenId) ?? null;
  const settings = citationSettingsOf(file);
  const unread = fromWordUnread(file);
  const readable = fromWordReadable(file);

  /** The sources still one line from Word, read into their parts where they can be (addendum 43 §20). */
  const readFromWord = () => {
    const before = unread;
    const done = recogniseFromWord(file);
    if (done.read > 0) onUpdate((current) => recogniseFromWord(current).file);
    const left = fromWordUnread(done.file);
    const parted = before - left;
    setMessage(
      parted > 0
        ? `${parted === 1 ? 'One source' : `${parted} sources`} read into ${parted === 1 ? 'its' : 'their'} parts.${left ? ` ${left === 1 ? 'One is' : `${left} are`} kept as written: fill in the fields for ${left === 1 ? 'it' : 'those'}.` : ''}`
        : 'None of these could be read with confidence. Fill in their fields by hand.',
    );
  };

  /**
   * **The linked sources brought back into step** (addendum 43 §29), once
   * each time the library is opened: every project this one's sources are
   * linked to is read, a change on either side goes to the other, and where
   * both changed the writer is asked. A change for another project is only
   * counted as sent once it is written there; where that project has changed
   * meanwhile, nothing moves and the next opening tries again.
   */
  const [conflicts, setConflicts] = useState<LinkConflict[]>([]);
  const fileNow = useRef(file);
  fileNow.current = file;
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  /** Libraries that could not be found, where they were or anywhere else looked (§31). */
  const [lost, setLost] = useState<{ path: string; title: string; projectId: string }[]>([]);
  /**
   * **A linked library, found** (§31): where its link says, if the project
   * there is the one linked to; otherwise among the projects this computer
   * knows, by the project's own id — the file having been moved, renamed or
   * opened here from somewhere else. Null where it is nowhere to be found.
   */
  const locate = async (library: { path: string; title: string; projectId: string }) => {
    const direct = await window.vcwriter.readProject(library.path);
    if (direct.ok && direct.data && isLinkedLibrary(library, direct.data.file)) return { path: library.path, file: direct.data.file, hash: direct.data.contentHash };
    if (!library.projectId || !window.vcwriter.listProjects) return null;
    const listed = await window.vcwriter.listProjects();
    const candidates = (listed.ok && listed.data ? listed.data : [])
      .filter((entry) => !entry.missing && entry.path !== library.path)
      // The same name first: a moved file usually keeps it.
      .sort((a, b) => Number(b.title === library.title) - Number(a.title === library.title));
    for (const entry of candidates.slice(0, 40)) {
      const read = await window.vcwriter.readProject(entry.path);
      if (read.ok && read.data && read.data.file.project.id === library.projectId) return { path: entry.path, file: read.data.file, hash: read.data.contentHash };
    }
    return null;
  };
  const syncLinks = async () => {
    const libraries = linkedLibraries(fileNow.current);
    if (readOnly || libraries.length === 0 || !window.vcwriter?.readProject) return;
    const read = new Map<string, ProjectFile | null>();
    const hashes = new Map<string, string>();
    const moves: { from: string; to: string; project: { id: string; title: string } }[] = [];
    const missing: typeof lost = [];
    for (const library of libraries) {
      const found = await locate(library);
      if (!found) {
        read.set(library.path, null);
        missing.push(library);
        continue;
      }
      // Followed to where it is now, and its id learnt where the link had none.
      if (found.path !== library.path || !library.projectId) moves.push({ from: library.path, to: found.path, project: { id: found.file.project.id, title: found.file.project.title } });
      read.set(found.path, found.file);
      hashes.set(found.path, found.hash);
    }
    if (!mounted.current) return;
    setLost(missing);
    const relinked = (current: ProjectFile) => moves.reduce((sofar, move) => relinkLibrary(sofar, move.from, move.to, move.project), current);
    if (moves.length > 0) {
      fileNow.current = relinked(fileNow.current);
      onUpdate((current) => relinked(current));
    }
    if (!mounted.current) return;
    const first = syncLinkedLibrary(fileNow.current, read);
    for (const [path, library] of first.origins) {
      const sent = window.vcwriter.sendIntoProject
        ? await window.vcwriter.sendIntoProject({ path, file: library, expectedHash: hashes.get(path) ?? '' })
        : { ok: false as const, error: 'Not here' };
      if (!sent.ok) read.set(path, null);
    }
    if (!mounted.current) return;
    const done = syncLinkedLibrary(fileNow.current, read);
    if (done.file !== fileNow.current) onUpdate((current) => syncLinkedLibrary(current, read).file);
    setConflicts(done.conflicts);
    const unread = libraries.filter((library) => read.get(library.path) === null).map((library) => library.title || 'a project');
    const said = [
      done.pulled ? `${done.pulled === 1 ? 'One source' : `${done.pulled} sources`} took a change from where ${done.pulled === 1 ? 'it is' : 'they are'} linked` : '',
      done.pushed ? `${done.pushed === 1 ? 'one change' : `${done.pushed} changes`} sent to the linked library` : '',
      done.gone ? `${done.gone === 1 ? 'one source' : `${done.gone} sources`} unlinked, gone from the library ${done.gone === 1 ? 'it' : 'they'} came from` : '',
      unread.length ? `${unread.join(', ')} could not be found; the links there wait` : '',
      moves.some((move) => move.from !== move.to) ? `followed ${[...new Set(moves.filter((move) => move.from !== move.to).map((move) => move.project.title || 'a library'))].join(', ')} to where ${moves.length === 1 ? 'it' : 'they'} now ${moves.length === 1 ? 'is' : 'are'}` : '',
    ].filter(Boolean);
    if (said.length) setMessage(`${said.join('; ')}.`.replace(/^./, (first) => first.toUpperCase()));
  };
  // Once per opening of the library, and again when sources have been brought in or linked (§30).
  useEffect(() => {
    void syncLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The writer points at a library that has moved (§31); taken only if it is the project linked to. */
  const findLibrary = async (library: { path: string; title: string; projectId: string }) => {
    const chosen = await window.vcwriter.pickProject();
    if (!chosen.ok || !chosen.data) return;
    const read = await window.vcwriter.readProject(chosen.data.path);
    if (!read.ok || !read.data) {
      setMessage(read.error ?? 'That project could not be read.');
      return;
    }
    if (library.projectId ? read.data.file.project.id !== library.projectId : read.data.file.project.title !== library.title) {
      setMessage(`That is not ${library.title || 'the library these sources are linked to'}: ${read.data.file.project.title || 'it'} is another project.`);
      return;
    }
    const to = chosen.data.path;
    const project = { id: read.data.file.project.id, title: read.data.file.project.title };
    fileNow.current = relinkLibrary(fileNow.current, library.path, to, project);
    onUpdate((current) => relinkLibrary(current, library.path, to, project));
    setLost((current) => current.filter((one) => one.path !== library.path));
    await syncLinks();
  };

  const settle = async (conflict: LinkConflict, keep: 'ours' | 'theirs') => {
    const read = await window.vcwriter.readProject(conflict.path);
    if (!read.ok || !read.data) {
      setMessage(`${conflict.title || 'That project'} could not be read.`);
      return;
    }
    const settled = settleLink(fileNow.current, conflict, read.data.file, keep);
    if (settled.library) {
      const sent = await window.vcwriter.sendIntoProject({ path: conflict.path, file: settled.library, expectedHash: read.data.contentHash });
      if (!sent.ok) {
        setMessage(sent.error ?? `${conflict.title || 'That project'} could not be written.`);
        return;
      }
    }
    onUpdate((current) => settleLink(current, conflict, read.data!.file, keep).file);
    setConflicts((current) => current.filter((one) => one.referenceId !== conflict.referenceId));
  };

  const add = () => {
    const made = addReference(file, { type: type === 'all' ? 'book' : type });
    onUpdate((current) => ({ ...current, references: [...current.references, made.reference] }));
    setChosenId(made.reference.id);
    setArchived(false);
    setMessage(null);
  };

  return (
    <div className="refs">
      {bringing ? (
        <BringInSourcesDialog
          file={file}
          projectPath={projectPath}
          onUpdate={onUpdate}
          onClose={() => {
            setBringing(false);
            // What was just linked is brought into step now, not at the next opening.
            window.setTimeout(() => void syncLinks(), 0);
          }}
        />
      ) : null}
      <nav className="refs-tabs" role="tablist" aria-label="References">
        {(['library', 'settings', 'preview'] as const).map((one) => (
          <button key={one} type="button" role="tab" aria-selected={view === one} className={view === one ? 'on' : ''} onClick={() => setView(one)}>
            {one === 'library' ? `Library (${file.references.filter((reference) => !reference.archivedAt).length})` : one === 'settings' ? (documentId !== null ? 'How it cites' : 'How the book cites') : 'Notes & bibliography'}
          </button>
        ))}
      </nav>

      {dangling.length ? (
        <p className="refs-warning" role="alert">
          {dangling.length === 1 ? 'One citation has' : `${dangling.length} citations have`} lost their source. Click the marker in the text to choose one.
        </p>
      ) : null}
      {message ? (
        <p className="muted small" role="status">
          {message}
        </p>
      ) : null}

      {lost.length > 0 ? (
        <section className="refs-lost" aria-label="Linked libraries not found">
          {lost.map((library) => (
            <p key={library.path} className="refs-warning">
              {library.title || 'A linked library'} could not be found where it was ({library.path}) or among your projects. Its sources here are kept, and wait.{' '}
              <button type="button" className="ghost small" disabled={readOnly} onClick={() => void findLibrary(library)}>
                Find {library.title || 'it'}…
              </button>
            </p>
          ))}
        </section>
      ) : null}
      {conflicts.length > 0 ? (
        <section className="refs-conflicts" aria-label="Changed in both projects">
          <p className="refs-warning">
            {conflicts.length === 1 ? 'One linked source was' : `${conflicts.length} linked sources were`} changed here and in the library {conflicts.length === 1 ? 'it is' : 'they are'} linked to. Which stands?
          </p>
          {conflicts.map((conflict) => (
            <div key={conflict.referenceId} className="refs-conflict">
              <span>
                <strong>Here:</strong> {[referenceCreator(conflict.ours), conflict.ours.title, conflict.ours.date].filter(Boolean).join(' · ')}
              </span>
              <span>
                <strong>In {conflict.title || 'the library'}:</strong> {[referenceCreator(conflict.theirs), conflict.theirs.title, conflict.theirs.date].filter(Boolean).join(' · ')}
              </span>
              <span className="refs-conflict-acts">
                <button type="button" className="ghost small" disabled={readOnly} onClick={() => void settle(conflict, 'ours')}>
                  Keep this project’s
                </button>
                <button type="button" className="ghost small" disabled={readOnly} onClick={() => void settle(conflict, 'theirs')}>
                  Take {conflict.title || 'the library'}’s
                </button>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {view === 'library' ? (
        <div className="refs-library">
          <aside className="refs-list">
            <div className="refs-filters">
              <input type="search" aria-label="Search the library" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select aria-label="Kind of source" value={type} onChange={(event) => setType(event.target.value as ReferenceType | 'all')}>
                <option value="all">Every kind</option>
                {referenceTypeSchema.options.map((one) => (
                  <option key={one} value={one}>
                    {REFERENCE_TYPE_NAMES[one]}
                  </option>
                ))}
              </select>
              {tagsInLibrary(file).length ? (
                <select aria-label="Tag" value={tag} onChange={(event) => setTag(event.target.value)}>
                  <option value="">Any tag</option>
                  {tagsInLibrary(file).map((one) => (
                    <option key={one} value={one}>
                      {one}
                    </option>
                  ))}
                </select>
              ) : null}
              <label className="refs-archived">
                <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} /> Archived
              </label>
            </div>
            <button type="button" className="primary" disabled={readOnly} onClick={add}>
              Add reference
            </button>
            {/* Another project's library, shared into this one (addendum 43 §11). */}
            <button type="button" className="ghost small" disabled={readOnly} onClick={() => setBringing(true)}>
              Bring in sources from another project…
            </button>
            {readable > 0 ? (
              <button type="button" className="ghost small" disabled={readOnly} onClick={readFromWord} title="Read the author, title, publisher and year out of each source kept as one line from Word">
                Read the parts of {readable === 1 ? 'the source' : `${readable} sources`} from Word
              </button>
            ) : null}
            <ul aria-label="Sources">
              {list.length === 0 ? <li className="muted small">{archived ? 'Nothing archived.' : file.references.length ? 'Nothing matches.' : 'No sources yet. Add the first.'}</li> : null}
              {list.map((reference) => (
                <li key={reference.id}>
                  <button type="button" className={reference.id === chosenId ? 'chosen' : ''} aria-pressed={reference.id === chosenId} onClick={() => setChosenId(reference.id)}>
                    <span className="refs-who">{referenceCreator(reference) || '—'}</span>
                    <span className="refs-title">{reference.title || (reference.asWritten ? <InlineText text={reference.asWritten} /> : 'Untitled source')}</span>
                    <span className="muted small">
                      {[
                        REFERENCE_TYPE_NAMES[reference.type],
                        reference.date.slice(0, 4),
                        reference.shortCode,
                        counts.get(reference.id) ? `cited ${counts.get(reference.id)}×` : 'not cited',
                        reference.link ? `linked to ${reference.link.title || 'another project'}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {duplicates.length ? (
              <section className="refs-dupes" aria-label="Possible duplicates">
                <h4>Possibly the same source</h4>
                {duplicates.map((group) => (
                  <div key={group.map((one) => one.id).join()} className="refs-dupe">
                    {group.map((one) => (
                      <button
                        key={one.id}
                        type="button"
                        className="ghost small"
                        disabled={readOnly}
                        title="Keep this one: every citation of the others moves to it, and they go"
                        onClick={() => {
                          onUpdate((current) => mergeReferences(current, one.id, group.filter((other) => other.id !== one.id).map((other) => other.id)));
                          setChosenId(one.id);
                          setMessage(`Merged into “${one.title || 'Untitled source'}”.`);
                        }}
                      >
                        Keep “{one.title || 'Untitled'}”{one.date ? ` (${one.date.slice(0, 4)})` : ''}
                      </button>
                    ))}
                  </div>
                ))}
              </section>
            ) : null}
          </aside>

          <section className="refs-detail" aria-label="Source">
            {chosen ? (
              <>
                <div className="refs-actions">
                  <button
                    type="button"
                    className="ghost small"
                    disabled={readOnly}
                    onClick={() => {
                      const copy = duplicateReference(file, chosen.id).reference;
                      if (!copy) return;
                      onUpdate((current) => ({ ...current, references: [...current.references, copy] }));
                      setChosenId(copy.id);
                    }}
                  >
                    Duplicate
                  </button>
                  <button type="button" className="ghost small" disabled={readOnly} onClick={() => onUpdate((current) => archiveReference(current, chosen.id, !chosen.archivedAt))}>
                    {chosen.archivedAt ? 'Restore' : 'Archive'}
                  </button>
                  <button
                    type="button"
                    className="ghost small danger"
                    disabled={readOnly || Boolean(counts.get(chosen.id))}
                    title={counts.get(chosen.id) ? 'Cited in the text: archive it instead, or take the citations out first' : 'Delete this source'}
                    onClick={() => {
                      onUpdate((current) => removeReference(current, chosen.id));
                      setChosenId(null);
                    }}
                  >
                    Delete
                  </button>
                  <span className="muted small">{counts.get(chosen.id) ? `Cited ${counts.get(chosen.id)} ${counts.get(chosen.id) === 1 ? 'time' : 'times'}` : 'Not cited yet'}</span>
                </div>
                {chosen.link ? (
                  // A source that follows the library it came from (addendum 43 §29).
                  <p className="refs-linked muted small" aria-label="Linked">
                    Linked to {chosen.link.title || 'another project'}: a change made here goes there, and one made there comes here, when either library is
                    opened.{' '}
                    <button type="button" className="ghost small" disabled={readOnly} onClick={() => onUpdate((current) => unlinkReference(current, chosen.id))}>
                      Unlink
                    </button>
                  </p>
                ) : null}
                <ReferenceForm reference={chosen} readOnly={readOnly} onChange={(patch) => onUpdate((current) => updateReference(current, chosen.id, patch))} />
              </>
            ) : (
              <p className="muted">Choose a source to fill it in, or add one. To cite it, put the cursor in the writing and press Cite.</p>
            )}
          </section>
        </div>
      ) : null}

      {view === 'settings' ? <CitationSettingsForm settings={settings} readOnly={readOnly} onChange={(patch) => onUpdate((current) => setCitationSettings(current, patch))} /> : null}

      {view === 'preview' ? <Preview file={file} readOnly={readOnly} onUpdate={onUpdate} documentId={documentId} /> : null}
    </div>
  );
}

function CitationSettingsForm({ settings, readOnly, onChange }: { settings: CitationSettings; readOnly: boolean; onChange(patch: Partial<CitationSettings>): void }) {
  const footnotes = usesFootnotes(settings);
  return (
    <div className="refs-settings">
      <label>
        <span>Style</span>
        <select aria-label="Citation style" value={settings.style} disabled={readOnly} onChange={(event) => onChange({ style: event.target.value as CitationSettings['style'] })}>
          <option value="chicago">Chicago Notes &amp; Bibliography (footnotes)</option>
          <option value="apa">APA (author and year in the text)</option>
          <option value="mla">MLA (author and page in the text)</option>
          <option value="custom">Custom (footnotes, your choice of form)</option>
        </select>
      </label>
      {!footnotes ? <p className="muted small">APA and MLA cite in parentheses in the text, as they are written. For footnotes, choose Chicago or Custom.</p> : null}
      {settings.style === 'custom' ? (
        <label>
          <span>Notes written as</span>
          <select aria-label="Notes written as" value={settings.customNoteForm} disabled={readOnly} onChange={(event) => onChange({ customNoteForm: event.target.value as CitationSettings['customNoteForm'] })}>
            <option value="chicago">Chicago</option>
            <option value="apa">APA</option>
            <option value="mla">MLA</option>
          </select>
        </label>
      ) : null}
      {footnotes ? (
        <>
          <label>
            <span>Markers</span>
            <select aria-label="Markers" value={settings.markers} disabled={readOnly} onChange={(event) => onChange({ markers: event.target.value as CitationSettings['markers'] })}>
              <option value="numeric">1, 2, 3</option>
              <option value="alpha">a, b, c</option>
              <option value="symbol">*, †, ‡</option>
            </select>
          </label>
          {settings.markers === 'symbol' ? (
            <label>
              <span>After ¶</span>
              <select aria-label="After the sixth symbol" value={settings.symbolOverflow} disabled={readOnly} onChange={(event) => onChange({ symbolOverflow: event.target.value as CitationSettings['symbolOverflow'] })}>
                <option value="double">Double them: **, ††</option>
                <option value="numeric">Go on in numbers: 7, 8</option>
              </select>
            </label>
          ) : null}
          <label>
            <span>Count</span>
            <select aria-label="Count markers" value={settings.restartEach} disabled={readOnly} onChange={(event) => onChange({ restartEach: event.target.value as CitationSettings['restartEach'] })}>
              <option value="book">Through the whole book</option>
              <option value="chapter">From 1 in each chapter</option>
            </select>
          </label>
        </>
      ) : null}
      <label>
        <span>Bibliography lists</span>
        <select aria-label="Bibliography lists" value={settings.bibliographyScope} disabled={readOnly} onChange={(event) => onChange({ bibliographyScope: event.target.value as CitationSettings['bibliographyScope'] })}>
          <option value="cited">The sources cited</option>
          <option value="all">Every source in the library</option>
        </select>
      </label>
      <label>
        <span>In order of</span>
        <select aria-label="Bibliography order" value={settings.bibliographySort} disabled={readOnly} onChange={(event) => onChange({ bibliographySort: event.target.value as CitationSettings['bibliographySort'] })}>
          <option value="author">Author, A to Z</option>
          <option value="citation">First citation in the book</option>
        </select>
      </label>
      <label>
        <span>Heading</span>
        <input aria-label="Bibliography heading" value={settings.bibliographyHeading} disabled={readOnly} placeholder={bibliographyHeadingOf({ ...settings, bibliographyHeading: '' })} onChange={(event) => onChange({ bibliographyHeading: event.target.value })} />
      </label>
    </div>
  );
}

function Preview({
  file,
  readOnly,
  onUpdate,
  documentId,
}: {
  file: ProjectFile;
  readOnly: boolean;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  documentId: string | null;
}) {
  const settings = citationSettingsOf(file);
  const occurrences = occurrencesIn(file, documentId);
  // The page in the book that prints this list (addendum 43 §8): the back
  // matter's bibliography, made from the library unless it was told not to be.
  const page = partsOf(file).find((part) => part.kind === 'bibliography') ?? null;
  const notes = citationNotes(file, occurrences);
  const entries = referenceBibliography(file, occurrences);
  return (
    <div className="refs-preview">
      <section aria-label="Notes">
        <h4>{usesFootnotes(settings) ? 'Notes, in order' : 'Citations in the text, in order'}</h4>
        {occurrences.length === 0 ? <p className="muted small">Nothing cited yet.</p> : null}
        <ol className="refs-notes">
          {usesFootnotes(settings)
            ? notes.map((note, index) => (
                <li key={`${note.occurrence.key}-${index}`}>
                  <sup>{note.marker}</sup> <InlineText text={note.text} />
                </li>
              ))
            : occurrences.map((occurrence, index) => (
                <li key={`${occurrence.key}-${index}`}>
                  <InlineText text={citationInText(file, occurrence)} />
                </li>
              ))}
        </ol>
      </section>
      <section aria-label="Bibliography">
        <h4>{bibliographyHeadingOf(settings)}</h4>
        <p className="muted small refs-in-book">
          {documentId !== null ? (
            'In the document: put a Bibliography where it goes from References on the ribbon, and it lists these.'
          ) : page === null ? (
            <>
              Not in the book yet.{' '}
              <button type="button" className="ghost small" disabled={readOnly} onClick={() => onUpdate((current) => addPart(current, 'bibliography').file)}>
                Add it to the back matter
              </button>
            </>
          ) : bibliographyOf(page).fromLibrary ? (
            'In the book: the bibliography page in the back matter prints this list, and Layout sets the notes at the foot of each page.'
          ) : (
            'The bibliography page in the back matter is set to print its own typed sources instead. Turn on From the References library there to print this list.'
          )}
        </p>
        {entries.length === 0 ? <p className="muted small">The bibliography lists sources once they are cited{settings.bibliographyScope === 'all' ? ', and every source in the library' : ''}.</p> : null}
        <ul className="refs-bibliography">
          {entries.map((entry) => (
            <li key={entry.reference.id}>
              <InlineText text={entry.text} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
