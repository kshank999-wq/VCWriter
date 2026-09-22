import { useState } from 'react';
import {
  MINIMUM_VALID_SETUPS,
  addSetupPayoff,
  addSetupPoint,
  describePlace,
  findUnit,
  recordPayoff,
  removeSetupPoint,
  reopenPayoff,
  ref,
  deleteSetupPayoff,
  setSetupPayoffArchived,
  setupReadiness,
  setupsBoard,
  updateSetupPayoff,
  updateSetupPoint,
  type BeatId,
  type ProjectFile,
  type SetupPayoffId,
  type SetupStrength,
} from '@vcwriter/domain';

interface SetupsPanelProps {
  file: ProjectFile;
  currentBeatId: BeatId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /**
   * Go and look at the passage a point was tagged on. Absent in the popped-out
   * research window, which has no script beside it to go to.
   */
  onGoTo?(beatId: BeatId): void;
}

const STRENGTHS: readonly SetupStrength[] = ['planned', 'written', 'weak'];

/**
 * Setups & payoffs (spec §7.3, and the Setups & Payoffs spec §3).
 *
 * A payoff can be established in several places, so setups are a list, not a
 * field. Anything not yet delivered stays in Active — that list is the writer's
 * outstanding debt to the reader, which is the whole point of the feature.
 * Resolving and archiving keep every setup point and link, and both are
 * reversible.
 *
 * **The light and the count are on the list rather than inside each record**,
 * which is §10's requirement and the right one: a writer opening this wants to
 * know which payoffs are under-prepared, and a status they have to open twenty
 * records to find is a status nobody reads. The under-prepared sort first for
 * the same reason.
 *
 * Nothing here is stored. `setupReadiness` counts the setups that land *before*
 * the payoff every time it is drawn, so dragging a scene across the payoff
 * changes the light with nothing running — and a setup that ends up after it
 * stays in the list, struck through with a reason, because a point that
 * silently stopped counting is worse than one that says why.
 */
