'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Starting a room over a project you own (§5).
 *
 * The seat count is asked for here rather than left to a default, because it
 * is what the subscription covers and a showrunner who has bought four seats
 * should not discover the number on an invoice (§14).
 */
export function StartRoom({ projects }: { projects: { id: string; title: string }[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [seats, setSeats] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, includedSeats: seats }),
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
      <label className="field">
        <span>Seats included</span>
        <input
          type="number"
          min={1}
          max={200}
          value={seats}
          onChange={(event) => setSeats(Math.max(1, Number(event.target.value) || 1))}
        />
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
