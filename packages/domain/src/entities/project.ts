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
