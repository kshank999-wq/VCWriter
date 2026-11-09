'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Starting a room over a project you own (§5).
 *
 * No seat count is asked for: the room's fee covers the showrunner and one
 * other person, and each person after that is an extra seat (addendum 07 §24).
 */
export function StartRoom({ projects }: { projects: { id: string; title: string }[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    const body = (await response.json()) as { room?: { id: string }; error?: string };
    setBusy(false);
    if (!response.ok || !body.room) {
      setError(body.error ?? 'The room could not be started.');
      return;
    }
    router.push(`/rooms/${body.room.id}`);
  };

  return (
    <div className="stack">
      <label className="field">
        <span>Project</span>
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </label>
      <p>
        <button type="button" className="button" disabled={busy || !projectId} onClick={() => void start()}>
          {busy ? 'Starting…' : 'Start the room'}
        </button>
      </p>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
