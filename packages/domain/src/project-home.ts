import { nowIso } from './entities/common.js';
import { newId } from './ids.js';
import { assetSchema, type Asset } from './entities/asset.js';
import { projectSchema, type Project, type ProjectStatus } from './entities/project.js';
import { nounsFor } from './formats.js';
import { projectStats, unitsInStoryOrder, unusedResearch, unresolvedSetupsPayoffs } from './selectors.js';
import { writingReport, daysOfWriting, projectWords, type WritingReport } from './sessions.js';
import type { AssetId, BeatId, StructuralUnitId } from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * The project home (master spec §4, addendum 17).
 *
 * §4 was the one section of the master spec that existed **only as a data
 * model**: `logline`, `elevatorPitch`, `synopsis`, `genre`, `notes`, `status`
 * and `posterAssetId` have been on `projectSchema` since the beginning and
 * round-trip to the database, and nothing in the application could read or
 * write any of them.
 *
 * Almost all of §4's dashboard turned out to be **an arrangement of readings
 * that already existed** — `projectStats`, `unusedResearch`,
 * `unresolvedSetupsPayoffs`, `writingReport`. This module composes them, adds
 * the one that was missing, and assembles the one-sheet. **It stores nothing.**
 */

// -------------------------------------------------------------- the fields

/** Every status a project can be in. Set by the writer; read by nothing (§4). */
export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'development',
  'drafting',
  'revising',
  'complete',
  'archived',
];

/** What each one is called. */
export const statusName = (status: ProjectStatus): string =>
  ({
    development: 'In development',
    drafting: 'Drafting',
    revising: 'Revising',
    complete: 'Complete',
    archived: 'Put away',
  })[status];

/** The fields §4 lists, and the only ones this module writes. */
export type ProjectDetails = Pick<
  Project,
  'title' | 'author' | 'logline' | 'elevatorPitch' | 'synopsis' | 'genre' | 'notes' | 'status'
>;

/**
 * Write the project's own description of itself.
 *
 * A patch rather than a whole record, so a screen that shows three of the eight
 * fields cannot blank the other five by leaving them out of its state.
 */
export const setProjectDetails = (file: ProjectFile, patch: Partial<ProjectDetails>): ProjectFile => ({
  ...file,
  project: projectSchema.parse({ ...file.project, ...patch, updatedAt: nowIso() }),
});

// -------------------------------------------------------------- the poster

/**
 * The key art (§4).
 *
 * An asset in the document like a storyboard frame or a figure, because a
 * project is one file that opens on another machine — a poster pointing at a
 * folder on somebody's desktop is a poster that is gone the moment the file is
 * sent anywhere.
 */
export const setPoster = (
  file: ProjectFile,
  input: { name: string; data: string; width?: number; height?: number },
): { file: ProjectFile; asset: Asset } => {
  const at = nowIso();
  const asset = assetSchema.parse({
    id: newId<AssetId>(),
    projectId: file.project.id,
    kind: 'image',
    name: input.name,
    data: input.data,
    width: input.width ?? 0,
    height: input.height ?? 0,
    createdAt: at,
    updatedAt: at,
  });
  return {
    file: {
      ...file,
      assets: [...(file.assets ?? []), asset],
      project: projectSchema.parse({ ...file.project, posterAssetId: asset.id, updatedAt: at }),
    },
    asset,
  };
};

/**
 * Take the poster off the project.
 *
 * **The picture stays in the assets**, the same two-different-acts rule a
 * figure follows (addendum 16 §3): forgetting which picture was the poster and
 * deleting the picture are different intentions, and a cascade would decide
 * for the writer.
 */
export const clearPoster = (file: ProjectFile): ProjectFile => ({
  ...file,
  project: projectSchema.parse({ ...file.project, posterAssetId: null, updatedAt: nowIso() }),
});

/** The poster, or `null` where none is set or the picture has gone. */
export const posterOf = (file: ProjectFile): Asset | null => {
  const id = file.project.posterAssetId;
  if (!id) return null;
  return (file.assets ?? []).find((one) => (one.id as string) === (id as string)) ?? null;
};

// ----------------------------------------------------------- where you are

