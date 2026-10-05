import { NextResponse } from 'next/server';
import { deskStandingFrom, licenseStatusSchema } from '@vcwriter/domain';
import { serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What this account's licence standing is, for the desktop to write down
 * (addendum 32 §8).
 *
 * The desktop has never needed this: it activates once, and everything that
 * reaches vc-writer.com asks per call. Read-only cannot work that way — a
 * machine that cannot reach the internet must not refuse somebody their own
 * manuscript — so the answer is recorded on the machine and the reading is done
 * there, which is also why **nothing here says what a lapse means**. The status
 * and the date are facts; `writingStanding` in the domain decides what follows
 * from them, in one place, so the desktop and anything built later cannot
 * disagree (addendum 07 §14's reason).
 *
 * **No admin client and no new policy**: a customer has read their own licence
 * rows since migration 0002, so this is their own session asking its own
 * question, under row level security, and the route cannot see anybody else's.
 * It is authenticated by cookie or bearer token like every other route, since
 * `serverClient` reads both (addendum 27 §2).
 */
export async function GET(): Promise<Response> {
  const db = serverClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in to check your licence' }, { status: 401 });

  const { data, error } = await db.from('licenses').select('status, expires_at');
  if (error) return NextResponse.json({ error: 'The licence could not be read' }, { status: 502 });

  const licenses = (data ?? []).flatMap((row) => {
    // A status this build cannot name is left out rather than read as lapsed:
    // the desktop's own rule is that nothing uncertain takes writing away, and
    // a row that cannot be understood here is exactly that (§8).
    const status = licenseStatusSchema.safeParse(row.status);
    if (!status.success) return [];
    return [{ status: status.data, expiresAt: (row.expires_at as string | null) ?? null }];
  });

  return NextResponse.json({ standing: deskStandingFrom(licenses, new Date()) });
}
