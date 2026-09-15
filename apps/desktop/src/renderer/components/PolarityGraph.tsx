import { useMemo, useState } from 'react';
import {
  FLAT_SCENE_PROMPT,
  POLARITIES,
  POLARITY_NAMES,
  POLARITY_STEPS,
  PURPOSE_MEANINGS,
  PURPOSE_NAMES,
  SCENE_PURPOSES,
  describePolarity,
  gridOf,
  polarityGraph,
  setOtherPurpose,
  setPolarity,
  togglePurpose,
  type PolarityValue,
  type ProjectFile,
  type ScenePurpose,
  type StructuralUnitId,
  nounsFor,
} from '@vcwriter/domain';

/**
 * The polarity graph (addendum 13 §3).
 *
 * Every scene in script order, on an axis with **neutral through the middle**:
 * positive above the line, negative below. Each scene draws its *start* and its
 * *end* joined by a stroke, so the thing you see is the **turn** — which is what
 * the spec asks for and what a single point per scene could not show. The ends
 * are then joined scene to scene, so where one closes and the next opens is
 * visible as well.
 *
 * **A flat scene is marked, never condemned.** It gets a ring rather than a
 * colour of shame, and the note beside it is a prompt: whether it needs a turn,
 * an escalation, a reversal or nothing at all is the writer's to decide, and a
 * module that said *cut this* would be wrong half the time and trusted never.
 *
 * **A scene nobody has read is drawn as a gap**, not skipped. A graph that
 * dropped the unanswered scenes would draw a continuous story and quietly lie
 * about how much of it has been looked at.
 */
interface PolarityGraphProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGoToUnit?(unitId: StructuralUnitId): void;
}

/** Room for five rows and the scene labels under them. */
const ROW_HEIGHT = 34;
const COLUMN = 78;
const TOP = 14;
const BOTTOM = 34;

