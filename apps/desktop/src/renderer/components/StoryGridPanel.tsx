import {
  GENRE_NAMES,
  GENRE_VALUES,
  GLOBAL_GENRES,
  addGridPromise,
  removeGridPromise,
  setStoryGrid,
  storyGridStatus,
  unitsInStoryOrder,
  updateGridPromise,
  type GlobalGenre,
  type GridPromiseKind,
  type GridPromiseStatus,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';

/**
 * The Story Grid's global layer (addendum 04 §3).
 *
 * What the story is, and what that obliges it to deliver. The per-scene half
 * of the grid is the Final Editor's, and mostly already built; this is the
 * part that was missing.
 *
 * **The checklist is the point.** Choosing a genre fills it with what that
 * genre owes its reader, and each line is answered by naming a scene. A line
 * with no scene against it is the question the whole tab exists to ask — so
 * the outstanding ones are counted at the top and are not hidden away.
 *
 * Nothing here is enforced. Every line can be reworded, removed, or answered
 * by a scene that does something else entirely, and a writer who empties the
 * list has a genre of their own.
 */

interface StoryGridPanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Naming a scene from here should be able to go and look at it. */
  onGoToUnit?(unitId: StructuralUnitId): void;
}

export function StoryGridPanel({ file, onUpdate, onGoToUnit }: StoryGridPanelProps) {
  const status = storyGridStatus(file);
  const grid = status.grid;
  const scenes = unitsInStoryOrder(file);

  const owed = status.promises.filter((entry) => entry.promise.kind === 'obligatory');
  const carried = status.promises.filter((entry) => entry.promise.kind === 'convention');

  const set = (patch: Parameters<typeof setStoryGrid>[1]) =>
    onUpdate((current) => setStoryGrid(current, patch));

  return (
    <div className="grid-panel">
      <section className="grid-global">
        <h3>What the story is</h3>

        <label className="field-row">
          <span>Genre</span>
          <div className="field-input">
            <select
              aria-label="Global genre"
              value={grid.genre}
              onChange={(event) => set({ genre: event.target.value as GlobalGenre | '' })}
            >
              <option value="">Not said yet</option>
              {GLOBAL_GENRES.map((genre) => (
                <option key={genre} value={genre}>
                  {GENRE_NAMES[genre]}
                </option>
              ))}
            </select>
            {/* Changing the genre leaves the list alone by then: it has the
                writer's edits and their scenes on it. This asks for the
                replacement out loud (§3). */}
            {grid.genre && grid.promises.length > 0 ? (
              <button
                type="button"
                className="ghost small"
                onClick={() =>
                  onUpdate((current) => setStoryGrid(current, { genre: grid.genre }, { reseed: true }))
                }
              >
                Start the list again
              </button>
            ) : null}
          </div>
        </label>

        <label className="field-row">
          <span>Sub-genre</span>
          <div className="field-input">
            <input
              aria-label="Sub-genre"
              value={grid.subGenre}
              placeholder="Heist, buddy love, monster in the house — your words"
              onChange={(event) => set({ subGenre: event.target.value })}
            />
          </div>
        </label>

        <label className="field-row">
          <span>The value</span>
          <div className="field-input">
            <input
              aria-label="Global value"
              value={grid.value}
              placeholder={grid.genre ? GENRE_VALUES[grid.genre as GlobalGenre] : 'Life / death, love / hate, truth / lie'}
              onChange={(event) => set({ value: event.target.value })}
            />
          </div>
        </label>

        <label className="field-row">
          <span>Controlling idea</span>
          <div className="field-input">
            <textarea
              aria-label="Controlling idea"
              rows={2}
              value={grid.controllingIdea}
              placeholder="One sentence: what the ending says"
              onChange={(event) => set({ controllingIdea: event.target.value })}
            />
          </div>
        </label>
      </section>

      {grid.genre === '' && status.promises.length === 0 ? (
        <p className="muted empty-state">
          Say what the story is and this fills with what that genre owes its reader — the scenes it has to
          deliver, and the furniture it is expected to carry. Nothing here is a rule: every line is yours to
          reword, remove, or answer with a scene that does something else.
        </p>
      ) : (
        <>
          <PromiseList
            title="What the story owes"
            kind="obligatory"
            entries={owed}
            kept={status.keptObligatory}
            scenes={scenes}
            onUpdate={onUpdate}
            {...(onGoToUnit ? { onGoToUnit } : {})}
          />
          <PromiseList
            title="What it carries"
            kind="convention"
            entries={carried}
            kept={status.keptConventions}
            scenes={scenes}
            onUpdate={onUpdate}
            {...(onGoToUnit ? { onGoToUnit } : {})}
          />
        </>
      )}
    </div>
  );
}

interface PromiseListProps {
  title: string;
  kind: GridPromiseKind;
  entries: GridPromiseStatus[];
  kept: number;
  scenes: ReturnType<typeof unitsInStoryOrder>;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGoToUnit?(unitId: StructuralUnitId): void;
}

/** One list — what is owed, or what is carried — with what has been kept. */
function PromiseList({ title, kind, entries, kept, scenes, onUpdate, onGoToUnit }: PromiseListProps) {
  return (
    <section className="grid-promises">
      <h3>
        {title}
        <span className="muted small grid-count">
          {kept} of {entries.length} answered
        </span>
      </h3>

      {entries.length === 0 ? (
        <p className="muted small">Nothing on this list.</p>
      ) : (
        <ul className="grid-list">
          {entries.map((entry) => (
            <li key={entry.promise.id} className={entry.scene ? 'grid-promise kept' : 'grid-promise'}>
              <span className="grid-mark" aria-hidden="true">
                {entry.scene ? '●' : '○'}
              </span>

              <input
                className="grid-text"
                aria-label={`What is owed: ${entry.promise.text || 'unnamed'}`}
                value={entry.promise.text}
                placeholder="What the story owes here"
                onChange={(event) =>
                  onUpdate((current) => updateGridPromise(current, entry.promise.id, { text: event.target.value }))
                }
              />

              <select
                className="grid-scene"
                aria-label={`Which scene keeps: ${entry.promise.text || 'unnamed'}`}
                value={entry.promise.unitId ?? ''}
                onChange={(event) =>
                  onUpdate((current) =>
                    updateGridPromise(current, entry.promise.id, { unitId: event.target.value || null }),
                  )
                }
              >
                <option value="">Not yet</option>
                {scenes.map((unit, index) => (
                  <option key={unit.id} value={unit.id as string}>
                    {index + 1}. {unit.title || 'Untitled scene'}
                  </option>
                ))}
              </select>

              {entry.scene && onGoToUnit ? (
                <button
                  type="button"
                  className="ghost small"
                  aria-label={`Go to ${entry.scene.label}`}
                  onClick={() => onGoToUnit(entry.scene!.id)}
                >
                  Go
                </button>
              ) : null}

              <button
                type="button"
                className="ghost small"
                aria-label={`Remove: ${entry.promise.text || 'unnamed'}`}
                onClick={() => onUpdate((current) => removeGridPromise(current, entry.promise.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="ghost small"
        onClick={() => onUpdate((current) => addGridPromise(current, { kind }).file)}
      >
        + One of your own
      </button>
    </section>
  );
}
