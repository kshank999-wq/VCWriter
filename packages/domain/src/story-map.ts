import { unitsInStoryOrder } from './selectors.js';
import { sceneHeadingOf } from './scene-heading.js';
import { setupTrack } from './setups.js';
import { thematicTracks } from './themes.js';
import { arcInStoryOrder } from './character-creator.js';
import { dependenciesIn, momentsOf, threadsInOrder } from './threads.js';
import type { SceneRange } from './character-map.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, StructuralUnitId } from './ids.js';

/**
 * The story-relationship map (addendum 15, from Ken's Research Links spec).
 *
 * §21 is the whole design and it is worth quoting: *build Links as VC Writer's
 * shared story-relationship visualization layer, not as a standalone feature.
 * The timeline engine should accept normalized nodes and edges from Links,
 * Setups & Payoffs, Themes & Motifs, Character Arcs, and future Research
 * modules.*
 *
 * So this module knows about **nodes, edges and a scene index**, and it knows
 * nothing else. It cannot tell a setup from a motif; what it has of either is a
 * position, a label, a shape and whether something is wrong. Each module
 * contributes rows through one small reader below, and adding §19's next track —
 * locations, objects, mysteries — is another reader and no change to the engine
 * or to anything that draws it.
 *
 * **Nothing here is stored.** Every node's position is read off the script
 * every time, which is §13's requirement that reordering scenes repositions
 * every affected node, answered by there being nothing to reposition. It is the
 * same absence as the book index's page numbers and the Character Creator's
 * colour, for the third time.
 */

export const MAP_TRACKS = ['links', 'setups', 'thematics', 'arcs'] as const;
export type MapTrackId = (typeof MAP_TRACKS)[number];

/** What a node is drawn as. The engine picks the glyph; the reader picks the name. */
export type NodeShape = 'dot' | 'ring' | 'diamond' | 'square';

export interface TimelineNode {
  /** Stable across reads: the record's own id, so selection survives a redraw. */
  id: string;
  /** Story index of the scene it falls in. Never stored, never dragged (§13). */
  index: number;
  unitId: StructuralUnitId | null;
  beatId: BeatId | null;
  /** The hover summary §13 asks for. */
  label: string;
  shape: NodeShape;
  /** Drawn in the warning state — a setup that falls after its payoff. */
  warn: boolean;
}

export interface TimelineEdge {
  id: string;
  from: string;
  to: string;
  /**
   * `sequence` joins moments in the order they happen and asserts nothing.
   * `dependency` is directional and is only ever drawn where somebody said so
   * — §5.2's rule that the system does not infer causality.
   */
  relationship: 'sequence' | 'dependency';
}

/** What a row is a row of. The engine passes it back; it never reads it. */
export type TimelineSourceKind = 'thread' | 'setup_payoff' | 'theme' | 'motif' | 'character_arc';

export interface TimelineRow {
  trackId: MapTrackId;
  sourceKind: TimelineSourceKind;
  sourceId: string;
  title: string;
  /** A motif's type, a payoff's count — whatever the row's own module says. */
  detail: string;
  /** The row itself is in a warning state: §6's under-prepared payoff. */
  warn: boolean;
  nodes: TimelineNode[];
  edges: TimelineEdge[];
}

export interface TimelineTrack {
  id: MapTrackId;
  title: string;
  rows: TimelineRow[];
}

export interface TimelineScene {
  index: number;
  unitId: StructuralUnitId;
  /** What the scene box shows: its number and its heading or title (§2). */
  number: number;
  heading: string;
}

export interface StoryMap {
  scenes: TimelineScene[];
  tracks: TimelineTrack[];
  /** Rows the filter hid, so a filtered map can say it is filtered. */
  hidden: number;
}

export interface MapFilter {
  /** Tracks to show. Undefined is all of them (§14). */
  tracks?: readonly MapTrackId[];
  /** Isolate these rows alone. Empty or undefined is no isolation. */
  only?: readonly { trackId: MapTrackId; sourceId: string }[];
  /** §15's scene-range view. Null is the whole script. */
  range?: SceneRange | null;
}

