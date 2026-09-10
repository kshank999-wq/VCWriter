import { z } from 'zod';
import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { unitsInStoryOrder } from './selectors.js';
import { placedMarkerForUnit } from './markers.js';
import type { ProjectFile } from './project-file.js';
import type { StructuralUnitId } from './ids.js';

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
    const placed = placedMarkerForUnit(file, unit.id as string);
    const named = unit.title || placed?.label || '';
    return {
      promise,
      scene: {
        id: unit.id,
        label: named || `Scene ${index + 1}`,
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
