import { useMemo } from 'react';
import {
  addBeat,
  beatsForUnit,
  moveBeat,
  moveLane,
  moveUnit,
  removeBeat,
  removeLane,
  removeMarker,
  removeUnit,
  spanWidth,
  storyLayout,
  threadLayout,
  timelineArcs,
  unitsForLane,
  updateLane,
  updateMarker,
  updateUnit,
  type Beat,
  type BeatId,
  type Lane,
  type LaneId,
  type ProjectFile,
  type StoryLayout,
  type StorySpan,
  type StructuralUnitId,
  type ThreadLayout,
  type TimelineArc,
} from '@vcwriter/domain';
import { InlineText } from './InlineText';
import { STATUS_GLYPH } from './status';
import { adjustForSameList, dropClass, edgeFor, indexForDrop, useDragDrop, type DropEdge } from '../drag';

interface MasterTimelineProps {
  file: ProjectFile;
  /** Precomputed by the workspace so a keystroke paginates the story once, not per pane. */
  layout?: StoryLayout;
  arcs?: TimelineArc[];
  threads?: ThreadLayout;
  selectedBeatId: BeatId | null;
  onSelectBeat(beatId: BeatId): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  pixelsPerPage: number;
  onZoom(pixelsPerPage: number): void;
  inspectorOpen: boolean;
  onToggleInspector(): void;
  onAddScene(): void;
  onAddBeat(): void;
  onAddLane(): void;
  onAddAct(): void;
  /** The track header was clicked: open the plot's summary and arc. */
  onOpenLane(laneId: LaneId): void;
  /** A scene block's header was clicked: open the scene pop-up. */
  onOpenUnit?(unitId: StructuralUnitId): void;
  /** A beat row was double-clicked: open the beat pop-up. */
  onOpenBeat?(beatId: BeatId): void;
}

const HEAD_WIDTH = 168;
const LINKS_HEIGHT = 44;

/**
 * The master timeline (addendum 02 §4): the story in order across the top
 * of the workspace. One CSS grid holds every track — ruler, acts, links and
 * a row per plot lane — with one column per scene, sized to the scene's
 * pages. Because every track shares the columns, blocks in different lanes
 * line up by story position with no measuring, and the playhead is nothing
 * more than a class on the selected scene's column.
 *
 * Reordering by drag and by keyboard both go through the same domain
 * mutations, and every draggable thing is a focusable element with a name
 * (§15): the timeline works with a keyboard alone.
 */
