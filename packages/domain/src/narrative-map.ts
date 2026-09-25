import { choicesAt, choicesOf, elementsOf, entryPoints, findElement, isEmptyGroup } from './narrative.js';
import { depths, reachable } from './narrative-eval.js';
import { findingsAt } from './narrative-check.js';
import { nodesTouching } from './narrative-economy.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import type { Choice, NarrativeElement, NarrativeKind } from './entities/narrative.js';
import type { NarrativeElementId } from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * Interactive Narrative: the canvas (addendum 18, stage 4 — §1, §9).
 *
 * **The layout is derived, and there is nowhere to drag** — which is the
 * decision §1 turns on and the reason this is not the Story Sculptor. A
 * Sculptor node carries an x and a y because arranging the board *is* the work:
 * a writer moves an idea next to another idea and that adjacency means
 * something only they know. A branching graph is the opposite. Where a node
 * sits is a fact about the graph — how many choices from the start it is, and
 * what leads into it — so storing a position would let the picture disagree
 * with the design the moment an edge is drawn, and a designer would spend their
 * time tidying rather than writing. Draw an edge here and the node takes its
 * place with nothing arranged. It is the character map's argument (addendum 08
 * §8) applied to a graph instead of a set of relationships.
 *
 * Which leaves one honest limitation, stated rather than hidden: a designer
 * cannot *compose* this picture. The answer is that they can change it — by
 * changing the graph, which is the only thing the picture is about.
 *
 * Nothing here is stored. Nothing here decides what is *true* either: every
 * reading it draws comes from somewhere else — `depths` and `reachable` from
 * stage 2, `findingsAt` from stage 3, the spine from the story order.
 */

// ------------------------------------------------------------------ the map

export interface GraphNode {
  element: NarrativeElement;
  kind: NarrativeKind;
  name: string;
  /** Column: how many choices from a start, at the shortest. */
  column: number;
  /** Row within the column, from the top. The spine's lane is `laneRow`. */
  row: number;
  /**
   * Where the node sits against the central lane (addendum 25 §4.3): 0 is the
   * lane, negative is above it and positive below, counted outwards.
   */
  offset: number;
  /** Which side of the lane: the spine runs through the middle. */
  lane: 'spine' | 'above' | 'below';
  /** On the spine — bound to a beat that is in the script (§3). */
  onSpine: boolean;
  /** Where it falls in the script, one-based, or null where it is not on the spine. */
  scenePosition: number | null;
  /** Nothing leads here. Drawn, never hidden: it is the finding made visible. */
  stranded: boolean;
  /** How many ways in. Two or more is convergence, which needed no word (§2). */
  waysIn: number;
  /** How many choices are offered here, and how many of them lead somewhere. */
  waysOut: number;
  /** A rule decides whether the player may be here at all. */
  gated: boolean;
  /** Arrival changes the world. */
  changes: boolean;
  /** How many of stage 3's findings name this node, its choices or its rules. */
  findings: number;
  /**
   * Off the overlay: §9's *optional overlays for resources*, and the Sculptor's
   * rule pointed at a graph — **an overlay dims, it never hides**. A tree can
   * hide a depth because what is under it goes too; a graph with holes punched
   * in it is a picture of a different game.
   */
  dim: boolean;
}

export interface GraphLink {
  choice: Choice;
  from: NarrativeElementId;
  to: NarrativeElementId;
  /** Both ends on the spine and adjacent in the script: the story's main line. */
  spine: boolean;
  /** Back to a column at or before the one it leaves — a hub's return, a loop. */
  back: boolean;
  /** The choice asks something before it is offered. */
  gated: boolean;
}

export interface NarrativeMap {
  nodes: GraphNode[];
  links: GraphLink[];
  /** The widest column, so a caller can size the picture. */
  columns: number;
  rows: number;
  /** Nodes nothing reaches, which are laid out after everything else. */
  strandedCount: number;
  /** The row the spine runs along, with branches above and below it. */
  laneRow: number;
}

