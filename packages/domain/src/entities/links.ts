import { z } from 'zod';
import { id, timestamps } from './common.js';
import type { ProjectId, StoryLinkId } from '../ids.js';

/**
 * Typed story links (spec §7.4, §19).
 *
 * A link is a structured record between two entity references — never text
 * duplicated into several places — so renaming or editing an entity propagates
 * everywhere it is referenced.
 */

export const storyEntityTypeSchema = z.enum([
  'project',
  'lane',
  'unit',
  'beat',
  'research_item',
  'character',
  'setup_payoff',
  'capture_item',
]);
export type StoryEntityType = z.infer<typeof storyEntityTypeSchema>;

export const storyEntityRefSchema = z.object({
  type: storyEntityTypeSchema,
  id: z.string().uuid(),
});
export type StoryEntityRef = z.infer<typeof storyEntityRefSchema>;

export const storyLinkTypeSchema = z.enum([
  'appears_in',
  'mentions',
  'establishes',
  'pays_off',
  'located_at',
  'owns',
  'depends_on',
  'relates_to',
  'custom',
]);
export type StoryLinkType = z.infer<typeof storyLinkTypeSchema>;

export const storyLinkSchema = z.object({
  id: id<StoryLinkId>(),
  projectId: id<ProjectId>(),
  from: storyEntityRefSchema,
  to: storyEntityRefSchema,
  type: storyLinkTypeSchema.default('relates_to'),
  /** Free label used when `type` is `custom`, or to annotate the relationship. */
  label: z.string().default(''),
  notes: z.string().default(''),
  ...timestamps,
});
export type StoryLink = z.infer<typeof storyLinkSchema>;

export const refEquals = (a: StoryEntityRef, b: StoryEntityRef): boolean => a.type === b.type && a.id === b.id;

export const ref = (type: StoryEntityType, entityId: string): StoryEntityRef => ({ type, id: entityId });
