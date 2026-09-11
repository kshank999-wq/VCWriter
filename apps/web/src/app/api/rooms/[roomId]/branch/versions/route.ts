import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { restoreVersion, takeSnapshot, versionsFor } from '@/lib/branches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The history of a draft (addendum 07 §9).
 *
 * GET lists what the caller may see — their own versions, and the room's
 * master. POST either records a new one or puts an earlier one back on the
 * desk, and **neither removes anything**: there is no DELETE here, and there
 * could not be, because the database refuses to change or remove a version at
 * all (§1).
 */

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  return NextResponse.json({ versions: await versionsFor(view.room.id) });
}

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('snapshot'),
    branchId: z.string().uuid(),
    label: z.string().max(120).default(''),
    summary: z.string().max(2000).default(''),
  }),
  z.object({
    action: z.literal('restore'),
    branchId: z.string().uuid(),
    versionId: z.string().uuid(),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not something I can do.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  try {
    if (parsed.data.action === 'snapshot') {
      const made = await takeSnapshot({
        roomId: view.room.id,
        branchId: parsed.data.branchId,
        userId: user.id,
        label: parsed.data.label,
        summary: parsed.data.summary,
      });
      if ('reason' in made) {
        return NextResponse.json({ error: 'There is nothing on that desk to record yet.' }, { status: 409 });
      }
      return NextResponse.json({ version: made });
    }

    const back = await restoreVersion({
      branchId: parsed.data.branchId,
      versionId: parsed.data.versionId,
    });
    if ('reason' in back) return NextResponse.json({ error: 'That version is not there.' }, { status: 404 });
    return NextResponse.json(back);
  } catch {
    return NextResponse.json({ error: 'That draft is not yours.' }, { status: 403 });
  }
}
