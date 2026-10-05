import { licenseLive } from './entities/commerce.js';
import type { License, LicenseStatus } from './entities/commerce.js';

/**
 * The desktop subscription (addendum 32).
 *
 * VC Writer was a one-off purchase from the first migration: an `orders` row, a
 * `licenses` row beside it, and an entitlement that never ended. It is two
 * recurring plans now, and **the audit is most of why this file is short**:
 * four of the things a subscription needs were already standing.
 *
 *  - `license_status` has had **`expired`** since 0002 and nothing has ever
 *    written it.
 *  - `licenses.expires_at` has been a column since 0002 and nothing has ever
 *    written it.
 *  - The webhook has handled `customer.subscription.created/updated/deleted`
 *    since the Writers Room seat shipped.
 *  - `DisplayPrice.recurring` has been read off Stripe since `pricing.ts` was
 *    written.
 *
 * So **a subscription is not a second kind of entitlement**: it is the licence
 * this program already has, with its expiry finally written down. Every gate
 * in the application asks `license.status` — `decideActivation`,
 * `canDownloadPlatform`, the download route, the account page, the admin
 * console — so pointing a lapse at that one field carries it everywhere with
 * nothing else told, which is the twenty-seventh time the general mechanism
 * turned out to be there already and merely narrow in vocabulary.
 *
 * **There are no prices in this file.** `pricing.ts`'s rule is that Stripe is
 * where the price lives because Stripe is what charges the customer, and a
 * second copy in a constant is one that eventually disagrees with the till.
 * What a plan costs is read; what a plan *is* lives here.
 */

/** The two plans. A word the client may say, never an amount it may name. */
export const PLANS = ['monthly', 'yearly'] as const;
export type SubscriptionPlan = (typeof PLANS)[number];

export const isPlan = (said: string): said is SubscriptionPlan =>
  (PLANS as readonly string[]).includes(said);

/** What each plan is called where a writer chooses one. */
export const planWords = (plan: SubscriptionPlan): { label: string; per: string } =>
  plan === 'monthly'
    ? { label: 'Monthly', per: 'per month' }
    : { label: 'Yearly', per: 'per year' };

/**
 * What the yearly plan saves, as a whole percent, or null.
 *
 * **A reading rather than a claim typed on the page**: the two prices are
 * Stripe's, so if the yearly price changes the badge changes with it and
 * nobody has to remember. Null where the saving is nothing or the figures
 * cannot be compared — a *Save 0%* badge is worse than none, and two
 * currencies cannot be subtracted (`priceWith`'s own refusal).
 */
export const yearlySaving = (
  monthlyCents: number,
  yearlyCents: number,
  monthlyCurrency: string,
  yearlyCurrency: string,
): number | null => {
  if (monthlyCurrency.toLowerCase() !== yearlyCurrency.toLowerCase()) return null;
  const twelve = monthlyCents * 12;
  if (twelve <= 0 || yearlyCents >= twelve) return null;
  const percent = Math.round(((twelve - yearlyCents) / twelve) * 100);
  return percent > 0 ? percent : null;
};

/**
 * Stripe's subscription statuses, and which of them entitle.
 *
 * It is `appleState`'s rule on a third shop (addendum 09 §14, addendum 27
 * §14): **a word this build has never heard of is not a reason to hand
 * anything over**, so the entitling ones are named and everything else —
 * `canceled`, `unpaid`, `paused`, `incomplete`, and whatever Stripe adds next
 * — reads as lapsed.
 *
 * **`past_due` entitles, deliberately.** It means the latest invoice failed
 * and Stripe is still retrying, which is overwhelmingly an expired card rather
 * than somebody leaving; taking the program away on the first failed retry
 * punishes the commonest and most innocent case, and is the thing addendum 07
 * §23 refused for a room (*a showrunner reading a payment failure is at the
 * worst moment to be guessing*). Stripe stops retrying soon enough and the
 * subscription then says `canceled` or `unpaid`, which do not entitle.
 */
const ENTITLING = new Set(['active', 'trialing', 'past_due']);

export const subscriptionEntitles = (stripeStatus: string): boolean => ENTITLING.has(stripeStatus);

/** What the licence's own status becomes when Stripe says this. */
export const licenseStatusForSubscription = (stripeStatus: string): LicenseStatus =>
  subscriptionEntitles(stripeStatus) ? 'active' : 'expired';

/**
 * What a lapse reaches, said once.
 *
 * **`LAPSE_PROMISE` was taken** — it is the Writers Room's, about a room that
 * stops taking seats — and this is the fourth time a name already spoken for
 * has forced a new word here (`origin` taken so a moment is `found`,
 * `Standing` taken so a node's is a `Situation`, `code` taken so the discount
 * parameter is `discount`). The typecheck passed over the clash and the page
 * would not render: a star re-export conflict is a runtime fault, so **only
 * driving it found this**.
 *
 * It is that promise's shape (addendum 27 §14) pointed at the desktop,
 * and it is a **description of what the program already does** rather than a
 * new rule: an activated copy keeps opening, reading, printing and exporting
 * every project on the disk, because nothing local has ever asked the server
 * for permission to write a word. What a lapse stops is taking a **new**
 * machine (`decideActivation` refuses a licence that is not active) and the
 * features that ask vc-writer.com for themselves — the installers, the Final
 * Editor's read, the Writers Room.
 */
export const DESKTOP_LAPSE_PROMISE =
  'Your projects stay on your machine and keep opening, printing and exporting. What stops is installing on a new computer, downloading the installers, and the parts that reach vc-writer.com.';

/** What the account page says about a subscription, in words. */
export const describeSubscription = (
  license: Pick<License, 'status' | 'expiresAt'>,
  now: Date,
): string => {
  const until = license.expiresAt ? new Date(license.expiresAt).toISOString().slice(0, 10) : null;
  if (!until) return 'Active. This licence does not expire.';
  if (licenseLive(license, now)) return `Active. Renews ${until}.`;
  return `Ended ${until}.`;
};
