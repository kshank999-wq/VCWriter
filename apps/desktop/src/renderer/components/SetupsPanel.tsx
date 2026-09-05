import { useState } from 'react';
import {
  addSetupPayoff,
  addSetupPoint,
  derivedSetupPayoffStatus,
  findUnit,
  recordPayoff,
  removeSetupPoint,
  reopenPayoff,
  ref,
  resolveRef,
  setSetupPayoffArchived,
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
}

const STRENGTHS: readonly SetupStrength[] = ['planned', 'written', 'weak'];

/**
 * Setups & payoffs (spec §7.3).
 *
 * A payoff can be established in several places, so setups are a list, not a
 * field. Anything not yet delivered stays in Active — that list is the writer's
 * outstanding debt to the reader, which is the whole point of the feature.
 * Resolving and archiving keep every setup point and link, and both are
 * reversible.
 */
export function SetupsPanel({ file, currentBeatId, onUpdate }: SetupsPanelProps) {
  const [scope, setScope] = useState<'active' | 'archived'>('active');
  const [selectedId, setSelectedId] = useState<SetupPayoffId | null>(null);
  const [draftSetup, setDraftSetup] = useState('');
  const [draftPayoff, setDraftPayoff] = useState('');

  const records = file.setupsPayoffs.filter((record) =>
    scope === 'active' ? !record.archived : record.archived,
  );
  const selected = records.find((record) => record.id === selectedId) ?? records[0] ?? null;

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
          {records.map((record) => {
            const status = derivedSetupPayoffStatus(record);
            return (
              <li key={record.id}>
                <button
                  type="button"
                  className={selected?.id === record.id ? 'item selected' : 'item'}
                  onClick={() => setSelectedId(record.id)}
                >
                  <span className="item-title">{record.title}</span>
                  <span className={`chip status-${status}`}>{status}</span>
                  <span className="muted count">
                    {record.setups.length} {record.setups.length === 1 ? 'setup' : 'setups'}
                  </span>
                </button>
              </li>
            );
          })}
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

            <h3>Setups ({selected.setups.length})</h3>
            <ul className="setup-points">
              {selected.setups.map((point) => {
                const where = point.location ? resolveRef(file, point.location) : null;
                return (
                  <li key={point.id}>
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
                    <span className="muted where">
                      {where ? (where.exists ? where.label : 'missing element') : 'not placed'}
                    </span>
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
