import { z } from 'zod';
import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { findUnit, unitsInStoryOrder } from './selectors.js';
import { placedMarkerForUnit, placedMarkers } from './markers.js';
import { setSceneGrid } from './mutations.js';
import { reviewScenes } from './editor-final.js';
import { sceneHeadingOf } from './scene-heading.js';
import { sceneGridSchema } from './entities/structure.js';
import type { SceneRead } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { StoryMarkerId, StructuralUnitId } from './ids.js';
import type { SceneGrid, StoryMarkerKind } from './entities/structure.js';

/**
 * The Story Grid's global layer (addendum 04 §3).
 *
 * What the story **is**, and what that obliges it to deliver. The per-scene
 * half of the grid is already most of the way built — the Final Editor's
 * `SceneGrid` and the AI structural read between them ask four of the
 * questions — so this is the part that was missing: the genre, the value the
 * whole thing moves, and the scenes that genre owes its reader.
 *
 * **The checklist is the point.** Choosing a genre fills it with what that
 * genre owes, and each line can be answered by a scene in the script. A line
 * with no scene against it is the question the whole tab exists to ask.
 *
 * Nothing is enforced (§3). A writer who deletes half of what their genre
 * owes, or adds five promises of their own, has a genre of their own — and
 * the grid says so without complaint.
 */

/**
 * The content genres, as they are commonly taught: what the story is *about*
 * rather than where it is set. A western and a war film can both be action;
 * the setting is not the genre.
 */
export const GLOBAL_GENRES = [
  'action',
  'horror',
  'crime',
  'thriller',
  'love',
  'performance',
  'society',
  'status',
  'worldview',
  'morality',
] as const;
export const globalGenreSchema = z.enum(GLOBAL_GENRES);
export type GlobalGenre = z.infer<typeof globalGenreSchema>;

export const GENRE_NAMES: Record<GlobalGenre, string> = {
  action: 'Action',
  horror: 'Horror',
  crime: 'Crime',
  thriller: 'Thriller',
  love: 'Love',
  performance: 'Performance',
  society: 'Society',
  status: 'Status',
  worldview: 'Worldview',
  morality: 'Morality',
};

/** The value each genre moves, offered as the obvious answer and no more. */
export const GENRE_VALUES: Record<GlobalGenre, string> = {
  action: 'Life / death',
  horror: 'Life / damnation',
  crime: 'Justice / injustice',
  thriller: 'Life / damnation',
  love: 'Love / hate',
  performance: 'Respect / shame',
  society: 'Power / impotence',
  status: 'Success / failure',
  worldview: 'Ignorance / wisdom',
  morality: 'Selfishness / altruism',
};

/**
 * A promise the story has made: something the genre owes its reader, or a
 * convention it is expected to carry — or one the writer added themselves.
 *
 * `obligatory` is a scene that must happen. `convention` is furniture the
 * genre is expected to have: a ticking clock, a mentor, a red herring.
 */
export const gridPromiseKindSchema = z.enum(['obligatory', 'convention']);
export type GridPromiseKind = z.infer<typeof gridPromiseKindSchema>;

export const gridPromiseSchema = z.object({
  id: z.string().min(1),
  kind: gridPromiseKindSchema,
  /** What is owed, in the words a writer would use. */
  text: z.string().default(''),
  /**
   * The scene that delivers it, where the writer has said which. Null is not
   * a failure — it is the state every promise starts in, and the reason to
   * look at the list.
   */
  unitId: z.string().nullable().default(null),
  /** The writer's own note about it: why it is not there yet, or why not. */
  note: z.string().default(''),
});
export type GridPromise = z.infer<typeof gridPromiseSchema>;

/**
 * The five commandments (§4), asked at three scales: the whole story, each
 * act or region, and each scene.
 *
 * Nothing derives them. A story's inciting incident is a judgement, not a
 * measurement, and a tool that guessed at it would be wrong in a way the
 * writer could not see. The AI structural read may offer answers at the scene
 * scale later; these stay the writer's.
 */
export const COMMANDMENTS = ['inciting', 'complication', 'crisis', 'climax', 'resolution'] as const;
export type Commandment = (typeof COMMANDMENTS)[number];

