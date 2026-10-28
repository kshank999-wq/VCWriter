import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ARCHIVED_STATUSES } from '@vcwriter/domain';
import { currentUser, adminClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * **Clear transferred notes off the phone** (addendum 27 §29, from Ken: *it
 * should clear all transferred notes. And since they'll be in the archive,
 * there's a backup*).
 *
 * Clearing is not deleting: the notes stay on the account, in the desk's
 * archive, and the phone stops listing them (`/api/notes` leaves out anything
 * with `cleared_from_phone_at`). A filed note is not the writer's to *change*
 * under migration 0042, so the stamp is written with the service key — for the
 * caller's own notes only, and only ones already filed or set aside.
 */
const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Which notes?' }, { status: 400 });

  const { data, error } = await adminClient()
    .from('capture_items')
    .update({ cleared_from_phone_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .in('status', [...ARCHIVED_STATUSES])
    .in('id', parsed.data.ids)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ cleared: (data ?? []).length });
}
