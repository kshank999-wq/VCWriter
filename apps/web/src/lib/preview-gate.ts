/**
 * The browser preview at /preview/ (docs/deployment.md, "Browser preview"):
 * the desktop renderer built for a browser and copied under public/preview at
 * deploy time.
 *
 * **Two ways through it** (addendum 07 §3.1). An administrator gets in bare,
 * because this is still where the interface under development is looked at.
 * Anyone else must name a room — `?room=<id>` — and be in it, which is how the
 * Writers Room reaches the editor without a second editor being written for
 * the web. The middleware decides neither: it asks Supabase for the row and
 * row-level security answers.
 *
 * The page gets a policy that suits a Vite bundle rather than the site's nonce
 * one — and, in a room, one that lets the bundle call the site's own API.
 */

export type PreviewRoute = { kind: 'rewrite'; to: string } | { kind: 'asset' } | null;

/**
 * What the middleware should do with a path, before any question of who is
 * asking. The page is served at the bare `/preview`: Next strips a trailing
 * slash before the middleware runs, so a redirect *to* the slash form would
 * loop. The bundle's asset paths are absolute (`/preview/assets/…`, Vite's
 * `base`), so the page does not care which form it was reached by.
 */
export const previewRoute = (pathname: string): PreviewRoute => {
  if (pathname === '/preview' || pathname === '/preview/' || pathname === '/preview/index.html') {
    return { kind: 'rewrite', to: '/preview/index.html' };
  }
  if (pathname.startsWith('/preview/')) return { kind: 'asset' };
  return null;
};

/** Where an anonymous or non-admin visitor is sent instead. */
export const previewSignIn = '/signin?next=%2Fpreview';

/**
 * The bundle loads its own script and stylesheet from /preview/assets and
 * needs nothing else: no cloud, no third parties, no inline scripts. The
 * print window is opened by script and is same-origin.
 */
export const previewContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The room's bridge talks to /api/rooms/... on this same origin.
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');