export const COMMANDMENT_NAMES: Record<Commandment, string> = {
  inciting: 'Inciting incident',
  complication: 'Progressive complication',
  crisis: 'Crisis',
  climax: 'Climax',
  resolution: 'Resolution',
};

/** What each one asks, in the words of §4. */
export const COMMANDMENT_ASKS: Record<Commandment, string> = {
  inciting: 'What upsets the balance',
  complication: 'The turn that makes going back impossible',
  crisis: 'The best bad choice, or the irreconcilable good',
  climax: 'The choice, taken',
  resolution: 'What it settles into',
};

export const commandmentsSchema = z.object({
  inciting: z.string().default(''),
  complication: z.string().default(''),
  crisis: z.string().default(''),
  climax: z.string().default(''),
  resolution: z.string().default(''),
});
export type Commandments = z.infer<typeof commandmentsSchema>;

/** How many of the five have been answered. Not a score — a glance. */
export const answeredCount = (commandments: Commandments): number =>
  COMMANDMENTS.filter((which) => commandments[which].trim().length > 0).length;

/**
 * Where a scene's five live on its record.
 *
 * The progressive complication *is* the turn the scene grid already asks for,
 * so it is not stored twice: this map is the only place that knows it.
 */
const SCENE_FIELD: Record<Commandment, keyof SceneGrid> = {
  inciting: 'inciting',
  complication: 'turn',
  crisis: 'crisis',
  climax: 'climax',
  resolution: 'resolution',
};

/**
 * A scene's grid read as the five commandments.
 *
 * The grid is filled in from defaults first: a scene that predates any of
 * these questions — or the grid itself — has no record of them, and an
 * unanswered question is the state every scene starts in.
 */
export const commandmentsOfScene = (grid?: Partial<SceneGrid>): Commandments => {
  const scene = sceneGridSchema.parse(grid ?? {});
  return commandmentsSchema.parse(
    Object.fromEntries(COMMANDMENTS.map((which) => [which, scene[SCENE_FIELD[which]]])),
  );
};

/**
 * What an AI read found for the five, at scene scale (addendum 04 §8 stage 4).
 *
 * The read answers the same five questions the writer is asked, so it comes
 * back in the same shape and can sit beside their answers. A question the
 * read did not find an answer to comes through empty, exactly as an
 * unanswered box does — the two are the same fact about the scene.
 *
 * Null in, empty out: a scene nobody has read has nothing to suggest.
 */
export const commandmentsOfRead = (read?: SceneRead | null): Commandments =>
  commandmentsSchema.parse(
    read
      ? {
          inciting: read.inciting ?? '',
          complication: read.turn ?? '',
          crisis: read.crisis ?? '',
          climax: read.climax ?? '',
          resolution: read.resolution ?? '',
        }
      : {},
  );

export const storyGridSchema = z.object({
  /** Empty until the writer says. Nothing is assumed from the format. */
  genre: z.union([globalGenreSchema, z.literal('')]).default(''),
  /** "Heist", "Buddy love", "Monster in the house". The writer's own words. */
  subGenre: z.string().default(''),
  /** The value the whole story moves. Seeded from the genre, then theirs. */
  value: z.string().default(''),
  /** One sentence: what the ending says. */
  controllingIdea: z.string().default(''),
  /** What the story owes, and what it is expected to carry. */
  promises: z.array(gridPromiseSchema).default([]),
  /** The five commandments asked of the whole story (§4). */
  story: commandmentsSchema.default({}),
  /**
   * The same five asked of each act or region, keyed by the marker that opens
   * it. A set whose marker has since been deleted is simply not shown; it
   * costs nothing to leave in place, and a marker put back finds its answers
   * where it left them.
   */
  acts: z.record(commandmentsSchema).default({}),
});
export type StoryGrid = z.infer<typeof storyGridSchema>;

/**
 * What each genre owes its reader, and the furniture it carries.
 *
 * Seeded rather than enforced: this is the list a writer starts an argument
 * with, not a specification they have to satisfy. Every line can be edited,
 * removed, or answered by a scene that does something else entirely.
 */