const TRACK_TITLES: Record<MapTrackId, string> = {
  links: 'Links',
  setups: 'Setups & Payoffs',
  thematics: 'Themes & Motifs',
  arcs: 'Character Arcs',
};

// ------------------------------------------------------------- the readers

/**
 * Links (§4, §5).
 *
 * The one track whose rows the writer draws by hand, and the only one where the
 * relationship is a choice. A sequence thread is joined in script order — which
 * is computed here and stored nowhere — and a dependency thread is joined only
 * where the writer drew an arrow.
 */
const threadRows = (file: ProjectFile): TimelineRow[] =>
  threadsInOrder(file).map((thread) => {
    const moments = momentsOf(file, thread.id).filter((one) => one.resolved);
    const nodes: TimelineNode[] = moments.map((moment) => ({
      id: moment.node.id as string,
      index: moment.unitIndex,
      unitId: null,
      beatId: moment.node.beatId,
      label: `${thread.name || 'Untitled thread'} — ${moment.node.note || moment.text || moment.where}`,
      shape: 'dot',
      warn: false,
    }));

    const edges: TimelineEdge[] =
      thread.relationship === 'dependency'
        ? dependenciesIn(file, thread.id)
            // Drawn from what came first to what needs it: the direction the
            // story travels, which is the reverse of how the record reads.
            .map((pair) => ({
              id: `${pair.required}->${pair.dependent}`,
              from: pair.required,
              to: pair.dependent,
              relationship: 'dependency' as const,
            }))
            .filter((edge) => nodes.some((one) => one.id === edge.from) && nodes.some((one) => one.id === edge.to))
        : chain(nodes);

    return {
      trackId: 'links',
      sourceKind: 'thread',
      sourceId: thread.id as string,
      title: thread.name || 'Untitled thread',
      detail: thread.relationship === 'dependency' ? 'dependency' : '',
      // A thread of one is thin rather than wrong, and §11 asks for two.
      warn: nodes.length < 2,
      nodes,
      edges,
    };
  });

/**
 * Setups and payoffs (§6).
 *
 * Every setup connects **to the payoff, directionally**, which §12 says may be
 * generated from relationships the writer has already defined — and they have:
 * naming a passage as a setup of this payoff *is* the dependency. So nothing is
 * declared twice and nothing is stored here at all.
 *
 * The red state is `setupReadiness`'s, unchanged: the row is red when fewer
 * than the wanted number of setups fall before the payoff, and a setup that
 * falls after it is drawn where it actually is, in the warning state.
 */
const setupRows = (file: ProjectFile): TimelineRow[] =>
  setupTrack(file).map((row) => {
    const nodes: TimelineNode[] = row.marks.map((mark) => ({
      id: mark.id,
      index: mark.unitIndex,
      unitId: null,
      beatId: null,
      label: mark.label,
      shape: mark.kind === 'payoff' ? 'diamond' : 'ring',
      warn: !mark.counts,
    }));
    const payoff = nodes.find((one) => one.shape === 'diamond');
    const edges: TimelineEdge[] = payoff
      ? nodes
          .filter((one) => one !== payoff)
          .map((setup) => ({
            id: `${setup.id}->${payoff.id}`,
            from: setup.id,
            to: payoff.id,
            relationship: 'dependency' as const,
          }))
      : [];

    return {
      trackId: 'setups',
      sourceKind: 'setup_payoff',
      sourceId: row.recordId,
      title: row.title,
      detail: row.count,
      warn: row.light === 'red',
      nodes,
      edges,
    };
  });

/**
 * Themes and motifs (§7).
 *
 * Two kinds, still — addendum 12 §6's rule that they are never one track holds
 * here too, as two `sourceKind`s inside one track, each row its own. A
 * recurrence is joined in chronological order and claims nothing, which is
 * exactly what a sequence edge is for.
 */
