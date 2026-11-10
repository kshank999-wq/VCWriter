import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/supabase';
import { archiveMarkup, markMarkupSeen } from '@/lib/markups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A markup opened, archived or brought back (addendum 07 §27, §27.2). Who may
 * do which is the database's answer: seen is the writer's, and archiving is the
 * writer's or the sender's.
 */
const schema = z.object({ seen: z.boolean().optional(), archived: z.boolean().optional() });

export async function PATCH(
  request: Request,
  { params }: { params: { roomId: string; markupId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({ seen: true })));
  const body = parsed.success ? parsed.data : { seen: true };
  try {
    if (body.archived !== undefined) await archiveMarkup(params.markupId, body.archived);
    else await markMarkupSeen(params.markupId);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'That could not be changed.';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
