'use client';

import { useState } from 'react';
import { CAP_CAVEAT, CAP_MOST, describeSpend, money, type CapStanding } from '@vcwriter/domain';

/**
 * What the room's AI has cost, and the showrunner's two controls over it
 * (addendum 07 §14, stage 13).
 *
 * **Everybody in the room sees the number; only the showrunner changes it.** A
 * cap somebody can hit without seeing it coming is the failure this stage was
 * built to fix, so a writer who cannot ask for a reading still reads the month.
 *
 * **The caveat sits next to the control, not in a help page.** A cap is checked
 * before a reading and priced after one, so a room can pass it by one reading —
 * and the place that has to be read is where somebody is about to set a number
 * they will later hold the product to.
 *
 * The two controls are different statements and are drawn as two: the switch
 * says *this room does not use AI*, and the cap says *not past here this
 * month*. A cap of nothing is a real setting, which is why it is offered.
 */

const DOLLARS = [null, 0, 500, 2000, 5000, 10_000, 25_000] as const;

const label = (cents: number | null): string =>
  cents === null ? 'No cap' : cents === 0 ? 'Nothing until next month' : money(cents);

export function Spend({
  roomId,
  standing,
  enabled,
  yours,
}: {
  roomId: string;
  standing: CapStanding;
  enabled: boolean;
  /** Whether the controls are this person's. The number is everybody's. */
  yours: boolean;
}) {
  const [now, setNow] = useState(standing);
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (body: { enabled?: boolean; capCents?: number | null }) => {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/rooms/${roomId}/ai`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);

    const said = (await response.json().catch(() => ({}))) as {
      error?: string;
      enabled?: boolean;
      spend?: CapStanding;
    };
    if (!response.ok) {
      setError(said.error ?? 'That could not be changed.');
      return;
    }
    if (said.spend) setNow(said.spend);
    if (said.enabled !== undefined) setOn(said.enabled);
  };

  return (
    <div className="room-spend">
      <p className="lede">{describeSpend(now)}</p>

      {/* A bar only where there is something to be a fraction of. Drawn past
          full where the month went past the cap, because the overshoot is the
          one honest thing about a cap and hiding it would make it look broken. */}
      {now.capCents !== null && now.capCents > 0 ? (
        <div
          className="spend-bar"
          role="img"
          aria-label={`${Math.round((now.through ?? 0) * 100)}% of the month’s cap`}
        >
          <span
            className={now.reached ? 'spend-fill reached' : 'spend-fill'}
            style={{ width: `${Math.min(100, Math.round((now.through ?? 0) * 100))}%` }}
          />
        </div>
      ) : null}

      {yours ? (
        <>
          <div className="spend-controls">
            <label>
              <span className="small muted">Cap this month</span>
              <select
                disabled={busy}
                value={now.capCents === null ? 'none' : String(now.capCents)}
                onChange={(event) =>
                  change({
                    capCents: event.target.value === 'none' ? null : Number(event.target.value),
                  })
                }
              >
                {DOLLARS.map((cents) => (
                  <option key={cents === null ? 'none' : cents} value={cents === null ? 'none' : cents}>
                    {label(cents)}
                  </option>
                ))}
                {/* Whatever it is already, where somebody set a number this
                    list does not offer. A control that silently re-rounds a
                    setting is worse than one with an odd entry in it. */}
                {now.capCents !== null && !DOLLARS.includes(now.capCents as never) ? (
                  <option value={now.capCents}>{money(now.capCents)}</option>
                ) : null}
              </select>
            </label>

            <button type="button" className="button secondary small room-act" disabled={busy} onClick={() => change({ enabled: !on })}>
              {on ? 'Turn AI off for this room' : 'Turn AI on for this room'}
            </button>
          </div>

          <p className="small muted">
            {CAP_CAVEAT} The largest cap here is {money(CAP_MOST)}.
          </p>
        </>
      ) : (
        <p className="small muted">The showrunner sets what this room spends.</p>
      )}

      {error ? <p className="small error">{error}</p> : null}
    </div>
  );
}
