import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DISCOUNT_REFUSAL, isRedeemable, PLANS, platformSchema } from '@vcwriter/domain';
import { env } from '@/lib/env';
import { findDiscount } from '@/lib/discounts';
import { priceIdFor } from '@/lib/pricing';
import { stripe } from '@/lib/stripe';
import { currentUser } from '@/lib/supabase';
import { RULES, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  /** Windows or Mac, chosen before payment (spec §3.2). */
  platform: platformSchema,
  email: z.string().email().optional(),
  /**
   * A discount code, typed or carried in from an advertisement's link
   * (addendum 31). **The shape is the permission**: this is the *word*, and
   * there is no field here for a percentage, an amount, a coupon or a
   * promotion-code id, so a client that decided what its own discount was has
   * nowhere to put it. The server asks Stripe what the word is worth.
   */
  code: z.string().max(64).optional(),
  /**
   * Which plan (addendum 32). **The shape is the permission** a fifth time:
   * this is the *word* `monthly` or `yearly`, and there is no field here for a
   * price id, an amount or an interval, so a client that decided what it was
   * going to pay has nowhere to put it. The server turns the word into a price.
   */
  plan: z.enum(PLANS).default('monthly'),
});

/**
 * Start a Stripe Checkout session.
 *
 * Price and entitlement are decided server-side; the client only names the
 * platform it wants. Nothing here grants anything — the license is issued by
 * the webhook once Stripe confirms payment (§12.2).
 */
export async function POST(request: Request): Promise<Response> {
  const limited = await rateLimit(request, RULES.checkout);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A platform of "windows" or "macos" is required' }, { status: 400 });
  }

  const user = await currentUser();
  const email = user?.email ?? parsed.data.email;

  // Resolved here and never trusted from the client. A code that is not
  // redeemable is refused rather than quietly dropped: somebody who followed
  // an advertisement and is charged full price without being told has been
  // overcharged as far as they are concerned.
  const offer = parsed.data.code ? await findDiscount(parsed.data.code) : null;
  if (parsed.data.code && (!offer || !isRedeemable(offer, new Date()))) {
    return NextResponse.json({ error: DISCOUNT_REFUSAL }, { status: 400 });
  }

  try {
    const session = await stripe().checkout.sessions.create({
      // A subscription since addendum 32. The licence is still issued by the
      // webhook on `checkout.session.completed` exactly as it was — what
      // changed is that the same event now also carries a subscription id and
      // a period end, and that renewals arrive afterwards as their own events.
      mode: 'subscription',
      line_items: [{ price: priceIdFor(parsed.data.plan), quantity: 1 }],
      success_url: `${env.siteUrl}/purchase/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/download?cancelled=1`,
      ...(email ? { customer_email: email } : {}),
      // Read back by the webhook; the platform choice is recorded on the order.
      metadata: {
        platform: parsed.data.platform,
        supabase_user_id: user?.id ?? '',
        plan: parsed.data.plan,
      },
      // **A subscription says what it is for.** Both the desktop plans and the
      // Writers Room seats arrive at one webhook as `customer.subscription.*`,
      // and the handler must never guess which: a seat carries `room_id` and a
      // desktop subscription carries this, so one that says neither is left
      // alone rather than written somewhere.
      subscription_data: {
        metadata: {
          kind: 'desktop',
          supabase_user_id: user?.id ?? '',
          plan: parsed.data.plan,
        },
      },
      // **Stripe refuses both at once**, which is the API's own rule and not a
      // choice made here: a session carrying `discounts` may not also offer the
      // box. That is the right way round anyway — somebody who arrived with a
      // code should not be shown an empty field asking for one — so the box is
      // offered to everybody else.
      ...(offer
        ? { discounts: [{ promotion_code: offer.promotionCodeId }] }
        : { allow_promotion_codes: true }),
      // Software sold internationally attracts VAT and sales tax. Stripe works
      // out what is owed where, which is not a calculation to reimplement —
      // Stripe Tax is on, and it applies from here.
      automatic_tax: { enabled: true },
      // **Required rather than `auto`, because this is a subscription.** A
      // single charge can be rated from the browser's own location and nothing
      // is lost; a subscription is re-rated at every renewal from the address
      // **saved on the Customer**, and one saved without an address leaves
      // every renewal invoice stuck in draft — the subscription active, the
      // card never charged, and nothing anywhere reporting it. No
      // `customer_update` here on purpose: this session names an email rather
      // than an existing customer, so Checkout makes the Customer and writes
      // the collected address onto it, and Stripe refuses the field without a
      // `customer`.
      billing_address_collection: 'required',
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Checkout could not be started';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
