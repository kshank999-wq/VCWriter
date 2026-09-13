'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CAPTURE_CATEGORIES,
  CAPTURE_CATEGORY_NAMES,
  mayStillEdit,
  type CaptureCategory,
  type CaptureItem,
} from '@vcwriter/domain';

/**
 * Reviewing what the phone caught (addendum 09 §7, stage 3).
 *
 * §7's list, and its restraint: the notes for this project, filtered by the
 * five categories, readable, correctable, and deletable with a confirmation.
 * **No research hierarchy** — it says so itself, and §1 is why it can afford
 * not to have one: deciding where a note goes happens at the desk, so this
 * screen never needs a folder in it.
 *
 * **A note the desktop has already filed is shown and not edited.** It is the
 * trail behind a real research item now, and §9 wants the phone to keep a
 * reviewable copy after syncing rather than appearing to lose it — so it is
 * here, marked, with its controls gone. `mayStillEdit` decides, the route
 * refuses, and migration 0042 refuses underneath that.
 */

export function NotesReview({ projectId }: { projectId: string | null }) {
  const [notes, setNotes] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [only, setOnly] = useState<CaptureCategory | 'all'>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/notes${projectId ? `?project=${projectId}` : ''}`, {
      cache: 'no-store',
    });
    const body = (await response.json().catch(() => ({}))) as { notes?: CaptureItem[]; error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? 'Your notes could not be read.');
      return;
    }
    setNotes(body.notes ?? []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (note: CaptureItem) => {
    const text = draft.trim();
    if (text.length === 0) return;
    const response = await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rawText: text }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? 'That change could not be saved.');
      return;
    }
    setEditing(null);
    await load();
  };

  const remove = async (note: CaptureItem) => {
    const response = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setConfirming(null);
    if (!response.ok) {
      setError(body.error ?? 'That note could not be deleted.');
      return;
    }
    await load();
  };

  const shown = only === 'all' ? notes : notes.filter((note) => note.category === only);

  return (
    <section className="notes-review">
      <div className="notes-filters" role="group" aria-label="Show">
        <button
          type="button"
          className={only === 'all' ? 'notes-chip selected' : 'notes-chip'}
          onClick={() => setOnly('all')}
        >
          All
        </button>
        {CAPTURE_CATEGORIES.map((one) => (
          <button
            key={one}
            type="button"
            className={only === one ? 'notes-chip selected' : 'notes-chip'}
            onClick={() => setOnly(one)}
          >
            {CAPTURE_CATEGORY_NAMES[one]}
          </button>
        ))}
      </div>

      {error ? <p className="error small">{error}</p> : null}

      {loading ? (
        <p className="muted">Looking…</p>
      ) : shown.length === 0 ? (
        <p className="muted">
          {notes.length === 0 ? 'Nothing captured for this project yet.' : 'Nothing under that one.'}
        </p>
      ) : (
        <ul className="notes-list">
          {shown.map((note) => {
            const open = editing === (note.id as string);
            const changeable = mayStillEdit(note.status);
            return (
              <li key={note.id} className={changeable ? 'notes-item' : 'notes-item filed'}>
                <div className="notes-item-head">
                  <strong>{note.subjectName ?? CAPTURE_CATEGORY_NAMES[note.category ?? 'idea']}</strong>
                  <span className="muted small">{new Date(note.capturedAt).toLocaleDateString()}</span>
                </div>

                {open ? (
                  <>
                    <textarea
                      aria-label="Correct this note"
                      value={draft}
                      rows={5}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <div className="notes-item-actions">
                      <button type="button" className="button" onClick={() => void save(note)}>
                        Save
                      </button>
                      <button type="button" className="button secondary" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="notes-item-text">{note.rawText}</p>
                    {changeable ? (
                      <div className="notes-item-actions">
                        {confirming === (note.id as string) ? (
                          // §7 asks for an appropriate confirmation, and the
                          // honest one says what goes: the note, not the work
                          // it became, because it never became any.
                          <>
                            <span className="muted small">Delete this note?</span>
                            <button type="button" className="button danger" onClick={() => void remove(note)}>
                              Delete
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => setConfirming(null)}
                            >
                              Keep
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => {
                                setEditing(note.id as string);
                                setDraft(note.rawText);
                              }}
                            >
                              Correct
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => setConfirming(note.id as string)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="muted small">Filed in VC Writer — change it there.</p>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
