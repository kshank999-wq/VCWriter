'use client';

import { useState } from 'react';
import {
  READING_CAVEAT,
  type Comparison,
  type Curatable,
  type Duplicates,
  type Submission,
} from '@vcwriter/domain';

/**
 * Asking the room's AI for a reading (addendum 07 §14, stage 12).
 *
 * **A reading is shown; it is never applied.** Nothing on this page writes
 * anything into anybody's draft, and there is no button that could — what comes
 * back has no field that could carry a rewrite, and the caveat sits next to the
 * answer rather than in a help page, because that is where somebody about to
 * treat it as a decision will be looking.
 */

export function Assist({
  roomId,
  available,
  reason,
  passes,
  scenes,
  nameOf,
}: {
  roomId: string;
  available: boolean;
  /** Why not, where not — said plainly rather than the control just missing. */
  reason: string | null;
  /** The script contributions there are to compare. */
  passes: Submission[];
  /** The scenes each pass offers, by submission. */
  scenes: Record<string, Curatable[]>;
  nameOf: (userId: string) => string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [scene, setScene] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicates | null>(null);

  if (!available) {
    return <p className="small muted">{reason ?? 'AI readings are not available here.'}</p>;
  }

  const ask = async (body: Record<string, unknown>, what: string) => {
    setBusy(what);
    setError(null);
    const response = await fetch(`/api/rooms/${roomId}/assist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(null);

    const said = (await response.json().catch(() => ({}))) as {
      error?: string;
      comparison?: Comparison;
      duplicates?: Duplicates;
    };
    if (!response.ok) {
      setError(said.error ?? 'The reading failed.');
      return;
    }
    if (said.comparison) setComparison(said.comparison);
    if (said.duplicates) setDuplicates(said.duplicates);
  };

  // The scenes both chosen passes have, which is the only sensible thing to
  // compare: a scene one of them does not contain has nothing to compare to.
  const shared = (scenes[first] ?? []).filter(
    (one) =>
      one.kind === 'scene' && (scenes[second] ?? []).some((other) => other.kind === 'scene' && other.id === one.id),
  );

  return (
    <>
      <div className="assist">
        <label className="field">
          <span>Compare</span>
          <select value={first} onChange={(event) => setFirst(event.target.value)}>
            <option value="">A pass…</option>
            {passes.map((one) => (
              <option key={one.id} value={one.id}>
                {nameOf(one.authorId)} — {one.note.trim() || 'A pass on the script'}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>With</span>
          <select value={second} onChange={(event) => setSecond(event.target.value)}>
            <option value="">Another…</option>
            {passes
              .filter((one) => one.id !== first)
              .map((one) => (
                <option key={one.id} value={one.id}>
                  {nameOf(one.authorId)} — {one.note.trim() || 'A pass on the script'}
                </option>
              ))}
          </select>
        </label>

        <label className="field">
          <span>At</span>
          <select value={scene} onChange={(event) => setScene(event.target.value)} disabled={shared.length === 0}>
            <option value="">{shared.length === 0 ? 'No scene in both' : 'A scene…'}</option>
            {shared.map((one) => (
              <option key={one.id} value={one.id}>
                {one.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="button"
          disabled={busy !== null || !first || !second || !scene}
          onClick={() =>
            void ask(
              { reading: 'compare', firstSubmissionId: first, secondSubmissionId: second, recordId: scene },
              'compare',
            )
          }
        >
          {busy === 'compare' ? 'Reading…' : 'Read them side by side'}
        </button>

        <button
          type="button"
          className="button secondary"
          disabled={busy !== null}
          onClick={() => void ask({ reading: 'duplicates' }, 'duplicates')}
        >
          {busy === 'duplicates' ? 'Reading…' : 'Find ideas said twice'}
        </button>
      </div>

      {comparison ? (
        <article className="reading">
          <p className="lede">{comparison.bothTrying}</p>
          <ul className="reading-points">
            {comparison.points.map((point, index) => (
              <li key={`${point.about}-${index}`}>
                <strong>{point.about}</strong>
                <span className="block small">
                  <em>First:</em> {point.inFirst}
                </span>
                <span className="block small">
                  <em>Second:</em> {point.inSecond}
                </span>
                {point.favours !== 'neither' ? (
                  <span className="block small muted">Leans to the {point.favours}.</span>
                ) : null}
              </li>
            ))}
          </ul>

          {comparison.onlyInFirst.length > 0 || comparison.onlyInSecond.length > 0 ? (
            <div className="reading-only">
              {comparison.onlyInFirst.length > 0 ? (
                <p className="small">
                  <strong>Only in the first:</strong> {comparison.onlyInFirst.join('; ')}
                </p>
              ) : null}
              {comparison.onlyInSecond.length > 0 ? (
                <p className="small">
                  <strong>Only in the second:</strong> {comparison.onlyInSecond.join('; ')}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="small muted">{READING_CAVEAT}</p>
        </article>
      ) : null}

      {duplicates ? (
        <article className="reading">
          {duplicates.groups.length === 0 ? (
            <p className="lede">Nothing said twice — every idea here is its own.</p>
          ) : (
            <ul className="reading-points">
              {duplicates.groups.map((group, index) => (
                <li key={`${group.theSameIdea}-${index}`}>
                  <strong>{group.theSameIdea}</strong>
                  <span className="block small muted">
                    {group.itemIds.length} ideas say it
                    {group.butDifferent ? ` · ${group.butDifferent}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="small muted">{READING_CAVEAT}</p>
        </article>
      ) : null}

      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
