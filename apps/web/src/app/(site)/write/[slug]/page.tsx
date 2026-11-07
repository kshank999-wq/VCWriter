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
  return {
    title: `${formatName(page.format)} — VC Writer`,
    description: page.intro,
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
