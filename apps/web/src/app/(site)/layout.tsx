import { SiteChrome } from '../site-chrome';

/**
 * Everything that is the *site* — the front page, buying, the account, the
 * rooms, the admin console — wears the header and the footer.
 *
 * A route group changes nothing about any address: `/download` is still
 * `/download`. What it changes is who the chrome belongs to, which is the
 * point: the capture app at `/notes/app` sits outside this group and therefore
 * wears none of it, by where it is in the tree rather than by a condition
 * somebody has to remember to keep true. `/notes` itself is in here, being a
 * page about the app rather than the app (addendum 27 §14.5).
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
