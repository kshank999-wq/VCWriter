import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe';
import { adminClient, currentUser } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * **The desktop subscription's billing page** (addendum 41 §4; addendum 32 §7
 * named it as the next thing to build).
 *
 * Changing the card, moving between monthly and yearly, cancelling and the
 * receipts are Stripe's Customer Portal — the room's seat subscription has
 * used it since addendum 07, and a copy here would be a worse one that has to
 * be kept in step with tax law. This route only finds whose customer the
 * signed-in writer is and asks Stripe for a portal session.
 *
 * The customer is read from the writer's own paid orders, which fulfilment
 * has written since the first sale; nothing is taken from the request, so a
 * writer can only ever open their own billing.
 */
export async function POST(): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { data: order, error } = await adminClient()
    .from('orders')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .eq('status', 'paid')
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Your orders could not be read.' }, { status: 500 });
  const customer = order?.stripe_customer_id as string | null | undefined;
  if (!customer) {
    return NextResponse.json({ error: 'There is no subscription on this account to manage.' }, { status: 404 });
  }

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer,
      return_url: `${env.siteUrl}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Billing could not be opened.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
