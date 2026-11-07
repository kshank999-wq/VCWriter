import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatName } from '@vcwriter/domain';
import { MODULE_PAGES, moduleBySlug } from '@/lib/modules';
import { ModuleChooser } from '../../module-chooser';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return MODULE_PAGES.map((page) => ({ slug: page.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params | Promise<Params> }): Promise<Metadata> {
  const page = moduleBySlug((await params).slug);
  if (!page) return {};
  const name = formatName(page.format);
  const picture = `/modules/${page.slug}.jpg`;
  return {
    title: name,
    description: page.intro,
    alternates: { canonical: `/write/${page.slug}` },
    openGraph: {
      title: `${name} — VC Writer`,
      description: page.intro,
      url: `/write/${page.slug}`,
      type: 'website',
      images: [{ url: picture, width: 2880, height: 1800, alt: `VC Writer with a ${name.toLowerCase()} project open` }],
    },
    twitter: { card: 'summary_large_image', title: `${name} — VC Writer`, description: page.intro, images: [picture] },
  };
}

/**
 * A module's promotion page: what the card on the front page opens.
 *
 * The chooser stays along the bottom so a visitor can move from one module to
 * the next without going back to the front page.
 */
export default async function ModulePage({ params }: { params: Params | Promise<Params> }) {
  const page = moduleBySlug((await params).slug);
  if (!page) notFound();

  return (
    <>
      <div className="hero module-hero">
        <p className="eyebrow">
          <Link href="/#modules">Modules</Link> / {formatName(page.format)}
        </p>
        <h1>{page.headline}</h1>
        <p>{page.intro}</p>
        <Link href="/download" className="button">
          Buy &amp; download
        </Link>
      </div>

      {/* The program itself, with a demo project of this kind open. Taken by
          scripts/module-shots/capture.mjs, which is rerun when a screen changes. */}
      <figure className="module-shot">
        <img
          src={`/modules/${page.slug}.jpg`}
          width={2880}
          height={1800}
          alt={`VC Writer with a ${formatName(page.format).toLowerCase()} project open`}
          loading="eager"
        />
      </figure>

      <section>
        <h2>Why it works</h2>
        <div className="grid two-up">
          {page.strengths.map((strength) => (
            <article key={strength.title} className="card">
              <h3>{strength.title}</h3>
              <p>{strength.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>What comes with it</h2>
        <ul className="module-rooms">
          {page.rooms.map((room) => (
            <li key={room}>{room}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Other modules</h2>
        <p className="lede">One purchase includes every module, on Windows and macOS.</p>
        <ModuleChooser current={page.slug} />
      </section>
    </>
  );
}
