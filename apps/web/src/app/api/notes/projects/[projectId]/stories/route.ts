import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SYNC_TABLES, isCollection, storyChoices, toRows, withStories, type Row } from '@vcwriter/domain';
import { currentUser, serverClient } from '@/lib/supabase';
import { requireNotesCapture } from '@/lib/notes-subscription';
import { projectDocument } from '@/lib/project-document';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A collection's stories, for the phone (addendum 27 §23, from Ken: *you can
 * add to that list. So when you're on the note screen, there'll be a dropdown
 * that allows you to pick the short story that it's going to go into*).
 *
 * **Read and made by the domain**, as a project made on the phone is: the
 * project is assembled from its rows, `storyChoices` reads its stories, and
 * `withStories` adds one the way the desktop's *+ New story* does — a section
 * of its own at the end with the story's marker on it. Only the rows that are
 * new are written, so nothing the desk has is touched.
 *
 * The document is read with the service key, so whose project it is is asked
 * first, through the caller's own client: a project RLS will not show them is
 * one they may not read the stories of.
 */

const mine = async (projectId: string): Promise<{ format: string } | null> => {
  const { data } = await serverClient().from('projects').select('id, format').eq('id', projectId).maybeSingle();
  return (data as { format: string } | null) ?? null;
};

export async function GET(_request: Request, { params }: { params: { projectId: string } }): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const project = await mine(params.projectId);
  if (!project) return NextResponse.json({ error: 'No such project.' }, { status: 404 });
  if (!isCollection(project.format as never)) return NextResponse.json({ stories: [] });

  const file = await projectDocument(params.projectId);
  return NextResponse.json({ stories: storyChoices(file) });
}

const body = z.object({ title: z.string().trim().min(1).max(200) });

export async function POST(request: Request, { params }: { params: { projectId: string } }): Promise<Response> {
  // Adding a story writes to somebody's project, so it is behind the
  // subscription with making one (addendum 27 §14).
  const gate = await requireNotesCapture();
  if (!gate.ok) return gate.response;

  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'A story needs a name.' }, { status: 400 });

  const project = await mine(params.projectId);
  if (!project) return NextResponse.json({ error: 'No such project.' }, { status: 404 });
  if (!isCollection(project.format as never)) {
    return NextResponse.json({ error: 'Only a collection of short stories has stories.' }, { status: 400 });
  }

  const before = await projectDocument(params.projectId);
  const after = withStories(before, [parsed.data.title]);
  const had = toRows(before);
  const now = toRows(after);
  const db = serverClient();

  for (const [key, table] of Object.entries(SYNC_TABLES)) {
    const old = new Set((had[key as keyof typeof SYNC_TABLES] as Row[]).map((row) => row['id']));
    const fresh = (now[key as keyof typeof SYNC_TABLES] as Row[]).filter((row) => !old.has(row['id']));
    if (fresh.length === 0) continue;
    const { error } = await db.from(table).insert(fresh);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ stories: storyChoices(after) });
}
