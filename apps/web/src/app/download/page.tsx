import type { Metadata } from 'next';
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
export default async function DownloadPage() {
  const price = await fetchDisplayPrice();

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
      <PlatformChoice />
    </>
  );
}
