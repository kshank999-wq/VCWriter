import { useState } from 'react';
import {
  compareRuns,
  describeComparison,
  describeRun,
  findRun,
  holdings,
  recordStep,
  removeRun,
  replayRun,
  runsOf,
  startPoints,
  startRun,
  stepBack,
  updateRun,
  type NarrativeElementId,
  type ProjectFile,
  type SimulationRunId,
} from '@vcwriter/domain';

/**
 * The playthrough simulator (addendum 18 stage 7 — §13).
 *
 * **It decides nothing.** What is offered here, why something is not, what a
 * choice changes and where it leads are all `evaluate` and `choose` from stage
 * 2 — the same two functions the map colours with and the validator reads. A
 * simulator that answered differently from the picture beside it would be
 * worse than none, because a designer would have to work out which to believe.
 *
 * A path stores **the choices and never the states**, so replaying an old one
 * against today's graph is the point rather than a compromise: where it stops
 * working is where the design moved under it.
 */
export function NarrativePlayPanel({
  file,
  onUpdate,
  onClose,
  onGoTo,
  onWalking,
}: {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
  /** Select the node the player is standing at, so the board follows. */
  onGoTo?(elementId: NarrativeElementId): void;
  /**
   * Which path is being walked, so the board can draw it — §9's *path
   * preview*. Told on every change of run rather than read from here, because
   * the board owns what the board draws.
   */
  onWalking?(runId: SimulationRunId | null): void;
}) {
  const [runId, setRunId] = useState<SimulationRunId | null>(null);
  const [startAt, setStartAt] = useState<string>('');
  const [against, setAgainst] = useState<string>('');
  /**
   * Why the last press did nothing.
   *
   * A move the rules refuse did not happen, so it is not written into the
   * path — which leaves the designer pressing a button and watching nothing,
   * unless the reason is said. This is where it is said.
   */
  const [refused, setRefused] = useState<string[]>([]);

  const runs = runsOf(file);
  const run = runId ? findRun(file, runId) : null;
  const played = run ? replayRun(file, run) : null;
  const other = against ? findRun(file, against as SimulationRunId) : null;

  /**
   * Take a choice.
   *
   * The refusal is read from the file in hand and the change is made as a
   * mutation of whatever is current — the two go through `recordStep` twice
   * rather than once, because it is pure, and because catching a value on its
   * way out of a state updater depends on *when* the host chooses to run it.
   * A reason shown a moment late is nothing; a reason never shown because the
   * updater ran after the handler is a button that does nothing.
   */
  const take = (choiceId: Parameters<typeof recordStep>[2]): void => {
    if (!run) return;
    const tried = recordStep(file, run.id, choiceId);
    setRefused(tried.refused.map((one) => one.says));
    if (tried.refused.length === 0) {
      onUpdate((current) => recordStep(current, run.id, choiceId).file);
    }
  };

  const begin = (): void => {
    let made: SimulationRunId | null = null;
    onUpdate((current) => {
      const next = startRun(current, { startedAt: (startAt || null) as NarrativeElementId | null });
      if (!next) return current;
      made = next.run.id;
      return next.file;
    });
    if (made) {
      setRunId(made);
      onWalking?.(made);
    }
  };

  const openRun = (id: SimulationRunId | null): void => {
    setRunId(id);
    setRefused([]);
    onWalking?.(id);
  };

  return (
    <aside className="narrmap-play" aria-label="Playthrough">
      <header>
        <h3>Play it</h3>
        <button
          type="button"
          className="ghost small"
          aria-label="Close the playthrough"
          onClick={() => {
            onWalking?.(null);
            onClose();
          }}
        >
          ✕
        </button>
      </header>

      {played && run ? (
        <>
          <div className="rule-row">
            <input
              value={run.name}
              placeholder="Name this path"
              aria-label="What this path is called"
              onChange={(event) => onUpdate((current) => updateRun(current, run.id, { name: event.target.value }))}
            />
            <button type="button" className="ghost small" onClick={() => openRun(null)}>
              Done
            </button>
          </div>

          {/* Where the player is standing. The node's own note is the prose a
              designer wrote for it, so it is what they read while testing. */}
          <h4>{played.at?.name || 'Nowhere — the node it started at has gone'}</h4>
          {played.at?.note ? <p className="small">{played.at.note}</p> : null}
          {played.at && onGoTo ? (
            <button type="button" className="ghost small" onClick={() => onGoTo(played.at!.id)}>
              Show it on the board
            </button>
          ) : null}

          {played.brokenAt !== null ? (
            <p className="play-broken">
              This path stops working at step {played.brokenAt + 1}:{' '}
              {played.steps[played.brokenAt]?.refused.map((one) => one.says).join('; ')}
            </p>
          ) : null}

          {refused.length > 0 ? <p className="play-why">You cannot go that way: {refused.join('; ')}</p> : null}

          <h4>Offered here</h4>
          {played.situation && played.situation.choices.length > 0 ? (
            <ul className="play-choices">
              {played.situation.choices.map((offer) => (
                <li key={offer.choice.id as string}>
                  <button
                    type="button"
                    className={offer.available ? 'tool' : 'tool is-blocked'}
                    disabled={!offer.available}
                    onClick={() => take(offer.choice.id)}
                  >
                    {offer.choice.name || offer.choice.text || 'an unnamed choice'}
                  </button>
                  {/* §13's *explain why a choice is blocked*, in the sentence
                      the domain built rather than a greyed control and silence. */}
                  {offer.available ? null : (
                    <span className="play-why muted small">{offer.blockedBy.map((one) => one.says).join('; ')}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Nothing is offered here. The path ends.</p>
          )}

          <h4>Carrying</h4>
          <ul className="play-holdings">
            {holdings(file, played.state).map((one) => (
              <li key={one.subject} className={one.moved ? 'moved' : ''}>
                <span>{one.subject}</span>
                <span>{one.value}</span>
              </li>
            ))}
          </ul>
          {holdings(file, played.state).length === 0 ? (
            <p className="muted small">Nothing is defined to carry yet.</p>
          ) : null}

          <h4>The path</h4>
          <ol className="play-path">
            {played.steps.map((step, index) => (
              <li key={index} className={step.refused.length > 0 ? 'broke' : ''}>
                <span>{step.choice?.name || 'a choice that has gone'}</span>
                {step.log.length > 0 ? (
                  <span className="muted small"> — {step.log.map((one) => one.says).join(', ')}</span>
                ) : null}
              </li>
            ))}
          </ol>
          {run.steps.length > 0 ? (
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                setRefused([]);
                onUpdate((current) => stepBack(current, run.id));
              }}
            >
              ← Step back
            </button>
          ) : (
            <p className="muted small">Nothing walked yet.</p>
          )}
        </>
      ) : (
        <>
          <div className="rule-row">
            <select
              value={startAt}
              aria-label="Where to start"
              onChange={(event) => setStartAt(event.target.value)}
            >
              <option value="">Start where the player starts</option>
              {startPoints(file).map((one) => (
                <option key={one.id as string} value={one.id as string}>
                  {one.name || 'an unnamed node'}
                </option>
              ))}
            </select>
            <button type="button" className="tool" onClick={begin}>
              ▶ Walk it
            </button>
          </div>
          <p className="muted small">
            Every path you walk is kept, so you can come back to it after the game has changed.
          </p>

          <h4>Kept paths</h4>
          {runs.length === 0 ? <p className="muted small">None yet.</p> : null}
          <ul className="play-runs">
            {runs.map((one) => (
              <li key={one.id as string}>
                <button type="button" className="link" onClick={() => openRun(one.id)}>
                  {one.name || 'An unnamed path'}
                </button>
                <span className="muted small">{describeRun(file, one)}</span>
                <button
                  type="button"
                  className="ghost small"
                  aria-label={`Remove ${one.name || 'this path'}`}
                  onClick={() => onUpdate((current) => removeRun(current, one.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {runs.length > 1 ? (
            <>
              <h4>Side by side</h4>
              <div className="rule-row">
                <select value={against} aria-label="Compare the first path with" onChange={(event) => setAgainst(event.target.value)}>
                  <option value="">Pick a path…</option>
                  {runs.slice(1).map((one) => (
                    <option key={one.id as string} value={one.id as string}>
                      {one.name || 'An unnamed path'}
                    </option>
                  ))}
                </select>
              </div>
              {other ? <Comparison file={file} leftId={runs[0]!.id} rightId={other.id} /> : null}
            </>
          ) : null}
        </>
      )}
    </aside>
  );
}

/**
 * Two paths, and what they cost.
 *
 * Where they part and what the player is left holding — the two questions a
 * branching designer has. The middle of the walk is not compared, because two
 * routes through a hub can differ in twelve places and mean nothing by it.
 */
function Comparison({
  file,
  leftId,
  rightId,
}: {
  file: ProjectFile;
  leftId: SimulationRunId;
  rightId: SimulationRunId;
}) {
  const left = findRun(file, leftId);
  const right = findRun(file, rightId);
  if (!left || !right) return null;
  const comparison = compareRuns(file, left, right);

  return (
    <div className="play-compare">
      <p className="small">{describeComparison(comparison)}</p>
      {comparison.differences.length > 0 ? (
        <ul className="play-holdings">
          {comparison.differences.map((one) => (
            <li key={one.subject}>
              <span>{one.subject}</span>
              <span>
                {one.left} / {one.right}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
