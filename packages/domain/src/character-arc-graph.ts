import { nounsFor } from './formats.js';
import { placedMarkerForUnit } from './markers.js';
import { workingCast } from './characters.js';
import {
  ARC_INTENT_WORDS,
  ARC_POINT_NAMES,
  ARC_SHAPE_WORDS,
  arcBoard,
  arcEffectsOf,
  isDecisive,
  type ArcIntent,
  type ArcPointKind,
  type ArcPointRow,
  type ArcShape,
  type UsageColour,
} from './character-creator.js';
import type { ProjectFile } from './project-file.js';
import type { ArcPointId, CharacterId, StructuralUnitId } from './ids.js';

/**
 * The arc as a picture (addendum 25 §5, the handoff's *Arc* screen): a ruler
 * of divisions, the points standing where the story puts them, the arcs it is
 * joined to underneath, and a key.
 *
 * **Nothing here is stored.** Where a point stands is read from the scene it
 * is pinned to, how high it stands is read from the points before it, and the
 * shape is read from the points — so moving a scene moves the mark and cutting
 * one takes it off the line, with nothing run. The only thing the writer says
 * is the **intention**, and that is kept apart from every reading on purpose.
 */

// ----------------------------------------------------------------- the ruler

/** One tick on the ruler: a division of the work, where it falls. */
export interface ArcTick {
  label: string;
  /** Where along the ruler, 0 to 1. */
  at: number;
}

export interface ArcRuler {
  ticks: ArcTick[];
  /** What the ruler is measuring in, in the format's own noun. */
  noun: string;
  /** How many scenes it is drawn over — the thing `at` is a fraction of. */
  scenes: number;
}

/**
 * The divisions of the work, in story order.
 *
 * **Divisions where there are any, scenes where there are none.** A script
 * with no acts still has a spine, and a ruler labelled with nothing is a ruler
 * nobody can read a position off. The position of a tick is the position of
 * the scene it opens, so moving a chapter moves the tick with nothing run.
 */
export const arcRuler = (file: ProjectFile): ArcRuler => {
  const nouns = nounsFor(file.project.format);
  const units = [...file.units].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
  const span = Math.max(units.length - 1, 1);

  const ticks: ArcTick[] = [];
  units.forEach((unit, at) => {
    const placed = placedMarkerForUnit(file, unit.id as string);
    if (placed && placed.label.trim().length > 0) {
      ticks.push({ label: placed.label, at: at / span });
    }
  });
  if (ticks.length > 0) return { ticks, noun: nouns.division, scenes: units.length };

  return {
    ticks: units.map((unit, at) => ({
      label: unit.sequenceLabel.trim() || unit.title.trim() || '',
      at: at / span,
    })),
    noun: nouns.unit,
    scenes: units.length,
  };
};

// ----------------------------------------------------------------- the marks

/**
 * How far each kind of point moves the line.
 *
 * **The word is the truth and the number is only for drawing** — addendum 13
 * §1, where a scene's polarity label is the record and its figure exists so
 * the graph can be plotted. Nothing here is a score: a setback goes down
 * because *setback* means down, and a writer is never shown the number, asked
 * for it, or allowed to type one.
 */
const STEP: Record<ArcPointKind, number> = {
  movement: 1,
  discovery: 1,
  decision: 1,
  test: 0,
  turning_point: 2,
  setback: -1,
  opportunity: 0,
  refusal: -1,
  doubling_down: -2,
};

export interface ArcMark {
  pointId: ArcPointId;
  kind: ArcPointKind;
  /** The kind in words, which is what the screen writes over the mark. */
  kindName: string;
  text: string;
  colour: UsageColour;
  /** The decisive kinds get a shape of their own on the line (§8). */
  decisive: boolean;
  /**
   * Where along the ruler, 0 to 1. Null on deck — which is not a position of
   * zero: *unplaced* and *at the start* are different things.
   */
  at: number | null;
  /** How high, 0 to 1, with the arc's own low point at 0. */
  height: number;
  /** The division it falls in, where there is one: *Ch 5*. */
  division: string;
  unitId: StructuralUnitId | null;
  unitTitle: string | null;
  /** What this point sets off in somebody else's arc, and what sets it off. */
  effects: { verb: string; otherName: string; outward: boolean }[];
}