const thematicRows = (file: ProjectFile): TimelineRow[] => {
  const tracks = thematicTracks(file);
  const rowsFor = (kind: 'theme' | 'motif') =>
    tracks[kind === 'theme' ? 'themes' : 'motifs']
      .filter((row) => row.marks.length > 0)
      .map((row): TimelineRow => {
        const nodes: TimelineNode[] = row.marks.map((mark) => ({
          id: mark.linkId,
          index: mark.unitIndex,
          unitId: null,
          beatId: null,
          label: mark.label,
          shape: kind === 'theme' ? 'square' : 'ring',
          warn: false,
        }));
        return {
          trackId: 'thematics',
          sourceKind: kind,
          sourceId: row.ownerId,
          title: row.name,
          detail: row.detail,
          warn: false,
          nodes,
          edges: chain(nodes),
        };
      });
  return [...rowsFor('theme'), ...rowsFor('motif')];
};

/**
 * Character arcs (§8).
 *
 * **The arc data is the Character Creator's, read and never copied** — §8 asks
 * for exactly that and the module already holds it. A point's position is where
 * it was pinned in the script; a point still on deck has no position and so is
 * not drawn, because a track is a reading of the script.
 *
 * Sequence by default, and dependency *where explicitly defined*: a cross-arc
 * story link between two points of this arc is a relationship the writer drew
 * (addendum 08 §13), and it is drawn as the arrow it is.
 */
const arcRows = (file: ProjectFile): TimelineRow[] => {
  const rows: TimelineRow[] = [];
  for (const character of file.characters) {
    if (character.archived) continue;
    const points = file.arcPoints.filter((point) => (point.characterId as string) === (character.id as string));
    if (points.length === 0) continue;

    const placed = arcInStoryOrder({ points, links: file.usageLinks, file }).filter(
      (entry) => entry.where !== null,
    );
    const nodes: TimelineNode[] = placed.map((entry) => ({
      id: entry.point.id as string,
      index: entry.where as number,
      unitId: null,
      beatId: null,
      label: `${character.name} — ${entry.point.text || entry.point.kind}`,
      shape: 'dot',
      warn: entry.point.retired,
    }));
    if (nodes.length === 0) continue;

    const mine = new Set(nodes.map((one) => one.id));
    const declared: TimelineEdge[] = file.links
      .filter(
        (link) =>
          link.from.type === 'arc_point' &&
          link.to.type === 'arc_point' &&
          mine.has(link.from.id) &&
          mine.has(link.to.id),
      )
      .map((link) => ({
        id: link.id as string,
        from: link.from.id,
        to: link.to.id,
        relationship: 'dependency' as const,
      }));

    rows.push({
      trackId: 'arcs',
      sourceKind: 'character_arc',
      sourceId: character.id as string,
      title: character.name,
      detail: `${nodes.length} in the script`,
      warn: false,
      nodes,
      // Declared relationships replace the chain rather than joining it: two
      // pictures of the same points would say the order twice and the claim
      // once, and the claim is the part worth seeing.
      edges: declared.length > 0 ? declared : chain(nodes),
    });
  }
  return rows;
};

/** Consecutive nodes joined in the order they happen. Asserts nothing (§5.1). */
const chain = (nodes: readonly TimelineNode[]): TimelineEdge[] => {
  const sorted = [...nodes].sort((a, b) => a.index - b.index);
  const edges: TimelineEdge[] = [];
  for (let at = 1; at < sorted.length; at += 1) {
    const from = sorted[at - 1] as TimelineNode;
    const to = sorted[at] as TimelineNode;
    edges.push({ id: `${from.id}->${to.id}`, from: from.id, to: to.id, relationship: 'sequence' });
  }
  return edges;
};

// -------------------------------------------------------------- the engine

const READERS: Record<MapTrackId, (file: ProjectFile) => TimelineRow[]> = {
  links: threadRows,
  setups: setupRows,
  thematics: thematicRows,
  arcs: arcRows,
};

/**
 * The whole map, filtered.
 *
 * A **range narrows what is drawn and never what exists** — the same rule the
 * character map's scene range holds (addendum 08 §12): a row whose moments all
 * fall outside the range is not shown, and a row that straddles it keeps its
 * far nodes so a connector does not appear to start nowhere.
 */
