import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient, currentUser, serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recently deleted notes (addendum 27 §34).
 *
 * A note deleted anywhere is kept for 30 days in `deleted_capture_items`, by a
 * trigger in the database (migration 0087). This lists the caller's own,
 * restores them, and empties the bin for good. Who owns what is row-level
 * security's to say; restore runs as the caller and touches only their notes.
 */

const KEEP_DAYS = 30;

interface Kept {
  id: string;
  row: { raw_text?: string | null; captured_at?: string | null; category?: string | null; subject_name?: string | null; filed_into?: string | null };
  deleted_at: string;
}

export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // Anything past 30 days goes first, so the list never shows it.
  await adminClient().rpc('purge_deleted_captures');

  const { data, error } = await serverClient()
    .from('deleted_capture_items')
    .select('id, row, deleted_at')
    .order('deleted_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const now = Date.now();
  const notes = ((data ?? []) as Kept[]).map((one) => ({
    id: one.id,
    text: (one.row.raw_text ?? '').trim(),
    capturedAt: one.row.captured_at ?? null,
    category: one.row.category ?? null,
    subject: one.row.subject_name ?? null,
    filedInto: one.row.filed_into ?? null,
    deletedAt: one.deleted_at,
    daysLeft: Math.max(0, KEEP_DAYS - Math.floor((now - new Date(one.deleted_at).getTime()) / 86_400_000)),
  }));
  return NextResponse.json({ notes, keepDays: KEEP_DAYS });
}

const ids = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

/** Put notes back where they were. */
export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const parsed = ids.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Which notes?' }, { status: 400 });

  const { data, error } = await serverClient().rpc('restore_deleted_captures', { ids: parsed.data.ids });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ restored: (data as number | null) ?? 0 });
}

const emptying = z.union([ids, z.object({ all: z.literal(true) })]);

/** Remove notes from the bin for good: some, or all of them. */
export async function DELETE(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const parsed = emptying.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Which notes?' }, { status: 400 });

  const query = serverClient().from('deleted_capture_items').delete();
  const { data, error } = await ('all' in parsed.data ? query.eq('user_id', user.id) : query.in('id', parsed.data.ids)).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ removed: (data ?? []).length });
}
