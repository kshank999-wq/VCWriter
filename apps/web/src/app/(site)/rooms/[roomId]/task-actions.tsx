'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AssignmentState, SubmissionState, TaskStatus } from '@vcwriter/domain';

/**
 * The decisions on a task, shown only where this person may make them
 * (addendum 07 §29; spec v1.1 §4.1). The routes check again, and the database
 * after them: these buttons are a convenience, not the rule.
 */
export function TaskActions({
  roomId,
  status,
  showrunner,
  mine,
  assignmentId,
  submissionId,
  submissionState,
  hasSubmissions,
  editorHref,
  trayHref,
}: {
  roomId: string;
  status: TaskStatus;
  showrunner: boolean;
  /** The person looking is the one the task is for. */
  mine: boolean;
  assignmentId: string | null;
  /** The latest thing sent for it. */
  submissionId: string | null;
  submissionState: SubmissionState | null;
  hasSubmissions: boolean;
  editorHref: string;
  trayHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [returning, setReturning] = useState(false);

  const call = async (url: string, body: unknown): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const said = (await response.json().catch(() => ({}))) as { error?: string };
        setError(said.error ?? 'That did not go through.');
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };
  const moveTask = (to: AssignmentState) =>
    assignmentId ? call(`/api/rooms/${roomId}/assignments/${assignmentId}`, { to }) : Promise.resolve(false);
  const decide = (state: SubmissionState, reply = '') =>
    submissionId ? call(`/api/rooms/${roomId}/submissions/${submissionId}`, { state, reply }) : Promise.resolve(false);

  const reviewable = submissionState === 'submitted' || submissionState === 'in_review';
  const closed = status === 'completed' || status === 'cancelled';
  const buttons: React.ReactNode[] = [];

  if (mine && !showrunner) {
    if (status === 'assigned' && assignmentId) {
      buttons.push(
        <button key="start" type="button" className="button small" disabled={busy} onClick={() => void moveTask('in_progress')}>
          Start draft
        </button>,
      );
    }
    if (status === 'assigned' || status === 'in_progress' || status === 'needs_revision') {
      buttons.push(
        <a key="open" className="button small secondary" href={editorHref}>
          {status === 'needs_revision' ? 'Revise in VC Writer' : 'Open in VC Writer'}
        </a>,
      );
    }
  }

  if (showrunner) {
    if (reviewable) {
      buttons.push(
        <button key="approve" type="button" className="button small" disabled={busy} onClick={() => void decide('approved')}>
          Approve
        </button>,
        <button key="return" type="button" className="button small secondary" disabled={busy} onClick={() => setReturning(true)}>
          Return with notes
        </button>,
        <button key="reject" type="button" className="button small secondary" disabled={busy} onClick={() => void decide('rejected')}>
          Not taken
        </button>,
      );
    }
    if (status === 'approved') {
      buttons.push(
        <a key="integrate" className="button small" href={trayHref}>
          Integrate into the master
        </a>,
      );
    }
    if (assignmentId && !closed) {
      buttons.push(
        <button key="close" type="button" className="button small secondary" disabled={busy} onClick={() => void moveTask('done')}>
          Close task
        </button>,
        <button key="cancel" type="button" className="button small secondary" disabled={busy} onClick={() => void moveTask('cancelled')}>
          Cancel task
        </button>,
      );
    }
    if (assignmentId && closed) {
      buttons.push(
        <button
          key="reopen"
          type="button"
          className="button small"
          disabled={busy}
          onClick={() => void moveTask(hasSubmissions ? 'in_progress' : 'assigned')}
        >
          Reopen
        </button>,
      );
    }
  }

  return (
    <div className="tk-actions">
      {buttons.length > 0 ? <div className="tk-buttons">{buttons}</div> : <p className="small muted">Nothing for you to do on this task right now.</p>}
      {returning ? (
        <div className="tk-return">
          <label>
            <span className="small">Notes for the writer</span>
            <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} autoFocus />
          </label>
          <span className="tk-buttons">
            <button type="button" className="button small secondary" onClick={() => setReturning(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="button small"
              disabled={busy || !notes.trim()}
              onClick={() =>
                void decide('revision_requested', notes.trim()).then((ok) => {
                  if (ok) {
                    setReturning(false);
                    setNotes('');
                  }
                })
              }
            >
              Send back
            </button>
          </span>
          <p className="small muted">The writer gets these notes with the version they sent. It stays as it was sent.</p>
        </div>
      ) : null}
      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Print the report the browser's own way, which also saves it as a PDF. */
export function PrintButton() {
  return (
    <button type="button" className="button small" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
