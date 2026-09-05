import Stripe from 'stripe';
import { env } from './env';

let cached: Stripe | null = null;

export const stripe = (): Stripe => {
  if (!cached) {
    // Pin the API version so a Stripe-side default change cannot alter
    // webhook payloads under a deployed build.
    cached = new Stripe(env.stripeSecretKey, { apiVersion: '2025-02-24.acacia' });
  }
  return cached;
};
