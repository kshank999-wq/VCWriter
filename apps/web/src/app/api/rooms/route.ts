import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser, serverClient } from '@/lib/supabase';
import { createRoom } from '@/lib/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Starting a room over a project (addendum 07 §5, stage 2).
 *
 * A room is attached to a project somebody already owns, and this checks that
 * ownership **through the caller's own session** rather than by trusting the
 * id in the body: the row comes back only if row-level security says it may,
 * which is the same rule everything else in the Room obeys (§16).
 */

const schema = z.object({
  projectId: z.string().uuid(),
  name: z.string().max(120).default(''),
  includedSeats: z.number().int().min(1).max(200).default(1),
});

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a project.' }, { status: 400 });

  const { data: project } = await serverClient()
    .from('projects')
    .select('id, title, owner_id')
    .eq('id', parsed.data.projectId)
    .maybeSingle();

  const owned = project as { id: string; title: string; owner_id: string } | null;
  if (!owned || owned.owner_id !== user.id) {
    return NextResponse.json({ error: 'That is not your project.' }, { status: 403 });
  }

  try {
    const room = await createRoom({
      projectId: owned.id,
      name: parsed.data.name.trim() || owned.title,
      includedSeats: parsed.data.includedSeats,
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
