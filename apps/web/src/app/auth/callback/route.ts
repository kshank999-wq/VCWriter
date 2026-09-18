import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Exchanges the magic-link code for a session cookie, then continues. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/account';

  // Only ever redirect within this site.
  const destination = next.startsWith('/') ? next : '/account';

  if (code) {
    const { error } = await serverClient().auth.exchangeCodeForSession(code);
    if (error) {
      // The exchange fails when the link has been spent, or when it was
      // opened in a different browser from the one that asked for it — the
      // sign-in is tied to that browser. Either way the person is sent back
      // to ask again, still pointed at where they were going, and the page
      // says what happened rather than showing the same form in silence.
      const back = new URL('/signin', url.origin);
      back.searchParams.set('error', 'link_expired');
      back.searchParams.set('next', destination);
      return NextResponse.redirect(back);
    }
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