export interface WhereYouAre {
  beatId: BeatId;
  unitId: StructuralUnitId;
  /** The beat's own title, or a fallback — never empty. */
  beatTitle: string;
  unitTitle: string;
  /** Which unit this is in story order, counting from one. */
  unitNumber: number;
  /** "Chapter 3 · Refraction", named for the format. */
  says: string;
}

/**
 * Where the writing last happened (§4's *current scene/chapter*).
 *
 * **Read from the work rather than from the window.** A selection is a fact
 * about a pane, and this application opens one document in several windows
 * (addendum 02 §8) — so a stored *current* would be whichever pane was clicked
 * last and would differ between two monitors showing the same book.
 *
 * The most recently updated beat is a fact about the document instead: the same
 * answer everywhere, and it survives closing the application.
 *
 * A document nobody has written in has **no answer**, and says so rather than
 * pointing at the first scene and calling it where you are.
 *
 * **Ties are broken by story order, latest first**, and the tie is real: a
 * writer who lays out six chapters in one go stamps them all in the same
 * millisecond. Walking the document's array order there would answer with
 * whichever happened to be first in memory, which is not an answer. The last
 * one in the story is: they had just added it.
 */
export const whereYouAre = (file: ProjectFile): WhereYouAre | null => {
  const units = unitsInStoryOrder(file);
  const numbers = new Map(units.map((unit, at) => [unit.id as string, at + 1]));

  // In story order, so `>=` gives the tie to the later one rather than to
  // whichever the array happened to hold first.
  const ordered = [...file.beats]
    // An orphan is not somewhere a writer can be sent.
    .filter((beat) => numbers.has(beat.unitId as string))
    .sort((a, b) => {
      const byUnit = numbers.get(a.unitId as string)! - numbers.get(b.unitId as string)!;
      return byUnit !== 0 ? byUnit : a.orderKey.localeCompare(b.orderKey);
    });

  let latest: (typeof file.beats)[number] | null = null;
  for (const beat of ordered) {
    if (!latest || beat.updatedAt >= latest.updatedAt) latest = beat;
  }
  if (!latest) return null;

  const unit = units.find((one) => (one.id as string) === (latest.unitId as string));
  if (!unit) return null;

  const nouns = nounsFor(file.project.format);
  const number = numbers.get(unit.id as string) ?? 1;
  const unitTitle = unit.title.trim() || `Untitled ${nouns.unit.toLowerCase()}`;
  return {
    beatId: latest.id,
    unitId: unit.id,
    beatTitle: latest.title.trim() || `Untitled ${nouns.sub.toLowerCase()}`,
    unitTitle,
    unitNumber: number,
    says: `${nouns.unit} ${number} · ${unitTitle}`,
  };
};

// ------------------------------------------------------------- the reading

export interface ProjectHome {
  /** What the writer has said about the work. */
  details: ProjectDetails;
  poster: Asset | null;
  /** Counted every time: units, sub-units, how many are written, words. */
  progress: {
    units: number;
    subs: number;
    written: number;
    words: number;
    /** Written sub-units as a percentage, rounded. Zero where there are none. */
    percent: number;
  };
  /** §4's *unresolved items*, each a count and a reason to go and look. */
  unresolved: { research: number; setups: number };
  where: WhereYouAre | null;
  /** §4's *recent work*: the writing log's own figures. */
  recent: WritingReport;
  /** Days written, newest first, for a small bar of activity. */
  days: { day: string; words: number; minutes: number }[];
  /** §4's *project assets*: everything the document carries. */
  assets: number;
  /** What this format calls its parts, so no screen has to name them. */
  nouns: ReturnType<typeof nounsFor>;
}

/**
 * The whole home, in one reading.
 *
 * **Nothing here is stored and nothing is cached.** Every figure is counted
 * when it is asked for, so cutting a chapter moves the percentage with nothing
 * run — the same absence the book index, the setup light and the Character
 * Creator's colour all rest on.
 */
