import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EDIT_CREDIT_PACK_IDS, editCreditPack } from '@vcwriter/domain';
import { env } from '@/lib/env';
import { CHECKOUT_API_VERSION, stripe } from '@/lib/stripe';
import { currentUser } from '@/lib/supabase';
import { RULES, rateLimit } from '@/lib/rate-limit';
import { OWN_PRODUCT } from '@/lib/checkout-kind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * **The shape is the permission**: the client names a pack by its id and
 * nothing else. What it costs and what it gives are the domain's
 * (`EDIT_CREDIT_PACKS`), and the credits are written by the webhook once
 * Stripe says the payment went through.
 */
const bodySchema = z.object({ pack: z.enum(EDIT_CREDIT_PACK_IDS) });

/** Start a Stripe Checkout for a pack of edit credits (addendum 47). */
export async function POST(request: Request): Promise<Response> {
  const limited = await rateLimit(request, RULES.checkout);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const pack = parsed.success ? editCreditPack(parsed.data.pack) : null;
  if (!pack) return NextResponse.json({ error: 'Choose a pack of $5, $10 or $20.' }, { status: 400 });

  // Credits belong to an account, so the buyer must be signed in.
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to buy edit credits.' }, { status: 401 });

  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: pack.priceCents,
              tax_behavior: 'exclusive',
              product_data: {
                name: `VC Writer edit credits: ${pack.words.toLocaleString('en-US')} words`,
                description: 'AI deep check of your manuscript. Points out problems; never rewrites.',
              },
            },
          },
        ],
        success_url: `${env.siteUrl}/account?credits=added#edit-credits`,
        cancel_url: `${env.siteUrl}/account#edit-credits`,
        ...(user.email ? { customer_email: user.email } : {}),
        metadata: {
          product: OWN_PRODUCT,
          kind: 'edit-credits',
          pack: pack.id,
          supabase_user_id: user.id,
        },
        payment_intent_data: { metadata: { product: OWN_PRODUCT, kind: 'edit-credits', pack: pack.id } },
        automatic_tax: { enabled: true },
        billing_address_collection: 'auto',
      },
      { apiVersion: CHECKOUT_API_VERSION },
    );
    if (!session.url) return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Checkout could not be started';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