const OWED: Record<GlobalGenre, { obligatory: string[]; convention: string[] }> = {
  action: {
    obligatory: [
      'An inciting attack by the villain',
      'The hero sidesteps the villain’s first move',
      'The villain’s object of desire made clear',
      'The hero at the mercy of the villain',
      'The hero’s sacrifice at the climax',
    ],
    convention: ['A clear villain with a plan', 'A ticking clock', 'Set pieces that escalate', 'Speeches in praise of the villain'],
  },
  horror: {
    obligatory: [
      'An inciting attack by the monster',
      'The victim realises what they are facing',
      'The victim at the mercy of the monster',
      'The victim’s choice: fight or be taken',
      'The monster’s power made plain',
    ],
    convention: ['A monster with a coherent nature', 'A false ending', 'The rules of survival, stated', 'Isolation'],
  },
  crime: {
    obligatory: [
      'The crime, discovered',
      'The investigator takes the case',
      'A red herring the reader believes',
      'The investigator at the mercy of the criminal',
      'The criminal exposed',
    ],
    convention: ['A red herring', 'The MacGuffin', 'Clues in plain sight', 'The investigator’s flaw'],
  },
  thriller: {
    obligatory: [
      'An inciting crime against the hero',
      'The hero cannot go to the authorities',
      'The villain and the hero meet before the climax',
      'The hero at the mercy of the villain',
      'The hero outwits or overpowers the villain',
    ],
    convention: ['A villain who is the hero’s equal', 'A false ally', 'A ticking clock', 'The hero’s ordinary life, lost'],
  },
  love: {
    obligatory: [
      'The lovers meet',
      'The first kiss, or its equivalent',
      'A confession of love',
      'The lovers break apart',
      'A proof of love at the climax',
    ],
    convention: ['A rival, or a rule keeping them apart', 'A helper who sees it first', 'A secret', 'A public declaration'],
  },
  performance: {
    obligatory: [
      'The gift, and the obstacle to using it',
      'The mentor, or the refusal of one',
      'The first public failure',
      'The performer at the mercy of their own limits',
      'The final performance',
    ],
    convention: ['A mentor', 'A rival with more advantage', 'A training sequence', 'A public arena'],
  },
  society: {
    obligatory: [
      'The tyrant’s power shown',
      'The revolutionary’s cause taken up',
      'The first act of open defiance',
      'The revolutionary at the mercy of the tyrant',
      'The confrontation that settles it',
    ],
    convention: ['A tyrant and a revolutionary', 'A crowd that can turn', 'A symbol of the cause', 'A traitor'],
  },
  status: {
    obligatory: [
      'The chance at a better life',
      'The first taste of success',
      'What it costs to keep going',
      'The protagonist at the mercy of the system',
      'The choice: the world’s terms or their own',
    ],
    convention: ['A mentor who has already paid the price', 'A rival who took the other road', 'A door that opens once'],
  },
  worldview: {
    obligatory: [
      'The belief that will be tested',
      'The evidence against it',
      'The refusal to see',
      'The protagonist at the mercy of what they cannot admit',
      'The moment of seeing',
    ],
    convention: ['A mentor or a foil who already knows', 'A recurring image', 'A lie the protagonist tells themselves'],
  },
  morality: {
    obligatory: [
      'The selfish act that starts it',
      'What that act costs somebody else',
      'The chance to put it right, refused',
      'The protagonist at the mercy of their own choice',
      'The sacrifice, or the refusal of it',
    ],
    convention: ['Somebody who pays for the protagonist’s choices', 'A moment of grace offered early', 'A mirror character'],
  },
};

/** The promises a genre starts with, as fresh records. */
export const promisesForGenre = (genre: GlobalGenre): GridPromise[] => {
  const owed = OWED[genre];
  return [
    ...owed.obligatory.map((text) => gridPromiseSchema.parse({ id: newId(), kind: 'obligatory', text })),
    ...owed.convention.map((text) => gridPromiseSchema.parse({ id: newId(), kind: 'convention', text })),
  ];
};

/**
 * A scene as the story names it: what the writer called it, else the marker
 * that opens it, else where it falls. One naming for the whole tab, so a
 * scene is not "The harbour" in one list and "3 The harbour" in the next.
 */
const sceneLabel = (file: ProjectFile, unitId: StructuralUnitId, title: string, position: number): string =>
  title || placedMarkerForUnit(file, unitId as string)?.label || `Scene ${position}`;

