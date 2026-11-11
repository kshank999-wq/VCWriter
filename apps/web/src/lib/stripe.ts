import Stripe from 'stripe';
import { env } from './env';

let cached: Stripe | null = null;

/**
 * The API version a **Checkout Session** is created in.
 *
 * The account sells through Stripe Managed Payments, and Stripe refuses to
 * create a Checkout Session for it in any version before `2025-03-31.basil`
 * (*"Managed Payments is not supported on API version 2025-02-24.acacia"*,
 * found when the first Writers Room checkout was tried). Only the session's
 * creation is moved forward, per request: everything else, the webhook
 * payloads included, stays on the pinned version below, because `basil`
 * moved fields this code reads (a subscription's period end among them).
 */
export const CHECKOUT_API_VERSION = '2025-03-31.basil';

export const stripe = (): Stripe => {
  if (!cached) {
    // Pin the API version so a Stripe-side default change cannot alter
    // webhook payloads under a deployed build.
    cached = new Stripe(env.stripeSecretKey, { apiVersion: '2025-02-24.acacia' });
  }
  return cached;
};

/**
 * When a subscription's current period ends, as an ISO date, or null.
 *
 * **Where Stripe keeps it depends on the API version.** Up to 2025-03-31 it
 * was `current_period_end` on the subscription; from the basil versions on it
 * moved to each subscription item. A webhook endpoint sends events in its own
 * API version, so the site reads both: the subscription's own field where
 * there is one, otherwise the latest end among its items. A missing date is
 * null rather than an "Invalid time value" that fails the whole event.
 */
export const subscriptionPeriodEnd = (subscription: Stripe.Subscription): string | null => {
  const own = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const items = (subscription.items?.data ?? [])
    .map((item) => (item as unknown as { current_period_end?: number }).current_period_end)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const seconds = typeof own === 'number' && Number.isFinite(own) ? own : items.length > 0 ? Math.max(...items) : null;
  return seconds === null ? null : new Date(seconds * 1000).toISOString();
};
