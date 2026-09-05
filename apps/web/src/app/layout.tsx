import type { Metadata } from 'next';
import Link from 'next/link';
import { env, SITE_NAME } from '@/lib/env';
import './globals.css';
import { Wordmark } from './wordmark';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="shell">
            <nav>
              <Link href="/" className="wordmark" aria-label="VC Writer home">
                <Wordmark />
              </Link>
              <Link href="/#features">Features</Link>
              <Link href="/download">Buy &amp; download</Link>
              <Link href="/notes">Notes</Link>
              <Link href="/account">My account</Link>
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
        <footer className="site-footer">
          <div className="shell">
            <p>
              © {new Date().getFullYear()} {SITE_NAME}. Windows 10, Windows 11 and macOS.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
