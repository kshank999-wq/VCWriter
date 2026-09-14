import { z } from 'zod';
import { unitsInStoryOrder } from './selectors.js';
import { setSceneGrid } from './mutations.js';
import { sceneGridSchema } from './entities/structure.js';
import type { SceneGrid, StructuralUnit } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { StructuralUnitId } from './ids.js';

/**
 * Scene polarity and scene purpose (addendum 13, from Ken's Scene Polarity spec).
 *
 * **A scene is flat or it is not, and nobody says which.** That is the decision
 * the whole module rests on. The Story Grid already had a polarity column, and
 * it asked the writer to *choose* a word — up, down, flat — which meant a scene
 * could be marked *up* while starting and ending in exactly the same place. The
 * pair of values cannot lie that way: flat is `start === end`, worked out, and
 * there is nowhere to disagree with it.
 *
 * **The label is the truth and the number is for drawing.** Double Positive is
 * the value; `+2` is how a graph puts it on a line. Storing the number would
 * make *Positive* and *+1* two things that could drift apart, and would quietly
 * invite arithmetic nobody asked for — a story does not have an average
 * polarity.
 *
 * **Nothing here judges.** A flat scene is flagged, never condemned: §11 of the
 * spec is explicit that the writer decides whether it needs a turn, an
 * escalation, a reversal or nothing at all, and §6 says a purpose that has not
 * been named is *not defined* rather than a fault.
 */

// ------------------------------------------------------------------ the scale

/**
 * The five points, strongest negative first, so the list reads down the page
 * the way the graph draws it.
 */
export const POLARITIES = [
  'double_negative',
  'negative',
  'neutral',
  'positive',
  'double_positive',
] as const;
export const polaritySchema = z.enum(POLARITIES);
export type Polarity = (typeof POLARITIES)[number];

/** Nothing said yet. A scene nobody has read is not a neutral scene. */
export const POLARITY_UNSAID = '' as const;
export const polarityValueSchema = z.enum(['', ...POLARITIES]);
export type PolarityValue = z.infer<typeof polarityValueSchema>;

export const POLARITY_NAMES: Record<Polarity, string> = {
  double_positive: 'Double positive',
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  double_negative: 'Double negative',
};

/**
 * Where each sits on the axis.
 *
 * For drawing, and for asking *which way did it move* — never for adding up.
 * A story's polarities do not sum to anything.
 */
export const POLARITY_STEPS: Record<Polarity, number> = {
  double_positive: 2,
  positive: 1,
  neutral: 0,
  negative: -1,
  double_negative: -2,
};

export const stepOf = (value: PolarityValue): number | null =>
  value === POLARITY_UNSAID ? null : POLARITY_STEPS[value];

// ---------------------------------------------------------------- the purpose

/**
 * What a scene is for (§6).
 *
 * **Analytical tags, not categories**, which is why several may be true at
 * once: a scene that reveals character while creating tension is doing both,
 * and a control that made you pick would be teaching the writer something
 * false about their own scene.
 */
export const SCENE_PURPOSES = [
  'advance_plot',
  'reveal_character',
  'express_theme',
  'create_conflict',
  'deliver_information',
  'other',
] as const;
export const scenePurposeSchema = z.enum(SCENE_PURPOSES);
export type ScenePurpose = (typeof SCENE_PURPOSES)[number];

export const PURPOSE_NAMES: Record<ScenePurpose, string> = {
  advance_plot: 'Advances the plot',
  reveal_character: 'Reveals character',
  express_theme: 'Expresses a theme',
  create_conflict: 'Creates conflict or tension',
  deliver_information: 'Delivers necessary information',
  other: 'Something else essential',
};

export const PURPOSE_MEANINGS: Record<ScenePurpose, string> = {
  advance_plot: 'Story events move forward, or the situation changes.',
  reveal_character: 'Character, motivation, values, behaviour or change is exposed.',
  express_theme: 'A theme or motif is explored, challenged, reinforced or complicated.',
  create_conflict: 'Opposition, pressure, suspense, obstacles or escalation.',
  deliver_information: 'Something the audience needs for comprehension, or for a later payoff.',
  other: 'A necessary function the list above does not cover.',
};

