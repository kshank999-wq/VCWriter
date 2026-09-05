import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Refreshes the Supabase session cookie on navigation so a signed-in customer
 * does not get bounced to sign-in mid-download — and sets the content security
 * policy (§12.1).
 *
 * The policy is nonce-based rather than `unsafe-inline`. This site has no
 * external scripts and no third-party embeds at all, so the strict version
 * costs nothing to allow and is worth having on the pages where someone signs
 * in and buys something. Next.js reads the nonce back off the request header
 * and stamps it onto its own inline scripts.
 *
 * The trade: a page carrying a per-request nonce cannot be statically cached,
 * so the marketing page is rendered per request. On a site this size that is a
 * few milliseconds, and it buys a policy that would stop an injected script
 * from running at all.
 */
const contentSecurityPolicy = (nonce: string): string => {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  // The browser client talks to Supabase over https and, for realtime, wss.
  const supabaseSocket = supabase.replace(/^https:/, 'wss:');

  return [
    "default-src 'self'",
    // `strict-dynamic` lets Next's bootstrap script load its own chunks while
    // still refusing anything an injection introduces.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`,
    // Styles come from the stylesheet, but React and Next both set inline
    // style attributes; there is no nonce mechanism for those.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseSocket}`.trim(),
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
};

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Next reads the nonce from this header to stamp its own inline scripts.
  requestHeaders.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', policy);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Everything except static assets and the Stripe webhook, which authenticates
  // with a signature rather than a session.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/stripe).*)'],
};