export interface GraphFilter {
  /** Only this node and what it touches, out to `within` steps. */
  focusId?: NarrativeElementId | null;
  /** How far from the focus. Ignored without one. */
  within?: number;
  /** Words to look for in a name or a note. */
  search?: string;
  /** Only these kinds. Undefined is all of them. */
  kinds?: readonly NarrativeKind[];
  /** Whether to place nodes nothing reaches. True by default — see below. */
  includeStranded?: boolean;
  /**
   * Light the nodes where one state or resource matters, and dim the rest
   * (§9). A bare id, because the question is the same for either.
   */
  touching?: string | null;
}

// -------------------------------------------------------------- the reading

/**
 * What the script says about a node, where it says anything (§3).
 *
 * Two numbers, because they answer two questions. **Where it falls** is the
 * beat's place in the manuscript, which is what decides the order along the
 * spine and which two nodes are next to each other on it. **Which scene** is
 * what a designer reads, and two nodes bound to two beats of one scene are both
 * in scene twelve without being the same place.
 */
interface SpinePlace {
  beat: number;
  scene: number;
}

const spinePositions = (file: ProjectFile): ReadonlyMap<string, SpinePlace> => {
  const at = new Map<string, SpinePlace>();
  let beat = 0;
  for (const [index, unit] of unitsInStoryOrder(file).entries()) {
    for (const one of beatsForUnit(file, unit.id)) {
      beat += 1;
      at.set(one.id as string, { beat, scene: index + 1 });
    }
  }
  return at;
};

const matches = (element: NarrativeElement, search: string): boolean => {
  const words = search.trim().toLowerCase();
  if (words.length === 0) return true;
  return `${element.name} ${element.note}`.toLowerCase().includes(words);
};

/**
 * Everything within `within` steps of the focus, **in both directions**.
 *
 * Forwards only would answer *where can I go from here*, which is a different
 * and smaller question than the one somebody clicking a node is asking: what
 * does this touch. A convergence with three ways in is most of what a designer
 * wants to see when they select the node they converge on.
 */
const near = (
  file: ProjectFile,
  focusId: NarrativeElementId,
  within: number,
): ReadonlySet<string> => {
  const out = new Map<string, string[]>();
  for (const choice of choicesOf(file)) {
    if (!choice.toElementId) continue;
    const from = choice.elementId as string;
    const to = choice.toElementId as string;
    out.set(from, [...(out.get(from) ?? []), to]);
    out.set(to, [...(out.get(to) ?? []), from]);
  }
  const found = new Set<string>([focusId as string]);
  let edge = [focusId as string];
  for (let step = 0; step < within; step += 1) {
    const next: string[] = [];
    for (const here of edge) {
      for (const there of out.get(here) ?? []) {
        if (found.has(there)) continue;
        found.add(there);
        next.push(there);
      }
    }
    edge = next;
  }
  return found;
};

/**
 * The graph, placed.
 *
 * Columns are `depths` — how many choices from a start — because that is the
 * one ordering a branching graph actually has. Within a column, the **spine
 * takes the central lane, in the script's own order**, which is §1's *primary
 * path* drawn rather than declared: a designer reading left to right along the
 * lane is reading their story (addendum 25 §4.3 moved it from the top row to
 * the middle, at Ken's asking). Everything else is stacked above and below,
 * ordered by where it is reached from, so a branch sits near what it branches
 * off and on the side it left by.
 *
 * A node nothing reaches has no depth, so it is placed in a column of its own
 * at the end and drawn stranded. **Placed rather than dropped**: §4's finding
 * is that it is unreachable, and a map that quietly omitted it would hide the
 * very thing the validator is shouting about.
 */
