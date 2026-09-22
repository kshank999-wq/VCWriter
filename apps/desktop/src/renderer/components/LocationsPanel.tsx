import { useMemo, useState } from 'react';
import {
  SETTINGS,
  TIMES,
  addDescription,
  addLocation,
  describeDeleting,
  describeLocations,
  locationsInOrder,
  placesWithoutRecords,
  removeDescription,
  removeLocation,
  renameLocation,
  timesUsed,
  updateDescription,
  updateLocation,
  usedIn,
  type LocationId,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';

/**
 * The location library (addendum 14 §3).
 *
 * A place is a project asset like a character: one record, used by any number
 * of scenes, edited here. The two things worth knowing about the screen:
 *
 * **The scenes it lists are read from their headings**, never from a stored
 * membership list — so a heading retyped by hand moves a scene between places
 * with nothing running, and this list cannot drift out of step with what the
 * script says.
 *
 * **Several prepared descriptions, not one paragraph.** A place is described
 * differently the second time it is seen, and one field would make the writer
 * overwrite the first description to write the second. Nothing inserts one; the
 * writer chooses, in the scene.
 */
interface LocationsPanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGoToUnit?(unitId: StructuralUnitId): void;
}

export function LocationsPanel({ file, onUpdate, onGoToUnit }: LocationsPanelProps) {
  const locations = useMemo(() => locationsInOrder(file, true), [file]);
  const unrecorded = useMemo(() => placesWithoutRecords(file), [file]);
  const [chosenId, setChosenId] = useState<LocationId | null>(null);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);

  const chosen = locations.find((one) => one.id === chosenId) ?? locations[0] ?? null;
  const scenes = chosen ? usedIn(file, chosen.id) : [];

  return (
    <div className="locations">
      <aside className="locations-list">
        <div className="panel-header">
          <span className="muted small">{describeLocations(file)}</span>
        </div>

        <ul className="item-list">
          {locations.map((one) => {
            const used = timesUsed(file, one.id);
            return (
              <li key={one.id}>
                <button
                  type="button"
                  className={one.id === chosen?.id ? 'item selected' : 'item'}
                  onClick={() => setChosenId(one.id)}
                >
                  <span className="item-title">{one.name || 'Unnamed'}</span>
                  <span className="muted small">{one.setting}</span>
                  {/* A fact, not a grade: a place written once is not a fault. */}
                  <span className={used === 0 ? 'locations-unused' : 'muted count'}>
                    {used === 0 ? 'not used' : used}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const name = draft.trim();
            if (name.length === 0) return;
            onUpdate((current) => addLocation(current, { name }).file);
            setDraft('');
          }}
        >
          <input
            aria-label="New location"
            placeholder="Miller House"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>

        {/* Places the script already names that have no record. Offered so a
            writer who has been typing headings can adopt them rather than
            retyping them — the only honest way into a module that arrives
            after the script has started. */}
        {unrecorded.length > 0 ? (
          <div className="locations-found">
            <h4>Already in the script</h4>
            <ul>
              {unrecorded.map((place) => (
                <li key={place}>
                  <span>{place}</span>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => onUpdate((current) => addLocation(current, { name: place }).file)}
                  >
                    Make a record
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>

      <section className="locations-detail">
        {chosen ? (
          <>
            <input
              className="detail-title"
              aria-label="Location name"
              value={chosen.name}
              // Renaming carries the new name into the scenes that use it —
              // their headings are structural lines, not prose.
              onChange={(event) => onUpdate((current) => renameLocation(current, chosen.id, event.target.value))}
            />

            <div className="locations-defaults">
              <label className="field">
                <span>Usually</span>
                <select
                  aria-label="Default setting"
                  value={chosen.setting}
                  onChange={(event) => onUpdate((current) => updateLocation(current, chosen.id, { setting: event.target.value }))}
                >
                  {SETTINGS.map((one) => (
                    <option key={one} value={one}>
                      {one}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Usually at</span>
                <select
                  aria-label="Default time"
                  value={chosen.time}
                  onChange={(event) => onUpdate((current) => updateLocation(current, chosen.id, { time: event.target.value }))}
                >
                  {TIMES.map((one) => (
                    <option key={one} value={one}>
                      {one}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted small">
              Defaults for a heading, not facts about the place — a scene here at night is a scene, and
              setting one does not change this record.
            </p>

            <label className="field">
              <span>Notes</span>
              <textarea
                aria-label="Location notes"
                rows={3}
                placeholder="Research, geography, what it smells like, production notes"
                value={chosen.notes}
                onChange={(event) => onUpdate((current) => updateLocation(current, chosen.id, { notes: event.target.value }))}
              />
            </label>

            <h3>Prepared descriptions ({chosen.descriptions.length})</h3>
            <p className="muted small">
              Written ahead, chosen in the scene. Nothing is inserted just because the place is used.
            </p>
            <ul className="locations-descriptions">
              {chosen.descriptions.map((one) => (
                <li key={one.id}>
                  <input
                    aria-label="Description title"
                    value={one.title}
                    placeholder="Initial reveal"
                    onChange={(event) =>
                      onUpdate((current) => updateDescription(current, chosen.id, one.id, { title: event.target.value }))
                    }
                  />
                  <textarea
                    aria-label={`Description: ${one.title || 'untitled'}`}
                    rows={3}
                    value={one.body}
                    onChange={(event) =>
                      onUpdate((current) => updateDescription(current, chosen.id, one.id, { body: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="ghost small danger"
                    onClick={() => onUpdate((current) => removeDescription(current, chosen.id, one.id))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="ghost small"
              onClick={() => onUpdate((current) => addDescription(current, chosen.id, { title: 'Untitled' }))}
            >
              + Another description
            </button>

            <h3>Where it is used ({scenes.length})</h3>
            <p className="muted small">Read from the scene headings, so this follows what the script says.</p>
            {scenes.length === 0 ? (
              <p className="muted">Not in the script yet.</p>
            ) : (
              <ul className="locations-scenes">
                {scenes.map((unit, at) => (
                  <li key={unit.id}>
                    <span className="muted small">Scene {at + 1}</span>
                    <span>{unit.title || 'Untitled'}</span>
                    {onGoToUnit ? (
                      <button type="button" className="ghost small" onClick={() => onGoToUnit(unit.id)}>
                        Go to it
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {/* Put away rather than deleted where scenes still name it (§8). */}
            <div className="locations-actions">
              <label className="check">
                <input
                  type="checkbox"
                  checked={chosen.archived}
                  onChange={(event) => onUpdate((current) => updateLocation(current, chosen.id, { archived: event.target.checked }))}
                />
                <span>Put away</span>
              </label>
              {asking ? (
                <span className="locations-confirm">
                  {/* The scenes are this screen's own fact — a writer removing
                      a place wants to know the headings survive it — and where
                      it goes is the graveyard's sentence rather than a second
                      copy of one. */}
                  <span className="muted small">
                    {scenes.length > 0
                      ? `${scenes.length} ${scenes.length === 1 ? 'scene names' : 'scenes name'} it, and their headings keep the name. `
                      : 'Nothing uses it. '}
                    {describeDeleting(file, { kind: 'location', id: chosen.id as string })}
                  </span>
                  <button
                    type="button"
                    className="ghost small danger"
                    onClick={() => {
                      onUpdate((current) => removeLocation(current, chosen.id));
                      setAsking(false);
                    }}
                  >
                    Remove it
                  </button>
                  <button type="button" className="ghost small" onClick={() => setAsking(false)}>
                    Keep it
                  </button>
                </span>
              ) : (
                <button type="button" className="ghost small danger" onClick={() => setAsking(true)}>
                  Remove this location
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="muted empty">Name a place to prepare it.</p>
        )}
      </section>
    </div>
  );
}
