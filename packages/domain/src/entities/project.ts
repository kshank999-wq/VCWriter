import { z } from 'zod';
import { id, isoDateTime, timestamps } from './common.js';
import type { AssetId, ProjectId, UserId } from '../ids.js';

/** Spec §4: a project is created as a screenplay, a novel, or another format. */
/**
 * Spec §4, addendum 02 §14: what a project is.
 *
 * `series` is a season or a run of episodes in one document, so the
 * characters, the research and the setups are shared across the whole thing
 * rather than copied between files — which is the reason to have it at all.
 * `short_form` is a commercial, a web video, a spot: the same structure, its
 * own module later.
 */
export const projectFormatSchema = z.enum([
  'screenplay',
  'series',
  'novel',
  'stage_play',
  'short_story',
  'short_form',
  'other',
]);
export type ProjectFormat = z.infer<typeof projectFormatSchema>;

export const projectStatusSchema = z.enum(['development', 'drafting', 'revising', 'complete', 'archived']);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

/**
 * Provider-abstracted voice reference (spec §10, §18: the TTS vendor must be
 * replaceable without touching manuscript data).
 */
export const voiceAssignmentSchema = z.object({
  providerId: z.string().min(1),
  voiceId: z.string().min(1),
  displayName: z.string().min(1),
  accent: z.string().nullable().default(null),
  rate: z.number().min(0.25).max(4).default(1),
  pitch: z.number().min(-20).max(20).default(0),
});
export type VoiceAssignment = z.infer<typeof voiceAssignmentSchema>;

/**
 * What a title page carries (spec §6.1).
 *
 * The industry page and nothing beyond it, in the order a reader's eye takes
 * it: the title, which episode this is, who wrote it and under what credit,
 * what it was written from, how to reach them, which draft this is, and any
 * note the front page has to carry.
 *
 * Everything is optional. A first draft with a title and a name on it is a
 * proper title page; the rest is for when it goes out.
 */
export const titlePageSchema = z.object({
  /** Empty means the project's own title, which is the usual case. */
  title: z.string().default(''),
  /**
   * A logotype in place of the typed title — a data URI, held in the project
   * so the page travels with the file rather than pointing at a folder on one
   * machine. When it is set, the title text is not printed: the graphic *is*
   * the title.
   */
  titleImage: z.string().default(''),
  /** "Episode 4 — The Lamp". Under the title, where a series puts it. */
  episode: z.string().default(''),
  /**
   * The credit word: "written", "screenplay", "story". The page sets **by**
   * on its own line under it and the name under that, so this does not carry
   * the "by" itself — a credit typed with one has it taken off rather than
   * printed twice.
   */
  credit: z.string().default('written'),
  /** Empty means the project's author. */
  author: z.string().default(''),
  /**
   * What it was written from: "based on the novel", "original story". The
   * line, without the name — the name goes under it, the same way the credit
   * puts the author under "written by".
   */
  source: z.string().default(''),
  /** Who wrote the source. Printed on the line under it, as "by <name>". */
  sourceAuthor: z.string().default(''),
  /** Agent, address, telephone, email. Bottom left, as many lines as needed. */
  contact: z.string().default(''),
  /** "12 March 2026". Bottom right, above the revision. */
  draftDate: z.string().default(''),
  /** "Second draft", "Blue pages". Bottom right. */
  revision: z.string().default(''),
  /** Anything else the front page must say. Bottom right, under the rest. */
  notes: z.string().default(''),
});
export type TitlePage = z.infer<typeof titlePageSchema>;

/** A cap on the logotype: the project is a text file with a picture in it. */
export const MAX_TITLE_IMAGE_BYTES = 5 * 1024 * 1024;

