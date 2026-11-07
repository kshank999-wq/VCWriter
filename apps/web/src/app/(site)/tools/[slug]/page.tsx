import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TOOL_PAGES, toolBySlug } from '@/lib/tools';
import { ToolChooser } from '../../tool-chooser';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return TOOL_PAGES.map((tool) => ({ slug: tool.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const tool = toolBySlug((await params).slug);
  if (!tool) return {};
  return {
    title: tool.name,
    description: tool.intro,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: `${tool.name} — VC Writer`,
      description: tool.intro,
      url: `/tools/${tool.slug}`,
      images: [{ url: `/${tool.shot}.jpg`, width: 2880, height: 1800, alt: tool.shotAlt }],
    },
    twitter: { card: 'summary_large_image', title: `${tool.name} — VC Writer`, description: tool.intro, images: [`/${tool.shot}.jpg`] },
  };
}

const Shot = ({ src, alt }: { src: string; alt: string }) => (
  <figure className="feature-band-shot">
    <img src={`/${src}.jpg`} width={2880} height={1800} alt={alt} loading="lazy" />
  </figure>
);

/**
 * A room or tool, promoted on a page of its own (addendum 35 §11): what it
 * does, in the program's own pictures, with its guide one press away.
 */
export default async function ToolPage({ params }: { params: Params | Promise<Params> }) {
  const tool = toolBySlug((await params).slug);
  if (!tool) notFound();
  const pictured = tool.features.filter((feature) => feature.shot);
  const plain = tool.features.filter((feature) => !feature.shot);

  return (
    <>
      <div className="hero module-hero">
        <p className="eyebrow">
          <Link href="/#tools">Rooms and tools</Link> / {tool.name}
        </p>
        <h1>{tool.headline}</h1>
        <p>{tool.intro}</p>
        <Link href="/download" className="button">
          Buy &amp; download
        </Link>{' '}
        <Link href={`/help/${tool.guide}`} className="button secondary">
          Read the guide
        </Link>
      </div>

      <Shot src={tool.shot} alt={tool.shotAlt} />

      {pictured.map((feature, index) => (
        <section key={feature.title}>
          <div className="layout-split">
            {index % 2 === 0 ? (
              <>
                <div>
                  <h2>{feature.title}</h2>
                  <p>{feature.body}</p>
                </div>
                <Shot src={feature.shot!} alt={feature.shotAlt ?? feature.title} />
              </>
            ) : (
              <>
                <Shot src={feature.shot!} alt={feature.shotAlt ?? feature.title} />
                <div>
                  <h2>{feature.title}</h2>
                  <p>{feature.body}</p>
                </div>
              </>
            )}
          </div>
        </section>
      ))}

      {plain.length > 0 ? (
        <section>
          <div className="grid two-up">
            {plain.map((feature) => (
              <article key={feature.title} className="card">
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2>The other rooms</h2>
        <p className="lede">Every room comes with every module, in one purchase, on Windows and macOS.</p>
        <ToolChooser current={tool.slug} />
      </section>
    </>
  );
}