/** Somebody else's arc, drawn under this one because the two are joined (§13). */
export interface ConnectedArc {
  characterId: CharacterId;
  name: string;
  /** Their arc's shape, read the same way this one's is. */
  shape: ArcShape;
  shapeWords: string;
  beginning: string;
  marks: ArcMark[];
  /** How many links join the two arcs — which is why this row is here. */
  joins: number;
}

export interface ArcGraph {
  ruler: ArcRuler;
  beginning: string;
  need: string;
  ending: string;
  /** Where the arc ends, on the ruler, where its last point says. */
  endsAt: number | null;
  marks: ArcMark[];
  onDeck: ArcMark[];
  /** What the writer said they were aiming at, where they said. */
  intent: ArcIntent | null;
  /** What the points say it turned out to be. */
  read: ArcShape;
  /**
   * Said where the two disagree, and **null where they agree or where there
   * is nothing to compare** — a note that appeared the moment an intention was
   * chosen would be scolding somebody for having a plan.
   */
  disagreement: string | null;
  connected: ConnectedArc[];
}

/**
 * The division each scene falls under, carried forward.
 *
 * **The nearest marker at or before**, not the one on this very scene — a
 * marker sits on the scene a chapter opens on, so asking per unit would name
 * the chapter for its first scene and leave every other point in it blank.
 * `divisionSpan`'s rule, the same one the Story panel reads (§3).
 */
const divisionsOf = (file: ProjectFile): Map<string, string> => {
  const out = new Map<string, string>();
  let division = '';
  for (const unit of [...file.units].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))) {
    const placed = placedMarkerForUnit(file, unit.id as string);
    if (placed && placed.label.trim().length > 0) division = placed.label;
    out.set(unit.id as string, division);
  }
  return out;
};

/** Every point of one arc as a mark, with the line's height worked out. */
const marksOf = (
  file: ProjectFile,
  rows: readonly ArcPointRow[],
  positions: Map<string, number>,
  divisions: Map<string, string>,
  span: number,
  withEffects: boolean,
): ArcMark[] => {
  // The running total: what has happened to them by this point, in order.
  let running = 0;
  const raw = rows.map((row) => {
    running += STEP[row.point.kind];
    return { row, level: running };
  });
  // Normalised against this arc's own range, so a small arc is not drawn flat
  // and a long one does not run off the top — with nothing at all before the
  // first point, so a fall really starts from where they began.
  const levels = raw.map((one) => one.level);
  const low = Math.min(0, ...levels);
  const high = Math.max(0, ...levels);
  const range = high - low;
  // **One mark makes no claim.** A single point says nothing about a rise or
  // a fall, so it sits in the middle rather than being drawn at the top for
  // the arithmetic's sake.
  const alone = raw.length <= 1;

  return raw.map(({ row, level }) => {
    const at = positions.get((row.point.id as string) + '');
    const unit = row.unitId ? file.units.find((one) => (one.id as string) === row.unitId) : undefined;
    return {
      pointId: row.point.id,
      kind: row.point.kind,
      kindName: ARC_POINT_NAMES[row.point.kind],
      text: row.point.text,
      colour: row.colour,
      decisive: isDecisive(row.point.kind),
      at: at === undefined ? null : span === 0 ? 0 : at / span,
      height: alone || range === 0 ? 0.5 : (level - low) / range,
      division: unit ? (divisions.get(unit.id as string) ?? '') : '',
      unitId: unit?.id ?? null,
      unitTitle: row.unitTitle,
      effects: withEffects
        ? arcEffectsOf(file, row.point.id).map((one) => ({
            verb: one.verb,
            otherName: one.otherCharacterName,
            outward: one.outward,
          }))
        : [],
    };
  });
};

/**
 * Which scene each of somebody's placed arc points is in, as a position in the
 * story order. Read off the usage links, so a scene that moves moves the mark.
 */
const positionsFor = (file: ProjectFile, characterId: string): Map<string, number> => {
  const order = new Map<string, number>();
  [...file.units]
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
    .forEach((unit, at) => order.set(unit.id as string, at));
  const beatUnit = new Map<string, string>();
  for (const beat of file.beats) beatUnit.set(beat.id as string, beat.unitId as string);

  const out = new Map<string, number>();
  for (const link of file.usageLinks) {
    if (link.ownerKind !== 'arc_point') continue;
    const point = file.arcPoints.find((one) => (one.id as string) === link.ownerId);
    if (!point || (point.characterId as string) !== characterId) continue;
    const unitId = beatUnit.get(link.beatId as string);
    const at = unitId === undefined ? undefined : order.get(unitId);
    if (at === undefined) continue;
    // The earliest, where a point landed in several scenes: an arc point is
    // one dramatic event, and the line should be drawn where it first happens.
    const already = out.get(link.ownerId);
    out.set(link.ownerId, already === undefined ? at : Math.min(already, at));
  }
  return out;
};

