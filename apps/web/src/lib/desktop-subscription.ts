import type Stripe from 'stripe';
import { licenseStatusForSubscription } from '@vcwriter/domain';
import { adminClient } from './supabase';

/**
 * Carrying Stripe's word about a desktop subscription onto the licence
 * (addendum 32).
 *
 * **This is the whole of what a renewal does.** A subscription renews every
 * month or every year, and if each renewal made an order and a licence a
 * writer would collect twelve serials a year — so a renewal finds the licence
 * it already has by `stripe_subscription_id` and moves two fields: the status,
 * and the date it is paid up to.
 *
 * Both are Stripe's answer rather than arithmetic done here. The period end is
 * read off the subscription every time it speaks, so a plan changed from
 * monthly to yearly in the customer portal needs no case of its own: Stripe
 * sends an update and the new date is simply what it says.
 */
export const recordDesktopSubscription = async (subscription: Stripe.Subscription): Promise<void> => {
  const db = adminClient();

  const patch = {
    status: licenseStatusForSubscription(subscription.status),
    expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
  };

  // No row is not a failure. **The first event can beat the checkout** —
  // Stripe may send `customer.subscription.created` before
  // `checkout.session.completed`, and there is then no licence to move, which
  // the session's own event fixes a moment later by writing the subscription
  // id and the period end itself. Making a licence from a subscription alone
  // would be a second way for an entitlement to be born, and two of those is
  // how somebody ends up with two.
  await db
    .from('licenses')
    .update(patch)
    .eq('stripe_subscription_id', subscription.id);
};
