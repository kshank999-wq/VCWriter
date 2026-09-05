import {
  addBeat,
  addLane,
  addUnit,
  beatsForUnit,
  lanesInOrder,
  moveBeat,
  moveLane,
  moveUnit,
  removeBeat,
  removeLane,
  removeUnit,
  unitsForLane,
  updateLane,
  updateUnit,
  type Beat,
  type BeatId,
  type LaneId,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { InlineText } from './InlineText';
import { adjustForSameList, dropClass, edgeFor, indexForDrop, useDragDrop } from '../drag';

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
 *
 * Everything is reorderable by drag, and by keyboard for anyone who cannot
 * drag — §15 asks for keyboard-centric workflows, and a drag-only structure
 * board would make the core organising gesture unreachable.
 */
export function StructureBoard({ file, selectedBeatId, onSelectBeat, onUpdate }: StructureBoardProps) {
  const drag = useDragDrop();
  const lanes = lanesInOrder(file);
  const containerNoun =
    file.project.format === 'novel' || file.project.format === 'short_story' ? 'chapter' : 'scene';

  const dropBeat = (toUnitId: StructuralUnitId, targetIndex: number) => {
    const payload = drag.payload;
    if (payload?.kind !== 'beat') return;
    const siblings = beatsForUnit(file, toUnitId);
    const currentIndex =
      payload.fromUnitId === toUnitId ? siblings.findIndex((beat) => beat.id === payload.id) : null;
    onUpdate((current) =>
      moveBeat(current, {
        beatId: payload.id,
        toUnitId,
        index: adjustForSameList(targetIndex, currentIndex === -1 ? null : currentIndex),
      }),
    );
    drag.end();
  };

  const dropUnit = (toLaneId: LaneId, targetIndex: number) => {
    const payload = drag.payload;
    if (payload?.kind !== 'unit') return;
    const siblings = unitsForLane(file, toLaneId);
    const currentIndex =
      payload.fromLaneId === toLaneId ? siblings.findIndex((unit) => unit.id === payload.id) : null;
    onUpdate((current) =>
      moveUnit(current, {
        unitId: payload.id,
        toLaneId,
        index: adjustForSameList(targetIndex, currentIndex === -1 ? null : currentIndex),
      }),
    );
    drag.end();
  };

  const dropLane = (targetIndex: number) => {
    const payload = drag.payload;
    if (payload?.kind !== 'lane') return;
    const currentIndex = lanes.findIndex((lane) => lane.id === payload.id);
    onUpdate((current) => moveLane(current, payload.id, adjustForSameList(targetIndex, currentIndex)));
    drag.end();
  };

  /**
   * Alt+↑/↓ reorders a lane.
   *
   * Reordering is the board's core gesture, and until this existed it could
   * only be done by dragging — which §15's keyboard-centric requirement rules
   * out, and which anyone using a keyboard, a screen reader or a trackball
   * simply could not do at all.
   */
  const moveLaneByKeyboard = (laneId: LaneId, direction: -1 | 1) => {
    const position = lanes.findIndex((candidate) => candidate.id === laneId);
    const next = position + direction;
    if (position < 0 || next < 0 || next >= lanes.length) return;
    onUpdate((current) => moveLane(current, laneId, next));
  };

  /** Alt+↑/↓ moves a scene within its lane; adding Shift moves it to the next lane. */
  const moveUnitByKeyboard = (
    unitId: StructuralUnitId,
    fromLaneId: LaneId,
    direction: -1 | 1,
    crossLane: boolean,
  ) => {
    if (crossLane) {
      const laneIndex = lanes.findIndex((candidate) => candidate.id === fromLaneId);
      const target = lanes[laneIndex + direction];
      if (!target) return;
      const index = direction === 1 ? 0 : unitsForLane(file, target.id).length;
      onUpdate((current) => moveUnit(current, { unitId, toLaneId: target.id, index }));
      return;
    }

    const siblings = unitsForLane(file, fromLaneId);
    const position = siblings.findIndex((candidate) => candidate.id === unitId);
    const next = position + direction;
    if (position < 0 || next < 0 || next >= siblings.length) return;
    onUpdate((current) => moveUnit(current, { unitId, toLaneId: fromLaneId, index: next }));
  };

  /** Alt+↑/↓ moves a beat within its scene; adding Shift moves it to the next scene. */
  const moveBeatByKeyboard = (beat: Beat, direction: -1 | 1, crossContainer: boolean) => {
    const allUnits = lanes.flatMap((lane) => unitsForLane(file, lane.id));
    const unitIndex = allUnits.findIndex((unit) => unit.id === beat.unitId);
    const siblings = beatsForUnit(file, beat.unitId);
    const position = siblings.findIndex((candidate) => candidate.id === beat.id);

    if (crossContainer) {
      const target = allUnits[unitIndex + direction];
      if (!target) return;
      const index = direction === 1 ? 0 : beatsForUnit(file, target.id).length;
      onUpdate((current) => moveBeat(current, { beatId: beat.id, toUnitId: target.id, index }));
      return;
    }

    const nextPosition = position + direction;
    if (nextPosition < 0 || nextPosition >= siblings.length) return;
    // `moveBeat` indexes the list with this beat lifted out, which is what
    // makes the same target index correct in both directions.
    onUpdate((current) => moveBeat(current, { beatId: beat.id, toUnitId: beat.unitId, index: nextPosition }));
  };

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

      {lanes.map((lane, laneIndex) => {
        const units = unitsForLane(file, lane.id);
        return (
          <section key={lane.id} className="lane">
            <header
              className={`lane-header${dropClass(drag.dropTarget, lane.id)}`}
              style={{ borderLeftColor: lane.color }}
              draggable
              onDragStart={(event) => drag.begin({ kind: 'lane', id: lane.id }, event)}
              onDragEnd={drag.end}
              onDragOver={(event) => {
                if (drag.payload?.kind !== 'lane') return;
                event.preventDefault();
                drag.hover(lane.id, edgeFor(event));
              }}
              onDragLeave={() => drag.clearHover(lane.id)}
              onDrop={(event) => {
                event.preventDefault();
                const edge = edgeFor(event);
                dropLane(indexForDrop(laneIndex, edge));
              }}
            >
              {/* A focusable handle, so reordering has a keyboard route and a
                  name a screen reader can announce. Dragging the header still
                  works for anyone who prefers it. */}
              <button
                type="button"
                className="ghost grip"
                aria-label={`Reorder lane ${lane.name}. Alt with up or down arrow.`}
                title="Alt+↑/↓ to reorder this lane"
                onKeyDown={(event) => {
                  if (!event.altKey) return;
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                  event.preventDefault();
                  moveLaneByKeyboard(lane.id, event.key === 'ArrowUp' ? -1 : 1);
                }}
              >
                ⠿
              </button>
              <button
                type="button"
                className="ghost twisty"
                aria-expanded={!lane.collapsed}
                aria-label={lane.collapsed ? `Expand ${lane.name}` : `Collapse ${lane.name}`}
                onClick={() => onUpdate((current) => updateLane(current, lane.id, { collapsed: !lane.collapsed }))}
              >
                {lane.collapsed ? '▸' : '▾'}
              </button>
              <InlineText
                value={lane.name}
                ariaLabel="Lane name"
                className="lane-name"
                onCommit={(name) => onUpdate((current) => updateLane(current, lane.id, { name }))}
              />
              <span className="count muted">{units.length}</span>
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
              {lanes.length > 1 ? (
                <button
                  type="button"
                  className="ghost danger"
                  title={`Remove lane and its ${containerNoun}s`}
                  onClick={() => onUpdate((current) => removeLane(current, lane.id))}
                >
                  ×
                </button>
              ) : null}
            </header>

            {lane.collapsed ? null : (
              <div
                className="lane-body"
                onDragOver={(event) => {
                  // Dropping in the empty space below the last scene appends.
                  if (drag.payload?.kind === 'unit') event.preventDefault();
                }}
                onDrop={(event) => {
                  if (drag.payload?.kind !== 'unit') return;
                  event.preventDefault();
                  dropUnit(lane.id, units.length);
                }}
              >
                {units.map((unit, unitIndex) => {
                  const beats = beatsForUnit(file, unit.id);
                  return (
                    <article
                      key={unit.id}
                      className={`unit${dropClass(drag.dropTarget, unit.id)}`}
                      onDragOver={(event) => {
                        if (drag.payload?.kind !== 'unit') return;
                        event.preventDefault();
                        event.stopPropagation();
                        drag.hover(unit.id, edgeFor(event));
                      }}
                      onDragLeave={() => drag.clearHover(unit.id)}
                      onDrop={(event) => {
                        if (drag.payload?.kind !== 'unit') return;
                        event.preventDefault();
                        event.stopPropagation();
                        dropUnit(lane.id, indexForDrop(unitIndex, edgeFor(event)));
                      }}
                    >
                      <header
                        draggable
                        onDragStart={(event) => {
                          event.stopPropagation();
                          drag.begin({ kind: 'unit', id: unit.id, fromLaneId: lane.id }, event);
                        }}
                        onDragEnd={drag.end}
                      >
                        <button
                          type="button"
                          className="ghost grip"
                          aria-label={`Reorder ${unit.title || `untitled ${unit.kind}`}. Alt with up or down arrow; add shift to move between lanes.`}
                          title={`Alt+↑/↓ to reorder · Alt+Shift+↑/↓ to move between lanes`}
                          onKeyDown={(event) => {
                            if (!event.altKey) return;
                            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                            event.preventDefault();
                            moveUnitByKeyboard(
                              unit.id,
                              lane.id,
                              event.key === 'ArrowUp' ? -1 : 1,
                              event.shiftKey,
                            );
                          }}
                        >
                          ⠿
                        </button>
                        <button
                          type="button"
                          className="ghost twisty"
                          aria-expanded={!unit.collapsed}
                          aria-label={unit.collapsed ? 'Expand' : 'Collapse'}
                          onClick={() =>
                            onUpdate((current) => updateUnit(current, unit.id, { collapsed: !unit.collapsed }))
                          }
                        >
                          {unit.collapsed ? '▸' : '▾'}
                        </button>
                        <InlineText
                          value={unit.sequenceLabel}
                          placeholder="Sc."
                          ariaLabel="Sequence label"
                          className="unit-label"
                          onCommit={(sequenceLabel) =>
                            onUpdate((current) => updateUnit(current, unit.id, { sequenceLabel }))
                          }
                        />
                        <InlineText
                          value={unit.title}
                          placeholder={`Untitled ${unit.kind}`}
                          ariaLabel={`${unit.kind} title`}
                          className="unit-title"
                          onCommit={(title) => onUpdate((current) => updateUnit(current, unit.id, { title }))}
                        />
                        <button
                          type="button"
                          className="ghost"
                          title="Add beat"
                          onClick={() =>
                            onUpdate((current) => addBeat(current, { unitId: unit.id, title: 'New beat' }).file)
                          }
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="ghost danger"
                          title={`Remove this ${unit.kind} and its beats`}
                          onClick={() => onUpdate((current) => removeUnit(current, unit.id))}
                        >
                          ×
                        </button>
                      </header>

                      {unit.collapsed ? (
                        <p className="muted empty">
                          {beats.length} {beats.length === 1 ? 'beat' : 'beats'}
                        </p>
                      ) : (
                        <>
                          <ul
                            onDragOver={(event) => {
                              if (drag.payload?.kind !== 'beat') return;
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onDrop={(event) => {
                              if (drag.payload?.kind !== 'beat') return;
                              event.preventDefault();
                              event.stopPropagation();
                              dropBeat(unit.id, beats.length);
                            }}
                          >
                            {beats.map((beat, beatIndex) => (
                              <li
                                key={beat.id}
                                className={dropClass(drag.dropTarget, beat.id).trim()}
                                draggable
                                onDragStart={(event) => {
                                  event.stopPropagation();
                                  drag.begin({ kind: 'beat', id: beat.id, fromUnitId: unit.id }, event);
                                }}
                                onDragEnd={drag.end}
                                onDragOver={(event) => {
                                  if (drag.payload?.kind !== 'beat') return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  drag.hover(beat.id, edgeFor(event));
                                }}
                                onDragLeave={() => drag.clearHover(beat.id)}
                                onDrop={(event) => {
                                  if (drag.payload?.kind !== 'beat') return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  dropBeat(unit.id, indexForDrop(beatIndex, edgeFor(event)));
                                }}
                              >
                                <button
                                  type="button"
                                  className={beat.id === selectedBeatId ? 'beat selected' : 'beat'}
                                  onClick={() => onSelectBeat(beat.id)}
                                  title="Alt+↑/↓ to reorder · Alt+Shift+↑/↓ to move between scenes"
                                  onKeyDown={(event) => {
                                    if (!event.altKey) return;
                                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                                    event.preventDefault();
                                    moveBeatByKeyboard(beat, event.key === 'ArrowUp' ? -1 : 1, event.shiftKey);
                                  }}
                                >
                                  {/* The internal beat title is an authoring reference only;
                                      it never reaches the manuscript (§5.3). */}
                                  <span className="beat-title">{beat.title || 'Untitled beat'}</span>
                                  <span className={`beat-status status-${beat.status}`}>{beat.status}</span>
                                </button>
                                <button
                                  type="button"
                                  className="ghost danger beat-remove"
                                  title="Remove beat"
                                  onClick={() => onUpdate((current) => removeBeat(current, beat.id))}
                                >
                                  ×
                                </button>
                              </li>
                            ))}
                          </ul>
                          {beats.length === 0 ? <p className="muted empty">No beats yet.</p> : null}
                        </>
                      )}
                    </article>
                  );
                })}
                {units.length === 0 ? <p className="muted empty">No {containerNoun}s in this lane.</p> : null}
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}
