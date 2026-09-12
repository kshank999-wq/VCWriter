import {
  SYNC_TABLES,
  fromRows,
  gatherRows,
  type ProjectFile,
  type SyncCollection,
} from '@vcwriter/domain';
import { adminClient } from './supabase';

type Row = Record<string, unknown>;

/**
 * A project's rows, assembled back into the document (addendum 07 §4).
 *
 * The desktop already does this in `apps/desktop/src/main/cloud.ts`; this is
 * the same walk on the server, and it exists because a new branch has to start
 * from *something* and a room that has never merged has no master version to
 * start from. After the first master merge this path is barely used.
 *
 * `fromRows` puts the plans back together — boards with their nodes, outlines
 * with their rows — so a branch begins with the story *and* the plan, which is
 * the whole reason stage 0 came first.
 */
export const projectDocument = async (projectId: string): Promise<ProjectFile> => {
  const db = adminClient();

  const { data: project, error } = await db.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!project) throw new Error('That project is not there.');

  const collections = await Promise.all(
    Object.entries(SYNC_TABLES).map(async ([key, table]) => {
      const { data, error: readError } = await db.from(table).select('*').eq('project_id', projectId);
      if (readError) throw new Error(readError.message);
      return [key, (data ?? []) as Row[]] as const;
    }),
  );

  const rows = Object.fromEntries(collections) as Partial<Record<SyncCollection, Row[]>>;
  return fromRows(gatherRows(project as Row, rows));
};
