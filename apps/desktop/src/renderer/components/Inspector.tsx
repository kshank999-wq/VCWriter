import { useState } from 'react';
import {
  addMarker,
  countWords,
  findBeat,
  findLane,
  findUnit,
  laneKindSchema,
  lanesInOrder,
  markerForUnit,
  moveUnit,
  pagesForUnit,
  ref,
  removeMarker,
  speakersIn,
  storyMarkerKindSchema,
  structuralUnitStatusSchema,
  updateBeat,
  updateLane,
  updateMarker,
  updateUnit,
  type Beat,
  type BeatId,
  type Lane,
  type ProjectFile,
  type StructuralUnit,
} from '@vcwriter/domain';
import { RelatedPanel } from './RelatedPanel';
import { BEAT_STATUSES } from './status';

interface InspectorProps {
  file: ProjectFile;
  selectedBeatId: BeatId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * Properties of the selection (addendum 02 §7): the beat, its scene, its
 * lane and the act the scene starts, as collapsible sections. Every field
 * writes through the same domain mutation the Script and the timeline use,
 * so an edit here is visible there on the next render.
 */
export function Inspector({ file, selectedBeatId, onUpdate }: InspectorProps) {
  const beat = selectedBeatId ? findBeat(file, selectedBeatId) : undefined;
  const unit = beat ? findUnit(file, beat.unitId) : undefined;
  const lane = unit ? findLane(file, unit.laneId) : undefined;

  if (!beat || !unit || !lane) {
    return (
      <aside className="inspector" aria-label="Inspector">
        <p className="muted empty-state">Select a beat to see its properties.</p>
      </aside>
    );
  }

  return (
    <aside className="inspector" aria-label="Inspector">
      <BeatSection file={file} beat={beat} onUpdate={onUpdate} />
      <UnitSection file={file} unit={unit} onUpdate={onUpdate} />
      <LaneSection lane={lane} onUpdate={onUpdate} />
      <ActSection file={file} unit={unit} onUpdate={onUpdate} />
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={open ? 'inspector-section open' : 'inspector-section'}>
      <header>
        <button type="button" className="ghost twisty" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'}
        </button>
        <h3>{title}</h3>
      </header>
      {open ? <div className="inspector-fields">{children}</div> : null}
    </section>
  );
}

function BeatSection({
  file,
  beat,
  onUpdate,
}: {
  file: ProjectFile;
  beat: Beat;
  onUpdate: InspectorProps['onUpdate'];
}) {
  // The same reading of the cues the Threads view and the cast dots use.
  const speakers = speakersIn(beat);
  return (
    <Section title="Beat">
      <label className="field">
        Title
        <input
          value={beat.title}
          placeholder="What happens in this beat"
          onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { title: event.target.value }))}
        />
      </label>
      <label className="field">
        Status
        <select
          value={beat.status}
          onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { status: event.target.value as Beat['status'] }))}
        >
          {BEAT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Summary
        <textarea
          rows={3}
          value={beat.summary}
          onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { summary: event.target.value }))}
        />
      </label>
      <dl className="inspector-facts">
        <dt>Words</dt>
        <dd>{countWords(beat.manuscript)}</dd>
        <dt>Speaks</dt>
        <dd>{speakers.length > 0 ? speakers.join(', ') : <span className="muted">No dialogue yet</span>}</dd>
      </dl>
      <RelatedPanel file={file} target={ref('beat', beat.id)} onUpdate={onUpdate} />
    </Section>
  );
}

function UnitSection({
  file,
  unit,
  onUpdate,
}: {
  file: ProjectFile;
  unit: StructuralUnit;
  onUpdate: InspectorProps['onUpdate'];
}) {
  const noun = unit.kind === 'chapter' ? 'Chapter' : unit.kind === 'section' ? 'Section' : 'Scene';
  const pages = pagesForUnit(file, unit.id);
  return (
    <Section title={noun}>
      <div className="field-row">
        <label className="field">
          Label
          <input
            value={unit.sequenceLabel}
            placeholder={unit.kind === 'chapter' ? 'Ch. 1' : 'Sc. 1'}
            onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { sequenceLabel: event.target.value }))}
          />
        </label>
        <label className="field">
          Status
          <select
            value={unit.status}
            onChange={(event) =>
              onUpdate((current) => updateUnit(current, unit.id, { status: event.target.value as StructuralUnit['status'] }))
            }
          >
            {structuralUnitStatusSchema.options.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Title
        <input
          value={unit.title}
          placeholder={`Untitled ${unit.kind}`}
          onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { title: event.target.value }))}
        />
      </label>
      <label className="field">
        Lane
        <select
          aria-label={`${noun} lane`}
          value={unit.laneId}
          onChange={(event) =>
            onUpdate((current) =>
              moveUnit(current, { unitId: unit.id, toLaneId: event.target.value as Lane['id'], keepPosition: true }),
            )
          }
        >
          {lanesInOrder(file).map((lane) => (
            <option key={lane.id} value={lane.id}>
              {lane.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Summary
        <textarea
          rows={2}
          value={unit.summary}
          onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { summary: event.target.value }))}
        />
      </label>
      <label className="field">
        Notes
        <textarea
          rows={3}
          value={unit.notes}
          onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { notes: event.target.value }))}
        />
      </label>
      <dl className="inspector-facts">
        <dt>Pages</dt>
        <dd>{pages < 0.05 ? '0' : pages.toFixed(1)}</dd>
      </dl>
    </Section>
  );
}

function LaneSection({ lane, onUpdate }: { lane: Lane; onUpdate: InspectorProps['onUpdate'] }) {
  return (
    <Section title="Lane">
      <div className="field-row">
        <label className="field">
          Name
          <input
            value={lane.name}
            onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { name: event.target.value || 'Lane' }))}
          />
        </label>
        <label className="field swatch-field">
          Colour
          <input
            type="color"
            value={lane.color}
            aria-label="Lane colour"
            onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { color: event.target.value }))}
          />
        </label>
      </div>
      <label className="field">
        Kind
        <select
          value={lane.kind}
          onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { kind: event.target.value as Lane['kind'] }))}
        >
          {laneKindSchema.options.map((kind) => (
            <option key={kind} value={kind}>
              {kind.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Description
        <textarea
          rows={2}
          value={lane.description}
          onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { description: event.target.value }))}
        />
      </label>
    </Section>
  );
}

function ActSection({
  file,
  unit,
  onUpdate,
}: {
  file: ProjectFile;
  unit: StructuralUnit;
  onUpdate: InspectorProps['onUpdate'];
}) {
  const marker = markerForUnit(file, unit.id);
  return (
    <Section title="Act">
      {marker ? (
        <>
          <div className="field-row">
            <label className="field">
              Title
              <input
                value={marker.title}
                placeholder="Act I"
                onChange={(event) => onUpdate((current) => updateMarker(current, marker.id, { title: event.target.value }))}
              />
            </label>
            <label className="field">
              Kind
              <select
                value={marker.kind}
                onChange={(event) =>
                  onUpdate((current) => updateMarker(current, marker.id, { kind: event.target.value as typeof marker.kind }))
                }
              >
                {storyMarkerKindSchema.options.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="ghost danger" onClick={() => onUpdate((current) => removeMarker(current, marker.id))}>
            Remove marker
          </button>
        </>
      ) : (
        <p className="muted">
          This {unit.kind} starts no act.{' '}
          <button
            type="button"
            className="link"
            onClick={() => onUpdate((current) => addMarker(current, { unitId: unit.id, title: 'New act' }).file)}
          >
            Start one here
          </button>
        </p>
      )}
    </Section>
  );
}