export const projectSettingsSchema = z.object({
  /** Narrator/action voice, assigned separately from character dialogue (§10). */
  narratorVoice: voiceAssignmentSchema.nullable().default(null),
  autosaveIntervalMs: z.number().int().min(1_000).max(120_000).default(5_000),
  snapshotEveryNSaves: z.number().int().min(1).max(500).default(20),
  /** §6: internal beat labels stay out of the manuscript unless asked for. */
  includeBeatTitlesInExport: z.boolean().default(false),
  focusMode: z.boolean().default(false),
  /**
   * How the story's markers are numbered (addendum 02 §11). One scheme for
   * the whole project, because a book whose chapters are numbered three
   * different ways is not a book. Empty means "whatever this format does":
   * Roman for a screenplay's acts and a short story's sections, plain
   * numbers for a novel's chapters.
   */
  markerNumbering: z.enum(['numeric', 'roman', 'roman_lower', 'letters', 'words', 'symbol', 'none', '']).default(''),
  /** The glyph used when the numbering is a symbol. */
  markerSymbol: z.string().default('❦'),
  /** Whether a printing carries the chapter pages. */
  includeChapterPagesInExport: z.boolean().default(true),
  /**
   * What a new episode carries over from the ones before it (addendum 02
   * §17). Remembered rather than asked afresh every week; an empty object
   * means the format's own answer. Kept loose here so the shape lives with
   * the episodes rather than with the settings.
   */
  episodeCarry: z.record(z.unknown()).default({}),
  /**
   * The Daily Editor's rules the writer has switched off, and the words they
   * have said are fine (spec §8.1). An editor with no way to say "that is
   * not a mistake" is one a writer turns off entirely after the second false
   * alarm, so both of these travel with the project.
   */
  editorIgnoredRules: z.array(z.string()).default([]),
  editorAllowedWords: z.array(z.string()).default([]),
  /**
   * The title page (spec §6.1). A page of the document, not a heading on the
   * work screen — which is why it lives here and never in the manuscript.
   *
   * Title and author are empty by default and read from the project, so a
   * project made today already has a title page and nobody has to type their
   * own name twice. Filling either in overrides it, which is what a writer
   * wants when the script is titled one thing and the file another.
   */
  titlePage: titlePageSchema.default({}),
});
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;

export const projectSchema = z.object({
  id: id<ProjectId>(),
  ownerId: id<UserId>().nullable().default(null),
  format: projectFormatSchema,
  title: z.string().min(1),
  author: z.string().default(''),
  logline: z.string().default(''),
  elevatorPitch: z.string().default(''),
  synopsis: z.string().default(''),
  genre: z.string().default(''),
  notes: z.string().default(''),
  status: projectStatusSchema.default('development'),
  /** Poster / key art for the project home and one-sheet (§4). */
  posterAssetId: id<AssetId>().nullable().default(null),
  lastOpenedAt: isoDateTime().nullable().default(null),
  ...timestamps,
});
export type Project = z.infer<typeof projectSchema>;

/**
 * The title page as it will actually print: the writer's own words where they
 * gave them, the project's where they did not.
 *
 * "written by" is the default byline rather than a stored one, so a project
 * that has never been near this dialog still prints a proper page.
 */
/**
 * A credit or a source line without its trailing "by".
 *
 * The page prints **by** on a line of its own above the name — for the credit
 * and for the source alike — so a writer who types "written by" out of habit
 * must not get "written by / by / John August".
 */
export const withoutBy = (text: string): string => text.trim().replace(/\s+by$/i, '').trim();

export const titlePageOf = (project: Project, settings: ProjectSettings): TitlePage => {
  const page = titlePageSchema.parse(settings.titlePage ?? {});
  return {
    title: page.title.trim() || project.title,
    titleImage: page.titleImage,
    episode: page.episode.trim(),
    credit: withoutBy(page.credit) || 'written',
    author: page.author.trim() || project.author,
    source: withoutBy(page.source),
    sourceAuthor: page.sourceAuthor.trim(),
    contact: page.contact.trim(),
    draftDate: page.draftDate.trim(),
    revision: page.revision.trim(),
    notes: page.notes.trim(),
  };
};
