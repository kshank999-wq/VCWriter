import { SYNC_TABLES, toRows, type ProjectFile, type Row } from '@vcwriter/domain';
import { serverClient } from './supabase';

/**
 * Store a whole project in the account, as the visitor (row-level security
 * says it must be theirs). The project row first, then every table under it;
 * if any table refuses, the project goes and its children with it on the
 * cascades, because half a project is worse than none.
 */
export const insertProjectFile = async (file: ProjectFile): Promise<{ ok: true } | { ok: false; error: string }> => {
  const rows = toRows(file);
  const db = serverClient();
  const { error: projectError } = await db.from('projects').insert(rows.project);
  if (projectError) return { ok: false, error: projectError.message };

  for (const [key, table] of Object.entries(SYNC_TABLES)) {
    const collection = rows[key as keyof typeof SYNC_TABLES] as Row[];
    if (collection.length === 0) continue;
    const { error } = await db.from(table).insert(collection);
    if (error) {
      await db.from('projects').delete().eq('id', rows.project['id'] as string);
      return { ok: false, error: error.message };
    }
  }
  return { ok: true };
};