/** The project's grid, with its defaults filled in. */
export const storyGridOf = (file: ProjectFile): StoryGrid =>
  storyGridSchema.parse(file.settings.storyGrid ?? {});

export interface GridPromiseStatus {
  promise: GridPromise;
  /** The scene answering it, named as the story names it. Null when none. */
  scene: { id: StructuralUnitId; label: string; position: number } | null;
}

export interface StoryGridStatus {
  grid: StoryGrid;
  promises: GridPromiseStatus[];
  /** How many of each kind have a scene against them. */
  keptObligatory: number;
  obligatory: number;
  keptConventions: number;
  conventions: number;
}

/**
 * The grid read back: every promise with the scene that answers it, where one
 * does.
 *
 * A promise pointing at a scene that has since been deleted counts as
 * unanswered rather than throwing — a writer who cuts a scene has un-kept a
 * promise, which is exactly the thing this list is for saying.
 */
export const storyGridStatus = (file: ProjectFile): StoryGridStatus => {
  const grid = storyGridOf(file);
  const order = unitsInStoryOrder(file);
  const at = new Map(order.map((unit, index) => [unit.id as string, index]));

  const promises: GridPromiseStatus[] = grid.promises.map((promise) => {
    const index = promise.unitId === null ? undefined : at.get(promise.unitId);
    if (index === undefined) return { promise, scene: null };
    const unit = order[index] as (typeof order)[number];
    return {
      promise,
      scene: {
        id: unit.id,
        label: sceneLabel(file, unit.id, unit.title, index + 1),
        position: index + 1,
      },
    };
  });

  const of = (kind: GridPromiseKind) => promises.filter((entry) => entry.promise.kind === kind);
  const kept = (kind: GridPromiseKind) => of(kind).filter((entry) => entry.scene !== null).length;

  return {
    grid,
    promises,
    keptObligatory: kept('obligatory'),
    obligatory: of('obligatory').length,
    keptConventions: kept('convention'),
    conventions: of('convention').length,
  };
};

// ------------------------------------------------- the five commandments

/**
 * Which marker kind divides the work into its regions.
 *
 * A series is divided into episodes, a screenplay into acts, a novel into
 * parts where it has them and chapters where it does not. The coarsest kind
 * the writer has actually used wins, so nobody is asked to fill in five
 * questions per sequence in a script whose acts are already marked.
 */
const DIVISIONS: StoryMarkerKind[] = ['episode', 'act', 'part', 'sequence', 'chapter'];

export interface ActCommandments {
  markerId: StoryMarkerId;
  /** "ACT II", "Chapter 4" — what the marker is called in this project. */
  label: string;
  /** The reading positions it encloses, 1-based and inclusive. */
  from: number;
  to: number;
  commandments: Commandments;
}

export interface SceneCommandments {
  unitId: StructuralUnitId;
  label: string;
  position: number;
  /** The act or region it falls in. Empty before the first marker. */
  act: string;
  commandments: Commandments;
}

/**
 * The five, act by act.
 *
 * A region runs from its marker to the scene before the next one, exactly as
 * the act shape in the Final Editor measures it. Scenes before the first
 * marker belong to no region, which is a true thing to say about a script
 * whose first act break has not been placed.
 */
export const actCommandments = (file: ProjectFile): ActCommandments[] => {
  const grid = storyGridOf(file);
  const order = unitsInStoryOrder(file);
  if (order.length === 0) return [];

  const placed = placedMarkers(file);
  const kind = DIVISIONS.find((candidate) => placed.some((marker) => marker.marker.kind === candidate));
  if (kind === undefined) return [];

  const dividing = placed.filter((marker) => marker.marker.kind === kind);
  return dividing.map((marker, index) => {
    const next = dividing[index + 1];
    return {
      markerId: marker.marker.id,
      label: marker.label,
      from: marker.unitIndex + 1,
      to: next ? next.unitIndex : order.length,
      commandments: commandmentsSchema.parse(grid.acts[marker.marker.id as string] ?? {}),
    };
  });
};

