import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser, serverClient } from '@/lib/supabase';
import { ROOM_INCLUDED_SEATS, createProjectFile, parseProjectFile, projectFormatSchema, type ProjectFile } from '@vcwriter/domain';
import { createRoom } from '@/lib/rooms';
import { insertProjectFile } from '@/lib/project-rows';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Starting a room (addendum 07 §5, §33).
 *
 * The room's project is chosen on purpose rather than picked from whatever the
 * account happens to hold (which is mostly what the Notes app made): either a
 * **new project made for the room**, or a **project brought from VC Writer**
 * as its project file (.vcw). Both become a project in the account that the
 * showrunner owns, and the room is put over it. An existing project id is
 * still accepted for a project that is already in the account.
 */

const schema = z.union([
  z.object({ projectId: z.string().uuid(), name: z.string().max(120).default('') }),
  z.object({
    newProject: z.object({ title: z.string().trim().min(1).max(200), format: projectFormatSchema }),
    name: z.string().max(120).default(''),
  }),
  z.object({ upload: z.unknown(), name: z.string().max(120).default('') }),
]);

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Say which project the room is for.' }, { status: 400 });
  const body = parsed.data;
  const db = serverClient();

  let project: { id: string; title: string } | null = null;
  if ('projectId' in body) {
    const { data } = await db.from('projects').select('id, title, owner_id').eq('id', body.projectId).maybeSingle();
    const owned = data as { id: string; title: string; owner_id: string } | null;
    if (!owned || owned.owner_id !== user.id) return NextResponse.json({ error: 'That is not your project.' }, { status: 403 });
    project = owned;
  } else {
    let file: ProjectFile;
    if ('newProject' in body) {
      file = createProjectFile({ title: body.newProject.title, format: body.newProject.format, ownerId: user.id as never });
    } else {
      try {
        file = parseProjectFile(body.upload);
      } catch {
        return NextResponse.json({ error: 'That is not a VC Writer project file.' }, { status: 400 });
      }
      // The file was the writer's; in the account it is theirs too.
      file = { ...file, project: { ...file.project, ownerId: user.id as never } };
      const { data: existing } = await db.from('projects').select('id, owner_id').eq('id', file.project.id as string).maybeSingle();
      const there = existing as { id: string; owner_id: string } | null;
      if (there && there.owner_id !== user.id) {
        return NextResponse.json({ error: 'That project belongs to another account.' }, { status: 403 });
      }
      if (there) {
        // Already in the account (it was synced or brought before): the room
        // goes over the copy that is there, untouched.
        const { data: room } = await db.from('rooms').select('id').eq('project_id', there.id).maybeSingle();
        if (room) return NextResponse.json({ error: 'That project already has a room.' }, { status: 409 });
        project = { id: there.id, title: file.project.title };
      }
    }
    if (!project) {
      const stored = await insertProjectFile(file);
      if (!stored.ok) return NextResponse.json({ error: `The project could not be stored: ${stored.error}` }, { status: 400 });
      project = { id: file.project.id as string, title: file.project.title };
    }
  }

  if (!project) return NextResponse.json({ error: 'Say which project the room is for.' }, { status: 400 });

  try {
    const room = await createRoom({
      projectId: project.id,
      name: body.name.trim() || project.title,
      // Not the caller's to choose: the room's fee covers the showrunner and one
      // other person, and everyone after that is an extra seat (§24).
      includedSeats: ROOM_INCLUDED_SEATS,
    });
    return NextResponse.json({ room });
  } catch (cause) {
    // One room per project: asking twice is not an error worth a stack trace.
    const message = cause instanceof Error ? cause.message : 'The room could not be started.';
    const already = message.includes('rooms_project_unique');
    return NextResponse.json(
      { error: already ? 'That project already has a room.' : message },
      { status: already ? 409 : 500 },
    );
  }
}
