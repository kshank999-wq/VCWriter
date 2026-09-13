import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureCategorySchema, mayStillEdit } from '@vcwriter/domain';
import { currentUser, serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Correcting and throwing away a note, from the phone (addendum 09 §7, stage 3).
 *
 * **Only while it is still waiting.** Once the desktop has placed a note it is
 * the trail behind a real research item, and rewriting it would change nothing
 * about the project and everything about the record of where that work came
 * from. `mayStillEdit` says so in the domain and migration 0042 says so in the
 * database — so a client that skipped this route entirely would still be
 * refused, which is the point of putting it there as well as here.
 *
 * The check here exists to give a person a sentence instead of a silent
 * no-op: RLS answers a forbidden update by matching no rows, which reads to a
 * caller exactly like a note that has gone.
 */

const patch = z.object({
  rawText: z.string().min(1).max(20_000).optional(),
  category: captureCategorySchema.nullable().optional(),
  subjectName: z.string().max(200).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

/** The one row this caller may act on, or a reason they may not. */
const waiting = async (noteId: string): Promise<{ error: Response } | { status: string }> => {
  const { data } = await serverClient()
    .from('capture_items')
    .select('status')
    .eq('id', noteId)
    .maybeSingle();

  const row = data as { status: string } | null;
  if (!row) return { error: NextResponse.json({ error: 'No such note.' }, { status: 404 }) };
  if (!mayStillEdit(row.status)) {
    return {
      error: NextResponse.json(
        { error: 'This note has already been filed in VC Writer. Change it there.' },
        { status: 409 },
      ),
    };
  }
  return { status: row.status };
};

export async function PATCH(
  request: Request,
  { params }: { params: { noteId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = patch.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a change.' }, { status: 400 });

  const gate = await waiting(params.noteId);
  if ('error' in gate) return gate.error;

  const changes: Record<string, unknown> = {};
  if (parsed.data.rawText !== undefined) changes['raw_text'] = parsed.data.rawText;
  if (parsed.data.category !== undefined) changes['category'] = parsed.data.category;
  if (parsed.data.subjectName !== undefined) changes['subject_name'] = parsed.data.subjectName;
  if (parsed.data.projectId !== undefined) changes['project_id'] = parsed.data.projectId;
  if (Object.keys(changes).length === 0) return NextResponse.json({ changed: false });

  const { error } = await serverClient().from('capture_items').update(changes).eq('id', params.noteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ changed: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { noteId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const gate = await waiting(params.noteId);
  if ('error' in gate) return gate.error;

  const { error } = await serverClient().from('capture_items').delete().eq('id', params.noteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