// ------------------------------------------------------------- the reading

/** How a scene turns, read off the pair. */
export interface SceneTurn {
  start: PolarityValue;
  end: PolarityValue;
  /** Both said. Until then there is no turn to read. */
  said: boolean;
  /** `start === end`, and only meaningful when both are said. */
  flat: boolean;
  /** Which way it went: -1 down, 0 flat, 1 up. Null until both are said. */
  direction: -1 | 0 | 1 | null;
  /** How far, in steps. Null until both are said. */
  distance: number | null;
}

export const turnOf = (grid: SceneGrid): SceneTurn => {
  const start = (grid.polarityStart ?? '') as PolarityValue;
  const end = (grid.polarityEnd ?? '') as PolarityValue;
  const from = stepOf(start);
  const to = stepOf(end);
  if (from === null || to === null) {
    return { start, end, said: false, flat: false, direction: null, distance: null };
  }
  const moved = to - from;
  return {
    start,
    end,
    said: true,
    // The spec's whole point: flat is derived, never chosen.
    flat: moved === 0,
    direction: moved === 0 ? 0 : moved > 0 ? 1 : -1,
    distance: Math.abs(moved),
  };
};

/**
 * The Story Grid's one-word polarity, which is now **a reading wherever the
 * pair has been given**.
 *
 * A scene cannot say two things about its own movement. Where a writer has set
 * a start and an end, that pair decides; where they have not — an older project,
 * or a scene answered the Story Grid's way — the word they chose still stands,
 * because throwing it away would lose work.
 */
export const movementOf = (grid: SceneGrid): SceneGrid['polarity'] => {
  const turn = turnOf(grid);
  if (!turn.said) return grid.polarity;
  if (turn.direction === 0) return 'flat';
  return turn.direction === 1 ? 'up' : 'down';
};

// ------------------------------------------------------------------ purposes

export const purposesOf = (grid: SceneGrid): ScenePurpose[] =>
  (grid.purposes ?? []).filter((one): one is ScenePurpose =>
    (SCENE_PURPOSES as readonly string[]).includes(one),
  );

/** Set on a scene, or taken off it. Several may be true at once (§6). */
export const togglePurpose = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  purpose: ScenePurpose,
): ProjectFile => {
  const grid = gridOf(file, unitId);
  const standing = purposesOf(grid);
  const next = standing.includes(purpose)
    ? standing.filter((one) => one !== purpose)
    : [...standing, purpose];
  return writeGrid(file, unitId, { purposes: next });
};

export const setOtherPurpose = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  text: string,
): ProjectFile => writeGrid(file, unitId, { otherPurpose: text });

export const setPolarity = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  patch: { start?: PolarityValue; end?: PolarityValue },
): ProjectFile =>
  writeGrid(file, unitId, {
    ...(patch.start === undefined ? {} : { polarityStart: patch.start }),
    ...(patch.end === undefined ? {} : { polarityEnd: patch.end }),
  });

/**
 * The grid of one scene, defaulted for a project made before a field existed.
 *
 * Reading it through the schema rather than off the unit is what lets an older
 * project answer these questions at all: `polarityStart` was not there
 * yesterday, and a scene that has never heard of it reads as *nothing said*
 * rather than as undefined.
 */
export const gridOf = (file: ProjectFile, unitId: StructuralUnitId): SceneGrid =>
  sceneGridSchema.parse(file.units.find((unit) => unit.id === unitId)?.grid ?? {});

/** One place writes it, and it is the one the Story Grid already uses. */
const writeGrid = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  patch: Partial<SceneGrid>,
): ProjectFile => setSceneGrid(file, unitId, patch);

// --------------------------------------------------------------- the graph

