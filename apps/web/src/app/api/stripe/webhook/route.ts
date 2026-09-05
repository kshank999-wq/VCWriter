import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe';
import { adminClient } from '@/lib/supabase';
import { fulfillCheckout, parsePlatform } from '@/lib/fulfillment';
import { sendPurchaseEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook — the only place a paid entitlement is created (spec §12.2).
 *
 * Order of operations matters:
 *  1. verify the signature, so only Stripe can trigger fulfillment;
 *  2. claim the event id, so a redelivery of an event already handled exits
 *     immediately (§17: one purchase, one license, however many retries);
 *  3. fulfill, which is itself idempotent through unique constraints;
 *  4. email, whose failure is logged but never fails the webhook — a 500 here
 *     would make Stripe retry a purchase that has already been fulfilled.
 */
export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Signature verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const client = adminClient();

  // Claim the event. If the insert loses to an earlier delivery, this is a
  // redelivery: skip it when that delivery finished, and let it through when
  // the earlier attempt failed, which is exactly what Stripe's retry is for.
  const { error: claimError } = await client
    .from('stripe_webhook_events')
    .insert({ id: event.id, type: event.type });
  if (claimError) {
    const { data: seen } = await client
      .from('stripe_webhook_events')
      .select('processed_at')
      .eq('id', event.id)
      .maybeSingle();
    if (seen?.processed_at) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') {
        const email = session.customer_details?.email ?? session.customer_email;
        if (!email) throw new Error(`Checkout session ${session.id} has no customer email`);

        const result = await fulfillCheckout({
          checkoutSessionId: session.id,
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
          customerEmail: email,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          selectedPlatform: parsePlatform(session.metadata?.platform),
          userId: session.metadata?.supabase_user_id || null,
        });

        // Only the first successful fulfillment sends mail; retries stay quiet.
        if (result.created) {
          await sendPurchaseEmail({
            to: email,
            userId: result.userId,
            serial: result.serial,
            platform: parsePlatform(session.metadata?.platform),
          });
        }
      }
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      // Entitlement state must be able to follow the money (§12.2).
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
      if (paymentIntentId) {
        const status = event.type === 'charge.refunded' ? 'refunded' : 'disputed';
        const { data: order } = await client
          .from('orders')
          .update({ status })
          .eq('stripe_payment_intent_id', paymentIntentId)
          .select('id')
          .maybeSingle();
        if (order) {
          await client.from('licenses').update({ status: 'revoked' }).eq('order_id', order.id);
        }
      }
    }

    await client
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', event.id);

    return NextResponse.json({ received: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Fulfillment failed';
    // Record why and leave `processed_at` null, so Stripe's retry re-runs the
    // (idempotent) fulfillment rather than being turned away as a duplicate.
    await client.from('stripe_webhook_events').update({ error: message }).eq('id', event.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
