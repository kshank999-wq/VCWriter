import { useEffect, useState } from 'react';
import {
  beatsForUnit,
  findLane,
  findUnit,
  isProseFormat,
  pagesForUnit,
  promisesIn,
  sceneCast,
  sceneHeadingOf,
  setSceneHeading,
  SETTINGS,
  splitUnit,
  structuralUnitStatusSchema,
  timecode,
  TIMES,
  updateUnit,
  type Beat,
  type BeatId,
  type ProjectFile,
  type SceneHeading,
  type StructuralUnit,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

interface SceneDialogProps {
  file: ProjectFile;
  unitId: StructuralUnitId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** A beat in the list was double-clicked: open it in the writing screen. */
  onOpenBeat?(beatId: BeatId): void;
  /** A beat became the selection, so the rest of the workspace follows. */
  onSelectBeat?(beatId: BeatId): void;
}

/**
 * The scene pop-up (addendum 02 §4): opened from a scene block, laid out
 * the way an editing program's clip dialog is. The scene's name sits top
 * centre; under it, for a script, the slugline as three fields that read
 * from and write to the scene's first scene heading; a switch takes the
 * scene out of the script without deleting it. The left column fills
 * itself from the text — who speaks, which promises are made or kept
 * here — and the rest is the scene's summary and notes.
 */
export function SceneDialog({ file, unitId, onClose, onUpdate, onOpenBeat, onSelectBeat }: SceneDialogProps) {
  const unit = unitId ? findUnit(file, unitId) : undefined;
  const dialog = useModal(Boolean(unit));
  const noun = unit?.kind === 'chapter' ? 'Chapter' : unit?.kind === 'section' ? 'Section' : 'Scene';

  return (
    <dialog ref={dialog} className="lane-dialog scene-dialog" aria-label={noun} onClose={onClose}>
      {unit ? (
        <SceneDialogBody
          file={file}
          unit={unit}
          noun={noun}
          onClose={onClose}
          onUpdate={onUpdate}
          onOpenBeat={onOpenBeat}
          onSelectBeat={onSelectBeat}
        />
      ) : null}
    </dialog>
  );
}

function SceneDialogBody({
  file,
  unit,
  noun,
  onClose,
  onUpdate,
  onOpenBeat,
  onSelectBeat,
}: {
  file: ProjectFile;
  unit: StructuralUnit;
  noun: string;
  onClose(): void;
  onUpdate: SceneDialogProps['onUpdate'];
  onOpenBeat: SceneDialogProps['onOpenBeat'];
  onSelectBeat: SceneDialogProps['onSelectBeat'];
}) {
  const lane = findLane(file, unit.laneId);
  const prose = isProseFormat(file.project.format);
  const cast = sceneCast(file, unit.id);
  const promises = promisesIn(file, { unitId: unit.id });
  const beats = beatsForUnit(file, unit.id);
  const pages = pagesForUnit(file, unit.id);
  const [selectedBeatId, setSelectedBeatId] = useState<BeatId | null>(null);

  /** Cut the scene at the selected beat; the rest becomes the next scene. */
  const split = () => {
    const at = beats.findIndex((beat) => beat.id === selectedBeatId);
    if (at < 1 || !selectedBeatId) return;
    onUpdate((current) => splitUnit(current, unit.id, selectedBeatId).file);
    setSelectedBeatId(null);
  };

  return (
    <>
      <header style={{ borderLeftColor: lane?.color }} className={unit.inScript ? '' : 'off'}>
        <span className="scene-dialog-label muted">
          {unit.sequenceLabel || noun}
          {lane ? ` · ${lane.name}` : ''}
        </span>
        <input
          className="bar-title scene-dialog-name"
          aria-label={`${noun} name`}
          placeholder={`Untitled ${noun.toLowerCase()}`}
          value={unit.title}
          onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { title: event.target.value }))}
        />
        <label className="switch" title={`Off: the ${noun.toLowerCase()} stays here and leaves the script`}>
          <input
            type="checkbox"
            role="switch"
            aria-label="In script"
            checked={unit.inScript}
            onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { inScript: event.target.checked }))}
          />
          <span className="switch-track" aria-hidden="true" />
          <span className="switch-label">{unit.inScript ? 'In script' : 'Off'}</span>
        </label>
        <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      {prose ? null : <HeadingFields file={file} unit={unit} onUpdate={onUpdate} />}

      <div className="scene-dialog-body">
        <aside className="scene-dialog-side" aria-label={`In this ${noun.toLowerCase()}`}>
          <h4>Characters</h4>
          {cast.length > 0 ? (
            <ul>
              {cast.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No one speaks yet.</p>
          )}
          <h4>Setups &amp; payoffs</h4>
          {promises.length > 0 ? (
            <ul>
              {promises.map((promise, index) => (
                <li key={`${promise.record.id}-${promise.role}-${index}`}>
                  <span className={`promise-role ${promise.role}`}>{promise.role}</span> {promise.record.title}
                  {promise.point?.description ? <span className="muted"> · {promise.point.description}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing set up or paid off here.</p>
          )}
        </aside>

        <div className="scene-dialog-main scene-dialog-middle">
          <div className="field-row">
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
            <label className="field">
              Label
              <input
                value={unit.sequenceLabel}
                placeholder={unit.kind === 'chapter' ? 'Ch. 1' : 'Sc. 1'}
                onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { sequenceLabel: event.target.value }))}
              />
            </label>
          </div>
          <label className="field">
            Summary
            <textarea
              rows={3}
              placeholder={`What happens in this ${noun.toLowerCase()}`}
              value={unit.summary}
              onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { summary: event.target.value }))}
            />
          </label>
          <label className="field">
            Notes
            <textarea
              rows={6}
              placeholder="Anything to remember while writing it"
              value={unit.notes}
              onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { notes: event.target.value }))}
            />
          </label>
          <p className="muted">
            {beats.length} {beats.length === 1 ? 'beat' : 'beats'} · {pages < 0.05 ? '0' : pages.toFixed(1)} pages ·{' '}
            {timecode(pages)}.
            {unit.inScript ? '' : ` Switched off: this ${noun.toLowerCase()} is not in the script, the preview or the exports.`}{' '}
            Changes are kept as you type.
          </p>
        </div>

        <BeatList
          beats={beats}
          noun={noun}
          selected={selectedBeatId}
          onSelect={(beatId) => {
            setSelectedBeatId(beatId);
            onSelectBeat?.(beatId);
          }}
          onOpen={onOpenBeat}
          onSplit={split}
        />
      </div>
    </>
  );
}

