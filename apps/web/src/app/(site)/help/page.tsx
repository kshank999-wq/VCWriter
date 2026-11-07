import type { Metadata } from 'next';
import Link from 'next/link';
import { GROUPS, guidesIn } from '@/lib/help';

export const metadata: Metadata = {
  title: 'Help',
  description: 'Guides to VC Writer: getting started, each module, and every room — with screenshots of the program itself.',
  alternates: { canonical: '/help' },
};

/** The help centre's front page: every guide, by group (addendum 35 §9). */
export default function HelpIndex() {
  return (
    <>
      <div className="hero">
        <h1>Help</h1>
        <p>
          Short guides to VC Writer, with pictures of the program itself. In the program, <strong>Help ▸ Guide for this
          screen</strong> (F1) opens the guide for whatever you are looking at.
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.id} id={group.id}>
          <h2>{group.title}</h2>
          <p className="lede">{group.lede}</p>
          <div className="help-cards">
            {guidesIn(group.id).map((guide) => (
              <Link key={guide.slug} href={`/help/${guide.slug}`} className="help-card">
                {guide.shot ? <img src={`/${guide.shot}.jpg`} alt="" width={2880} height={1800} loading="lazy" /> : null}
                <span className="help-card-text">
                  <strong>{guide.title}</strong>
                  <span>{guide.summary}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
