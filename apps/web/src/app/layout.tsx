import type { Metadata } from 'next';
import { env, SITE_NAME } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${SITE_NAME} — write screenplays and novels in one place`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    'VC Writer is an integrated story development, research, outlining, drafting, editing and read-back environment for screenwriters and novelists. Windows 10/11 and macOS.',
  openGraph: {
    title: SITE_NAME,
    description: 'Story development, research, outlining, drafting, editing and read-back in one place.',
    url: env.siteUrl,
    siteName: SITE_NAME,
    type: 'website',
  },
};

/**
 * Every page renders per request.
 *
 * The content security policy carries a fresh nonce for each response
 * (see `middleware.ts`), and a statically prerendered page is HTML built
 * before that nonce existed — the browser then refuses every script on it,
 * because `strict-dynamic` makes `'self'` inert. Rendering per request is what
 * keeps the nonce in the HTML and the nonce in the header the same one.
 */
export const dynamic = 'force-dynamic';

/**
 * The document, and nothing else.
 *
 * The header and the footer moved to `(site)/layout.tsx`, because the phone
 * app at `/notes` is not a page of the site — installed to a home screen it is
 * the only thing on the screen, and a marketing nav there pushed the
 * microphone below the fold on an iPhone. What each page wears is now decided
 * by where it sits in the tree.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
