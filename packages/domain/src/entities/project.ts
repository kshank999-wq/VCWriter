import { z } from 'zod';
import { id, isoDateTime, timestamps } from './common.js';
import type { AssetId, ProjectId, UserId } from '../ids.js';

/** Spec §4: a project is created as a screenplay, a novel, or another format. */
export const projectFormatSchema = z.enum(['screenplay', 'novel', 'stage_play', 'short_story', 'other']);
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
