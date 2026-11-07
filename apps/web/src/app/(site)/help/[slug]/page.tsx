import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GROUPS, GUIDES, guideBySlug, guidesIn, type ShotPath } from '@/lib/help';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  return {
    title: `${guide.title} — Help`,
    description: guide.summary,
    alternates: { canonical: `/help/${guide.slug}` },
    openGraph: {
      title: `${guide.title} — VC Writer help`,
      description: guide.summary,
      url: `/help/${guide.slug}`,
      ...(guide.shot ? { images: [{ url: `/${guide.shot}.jpg`, width: 2880, height: 1800 }] } : {}),
    },
  };
}

/**
 * **Bold** and *italic* in a guide's text, and nothing else: the guides are
 * data, not markup. Italic is what the program says in its own words (a
 * placeholder, a status), bold is what to press.
 */
const rich = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((piece, index) => {
    if (piece.startsWith('**') && piece.endsWith('**') && piece.length > 4) return <strong key={index}>{piece.slice(2, -2)}</strong>;
    if (piece.startsWith('*') && piece.endsWith('*') && piece.length > 2) return <em key={index}>{piece.slice(1, -1)}</em>;
    return piece;
  });

const Shot = ({ path, alt }: { path: ShotPath; alt: string }) => (
  <figure className="help-shot">
    <img src={`/${path}.jpg`} alt={alt} width={2880} height={1800} loading="lazy" />
  </figure>
);

/** One guide (addendum 35 §9). */
export default async function GuidePage({ params }: { params: Params | Promise<Params> }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const group = GROUPS.find((one) => one.id === guide.group);
  const siblings = guidesIn(guide.group);
  const related = (guide.related ?? []).map(guideBySlug).filter((one) => one !== undefined);

  return (
    <div className="help-layout">
      <nav className="help-nav" aria-label="Guides">
        <Link href="/help" className="help-nav-home">
          All guides
        </Link>
        {GROUPS.map((one) => (
          <div key={one.id}>
            <p className="help-nav-group">{one.title}</p>
            <ul>
              {guidesIn(one.id).map((item) => (
                <li key={item.slug}>
                  <Link href={`/help/${item.slug}`} aria-current={item.slug === guide.slug ? 'page' : undefined}>
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <article className="help-article">
        <p className="eyebrow">
          <Link href="/help">Help</Link> / {group?.title}
        </p>
        <h1>{guide.title}</h1>
        <p className="help-summary">{guide.summary}</p>
        {guide.shot ? <Shot path={guide.shot} alt={guide.shotAlt ?? guide.title} /> : null}

        {guide.sections.map((section) => (
          <section key={section.heading} className="help-section">
            <h2>{section.heading}</h2>
            {section.body?.map((paragraph, index) => <p key={index}>{rich(paragraph)}</p>)}
            {section.steps ? (
              <ol className="help-steps">
                {section.steps.map((step, index) => (
                  <li key={index}>{rich(step)}</li>
                ))}
              </ol>
            ) : null}
            {section.tip ? <p className="help-tip">{rich(section.tip)}</p> : null}
            {section.shot ? <Shot path={section.shot} alt={section.shotAlt ?? section.heading} /> : null}
          </section>
        ))}

        {related.length > 0 ? (
          <section className="help-section">
            <h2>Read next</h2>
            <ul className="help-related">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link href={`/help/${item.slug}`}>{item.title}</Link> — {item.summary}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="help-foot">
          {siblings.length > 1 ? (
            <>
              More in <Link href={`/help#${guide.group}`}>{group?.title}</Link>.{' '}
            </>
          ) : null}
          Something here does not match what you see? Tell us at{' '}
          <a href="https://vc-software.com/support">vc-software.com/support</a>.
        </p>
      </article>
    </div>
  );
}
