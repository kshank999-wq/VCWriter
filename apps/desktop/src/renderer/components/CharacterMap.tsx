import { useMemo, useState } from 'react';
import {
  RELATIONSHIP_KINDS,
  RELATIONSHIP_KIND_NAMES,
  characterMap,
  charactersInLane,
  edgeLabel,
  lanesInOrder,
  relationshipName,
  removeRelationship,
  updateRelationship,
  type CharacterId,
  type CharacterRelationship,
  type LaneId,
  type MapEdge,
  type ProjectFile,
  type RelationshipKind,
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
 */

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
  const [laneId, setLaneId] = useState<LaneId | ''>('');
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [openPair, setOpenPair] = useState<string | null>(null);

  const lanes = lanesInOrder(file);
  const among = useMemo(
    () => (laneId === '' ? undefined : charactersInLane(file, laneId)),
    [file, laneId],
  );

  const map = useMemo(
    () =>
      characterMap({
        file,
        ...(among ? { among } : {}),
        ...(kind === '' ? {} : { kinds: [kind] }),
        ...(focusId === '' ? {} : { focusId, depth }),
        includeUnconnected: !connectedOnly,
      }),
    [file, among, kind, focusId, depth, connectedOnly],
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
            aria-label="Plot lane"
            value={laneId as string}
            onChange={(event) => setLaneId(event.target.value as LaneId)}
          >
            <option value="">Every plot</option>
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.name}
              </option>
            ))}
          </select>
        </label>

        <label className="charmap-check">
          <input
            type="checkbox"
            checked={connectedOnly}
            onChange={(event) => setConnectedOnly(event.target.checked)}
          />
          <span className="muted small">Only people with relationships</span>
        </label>
      </header>

      {map.nodes.length === 0 ? (
        <p className="muted empty-state">Nobody to draw yet.</p>
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
            return (
              <g
                key={key}
                className={openPair === key ? 'charmap-edge open' : 'charmap-edge'}
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
        <p className="muted small">No reading this way.</p>
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
      {side(edge.forward, edge.a as string, edge.b as string)}
      {side(edge.back, edge.b as string, edge.a as string)}
    </aside>
  );
}