export function MasterTimeline({
  file,
  layout: givenLayout,
  arcs: givenArcs,
  threads: givenThreads,
  selectedBeatId,
  onSelectBeat,
  onUpdate,
  pixelsPerPage,
  onZoom,
  inspectorOpen,
  onToggleInspector,
  onAddScene,
  onAddBeat,
  onAddLane,
  onAddAct,
  onOpenLane,
  onOpenUnit,
  onOpenBeat,
}: MasterTimelineProps) {
  const drag = useDragDrop();
  const layout = useMemo(() => givenLayout ?? storyLayout(file), [givenLayout, file]);
  const arcs = useMemo(() => givenArcs ?? timelineArcs(file), [givenArcs, file]);
  const threads = useMemo(() => givenThreads ?? threadLayout(file, { layout, arcs }), [givenThreads, file, layout, arcs]);
  const { spans, lanes } = layout;
  const noun = file.project.format === 'novel' || file.project.format === 'short_story' ? 'chapter' : 'scene';

  const selectedBeat = selectedBeatId ? file.beats.find((beat) => beat.id === selectedBeatId) : undefined;
  const selectedUnitId = selectedBeat?.unitId ?? null;

  const widths = spans.map((span) => spanWidth(span, pixelsPerPage));
  const columns = `${HEAD_WIDTH}px ${widths.map((width) => `${width}px`).join(' ')} minmax(96px, 1fr)`;
  const storyIndex = (unitId: StructuralUnitId) => spans.findIndex((span) => span.unit.id === unitId);

  // ----------------------------------------------------------------- drops

  const dropUnitAt = (toLaneId: LaneId, targetIndex: number) => {
    const payload = drag.payload;
    if (payload?.kind !== 'unit') return;
    const currentIndex = storyIndex(payload.id);
    onUpdate((current) =>
      moveUnit(current, {
        unitId: payload.id,
        toLaneId,
        index: adjustForSameList(targetIndex, currentIndex === -1 ? null : currentIndex),
      }),
    );
    drag.end();
  };

  const dropBeatAt = (toUnitId: StructuralUnitId, targetIndex: number) => {
    const payload = drag.payload;
    if (payload?.kind !== 'beat') return;
    const siblings = beatsForUnit(file, toUnitId);
    const currentIndex = payload.fromUnitId === toUnitId ? siblings.findIndex((beat) => beat.id === payload.id) : null;
    onUpdate((current) =>
      moveBeat(current, {
        beatId: payload.id,
        toUnitId,
        index: adjustForSameList(targetIndex, currentIndex === -1 ? null : currentIndex),
      }),
    );
    drag.end();
  };

  const dropLaneAt = (targetIndex: number) => {
    const payload = drag.payload;
    if (payload?.kind !== 'lane') return;
    const currentIndex = lanes.findIndex((lane) => lane.id === payload.id);
    onUpdate((current) => moveLane(current, payload.id, adjustForSameList(targetIndex, currentIndex)));
    drag.end();
  };

  // -------------------------------------------------------------- keyboard

  const moveLaneByKeyboard = (laneId: LaneId, direction: -1 | 1) => {
    const position = lanes.findIndex((candidate) => candidate.id === laneId);
    const next = position + direction;
    if (position < 0 || next < 0 || next >= lanes.length) return;
    onUpdate((current) => moveLane(current, laneId, next));
  };

  /** Alt+↑/↓ moves a scene earlier/later in the story; with Shift, to the neighbouring lane. */
  const moveUnitByKeyboard = (unitId: StructuralUnitId, fromLaneId: LaneId, direction: -1 | 1, crossLane: boolean) => {
    if (crossLane) {
      const laneIndex = lanes.findIndex((candidate) => candidate.id === fromLaneId);
      const target = lanes[laneIndex + direction];
      if (!target) return;
      onUpdate((current) => moveUnit(current, { unitId, toLaneId: target.id, keepPosition: true }));
      return;
    }
    const position = storyIndex(unitId);
    const next = position + direction;
    if (position < 0 || next < 0 || next >= spans.length) return;
    onUpdate((current) => moveUnit(current, { unitId, toLaneId: fromLaneId, index: next }));
  };

  const moveBeatByKeyboard = (beat: Beat, direction: -1 | 1, crossContainer: boolean) => {
    const unitIndex = storyIndex(beat.unitId);
    const siblings = beatsForUnit(file, beat.unitId);
    const position = siblings.findIndex((candidate) => candidate.id === beat.id);
    if (crossContainer) {
      const target = spans[unitIndex + direction]?.unit;
      if (!target) return;
      const index = direction === 1 ? 0 : beatsForUnit(file, target.id).length;
      onUpdate((current) => moveBeat(current, { beatId: beat.id, toUnitId: target.id, index }));
      return;
    }
    const nextPosition = position + direction;
    if (nextPosition < 0 || nextPosition >= siblings.length) return;
    onUpdate((current) => moveBeat(current, { beatId: beat.id, toUnitId: beat.unitId, index: nextPosition }));
  };

  const reorderKeys =
    (handler: (direction: -1 | 1, shift: boolean) => void) => (event: React.KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      handler(event.key === 'ArrowUp' ? -1 : 1, event.shiftKey);
    };

  // --------------------------------------------------------------- render

  const playhead = (unitId: string) => (unitId === selectedUnitId ? ' playhead' : '');

  return (
    <section className="timeline" aria-label="Master timeline">
      <div className="timeline-scroll">
        <div className="timeline-grid" style={{ gridTemplateColumns: columns }}>
          {/* Pages */}
          <div className="track-head ruler-head">Pages</div>
          {spans.map((span) => (
            <div key={span.unit.id} className={`ruler-cell${playhead(span.unit.id)}`}>
              <span>{Math.floor(span.startPage) + 1}</span>
            </div>
          ))}
          <div className="ruler-cell tail">
            <span className="muted">{layout.totalPages < 0.05 ? '' : `${Math.ceil(layout.totalPages)} pp.`}</span>
          </div>

          {/* Acts */}
          <div className="track-head">
            Acts
          </div>
          <ActsTrack layout={layout} playheadUnitId={selectedUnitId} onUpdate={onUpdate} />
          <div className="acts-cell tail" />

          {/* Links */}
          <div className="track-head">Links</div>
          <LinksTrack
            arcs={arcs}
            widths={widths}
            spans={spans}
            onPick={(index) => {
              const first = beatsForUnit(file, spans[index]!.unit.id)[0];
              if (first) onSelectBeat(first.id);
            }}
          />
          <div className="links-cell tail" />

          {/* One track per lane */}
          {lanes.map((lane, laneIndex) => (
            <LaneTrack
              key={lane.id}
              file={file}
              lane={lane}
              laneIndex={laneIndex}
              laneCount={lanes.length}
              spans={spans}
              noun={noun}
              selectedBeatId={selectedBeatId}
              selectedUnitId={selectedUnitId}
              drag={drag}
              speakers={threads.speakers}
              colours={threads.colours}
              onSelectBeat={onSelectBeat}
              onOpenLane={onOpenLane}
              onOpenUnit={onOpenUnit}
              onOpenBeat={onOpenBeat}
              onUpdate={onUpdate}
              onDropUnit={dropUnitAt}
              onDropBeat={dropBeatAt}
              onDropLane={dropLaneAt}
              onLaneKeys={reorderKeys((direction) => moveLaneByKeyboard(lane.id, direction))}
              unitKeys={(unitId) => reorderKeys((direction, shift) => moveUnitByKeyboard(unitId, lane.id, direction, shift))}
              beatKeys={(beat) => reorderKeys((direction, shift) => moveBeatByKeyboard(beat, direction, shift))}
            />
          ))}
        </div>
      </div>

      <footer className="timeline-toolbar">
        <button type="button" className="tool" onClick={onAddScene}>
          + {noun === 'chapter' ? 'Chapter' : 'Scene'}
        </button>
        <button type="button" className="tool" onClick={onAddBeat} disabled={!selectedUnitId}>
          + Beat
        </button>
        <button type="button" className="tool" onClick={onAddLane}>
          + Lane
        </button>
        <button type="button" className="tool" onClick={onAddAct} disabled={!selectedUnitId}>
          + Act
        </button>
        <label className="zoom">
          <span className="muted">Zoom</span>
          <input
            type="range"
            min={60}
            max={400}
            step={10}
            value={pixelsPerPage}
            aria-label="Timeline zoom, pixels per page"
            onChange={(event) => onZoom(Number(event.target.value))}
          />
        </label>
        <span className="toolbar-spacer" />
        <button
          type="button"
          className={inspectorOpen ? 'tool active' : 'tool'}
          aria-pressed={inspectorOpen}
          title="Inspector (Ctrl/Cmd+Shift+P)"
          onClick={onToggleInspector}
        >
          Inspector
        </button>
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ActsTrack({
  layout,
  playheadUnitId,
  onUpdate,
}: {
  layout: ReturnType<typeof storyLayout>;
  playheadUnitId: string | null;
  onUpdate: MasterTimelineProps['onUpdate'];
}) {
  const cells: React.ReactNode[] = [];
  const { spans, acts } = layout;
  let index = 0;
  while (index < spans.length) {
    const band = acts.find((candidate) => candidate.fromIndex === index);
    const span = spans[index]!;
    if (band) {
      const count = band.toIndex - band.fromIndex + 1;
      cells.push(
        <div
          key={band.marker.id}
          className={`acts-cell band${span.unit.id === playheadUnitId ? ' playhead' : ''}`}
          style={{ gridColumn: `span ${count}` }}
        >
          <InlineText
            value={band.marker.title}
            placeholder={band.marker.kind}
            ariaLabel="Act title"
            className="act-title"
            onCommit={(title) => onUpdate((current) => updateMarker(current, band.marker.id, { title }))}
          />
          <button
            type="button"
            className="ghost danger"
            title="Remove marker"
            onClick={() => onUpdate((current) => removeMarker(current, band.marker.id))}
          >
            ×
          </button>
        </div>,
      );
      index += count;
    } else {
      cells.push(<div key={span.unit.id} className={`acts-cell${span.unit.id === playheadUnitId ? ' playhead' : ''}`} />);
      index += 1;
    }
  }
  return <>{cells}</>;
}

/**
 * The links track: setups, payoffs and story links as curves from the scene
 * they start in to the scene they land in. One SVG spans every scene column
 * (`grid-column: span n`), so the x of a column is the running sum of the
 * widths the grid was given — the same numbers, no measuring.
 */
function LinksTrack({
  arcs,
  widths,
  spans,
  onPick,
}: {
  arcs: TimelineArc[];
  widths: number[];
  spans: StorySpan[];
  onPick(index: number): void;
}) {
  if (spans.length === 0) return null;
  const total = widths.reduce((sum, width) => sum + width, 0);
  const starts: number[] = [];
  let x = 0;
  for (const width of widths) {
    starts.push(x);
    x += width;
  }
  const centre = (index: number) => starts[index]! + Math.min(widths[index]! / 2, 60);
  const baseline = LINKS_HEIGHT - 6;

  return (
    <div className="links-cell" style={{ gridColumn: `span ${spans.length}` }}>
      <svg width={total} height={LINKS_HEIGHT} viewBox={`0 0 ${total} ${LINKS_HEIGHT}`} role="list" aria-label="Setups, payoffs and links">
        {arcs.map((arc) => {
          const from = centre(arc.fromIndex);
          if (arc.toIndex === null) {
            // An unpaid setup reaches forward and stops in the air.
            const reach = Math.min(90, total - from - 4);
            return (
              <g key={arc.id} className="arc open" role="listitem">
                <path d={`M ${from} ${baseline} Q ${from + reach / 2} ${baseline - 22} ${from + reach} ${baseline - 18}`} />
                <circle cx={from} cy={baseline} r={3} />
                <title>{arc.label}</title>
              </g>
            );
          }
          const to = centre(arc.toIndex);
          const lift = Math.min(LINKS_HEIGHT - 8, 14 + Math.abs(to - from) / 12);
          return (
            <g key={arc.id} className={`arc ${arc.kind}`} role="listitem" onClick={() => onPick(arc.toIndex as number)}>
              <path d={`M ${from} ${baseline} C ${from} ${baseline - lift}, ${to} ${baseline - lift}, ${to} ${baseline}`} />
              <circle cx={from} cy={baseline} r={3} />
              <circle cx={to} cy={baseline} r={3} className="land" />
              <title>{arc.label}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface LaneTrackProps {
  file: ProjectFile;
  lane: Lane;
  laneIndex: number;
  laneCount: number;
  spans: StorySpan[];
  noun: string;
  selectedBeatId: BeatId | null;
  selectedUnitId: string | null;
  drag: ReturnType<typeof useDragDrop>;
  speakers: Map<BeatId, string[]>;
  colours: Map<string, string>;
  onSelectBeat(beatId: BeatId): void;
  onOpenLane(laneId: LaneId): void;
  onOpenUnit: MasterTimelineProps['onOpenUnit'];
  onOpenBeat: MasterTimelineProps['onOpenBeat'];
  onUpdate: MasterTimelineProps['onUpdate'];
  onDropUnit(toLaneId: LaneId, index: number): void;
  onDropBeat(toUnitId: StructuralUnitId, index: number): void;
  onDropLane(index: number): void;
  onLaneKeys(event: React.KeyboardEvent): void;
  unitKeys(unitId: StructuralUnitId): (event: React.KeyboardEvent) => void;
  beatKeys(beat: Beat): (event: React.KeyboardEvent) => void;
}

function LaneTrack({
  file,
  lane,
  laneIndex,
  laneCount,
  spans,
  noun,
  selectedBeatId,
  selectedUnitId,
  drag,
  speakers,
  colours,
  onSelectBeat,
  onOpenLane,
  onOpenUnit,
  onOpenBeat,
  onUpdate,
  onDropUnit,
  onDropBeat,
  onDropLane,
  onLaneKeys,
  unitKeys,
  beatKeys,
}: LaneTrackProps) {
  const units = unitsForLane(file, lane.id);
  const unitDragOver = (event: React.DragEvent, overId: string, orientation: 'horizontal' | 'vertical' = 'horizontal') => {
    if (drag.payload?.kind !== 'unit') return false;
    event.preventDefault();
    event.stopPropagation();
    drag.hover(overId, edgeFor(event, orientation));
    return true;
  };
  const dropWithEdge = (event: React.DragEvent, storyPosition: number) => {
    if (drag.payload?.kind !== 'unit') return;
    event.preventDefault();
    event.stopPropagation();
    const edge: DropEdge = edgeFor(event, 'horizontal');
    onDropUnit(lane.id, indexForDrop(storyPosition, edge));
  };

  return (
    <>
      <header
        className={`track-head lane-head${lane.collapsed ? ' collapsed' : ''}${dropClass(drag.dropTarget, lane.id)}`}
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
          onDropLane(indexForDrop(laneIndex, edgeFor(event)));
        }}
      >
        <button
          type="button"
          className="ghost grip"
          aria-label={`Reorder lane ${lane.name}. Alt with up or down arrow.`}
          title="Alt+↑/↓ to reorder this lane"
          onKeyDown={onLaneKeys}
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
        {/* The track's code, the way an editor labels V1, V2: click it to
            open the plot's summary and arc. */}
        <button
          type="button"
          className="lane-code"
          style={{ borderColor: lane.color, color: lane.color }}
          title={`Open ${lane.name}: summary and arc`}
          aria-label={`Open plot ${lane.name}`}
          onClick={() => onOpenLane(lane.id)}
        >
          P{laneIndex + 1}
        </button>
        <InlineText
          value={lane.name}
          ariaLabel="Lane name"
          className="lane-name"
          onCommit={(name) => onUpdate((current) => updateLane(current, lane.id, { name: name || 'Lane' }))}
        />
        <span className="count muted">{units.length}</span>
        {laneCount > 1 ? (
          <button
            type="button"
            className="ghost danger"
            title={`Remove lane and its ${noun}s`}
            onClick={() => onUpdate((current) => removeLane(current, lane.id))}
          >
            ×
          </button>
        ) : null}
      </header>

      {spans.map((span) => {
        const unit = span.unit;
        const atPlayhead = unit.id === selectedUnitId ? ' playhead' : '';
        if (unit.laneId !== lane.id) {
          // Another lane's scene occupies this story position; the empty
          // slot is where a scene can be dropped to take that position here.
          return (
            <div
              key={unit.id}
              className={`slot${atPlayhead}${dropClass(drag.dropTarget, `${lane.id}:${unit.id}`)}`}
              onDragOver={(event) => unitDragOver(event, `${lane.id}:${unit.id}`)}
              onDragLeave={() => drag.clearHover(`${lane.id}:${unit.id}`)}
              onDrop={(event) => dropWithEdge(event, span.index)}
            />
          );
        }
        const beats = beatsForUnit(file, unit.id);
        const collapsed = unit.collapsed || lane.collapsed;
        const off = unit.inScript ? '' : ' off';
        return (
          <article
            key={unit.id}
            className={`block${collapsed ? ' collapsed' : ''}${atPlayhead}${off}${dropClass(drag.dropTarget, unit.id)}`}
            style={{ borderTopColor: lane.color }}
            title={unit.inScript ? undefined : `Switched off: not in the script`}
            onDragOver={(event) => unitDragOver(event, unit.id)}
            onDragLeave={() => drag.clearHover(unit.id)}
            onDrop={(event) => dropWithEdge(event, span.index)}
          >
            {/* Clicking the block opens the scene, the way a clip opens in an
                editor; the selection follows so the playhead moves there too. */}
            <header
              className="block-head"
              draggable
              title={onOpenUnit ? `Open this ${noun}` : undefined}
              onClick={() => {
                const first = beats[0];
                if (first) onSelectBeat(first.id);
                onOpenUnit?.(unit.id);
              }}
              onDragStart={(event) => {
                event.stopPropagation();
                drag.begin({ kind: 'unit', id: unit.id, fromLaneId: lane.id }, event);
              }}
              onDragEnd={drag.end}
            >
              <button
                type="button"
                className="ghost grip"
                aria-label={`Reorder ${unit.title || `untitled ${unit.kind}`}. Alt with up or down arrow moves it in the story; add shift to move it between lanes.`}
                title="Alt+↑/↓ earlier or later · Alt+Shift+↑/↓ between lanes"
                onKeyDown={unitKeys(unit.id)}
                onClick={(event) => event.stopPropagation()}
              >
                ⠿
              </button>
              <button
                type="button"
                className="ghost twisty"
                aria-expanded={!collapsed}
                aria-label={collapsed ? `Expand ${unit.title || unit.kind}` : `Collapse ${unit.title || unit.kind}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdate((current) => updateUnit(current, unit.id, { collapsed: !unit.collapsed }));
                }}
              >
                {collapsed ? '▸' : '▾'}
              </button>
              <span className="block-label">{unit.sequenceLabel}</span>
              <span className="block-title">{unit.title || `Untitled ${unit.kind}`}</span>
              <button
                type="button"
                className="ghost danger block-remove"
                title={`Remove this ${unit.kind} and its beats`}
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdate((current) => removeUnit(current, unit.id));
                }}
              >
                ×
              </button>
            </header>

            {collapsed ? null : (
              <ul
                className="block-beats"
                onDragOver={(event) => {
                  if (drag.payload?.kind !== 'beat') return;
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDrop={(event) => {
                  if (drag.payload?.kind !== 'beat') return;
                  event.preventDefault();
                  event.stopPropagation();
                  onDropBeat(unit.id, beats.length);
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
                      onDropBeat(unit.id, indexForDrop(beatIndex, edgeFor(event)));
                    }}
                  >
                    <button
                      type="button"
                      className={`beat-row${beat.id === selectedBeatId ? ' selected' : ''}${beat.color ? ' coloured' : ''}`}
                      style={beat.color ? ({ '--beat-colour': beat.color } as React.CSSProperties) : undefined}
                      aria-current={beat.id === selectedBeatId ? 'true' : undefined}
                      title={`${beat.status} · double-click to open · Alt+↑/↓ to reorder · Alt+Shift+↑/↓ to move between ${noun}s`}
                      onClick={() => onSelectBeat(beat.id)}
                      onDoubleClick={() => onOpenBeat?.(beat.id)}
                      onKeyDown={beatKeys(beat)}
                    >
                      <span className={`glyph status-${beat.status}`} aria-hidden="true">
                        {STATUS_GLYPH[beat.status]}
                      </span>
                      {/* The internal beat title is an authoring reference only (§5.3). */}
                      <span className="beat-row-title">{beat.title || 'Untitled beat'}</span>
                      {/* Who speaks in the beat, as the cast's colours (addendum 02 §6). */}
                      <span className="cast" aria-hidden="true">
                        {(speakers.get(beat.id) ?? []).slice(0, 3).map((name) => (
                          <span key={name} className="cast-dot" style={{ background: colours.get(name) }} title={name} />
                        ))}
                      </span>
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
                <li className="block-add">
                  <button
                    type="button"
                    className="ghost"
                    title="Add beat"
                    onClick={() => onUpdate((current) => addBeat(current, { unitId: unit.id, title: 'New beat' }).file)}
                  >
                    + beat
                  </button>
                </li>
              </ul>
            )}
          </article>
        );
      })}

      {/* Dropping past the last scene appends to the story, in this lane. */}
      <div
        className={`slot tail${dropClass(drag.dropTarget, `${lane.id}:tail`)}`}
        onDragOver={(event) => {
          if (drag.payload?.kind !== 'unit') return;
          event.preventDefault();
          drag.hover(`${lane.id}:tail`, 'after');
        }}
        onDragLeave={() => drag.clearHover(`${lane.id}:tail`)}
        onDrop={(event) => {
          if (drag.payload?.kind !== 'unit') return;
          event.preventDefault();
          onDropUnit(lane.id, spans.length);
        }}
      />
    </>
  );
}
