import Link from 'next/link';
import { SiteChrome } from './site-chrome';

/**
 * Without this, Next renders its default not-found page — white background,
 * its own type — and a customer who mistypes a link is suddenly nowhere.
 *
 * It wears the chrome by asking for it, because it sits at the root of the
 * tree rather than inside the `(site)` group: an address that matched nothing
 * could have been meant as any page of the site, so the way back should be in
 * the nav where it always is.
 */
export default function NotFound() {
  return (
    <SiteChrome>
      <div className="hero">
        <h1>Page not found</h1>
        <p>There is nothing at this address. It may have moved, or the link may have been copied incompletely.</p>
        <Link href="/" className="button">
          Back to the front page
        </Link>
      </div>
    </SiteChrome>
  );
}
