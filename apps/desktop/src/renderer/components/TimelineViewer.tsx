import { useMemo } from 'react';
import {
  beatsForUnit,
  hasChapterPages,
  placedMarkers,
  spanWidth,
  threadLayout,
  timecode,
  unlink,
  type BeatId,
  type ProjectFile,
  type StoryMarkerId,
  type StorySpan,
  type ThreadLayout,
  type TimelineArc,
} from '@vcwriter/domain';

interface TimelineViewerProps {
  file: ProjectFile;
  threads?: ThreadLayout;
  selectedBeatId: BeatId | null;
  onSelectBeat(beatId: BeatId): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Pixels per page — the same unit the lanes below are zoomed in. */
  zoom: number;
  onZoom(zoom: number): void;
  /** A character's name, or '' for all of them. */
  isolated: string;
  onIsolate(name: string): void;
  /** A marker was clicked: open it (addendum 02 §11). */
  onOpenMarker?(markerId: StoryMarkerId): void;
}

const HEAD = 132;
const LINKS_HEIGHT = 52;

/**
 * The Timeline & Viewer screen (addendum 02 §5).
 *
 * The story along the top as a strip of scenes, measured in time: a page of
 * script is a minute of screen time, so the ruler above the scenes is a
 * running time and the length of a block is how long it plays. That is what
 * makes this an editing bay rather than an outline — the writer can see how
 * long the thing is, and where the weight of it falls.
 *
 * Under the strip, the threads that run through the story: a row per
 * **character**, filled in the scenes they speak in, and a row per **theme**,
 * filled in the scenes it is linked to. Choosing a character isolates them —
 * their row alone, and every scene without them dimmed — which answers
 * "where is she in this script, and what does she touch". The **links** the
 * writer has drawn between objects (§7.4) arc across the columns underneath.
 *
 * The strip and the ruler stay put while the rows scroll, so the scene a row
 * is filled in is always readable off the top of the screen.
 */
