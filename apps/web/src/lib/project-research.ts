import { toRows, type ProjectFile } from '@vcwriter/domain';
import { adminClient } from './supabase';

export { projectDocument } from './project-document';

/**
 * Writing filed ideas into the project's research (addendum 07 §11).
 *
 * **As the server, after the room's own rule has been checked** — the same
 * arrangement `rooms.ts` uses for seats, and for the same reason: this is a
 * *room* action that writes on the project's behalf, and the person doing it
 * may be a co-showrunner who holds the room's owner seat without owning the
 * project. `canReview` is what decides whether it may happen, and the route
 * asks that before this is called.
 *
 * Only research items are written. The rest of the document came out of the
 * database a moment ago and putting it all back would be a merge nobody asked
 * for — and one that could undo a writer's work, which is §1.
 */
export const writeResearch = async (file: ProjectFile): Promise<void> => {
  // Every row carries its own `project_id`, so there is nothing to pass in
  // and nothing that could disagree with the document.
  const rows = toRows(file).researchItems;
  if (rows.length === 0) return;

  const { error } = await adminClient().from('research_items').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(error.message);
};
