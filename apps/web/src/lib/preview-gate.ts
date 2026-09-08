/**
 * The browser preview at /preview/ (docs/deployment.md, "Browser preview"):
 * the desktop renderer built for a browser and copied under public/preview at
 * deploy time. It is the interface under development, not a customer page,
 * so the middleware lets only administrators through and gives the page a
 * policy that suits a Vite bundle rather than the site's nonce one.
 */

export type PreviewRoute =
  | { kind: 'redirect'; to: string }
  | { kind: 'rewrite'; to: string }
  | { kind: 'asset' }
  | null;

/** What the middleware should do with a path, before any question of who is asking. */
export const previewRoute = (pathname: string): PreviewRoute => {
  if (pathname === '/preview') return { kind: 'redirect', to: '/preview/' };
  // Relative asset paths in the built page resolve against the directory,
  // which is why the bare path above redirects to the slash form.
  if (pathname === '/preview/' || pathname === '/preview/index.html') return { kind: 'rewrite', to: '/preview/index.html' };
  if (pathname.startsWith('/preview/')) return { kind: 'asset' };
  return null;
};

/** Where an anonymous or non-admin visitor is sent instead. */
export const previewSignIn = '/signin?next=%2Fpreview%2F';

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
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');
