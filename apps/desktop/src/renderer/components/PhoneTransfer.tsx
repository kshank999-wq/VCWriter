import { useCallback, useEffect, useState } from 'react';
import {
  captureKeyName,
  captureTitle,
  phoneNoteGroups,
  transferNotes,
  type CaptureItem,
  type PhoneProjectName,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';

/**
 * **The phone's notes by hand, and the archive** (addendum 27 §25, from Ken:
 * *it will show you the notes available on the phone, because if the projects
 * don't match perfectly, it's not going to really work automatically
 * transferring. So you'll be able to see which note groups are on the phone.
 * You can select the project and it will sync and transfer those. Once they're
 * transferred, those notes need to go into an archive… And you can also delete
 * it from the actual desktop app*).
 *
 * Two panels beside the inbox in Research ▸ Mobile App. **On the phone** is
 * every note still waiting that this project's inbox does not show, grouped
 * by the phone project it was said in, each group with one press that files
 * it here (`transferNotes`). **Archive** is what has been filed or set aside,
 * to read back or delete.
 *
 * No bridge means no phone — the tests and a build without the cloud — which
 * is an empty list rather than an error, `usePhoneNotes`' rule.
 */

const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

export function PhoneGroups({
  file,
  onUpdate,
  onTransferred,
}: {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** After a group lands, so the inbox and the archive can read again. */
  onTransferred?: () => void;
}) {
  const [notes, setNotes] = useState<CaptureItem[]>([]);
  const [projects, setProjects] = useState<PhoneProjectName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (typeof window.vcwriter?.listPhoneNotes !== 'function') return;
    setLoading(true);
    const said = await window.vcwriter.listPhoneNotes();
    setLoading(false);
    if (!said.ok || !said.data) {
      setError(said.error ?? 'The phone’s notes could not be read');
      return;
    }
    setError(null);
    setNotes(said.data.notes);
    setProjects(said.data.projects);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = phoneNoteGroups(notes, projects, file.project.id as string);
  const format = file.project.format as ProjectFormat;

  const transfer = async (key: string, group: CaptureItem[], title: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      // Worked out before the update runs, so a second run cannot file twice.
      const result = transferNotes(file, group);
      onUpdate(() => result.file);
      let unrecorded = 0;
      for (const filed of result.filed) {
        const written = await window.vcwriter?.resolveCapture?.(filed);
        if (written && !written.ok) unrecorded += 1;
      }
      setDone(
        `${result.filed.length} note${result.filed.length === 1 ? '' : 's'} from “${title}” filed in this project and moved to the archive.` +
          (unrecorded ? ` ${unrecorded} could not be marked as transferred on the server, so they may show here again.` : ''),
      );
      if (open === key) setOpen(null);
      await load();
      onTransferred?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Those notes could not be transferred');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mobile-inbox phone-groups">
      <header className="mobile-inbox-head">
        <p className="muted small">
          Every note waiting on the phone that this project&rsquo;s inbox does not show, by the project it was
          dictated into. Transfer a group to file its notes here; they move to the Archive.
        </p>
        <button type="button" className="ghost small" onClick={() => void load()} disabled={loading}>
          {loading ? 'Looking…' : 'Refresh'}
        </button>
      </header>
      {error ? <p className="muted small mobile-inbox-error">{error}</p> : null}
      {done ? <p className="notice small" role="status">{done}</p> : null}

      {groups.length === 0 ? (
        <p className="muted empty-state">{loading ? 'Looking for notes…' : 'Nothing else waiting on the phone.'}</p>
      ) : (
        <ul className="phone-group-list">
          {groups.map((group) => {
            const key = group.projectId ?? 'none';
            return (
              <li key={key} className="phone-group">
                <div className="phone-group-head">
                  <button type="button" className="ghost phone-group-name" onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>
                    {open === key ? '▾' : '▸'} <strong>{group.title}</strong>
                    <span className="count muted">{group.notes.length}</span>
                  </button>
                  <button type="button" className="raised small" disabled={busy} onClick={() => void transfer(key, group.notes, group.title)}>
                    Transfer to this project
                  </button>
                </div>
                {open === key ? (
                  <ul className="mobile-list">
                    {group.notes.map((note) => (
                      <li key={note.id as string} className="mobile-note">
                        <div className="mobile-note-head">
                          <strong className="mobile-subject">
                            {captureKeyName(note.category ?? 'idea', format)}
                            {note.subjectName ? ` · ${note.subjectName}` : ''}
                          </strong>
                          <span className="muted small">{when(note.capturedAt)}</span>
                        </div>
                        <p className="mobile-text">{note.rawText || captureTitle(note)}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function NoteArchive({ file, refresh = 0 }: { file: ProjectFile; refresh?: number }) {
  const [notes, setNotes] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (typeof window.vcwriter?.listArchivedNotes !== 'function') return;
    setLoading(true);
    const said = await window.vcwriter.listArchivedNotes();
    setLoading(false);
    if (!said.ok || !said.data) {
      setError(said.error ?? 'The archive could not be read');
      return;
    }
    setError(null);
    setNotes(said.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refresh]);

  const remove = async (ids: string[], question: string) => {
    if (ids.length === 0 || !window.confirm(question)) return;
    const said = await window.vcwriter?.deleteCaptures?.(ids);
    if (said && !said.ok) {
      setError(said.error ?? 'Those notes could not be deleted');
      return;
    }
    setNotes((now) => now.filter((one) => !ids.includes(one.id as string)));
  };

  const format = file.project.format as ProjectFormat;

  return (
    <div className="mobile-inbox note-archive">
      <header className="mobile-inbox-head">
        <p className="muted small">
          Notes from the phone that have been filed or set aside. Their words are in the project already; deleting
          one here removes the phone&rsquo;s copy from your account.
        </p>
        <button type="button" className="ghost small" onClick={() => void load()} disabled={loading}>
          {loading ? 'Looking…' : 'Refresh'}
        </button>
        {notes.length > 0 ? (
          <button
            type="button"
            className="ghost small danger-text"
            onClick={() =>
              void remove(
                notes.map((one) => one.id as string),
                `Delete all ${notes.length} archived note${notes.length === 1 ? '' : 's'}? What they became in your projects stays.`,
              )
            }
          >
            Delete all
          </button>
        ) : null}
      </header>
      {error ? <p className="muted small mobile-inbox-error">{error}</p> : null}
      {notes.length === 0 ? (
        <p className="muted empty-state">{loading ? 'Looking…' : 'The archive is empty.'}</p>
      ) : (
        <ul className="mobile-list">
          {notes.map((note) => (
            <li key={note.id as string} className="mobile-note">
              <div className="mobile-note-head">
                <strong className="mobile-subject">
                  {captureKeyName(note.category ?? 'idea', format)}
                  {note.subjectName ? ` · ${note.subjectName}` : ''}
                </strong>
                <span className="muted small">
                  {note.status === 'approved' ? 'Filed' : 'Set aside'} {when(note.reviewedAt)}
                </span>
                <button
                  type="button"
                  className="ghost small"
                  aria-label="Delete this archived note"
                  onClick={() => void remove([note.id as string], 'Delete this archived note? What it became in your project stays.')}
                >
                  Delete
                </button>
              </div>
              <p className="mobile-text">{note.rawText || captureTitle(note)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
