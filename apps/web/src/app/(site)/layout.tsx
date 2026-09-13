import { SiteChrome } from '../site-chrome';

/**
 * Everything that is the *site* — the front page, buying, the account, the
 * rooms, the admin console — wears the header and the footer.
 *
 * A route group changes nothing about any address: `/download` is still
 * `/download`. What it changes is who the chrome belongs to, which is the
 * point: `/notes` sits outside this group and therefore outside the nav, by
 * where it is in the tree rather than by a condition somebody has to remember
 * to keep true.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
