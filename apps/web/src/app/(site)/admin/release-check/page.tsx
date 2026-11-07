import type { Metadata } from 'next';
import { currentAdmin } from '@/lib/admin';
import { GROUPS, guidesIn } from '@/lib/help';
import { AdminGate } from '../_components/gate';
import { ReleaseChecklist, type CheckGuide } from './checklist';

export const metadata: Metadata = { title: 'Release check' };
export const dynamic = 'force-dynamic';

/**
 * The release check (addendum 35 §9, step 11 of the plan): before a release,
 * walk every guide on a clean Windows machine and a clean Mac and tick each
 * step that does what the guide says. A step that does not is a fault in the
 * program or in the guide, and one of them is changed before release.
 *
 * Read from the guides themselves, so the check can never be of an older
 * guide than the one on the site.
 */
export default async function ReleaseCheckPage() {
  const admin = await currentAdmin();
  if (!admin) return <AdminGate title="Release check" next="/admin/release-check" />;

  const groups = GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    guides: guidesIn(group.id).map(
      (guide): CheckGuide => ({
        slug: guide.slug,
        title: guide.title,
        steps: guide.sections.flatMap((section) =>
          (section.steps ?? []).map((step, index) => ({ id: `${guide.slug}:${section.heading}:${index}`, section: section.heading, text: step })),
        ),
      }),
    ),
  }));

  return (
    <>
      <div className="hero">
        <h1>Release check</h1>
        <p>
          On a clean Windows machine and a clean Mac, with the installer about to ship, follow each guide&rsquo;s steps
          and tick the ones that work exactly as written. Anything that does not is fixed — in the program or in the
          guide — before the release. Ticks are kept in this browser.
        </p>
      </div>
      <ReleaseChecklist groups={groups} />
    </>
  );
}
