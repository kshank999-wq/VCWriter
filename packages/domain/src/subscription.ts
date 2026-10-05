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
 * It is that promise's shape (addendum 27 §14) pointed at the desktop.
 *
 * **It was a description of what the program did, and the program has
 * changed** (§8, from Ken: *make the lapse read-only on the desktop*), so it
 * is corrected here rather than left saying something that is no longer true —
 * the fault this project has caught in a thread's own sentence (addendum 24
 * §5e) and in a comment (§5m). What a lapse now stops is **changing** a
 * project, taking a **new** machine (`decideActivation` refuses a licence that
 * is not live) and the features that ask vc-writer.com for themselves. What it
 * still does not reach is the work: every project on the disk goes on opening,
 * printing, exporting and being copied somewhere else, which is the half the
 * promise exists to make.
 */
export const DESKTOP_LAPSE_PROMISE =
  'Your projects stay on your machine and go on opening, printing and exporting. What stops is changing them, installing on another computer, and the parts that reach vc-writer.com.';

// ---------------------------------------------------------------------------
// What this machine may do (§8)
// ---------------------------------------------------------------------------

/**
 * What this machine last heard about its licence (§8).
 *
 * The desktop has never held one of these: it activates once, and the features
 * that reach vc-writer.com ask the server for themselves every time. Read-only
 * cannot work that way — a writer on a train must not be refused their own
 * manuscript because the machine could not ask — so what the server said is
 * **written down with the day it said it**, and the reading below is over that
 * record rather than over a live answer.
 *
 * It records a **measurement and not a fact**: what it measures is whether a
 * subscription is paid, which changes without this machine being told, and
 * that is why `checkedAt` is part of it rather than an aside.
 */
export interface DeskStanding {
  /** The licence's status, as the server last said it. */
  status: LicenseStatus;
  /** What it is paid up to, or null for a licence that never ends. */
  expiresAt: string | null;
  /** When this machine was last told. */
  checkedAt: string;
  /**
   * When this machine **first** saw it had lapsed, which is what the grace is
   * measured from. Carried forward rather than written again, or every check
   * would start the week over and it would never end.
   */
  seenLapsedAt: string | null;
}

/** A licence with no date ended whenever its status said so, which is now. */
const endsAt = (license: Pick<License, 'expiresAt'>): number =>
  license.expiresAt ? new Date(license.expiresAt).getTime() : Number.NEGATIVE_INFINITY;

/**
 * The account's liveliest licence, as a claim about this machine — or null
 * where the account has none.
 *
 * **An account with two licences is as live as its liveliest**: a writer who
 * bought once and subscribes later holds two rows and is plainly entitled, so
 * answering with the first row found would refuse somebody who is paying.
 * Where none is live, the one that ended last is the one to answer with, its
 * date being what the writer is owed an explanation about.
 *
 * Null for an account with no licence at all, which is **not** a lapse: a copy
 * that was never activated has always been able to write, and turning those
 * read-only would be a far bigger change than the one asked for.
 */
export const deskStandingFrom = (
  licenses: readonly Pick<License, 'status' | 'expiresAt'>[],
  now: Date,
): Pick<License, 'status' | 'expiresAt'> | null => {
  if (licenses.length === 0) return null;
  const live = licenses.find((one) => licenseLive(one, now));
  if (live) return { status: live.status, expiresAt: live.expiresAt ?? null };
  const ended = [...licenses].sort((a, b) => endsAt(b) - endsAt(a))[0]!;
  return { status: ended.status, expiresAt: ended.expiresAt ?? null };
};

/**
 * Write down what the server just said, keeping what only this machine knows.
 *
 * Pure, so the host stores and never decides. The one thing it carries forward
 * is `seenLapsedAt`, and a live answer clears it — somebody who renews and
 * lapses again next year gets the week again, because that is a new lapse.
 */
export const noteStanding = (
  previous: DeskStanding | null,
  claim: Pick<License, 'status' | 'expiresAt'>,
  now: Date,
): DeskStanding => {
  const checkedAt = now.toISOString();
  return {
    status: claim.status,
    expiresAt: claim.expiresAt ?? null,
    checkedAt,
    seenLapsedAt: licenseLive(claim, now) ? null : (previous?.seenLapsedAt ?? checkedAt),
  };
};