export const projectHome = (file: ProjectFile, today?: string): ProjectHome => {
  const stats = projectStats(file);
  const percent = stats.beatCount > 0 ? Math.round((stats.writtenBeatCount / stats.beatCount) * 100) : 0;

  return {
    details: {
      title: file.project.title,
      author: file.project.author,
      logline: file.project.logline,
      elevatorPitch: file.project.elevatorPitch,
      synopsis: file.project.synopsis,
      genre: file.project.genre,
      notes: file.project.notes,
      status: file.project.status,
    },
    poster: posterOf(file),
    progress: {
      units: stats.unitCount,
      subs: stats.beatCount,
      written: stats.writtenBeatCount,
      words: stats.wordCount,
      percent,
    },
    unresolved: {
      research: unusedResearch(file).length,
      setups: unresolvedSetupsPayoffs(file).length,
    },
    where: whereYouAre(file),
    recent: today ? writingReport(file, today) : writingReport(file),
    days: daysOfWriting(file)
      .slice(0, 14)
      .map((one) => ({ day: one.day, words: one.words, minutes: one.minutes })),
    assets: (file.assets ?? []).length,
    nouns: nounsFor(file.project.format),
  };
};

// ------------------------------------------------------------ the one-sheet

export interface OneSheet {
  title: string;
  author: string;
  /** "Screenplay · Thriller", or whichever halves are filled in. */
  standfirst: string;
  logline: string;
  elevatorPitch: string;
  synopsis: string;
  notes: string;
  status: string;
  poster: Asset | null;
  /** Words, chapters and sections as a line of figures, for the foot. */
  figures: string;
}

/**
 * The one-sheet §4 asks for, **assembled and never stored.**
 *
 * There is no one-sheet table, no saved copy and nowhere to type one — the same
 * absence the book index's page numbers rest on (addendum 10 §3). A stored copy
 * is a second answer that goes stale the moment somebody edits the logline, and
 * the writer has no way to tell which one will print.
 */
export const oneSheet = (file: ProjectFile): OneSheet => {
  const nouns = nounsFor(file.project.format);
  const stats = projectStats(file);
  const genre = file.project.genre.trim();

  const figures = [
    `${projectWords(file).toLocaleString()} words`,
    `${stats.unitCount} ${stats.unitCount === 1 ? nouns.unit.toLowerCase() : nouns.unitPlural.toLowerCase()}`,
  ].join(' · ');

  return {
    title: file.project.title,
    author: file.project.author,
    // The work and the genre, in that order, and whichever is missing simply
    // is not there: "Screenplay · " with nothing after it says the software
    // lost something.
    standfirst: [nouns.work, genre].filter((one) => one.length > 0).join(' · '),
    logline: file.project.logline,
    elevatorPitch: file.project.elevatorPitch,
    synopsis: file.project.synopsis,
    notes: file.project.notes,
    status: statusName(file.project.status),
    poster: posterOf(file),
    figures,
  };
};

/**
 * What the sheet is missing, named.
 *
 * **A fact, never a grade.** A one-sheet with no synopsis prints perfectly
 * well and may be exactly what the writer wants; what would be wrong is
 * printing it silently, so they find out it was blank after sending it to
 * somebody.
 */
export const oneSheetGaps = (file: ProjectFile): string[] => {
  const gaps: string[] = [];
  if (file.project.author.trim().length === 0) gaps.push('author');
  if (file.project.logline.trim().length === 0) gaps.push('logline');
  if (file.project.elevatorPitch.trim().length === 0) gaps.push('elevator pitch');
  if (file.project.synopsis.trim().length === 0) gaps.push('synopsis');
  if (file.project.genre.trim().length === 0) gaps.push('genre');
  if (!file.project.posterAssetId) gaps.push('poster');
  return gaps;
};

/** The gaps in a sentence, or `null` when there are none. */
export const describeGaps = (file: ProjectFile): string | null => {
  const gaps = oneSheetGaps(file);
  if (gaps.length === 0) return null;
  const last = gaps[gaps.length - 1]!;
  const list = gaps.length === 1 ? last : `${gaps.slice(0, -1).join(', ')} and ${last}`;
  return `No ${list} yet. The sheet prints without ${gaps.length === 1 ? 'it' : 'them'}.`;
};

export type { Project, ProjectStatus } from './entities/project.js';
