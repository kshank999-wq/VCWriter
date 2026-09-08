import { useMemo, useState } from 'react';
import {
  beatsForUnit,
  linkEntities,
  ref,
  threadLayout,
  unlink,
  type Beat,
  type BeatId,
  type ProjectFile,
  type StoryLink,
  type ThreadLayout,
} from '@vcwriter/domain';

interface ThreadViewProps {
  file: ProjectFile;
  threads?: ThreadLayout;
  selectedBeatId: BeatId | null;
  onSelectBeat(beatId: BeatId): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

type Layer = 'lanes' | 'setups' | 'characters' | 'links';

const COLUMN = 168;
const GUTTER = 96;
const SCENE_ROW = 64;
const ARC_ROW = 56;
const CHARACTER_ROW = 26;
const BEAT_H = 22;
const BEAT_GAP = 4;

/**
 * The Threads view (addendum 02 §6): the story as a connected diagram. One
 * column per scene in story order; in it, the scene as a node coloured by
 * its lane, and its beats as chips coloured by who speaks in them. Across
 * the columns run the threads: a line per lane through its scenes, a curve
 * per setup to its payoff, a line per character through the scenes they
 * speak in, and the links the writer has drawn between beats.
 *
 * Drawing a link is a drag from one beat to another; clicking a link removes
 * it. Everything else is derived from the manuscript and the structure, so
 * the diagram cannot drift from the script.
 */
export function ThreadView({ file, threads, selectedBeatId, onSelectBeat, onUpdate }: ThreadViewProps) {
  const layout = useMemo(() => threads ?? threadLayout(file), [threads, file]);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ lanes: true, setups: true, characters: true, links: true });
  const [dragFrom, setDragFrom] = useState<{ beatId: BeatId; x: number; y: number } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const { spans, lanes, characters, arcs, speakers, colours } = layout;
  const laneColour = new Map(lanes.map((lane) => [lane.id as string, lane.color]));
  const columnX = (index: number) => GUTTER + index * COLUMN;
  const centreX = (index: number) => columnX(index) + COLUMN / 2 - 8;

  // Rows, top to bottom.
  const sceneY = 28;
  const arcY = sceneY + SCENE_ROW;
  const characterY = arcY + (layers.setups || layers.links ? ARC_ROW : 12);
  const shownCharacters = layers.characters ? characters : [];
  const beatsY = characterY + shownCharacters.length * CHARACTER_ROW + 16;

  // Beats by column, with their y positions, so links can find their ends.
  const beatPlaces = new Map<BeatId, { x: number; y: number; beat: Beat; index: number }>();
  let tallest = 0;
  spans.forEach((span) => {
    const beats = beatsForUnit(file, span.unit.id);
    beats.forEach((beat, position) => {
      beatPlaces.set(beat.id, { x: columnX(span.index), y: beatsY + position * (BEAT_H + BEAT_GAP), beat, index: span.index });
    });
    tallest = Math.max(tallest, beats.length);
  });

  const width = GUTTER + Math.max(1, spans.length) * COLUMN + 24;
  const height = beatsY + Math.max(1, tallest) * (BEAT_H + BEAT_GAP) + 24;

  const beatLinks: StoryLink[] = layers.links
    ? file.links.filter((link) => link.from.type === 'beat' && link.to.type === 'beat' && beatPlaces.has(link.from.id as BeatId) && beatPlaces.has(link.to.id as BeatId))
    : [];

  const endDrag = (target: BeatId | null) => {
    if (dragFrom && target && target !== dragFrom.beatId) {
      onUpdate((current) => linkEntities(current, { from: ref('beat', dragFrom.beatId), to: ref('beat', target), type: 'relates_to' }));
    }
    setDragFrom(null);
    setPointer(null);
  };

  const toggle = (layer: Layer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }));

  return (
    <div className="threads">
      <div className="threads-toolbar">
        {(
          [
            ['lanes', 'Plot lanes'],
            ['setups', 'Setups & payoffs'],
            ['characters', 'Characters'],
            ['links', 'Links'],
          ] as Array<[Layer, string]>
        ).map(([layer, label]) => (
          <label key={layer} className="toggle">
            <input type="checkbox" checked={layers[layer]} onChange={() => toggle(layer)} />
            {label}
          </label>
        ))}
        <span className="toolbar-spacer" />
        <span className="muted threads-hint">Drag from one beat to another to link them · click a link to remove it</span>
      </div>

      <div className="threads-scroll">
        <svg
          className="threads-canvas"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Threads through the story"
          onPointerMove={(event) => {
            if (!dragFrom) return;
            const box = event.currentTarget.getBoundingClientRect();
            setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
          }}
          onPointerUp={() => endDrag(null)}
          onPointerLeave={() => dragFrom && endDrag(null)}
        >
          {/* Column headers: scene labels, and the act a scene starts. */}
          {spans.map((span) => (
            <g key={`head-${span.unit.id}`} className="thread-column-head">
              <text x={columnX(span.index)} y={16} className="thread-label">
                {span.unit.sequenceLabel || `${span.index + 1}`}
                {span.marker ? `  ·  ${span.marker.title || span.marker.kind}` : ''}
              </text>
              <line x1={columnX(span.index) - 12} y1={22} x2={columnX(span.index) - 12} y2={height} className="thread-column-rule" />
            </g>
          ))}

          {/* Lane threads: a line per lane through its scenes, under the nodes. */}
          {layers.lanes
            ? lanes.map((lane) => {
                const own = spans.filter((span) => span.unit.laneId === lane.id);
                if (own.length < 2) return null;
                const points = own.map((span) => `${centreX(span.index)},${sceneY + SCENE_ROW / 2 - 6}`).join(' ');
                return <polyline key={`lane-${lane.id}`} points={points} className="thread-lane" style={{ stroke: lane.color }} />;
              })
            : null}

          {/* Scene nodes. */}
          <text x={8} y={sceneY + 14} className="thread-row-label">
            Scenes
          </text>
          {spans.map((span) => {
            const colour = laneColour.get(span.unit.laneId) ?? 'currentColor';
            const beats = beatsForUnit(file, span.unit.id);
            const selected = beats.some((beat) => beat.id === selectedBeatId);
            return (
              <g
                key={`scene-${span.unit.id}`}
                className={selected ? 'thread-scene selected' : 'thread-scene'}
                onClick={() => beats[0] && onSelectBeat(beats[0].id)}
              >
                <rect x={columnX(span.index)} y={sceneY} width={COLUMN - 16} height={SCENE_ROW - 12} rx={2} style={{ stroke: colour }} />
                <rect x={columnX(span.index)} y={sceneY} width={4} height={SCENE_ROW - 12} style={{ fill: colour }} />
                <text x={columnX(span.index) + 10} y={sceneY + 18} className="thread-scene-title">
                  {truncate(span.unit.title || `Untitled ${span.unit.kind}`, 22)}
                </text>
                <text x={columnX(span.index) + 10} y={sceneY + 36} className="thread-scene-meta">
                  {lanes.find((lane) => lane.id === span.unit.laneId)?.name ?? ''} · {beats.length} {beats.length === 1 ? 'beat' : 'beats'}
                </text>
                <title>
                  {span.unit.sequenceLabel} {span.unit.title}
                </title>
              </g>
            );
          })}

          {/* Setups, payoffs and scene-level links, as curves between scene centres. */}
          {layers.setups || layers.links ? (
            <text x={8} y={arcY + 18} className="thread-row-label">
              Promises
            </text>
          ) : null}
          {arcs
            .filter((arc) => (arc.kind === 'link' ? layers.links : layers.setups))
            .map((arc) => {
              const from = centreX(arc.fromIndex);
              const base = arcY + 8;
              if (arc.toIndex === null) {
                return (
                  <g key={arc.id} className="arc open">
                    <path d={`M ${from} ${base} Q ${from + 40} ${base + 28} ${from + 80} ${base + 22}`} />
                    <circle cx={from} cy={base} r={3} />
                    <title>{arc.label}</title>
                  </g>
                );
              }
              const to = centreX(arc.toIndex);
              const lift = Math.min(ARC_ROW - 12, 18 + Math.abs(to - from) / 10);
              return (
                <g key={arc.id} className={`arc ${arc.kind}`} onClick={() => arc.kind === 'link' && onUpdate((current) => unlink(current, arc.id as StoryLink['id']))}>
                  <path d={`M ${from} ${base} C ${from} ${base + lift}, ${to} ${base + lift}, ${to} ${base}`} />
                  <circle cx={from} cy={base} r={3} />
                  <circle cx={to} cy={base} r={3} />
                  <title>{arc.label}</title>
                </g>
              );
            })}

          {/* Character threads: a line per character through the scenes they speak in. */}
          {shownCharacters.map((character, row) => {
            const y = characterY + row * CHARACTER_ROW + 12;
            const points = character.appearances.map((appearance) => `${centreX(appearance.index)},${y}`).join(' ');
            return (
              <g key={`character-${character.name}`} className="thread-character" style={{ color: character.color }}>
                <text x={8} y={y + 4} className="thread-character-name" style={{ fill: character.color }}>
                  {truncate(character.name, 12)}
                </text>
                {character.appearances.length > 1 ? <polyline points={points} /> : null}
                {character.appearances.map((appearance) => (
                  <circle
                    key={appearance.index}
                    cx={centreX(appearance.index)}
                    cy={y}
                    r={4}
                    onClick={() => appearance.beatIds[0] && onSelectBeat(appearance.beatIds[0])}
                  >
                    <title>
                      {character.name} · {spans[appearance.index]?.unit.title}
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* Beat-to-beat links the writer drew. */}
          {beatLinks.map((link) => {
            const from = beatPlaces.get(link.from.id as BeatId)!;
            const to = beatPlaces.get(link.to.id as BeatId)!;
            const x1 = from.x + COLUMN - 16;
            const x2 = to.x;
            const y1 = from.y + BEAT_H / 2;
            const y2 = to.y + BEAT_H / 2;
            const forward = to.index > from.index;
            const path = forward
              ? `M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`
              : `M ${from.x} ${y1} C ${from.x - 40} ${y1}, ${x2 + COLUMN - 16 + 40} ${y2}, ${x2 + COLUMN - 16} ${y2}`;
            return (
              <g key={link.id} className="beat-link" onClick={() => onUpdate((current) => unlink(current, link.id))}>
                <path d={path} />
                <title>{link.label || link.type.replace(/_/g, ' ')} — click to remove</title>
              </g>
            );
          })}

          {/* Beats: chips coloured by who speaks in them. */}
          <text x={8} y={beatsY + 15} className="thread-row-label">
            Beats
          </text>
          {Array.from(beatPlaces.values()).map(({ beat, x, y }) => {
            const cast = speakers.get(beat.id) ?? [];
            const selected = beat.id === selectedBeatId;
            return (
              <g
                key={beat.id}
                className={selected ? 'thread-beat selected' : 'thread-beat'}
                data-beat={beat.id}
                onClick={() => onSelectBeat(beat.id)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDragFrom({ beatId: beat.id, x: x + COLUMN - 16, y: y + BEAT_H / 2 });
                }}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  endDrag(beat.id);
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={COLUMN - 16}
                  height={BEAT_H}
                  rx={2}
                  style={beat.color ? { stroke: beat.color, fill: `color-mix(in srgb, ${beat.color} 22%, var(--panel-2))` } : undefined}
                />
                {cast.slice(0, 4).map((name, position) => (
                  <circle key={name} cx={x + 9 + position * 9} cy={y + BEAT_H / 2} r={3.5} style={{ fill: colours.get(name) ?? 'currentColor' }}>
                    <title>{name}</title>
                  </circle>
                ))}
                <text x={x + 10 + Math.min(cast.length, 4) * 9} y={y + BEAT_H / 2 + 4} className="thread-beat-title">
                  {truncate(beat.title || 'Untitled beat', cast.length > 0 ? 16 : 20)}
                </text>
                <title>
                  {beat.title || 'Untitled beat'}
                  {cast.length > 0 ? ` · ${cast.join(', ')}` : ''}
                </title>
              </g>
            );
          })}

          {dragFrom && pointer ? (
            <line x1={dragFrom.x} y1={dragFrom.y} x2={pointer.x} y2={pointer.y} className="thread-drag" />
          ) : null}
        </svg>
      </div>
    </div>
  );
}

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