export function TimelineViewer({
  file,
  threads,
  selectedBeatId,
  onSelectBeat,
  onUpdate,
  zoom,
  onZoom,
  isolated,
  onIsolate,
  onOpenMarker,
}: TimelineViewerProps) {
  const layout = useMemo(() => threads ?? threadLayout(file), [threads, file]);
  const { spans, characters, themes, arcs } = layout;
  const noun = file.project.format === 'novel' || file.project.format === 'short_story' ? 'Chapters' : 'Scenes';

  const selectedUnitId = useMemo(() => {
    const beat = selectedBeatId ? file.beats.find((candidate) => candidate.id === selectedBeatId) : undefined;
    return beat?.unitId ?? null;
  }, [file.beats, selectedBeatId]);

  // The markers, by the column they fall in. An editing program puts these
  // along the top of the timeline and this is the same thing: a labelled
  // point in the story, at the moment it happens (addendum 02 §11).
  const marks = useMemo(() => {
    const byUnit = new Map<string, ReturnType<typeof placedMarkers>[number]>();
    for (const placed of placedMarkers(file)) byUnit.set(placed.marker.unitId as string, placed);
    return byUnit;
  }, [file]);
  const leaves = hasChapterPages(file.project.format);

  const widths = spans.map((span) => spanWidth(span, zoom));
  const columns = `${HEAD}px ${widths.map((width) => `${width}px`).join(' ')} minmax(40px, 1fr)`;
  const runtime = timecode(spans.reduce((total, span) => total + span.pages, 0));

  // Which scenes the isolated character is in, so the rest can step back.
  const isolatedScenes = useMemo(() => {
    if (isolated.length === 0) return null;
    const thread = characters.find((candidate) => candidate.name === isolated);
    return new Set((thread?.appearances ?? []).map((appearance) => appearance.index));
  }, [characters, isolated]);

  const pick = (span: StorySpan) => {
    const first = beatsForUnit(file, span.unit.id)[0];
    if (first) onSelectBeat(first.id);
  };

  const rows = [
    ...characters
      .filter((character) => isolated.length === 0 || character.name === isolated)
      .map((character) => ({
        key: `character:${character.name}`,
        kind: 'character' as const,
        name: character.name,
        color: character.color,
        indexes: new Set(character.appearances.map((appearance) => appearance.index)),
      })),
    ...themes.map((theme) => ({
      key: `theme:${theme.id}`,
      kind: 'theme' as const,
      name: theme.name,
      color: theme.color,
      indexes: new Set(theme.appearances.map((appearance) => appearance.index)),
    })),
  ];

  return (
    <section className="viewer" aria-label="Timeline and viewer">
      <header className="viewer-head">
        <span className="viewer-name">Timeline &amp; Viewer</span>
        <label className="viewer-isolate">
          <span className="muted">Character</span>
          <select aria-label="Isolate character" value={isolated} onChange={(event) => onIsolate(event.target.value)}>
            <option value="">All characters</option>
            {characters.map((character) => (
              <option key={character.name} value={character.name}>
                {character.name}
              </option>
            ))}
          </select>
        </label>
        <span className="viewer-runtime" title="A page of script is a minute of screen time">
          {runtime}
        </span>
        <label className="zoom">
          <span className="muted">Zoom</span>
          <input
            type="range"
            min={40}
            max={600}
            step={10}
            value={zoom}
            aria-label="Timeline zoom, pixels per page"
            onChange={(event) => onZoom(Number(event.target.value))}
          />
        </label>
      </header>

      <div className="viewer-scroll">
        <div className="viewer-grid" style={{ gridTemplateColumns: columns }}>
          {/* Time, and the scenes: these stay while the threads scroll. */}
          <div className="track-head viewer-sticky time">Time</div>
          {spans.map((span) => (
            <div key={span.unit.id} className="viewer-time viewer-sticky">
              {timecode(span.startPage)}
            </div>
          ))}
          <div className="viewer-time viewer-sticky tail" />

          {/* The markers, above the scenes: acts in a script, chapters in a
              book, each at the point it starts. */}
          <div className="track-head viewer-sticky marks">Markers</div>
          {spans.map((span) => {
            const placed = marks.get(span.unit.id as string);
            if (!placed) return <div key={span.unit.id} className="viewer-mark viewer-sticky" />;
            const leaf = leaves && placed.marker.page.include;
            return (
              <button
                type="button"
                key={span.unit.id}
                className={`viewer-mark viewer-sticky set${leaf ? ' has-page' : ''}`}
                aria-label={`Marker: ${placed.label}${placed.marker.title ? ` — ${placed.marker.title}` : ''}`}
                title={
                  leaves
                    ? `${placed.label} — open it to design the page it starts with`
                    : `${placed.label} — open it for its notes`
                }
                onClick={() => onOpenMarker?.(placed.marker.id)}
              >
                <span className="viewer-mark-flag">
                  {placed.label}
                  {placed.marker.title ? ` · ${placed.marker.title}` : ''}
                  {leaf ? ' ◲' : ''}
                </span>
              </button>
            );
          })}
          <div className="viewer-mark viewer-sticky tail" />

          <div className="track-head viewer-sticky scenes">{noun}</div>
          {spans.map((span) => {
            const dim = isolatedScenes && !isolatedScenes.has(span.index) ? ' dim' : '';
            const here = span.unit.id === selectedUnitId ? ' playhead' : '';
            const off = span.unit.inScript ? '' : ' off';
            return (
              <button
                type="button"
                key={span.unit.id}
                className={`viewer-scene viewer-sticky${dim}${here}${off}`}
                title={`${span.unit.title || 'Untitled'} · ${timecode(span.pages)}`}
                onClick={() => pick(span)}
              >
                <span className="viewer-scene-label muted">{span.unit.sequenceLabel || span.index + 1}</span>
                <span className="viewer-scene-title">{span.unit.title || 'Untitled'}</span>
              </button>
            );
          })}
          <div className="viewer-scene viewer-sticky tail" />

          {/* The threads. */}
          {rows.map((row) => (
            <Row key={row.key} row={row} spans={spans} onPick={pick} />
          ))}

          {rows.length === 0 ? (
            <>
              <div className="track-head">Threads</div>
              <p className="muted viewer-empty" style={{ gridColumn: `span ${spans.length + 1}` }}>
                Characters appear here as they speak, and themes as they are linked to scenes.
              </p>
            </>
          ) : null}

          <div className="track-head">Links</div>
          <LinksRow arcs={arcs} widths={widths} spans={spans} onUpdate={onUpdate} />
          <div className="viewer-links tail" />
        </div>
      </div>
    </section>
  );
}