/** The five, scene by scene, in reading order. */
export const sceneCommandments = (file: ProjectFile): SceneCommandments[] => {
  const acts = actCommandments(file);
  return unitsInStoryOrder(file).map((unit, index) => {
    const position = index + 1;
    const act = acts.find((region) => position >= region.from && position <= region.to);
    return {
      unitId: unit.id,
      label: sceneLabel(file, unit.id, unit.title, position),
      position,
      act: act?.label ?? '',
      commandments: commandmentsOfScene(unit.grid),
    };
  });
};

// ---------------------------------------------------------------- the grid

/**
 * One scene's row (§5).
 *
 * Measured where it can be — pages, words, who speaks, where and when — and
 * the writer's where it cannot. The point of the shape is that it is dense
 * and regular: a run of scenes with no value shift, or three in a row that
 * turn the same way, is something the eye finds going **down** a column.
 */
export interface GridRow {
  unitId: StructuralUnitId;
  position: number;
  label: string;
  /** The act or region it falls in. Empty before the first marker. */
  act: string;
  pages: number;
  words: number;
  /** What happens, in the writer's words. */
  event: string;
  /** The AI read's `change`, offered where one has been made and nothing said. */
  suggestedEvent: string;
  value: string;
  polarity: SceneGrid['polarity'];
  commandments: Commandments;
  /**
   * What the read found for each of the five, where one has been made
   * (addendum 04 §8 stage 4).
   *
   * **Beside the writer's answers, never in place of them.** A box the writer
   * has filled in shows what they wrote; an empty one can show what the read
   * saw, as an offer. An empty string here means the read did not find one,
   * which is worth seeing on a scene nobody has answered either.
   */
  suggested: Commandments;
  /** Whether this scene has been read at all, so an empty row can say why. */
  read: boolean;
  pov: string;
  /** Measured: who has a cue in it, where it is, and when. */
  characters: string[];
  setting: string;
  time: string;
}

export const storyGridRows = (file: ProjectFile): GridRow[] => {
  const acts = actCommandments(file);
  return reviewScenes(file).map((scene) => {
    const grid = sceneGridSchema.parse(scene.grid ?? {});
    const heading = sceneHeadingOf(file, scene.unitId);
    const act = acts.find((region) => scene.position >= region.from && scene.position <= region.to);
    return {
      unitId: scene.unitId,
      position: scene.position,
      label: sceneLabel(file, scene.unitId, findUnit(file, scene.unitId)?.title ?? '', scene.position),
      act: act?.label ?? '',
      pages: scene.pages,
      words: scene.words,
      event: grid.event,
      suggestedEvent: scene.aiVerdict?.change ?? '',
      value: grid.value,
      polarity: grid.polarity,
      commandments: commandmentsOfScene(grid),
      suggested: commandmentsOfRead(scene.aiVerdict),
      read: scene.aiVerdict !== null,
      pov: grid.pov,
      characters: scene.speakers,
      setting: heading ? [heading.setting, heading.place].filter(Boolean).join(' ') : (scene.location ?? ''),
      time: heading?.time ?? '',
    };
  });
};

/**
 * What the grid is showing (§5).
 *
 * Filtering and sorting *are* the analysis: show me the scenes that do not
 * turn, show me everything in this act, show me the negative ones. None of it
 * changes the manuscript, and none of it is a judgement — a row that matches
 * "does not turn" is a question, not a verdict.
 */
export interface GridView {
  /** Empty shows every scene. */
  show: '' | 'no_turn' | 'flat' | 'negative' | 'positive' | 'no_value' | 'unasked';
  /** An act's label, or empty for the whole story. */
  act: string;
  sort: 'order' | 'longest' | 'shortest';
}

export const GRID_SHOW_NAMES: Record<GridView['show'], string> = {
  '': 'Every scene',
  no_turn: 'Scenes that do not turn',
  flat: 'Scenes that do not move',
  negative: 'The negative ones',
  positive: 'The positive ones',
  no_value: 'Nothing at stake yet',
  unasked: 'Nothing said about them yet',
};

const MATCHES: Record<GridView['show'], (row: GridRow) => boolean> = {
  '': () => true,
  no_turn: (row) => row.commandments.complication.trim().length === 0,
  flat: (row) => row.polarity === 'flat',
  negative: (row) => row.polarity === 'down',
  positive: (row) => row.polarity === 'up',
  no_value: (row) => row.value.trim().length === 0,
  unasked: (row) =>
    answeredCount(row.commandments) === 0 && row.value.trim().length === 0 && row.event.trim().length === 0,
};

