import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/supabase';
import { markMarkupSeen } from '@/lib/markups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The writer has opened a markup sent to them (addendum 07 §27). Theirs alone to say. */
export async function PATCH(
  _request: Request,
  { params }: { params: { roomId: string; markupId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  await markMarkupSeen(params.markupId);
  return NextResponse.json({ ok: true });
}