function Row({
  row,
  spans,
  onPick,
}: {
  row: { kind: 'character' | 'theme'; name: string; color: string; indexes: Set<number> };
  spans: StorySpan[];
  onPick(span: StorySpan): void;
}) {
  return (
    <>
      <div className={`track-head viewer-thread-head ${row.kind}`} style={{ borderLeftColor: row.color }} title={row.name}>
        <span className="dot" style={{ background: row.color }} aria-hidden="true" />
        <span className="viewer-thread-name">{row.name}</span>
      </div>
      {spans.map((span) => {
        const present = row.indexes.has(span.index);
        return (
          <div key={span.unit.id} className={present ? 'viewer-cell on' : 'viewer-cell'}>
            {present ? (
              <button
                type="button"
                className="viewer-bar"
                style={{ background: row.color }}
                aria-label={`${row.name} in ${span.unit.title || 'untitled'}`}
                title={`${row.name} · ${span.unit.title || 'Untitled'}`}
                onClick={() => onPick(span)}
              />
            ) : null}
          </div>
        );
      })}
      <div className="viewer-cell tail" />
    </>
  );
}

/**
 * The links the writer has drawn between objects, as curves from the scene
 * one end falls in to the scene the other does. Clicking one removes it,
 * which is the same gesture the Threads view had.
 */
function LinksRow({
  arcs,
  widths,
  spans,
  onUpdate,
}: {
  arcs: TimelineArc[];
  widths: number[];
  spans: StorySpan[];
  onUpdate: TimelineViewerProps['onUpdate'];
}) {
  if (spans.length === 0) return <div className="viewer-links" />;
  const links = arcs.filter((arc) => arc.kind === 'link');
  const total = widths.reduce((sum, width) => sum + width, 0);
  const starts: number[] = [];
  let x = 0;
  for (const width of widths) {
    starts.push(x);
    x += width;
  }
  const centre = (index: number) => (starts[index] ?? 0) + Math.min((widths[index] ?? 0) / 2, 60);
  const baseline = LINKS_HEIGHT - 8;

  return (
    <div className="viewer-links" style={{ gridColumn: `span ${spans.length}` }}>
      <svg width={total} height={LINKS_HEIGHT} viewBox={`0 0 ${total} ${LINKS_HEIGHT}`} role="list" aria-label="Links between objects">
        {links.map((arc) => {
          const from = centre(arc.fromIndex);
          const to = centre(arc.toIndex as number);
          const lift = Math.min(LINKS_HEIGHT - 10, 16 + Math.abs(to - from) / 12);
          return (
            <g key={arc.id} className="arc link" role="listitem" onClick={() => onUpdate((current) => unlink(current, arc.id as never))}>
              <path d={`M ${from} ${baseline} C ${from} ${baseline - lift}, ${to} ${baseline - lift}, ${to} ${baseline}`} />
              <circle cx={from} cy={baseline} r={3} />
              <circle cx={to} cy={baseline} r={3} className="land" />
              <title>{`${arc.label} — click to remove`}</title>
            </g>
          );
        })}
        {links.length === 0 ? (
          <text x={8} y={baseline - 4} className="thread-label">
            Nothing linked yet
          </text>
        ) : null}
      </svg>
    </div>
  );
}
