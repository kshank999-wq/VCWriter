import { useMemo, useState } from 'react';
import {
  RELATIONSHIP_KINDS,
  RELATIONSHIP_KIND_NAMES,
  characterMap,
  charactersInTrack,
  describeRange,
  edgeLabel,
  tracksInOrder,
  relate,
  relationshipName,
  removeRelationship,
  scenesForRange,
  updateRelationship,
  type CharacterId,
  type CharacterRelationship,
  type TrackId,
  type MapEdge,
  type ProjectFile,
  type RelationshipKind,
  type SceneRange,
} from '@vcwriter/domain';

/**
 * The character relationship mind map (addendum 08 §12, stage 8).
 *
 * **Nothing about the picture is stored.** The Sculptor's board keeps x and y
 * because arranging it *is* the work; this is a reading of the relationships, so
 * the layout is computed every time — a new character appears without anybody
 * dragging one, and a deleted relationship closes the gap by itself.
 *
 * **One line per pair, with a label at each end.** Two people are allowed to
 * read each other differently (§11), so drawing two overlapping lines that
 * contradict each other would hide the very thing the records exist to show.
 *
 * Clicking a name opens the Creator on them; clicking a line opens the
 * relationship itself, both readings at once, which is the one place in the
 * product where they can be edited side by side.
 *
 * **The script draws lines of its own** (stage 12). A pair who keep speaking in
 * the same scenes get a faint one, thickening with the number of scenes, and it
 * is labelled with that count and nothing else — the manuscript can say they are
 * in nine scenes together and must not say what that *is*. Clicking one is how
 * the writer answers: naming it makes the relationship, and the line goes solid.
 *
 * **A scene range narrows the stretch being read** (§12, §11's leftover). It is
 * not the plot track beside it said differently: a track is a subplot and a range
 * is a piece of the script, and *who is in act two* is a question the track
 * cannot answer. What it narrows is who is on the map and what the manuscript
 * counts; a relationship the writer wrote down is untouched, because a
 * relationship has no scene number and deciding when one began would be
 * inventing the answer.
 */

/**
 * Two scene numbers as a range, or null where they cover the whole script.
 *
 * Null rather than 1-to-everything so *no range* has one representation: a
 * control that could be at its ends and still count as filtering would draw the
 * *showing* line over an unfiltered map.
 */
const asRange = (scenes: number, from: number, to: number): SceneRange | null => {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  return low <= 1 && high >= scenes ? null : { from: low, to: high };
};

interface CharacterMapProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Open somebody in the Character Creator (§12). */
  onOpenCreator(characterId: CharacterId): void;
}

/** The drawing is laid out in a unit box; this is how big it is drawn. */
const SIZE = 1000;
const PAD = 60;
const at = (value: number) => PAD + value * (SIZE - PAD * 2);

