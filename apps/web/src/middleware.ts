import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { strayAuthRedirect } from '@/lib/auth-redirect';
import { previewContentSecurityPolicy, previewRoute } from '@/lib/preview-gate';

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
  // A sign-in code that landed on the wrong page (see auth-redirect.ts).
  // Decided before anything else: a redirect renders nothing, so it needs no
  // policy and no session refresh.
  const stray = strayAuthRedirect(request.nextUrl);
  if (stray) return NextResponse.redirect(stray);

  // The browser preview: administrators only, with the bundle's own policy.
  const preview = previewRoute(request.nextUrl.pathname);
  if (preview) return previewResponse(request, preview);

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

const previewResponse = async (
  request: NextRequest,
  route: NonNullable<ReturnType<typeof previewRoute>>,
): Promise<NextResponse> => {
  /**
   * The bundle's own files are served without the gate.
   *
   * They are content-hashed build artifacts of code that ships inside the
   * installer anyway — there is nothing behind them the page does not already
   * hand over, and their names are only knowable from the page, which is
   * gated. Gating them as well bought nothing and cost a great deal: every
   * chunk paid for two round trips to Supabase, and a chunk fetched *late* —
   * the PDF reader is imported at the moment Import is clicked, which may be
   * an hour after the page loaded — was redirected to the sign-in page the
   * moment the access token expired. A dynamic import handed an HTML document
   * fails with "Failed to fetch dynamically imported module", which is what
   * the writer saw instead of the file picker.
   *
   * Hashed names also mean these can be cached hard, which the page cannot.
   */
  if (route.kind === 'asset') {
    const response = NextResponse.next();
    response.headers.set('cache-control', 'public, max-age=31536000, immutable');
    return response;
  }

  // Who is asking. The profile row is readable by its owner under RLS, so the
  // session client is enough; no service key runs at the edge.
  const response = NextResponse.rewrite(new URL(route.to, request.url));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        // A refreshed token has to be written back, or a preview session
        // expires while it is being used and never renews itself.
        set: (name: string, value: string, options: CookieOptions) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    : { data: null };

  /**
   * Two ways through, and the second is what makes the Room possible
   * (addendum 07 §3.1).
   *
   * An administrator gets in bare, because the page is still where the
   * interface under development is looked at. Anyone else must name a room —
   * `?room=<id>` — and be in it, which is not this middleware's judgement: it
   * asks for the row, and row-level security answers. A stranger's room simply
   * is not there.
   */
  const roomId = request.nextUrl.searchParams.get('room');
  const inRoom =
    user && roomId
      ? Boolean((await supabase.from('rooms').select('id').eq('id', roomId).maybeSingle()).data)
      : false;

  if (!profile?.is_admin && !inRoom) {
    const back = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(
      new URL(`/signin?next=${encodeURIComponent(back)}`, request.url),
    );
  }

  response.headers.set('content-security-policy', previewContentSecurityPolicy);
  // Always the newest build: the point of the page is that a refresh is enough.
  response.headers.set('cache-control', 'no-store');
  return response;
};

export const config = {
  // Everything except static assets and the Stripe webhook, which authenticates
  // with a signature rather than a session.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/stripe).*)'],
};
