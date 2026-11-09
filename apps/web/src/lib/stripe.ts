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