export function CharacterMap({ file, onUpdate, onOpenCreator }: CharacterMapProps) {
  const [focusId, setFocusId] = useState<CharacterId | ''>('');
  const [depth, setDepth] = useState(1);
  const [kind, setKind] = useState<RelationshipKind | ''>('');
  const [trackId, setTrackId] = useState<TrackId | ''>('');
  /**
   * A stretch of the story (§12). Null is the whole script, and is the default.
   *
   * Two numbers rather than a pair of scene ids: a range means *where in the
   * script*, so moving a scene into the stretch puts it in the stretch. Held as
   * one piece of state so *from* and *to* cannot be half-applied.
   */
  const [range, setRange] = useState<SceneRange | null>(null);
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [fromScript, setFromScript] = useState(true);
  const [openPair, setOpenPair] = useState<string | null>(null);

  const tracks = tracksInOrder(file);
  const scenes = useMemo(() => scenesForRange(file), [file]);
  const among = useMemo(
    () => (trackId === '' ? undefined : charactersInTrack(file, trackId)),
    [file, trackId],
  );

  const map = useMemo(
    () =>
      characterMap({
        file,
        ...(among ? { among } : {}),
        ...(kind === '' ? {} : { kinds: [kind] }),
        ...(focusId === '' ? {} : { focusId, depth }),
        ...(range ? { range } : {}),
        includeUnconnected: !connectedOnly,
        fromScript,
      }),
    [file, among, kind, focusId, depth, connectedOnly, fromScript, range],
  );

  const where = new Map(map.nodes.map((node) => [node.characterId as string, node]));
  const open = map.edges.find((edge) => `${edge.a}:${edge.b}` === openPair) ?? null;

  return (
    <div className="charmap">
      <header className="charmap-bar">
        <label>
          <span className="muted small">Focus on</span>
          <select
            aria-label="Focus on"
            value={focusId as string}
            onChange={(event) => setFocusId(event.target.value as CharacterId)}
          >
            <option value="">Everybody</option>
            {file.characters
              .filter((person) => !person.archived)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
          </select>
        </label>

        {/* §12: expand outward through connected relationships. */}
        {focusId === '' ? null : (
          <label>
            <span className="muted small">Out to</span>
            <select aria-label="How far out" value={depth} onChange={(event) => setDepth(Number(event.target.value))}>
              <option value={1}>Who they know</option>
              <option value={2}>And who those people know</option>
            </select>
          </label>
        )}

        <label>
          <span className="muted small">Kind</span>
          <select
            aria-label="Relationship kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as RelationshipKind | '')}
          >
            <option value="">Every kind</option>
            {RELATIONSHIP_KINDS.map((one) => (
              <option key={one} value={one}>
                {RELATIONSHIP_KIND_NAMES[one]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="muted small">Plot</span>
          <select
            aria-label="Plot track"
            value={trackId as string}
            onChange={(event) => setTrackId(event.target.value as TrackId)}
          >
            <option value="">Every plot</option>
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>

        {/* §12's scene range, and the second of §11's two leftovers.

            **A stretch is its own question** — *who is in act two, and how do
            they connect there* — which the plot track beside it does not answer:
            a track is a subplot and a range is a piece of the script.

            Two selects listing the scenes by name, because a writer knows the
            scene and not its number. Both start at the ends, so the control
            reads as the whole script until somebody moves one. */}
        {scenes.length > 1 ? (
          <label className="charmap-range">
            <span className="muted small">Scenes</span>
            <select
              aria-label="From which scene"
              value={range ? Math.min(range.from, range.to) : 1}
              onChange={(event) =>
                setRange(asRange(scenes.length, Number(event.target.value), range?.to ?? scenes.length))
              }
            >
              {scenes.map((scene) => (
                <option key={scene.unitId} value={scene.position}>
                  {scene.position}. {scene.title || 'Untitled'}
                </option>
              ))}
            </select>
            <span className="muted small">to</span>
            <select
              aria-label="To which scene"
              value={range ? Math.max(range.from, range.to) : scenes.length}
              onChange={(event) =>
                setRange(asRange(scenes.length, range?.from ?? 1, Number(event.target.value)))
              }
            >
              {scenes.map((scene) => (
                <option key={scene.unitId} value={scene.position}>
                  {scene.position}. {scene.title || 'Untitled'}
                </option>
              ))}
            </select>
            {range ? (
              <button
                type="button"
                className="ghost small"
                title="Back to the whole script"
                onClick={() => setRange(null)}
              >
                ×
              </button>
            ) : null}
          </label>
        ) : null}

        <label className="charmap-check">
          <input
            type="checkbox"
            checked={connectedOnly}
            onChange={(event) => setConnectedOnly(event.target.checked)}
          />
          <span className="muted small">Only people with relationships</span>
        </label>

        <label className="charmap-check">
          <input
            type="checkbox"
            checked={fromScript}
            onChange={(event) => setFromScript(event.target.checked)}
          />
          <span className="muted small" title="A faint line for two people who keep speaking in the same scenes">
            Lines from the script
          </span>
        </label>
      </header>

      {/* A filtered map says so. Without this a range that dropped half the
          cast looks like a story with half the cast in it. */}
      {range ? (
        <p className="charmap-showing muted small">
          {describeRange(file, range)} — {map.nodes.length}{' '}
          {map.nodes.length === 1 ? 'person speaks' : 'people speak'}{' '}
          {Math.min(range.from, range.to) === Math.max(range.from, range.to) ? 'in it' : 'in them'}. A
          relationship somebody wrote down is still drawn; only what the script itself says is counted
          inside the stretch.
        </p>
      ) : null}

      {map.nodes.length === 0 ? (
        <p className="muted empty-state">
          {range ? 'Nobody speaks in those scenes.' : 'Nobody to draw yet.'}
        </p>
      ) : (
        <svg
          className="charmap-canvas"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Character relationships"
        >
          {map.edges.map((edge) => {
            const a = where.get(edge.a as string);
            const b = where.get(edge.b as string);
            if (!a || !b) return null;
            const key = `${edge.a}:${edge.b}`;
            const x1 = at(a.x);
            const y1 = at(a.y);
            const x2 = at(b.x);
            const y2 = at(b.y);
            // A line nobody has named is the script's own: dashed and faint, so
            // it reads as a question rather than an answer. It thickens with the
            // scenes behind it, which is the only thing the manuscript can say.
            const named = edge.forward.length > 0 || edge.back.length > 0;
            const scenes = edge.together?.scenes ?? 0;
            return (
              <g
                key={key}
                className={
                  `charmap-edge${named ? '' : ' unnamed'}${openPair === key ? ' open' : ''}`
                }
                // Carried as a custom property rather than a stroke-width
                // attribute, which the stylesheet's own rule would win against.
                style={{ ['--edge-weight' as string]: `${Math.min(1 + scenes * 0.6, 5)}` }}
                onClick={() => setOpenPair(openPair === key ? null : key)}
              >
                {/* A 1.5px line is a hard thing to hit with a pointer, so a
                    fat transparent one sits under it and takes the clicks. */}
                <line className="charmap-hit" x1={x1} y1={y1} x2={x2} y2={y2} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
                {/* A label at each end, sitting a third of the way along from
                    the person whose reading it is — so it is obvious which of
                    the two sentences belongs to whom. */}
                {edge.forward.length > 0 ? (
                  <text x={x1 + (x2 - x1) * 0.3} y={y1 + (y2 - y1) * 0.3 - 6} textAnchor="middle">
                    {edgeLabel(edge.forward)}
                  </text>
                ) : null}
                {edge.back.length > 0 ? (
                  <text x={x1 + (x2 - x1) * 0.7} y={y1 + (y2 - y1) * 0.7 - 6} textAnchor="middle">
                    {edgeLabel(edge.back)}
                  </text>
                ) : null}
                {/* The count, and only when nothing has been named — once there
                    is a reading, the reading is what the line is about. */}
                {named || scenes === 0 ? null : (
                  // Just off centre, because two lines that cross do it at
                  // their midpoints and two counts stacked on the same spot
                  // read as one.
                  <text
                    className="charmap-count"
                    x={x1 + (x2 - x1) * 0.45}
                    y={y1 + (y2 - y1) * 0.45 - 6}
                    textAnchor="middle"
                  >
                    {scenes === 1 ? '1 scene' : `${scenes} scenes`}
                  </text>
                )}
              </g>
            );
          })}

          {map.nodes.map((node) => (
            <g
              key={node.characterId}
              className={`charmap-node ring-${Math.min(node.ring, 2)}`}
              onClick={() => onOpenCreator(node.characterId)}
              role="button"
              aria-label={`Open ${node.name}`}
            >
              <circle cx={at(node.x)} cy={at(node.y)} r={node.ring === 0 && focusId !== '' ? 15 : 11} />
              <text x={at(node.x)} y={at(node.y) - 22} textAnchor="middle" className="charmap-name">
                {node.name}
              </text>
              {node.tags.length > 0 ? (
                <text x={at(node.x)} y={at(node.y) + 30} textAnchor="middle" className="charmap-tag">
                  {node.tags[0]}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      )}

      {open ? (
        <EdgeDetail
          file={file}
          edge={open}
          onUpdate={onUpdate}
          onClose={() => setOpenPair(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * One line's worth of relationship, both readings at once.
 *
 * This is the only place in the product where the two directions sit side by
 * side, and that is what the map is for: *she trusts him* above *he is working
 * her* is the thing you open a map to see.
 */
function EdgeDetail({
  file,
  edge,
  onUpdate,
  onClose,
}: {
  file: ProjectFile;
  edge: MapEdge;
  onUpdate: CharacterMapProps['onUpdate'];
  onClose(): void;
}) {
  const nameOf = (id: string) =>
    file.characters.find((one) => (one.id as string) === id)?.name ?? 'Somebody';

  const side = (rows: CharacterRelationship[], from: string, to: string) => (
    <section>
      <h5>
        {nameOf(from)} <span className="muted">→</span> {nameOf(to)}
      </h5>
      {rows.length === 0 ? (
        <>
          <p className="muted small">No reading this way.</p>
          <NameIt
            fromName={nameOf(from)}
            toName={nameOf(to)}
            onName={(kind) =>
              onUpdate(
                (current) =>
                  relate(current, {
                    fromCharacterId: from as CharacterId,
                    toCharacterId: to as CharacterId,
                    kind,
                  }).file,
              )
            }
          />
        </>
      ) : (
        rows.map((one) => (
          <div key={one.id} className="charmap-reading">
            <div className="charmap-reading-head">
              <strong>{relationshipName(one)}</strong>
              <button
                type="button"
                className="ghost small"
                aria-label={`Remove how ${nameOf(from)} sees ${nameOf(to)}`}
                title="Removes this reading only. The other direction is untouched."
                onClick={() => onUpdate((current) => removeRelationship(current, one.id))}
              >
                ×
              </button>
            </div>
            <textarea
              aria-label={`Where it stands, ${nameOf(from)} to ${nameOf(to)}`}
              rows={2}
              placeholder="Where it stands now"
              value={one.state}
              onChange={(event) =>
                onUpdate((current) => updateRelationship(current, one.id, { state: event.target.value }))
              }
            />
          </div>
        ))
      )}
    </section>
  );

  return (
    <aside className="charmap-detail" aria-label="Relationship">
      <header>
        <h4>The line between them</h4>
        <button type="button" className="ghost small" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      {/* What the script found, said as a count and nothing more. It sits above
          both readings because on an unnamed line it is the only thing there. */}
      {edge.together ? (
        <p className="charmap-together muted small">
          They speak in{' '}
          <strong>
            {edge.together.scenes === 1 ? '1 scene' : `${edge.together.scenes} scenes`}
          </strong>{' '}
          together, across{' '}
          {edge.together.beats === 1 ? '1 beat' : `${edge.together.beats} beats`}.
        </p>
      ) : null}

      {side(edge.forward, edge.a as string, edge.b as string)}
      {side(edge.back, edge.b as string, edge.a as string)}
    </aside>
  );
}

/**
 * Naming a line the script drew.
 *
 * This is the only answer to a script line the module offers, and it is
 * deliberately the writer's: the manuscript raised the question — these two
 * keep turning up together — and what it *is* gets typed by a person. One
 * direction at a time, because §11's whole point is that the two may disagree.
 */
function NameIt({
  fromName,
  toName,
  onName,
}: {
  fromName: string;
  toName: string;
  onName(kind: RelationshipKind): void;
}) {
  const [kind, setKind] = useState<RelationshipKind>('friend');
  return (
    <div className="charmap-name-it">
      <select
        aria-label={`What ${fromName} is to ${toName}`}
        value={kind}
        onChange={(event) => setKind(event.target.value as RelationshipKind)}
      >
        {RELATIONSHIP_KINDS.map((one) => (
          <option key={one} value={one}>
            {RELATIONSHIP_KIND_NAMES[one]}
          </option>
        ))}
      </select>
      <button type="button" className="ghost small" onClick={() => onName(kind)}>
        Say so
      </button>
    </div>
  );
}