/** The rows, filtered and ordered. Reading order unless asked otherwise. */
export const viewGridRows = (rows: GridRow[], view: Partial<GridView> = {}): GridRow[] => {
  const show = view.show ?? '';
  const act = view.act ?? '';
  const matches = MATCHES[show] ?? MATCHES[''];

  const kept = rows.filter((row) => matches(row) && (act === '' || row.act === act));
  if (view.sort === 'longest') return [...kept].sort((a, b) => b.words - a.words || a.position - b.position);
  if (view.sort === 'shortest') return [...kept].sort((a, b) => a.words - b.words || a.position - b.position);
  return kept;
};

// ------------------------------------------------------------- the graph

/**
 * The value graph (§6): the polarity column, plotted.
 *
 * **The line is a running total, not a column of bars.** §6 asks whether a
 * story "never goes below the line, or never comes back above it", and only a
 * value that accumulates can do either — a bar chart of per-scene polarity
 * crosses the axis the moment any one scene is negative, which says nothing.
 * So each scene moves the line by one and the line remembers: this is where
 * the story's value stands after that scene, which is the thing the method
 * is about.
 *
 * A scene nobody has answered **does not move the line and does not claim it
 * stayed still**. The two are different facts and the grid has always kept
 * them apart; a graph that quietly read silence as "flat" would be inventing
 * the writer's reading for them.
 */
export interface ValuePoint {
  unitId: StructuralUnitId;
  position: number;
  label: string;
  act: string;
  polarity: SceneGrid['polarity'];
  /** Whether the writer has said which way this one moves. */
  said: boolean;
  /** What this scene does to the value: up, down, or neither. */
  step: -1 | 0 | 1;
  /** Where the value stands once this scene has played. */
  value: number;
}

export interface ValueGraph {
  points: ValuePoint[];
  /** The range the line covers, for drawing it. Zero is always inside it. */
  low: number;
  high: number;
  /** How many scenes have been answered at all. */
  said: number;
  /**
   * Whether the value ever falls below where the story started. **A fact,
   * not a mark** (§7): a comedy that rises all the way is a real thing, and
   * so is a story that has forgotten to cost its hero anything.
   */
  everBelow: boolean;
  /** Whether it comes back up after the first time it goes below. */
  everBack: boolean;
}

const STEP: Record<SceneGrid['polarity'], -1 | 0 | 1> = {
  '': 0,
  up: 1,
  down: -1,
  // Both ways at once ends where it began; the row still says it moved.
  mixed: 0,
  flat: 0,
};

export const valueGraph = (rows: readonly GridRow[]): ValueGraph => {
  let value = 0;
  const points: ValuePoint[] = rows.map((row) => {
    const step = STEP[row.polarity];
    value += step;
    return {
      unitId: row.unitId,
      position: row.position,
      label: row.label,
      act: row.act,
      polarity: row.polarity,
      said: row.polarity !== '',
      step,
      value,
    };
  });

  const values = points.map((point) => point.value);
  const below = points.findIndex((point) => point.value < 0);
  return {
    points,
    low: Math.min(0, ...values),
    high: Math.max(0, ...values),
    said: points.filter((point) => point.said).length,
    everBelow: below !== -1,
    everBack: below !== -1 && points.slice(below).some((point) => point.value >= 0),
  };
};

/**
 * What the graph has noticed, in a sentence — or nothing (§6, §7).
 *
 * Said only where there is enough answered to be worth saying: a story of
 * three scenes, or one nobody has read the value of, is not told anything.
 * And it is an observation rather than a verdict, because a story that only
 * rises may be exactly the story being written.
 */
export const valueGraphNote = (graph: ValueGraph): string => {
  if (graph.said < 4) return '';
  if (!graph.everBelow) return 'The value never falls below where it started.';
  if (!graph.everBack) return 'Once the value goes below where it started, it never comes back.';
  return '';
};

// ------------------------------------------------------------------ writing

