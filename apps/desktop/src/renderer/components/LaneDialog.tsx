import { useMemo, useState } from 'react';
import {
  beatsForUnit,
  countWords,
  findLane,
  laneKindSchema,
  promisesIn,
  relatedEntities,
  sceneCast,
  unitsInStoryOrder,
  updateLane,
  type LaneId,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

interface LaneDialogProps {
  file: ProjectFile;
  laneId: LaneId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * The plot pop-up (addendum 02 §4): clicking a lane's track header opens
 * the plot itself — its summary and its arc — over the workspace, to think
 * in; closing it returns to the lanes with nothing else changed. The fields
 * write through `updateLane` as they are typed, so there is no Save.
 */
export function LaneDialog({ file, laneId, onClose, onUpdate }: LaneDialogProps) {
  const lane = laneId ? findLane(file, laneId) : undefined;
  const dialog = useModal(Boolean(lane));
  const [chosen, setChosen] = useState<StructuralUnitId | null>(null);

  // This plot's scenes, in story order — the order they are read in, not the
  // order they were made (addendum 02 §19).
  const scenes = useMemo(
    () => (lane ? unitsInStoryOrder(file).filter((unit) => unit.laneId === lane.id) : []),
    [file, lane],
  );
  const scene = scenes.find((unit) => unit.id === chosen) ?? null;

  return (
    <dialog ref={dialog} className="lane-dialog" aria-label="Plot" onClose={onClose}>
      {lane ? (
        <>
          <header style={{ borderLeftColor: lane.color }}>
            <div className="lane-dialog-title">
              <input
                className="bar-title"
                aria-label="Plot name"
                value={lane.name}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { name: event.target.value || 'Lane' }))}
              />
              <select
                aria-label="Plot kind"
                value={lane.kind}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { kind: event.target.value as typeof lane.kind }))}
              >
                {laneKindSchema.options.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <input
                type="color"
                className="swatch"
                aria-label="Plot colour"
                value={lane.color}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { color: event.target.value }))}
              />
            </div>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="lane-dialog-body with-scenes">
            <div className="lane-dialog-main">
            <label className="field">
              Summary
              <textarea
                rows={4}
                placeholder="What this thread of the story is about"
                value={lane.description}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { description: event.target.value }))}
              />
            </label>
            <label className="field">
              Arc
              <textarea
                rows={10}
                placeholder="How it develops: where it starts, what turns it, where it ends"
                value={lane.arc}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { arc: event.target.value }))}
              />
            </label>
            {/* What is in the scene the rail has selected: who is in it, what
                it promises or pays, what it is linked to. Below the arc,
                because the arc is what the scene is being read against. */}
            {scene ? <SceneFacts file={file} unitId={scene.id} /> : null}

            <p className="muted">
              {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'} in this plot. Changes are kept as you type.
            </p>
            </div>

            {/* The same rail the episodes have, listing scenes instead. */}
            <aside className="scene-rail" aria-label="Scenes in this plot">
              <h4>Scenes</h4>
              {scenes.length === 0 ? (
                <p className="muted small">Nothing on this plot yet.</p>
              ) : (
                <ul className="scene-rail-list">
                  {scenes.map((unit, index) => (
                    <li key={unit.id}>
                      <button
                        type="button"
                        className={unit.id === chosen ? 'scene-rail-row current' : 'scene-rail-row'}
                        aria-current={unit.id === chosen ? 'true' : undefined}
                        onClick={() => setChosen(unit.id === chosen ? null : unit.id)}
                      >
                        <span className="scene-rail-number muted">{unit.sequenceLabel || `Sc. ${index + 1}`}</span>
                        <span className="scene-rail-title">{unit.title || 'Untitled'}</span>
                        <span className="scene-rail-figures muted">
                          {beatsForUnit(file, unit.id).length} beats ·{' '}
                          {beatsForUnit(file, unit.id).reduce((total, beat) => total + countWords(beat.manuscript), 0)}{' '}
                          words
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        </>
      ) : null}
    </dialog>
  );
}

/** Who is in a scene, what it owes, and what it is linked to. */
function SceneFacts({ file, unitId }: { file: ProjectFile; unitId: StructuralUnitId }) {
  const cast = sceneCast(file, unitId);
  const promises = promisesIn(file, { unitId });
  const links = relatedEntities(file, { type: 'unit', id: unitId });
  const unit = file.units.find((candidate) => candidate.id === unitId);

  return (
    <div className="scene-facts">
      <h4>{unit?.title || 'This scene'}</h4>

      {unit && unit.summary.trim().length > 0 ? <p className="scene-facts-summary">{unit.summary}</p> : null}

      <dl>
        <dt>Characters</dt>
        <dd>{cast.length > 0 ? cast.join(' · ') : <span className="muted">Nobody speaks in it yet</span>}</dd>

        <dt>Setups &amp; payoffs</dt>
        <dd>
          {promises.length > 0 ? (
            <ul>
              {promises.map((promise) => (
                <li key={`${promise.record.id}-${promise.role}`}>
                  <span className={promise.role === 'payoff' ? 'chip used' : 'chip suggested'}>{promise.role}</span>{' '}
                  {promise.record.title}
                </li>
              ))}
            </ul>
          ) : (
            <span className="muted">Nothing set up or paid here</span>
          )}
        </dd>

        <dt>Linked to</dt>
        <dd>
          {links.length > 0 ? (
            <ul>
              {links.map((entry) => (
                <li key={entry.link.id}>
                  <span className="muted">{entry.link.type.replace(/_/g, ' ')}</span> {entry.other.label}
                </li>
              ))}
            </ul>
          ) : (
            <span className="muted">Not linked to anything</span>
          )}
        </dd>
      </dl>
    </div>
  );
}
