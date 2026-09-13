import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SYNC_TABLES,
  createProjectFile,
  projectFormatSchema,
  toRows,
  type Row,
} from '@vcwriter/domain';
import { currentUser, serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The projects a writer can capture into, and starting a new one (addendum 09
 * §3.1, stage 5).
 *
 * **A project made on the phone is made by the same function that makes one on
 * the desktop.** `createProjectFile` builds the whole document — the opening
 * scene, its first beat, the plot lane, the research folders, the cast
 * headings — and `toRows` says what that is in the database. Writing a bare
 * `projects` row here instead would give the phone a second, thinner idea of
 * what a project is, and the difference would only show up the first time
 * somebody opened it on a desktop and found no folders in it.
 *
 * The rows go in `SYNC_TABLES` declaration order, for the same reason the
 * desktop's push does: nothing may be written before the thing it hangs off.
 */

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  /** The phone offers the two a writer is most likely to start on a train. */
  format: projectFormatSchema.default('screenplay'),
});

export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { data, error } = await serverClient()
    .from('projects')
    .select('id, title, format, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A project needs a title.' }, { status: 400 });
  }

  const file = createProjectFile({
    title: parsed.data.title,
    format: parsed.data.format,
    ownerId: user.id as never,
  });
  const rows = toRows(file);
  const db = serverClient();

  const { error: projectError } = await db.from('projects').insert(rows.project);
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });

  for (const [key, table] of Object.entries(SYNC_TABLES)) {
    const collection = rows[key as keyof typeof SYNC_TABLES] as Row[];
    if (collection.length === 0) continue;

    const { error } = await db.from(table).insert(collection);
    if (error) {
      // Half a project is worse than none: a writer would open it on the
      // desktop and find a scene with no lane to sit in. The project row goes
      // and its children with it, on the cascades migration 0001 set up.
      await db.from('projects').delete().eq('id', rows.project['id'] as string);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    project: {
      id: file.project.id,
      title: file.project.title,
      format: file.project.format,
      updated_at: file.project.updatedAt,
    },
  });
}
