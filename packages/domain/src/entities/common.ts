import { z } from 'zod';
import type { AnyId } from '../ids.js';

/**
 * A uuid-shaped column whose parsed type keeps its brand, so schema-validated
 * data flows into the branded domain types without a manual cast at each site.
 */
export const id = <T extends AnyId>(): z.ZodType<T> => z.string().uuid() as unknown as z.ZodType<T>;

export const isoDateTime = () => z.string().datetime({ offset: true });

/** Fractional index (see `ordering.ts`). Sorted lexicographically. */
export const orderKey = () => z.string().min(1);

export const timestamps = {
  createdAt: isoDateTime(),
  updatedAt: isoDateTime(),
};

export const nowIso = (): string => new Date().toISOString();

export const platformSchema = z.enum(['windows', 'macos']);
export type Platform = z.infer<typeof platformSchema>;

/**
 * Reversible lifecycle states. Spec §19: "used" and "archived" are states, not
 * deletion — every transition here has an inverse.
 */
export const archiveStateSchema = z.enum(['active', 'archived']);
export type ArchiveState = z.infer<typeof archiveStateSchema>;