export const narrativeMap = (file: ProjectFile, filter: GraphFilter = {}): NarrativeMap => {
  const rank = depths(file);
  const found = reachable(file);
  const script = spinePositions(file);

  const kinds = filter.kinds ? new Set<NarrativeKind>(filter.kinds) : null;
  const around = filter.focusId ? near(file, filter.focusId, Math.max(1, filter.within ?? 1)) : null;
  const search = filter.search ?? '';
  const includeStranded = filter.includeStranded ?? true;
  const lit = filter.touching ? nodesTouching(file, filter.touching) : null;

  const shown = elementsOf(file).filter((one) => {
    if (kinds && !kinds.has(one.kind)) return false;
    if (around && !around.has(one.id as string)) return false;
    if (!matches(one, search)) return false;
    if (!includeStranded && !found.has(one.id as string)) return false;
    return true;
  });
  const present = new Set(shown.map((one) => one.id as string));

  // Where a node is reached from, by its earliest parent's place, so a branch
  // sits under what it branches off rather than wherever it happened to be
  // created.
  const firstParent = new Map<string, number>();
  const parentOf = new Map<string, string>();
  for (const choice of choicesOf(file)) {
    if (!choice.toElementId) continue;
    const to = choice.toElementId as string;
    const from = rank.get(choice.elementId as string);
    if (from === undefined) continue;
    if (from < (firstParent.get(to) ?? Number.POSITIVE_INFINITY)) {
      firstParent.set(to, from);
      parentOf.set(to, choice.elementId as string);
    }
  }

  const strandedColumn = Math.max(0, ...[...rank.values()].map((one) => one + 1), 0);
  const columnOf = (element: NarrativeElement): number =>
    rank.get(element.id as string) ?? strandedColumn;

  const byColumn = new Map<number, NarrativeElement[]>();
  for (const element of shown) {
    const column = columnOf(element);
    byColumn.set(column, [...(byColumn.get(column) ?? []), element]);
  }

  const nodes: GraphNode[] = [];
  /** Node id → its beat's place, for the one question `scenePosition` cannot answer. */
  const onSpine = new Map<string, number>();
  /**
   * The spine runs through the middle and branches leave it above and below
   * (addendum 25 §4.3). A branch keeps to the side its parent is on, so a line
   * that leaves the lane upwards carries on upwards until it comes back, and a
   * branch straight off the spine takes the next side in turn — above first,
   * because the Player Lane sits directly under the spine.
   */
  const sideOf = new Map<string, number>();
  let nextSide = -1;
  for (const [column, members] of [...byColumn.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...members].sort((a, b) => {
      const spineA = script.get(a.boundBeatId as string) ?? null;
      const spineB = script.get(b.boundBeatId as string) ?? null;
      // The spine first, in the script's order: the top row read left to right
      // is the story.
      if (spineA && spineB) return spineA.beat - spineB.beat;
      if (spineA) return -1;
      if (spineB) return 1;
      const parentA = firstParent.get(a.id as string) ?? Number.POSITIVE_INFINITY;
      const parentB = firstParent.get(b.id as string) ?? Number.POSITIVE_INFINITY;
      if (parentA !== parentB) return parentA - parentB;
      return a.createdAt.localeCompare(b.createdAt);
    });

    const taken = new Set<number>();
    for (const element of ordered) {
      const offered = choicesAt(file, element.id);
      const place = element.boundBeatId ? (script.get(element.boundBeatId as string) ?? null) : null;
      if (place) onSpine.set(element.id as string, place.beat);
      let offset: number;
      if (place && !taken.has(0)) {
        offset = 0;
      } else {
        const parent = parentOf.get(element.id as string);
        const inherited = parent !== undefined ? (sideOf.get(parent) ?? 0) : 0;
        let side = inherited;
        if (side === 0) {
          side = nextSide;
          nextSide = -nextSide;
        }
        let step = 1;
        while (taken.has(side * step)) step += 1;
        offset = side * step;
      }
      taken.add(offset);
      sideOf.set(element.id as string, Math.sign(offset));
      nodes.push({
        element,
        kind: element.kind,
        name: element.name,
        column,
        row: offset,
        offset,
        lane: offset === 0 ? 'spine' : offset < 0 ? 'above' : 'below',
        onSpine: place !== null,
        scenePosition: place?.scene ?? null,
        stranded: !found.has(element.id as string),
        waysIn: choicesOf(file).filter((one) => one.toElementId === element.id).length,
        waysOut: offered.filter((one) => one.toElementId !== null).length,
        gated: !isEmptyGroup(element.conditions),
        changes: element.effects.length > 0,
        findings: findingsAt(file, element.id).length,
        dim: lit !== null && !lit.has(element.id as string),
      });
    }
  }

  // Rows counted from the top: the highest branch is row 0 and the lane sits
  // as far down as the tallest stack above it.
  const laneRow = nodes.length === 0 ? 0 : -Math.min(0, ...nodes.map((one) => one.offset));
  for (const node of nodes) node.row = node.offset + laneRow;

  const placed = new Map(nodes.map((one) => [one.element.id as string, one]));
  const links: GraphLink[] = [];
  for (const choice of choicesOf(file)) {
    if (!choice.toElementId) continue;
    const from = placed.get(choice.elementId as string);
    const to = placed.get(choice.toElementId as string);
    if (!from || !to || !present.has(from.element.id as string) || !present.has(to.element.id as string)) {
      continue;
    }
    // The story's own line: both ends on the spine and next to each other in
    // the manuscript. Two nodes bound to beats of the same scene are adjacent
    // too, which is right — the writer put them one after the other.
    const leaves = onSpine.get(from.element.id as string);
    const arrives = onSpine.get(to.element.id as string);
    links.push({
      choice,
      from: from.element.id,
      to: to.element.id,
      spine: leaves !== undefined && arrives === leaves + 1,
      back: to.column <= from.column,
      gated: !isEmptyGroup(choice.conditions),
    });
  }

  return {
    nodes,
    links,
    columns: nodes.length === 0 ? 0 : Math.max(...nodes.map((one) => one.column)) + 1,
    rows: nodes.length === 0 ? 0 : Math.max(...nodes.map((one) => one.row)) + 1,
    strandedCount: nodes.filter((one) => one.stranded).length,
    laneRow,
  };
};

