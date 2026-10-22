import { z } from 'zod';
import { id, isoDateTime, timestamps } from './common.js';
import { titlePageSchema } from './title-page.js';
import { castPageSchema } from './cast-page.js';
import { mooringSchema } from '../standing.js';
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
  /**
   * An instructional, academic or reference book (addendum 16).
   *
   * Prose with chapters, like a novel — what differs is what goes in them and
   * what the writer keeps beside them, never how a paragraph is set. Ask
   * `isInstructional` for the difference and `isProseFormat` for the
   * similarity; nothing should test this string directly.
   */
  'instructional',
  /**
   * A video game, or anything else the audience plays (addendum 18).
   *
   * Written as a script — sluglines, cues, dialogue — with a **graph over the
   * scenes** saying how they are reached. Ask `isInteractive` for the
   * difference; nothing should test this string directly.
   */
  'game',
  /**
   * A general-purpose document: a letter, a report, an essay, notes
   * (addendum 42). Written in a word processor rather than as beats, with an
   * Extract & Organize sidebar that files passages into this or another
   * project. Ask `isWordProcessor`; nothing should test this string directly.
   */
  'document',
  'other',
]);
export type ProjectFormat = z.infer<typeof projectFormatSchema>;

export const projectStatusSchema = z.enum(['development', 'drafting', 'revising', 'complete', 'archived']);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

/**
 * How a prose manuscript sets its paragraphs (spec §6.4).
 *
 * `indented` is standard manuscript format — paragraphs run on, each new one
 * marked by a five-space first-line indent — and is what a novel is submitted
 * in. `blocked` leaves the indent off and puts a space between paragraphs
 * instead, which is how most people read on a screen. One mark or the other:
 * a page that carries both says the same thing twice.
 *
 * Screenplay formats ignore it; a screenplay's geometry is not a choice.
 */
export const paragraphStyleSchema = z.enum(['indented', 'blocked']);
export type ParagraphStyle = z.infer<typeof paragraphStyleSchema>;

/**
 * Which house a script is set in (spec §6.5).
 *
 * `us` is US single-camera studio format — the one Final Draft opens on, and
 * what a feature, a streaming drama and a single-camera comedy are all
 * written in. `us_multi` is the traditional multi-camera sitcom: the same
 * page opened right up so the crew can write on it, with the speech double
 * spaced and everything that is not spoken set in capitals. `bbc` is the
 * BBC's, which grew up around taped television: A4, a cue that sits close to
 * the action, and a double blank line at every change of setting. `bbc_taped`
 * is the other BBC tradition, where the cue goes out into the left margin
 * beside the speech rather than above it, leaving the right of the page clear
 * for the crew's camera cues.
 *
 * It belongs to the project rather than to the machine. A script's page count
 * is a fact about the script, and two people opening the same file must not
 * get two different ones.
 */
export const scriptFormatSchema = z.enum([
  // The four a screen script is set in.
  'us',
  'us_multi',
  'bbc',
  'bbc_taped',
  /**
   * **The six a stage play is set in** (addendum 37, from Ken's own *Stage
   * Play Formatting Engine* spec §2). Prefixed `stage_` rather than taking
   * that spec's bare ids, because `uk_bbc` beside the screen list's `bbc`
   * would be two values a reader has to hold apart; each layout's doc names
   * the spec's own id.
   *
   * They are the same field as the four above and not a second one: a script
   * is set in one house style, and the format decides which houses are on
   * offer (`scriptFormatsFor`).
   */
  'stage_us_modern',
  'stage_us_traditional',
  'stage_us_publisher',
  'stage_uk_bbc',
  'stage_uk_contemporary',
  'stage_eu_continental',
  /**
   * **The musical** (addendum 38, the spec's §4.6): the seventh, which
   * addendum 37 named and did not build because there was nowhere in a
   * manuscript to put a lyric. `musicalElementTypeSchema` is that place.
   */
  'stage_us_musical',
]);
export type ScriptFormat = z.infer<typeof scriptFormatSchema>;

/**
 * **One element's departure from its house style** (addendum 39, Ken's spec
 * §7, the per-element override inspector).
 *
 * Every field is optional and absent means *the preset's own*, so a project
 * carries only what the writer changed — and *Restore defaults* is clearing
 * this, not remembering what the preset said.
 */
export const elementOverrideSchema = z.object({
  /** Column the element starts at, from the left of the text area. */
  indent: z.number().int().min(0).max(120).optional(),
  /** Characters before it wraps. */
  width: z.number().int().min(1).max(120).optional(),
  /** Set in capitals. */
  uppercase: z.boolean().optional(),
  /** Centred in its column rather than flush at its indent. */
  centred: z.boolean().optional(),
});
export type ElementOverride = z.infer<typeof elementOverrideSchema>;

/**
 * **What this project changed about its house style** (addendum 39).
 *
 * The project's, not the machine's, for addendum 37 §5's reason: it changes
 * the geometry and so the page count, and two people opening one play must see
 * one page. `templateName` is what the page is called once it is a template —
 * a saved one applied, or the writer's own name for it — and empty where it is
 * simply the preset with a change or two.
 */
