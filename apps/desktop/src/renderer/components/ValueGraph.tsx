import {
  valueGraph,
  valueGraphNote,
  type GridRow,
  type StructuralUnitId,
} from '@vcwriter/domain';

/**
 * The value graph (addendum 04 §6).
 *
 * The polarity column, plotted: the story's value across its scenes, running
 * left to right, one point each. A story that never goes below the line, or
 * never comes back above it, is a story with a problem — and this says so in
 * a glance where fifty rows would not.
 *
 * **It does not grade** (§7). The line is the writer's own answers drawn in
 * order; the one sentence under it is an observation, and a story that only
 * rises may be exactly the story being written.
 *
 * Drawn as an SVG on a `viewBox` rather than measured pixels, so it fits
 * whatever width the tab has without anything having to be told the size.
 */

interface ValueGraphProps {
  rows: readonly GridRow[];
  onGoToUnit?(unitId: StructuralUnitId): void;
}

/**
 * The drawing's geometry, in the pixels it is actually drawn at.
 *
 * The `viewBox` uses these same numbers rather than a scaled-down set, so a
 * `font-size` in the stylesheet means what it says — scaling the whole SVG up
 * scales the lettering with it, and an act label ends up three times the size
 * of everything around it.
 */
/** Pixels between one scene and the next. */
const SIDE = 26;
/** Pixels for one step of value. */
const BAND = 34;
/** Room above the highest point for the act labels. */
const TOP = 20;

export function ValueGraph({ rows, onGoToUnit }: ValueGraphProps) {
  const graph = valueGraph(rows);
  if (graph.points.length < 2) return null;

  const note = valueGraphNote(graph);
  const span = Math.max(1, graph.high - graph.low);
  const height = span * BAND + TOP * 2;
  // A point every `SIDE`, with half a step of air at each end so the first
  // and last markers are not cut in half by the frame.
  const width = (graph.points.length - 1) * SIDE + SIDE * 2;

  const x = (index: number) => SIDE + index * SIDE;
  const y = (value: number) => TOP + (graph.high - value) * BAND;
  const base = y(0);

  const line = graph.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.value)}`).join(' ');
  const dot = 3.5;

  // Where each act begins, so the eye can tell a fall inside one act from a
  // fall across the whole story.
  const acts = graph.points
    .map((point, index) => ({ point, index }))
    .filter(({ point, index }) => point.act.length > 0 && point.act !== graph.points[index - 1]?.act);

  return (
    <section className="value-graph">
      <h3>
        The value
        <span className="muted small grid-count">
          {graph.said === 0
            ? 'nothing said yet'
            : `${graph.said} of ${graph.points.length} ${graph.points.length === 1 ? 'scene' : 'scenes'}`}
        </span>
      </h3>
      <p className="muted small commandments-note">
        Which way each scene moves, added up and drawn in order. The line is the writer&rsquo;s own answers — a
        scene nobody has answered holds the line rather than flattening it.
      </p>

      <div className="value-graph-scroll">
        <svg
          className="value-svg"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`The story's value across ${graph.points.length} scenes`}
        >
          {/* Where the story started. Everything is read against this. */}
          <line className="value-base" x1={0} y1={base} x2={width} y2={base} />

          {acts.map(({ point, index }) => (
            <g key={point.unitId as string} className="value-act">
              <line x1={x(index) - SIDE / 2} y1={0} x2={x(index) - SIDE / 2} y2={height} />
              <text x={x(index) - SIDE / 2 + 4} y={12}>
                {point.act}
              </text>
            </g>
          ))}

          <path className="value-line" d={line} />

          {graph.points.map((point, index) => (
            <g key={point.unitId as string} className={point.said ? 'value-point' : 'value-point unsaid'}>
              <circle
                cx={x(index)}
                cy={y(point.value)}
                r={dot}
                {...(onGoToUnit ? { onClick: () => onGoToUnit(point.unitId) } : {})}
              >
                <title>
                  {point.position}. {point.label}
                  {point.said ? '' : ' — not said'}
                </title>
              </circle>
            </g>
          ))}
        </svg>
      </div>

      {note ? (
        <p className="muted small value-note" role="status">
          {note}
        </p>
      ) : null}
    </section>
  );
}
