import {
  valueGraph,
  valueGraphLayout,
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
 * **The geometry is the domain's** (`valueGraphLayout`), and the printed grid
 * draws from the same numbers — a chart that disagreed with its own printing
 * would be worse than no chart.
 */

interface ValueGraphProps {
  rows: readonly GridRow[];
  onGoToUnit?(unitId: StructuralUnitId): void;
}

export function ValueGraph({ rows, onGoToUnit }: ValueGraphProps) {
  const graph = valueGraph(rows);
  if (graph.points.length < 2) return null;

  const note = valueGraphNote(graph);
  // The same numbers the printed grid draws from (addendum 04 §6).
  const layout = valueGraphLayout(graph);

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
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          role="img"
          aria-label={`The story's value across ${graph.points.length} scenes`}
        >
          {/* Where the story started. Everything is read against this. */}
          <line className="value-base" x1={0} y1={layout.base} x2={layout.width} y2={layout.base} />

          {layout.acts.map((act) => (
            <g key={act.label} className="value-act">
              <line x1={act.x} y1={0} x2={act.x} y2={layout.height} />
              <text x={act.x + 4} y={12}>
                {act.label}
              </text>
            </g>
          ))}

          <path className="value-line" d={layout.path} />

          {layout.points.map(({ x, y, point }) => (
            <g key={point.unitId as string} className={point.said ? 'value-point' : 'value-point unsaid'}>
              <circle
                cx={x}
                cy={y}
                r={3.5}
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
