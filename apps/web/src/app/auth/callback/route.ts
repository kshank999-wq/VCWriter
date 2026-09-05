import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Exchanges the magic-link code for a session cookie, then continues. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/account';

  if (code) {
    const { error } = await serverClient().auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL('/signin?error=link_expired', url.origin));
    }
  }

  // Only ever redirect within this site.
  const destination = next.startsWith('/') ? next : '/account';
  return NextResponse.redirect(new URL(destination, url.origin));
}