export function SetupsPanel({ file, currentBeatId, onUpdate, onGoTo }: SetupsPanelProps) {
  const [scope, setScope] = useState<'active' | 'archived'>('active');
  const [selectedId, setSelectedId] = useState<SetupPayoffId | null>(null);
  /** Whether the delete is asking. */
  const [asking, setAsking] = useState(false);
  const [draftSetup, setDraftSetup] = useState('');
  const [draftPayoff, setDraftPayoff] = useState('');

  const rows = setupsBoard(file, scope === 'archived');
  const records = rows.map((row) => row.record);
  const selected = records.find((record) => record.id === selectedId) ?? records[0] ?? null;
  const readiness = selected ? setupReadiness(file, selected) : null;

  const currentBeat = currentBeatId ? file.beats.find((beat) => beat.id === currentBeatId) ?? null : null;
  const currentUnit = currentBeat ? findUnit(file, currentBeat.unitId) ?? null : null;
  const locationLabel = currentBeat
    ? `${currentUnit?.title || currentUnit?.kind || 'scene'} · ${currentBeat.title || 'untitled beat'}`
    : null;

  return (
    <div className="setups">
      <aside className="setups-list">
        <div className="panel-header">
          <div className="tabs" role="tablist" aria-label="Scope">
            {(['active', 'archived'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={scope === option}
                className={scope === option ? 'tab selected' : 'tab'}
                onClick={() => setScope(option)}
              >
                {option === 'active'
                  ? `Active (${file.setupsPayoffs.filter((record) => !record.archived).length})`
                  : 'Archived'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ghost"
            title="Track a new setup and payoff"
            onClick={() => onUpdate((current) => addSetupPayoff(current, { title: 'New payoff' }))}
          >
            +
          </button>
        </div>

        <ul className="item-list">
          {rows.map(({ record, readiness: read }) => (
            <li key={record.id}>
              <button
                type="button"
                className={selected?.id === record.id ? 'item selected' : 'item'}
                onClick={() => setSelectedId(record.id)}
                title={read.says}
              >
                {/* The light, visible without opening the record (§10). */}
                <span className={`setup-light ${read.light}`} aria-label={read.light === 'green' ? 'Prepared' : 'Under-prepared'} />
                <span className="item-title">{record.title}</span>
                <span className="muted count">{read.count}</span>
              </button>
            </li>
          ))}
        </ul>
        {records.length === 0 ? (
          <p className="muted empty">
            {scope === 'active'
              ? 'Nothing outstanding. Add a payoff you owe the reader.'
              : 'Nothing archived yet.'}
          </p>
        ) : null}
      </aside>

      <section className="setups-detail">
        {selected ? (
          <>
            <input
              className="detail-title"
              aria-label="Payoff title"
              value={selected.title}
              onChange={(event) =>
                onUpdate((current) => updateSetupPayoff(current, selected.id, { title: event.target.value }))
              }
            />
            <textarea
              className="detail-body"
              aria-label="Payoff description"
              rows={3}
              placeholder="What has to land, and why it matters"
              value={selected.description}
              onChange={(event) =>
                onUpdate((current) => updateSetupPayoff(current, selected.id, { description: event.target.value }))
              }
            />

            {/* What the record owes, in a sentence — and the number it wants,
                which is three unless this payoff says otherwise. */}
            {readiness ? (
              <div className={`setup-readiness ${readiness.light}`}>
                <span className={`setup-light ${readiness.light}`} aria-hidden="true" />
                <strong>{readiness.count}</strong>
                <span>{readiness.says}</span>
                <label className="setup-minimum">
                  <span className="muted small">wants</span>
                  <input
                    type="number"
                    aria-label="Setups wanted"
                    min={1}
                    max={20}
                    value={readiness.needed}
                    onChange={(event) =>
                      onUpdate((current) =>
                        updateSetupPayoff(current, selected.id, {
                          minimumSetups:
                            Number(event.target.value) === MINIMUM_VALID_SETUPS ? 0 : Number(event.target.value),
                        }),
                      )
                    }
                  />
                </label>
              </div>
            ) : null}

            <h3>Setups ({selected.setups.length})</h3>
            <ul className="setup-points">
              {(readiness?.setups ?? []).map((place) => {
                const point = place.point;
                return (
                  <li key={point.id} className={place.counts ? 'counts' : 'spent'}>
                    <input
                      aria-label="Setup description"
                      value={point.description}
                      onChange={(event) =>
                        onUpdate((current) =>
                          updateSetupPoint(current, {
                            setupPayoffId: selected.id,
                            setupPointId: point.id,
                            patch: { description: event.target.value },
                          }),
                        )
                      }
                    />
                    <select
                      aria-label="Setup strength"
                      value={point.strength}
                      onChange={(event) =>
                        onUpdate((current) =>
                          updateSetupPoint(current, {
                            setupPayoffId: selected.id,
                            setupPointId: point.id,
                            patch: { strength: event.target.value as SetupStrength },
                          }),
                        )
                      }
                    >
                      {STRENGTHS.map((strength) => (
                        <option key={strength} value={strength}>
                          {strength}
                        </option>
                      ))}
                    </select>
                    {/* Where it landed, and — where it does not count — why. A
                        point that quietly stopped counting is worse than one
                        that says it falls after the payoff. */}
                    <span className={place.counts ? 'muted where' : 'where does-not-count'} title={place.why}>
                      {place.where}
                      {place.why ? ` — ${place.why}` : ''}
                    </span>
                    {onGoTo && point.location?.type === 'beat' && place.at ? (
                      <button
                        type="button"
                        className="ghost"
                        title="Go and look at the passage"
                        onClick={() => onGoTo(point.location!.id as BeatId)}
                      >
                        Go to it
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ghost"
                      disabled={!currentBeatId}
                      title={locationLabel ? `Place in ${locationLabel}` : 'Open a beat to place it'}
                      onClick={() => {
                        if (!currentBeatId) return;
                        onUpdate((current) =>
                          updateSetupPoint(current, {
                            setupPayoffId: selected.id,
                            setupPointId: point.id,
                            patch: { location: ref('beat', currentBeatId), strength: 'written' },
                          }),
                        );
                      }}
                    >
                      Place here
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      title="Remove this setup"
                      onClick={() =>
                        onUpdate((current) =>
                          removeSetupPoint(current, { setupPayoffId: selected.id, setupPointId: point.id }),
                        )
                      }
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>

            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const description = draftSetup.trim();
                if (description.length === 0) return;
                onUpdate((current) =>
                  addSetupPoint(current, {
                    setupPayoffId: selected.id,
                    description,
                    ...(currentBeatId ? { location: ref('beat', currentBeatId), strength: 'written' as const } : {}),
                  }),
                );
                setDraftSetup('');
              }}
            >
              <input
                aria-label="New setup"
                placeholder="Where is this established?"
                value={draftSetup}
                onChange={(event) => setDraftSetup(event.target.value)}
              />
              <button type="submit">Add setup</button>
            </form>

            <h3>Payoff</h3>
            {selected.payoff?.writtenAt ? (
              <div className="payoff-recorded">
                <p>{selected.payoff.description}</p>
                <p className="muted small">
                  {describePlace(file, selected.payoff.location)}
                  {selected.payoff.excerpt ? ` — “${selected.payoff.excerpt}”` : ''}
                </p>
                {onGoTo && selected.payoff.location?.type === 'beat' ? (
                  <button type="button" className="ghost" onClick={() => onGoTo(selected.payoff!.location!.id as BeatId)}>
                    Go to it
                  </button>
                ) : null}
                <button type="button" onClick={() => onUpdate((current) => reopenPayoff(current, selected.id))}>
                  Reopen — not written after all
                </button>
              </div>
            ) : (
              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const description = draftPayoff.trim();
                  if (description.length === 0) return;
                  onUpdate((current) =>
                    recordPayoff(current, {
                      setupPayoffId: selected.id,
                      description,
                      ...(currentBeatId ? { location: ref('beat', currentBeatId) } : {}),
                    }),
                  );
                  setDraftPayoff('');
                }}
              >
                <input
                  aria-label="Payoff"
                  placeholder="How does it land?"
                  value={draftPayoff}
                  onChange={(event) => setDraftPayoff(event.target.value)}
                />
                <button type="submit">Record payoff</button>
              </form>
            )}

            <div className="detail-actions">
              <button
                type="button"
                onClick={() =>
                  onUpdate((current) => setSetupPayoffArchived(current, selected.id, !selected.archived))
                }
              >
                {selected.archived ? 'Restore to active' : 'Archive'}
              </button>
              {/* Beside *Archive*, never instead of it (addendum 24 §1):
                  archiving a resolved record is a decision about the work,
                  deleting one is a decision about the record. */}
              {asking ? (
                <span className="graveyard-ask">
                  <span className="muted small">It goes to the graveyard, and can be restored from there.</span>
                  <button
                    type="button"
                    className="ghost small danger"
                    onClick={() => {
                      onUpdate((current) => deleteSetupPayoff(current, selected.id));
                      setAsking(false);
                    }}
                  >
                    Delete
                  </button>
                  <button type="button" className="ghost small" onClick={() => setAsking(false)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" className="ghost" onClick={() => setAsking(true)}>
                  Delete
                </button>
              )}
              {locationLabel ? <span className="muted">Current beat: {locationLabel}</span> : null}
            </div>
          </>
        ) : (
          <p className="muted empty">Select a payoff to work on it.</p>
        )}
      </section>
    </div>
  );
}
