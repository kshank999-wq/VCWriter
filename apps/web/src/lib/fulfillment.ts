import type { SupabaseClient } from '@supabase/supabase-js';
import { platformSchema, type Platform } from '@vcwriter/domain';
import { adminClient } from './supabase';
import { generateSerial } from './license';

/**
 * Turning a paid Stripe checkout into an entitlement (spec §12.2, §12.4, §17).
 *
 * Stripe delivers webhooks at least once, so this whole path is written to be
 * idempotent: a retry of the same event must end with exactly one order and
 * exactly one license. Two database constraints do the real work —
 * `orders.stripe_checkout_session_id` is unique and `licenses.order_id` is
 * unique — so concurrent retries collide in Postgres rather than racing in
 * application code.
 */

export interface FulfillmentInput {
  checkoutSessionId: string;
  paymentIntentId: string | null;
  stripeCustomerId: string | null;
  customerEmail: string;
  amountCents: number;
  currency: string;
  /** Platform chosen at checkout; recorded for support/analytics (§3.2). */
  selectedPlatform: Platform | null;
  /** Present when the buyer was signed in when they started checkout. */
  userId: string | null;
}

export interface FulfillmentResult {
  userId: string;
  orderId: string;
  licenseId: string;
  serial: string;
  /** False when a retry found the license already present. */
  created: boolean;
}

export const parsePlatform = (value: unknown): Platform | null => {
  const result = platformSchema.safeParse(value);
  return result.success ? result.data : null;
};

/**
 * Resolve the buyer to an account. A purchase must never be stranded because
 * the buyer checked out without signing in first, so an account is created for
 * that email if one does not exist; the confirmation email then carries a
 * sign-in link (§12.3).
 */
const resolveUserId = async (client: SupabaseClient, input: FulfillmentInput): Promise<string> => {
  if (input.userId) return input.userId;

  const email = input.customerEmail.trim().toLowerCase();
  const { data: created, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { source: 'stripe_checkout' },
  });
  if (!error && created.user) return created.user.id;

  // Already registered: look the account up instead of failing the purchase.
  const { data: existing, error: lookupError } = await client
    .from('profiles')
    .select('id')
    .eq('id', created?.user?.id ?? '')
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: list, error: listError } = await client.auth.admin.listUsers();
  if (listError) throw new Error(`Could not resolve buyer account: ${listError.message}`);
  const match = list.users.find((user) => user.email?.toLowerCase() === email);
  if (!match) {
    throw new Error(`Could not create or find an account for ${email}: ${error?.message ?? lookupError?.message ?? 'unknown error'}`);
  }
  return match.id;
};

export const fulfillCheckout = async (input: FulfillmentInput): Promise<FulfillmentResult> => {
  const client = adminClient();
  const userId = await resolveUserId(client, input);

  // Upsert on the unique checkout session id: a replayed webhook updates the
  // same row instead of inserting a duplicate order.
  const { data: order, error: orderError } = await client
    .from('orders')
    .upsert(
      {
        user_id: userId,
        status: 'paid',
        selected_platform: input.selectedPlatform,
        amount_cents: input.amountCents,
        currency: input.currency,
        stripe_checkout_session_id: input.checkoutSessionId,
        stripe_payment_intent_id: input.paymentIntentId,
        stripe_customer_id: input.stripeCustomerId,
        paid_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_checkout_session_id' },
    )
    .select('id')
    .single();
  if (orderError || !order) {
    throw new Error(`Could not record order for session ${input.checkoutSessionId}: ${orderError?.message}`);
  }

  const existing = await client
    .from('licenses')
    .select('id, serial')
    .eq('order_id', order.id)
    .maybeSingle();
  if (existing.data) {
    return {
      userId,
      orderId: order.id,
      licenseId: existing.data.id,
      serial: existing.data.serial,
      created: false,
    };
  }

  const { data: license, error: licenseError } = await client
    .from('licenses')
    .insert({
      user_id: userId,
      order_id: order.id,
      serial: generateSerial(),
      status: 'active',
      // §18 keeps this configurable; today one purchase covers both installers.
      entitled_platforms: ['windows', 'macos'],
    })
    .select('id, serial')
    .single();

  if (licenseError) {
    // A concurrent retry won the unique(order_id) race — read its license.
    const { data: raced } = await client
      .from('licenses')
      .select('id, serial')
      .eq('order_id', order.id)
      .maybeSingle();
    if (raced) {
      return { userId, orderId: order.id, licenseId: raced.id, serial: raced.serial, created: false };
    }
    throw new Error(`Could not issue license for order ${order.id}: ${licenseError.message}`);
  }

  return { userId, orderId: order.id, licenseId: license.id, serial: license.serial, created: true };
};
