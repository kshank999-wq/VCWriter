import { arcPointSchema, arcBoard, ARC_POINT_NAMES, type ArcPoint, type UsageColour } from './character-creator.js';
import { nowIso } from './entities/common.js';
import { newId } from './ids.js';
import { orderKeyForIndex } from './ordering.js';
import { resolveRef } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { CharacterArcId, ArcPointId, StoryLinkId } from './ids.js';
import type { StoryEntityRef } from './entities/links.js';

/**
 * The arc as a line you fill in (addendum 25 §4e, from Ken: *that is going to
 * be like a timeline view… where the character begins as a box you could fill
 * out, and by default the end of the character arc, what the character
 * becomes. Then you can double click on the line and it will create another
 * point*).
 *
 * **The audit paid again and this time inside the record**: `beginning` and
 * `ending` have been fields on `characterArcSchema` since the Arc Builder was
 * built, which is exactly *where they begin* and *what they become*, and the
 * points between them are `arcPoints` in their order. So none of what Ken
 * describes is new data — what was new is that the tab drew it as two
 * textareas with two flat lists stacked between them, which is the same
 * information arranged so that nobody can see it is a journey.
 *
 * Three rules hold the reading.
 *
 * **The two ends are always there — including before there is an arc.** They
 * are the arc rather than things on it: a character with no arc still begins
 * somewhere and still becomes something, so the line has two stops from the
 * first moment anybody looks at it.
 *
 * That last clause is a correction. The first build returned nothing without
 * an arc record, so the Arc tab drew a sentence and a *Start an arc* button —
 * and since **every character starts without one**, the timeline was absent
 * from the only state a writer ever meets it in. Ken asked for it twice in
 * the same words, which is this project's own signal that a feature is built
 * and unreachable. Nothing is created to draw the line: `beginArc` runs when
 * the writer first types into it, so a cast of forty extras still carries no
 * arc records, and addendum 08 §9's *never require an arc* is kept by not
 * making one rather than by hiding what one is.
 *
 * **The line is the writer's arrangement and the lists below are the
 * manuscript's.** This is the one place the module keeps two orders on one
 * screen, and it is deliberate: `arcBoard` splits into *in the writing* and
 * *still to place* because that is the honest answer to **how far along is
 * this**, and the line answers a different question — **what is the shape of
 * the journey** — which is the writer's to arrange. Driving it is what
 * settled it: ordered the board's way, double-clicking between the first two
 * boxes put the new moment at the far end, because a moment nobody has
 * written yet sorts after every one that is. A gesture that means *here* and
 * lands somewhere else is a gesture that does not work.
 *
 * So the line is in the points' own order, and each stop still carries the
 * colour and the scene it is pinned in — the manuscript's answer travels with
 * it rather than deciding where it stands. There is still nothing to drag on
 * the line: a stop is moved with the arrows on its row below, which is
 * addendum 08 §5's rule unchanged.
 *
 * **The ends carry no links and say why.** A link joins a *moment* to
 * something else in the book; *who they are at the start* is a condition
 * rather than an event, and a link from it would be a link from the whole
 * character. So `links` is a point's, and `linkable` says so on the stop.
 */

export type ArcStopKind = 'beginning' | 'point' | 'ending';

/** One thing already joined to a point: a scene, a theme, a motif, anything. */
export interface ArcStopLink {
  linkId: StoryLinkId;
  /** What it points at, resolved — so a link to something cut reads as gone. */
  label: string;
  detail: string;
  exists: boolean;
  ref: StoryEntityRef;
}

export interface ArcStop {
  /** Stable across a re-read: the two ends by name, a point by its id. */
  key: string;
  kind: ArcStopKind;
  /** Null on the two ends, which are fields of the arc rather than records. */
  pointId: ArcPointId | null;
  /** What the box is called: *Begins*, the point's own kind, *Becomes*. */
  title: string;
  /** What is written in it. */
  text: string;
  placeholder: string;
  /**
   * Green where the manuscript contains it, red where it is still on deck —
   * and **null on the two ends**, which are not claims about the script and
   * so have no colour to be wrong about.
   */
  colour: UsageColour | null;
  /** The scene it sits in, where it sits in one. */
  where: string;
  /** Whether a link can hang on it: a moment, never a state. */
  linkable: boolean;
  links: ArcStopLink[];
}

/** What a stop can be joined to (§4e). The script, and what the book is about. */
export const ARC_LINK_KINDS = ['beat', 'theme', 'motif'] as const;
export type ArcLinkKind = (typeof ARC_LINK_KINDS)[number];

export const ARC_LINK_KIND_WORDS: Record<ArcLinkKind, string> = {
  beat: 'In the script',
  theme: 'A theme',
  motif: 'A motif',
};

/** Everything joined to one arc point, in the order it was made. */
export const arcPointLinks = (file: ProjectFile, pointId: ArcPointId): ArcStopLink[] =>
  file.links
    .filter(
      (link) =>
        (link.from.type === 'arc_point' && link.from.id === (pointId as string)) ||
        (link.to.type === 'arc_point' && link.to.id === (pointId as string)),
    )
    .map((link) => {
      // The *other* end is what the row is about; a link to itself has none.
      const other =
        link.from.type === 'arc_point' && link.from.id === (pointId as string) ? link.to : link.from;
      const resolved = resolveRef(file, other);
      return {
        linkId: link.id,
        label: resolved.label,
        detail: resolved.detail,
        exists: resolved.exists,
        ref: other,
      };
    });