export const storyMap = (file: ProjectFile, filter: MapFilter = {}): StoryMap => {
  const units = unitsInStoryOrder(file);
  const scenes: TimelineScene[] = units.map((unit, index) => {
    const heading = sceneHeadingOf(file, unit.id);
    return {
      index,
      unitId: unit.id,
      number: index + 1,
      heading: heading
        ? [heading.setting, heading.place, heading.time].filter((part) => part.length > 0).join(' ')
        : unit.title || 'Untitled',
    };
  });

  const wanted = new Set<MapTrackId>(filter.tracks ?? MAP_TRACKS);
  const isolated = filter.only ?? [];
  const keeps = (row: TimelineRow) =>
    isolated.length === 0 || isolated.some((one) => one.trackId === row.trackId && one.sourceId === row.sourceId);

  const low = filter.range ? Math.min(filter.range.from, filter.range.to) - 1 : 0;
  const high = filter.range ? Math.max(filter.range.from, filter.range.to) - 1 : scenes.length - 1;
  const inRange = (row: TimelineRow) => row.nodes.some((node) => node.index >= low && node.index <= high);

  let hidden = 0;
  const tracks: TimelineTrack[] = MAP_TRACKS.filter((id) => wanted.has(id)).map((id) => {
    const all = READERS[id](file);
    const rows = all.filter((row) => {
      const keep = keeps(row) && (row.nodes.length === 0 ? isolated.length > 0 : inRange(row));
      if (!keep) hidden += 1;
      return keep;
    });
    return { id, title: TRACK_TITLES[id], rows };
  });

  // Rows of a hidden track are hidden too, and a writer who turned a track off
  // knows where they went — so they are not counted as filtered away.
  return { scenes, tracks, hidden };
};

/**
 * Everything a filter could isolate, for the control that offers it (§14).
 *
 * Read off the same readers as the map, so nothing can be offered that cannot
 * be shown.
 */
export const isolatable = (file: ProjectFile): { trackId: MapTrackId; sourceId: string; title: string }[] =>
  MAP_TRACKS.flatMap((id) =>
    READERS[id](file).map((row) => ({ trackId: id, sourceId: row.sourceId, title: row.title })),
  );

/**
 * Nodes of a row that land in the same scene, grouped.
 *
 * §15's *dense groups of nodes may collapse into indicators/counts*. The
 * grouping is a reading and the decision to draw the pile instead of its parts
 * belongs to whatever is drawing, because it is the one that knows how wide a
 * scene is on the screen.
 */
export const pilesOf = (row: TimelineRow): { index: number; nodes: TimelineNode[] }[] => {
  const byScene = new Map<number, TimelineNode[]>();
  for (const node of row.nodes) {
    const list = byScene.get(node.index) ?? [];
    list.push(node);
    byScene.set(node.index, list);
  }
  return [...byScene.entries()]
    .map(([index, nodes]) => ({ index, nodes }))
    .sort((a, b) => a.index - b.index);
};

/** One node, found anywhere on the map — for the inspector and for navigation. */
export const nodeOn = (map: StoryMap, nodeId: string): { row: TimelineRow; node: TimelineNode } | null => {
  for (const track of map.tracks) {
    for (const row of track.rows) {
      const node = row.nodes.find((one) => one.id === nodeId);
      if (node) return { row, node };
    }
  }
  return null;
};

/** What the map holds, in one line. */
export const describeMap = (map: StoryMap): string => {
  const rows = map.tracks.reduce((count, track) => count + track.rows.length, 0);
  if (rows === 0) return 'Nothing to map yet.';
  const nodes = map.tracks.reduce(
    (count, track) => count + track.rows.reduce((inner, row) => inner + row.nodes.length, 0),
    0,
  );
  const filtered = map.hidden > 0 ? ` · ${map.hidden} filtered out` : '';
  return `${rows} ${rows === 1 ? 'row' : 'rows'} · ${nodes} ${nodes === 1 ? 'moment' : 'moments'}${filtered}`;
};
