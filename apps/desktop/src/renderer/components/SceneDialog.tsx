import { useEffect, useState } from 'react';
import {
  beatsForUnit,
  findTrack,
  findUnit,
  isProseFormat,
  nounsFor,
  pagesForUnit,
  promisesIn,
  sceneCast,
  sceneHeadingOf,
  setSceneHeading,
  SETTINGS,
  splitUnit,
  UNIT_STATUSES,
  unitStatusWords,
  timecode,
  TIMES,
  addLocation,
  describeDeleting,
  insertDescription,
  locationOfScene,
  locationsInOrder,
  removeLocation,
  sceneGridSchema,
  setPolarity,
  useLocationInScene,
  turnOf,
  updateUnit,
  type Beat,
  type BeatId,
  type ProjectFile,
  type SceneHeading,
  type StructuralUnit,
  type StructuralUnitId,
  type LocationDescriptionId,
  type LocationId,
  type PolarityValue,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';
import { PolarityPair } from './PolarityGraph';

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
  // The unit's own kind, which is a fact about this unit rather than about the
  // format — a project may hold both. Its sub-unit and its manuscript are the
  // format's, and come off the table like everywhere else (§14).
  const nouns = nounsFor(file.project.format);
  // With no unit selected there is no kind to read, and the fallback must be
  // the **format's** noun rather than the word "Scene" — otherwise a closed
  // dialog on a book is labelled Scene, which is what the sweep is about.
  const noun = unit
    ? unit.kind === 'chapter'
      ? 'Chapter'
      : unit.kind === 'section'
        ? 'Section'
        : 'Scene'
    : nouns.unit;

  return (
    <dialog ref={dialog} className="track-dialog scene-dialog" aria-label={noun} onClose={onClose}>
      {unit ? (
        <SceneDialogBody
          file={file}
          unit={unit}
          noun={noun}
          nouns={nouns}
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
  nouns,
  onClose,
  onUpdate,
  onOpenBeat,
  onSelectBeat,
}: {
  file: ProjectFile;
  unit: StructuralUnit;
  noun: string;
  nouns: ReturnType<typeof nounsFor>;
  onClose(): void;
  onUpdate: SceneDialogProps['onUpdate'];
  onOpenBeat: SceneDialogProps['onOpenBeat'];
  onSelectBeat: SceneDialogProps['onSelectBeat'];
}) {
  const track = findTrack(file, unit.trackId);
  const prose = isProseFormat(file.project.format);
  const cast = sceneCast(file, unit.id);
  const promises = promisesIn(file, { unitId: unit.id });
  // Read rather than stored: flat is start === end (addendum 13 §1).
  const turn = turnOf(sceneGridSchema.parse(unit.grid ?? {}));
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
      {/* The breadcrumb is **two lines** (§4a): what this is, then which plot
          it is on with the plot's own colour beside it. On one line the two
          facts ran together and the dot had nothing to sit against. */}
      <header style={{ borderLeftColor: track?.color }} className={unit.inScript ? '' : 'off'}>
        <span className="scene-dialog-where">
          <span className="scene-dialog-kind">{unit.sequenceLabel || noun}</span>
          {track ? (
            <span className="scene-dialog-track">
              <span className="scene-dialog-dot" style={{ background: track.color }} aria-hidden="true" />
              {track.name}
            </span>
          ) : null}
        </span>
        <input
          className="scene-dialog-name"
          aria-label={`${noun} name`}
          placeholder={`Untitled ${noun.toLowerCase()}`}
          value={unit.title}
          onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { title: event.target.value }))}
        />
        {/* A pill that says what it *is* rather than *Off* (§4a): a switch
            whose label changes to a word meaning nothing on its own is one a
            writer has to toggle to understand. */}
        <button
          type="button"
          className={unit.inScript ? 'scene-dialog-ms on' : 'scene-dialog-ms'}
          role="switch"
          aria-checked={unit.inScript}
          aria-label={`In ${nouns.manuscript.toLowerCase()}`}
          title={`Off: the ${noun.toLowerCase()} stays here and leaves the ${nouns.manuscript.toLowerCase()}`}
          onClick={() => onUpdate((current) => updateUnit(current, unit.id, { inScript: !unit.inScript }))}
        >
          <span className="scene-dialog-ms-track" aria-hidden="true">
            <span />
          </span>
          {unit.inScript ? `In ${nouns.manuscript.toLowerCase()}` : `Not in the ${nouns.manuscript.toLowerCase()}`}
        </button>
        <button type="button" className="ghost scene-dialog-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      {prose ? null : <HeadingFields file={file} unit={unit} onUpdate={onUpdate} />}

      <div className="scene-dialog-body">
        {/* Both of these are **readings** — the cast off the cues, the
            promises off the passages that were tagged — so neither gets the
            *+ Add* button the restyle drew. A button here could only refuse;
            what makes a name appear is said instead (§4a). */}
        <aside className="scene-dialog-side" aria-label={`In this ${noun.toLowerCase()}`}>
          <section>
            <h4>
              Characters <span className="scene-dialog-count">{cast.length}</span>
            </h4>
            {cast.length > 0 ? (
              <ul>
                {cast.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No one speaks yet. A name appears here when they do.</p>
            )}
          </section>
          <section>
            <h4>
              Setups &amp; payoffs <span className="scene-dialog-count">{promises.length}</span>
            </h4>
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
              <p className="muted small">Nothing set up or paid off here. Tag a passage and it appears.</p>
            )}
          </section>
        </aside>

        {/* **What it is** before **how it turns** (§4a): the status and the
            label name the scene, and the polarity is a reading about it. The
            pair used to come first, which put the most derived thing at the
            top of the screen. */}
        <div className="scene-dialog-main scene-dialog-middle">
          <div className="field-row">
            <label className="field">
              Status
              <span className="scene-status">
                <span
                  className="scene-status-dot"
                  style={{ background: unitStatusWords(unit.status).colour }}
                  aria-hidden="true"
                />
                <select
                  value={unit.status}
                  onChange={(event) =>
                    onUpdate((current) => updateUnit(current, unit.id, { status: event.target.value as StructuralUnit['status'] }))
                  }
                >
                  {UNIT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </span>
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

          {/* Where the scene begins and where it ends (addendum 13 §2). Here
              because this is the scene's own screen, and because a control a
              writer has to go and find is a control they set once. Whether it
              is flat follows from the pair; there is nothing to answer. */}
          <div className="field">
            <span className="field-head">Scene polarity</span>
            <div className="scene-polarity">
              <PolarityPair
                start={(unit.grid?.polarityStart ?? '') as PolarityValue}
                end={(unit.grid?.polarityEnd ?? '') as PolarityValue}
                onChange={(patch) => onUpdate((current) => setPolarity(current, unit.id, patch))}
              />
              {turn.said ? (
                <span className={turn.flat ? 'polarity-flat-chip' : 'muted small'}>
                  {turn.flat ? 'Flat — it ends where it started' : `Turns ${turn.direction === 1 ? 'up' : 'down'}`}
                </span>
              ) : null}
            </div>
          </div>

          <label className="field">
            Summary
            <textarea
              className="scene-prose"
              rows={3}
              placeholder={`What happens in this ${noun.toLowerCase()}?`}
              value={unit.summary}
              onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { summary: event.target.value }))}
            />
          </label>
          {/* Notes take whatever height is left, so the panel has no dead
              space under it at any size. */}
          <label className="field scene-dialog-notes">
            Notes
            <textarea
              className="scene-prose"
              placeholder="Anything to remember while writing it"
              value={unit.notes}
              onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { notes: event.target.value }))}
            />
          </label>
        </div>

        <BeatList
          beats={beats}
          sub={nouns.sub}
          subPlural={nouns.subPlural}
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

      {/* The figures were a grey sentence under the notes, where they read as
          another field's help text (§4a). A status bar puts them where a
          reader expects a count, with the numbers bold and the sentence about
          saving on the other side. */}
      <footer className="scene-dialog-foot">
        <span>
          <strong>{beats.length}</strong> {beats.length === 1 ? nouns.sub.toLowerCase() : nouns.subPlural.toLowerCase()}
        </span>
        <span className="scene-dialog-rule" aria-hidden="true" />
        <span>
          <strong>{pages < 0.05 ? '0' : pages.toFixed(1)}</strong> pages
        </span>
        <span className="scene-dialog-rule" aria-hidden="true" />
        <span>
          <strong>{timecode(pages)}</strong> read time
        </span>
        {unit.inScript ? null : (
          <>
            <span className="scene-dialog-rule" aria-hidden="true" />
            <span className="scene-dialog-off">
              Not in the {nouns.manuscript.toLowerCase()}, the preview or the exports
            </span>
          </>
        )}
        <span className="scene-dialog-spacer" />
        <span className="scene-dialog-saved">✓ Saved as you type</span>
      </footer>
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
  sub,
  subPlural,
  selected,
  onSelect,
  onOpen,
  onSplit,
}: {
  beats: Beat[];
  /** The unit this list belongs to, for the split control. */
  noun: string;
  sub: string;
  subPlural: string;
  selected: BeatId | null;
  onSelect(beatId: BeatId): void;
  onOpen?: (beatId: BeatId) => void;
  onSplit(): void;
}) {
  const at = beats.findIndex((beat) => beat.id === selected);
  return (
    <aside className="scene-dialog-beats" aria-label={subPlural}>
      <h4>
        {subPlural} <span className="scene-dialog-count">{beats.length}</span>
      </h4>
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
                {/* The number is a mark rather than a word beside the name,
                    so a list of ten reads as a list rather than as prose. */}
                <span className="beat-entry-no">{position + 1}</span>
                <span className="beat-entry-title">{beat.title || `Untitled ${sub.toLowerCase()}`}</span>
                {beat.color ? <span className="beat-entry-dot" style={{ background: beat.color }} aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No {subPlural.toLowerCase()} yet.</p>
      )}
      <button
        type="button"
        className="split"
        disabled={at < 1}
        title={
          at < 1
            ? `Select a ${sub.toLowerCase()} after the first to cut this ${noun.toLowerCase()} there`
            : `Cut here: this ${sub.toLowerCase()} and the ones after it become the next ${noun.toLowerCase()}`
        }
        onClick={onSplit}
      >
        Split at this {sub.toLowerCase()}
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

      {/* The library, beside the heading it fills in (addendum 14 §4.1).
          Choosing one writes the place and, where the scene has not said,
          the setting and the time — and from then on the heading is the
          scene's, because a scene here at night is a scene. */}
      <LocationPicker file={file} unit={unit} onUpdate={onUpdate} disabled={!hasBeats} />
    </div>
  );
}