/**
 * How long a copy stays writable after this machine first sees the lapse.
 *
 * **A refusal is announced before it bites.** Stripe has already retried and
 * emailed by the time a licence reads expired, but none of that happened
 * *here*, and a program that goes read-only between one sentence and the next
 * has taken something away without ever saying it would.
 */
export const WRITING_GRACE_DAYS = 7;

/**
 * How long a recorded answer is worth acting on.
 *
 * Past this the record is a month-old measurement of something that changes
 * weekly, and **being unable to ask is not a lapse**: a writer whose network is
 * blocked, or who renewed on their phone and cannot get the news to this
 * machine, must not be locked out of their own book. So read-only is a **fresh
 * refusal and never a remembered one**, which is the generosity this program
 * owes the work; what the subscription still gates unconditionally is every
 * part of the program that can actually ask.
 */
export const STANDING_GOOD_FOR_DAYS = 30;

const DAY_MS = 86_400_000;
const daysAfter = (iso: string, days: number): number => new Date(iso).getTime() + days * DAY_MS;
const sayDay = (at: number): string => new Date(at).toISOString().slice(0, 10);

export interface WritingStanding {
  /** Whether the document may be changed at all. */
  writable: boolean;
  /** What to say about it, or null where there is nothing to say. */
  notice: string | null;
  /**
   * Whether what is said is a warning of something coming rather than the
   * explanation of a refusal. **A warning may be dismissed and a refusal may
   * not**: an explanation of why the program will not take a keystroke is the
   * one notice a writer must be able to find at any moment.
   */
  warning: boolean;
}

/**
 * Why it ended, in the writer's terms.
 *
 * A subscription that ran out and a licence somebody revoked are not the same
 * sentence, and *your subscription ended* said about a chargeback would send a
 * writer to a renewal page that cannot help them.
 */
const lapseWords = (standing: DeskStanding): string => {
  if (standing.status === 'expired' || standing.status === 'active') {
    const on = standing.expiresAt ? ` on ${standing.expiresAt.slice(0, 10)}` : '';
    return `Your VC Writer subscription ended${on}.`;
  }
  return 'This copy’s licence is no longer active.';
};

/**
 * Whether this copy may be written in, and what to say (§8, from Ken).
 *
 * One reading for every window, because the standing is a fact about the
 * **machine** rather than about the file: a popped-out room asks it for itself
 * rather than asking the workspace, which is addendum 29 §2's rule from the
 * other end — a room may not write the file because the workspace owns the
 * path, while whether anybody may write at all is nobody's to own.
 *
 * It is generous wherever it is uncertain, in both directions, and the order of
 * the clauses *is* the design.
 */
export const writingStanding = (standing: DeskStanding | null, now: Date): WritingStanding => {
  // Nothing has ever been heard: a fresh install, a copy that has not signed
  // in, an account with no licence, or a host that does not licence writing at
  // all. Every one of those has always been writable and still is.
  if (!standing) return { writable: true, notice: null, warning: false };

  // Paid up. Nothing is said, deliberately: a renewal reminder is the shop's to
  // send, and a banner counting down a subscription nobody has cancelled is the
  // program nagging about its own bill while somebody is working.
  if (licenseLive(standing, now)) return { writable: true, notice: null, warning: false };

  const ended = lapseWords(standing);

  // An answer too old to act on. It says the licence has ended, because that is
  // the last thing known and the writer can act on it, and it says nothing
  // about read-only, which this copy is no longer entitled to claim.
  if (now.getTime() > daysAfter(standing.checkedAt, STANDING_GOOD_FOR_DAYS)) {
    return {
      writable: true,
      notice: `${ended} Renew it to sync your work and to install on another computer.`,
      warning: true,
    };
  }

  const bitesAt = daysAfter(standing.seenLapsedAt ?? standing.checkedAt, WRITING_GRACE_DAYS);
  if (now.getTime() < bitesAt) {
    return {
      writable: true,
      notice: `${ended} This copy stays writable until ${sayDay(bitesAt)}. After that your work still opens, prints and exports, but cannot be changed.`,
      warning: true,
    };
  }

  return {
    writable: false,
    notice: `${ended} This copy is read-only. ${DESKTOP_LAPSE_PROMISE}`,
    warning: false,
  };
};

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
