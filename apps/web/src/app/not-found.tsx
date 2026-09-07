import Link from 'next/link';

/**
 * Without this, Next renders its default not-found page — white background,
 * its own type — inside the site's dark header and footer. A customer who
 * mistypes a link should still be on the same site.
 */
export default function NotFound() {
  return (
    <div className="hero">
      <h1>Page not found</h1>
      <p>There is nothing at this address. It may have moved, or the link may have been copied incompletely.</p>
      <Link href="/" className="button">
        Back to the front page
      </Link>
    </div>
  );
}