export const formatOverridesSchema = z.object({
  templateName: z.string().default(''),
  elements: z.record(z.string(), elementOverrideSchema).default({}),
});
export type FormatOverrides = z.infer<typeof formatOverridesSchema>;

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
  /**
   * How a textbook's divisions are numbered (addendum 16 §15).
   *
   * `decimal` is the textbook convention: sections 1, 2, 3 and subsections
   * 1.1, 1.2, 1.3. `none` leaves the writer's own titles standing alone, for a
   * book whose structure is not a numbered outline — which is the whole of what
   * *or whatever you'd like* needs.
   *
   * **No number is stored anywhere.** This says only which scheme to read the
   * structure through; the figures themselves are counted from where a division
   * falls, so moving one renumbers everything with nothing run.
   */
  sectionNumbering: z.enum(['decimal', 'none']).default('decimal'),
  /**
   * How the Outliner's rows are named (addendum 19 §10).
   *
   * **It casts the words rather than how they are drawn**, which is why it is
   * here rather than in a stylesheet: a row's name travels into the marker,
   * the unit or the beat when it is promoted, so a case the Outliner alone
   * knew about would be a case the book does not print. `as_typed` is the
   * default, so no outline made before this moves. `outline-case.ts` holds
   * what each one means.
   */
  outlineCase: z.enum(['as_typed', 'title', 'sentence']).default('as_typed'),
  /** Whether a printing carries the chapter pages. */
  includeChapterPagesInExport: z.boolean().default(true),
  /**
   * How a novel or short story sets its paragraphs (spec §6.4). Standard
   * manuscript format by default, because that is what a manuscript goes out
   * in. Screenplay formats never read it.
   */
  paragraphStyle: paragraphStyleSchema.default('indented'),
  /**
   * The house a script is set in (spec §6.5). US studio format unless the
   * writer says otherwise; prose formats never read it.
   */
  scriptFormat: scriptFormatSchema.default('us'),
  /**
   * The writer's changes to that house style, element by element (addendum
   * 39). Empty is the preset exactly as bundled.
   */
  formatOverrides: formatOverridesSchema.default({}),
  /**
   * Act breaks (spec §6.5). A network episode is written in acts with a
   * commercial between them: each starts on a page of its own, with its name
   * at the head and `END OF …` under its last line. A feature and a streaming
   * script have none, which is why it is off unless asked for.
   */
  actBreaks: z.boolean().default(false),
  /**
   * The slot a short-form piece has to fit (addendum 05 §4a), in seconds.
   *
   * A thirty is thirty: a commercial is sold against a length, and a board
   * that runs to thirty-four is not a board, it is a problem. Zero means no
   * constraint has been set, which is the honest state of a piece nobody has
   * sold yet.
   */
  maxSeconds: z.number().int().min(0).default(0),
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
   * The Story Grid's global layer (addendum 04 §3): what the story is, and
   * what that obliges it to deliver. Kept loose here so the method lives with
   * `story-grid.ts` rather than with the settings.
   */
  storyGrid: z.record(z.unknown()).default({}),
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
  /**
   * The cast page's own words (addendum 38 §4): its heading, the order the
   * roles are in, the time and the place. The roles themselves are the
   * characters' — `casting` on each — so a name is typed once.
   */
  castPage: castPageSchema.default({}),
  /**
   * How the chapter pages are set (addendum 02 §12a). Kept loose here so the
   * typography lives with `chapter-style.ts` rather than with the settings,
   * the way `storyGrid` and `episodeCarry` do.
   *
   * It is the **book's**, not the chapter's, for the reason the numbering is:
   * a reader who turns to chapter nine and finds its heading in another face
   * has found a mistake rather than a design.
   */
  chapterPageStyle: z.record(z.unknown()).default({}),
  /**
   * The book (addendum 20): the trim, the type, the running heads and the
   * parts in front of the story and behind it. Kept loose here so the rules
   * live with `entities/book.ts` and `book-layout.ts`, the way the chapter
   * page's do. The book's furniture, never the story's — which is why it is
   * here rather than in the manuscript (§2).
   */
  book: z.record(z.unknown()).default({}),
  /** How citations, notes and the bibliography are written (addendum 43); read through `citationSettingsOf`. */
  citations: z.record(z.unknown()).default({}),
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
  /**
   * Where this copy stands against a Writers Room's master (addendum 07 §14).
   *
   * On the **document** rather than in a per-device setting, because it is a
   * fact about the content: two copies of the same file descend from the same
   * master version. It is also what makes *behind* knowable — without an
   * ancestor, a file that differs from the master could equally be ahead of it
   * or behind it, and the room would have to guess.
   *
   * Null everywhere but a project that has been in a room, which is nearly
   * every project: a script written alone has no room to stand against.
   */
  mooring: mooringSchema.nullable().default(null),
  ...timestamps,
});
export type Project = z.infer<typeof projectSchema>;
