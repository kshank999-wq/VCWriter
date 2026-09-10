import { useMemo } from 'react';
import {
  defaultMarkerKind,
  markerNoun,
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
  timecode,
  timelineArcs,
  unitsForLane,
  updateLane,
  updateMarker,
  updateUnit,
  formatRt,
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
  /**
   * The scene the writer has clicked into. Kept by the window rather than
   * derived from the selected beat, because an empty scene has no beat to
   * derive it from and is exactly the one you select before adding a beat.
   */
  selectedUnitId?: StructuralUnitId | null;
  onSelectUnit?(unitId: StructuralUnitId, laneId: LaneId): void;
  /** Clicking a lane's header makes it the one a new scene lands in. */
  onSelectLane?(laneId: LaneId): void;
  /** How many beats stack before the next column starts (addendum 02 §4). */
  beatsPerColumn?: number;
  /** Null in a window that holds only the lanes: there is no inspector there. */
  inspectorOpen: boolean | null;
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
 * How many beats stack in a scene before the next column starts.
 *
 * Five is a working default rather than a rule — it is the preference a
 * writer sets once, and a scene of twelve beats then reads as three short
 * columns instead of one column you cannot see the end of.
 */
export const DEFAULT_BEATS_PER_COLUMN = 5;

/** A column of beats, and the padding a block draws around them. */
const BEAT_COLUMN_WIDTH = 132;
const BLOCK_PADDING = 12;

/** How wide a scene has to be for its beats, once they run past one column. */
const beatsWidth = (beatCount: number, rows: number): number => {
  const columns = Math.ceil(beatCount / rows);
  return columns <= 1 ? 0 : columns * BEAT_COLUMN_WIDTH + BLOCK_PADDING;
};

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
  selectedUnitId: givenSelectedUnitId,
  onSelectUnit,
  onSelectLane,
  beatsPerColumn = DEFAULT_BEATS_PER_COLUMN,
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
  /**
   * A commercial has no subplot to lane, no acts to mark and nothing to link
   * across a thirty (addendum 05 §3). Those tracks and their buttons are
   * taken out rather than left there greyed.
   */
  const shortForm = file.project.format === 'short_form';

  const selectedBeat = selectedBeatId ? file.beats.find((beat) => beat.id === selectedBeatId) : undefined;
  // What was clicked wins; otherwise the scene being written in.
  const selectedUnitId = givenSelectedUnitId ?? selectedBeat?.unitId ?? null;

  const rows = Math.max(1, Math.round(beatsPerColumn));
  // A scene is as wide as its pages, or as wide as its beats need — whichever
  // is more. Past `rows` beats a second column starts and the block stretches
  // rather than growing a scrollbar; every track shares these columns, so the
  // lanes stay lined up by story position.
  /**
   * How wide each segment is drawn.
   *
   * A script is measured in pages, so a scene is as wide as its pages. A
   * commercial has no pages — it has seconds — so a segment is as wide as its
   * own running time (addendum 05 §4), which is what makes the board strip
   * above it read as a cut rather than as a row of stamps.
   */
  const widths = spans.map((span) => {
    const beats = beatsForUnit(file, span.unit.id);
    if (shortForm) {
      const seconds = beats
        .filter((beat) => beat.inScript)
        .reduce(
          (total, beat) => total + (beat.headSeconds ?? 0) + (beat.seconds ?? 0) + (beat.tailSeconds ?? 0),
          0,
        );
      // A second is a comfortable slice at the middle of the zoom, and a
      // segment nobody has timed is still wide enough to be clicked.
      return Math.max(140, Math.round(seconds * (pixelsPerPage / 12)));
    }
    return Math.max(spanWidth(span, pixelsPerPage), beatsWidth(beats.length, rows));
  });
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
          {/* Pages, and the time they play for: a page is a minute (§5). */}
          <div className="track-head ruler-head">Pages · time</div>
          {spans.map((span) => (
            <div key={span.unit.id} className={`ruler-cell${playhead(span.unit.id)}`}>
              <span>{Math.floor(span.startPage) + 1}</span>
              <span className="ruler-time muted">{timecode(span.startPage)}</span>
            </div>
          ))}
          <div className="ruler-cell tail">
            <span className="muted">
              {layout.totalPages < 0.05 ? '' : `${Math.ceil(layout.totalPages)} pp. · ${timecode(layout.totalPages)}`}
            </span>
          </div>

          {/* The storyboard, over the segments: each frame at the width of
              the time it holds, so running your eye along it is looking at
              the cut (addendum 05 §3a). */}
          {shortForm ? (
            <>
              <div className="track-head">Board</div>
              {spans.map((span) => (
                <FrameStrip key={span.unit.id} file={file} unitId={span.unit.id} onSelectBeat={onSelectBeat} />
              ))}
              <div className="board-cell tail" />
            </>
          ) : null}

          {/* The markers as bands: acts in a script, chapters in a book.
              A commercial has neither, and nothing is linked across a
              thirty, so short form has neither track (addendum 05 §3). */}
          {shortForm ? null : (
            <>
              <div className="track-head">
                {markerNoun(defaultMarkerKind(file.project.format))}s
              </div>
              <ActsTrack layout={layout} playheadUnitId={selectedUnitId} onUpdate={onUpdate} />
              <div className="acts-cell tail" />

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
            </>
          )}

          {/* One track per lane */}
          {/* Short form has one track, not a lane per plot (§3): the first
              lane carries every segment, and the rest are not drawn. */}
          {(shortForm ? lanes.slice(0, 1) : lanes).map((lane, laneIndex) => (
            <LaneTrack
              key={lane.id}
              file={file}
              lane={lane}
              laneIndex={laneIndex}
              laneCount={lanes.length}
              spans={spans}
              noun={noun}
              shortForm={shortForm}
              selectedBeatId={selectedBeatId}
              selectedUnitId={selectedUnitId}
              beatRows={rows}
              onSelectUnit={onSelectUnit}
              onSelectLane={onSelectLane}
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
        {/* In short form the work happens on the sheet: a segment and a row
            are made there, and there is nothing to lane or to mark (§3). */}
        {shortForm ? null : (
          <>
            <button type="button" className="tool" onClick={onAddScene}>
              + {noun === 'chapter' ? 'Chapter' : 'Scene'}
            </button>
            <button type="button" className="tool" onClick={onAddBeat} disabled={!selectedUnitId}>
              + Beat
            </button>
            <button type="button" className="tool" onClick={onAddLane}>
              + Lane
            </button>
            {/* Always "Marker": in prose the scene button already says Chapter,
                and what kind of marker this one is — act, chapter, part — is
                chosen on the marker itself (addendum 02 §11). */}
            <button
              type="button"
              className="tool"
              onClick={onAddAct}
              disabled={!selectedUnitId}
              title={`A point in the story: an act in a script, a chapter in a book. Starts a ${markerNoun(
                defaultMarkerKind(file.project.format),
              ).toLowerCase()} here.`}
            >
              + Marker
            </button>
          </>
        )}
        <label className="zoom">
          <span className="muted">Zoom</span>
          <input
            type="range"
            min={40}
            max={600}
            step={10}
            value={pixelsPerPage}
            aria-label="Timeline zoom, pixels per page"
            onChange={(event) => onZoom(Number(event.target.value))}
          />
        </label>
        <span className="toolbar-spacer" />
        {inspectorOpen === null ? null : (
          <button
            type="button"
            className={inspectorOpen ? 'tool active' : 'tool'}
            aria-pressed={inspectorOpen}
            title="Inspector (Ctrl/Cmd+Shift+P)"
            onClick={onToggleInspector}
          >
            Inspector
          </button>
        )}
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
  /**
   * Short form: the lane is not a plotline, a unit is a segment and a segment
   * has no beats drawn in it (addendum 05 §3, §3a).
   */
  shortForm: boolean;
  selectedBeatId: BeatId | null;
  selectedUnitId: string | null;
  beatRows: number;
  onSelectUnit: MasterTimelineProps['onSelectUnit'];
  onSelectLane: MasterTimelineProps['onSelectLane'];
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
  shortForm,
  selectedBeatId,
  selectedUnitId,
  beatRows,
  onSelectUnit,
  onSelectLane,
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
        // Clicking anywhere in the header makes this the lane a new scene
        // lands in, so "add a chapter" means "here" rather than "somewhere".
        onClick={() => onSelectLane?.(lane.id)}
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
            open the plot's summary and arc. Short form has no plot to open —
            the one track is the board, and it is not a plotline (§3). */}
        {shortForm ? (
          <span className="lane-name muted">Segments</span>
        ) : (
          <>
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
          </>
        )}
        <span className="count muted">{units.length}</span>
        {laneCount > 1 && !shortForm ? (
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
        if (!shortForm && unit.laneId !== lane.id) {
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
        const chosen = unit.id === selectedUnitId ? ' selected' : '';
        return (
          <article
            key={unit.id}
            className={`block${collapsed ? ' collapsed' : ''}${atPlayhead}${chosen}${off}${dropClass(drag.dropTarget, unit.id)}`}
            style={{ borderTopColor: lane.color }}
            title={unit.inScript ? undefined : `Switched off: not in the script`}
            onDragOver={(event) => unitDragOver(event, unit.id)}
            onDragLeave={() => drag.clearHover(unit.id)}
            onDrop={(event) => dropWithEdge(event, span.index)}
          >
            {/* One click selects it — highlighted, and the thing a new beat
                goes into. Two opens it, the way a clip opens in an editor. */}
            <header
              className="block-head"
              draggable
              title={onOpenUnit ? `Click to select this ${noun}, double-click to open it` : undefined}
              onClick={() => {
                onSelectUnit?.(unit.id, lane.id);
                const first = beats[0];
                if (first) onSelectBeat(first.id);
              }}
              onDoubleClick={() => onOpenUnit?.(unit.id)}
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
              {/* A commercial's parts are segments, numbered where they fall
                  and named beside the number (addendum 05 §3a). */}
              <span className="block-label">
                {shortForm
                  ? `Segment ${spans.findIndex((span) => span.unit.id === unit.id) + 1}`
                  : unit.sequenceLabel}
              </span>
              <span className="block-title">
                {shortForm
                  ? unit.title
                    ? `— ${unit.title}`
                    : ''
                  : unit.title || `Untitled ${unit.kind}`}
              </span>
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

            {/* A segment has no beats drawn in it: what is drawn is the
                dialogue, stretched along the time it takes (addendum 05
                §3a). That is the thing being timed. */}
            {shortForm ? (
              collapsed ? null : (
                <SegmentDialogue
                  beats={beats}
                  selectedBeatId={selectedBeatId}
                  onSelectBeat={onSelectBeat}
                  onOpenBeat={onOpenBeat}
                />
              )
            ) : collapsed ? null : (
              <ul
                className="block-beats"
                style={{ '--beat-rows': beatRows } as React.CSSProperties}
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
                      className={`beat-row${beat.id === selectedBeatId ? ' selected' : ''}${beat.color ? ' coloured' : ''}${
                        beat.inScript ? '' : ' off'
                      }`}
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


/**
 * A segment's dialogue, laid along the time it takes (addendum 05 §3a).
 *
 * The short-form timeline draws no beats: a commercial is not built out of
 * cards, it is built out of seconds. Each row takes the width of its own
 * duration, so the strip under a segment *is* the read — long lines look
 * long, and a row nobody has timed takes an even share until somebody says.
 */
function SegmentDialogue({
  beats,
  selectedBeatId,
  onSelectBeat,
  onOpenBeat,
}: {
  beats: Beat[];
  selectedBeatId: BeatId | null;
  onSelectBeat(beatId: BeatId): void;
  onOpenBeat: MasterTimelineProps['onOpenBeat'];
}) {
  if (beats.length === 0) return <p className="segment-empty muted">No rows yet.</p>;
  return (
    <div className="segment-dialogue" role="list">
      {beats.map((beat) => {
        const said = beat.manuscript.elements
          .map((element) => element.text.trim())
          .filter((text) => text.length > 0)
          .join(' ');
        return (
          <button
            type="button"
            role="listitem"
            key={beat.id}
            className={`segment-line${beat.id === selectedBeatId ? ' selected' : ''}`}
            style={{ flexGrow: Math.max(1, beat.seconds ?? 0) }}
            title={said || 'Nothing said yet'}
            aria-label={`${formatRt(beat.seconds ?? 0)} — ${said || 'nothing said yet'}`}
            onClick={() => onSelectBeat(beat.id)}
            onDoubleClick={() => onOpenBeat?.(beat.id)}
          >
            <span className="segment-said">{said || '—'}</span>
            <span className="segment-rt muted">{formatRt(beat.seconds ?? 0)}</span>
          </button>
        );
      })}
    </div>
  );
}


/**
 * One segment's frames, in order, along the width it runs (addendum 05 §3a).
 *
 * The storyboard is the track above the timeline, the way an edit suite puts
 * the picture over the time. A shot with no frame yet keeps its place — the
 * gap in the strip is the shot that has not been drawn, which is a thing
 * worth seeing.
 */
function FrameStrip({
  file,
  unitId,
  onSelectBeat,
}: {
  file: ProjectFile;
  unitId: StructuralUnitId;
  onSelectBeat(beatId: BeatId): void;
}) {
  const frames = new Map((file.assets ?? []).map((asset) => [asset.id as string, asset]));
  const beats = beatsForUnit(file, unitId).filter((beat) => beat.inScript);

  return (
    <div className="board-cell">
      {beats.map((beat) => {
        const frame = beat.imageAssetId ? frames.get(beat.imageAssetId as string) : undefined;
        const seconds = (beat.headSeconds ?? 0) + (beat.seconds ?? 0) + (beat.tailSeconds ?? 0);
        return (
          <button
            type="button"
            key={beat.id}
            className={frame ? 'board-frame' : 'board-frame empty'}
            style={{ flexGrow: Math.max(1, seconds) }}
            title={frame ? frame.name || 'A frame' : 'No frame yet'}
            aria-label={frame ? `Frame: ${frame.name || 'untitled'}` : 'A shot with no frame yet'}
            onClick={() => onSelectBeat(beat.id)}
          >
            {frame ? <img src={frame.data} alt="" /> : null}
          </button>
        );
      })}
    </div>
  );
}