export function PolarityGraph({ file, onUpdate, onGoToUnit }: PolarityGraphProps) {
  const graph = useMemo(() => polarityGraph(file), [file]);
  const nouns = nounsFor(file.project.format);
  const [openId, setOpenId] = useState<StructuralUnitId | null>(null);

  const open = graph.points.find((one) => one.unitId === openId) ?? null;
  const height = TOP + ROW_HEIGHT * 4 + BOTTOM;
  const width = Math.max(240, graph.points.length * COLUMN);
  /** Where a value sits vertically. Neutral is the middle line. */
  const y = (step: number) => TOP + (2 - step) * ROW_HEIGHT;
  const x = (index: number) => index * COLUMN + COLUMN / 2;

  return (
    <div className="polarity">
      <header className="polarity-head">
        <h3>{nouns.unit} polarity</h3>
        <p className="muted small">{describePolarity(file)}</p>
        <p className="muted small">
          Where each scene begins and where it ends. Flat means it ends where it started — worked
          out, never chosen.
        </p>
      </header>

      {graph.points.length === 0 ? (
        <p className="muted">No {nouns.unitPlural.toLowerCase()} in the {nouns.manuscript.toLowerCase()} yet.</p>
      ) : (
        <div className="polarity-chart">
          <div className="polarity-axis" aria-hidden="true">
            {graph.rows.map((row) => (
              <div key={row} className="polarity-row-label" style={{ height: ROW_HEIGHT }}>
                {POLARITY_NAMES[row]}
              </div>
            ))}
          </div>

          <div className="polarity-scroll">
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${nouns.unit} polarity across the ${nouns.manuscript.toLowerCase()}`}
            >
              {/* The five rows, with neutral through the middle. */}
              {graph.rows.map((row) => {
                const at = y(POLARITY_STEPS[row]);
                return (
                  <line
                    key={row}
                    className={row === 'neutral' ? 'polarity-grid neutral' : 'polarity-grid'}
                    x1={0}
                    y1={at}
                    x2={width}
                    y2={at}
                  />
                );
              })}

              {/* Scene to scene: how one closed and how the next opened. */}
              {graph.points.map((point, at) => {
                const next = graph.points[at + 1];
                if (!point.turn.said || !next?.turn.said) return null;
                return (
                  <line
                    key={`between-${point.unitId}`}
                    className="polarity-between"
                    x1={x(at) + 16}
                    y1={y(POLARITY_STEPS[point.turn.end as keyof typeof POLARITY_STEPS])}
                    x2={x(at + 1) - 16}
                    y2={y(POLARITY_STEPS[next.turn.start as keyof typeof POLARITY_STEPS])}
                  />
                );
              })}

              {graph.points.map((point, at) => {
                if (!point.turn.said) {
                  // A gap, drawn as a gap: nobody has read this scene.
                  return (
                    <g key={point.unitId} className="polarity-scene unsaid" onClick={() => setOpenId(point.unitId)}>
                      {/* The whole column is the target. A scene with nothing
                          drawn on it is the one a writer most wants to click,
                          and a dot is not something anybody can hit. */}
                      <rect className="polarity-hit" x={at * COLUMN} y={0} width={COLUMN} height={height} />
                      <text className="polarity-number" x={x(at)} y={height - 16} textAnchor="middle">
                        {point.number}
                      </text>
                      <text className="polarity-gap" x={x(at)} y={y(0)} textAnchor="middle">
                        ·
                      </text>
                      <title>{`Scene ${point.number}${point.title ? ` — ${point.title}` : ''}: not read yet`}</title>
                    </g>
                  );
                }
                const from = y(POLARITY_STEPS[point.turn.start as keyof typeof POLARITY_STEPS]);
                const to = y(POLARITY_STEPS[point.turn.end as keyof typeof POLARITY_STEPS]);
                return (
                  <g
                    key={point.unitId}
                    className={`polarity-scene${point.turn.flat ? ' flat' : ''}${openId === point.unitId ? ' open' : ''}`}
                    onClick={() => setOpenId(point.unitId)}
                    onDoubleClick={() => onGoToUnit?.(point.unitId)}
                  >
                    <rect className="polarity-hit" x={at * COLUMN} y={0} width={COLUMN} height={height} />
                    {/* The turn: start to end, which is the whole point. */}
                    <line className="polarity-turn" x1={x(at) - 16} y1={from} x2={x(at) + 16} y2={to} />
                    <circle className="polarity-start" cx={x(at) - 16} cy={from} r={3.5} />
                    <circle className="polarity-end" cx={x(at) + 16} cy={to} r={4.5} />
                    <text className="polarity-number" x={x(at)} y={height - 16} textAnchor="middle">
                      {point.number}
                    </text>
                    <title>
                      {`Scene ${point.number}${point.title ? ` — ${point.title}` : ''}: ` +
                        `${POLARITY_NAMES[point.turn.start as keyof typeof POLARITY_NAMES]} → ` +
                        `${POLARITY_NAMES[point.turn.end as keyof typeof POLARITY_NAMES]}` +
                        `${point.turn.flat ? ' · flat' : ''}`}
                    </title>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* The scene that has been picked: its two ends, what it is for, and —
          where it is flat — the prompt. Selecting rather than hovering, because
          a panel that vanished when the pointer moved could not be typed in. */}
      {open ? (
        <section className="polarity-scene-detail">
          <header>
            <h4>
              Scene {open.number}
              {open.title ? ` — ${open.title}` : ''}
            </h4>
            {onGoToUnit ? (
              <button type="button" className="ghost small" onClick={() => onGoToUnit(open.unitId)}>
                Open it
              </button>
            ) : null}
          </header>

          <PolarityPair
            start={open.turn.start}
            end={open.turn.end}
            onChange={(patch) => onUpdate((current) => setPolarity(current, open.unitId, patch))}
          />

          {open.turn.said ? (
            <p className={open.turn.flat ? 'polarity-flat-note' : 'muted small'}>
              {open.turn.flat
                ? FLAT_SCENE_PROMPT
                : `Changes by ${open.turn.distance} ${open.turn.distance === 1 ? 'step' : 'steps'}.`}
            </p>
          ) : (
            <p className="muted small">Set both ends and this {nouns.unit.toLowerCase()} says whether it turns.</p>
          )}

          <h5>What it is for</h5>
          <div className="polarity-purposes">
            {SCENE_PURPOSES.map((purpose) => {
              const on = open.purposes.includes(purpose);
              return (
                <label key={purpose} className="check" title={PURPOSE_MEANINGS[purpose]}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onUpdate((current) => togglePurpose(current, open.unitId, purpose))}
                  />
                  <span>{PURPOSE_NAMES[purpose]}</span>
                </label>
              );
            })}
          </div>
          {open.purposes.includes('other' as ScenePurpose) ? (
            <label className="field">
              <span>What else it does</span>
              <input
                aria-label="Other purpose"
                value={gridOf(file, open.unitId).otherPurpose}
                onChange={(event) =>
                  onUpdate((current) => setOtherPurpose(current, open.unitId, event.target.value))
                }
              />
            </label>
          ) : null}
          {open.purposeUndefined ? (
            <p className="muted small">Purpose not defined. Nothing follows from that on its own.</p>
          ) : null}
        </section>
      ) : (
        <p className="muted small">Pick a {nouns.unit.toLowerCase()} on the graph to set where it begins and ends.</p>
      )}

      {/* Every flat scene in one place, so a pass can be made over them. */}
      {graph.flat > 0 ? (
        <section className="polarity-flat-list">
          <h4>Flat scenes ({graph.flat})</h4>
          <p className="muted small">Each ends where it started. Whether that is a problem is yours to say.</p>
          <ul>
            {graph.points
              .filter((one) => one.turn.said && one.turn.flat)
              .map((one) => (
                <li key={one.unitId}>
                  <button type="button" className="ghost small" onClick={() => setOpenId(one.unitId)}>
                    Scene {one.number}
                    {one.title ? ` — ${one.title}` : ''}
                  </button>
                  <span className="muted small">
                    {POLARITY_NAMES[one.turn.start as keyof typeof POLARITY_NAMES]} throughout
                    {one.purposes.length > 0
                      ? ` · ${one.purposes.map((purpose) => PURPOSE_NAMES[purpose]).join(', ')}`
                      : ' · purpose not defined'}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The compact control: where it begins, where it ends.
 *
 * Two selects and nothing else — §2 asks that it require minimal interaction,
 * and there is deliberately no third control for *changed or flat*, because
 * that is not something a writer gets to answer.
 */
export function PolarityPair({
  start,
  end,
  onChange,
}: {
  start: PolarityValue;
  end: PolarityValue;
  onChange(patch: { start?: PolarityValue; end?: PolarityValue }): void;
}) {
  return (
    <div className="polarity-pair">
      <label className="field">
        <span>Begins</span>
        <select
          aria-label="Start polarity"
          value={start}
          onChange={(event) => onChange({ start: event.target.value as PolarityValue })}
        >
          <option value="">Not said</option>
          {[...POLARITIES].reverse().map((one) => (
            <option key={one} value={one}>
              {POLARITY_NAMES[one]}
            </option>
          ))}
        </select>
      </label>
      <span className="polarity-arrow" aria-hidden="true">
        →
      </span>
      <label className="field">
        <span>Ends</span>
        <select
          aria-label="End polarity"
          value={end}
          onChange={(event) => onChange({ end: event.target.value as PolarityValue })}
        >
          <option value="">Not said</option>
          {[...POLARITIES].reverse().map((one) => (
            <option key={one} value={one}>
              {POLARITY_NAMES[one]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
