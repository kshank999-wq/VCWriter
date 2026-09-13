import Link from 'next/link';
import { currentAdmin } from '@/lib/admin';
import { SITE_NAME } from '@/lib/env';
import { Wordmark } from './wordmark';

/**
 * The site's header and footer.
 *
 * Lives here rather than in the root layout because **not every page under
 * this domain is a page of the site**. `/notes` is the phone app: installed to
 * a home screen it is the only thing on the screen, and wearing a marketing
 * nav there cost half an iPhone's height before the microphone — the first
 * thing a voice notebook is for was below the fold.
 *
 * So the chrome belongs to the `(site)` route group, and the two pages outside
 * it — the phone app, which wants none, and the not-found page, which wants it
 * wherever a mistyped address lands — say so for themselves.
 */

/**
 * Whether the visitor is an administrator, for the one nav link that only
 * they should see. The pages behind it check for themselves, so this decides
 * nothing about access — only whether to show the door. Never allowed to
 * fail the layout: a Supabase hiccup costs an admin a link, not the site.
 */
const isAdminVisitor = async (): Promise<boolean> => {
  try {
    return (await currentAdmin()) !== null;
  } catch {
    return false;
  }
};

export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const admin = await isAdminVisitor();

  return (
    <>
      <header className="site-header">
        <div className="shell">
          <nav>
            <Link href="/" className="wordmark" aria-label="VC Writer home">
              <Wordmark />
            </Link>
            <Link href="/#features">Features</Link>
            <Link href="/download">Buy &amp; download</Link>
            <Link href="/notes">Notes</Link>
            {/* Signing in opens the room, not the software (addendum 07 §5),
                so the way in is in the site's own nav rather than behind an
                account page. */}
            <Link href="/rooms">Writers Room</Link>
            <Link href="/account">My account</Link>
            {admin ? <Link href="/admin">Admin</Link> : null}
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
    </>
  );
}
