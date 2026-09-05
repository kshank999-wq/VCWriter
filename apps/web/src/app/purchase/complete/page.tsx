import type { Metadata } from 'next';
import Link from 'next/link';
import { parsePlatform } from '@/lib/fulfillment';
import { stripe } from '@/lib/stripe';
import { adminClient } from '@/lib/supabase';
import { DownloadButton } from '@/app/account/download-button';

export const metadata: Metadata = { title: 'Purchase complete' };
export const dynamic = 'force-dynamic';

/**
 * Immediate post-payment screen (spec §3.2, §12.4).
 *
 * The license is issued by the webhook, which may land a second or two after
 * the redirect. This page therefore reads what exists and tells the customer
 * plainly when it is still on its way — it never fabricates a license or
 * grants a download the server has not authorised.
 */
export default async function PurchaseCompletePage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  if (!sessionId) {
    return (
      <div className="hero">
        <h1>Purchase complete</h1>
        <p>
          Your license is in your account. <Link href="/account">Go to downloads</Link>.
        </p>
      </div>
    );
  }

  const session = await stripe().checkout.sessions.retrieve(sessionId);
  const platform = parsePlatform(session.metadata?.platform);

  const { data: order } = await adminClient()
    .from('orders')
    .select('id')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();

  const { data: license } = order
    ? await adminClient().from('licenses').select('serial').eq('order_id', order.id).maybeSingle()
    : { data: null };

  return (
    <>
      <div className="hero">
        <h1>Thank you — your purchase is complete</h1>
        <p>We have emailed your license and download link to {session.customer_details?.email ?? 'your address'}.</p>
      </div>

      <section>
        {license ? (
          <>
            <h2>Your license</h2>
            <p className="serial">{license.serial}</p>
          </>
        ) : (
          <p className="notice">
            Your payment went through. The license is being issued now — refresh this page in a moment, or open{' '}
            <Link href="/account">My account</Link>, where it will appear.
          </p>
        )}
      </section>

      {platform ? (
        <section>
          <h2>Download for {platform === 'windows' ? 'Windows 10 / 11' : 'macOS'}</h2>
          <DownloadButton platform={platform} />
        </section>
      ) : null}

      <section>
        <p className="lede">
          You can sign in at any time to re-download the current Windows or macOS build.
        </p>
        <Link href="/account" className="button secondary">
          Go to my account
        </Link>
      </section>
    </>
  );
}
