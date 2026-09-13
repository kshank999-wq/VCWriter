import { relationshipName, type CharacterRelationship, type RelationshipKind } from './character-creator.js';
import type { CharacterId, LaneId } from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * The character relationship mind map (addendum 08 §12, stage 8).
 *
 * **Nothing here is stored.** The Story Sculptor's board keeps x and y because
 * the writer arranges it by hand and the arrangement is the work; this map is a
 * *reading of the relationships*, so the layout is computed every time. A new
 * character appears in it without anybody dragging one, deleting a relationship
 * closes the gap by itself, and there is no second copy of the cast to drift out
 * of step with the first.
 *
 * **One line per pair, with a label at each end.** Two people can read each
 * other differently (§11), and addendum 08 §3.1 already promised this is how the
 * map would show it: the edge carries both directions rather than drawing two
 * lines that overlap and say contradictory things.
 */

export interface MapNode {
  characterId: CharacterId;
  name: string;
  /** What the writer calls them — drawn under the name when there is room. */
  tags: string[];
  /** 0…1 in both directions; the component decides how big the picture is. */
  x: number;
  y: number;
  /** How far from the focus: 0 is the focus itself, and 0 for everybody when there is none. */
  ring: number;
}

export interface MapEdge {
  /** The pair, in a stable order so the edge has one identity. */
  a: CharacterId;
  b: CharacterId;
  /** How `a` reads `b`, and how `b` reads `a`. Either may be empty. */
  forward: CharacterRelationship[];
  back: CharacterRelationship[];
}

export interface CharacterMap {
  nodes: MapNode[];
  edges: MapEdge[];
}

/** The label an edge wears in one direction, or an empty string for none. */
export const edgeLabel = (rows: readonly CharacterRelationship[]): string =>
  rows.map(relationshipName).join(', ');

const pairKey = (one: string, two: string): string => (one < two ? `${one}:${two}` : `${two}:${one}`);

/**
 * Who appears in a plot lane, for §12's filter.
 *
 * Read off the cues of the beats in that lane's scenes, the same way the rest
 * of the module works out who is in a beat — so a character counts as being in
 * a lane because they speak there, not because somebody filed them under it.
 */
export const charactersInLane = (file: ProjectFile, laneId: LaneId): CharacterId[] => {
  const units = new Set(
    file.units.filter((unit) => (unit.laneId as string) === (laneId as string)).map((unit) => unit.id as string),
  );
  const spoken = new Set(
    file.beats
      .filter((beat) => units.has(beat.unitId as string))
      .flatMap((beat) =>
        beat.manuscript.elements
          .filter((element) => element.type === 'character')
          .map((element) => element.text.trim().toUpperCase()),
      ),
  );
  if (spoken.size === 0) return [];

  return file.characters
    .filter(
      (character) =>
        !character.archived &&
        [character.name, ...character.aliases].some((name) =>
          [...spoken].some((cue) => name.trim().length > 0 && cue.startsWith(name.trim().toUpperCase())),
        ),
    )
    .map((character) => character.id);
};

/**
 * The map: who is on it, where, and what joins them.
 *
 * **Focus is a reading of the graph rather than a filter on the cast** (§12:
 * *focus on one character and expand outward*). With a focus, the map is that
 * person at the centre, whoever they are connected to around them, and — at
 * depth 2 — whoever *those* people are connected to, further out. Without one,
 * everybody stands on a single circle.
 */