// -------------------------------------------------------------- what it says

/** The picture in a sentence, for the bar above it. */
export const describeGraph = (file: ProjectFile, map: NarrativeMap): string => {
  if (map.nodes.length === 0) {
    return elementsOf(file).length === 0
      ? 'Nothing on the board yet. Drop a scene into the lane to start the story.'
      : 'Nothing matches that.';
  }
  const parts = [
    `${map.nodes.length} node${map.nodes.length === 1 ? '' : 's'}`,
    `${map.links.length} connection${map.links.length === 1 ? '' : 's'}`,
  ];
  const spine = map.nodes.filter((one) => one.onSpine).length;
  if (spine > 0) parts.push(`${spine} on the spine`);
  const converging = map.nodes.filter((one) => one.waysIn > 1).length;
  if (converging > 0) parts.push(`${converging} converging`);
  if (map.strandedCount > 0) {
    parts.push(`${map.strandedCount} nothing reaches`);
  }
  return `${parts.join(' · ')}.`;
};

/**
 * What a node says about itself on the card, under its name.
 *
 * Every word of it is read: *3 ways in* is convergence, *gated* is a rule, and
 * *scene 12* is where the manuscript puts it. A card that said what somebody
 * typed into it would be a card that could be wrong.
 */
export const describeNode = (node: GraphNode): string => {
  const parts: string[] = [];
  // Said in words, because the mark that carries it on the card is a stripe
  // down one edge and a stripe explains itself to nobody.
  if (node.element.entry) parts.push('starts here');
  if (node.scenePosition !== null) parts.push(`scene ${node.scenePosition}`);
  if (node.stranded) parts.push('nothing leads here');
  else if (node.waysIn > 1) parts.push(`${node.waysIn} ways in`);
  if (node.waysOut === 0) parts.push(node.element.endsHere || node.kind === 'ending' ? 'ends here' : 'no way on');
  else parts.push(`${node.waysOut} way${node.waysOut === 1 ? '' : 's'} on`);
  if (node.gated) parts.push('gated');
  if (node.changes) parts.push('changes the world');
  return parts.join(' · ');
};

/** Everything offered at a node, for the inspector beside the map (§15.2). */
export const choicesFor = (file: ProjectFile, elementId: NarrativeElementId): {
  choice: Choice;
  to: NarrativeElement | null;
  gated: boolean;
}[] =>
  choicesAt(file, elementId).map((choice) => ({
    choice,
    to: choice.toElementId ? findElement(file, choice.toElementId) : null,
    gated: !isEmptyGroup(choice.conditions),
  }));

/**
 * Where a new node goes when there is no graph yet.
 *
 * The first one is an entry (stage 1 decided that), and this is the other half:
 * a designer who presses *add* on an empty canvas gets something they can walk
 * from rather than a node with no way in and a validator complaining about it.
 */
export const wouldBeEntry = (file: ProjectFile): boolean => entryPoints(file).length === 0;
