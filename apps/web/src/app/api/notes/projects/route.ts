import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createProjectFile,
  isCollection,
  projectFormatSchema,
  storyChoices,
  withStories,
} from '@vcwriter/domain';
import { currentUser, serverClient } from '@/lib/supabase';
import { insertProjectFile } from '@/lib/project-rows';
import { requireNotesCapture } from '@/lib/notes-subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The projects a writer can capture into, and starting a new one (addendum 09
 * §3.1, stage 5).
 *
 * **A project made on the phone is made by the same function that makes one on
 * the desktop.** `createProjectFile` builds the whole document — the opening
 * scene, its first beat, the plot track, the research folders, the cast
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
  /**
   * A collection's stories, named on the phone before it is made (addendum 27
   * §23): one name for a single story, several for a collection. Read only on
   * the short-story format.
   */
  stories: z.array(z.string().trim().max(200)).max(100).default([]),
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
  // Making a project from the phone is a write to somebody's work, so it is
  // behind the subscription with sending (addendum 27 §14). **Listing them is
  // not**: a lapsed subscriber still sees their projects, because the list is
  // the account's rather than the app's.
  const gate = await requireNotesCapture();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A project needs a title.' }, { status: 400 });
  }

  const made = createProjectFile({
    title: parsed.data.title,
    format: parsed.data.format,
    ownerId: user.id as never,
  });
  const file = isCollection(made.project.format) ? withStories(made, parsed.data.stories) : made;
  const stored = await insertProjectFile(file);
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: 400 });

  return NextResponse.json({
    project: {
      id: file.project.id,
      title: file.project.title,
      format: file.project.format,
      updated_at: file.project.updatedAt,
    },
    stories: storyChoices(file),
  });
}
