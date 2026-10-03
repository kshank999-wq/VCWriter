import type { Metadata } from 'next';
import { DISCOUNT_PARAM } from '@vcwriter/domain';
import { fetchDisplayPrice } from '@/lib/pricing';
import { PlatformChoice } from './platform-choice';

export const metadata: Metadata = {
  title: 'Buy & download',
  description: 'Buy VC Writer and download the Windows 10/11 or macOS installer.',
};

// The price comes from Stripe on each render rather than being baked into the
// build, so changing it there changes it here.
export const dynamic = 'force-dynamic';

/**
 * Purchase-time platform choice (spec §3.2): the buyer must be able to pick
 * Windows or Mac without contacting support, and the choice is recorded with
 * the order.
 */
export default async function DownloadPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const price = await fetchDisplayPrice();
  // A code carried in from an advertisement (addendum 31). The page hands it
  // to the control, which asks the shop what it is worth; nothing is decided
  // here, and a code that is no good simply does not change the price.
  const asked = (await searchParams)?.[DISCOUNT_PARAM];
  const code = (Array.isArray(asked) ? asked[0] : asked)?.trim() || null;

  return (
    <>
      <div className="hero">
        <h1>Buy VC Writer</h1>
        <p>
          {price ? (
            <>
              <strong>{price.formatted}</strong>
              {price.recurring ? ' a year' : ' once'} — for Windows and macOS both. Pick the platform you want to
              install on now; your license covers the other, so you can switch later.
            </>
          ) : (
            'Pick the platform you want to install on. Your license covers both, so you can switch later.'
          )}
        </p>
      </div>
      <PlatformChoice advertisedCode={code} />
    </>
  );
}