/**
 * The line: *Begins*, every point in the story's own order, *Becomes*.
 *
 * Nothing about it is stored. Cutting the scene a point is pinned in turns
 * that stop red where it stands, and moving the scene moves the stop, both
 * with nothing run — which is the module's oldest rule (addendum 08 §2) said
 * of a picture.
 */
export const arcTimeline = (input: { characterId: string; file: ProjectFile }): ArcStop[] => {
  const { file } = input;
  const board = arcBoard({ characterId: input.characterId, file });
  // **No arc yet is not no line.** The two ends read empty and the middle is
  // empty, which is exactly what an arc nobody has started looks like.
  const arc = board.arc;

  const begins: ArcStop = {
    key: 'beginning',
    kind: 'beginning',
    pointId: null,
    title: 'Begins',
    text: arc?.beginning ?? '',
    // **A placeholder names the question rather than answering it.** The first
    // draft put an example sentence here, which on a dark screen read as
    // content — a writer meeting the tab saw two filled boxes — and it named a
    // pronoun, so it was somebody else's character standing in theirs.
    placeholder: 'Who they are when we meet them',
    colour: null,
    where: '',
    linkable: false,
    links: [],
  };

  const becomes: ArcStop = {
    key: 'ending',
    kind: 'ending',
    pointId: null,
    title: 'Becomes',
    text: arc?.ending ?? '',
    placeholder: 'Who they are by the end',
    colour: null,
    where: '',
    linkable: false,
    links: [],
  };

  const stopOf = (row: (typeof board.placed)[number]): ArcStop => ({
    key: row.point.id as string,
    kind: 'point',
    pointId: row.point.id,
    title: ARC_POINT_NAMES[row.point.kind],
    text: row.point.text,
    placeholder: 'What happens',
    colour: row.colour,
    where: row.unitTitle ?? '',
    linkable: true,
    links: arcPointLinks(file, row.point.id),
  });

  // **The points in their own order**, with the board's reading of each
  // carried on it. `arcBoard` is still what says whether a point is in the
  // writing and which scene it is in; all that is taken from it here is the
  // answer, never the arrangement.
  const read = new Map(
    [...board.placed, ...board.onDeck].map((row) => [row.point.id as string, row] as const),
  );
  const points = (arc ? file.arcPoints : [])
    .filter((one) => (one.arcId as string) === (arc!.id as string))
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
    .map((point) => read.get(point.id as string))
    .filter((row): row is (typeof board.placed)[number] => row !== undefined);

  return [begins, ...points.map(stopOf), becomes];
};

/**
 * What the line says under itself, in words.
 *
 * Said out loud because a row of boxes with a gap between them explains its
 * own gesture to nobody: *double-click the line* is not discoverable, and a
 * screen that waits to be guessed at is one this module has been caught
 * building before.
 */
export const describeArcTimeline = (stops: readonly ArcStop[]): string => {
  const points = stops.filter((stop) => stop.kind === 'point');
  const placed = points.filter((stop) => stop.colour === 'green').length;
  if (points.length === 0) {
    return 'Begins here and becomes that. Double-click the line between them to put a moment in.';
  }
  const many = points.length === 1 ? 'One moment' : `${points.length} moments`;
  const written = placed === 0 ? 'none of them in the writing yet' : `${placed} of them in the writing`;
  return `${many} between, ${written}. Double-click the line to put another in.`;
};

/**
 * Put a point into the line at a place (§4e, Ken's double-click).
 *
 * `addArcPoint` appends, which is right for a form at the foot of a list and
 * wrong for a gesture that means *here*. `index` is the position among the
 * arc's points in their stored order, so `0` is before the first and the
 * length is after the last; the key is worked out between the neighbours the
 * way every other ordered thing in the program is placed.
 *
 * **A placed point may be inserted before and still land where the scene
 * says.** That is not a contradiction and is worth saying: the order key
 * decides where a point stands among points nobody has pinned, and the
 * manuscript decides where a pinned one stands. A writer who puts a moment
 * between two scenes and then pins it into a third will find it in the third,
 * which is the module's rule rather than this act's failure.
 */
export const insertArcPoint = (
  file: ProjectFile,
  input: { arcId: CharacterArcId; index: number; text: string; kind?: ArcPoint['kind'] },
): { file: ProjectFile; point: ArcPoint | null } => {
  const text = input.text.trim();
  if (text.length === 0) return { file, point: null };
  const arc = file.characterArcs.find((one) => (one.id as string) === (input.arcId as string));
  if (!arc) return { file, point: null };

  // An arc point is not a graveyard record — it has no `deletedAt` — so the
  // siblings are simply the arc's own, in their stored order.
  const siblings = file.arcPoints
    .filter((one) => (one.arcId as string) === (arc.id as string))
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
  const at = nowIso();
  const point = arcPointSchema.parse({
    id: newId<ArcPointId>(),
    projectId: file.project.id,
    arcId: arc.id,
    characterId: arc.characterId,
    kind: input.kind ?? 'movement',
    text,
    notes: '',
    orderKey: orderKeyForIndex(siblings, Math.max(0, Math.min(input.index, siblings.length))),
    createdAt: at,
    updatedAt: at,
  });

  return { file: { ...file, arcPoints: [...file.arcPoints, point] }, point };
};
