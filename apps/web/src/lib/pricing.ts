import { env } from './env';
import { stripe } from './stripe';

/**
 * The price, read from Stripe rather than repeated in the code (spec §12.2).
 *
 * Stripe is where the price actually lives — it is what the customer is
 * charged — so the store reads it from there. A second copy in a constant is a
 * copy that will eventually disagree with the till, and the version customers
 * see would be the wrong one.
 */

export interface DisplayPrice {
  amountCents: number;
  currency: string;
  formatted: string;
  /** True for a subscription; today's product is a one-off purchase. */
  recurring: boolean;
}

export const formatPrice = (amountCents: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    // Whole amounts read better without trailing zeros on a marketing page.
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);

/**
 * Returns null rather than throwing when Stripe is not configured, so the
 * marketing pages still render on a deployment without keys — the price simply
 * appears at checkout instead.
 */
export const fetchDisplayPrice = async (): Promise<DisplayPrice | null> => {
  try {
    const price = await stripe().prices.retrieve(env.stripePriceId);
    if (!price.unit_amount || !price.currency) return null;

    return {
      amountCents: price.unit_amount,
      currency: price.currency,
      formatted: formatPrice(price.unit_amount, price.currency),
      recurring: price.type === 'recurring',
    };
  } catch {
    return null;
  }
};
