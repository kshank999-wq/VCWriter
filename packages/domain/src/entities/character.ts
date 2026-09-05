import { z } from 'zod';
import { id, timestamps } from './common.js';
import { voiceAssignmentSchema } from './project.js';
import type { CharacterId, ProjectId, ResearchItemId } from '../ids.js';

/**
 * Characters are first-class project entities (spec §13) and carry a persistent
 * TTS voice assignment so screenplay read-back sounds like several people
 * talking (§10). A character may also be surfaced in the Characters research
 * category; that is a link, not a copy.
 */
export const characterSchema = z.object({
  id: id<CharacterId>(),
  projectId: id<ProjectId>(),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().default(''),
  arcNotes: z.string().default(''),
  /** Optional backing research card, when the writer keeps one. */
  researchItemId: id<ResearchItemId>().nullable().default(null),
  /** Persists per project and stays editable (§10). */
  voice: voiceAssignmentSchema.nullable().default(null),
  archived: z.boolean().default(false),
  ...timestamps,
});
export type Character = z.infer<typeof characterSchema>;
