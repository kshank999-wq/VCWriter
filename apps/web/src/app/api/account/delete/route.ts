import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient, currentUser } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Deleting an account (addendum 27 §12).
 *
 * The App Store requires that somebody can delete their account rather than
 * merely stop using it, and the privacy policy now says they can, so this is
 * the thing that makes both true. It is deliberately **one route for both
 * doors**: `currentUser()` reads a cookie from the website and a bearer token
 * from the phone (§2), so the desktop's account page and the Notes app press
 * the same button and there is one answer to *what does deleting mean*.
 *
 * What it does is one call. `auth.admin.deleteUser` removes the sign-in, the
 * profile cascades from it, and everything the person wrote cascades from the
 * profile — projects and every row under them, captures, branches, the rooms
 * they own. Writing the deletions out here instead would be a second, longer
 * answer to a question the schema already answers, and the first table added
 * next month would be the one it forgot.
 *
 * Two things deliberately survive, and both are said on the account page
 * before the press rather than discovered afterwards. An **order** stays as a
 * financial record with nobody attached (migration 0062), because tax law
 * wants the receipt and the receipt does not need a name on it. And work
 * **contributed to somebody else's Writers Room** stays in that room with the
 * author's name removed — addendum 07 §1's rule that one writer's work is
 * never destroyed by another's, which cuts this way too.
 *
 * The confirmation is the account's **own email address**, typed. A boolean
 * would be a click, and a request that carried one could be made by anything
 * that had the session; this takes a person who knows which account they are
 * signed into and means to end it.
 */
const bodySchema = z.object({
  confirm: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Sign in to delete your account' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Type your email address to confirm' }, { status: 400 });
  }

  const said = parsed.data.confirm.trim().toLowerCase();
  if (said !== user.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: `That is not the address on this account. Type ${user.email} to confirm.` },
      { status: 400 },
    );
  }

  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json(
      { error: 'Your account could not be deleted. Write to support@vc-writer.com and a person will do it.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ deleted: true });
}
