import {
  addBeat,
  addLane,
  addUnit,
  beatsForUnit,
  lanesInOrder,
  unitsForLane,
  type BeatId,
  type ProjectFile,
} from '@vcwriter/domain';

interface StructureBoardProps {
  file: ProjectFile;
  selectedBeatId: BeatId | null;
  onSelectBeat(beatId: BeatId): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * Lanes → scene/chapter containers → beats (spec §5).
 *
 * The nesting on screen is the nesting in the data: a beat is always drawn
 * inside a container, and there is no affordance for creating one anywhere
 * else, because the model does not allow it (§19).
 */
export function StructureBoard({ file, selectedBeatId, onSelectBeat, onUpdate }: StructureBoardProps) {
  const containerNoun = file.project.format === 'novel' || file.project.format === 'short_story' ? 'chapter' : 'scene';

  return (
    <aside className="structure">
      <div className="structure-header">
        <h2>Structure</h2>
        <button
          type="button"
          className="ghost"
          onClick={() => onUpdate((current) => addLane(current, { name: 'New lane' }).file)}
        >
          + Lane
        </button>
      </div>

      {lanesInOrder(file).map((lane) => (
        <section key={lane.id} className="lane">
          <header style={{ borderLeftColor: lane.color }}>
            <h3>{lane.name}</h3>
            <button
              type="button"
              className="ghost"
              title={`Add ${containerNoun}`}
              onClick={() =>
                onUpdate((current) => addUnit(current, { laneId: lane.id, title: `New ${containerNoun}` }).file)
              }
            >
              +
            </button>
          </header>

          {unitsForLane(file, lane.id).map((unit) => (
            <article key={unit.id} className="unit">
              <header>
                <span className="unit-label">{unit.sequenceLabel || unit.kind}</span>
                <span className="unit-title">{unit.title || 'Untitled'}</span>
                <button
                  type="button"
                  className="ghost"
                  title="Add beat"
                  onClick={() => onUpdate((current) => addBeat(current, { unitId: unit.id, title: 'New beat' }).file)}
                >
                  +
                </button>
              </header>
              <ul>
                {beatsForUnit(file, unit.id).map((beat) => (
                  <li key={beat.id}>
                    <button
                      type="button"
                      className={beat.id === selectedBeatId ? 'beat selected' : 'beat'}
                      onClick={() => onSelectBeat(beat.id)}
                    >
                      {/* The internal beat title is an authoring reference only;
                          it never reaches the manuscript (§5.3). */}
                      <span className="beat-title">{beat.title || 'Untitled beat'}</span>
                      <span className={`beat-status status-${beat.status}`}>{beat.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {beatsForUnit(file, unit.id).length === 0 ? <p className="muted empty">No beats yet.</p> : null}
            </article>
          ))}
        </section>
      ))}
    </aside>
  );
}