/**
 * The beats of the scene, down the right (addendum 02 §5). Selecting one and
 * cutting there splits the scene: this beat and everything after it become
 * the next scene along, the way a cut in an editing timeline leaves the
 * second half of a clip to be named.
 */
function BeatList({
  beats,
  noun,
  selected,
  onSelect,
  onOpen,
  onSplit,
}: {
  beats: Beat[];
  noun: string;
  selected: BeatId | null;
  onSelect(beatId: BeatId): void;
  onOpen?: (beatId: BeatId) => void;
  onSplit(): void;
}) {
  const at = beats.findIndex((beat) => beat.id === selected);
  return (
    <aside className="scene-dialog-beats" aria-label="Beats">
      <h4>Beats</h4>
      {beats.length > 0 ? (
        <ul>
          {beats.map((beat, position) => (
            <li key={beat.id}>
              <button
                type="button"
                className={beat.id === selected ? 'beat-entry selected' : 'beat-entry'}
                aria-current={beat.id === selected ? 'true' : undefined}
                title={onOpen ? 'Click to select · double-click to write in it' : undefined}
                onClick={() => onSelect(beat.id)}
                onDoubleClick={() => onOpen?.(beat.id)}
              >
                <span className="muted">{position + 1}</span>
                <span className="beat-entry-title">{beat.title || 'Untitled beat'}</span>
                {beat.color ? <span className="beat-entry-dot" style={{ background: beat.color }} aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No beats yet.</p>
      )}
      <button
        type="button"
        className="split"
        disabled={at < 1}
        title={
          at < 1
            ? `Select a beat after the first to cut this ${noun.toLowerCase()} there`
            : `Cut here: this beat and the ones after it become the next ${noun.toLowerCase()}`
        }
        onClick={onSplit}
      >
        Split at this beat
      </button>
    </aside>
  );
}

/**
 * INT/EXT, place and time. The place is typed freely and written to the
 * scene heading when the field is left or Return is pressed, so a space
 * typed mid-way is not trimmed from under the cursor; the two selects
 * write at once.
 */
function HeadingFields({
  file,
  unit,
  onUpdate,
}: {
  file: ProjectFile;
  unit: StructuralUnit;
  onUpdate: SceneDialogProps['onUpdate'];
}) {
  const heading = sceneHeadingOf(file, unit.id) ?? { setting: '', place: '', time: '' };
  const [place, setPlace] = useState(heading.place);
  useEffect(() => setPlace(heading.place), [unit.id, heading.place]);
  const hasBeats = beatsForUnit(file, unit.id).length > 0;

  const write = (patch: Partial<SceneHeading>) =>
    onUpdate((current) => setSceneHeading(current, unit.id, { ...heading, place, ...patch }));

  const settings = heading.setting && !SETTINGS.includes(heading.setting as (typeof SETTINGS)[number]) ? [heading.setting, ...SETTINGS] : SETTINGS;
  const times = heading.time && !TIMES.includes(heading.time as (typeof TIMES)[number]) ? [heading.time, ...TIMES] : TIMES;

  return (
    <div className="scene-heading-fields" aria-label="Scene heading">
      <select aria-label="Setting" value={heading.setting} disabled={!hasBeats} onChange={(event) => write({ setting: event.target.value })}>
        <option value="">—</option>
        {settings.map((setting) => (
          <option key={setting} value={setting}>
            {setting}
          </option>
        ))}
      </select>
      <input
        aria-label="Location"
        placeholder={hasBeats ? 'LOCATION' : 'Add a beat to give this scene a heading'}
        value={place}
        disabled={!hasBeats}
        onChange={(event) => setPlace(event.target.value)}
        onBlur={() => {
          if (place.trim().toUpperCase() !== heading.place) write({ place });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            write({ place });
          }
        }}
      />
      <select aria-label="Time" value={heading.time} disabled={!hasBeats} onChange={(event) => write({ time: event.target.value })}>
        <option value="">—</option>
        {times.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
    </div>
  );
}