export const characterMap = (input: {
  file: ProjectFile;
  /** Limit the cast, for §12's lane and group filters. Undefined means everybody. */
  among?: readonly CharacterId[];
  /** Only these kinds of relationship. Undefined means all of them. */
  kinds?: readonly RelationshipKind[];
  focusId?: CharacterId | null;
  /** How far out from the focus to go. Ignored when there is no focus. */
  depth?: number;
  /**
   * Whether to draw somebody nothing joins to.
   *
   * True by default: a character no line reaches is a fact about the story
   * worth seeing, not an omission. A project with a large cast can turn it off.
   */
  includeUnconnected?: boolean;
}): CharacterMap => {
  const { file } = input;
  const allowed = input.among ? new Set(input.among.map((id) => id as string)) : null;

  const cast = file.characters
    .filter((person) => !person.archived && (!allowed || allowed.has(person.id as string)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const present = new Set(cast.map((person) => person.id as string));

  const kinds = input.kinds ? new Set<RelationshipKind>(input.kinds) : null;
  const rows = file.characterRelationships.filter(
    (one) =>
      present.has(one.fromCharacterId as string) &&
      present.has(one.toCharacterId as string) &&
      (!kinds || kinds.has(one.kind)),
  );

  // One edge per pair, carrying both readings.
  const pairs = new Map<string, MapEdge>();
  for (const row of rows) {
    const from = row.fromCharacterId as string;
    const to = row.toCharacterId as string;
    const key = pairKey(from, to);
    const edge = pairs.get(key) ?? {
      a: (from < to ? row.fromCharacterId : row.toCharacterId) as CharacterId,
      b: (from < to ? row.toCharacterId : row.fromCharacterId) as CharacterId,
      forward: [],
      back: [],
    };
    if ((edge.a as string) === from) edge.forward.push(row);
    else edge.back.push(row);
    pairs.set(key, edge);
  }

  const neighbours = new Map<string, Set<string>>();
  for (const edge of pairs.values()) {
    const a = edge.a as string;
    const b = edge.b as string;
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    if (!neighbours.has(b)) neighbours.set(b, new Set());
    neighbours.get(a)!.add(b);
    neighbours.get(b)!.add(a);
  }

  const focus = input.focusId && present.has(input.focusId as string) ? (input.focusId as string) : null;
  const depth = Math.max(1, input.depth ?? 1);

  /** Distance from the focus, or 0 for everybody when there is none. */
  const ringOf = new Map<string, number>();
  if (focus) {
    ringOf.set(focus, 0);
    let edgeOfSearch = [focus];
    for (let step = 1; step <= depth; step += 1) {
      const next: string[] = [];
      for (const id of edgeOfSearch) {
        for (const other of neighbours.get(id) ?? []) {
          if (ringOf.has(other)) continue;
          ringOf.set(other, step);
          next.push(other);
        }
      }
      edgeOfSearch = next;
    }
  } else {
    for (const person of cast) ringOf.set(person.id as string, 0);
  }

  const shown = cast.filter((person) => {
    const id = person.id as string;
    if (focus) return ringOf.has(id);
    if (input.includeUnconnected === false) return (neighbours.get(id)?.size ?? 0) > 0;
    return true;
  });

  const shownIds = new Set(shown.map((person) => person.id as string));

  // Laid out ring by ring, each ring's people spread evenly around it and in
  // name order, so the same project draws the same picture every time.
  const byRing = new Map<number, string[]>();
  for (const person of shown) {
    const ring = ringOf.get(person.id as string) ?? 0;
    if (!byRing.has(ring)) byRing.set(ring, []);
    byRing.get(ring)!.push(person.id as string);
  }

  const RADIUS = [0, 0.3, 0.47];
  const place = new Map<string, { x: number; y: number }>();
  for (const [ring, ids] of byRing) {
    if (focus && ring === 0) {
      place.set(ids[0]!, { x: 0.5, y: 0.5 });
      continue;
    }
    const radius = focus ? (RADIUS[Math.min(ring, RADIUS.length - 1)] ?? 0.47) : 0.38;
    ids.forEach((id, index) => {
      // Started at the top and gone round, which puts the first name where a
      // reader looks first.
      const angle = (index / ids.length) * Math.PI * 2 - Math.PI / 2;
      place.set(id, { x: 0.5 + radius * Math.cos(angle), y: 0.5 + radius * Math.sin(angle) });
    });
  }

  return {
    nodes: shown.map((person) => ({
      characterId: person.id,
      name: person.name,
      tags: person.tags,
      x: place.get(person.id as string)?.x ?? 0.5,
      y: place.get(person.id as string)?.y ?? 0.5,
      ring: ringOf.get(person.id as string) ?? 0,
    })),
    edges: [...pairs.values()].filter(
      (edge) => shownIds.has(edge.a as string) && shownIds.has(edge.b as string),
    ),
  };
};