/**
 * What to say when the intention and the reading disagree (§5).
 *
 * **It states both and picks neither**, because either could be the one that
 * is wrong: a writer aiming at a fall who has written a rise may have changed
 * their mind, or may have lost the thread. Software does not know which.
 */
export const describeArcDisagreement = (
  intent: ArcIntent | null,
  read: ArcShape,
): string | null => {
  if (intent === null) return null;
  // Nothing to compare: an arc with no points has no shape, which is exactly
  // the moment the intention is worth having.
  if (read === 'unstarted') return null;
  if (read === 'flat') {
    return `Aiming at “${ARC_INTENT_WORDS[intent]}”. Nothing written yet says which way it goes.`;
  }
  if ((read as string) === (intent as string)) return null;
  return (
    `Aiming at “${ARC_INTENT_WORDS[intent]}”. The points read as ` +
    `“${ARC_SHAPE_WORDS[read]}”. Neither is wrong on its own.`
  );
};

export const arcGraph = (input: { characterId: string; file: ProjectFile }): ArcGraph => {
  const { characterId, file } = input;
  const board = arcBoard({ characterId, file });
  const ruler = arcRuler(file);
  const span = Math.max(ruler.scenes - 1, 1);
  const positions = positionsFor(file, characterId);
  const divisions = divisionsOf(file);
  const marks = marksOf(file, board.placed, positions, divisions, span, true);
  const onDeck = marksOf(file, board.onDeck, new Map(), divisions, span, true).map((mark) => ({
    ...mark,
    at: null,
  }));

  // Whose arcs this one is joined to, and how often. **Read from the links
  // rather than listed anywhere**, so cutting the last one takes the row off.
  const joins = new Map<string, number>();
  for (const mark of [...marks, ...onDeck]) {
    for (const effect of mark.effects) joins.set(effect.otherName, (joins.get(effect.otherName) ?? 0) + 1);
  }
  const connected: ConnectedArc[] = [];
  for (const person of workingCast(file)) {
    if ((person.id as string) === characterId) continue;
    const count = joins.get(person.name) ?? 0;
    if (count === 0) continue;
    const theirs = arcBoard({ characterId: person.id as string, file });
    if (!theirs.arc) continue;
    connected.push({
      characterId: person.id,
      name: person.name,
      shape: theirs.shape,
      shapeWords: ARC_SHAPE_WORDS[theirs.shape],
      beginning: theirs.arc.beginning,
      marks: marksOf(file, theirs.placed, positionsFor(file, person.id as string), divisions, span, false),
      joins: count,
    });
  }

  const intent = board.arc?.intent ?? null;
  const last = [...marks].reverse().find((mark) => mark.at !== null);
  return {
    ruler,
    beginning: board.arc?.beginning ?? '',
    need: board.arc?.need ?? '',
    ending: board.arc?.ending ?? '',
    endsAt: last?.at ?? null,
    marks,
    onDeck,
    intent,
    read: board.shape,
    disagreement: describeArcDisagreement(intent, board.shape),
    connected,
  };
};

/**
 * The key under the graph.
 *
 * **One list, read from the same tables the marks are** — a key written out
 * beside the drawing is a second answer to *what does that shape mean*, free
 * to go stale the day a kind is added.
 */
export const ARC_KEY: ReadonlyArray<{ mark: 'in' | 'deck' | ArcPointKind; words: string }> = [
  { mark: 'in', words: 'In the story' },
  { mark: 'deck', words: 'On deck' },
  { mark: 'opportunity', words: ARC_POINT_NAMES.opportunity },
  { mark: 'refusal', words: ARC_POINT_NAMES.refusal },
  { mark: 'doubling_down', words: ARC_POINT_NAMES.doubling_down },
  { mark: 'turning_point', words: ARC_POINT_NAMES.turning_point },
];
