'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Starting a room (addendum 07 §5, §33).
 *
 * The project is chosen on purpose: a **new project made for the room**, or a
 * **project brought from VC Writer** as its project file. The account's other
 * projects (mostly what the Notes app made) are not offered.
 *
 * No seat count is asked for: the room's fee covers the showrunner and one
 * other person, and each person after that is an extra seat (§24).
 */

const FORMATS: { value: string; label: string }[] = [
  { value: 'screenplay', label: 'Screenplay' },
  { value: 'series', label: 'Series or episodic' },
  { value: 'stage_play', label: 'Stage play' },
  { value: 'short_form', label: 'Short form (commercials, web, social)' },
  { value: 'novel', label: 'Novel' },
  { value: 'short_story', label: 'Short stories or a collection' },
  { value: 'instructional', label: 'Instructional book' },
];

/** Bigger than this will not get through the upload. */
const MAX_BYTES = 4 * 1024 * 1024;

export function StartRoom() {
  const router = useRouter();
  const [how, setHow] = useState<'new' | 'bring'>('new');
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('screenplay');
  const [upload, setUpload] = useState<{ name: string; data: unknown; title: string } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async (file: File | undefined) => {
    setError(null);
    setUpload(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('That file is too large to bring in here (over 4 MB). Remove large pictures from it in VC Writer and save it again.');
      return;
    }
    try {
      const data = JSON.parse(await file.text()) as { project?: { title?: string } };
      if (!data || typeof data !== 'object' || !data.project) throw new Error('not a project');
      setUpload({ name: file.name, data, title: data.project.title ?? file.name.replace(/\.vcw$/i, '') });
    } catch {
      setError('That is not a VC Writer project file. In VC Writer, use File → Save as… to save the project’s .vcw file.');
    }
  };

  const ready = how === 'new' ? title.trim().length > 0 : upload !== null;

  const start = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(how === 'new' ? { newProject: { title: title.trim(), format }, name } : { upload: upload!.data, name }),
    });
    const body = (await response.json().catch(() => ({}))) as { room?: { id: string }; error?: string };
    setBusy(false);
    if (!response.ok || !body.room) {
      setError(body.error ?? (response.status === 413 ? 'That file is too large to bring in here.' : 'The room could not be started.'));
      return;
    }
    router.push(`/rooms/${body.room.id}`);
  };

  return (
    <div className="room-stack start-room">
      <div className="start-room-choices" role="radiogroup" aria-label="Which project the room is for">
        <label className={how === 'new' ? 'start-room-choice on' : 'start-room-choice'}>
          <input type="radio" name="how" checked={how === 'new'} onChange={() => setHow('new')} />
          <span>
            <strong>Start a new project for the room</strong>
            <span className="small block muted">An empty script the room writes together.</span>
          </span>
        </label>
        <label className={how === 'bring' ? 'start-room-choice on' : 'start-room-choice'}>
          <input type="radio" name="how" checked={how === 'bring'} onChange={() => setHow('bring')} />
          <span>
            <strong>Bring a project from VC Writer</strong>
            <span className="small block muted">A script you already have in the desktop app, as its project file (.vcw).</span>
          </span>
        </label>
      </div>

      {how === 'new' ? (
        <>
          <label className="field">
            <span>Project title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled" maxLength={200} />
          </label>
          <label className="field">
            <span>Format</span>
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              {FORMATS.map((one) => (
                <option key={one.value} value={one.value}>
                  {one.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="field">
            <span>Project file</span>
            <input type="file" accept=".vcw,application/json" onChange={(event) => void read(event.target.files?.[0])} />
          </label>
          <p className="small muted">
            In VC Writer, open the project and use <strong>File → Save as…</strong> to put its .vcw file somewhere you can find it, then choose it here. The
            room works on a copy in your account; the file on your computer is not changed.
          </p>
          {upload ? (
            <p className="small">
              Ready: <strong>{upload.title}</strong> ({upload.name})
            </p>
          ) : null}
        </>
      )}

      <label className="field">
        <span>Room name (optional)</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={how === 'new' ? title || 'The project’s title' : upload?.title || 'The project’s title'}
          maxLength={120}
        />
      </label>
      <p>
        <button type="button" className="button" disabled={busy || !ready} onClick={() => void start()}>
          {busy ? 'Starting…' : 'Start the room'}
        </button>
      </p>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