/**
 * Choose a prepared place, make a new one, or insert one of its descriptions
 * (addendum 14 §§4.1–4.3).
 *
 * **A new location is made without leaving the scene** — §5's requirement, and
 * the reason the module is usable while writing at all: a writer who has to go
 * to Research to name a house will type the heading by hand instead, and the
 * library will be empty forever.
 *
 * **Nothing is inserted because a place was chosen.** §3.3 is explicit. The
 * description is a separate, named act, and what it puts in the scene is a
 * snapshot — the writer's prose from that moment on.
 *
 * **And what is made here can go from here** (addendum 24 §5h): this is the
 * one screen that could put a place in the library, and until now the only way
 * out of it was Research ▸ Locations — so a name typed wrong while writing was
 * a trip to another room to undo. The × is the library's own, asking the same
 * question, and the sentence leads with the thing a writer at this screen is
 * actually worried about: the heading keeps the name.
 */
function LocationPicker({
  file,
  unit,
  onUpdate,
  disabled,
}: {
  file: ProjectFile;
  unit: StructuralUnit;
  onUpdate: SceneDialogProps['onUpdate'];
  disabled: boolean;
}) {
  const places = locationsInOrder(file);
  const here = locationOfScene(file, unit.id);
  const [making, setMaking] = useState(false);
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState('');

  return (
    <span className="scene-location">
      <select
        aria-label="Prepared location"
        disabled={disabled}
        value={here ? (here.id as string) : ''}
        onChange={(event) => {
          const value = event.target.value;
          if (value === '__new') {
            setMaking(true);
            return;
          }
          if (value === '') return;
          onUpdate((current) => useLocationInScene(current, unit.id, value as LocationId));
        }}
      >
        <option value="">Prepared location…</option>
        {places.map((one) => (
          <option key={one.id} value={one.id as string}>
            {one.name} — {one.setting} {one.time}
          </option>
        ))}
        <option value="__new">New location…</option>
      </select>

      {/* The × for the place this scene names, so a location made here can go
          from here. It never touches the heading — that is the scene's. */}
      {here && !disabled ? (
        <button
          type="button"
          className="ghost small danger"
          aria-label={`Delete ${here.name}`}
          title={`Delete ${here.name}`}
          onClick={() => setAsking(true)}
        >
          ×
        </button>
      ) : null}

      {asking && here ? (
        <span className="row-ask scene-location-ask">
          <span className="muted small">
            This scene’s heading keeps the name. {describeDeleting(file, { kind: 'location', id: here.id as string })}
          </span>
          <span className="row-ask-buttons">
            <button
              type="button"
              className="ghost small danger"
              onClick={() => {
                onUpdate((current) => removeLocation(current, here.id));
                setAsking(false);
              }}
            >
              Delete
            </button>
            <button type="button" className="ghost small" onClick={() => setAsking(false)}>
              Keep
            </button>
          </span>
        </span>
      ) : null}

      {/* Its prepared descriptions, where it has any. Inserting is its own
          press, and says what it does. */}
      {here && here.descriptions.length > 0 ? (
        <select
          aria-label="Insert a description"
          disabled={disabled}
          value=""
          onChange={(event) => {
            const id = event.target.value;
            if (!id) return;
            onUpdate((current) => insertDescription(current, unit.id, here.id, id as LocationDescriptionId));
          }}
        >
          <option value="">Insert a description…</option>
          {here.descriptions.map((one) => (
            <option key={one.id} value={one.id as string}>
              {one.title || 'Untitled'}
            </option>
          ))}
        </select>
      ) : null}

      {making ? (
        <span className="scene-location-new">
          <input
            autoFocus
            aria-label="New location name"
            placeholder="MILLER HOUSE"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setMaking(false);
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const wanted = name.trim();
              if (wanted.length === 0) return;
              onUpdate((current) => {
                const made = addLocation(current, { name: wanted });
                return useLocationInScene(made.file, unit.id, made.location.id);
              });
              setName('');
              setMaking(false);
            }}
          />
          <button type="button" className="ghost small" onClick={() => setMaking(false)}>
            Cancel
          </button>
        </span>
      ) : null}
    </span>
  );
}
