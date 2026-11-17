import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseCategoryChoices } from '@vcwriter/domain';
import { currentUser, serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * **The writer's own note categories, kept with their account** (addendum 27
 * §35, from Ken, 16 November: *do the phone categories by voice and sync*).
 *
 * One list per writer and project: the categories they made (`own`) and the
 * format's ones they took off (`hidden`). The phone reads it when a project
 * opens and writes it whenever the list changes — by the gear or by voice — so
 * a second phone, a reinstall or a tablet has the same list.
 *
 * Read and written through the caller's own client, so row-level security
 * decides: a project they cannot see is one they have no list for.
 */

const mine = async (projectId: string): Promise<boolean> => {
  const { data } = await serverClient().from('projects').select('id').eq('id', projectId).maybeSingle();
  return Boolean(data);
};

export async function GET(_request: Request, { params }: { params: { projectId: string } }): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!(await mine(params.projectId))) return NextResponse.json({ error: 'No such project.' }, { status: 404 });
  const { data } = await serverClient()
    .from('note_category_choices')
    .select('own, hidden, updated_at')
    .eq('project_id', params.projectId)
    .eq('user_id', user.id)
    .maybeSingle();
  // None kept yet is a list nobody has changed, and says so with `kept`.
  if (!data) return NextResponse.json({ kept: false, own: [], hidden: [], updatedAt: null });
  const row = data as { own: string[]; hidden: string[]; updated_at: string };
  const choices = parseCategoryChoices(JSON.stringify({ own: row.own, hidden: row.hidden }));
  return NextResponse.json({ kept: true, ...choices, updatedAt: row.updated_at });
}

const body = z.object({
  own: z.array(z.string().trim().min(1).max(37)).max(200),
  hidden: z.array(z.string().trim().min(1).max(40)).max(50),
});

export async function PUT(request: Request, { params }: { params: { projectId: string } }): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a list of categories.' }, { status: 400 });
  if (!(await mine(params.projectId))) return NextResponse.json({ error: 'No such project.' }, { status: 404 });
  const updatedAt = new Date().toISOString();
  const { error } = await serverClient()
    .from('note_category_choices')
    .upsert(
      { user_id: user.id, project_id: params.projectId, own: parsed.data.own, hidden: parsed.data.hidden, updated_at: updatedAt },
      { onConflict: 'user_id,project_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ kept: true, own: parsed.data.own, hidden: parsed.data.hidden, updatedAt });
}