/** One scene on the polarity graph. */
export interface PolarityPoint {
  unit: StructuralUnit;
  unitId: StructuralUnitId;
  index: number;
  /** Its number in the script, as the writer counts. */
  number: number;
  title: string;
  turn: SceneTurn;
  purposes: ScenePurpose[];
  /** Nothing said about what it is for (§6). Neutral, never a fault. */
  purposeUndefined: boolean;
}

export interface PolarityGraph {
  points: PolarityPoint[];
  /** Scenes with both values given. The rest cannot be drawn. */
  said: number;
  flat: number;
  /** The five rows the axis has, top to bottom, for drawing. */
  rows: Polarity[];
}

/**
 * Every scene in script order, with its turn.
 *
 * **Every scene is here, including the ones nobody has read.** A graph that
 * dropped them would draw a story with no gaps in it and quietly lie about how
 * much has been looked at; the interface shows an unanswered scene as a gap,
 * which is the true picture.
 */
export const polarityGraph = (file: ProjectFile): PolarityGraph => {
  const points = unitsInStoryOrder(file)
    .filter((unit) => unit.inScript)
    .map((unit, index): PolarityPoint => {
      const grid = gridOf(file, unit.id);
      const purposes = purposesOf(grid);
      return {
        unit,
        unitId: unit.id,
        index,
        number: index + 1,
        title: unit.title,
        turn: turnOf(grid),
        purposes,
        purposeUndefined: purposes.length === 0,
      };
    });

  return {
    points,
    said: points.filter((one) => one.turn.said).length,
    flat: points.filter((one) => one.turn.said && one.turn.flat).length,
    // Top to bottom, as the graph draws: positive above the line.
    rows: ['double_positive', 'positive', 'neutral', 'negative', 'double_negative'],
  };
};

/**
 * What a writer is told about a flat scene (§7).
 *
 * A prompt, not a verdict. It names what a flat scene *might* need and stops —
 * because whether this one needs any of it is the writer's call, and a module
 * that said *cut this* would be wrong about half the time and trusted none of
 * the time.
 */
export const FLAT_SCENE_PROMPT =
  'No polarity change is defined for this scene. Review whether it needs a turn, an escalation, a reversal, or another essential function.';

/** The flat scenes, for the review list. */
export const flatScenes = (file: ProjectFile): PolarityPoint[] =>
  polarityGraph(file).points.filter((one) => one.turn.said && one.turn.flat);

/** Scenes nobody has said anything about yet. Not a fault; a to-do. */
export const unreadScenes = (file: ProjectFile): PolarityPoint[] =>
  polarityGraph(file).points.filter((one) => !one.turn.said);

/**
 * How the scene before it left the reader, and how this one opens (§4).
 *
 * The spec asks that each scene keep its own start and end so the relationship
 * between consecutive scenes can be seen as well as the turn inside one. This
 * is that relationship, and it is deliberately *not* a warning: a scene that
 * opens where the last one closed is continuity, and one that opens somewhere
 * else is a cut. Both are things writers do on purpose.
 */
export interface Handover {
  from: PolarityPoint;
  to: PolarityPoint;
  /** True when the next scene opens where the last one ended. */
  continuous: boolean;
}

export const handovers = (file: ProjectFile): Handover[] => {
  const points = polarityGraph(file).points.filter((one) => one.turn.said);
  const pairs: Handover[] = [];
  for (let at = 1; at < points.length; at += 1) {
    const from = points[at - 1] as PolarityPoint;
    const to = points[at] as PolarityPoint;
    pairs.push({ from, to, continuous: from.turn.end === to.turn.start });
  }
  return pairs;
};

/** One line about the script's polarity, for a heading. */
export const describePolarity = (file: ProjectFile): string => {
  const graph = polarityGraph(file);
  if (graph.points.length === 0) return 'No scenes yet.';
  if (graph.said === 0) return `${graph.points.length} scenes, none read yet.`;
  const flat = graph.flat === 0 ? 'none flat' : `${graph.flat} flat`;
  return `${graph.said} of ${graph.points.length} read · ${flat}`;
};