const touched = (file: ProjectFile, grid: StoryGrid): ProjectFile => ({
  ...file,
  settings: { ...file.settings, storyGrid: grid },
  project: { ...file.project, updatedAt: nowIso() },
});

/**
 * Set what the story is.
 *
 * Choosing a genre for the first time seeds the promises and the value, since
 * an empty checklist is a checklist that has said nothing. Changing it later
 * leaves what is there alone: by then the list has the writer's own edits and
 * their scenes against it, and throwing that away to replace it with a fresh
 * template would be the tool overruling the work.
 *
 * `reseed` asks for the replacement explicitly, for the writer who wants it.
 */
export const setStoryGrid = (
  file: ProjectFile,
  patch: Partial<Pick<StoryGrid, 'genre' | 'subGenre' | 'value' | 'controllingIdea'>>,
  options: { reseed?: boolean } = {},
): ProjectFile => {
  const grid = storyGridOf(file);
  const next = storyGridSchema.parse({ ...grid, ...patch });

  // Seeded when the genre is first chosen, or whenever the writer asks for the
  // list back — including for the genre already set, which is what "start the
  // list again" means. Changing the genre on its own leaves the list alone: by
  // then it carries their wording and their scenes.
  const changed = patch.genre !== undefined && patch.genre !== grid.genre;
  const fresh = next.genre !== '' && (options.reseed === true || (changed && grid.promises.length === 0));
  if (fresh) {
    next.promises = promisesForGenre(next.genre as GlobalGenre);
    // The value follows the genre only while the writer has not said.
    if (grid.value.trim().length === 0) next.value = GENRE_VALUES[next.genre as GlobalGenre];
  }
  return touched(file, next);
};

/** A promise of the writer's own, at the end of its kind's list. */
export const addGridPromise = (
  file: ProjectFile,
  input: { kind?: GridPromiseKind; text?: string },
): { file: ProjectFile; promise: GridPromise } => {
  const grid = storyGridOf(file);
  const promise = gridPromiseSchema.parse({
    id: newId(),
    kind: input.kind ?? 'obligatory',
    text: input.text ?? '',
  });
  return {
    file: touched(file, { ...grid, promises: [...grid.promises, promise] }),
    promise,
  };
};

/** Reword a promise, or say which scene keeps it. */
export const updateGridPromise = (
  file: ProjectFile,
  promiseId: string,
  patch: Partial<Pick<GridPromise, 'text' | 'unitId' | 'note' | 'kind'>>,
): ProjectFile => {
  const grid = storyGridOf(file);
  return touched(file, {
    ...grid,
    promises: grid.promises.map((promise) =>
      promise.id === promiseId ? gridPromiseSchema.parse({ ...promise, ...patch }) : promise,
    ),
  });
};

/** Take a promise off the list. The scene it pointed at is untouched. */
export const removeGridPromise = (file: ProjectFile, promiseId: string): ProjectFile => {
  const grid = storyGridOf(file);
  return touched(file, { ...grid, promises: grid.promises.filter((promise) => promise.id !== promiseId) });
};

/** The whole story's five (§4). Nobody but the writer writes these. */
export const setStoryCommandments = (file: ProjectFile, patch: Partial<Commandments>): ProjectFile => {
  const grid = storyGridOf(file);
  return touched(file, { ...grid, story: commandmentsSchema.parse({ ...grid.story, ...patch }) });
};

/** One act or region's five, against the marker that opens it. */
export const setActCommandments = (
  file: ProjectFile,
  markerId: StoryMarkerId,
  patch: Partial<Commandments>,
): ProjectFile => {
  const grid = storyGridOf(file);
  const key = markerId as string;
  return touched(file, {
    ...grid,
    acts: { ...grid.acts, [key]: commandmentsSchema.parse({ ...(grid.acts[key] ?? {}), ...patch }) },
  });
};

/**
 * One of a scene's five.
 *
 * It goes to the scene's own record rather than into the grid's blob, because
 * that is where the rest of the scene's reading already lives — and the
 * progressive complication is the turn the Final Editor has always asked for.
 */
export const setSceneCommandment = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  which: Commandment,
  text: string,
): ProjectFile => setSceneGrid(file, unitId, { [SCENE_FIELD[which]]: text });
