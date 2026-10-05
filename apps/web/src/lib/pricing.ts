import { formatPrice, PLANS, planWords, type SubscriptionPlan, yearlySaving } from '@vcwriter/domain';
import { env } from './env';
import { stripe } from './stripe';

/**
 * The prices, read from Stripe rather than repeated in the code (spec §12.2).
 *
 * Stripe is where the price actually lives — it is what the customer is
 * charged — so the store reads it from there. A second copy in a constant is a
 * copy that will eventually disagree with the till, and the version customers
 * see would be the wrong one. That rule is why **the figures Ken named do not
 * appear anywhere in this repository**: changing a plan's price is a minute in
 * the Stripe dashboard and nothing here moves.
 */

export interface DisplayPrice {
  amountCents: number;
  currency: string;
  formatted: string;
  /** True for a subscription. Both desktop plans are, since addendum 32. */
  recurring: boolean;
}

export interface PlanPrice extends DisplayPrice {
  plan: SubscriptionPlan;
  label: string;
  per: string;
  /** Whole percent off against twelve months, read rather than typed. */
  savingPercent: number | null;
}

/**
 * Re-exported rather than written here: the formatter is the domain's, so a
 * screen that only wants to write `$10` can have it without this module's
 * Stripe client coming with it into the browser.
 */
export { formatPrice };

export const priceIdFor = (plan: SubscriptionPlan): string =>
  plan === 'monthly' ? env.stripeMonthlyPriceId : env.stripeYearlyPriceId;

const readOne = async (plan: SubscriptionPlan): Promise<DisplayPrice | null> => {
  const price = await stripe().prices.retrieve(priceIdFor(plan));
  if (!price.unit_amount || !price.currency) return null;
  return {
    amountCents: price.unit_amount,
    currency: price.currency,
    formatted: formatPrice(price.unit_amount, price.currency),
    recurring: price.type === 'recurring',
  };
};

/**
 * Both plans, or an empty list.
 *
 * Returns nothing rather than throwing when Stripe is not configured, so the
 * marketing pages still render on a deployment without keys — the price simply
 * appears at checkout instead. **A plan Stripe cannot answer for is left out
 * rather than drawn without a figure**, which is addendum 27 §14's rule (a
 * plan the shop has never heard of is absent rather than offered at a price
 * the page made up).
 */
export const fetchPlanPrices = async (): Promise<PlanPrice[]> => {
  let monthly: DisplayPrice | null = null;
  let yearly: DisplayPrice | null = null;
  try {
    [monthly, yearly] = await Promise.all([readOne('monthly'), readOne('yearly')]);
  } catch {
    return [];
  }

  const found: Record<SubscriptionPlan, DisplayPrice | null> = { monthly, yearly };
  const saving =
    monthly && yearly
      ? yearlySaving(monthly.amountCents, yearly.amountCents, monthly.currency, yearly.currency)
      : null;

  return PLANS.flatMap((plan) => {
    const price = found[plan];
    if (!price) return [];
    const words = planWords(plan);
    return [{ ...price, plan, label: words.label, per: words.per, savingPercent: plan === 'yearly' ? saving : null }];
  });
};
