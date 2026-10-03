/**
 * Discount codes (addendum 31).
 *
 * **Stripe is the till and the discount lives there**, which is `pricing.ts`'s
 * rule applied to the other half of the transaction: the price is read from
 * Stripe rather than repeated here, so what comes *off* it must be too. There
 * is no `discount_codes` table, no stored percentage, no copied expiry and no
 * redemption counter in this project — a code withdrawn in Stripe stops
 * working here with nothing run, and a second copy could only ever agree with
 * the till or be wrong about it.
 *
 * So what lives in the domain is the part that is **not** Stripe's: what a
 * code may look like, what the offer says in words, what a reader is charged,
 * what an advertisement's link is, and what a refusal says. Those are rules
 * about the shop rather than facts about the money, and they are the ones a
 * screen would otherwise write four times.
 */

/** What a discount takes off. Stripe calls the record a *coupon*. */
import { formatPrice } from './money.js';

export type DiscountOff =
  | { kind: 'percent'; percent: number }
  | { kind: 'amount'; amountCents: number; currency: string };

export interface DiscountOffer {
  /** The word somebody types or reads off an advertisement. */
  code: string;
  off: DiscountOff;
  /** Stripe's id for the promotion code, which is what checkout is handed. */
  promotionCodeId: string;
  /** How many times it has been used, and the ceiling if there is one. */
  redeemed: number;
  maxRedemptions: number | null;
  /** When it stops working, if it ever does. */
  expiresAt: string | null;
  /** Whether Stripe still counts it as live. */
  active: boolean;
}

/**
 * **One refusal for every way a code can fail.**
 *
 * Unknown, expired, used up, switched off, or for a different product: a
 * customer can do exactly the same thing about all five — ask for one that
 * works — so five sentences would be five answers to one question. The one
 * that tells them apart is also the one that tells a stranger which codes
 * exist, which is worth something to a guesser and nothing to a buyer.
 */
export const DISCOUNT_REFUSAL = 'That code is not valid.';

/**
 * The one spelling of a code.
 *
 * A code in an advertisement is read off paper, said out loud and typed by
 * hand, so `launch20`, `Launch 20` and ` LAUNCH20 ` are one code and not
 * three. **The program only ever makes upper-case codes**, which is what lets
 * a lookup upper-case too without having to ask whether the shop is
 * case-sensitive today.
 */
export const normaliseCode = (said: string): string => said.trim().toUpperCase().replace(/\s+/g, '');

/** Letters, digits and dashes: what prints legibly and what Stripe accepts. */
const CODE_SHAPE = /^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$/;

/**
 * What is wrong with a code **as a word**, or null.
 *
 * Deliberately not *does this code exist* — that is the shop's question and is
 * answered by `DISCOUNT_REFUSAL`. This one is about something a person typing
 * it can fix while they are still typing.
 */
export const codeRefusal = (said: string): string | null => {
  const code = normaliseCode(said);
  if (code.length === 0) return 'Type the code.';
  if (code.length < 3) return 'A code is at least three characters.';
  if (code.length > 40) return 'A code is at most forty characters.';
  if (!CODE_SHAPE.test(code)) return 'Letters, numbers and dashes only.';
  return null;
};

/** The offer in words: what it takes off, and nothing about what is owed. */
export const describeOff = (off: DiscountOff): string =>
  off.kind === 'percent' ? `${off.percent}% off` : `${formatPrice(off.amountCents, off.currency)} off`;

/**
 * What the reader pays, or null where it cannot be said for certain.
 *
 * **Stripe performs the real arithmetic at the till**, and this exists so the
 * page can say the figure before anybody presses. It therefore follows
 * Stripe's own rules rather than inventing rounding: a percentage takes the
 * discount to the nearest cent, an amount subtracts, and neither goes below
 * zero. Where a fixed-amount coupon is in **another currency** it answers null
 * rather than guessing a conversion — a page that invented an exchange rate
 * would be the one place in the shop quoting a price nobody charges.
 */
export const priceWith = (amountCents: number, currency: string, off: DiscountOff): number | null => {
  if (off.kind === 'percent') {
    const taken = Math.round((amountCents * off.percent) / 100);
    return Math.max(0, amountCents - taken);
  }
  if (off.currency.toLowerCase() !== currency.toLowerCase()) return null;
  return Math.max(0, amountCents - off.amountCents);
};

/**
 * The parameter an advertised link carries the code in.
 *
 * **Deliberately not `code`, which this site has already spoken for.** A
 * `?code=` on any page is a Supabase sign-in code and is forwarded to the auth
 * callback by the middleware — behaviour added after a real sign-in failure
 * and not to be weakened — so an advertisement built on `?code=` would send
 * every reader who followed it to *your sign-in link has expired*, with the
 * discount never mentioned. Driving the real site is the only thing that found
 * it; the page was perfect and unreachable.
 *
 * It is the third name this project has had to step around for the same reason
 * (`origin` taken, so a moment is `found`; `Standing` taken, so a node's is a
 * `Situation`), and the rule is the same: **the collision is with a word, so
 * the fix is a word.**
 */
export const DISCOUNT_PARAM = 'discount';

/**
 * The link an advertisement carries.
 *
 * **This is the half of the ask that did not exist.** A code printed in an
 * advertisement is only as good as the link beside it: a reader who has to
 * remember six characters between the advertisement and the checkout is a
 * reader who forgets, and one who is handed a link arrives with the discount
 * already named. The buying page reads it, says what it takes off and passes
 * it on, so nobody types anything.
 */
export const advertisedLink = (siteUrl: string, code: string): string =>
  `${siteUrl.replace(/\/+$/, '')}/download?${DISCOUNT_PARAM}=${encodeURIComponent(normaliseCode(code))}`;

/**
 * What an offer still has in it, for whoever is deciding whether to advertise
 * it. Stored nowhere: the counts are Stripe's and are read every time.
 */
export const describeStanding = (offer: DiscountOffer, now: Date): string => {
  const parts: string[] = [];
  parts.push(
    offer.maxRedemptions === null
      ? `${offer.redeemed} used`
      : `${offer.redeemed} of ${offer.maxRedemptions} used`,
  );
  if (offer.expiresAt) {
    const when = new Date(offer.expiresAt);
    parts.push(when.getTime() <= now.getTime() ? 'expired' : `until ${when.toISOString().slice(0, 10)}`);
  }
  if (!offer.active) parts.push('switched off');
  else if (offer.maxRedemptions !== null && offer.redeemed >= offer.maxRedemptions) parts.push('used up');
  return parts.join(' · ');
};

/** Whether a reader could still redeem it, which the standing says in words. */
export const isRedeemable = (offer: DiscountOffer, now: Date): boolean => {
  if (!offer.active) return false;
  if (offer.maxRedemptions !== null && offer.redeemed >= offer.maxRedemptions) return false;
  if (offer.expiresAt && new Date(offer.expiresAt).getTime() <= now.getTime()) return false;
  return true;
};

/**
 * Stripe's three words for a session's payment, and which of them mean the
 * goods are owed.
 *
 * **A discount is the only way a purchase here reaches nothing**, which is why
 * this reading lives in this module: Stripe sets `no_payment_required` when the
 * total is zero, and a code taking everything off is exactly how that happens —
 * a review copy, a press copy, a giveaway. Before this, the webhook asked
 * `payment_status === 'paid'` and a 100%-off checkout **completed and fulfilled
 * nothing**: no order, no licence, no email, and no error either, so the one
 * person who would have found out was the buyer holding a receipt for nothing.
 *
 * It is `appleState`'s rule on the other shop (`notes-plan.ts`): **a word this
 * build has never heard of is not a reason to hand anything over**, so the two
 * that settle are named and everything else is refused, including Stripe's own
 * `unpaid`.
 */
export type PaymentStanding = 'paid' | 'unpaid' | 'no_payment_required';

/** Whether nothing is left to pay — Stripe's word, read for fulfilment. */
export const purchaseSettled = (said: string): boolean =>
  said === 'paid' || said === 'no_payment_required';

/** What a new code is to be, as the admin screen asks for it. */
export interface NewDiscount {
  code: string;
  off: DiscountOff;
  /** Null for no ceiling, which is what a published advertisement wants. */
  maxRedemptions: number | null;
  /** ISO date, or null for no end. */
  expiresAt: string | null;
}

/**
 * What is wrong with a discount somebody is about to make, or null.
 *
 * `trackRemoval`'s shape: the refusal is available **before the act can be
 * asked for**, and the route checks it again so a caller cannot get past the
 * reading by not reading it.
 */
export const newDiscountRefusal = (plan: NewDiscount, now: Date): string | null => {
  const word = codeRefusal(plan.code);
  if (word) return word;

  if (plan.off.kind === 'percent') {
    if (!Number.isFinite(plan.off.percent) || plan.off.percent <= 0) return 'Take something off.';
    if (plan.off.percent > 100) return 'Nothing over 100% off.';
  } else {
    if (!Number.isFinite(plan.off.amountCents) || plan.off.amountCents <= 0) return 'Take something off.';
    if (plan.off.currency.trim().length !== 3) return 'A currency is three letters.';
  }

  if (plan.maxRedemptions !== null && (!Number.isInteger(plan.maxRedemptions) || plan.maxRedemptions < 1)) {
    return 'A limit is one or more, or none at all.';
  }
  if (plan.expiresAt !== null) {
    const when = new Date(plan.expiresAt);
    if (Number.isNaN(when.getTime())) return 'That is not a date.';
    if (when.getTime() <= now.getTime()) return 'An end date is in the future.';
  }
  return null;
};

/**
 * What making it would do, said before the press.
 *
 * **A code that takes everything off says what that means**, because what
 * happens next is not what somebody setting a percentage would guess: Stripe
 * asks for no card at all, so the figures are a receipt for nothing — and the
 * licence is issued all the same, which is the whole point of a review copy. It
 * is said only where it can be said for certain, so a *percentage* of 100 says
 * it and a fixed amount does not, this module not holding the price and a
 * sentence about a free purchase that merely might be one being worse than
 * none.
 */
export const describeNewDiscount = (plan: NewDiscount): string => {
  const code = normaliseCode(plan.code);
  const bits = [`${code} takes ${describeOff(plan.off)}`];
  if (plan.maxRedemptions !== null) bits.push(`for the first ${plan.maxRedemptions}`);
  if (plan.expiresAt !== null) bits.push(`until ${plan.expiresAt}`);
  const said = `${bits.join(', ')}.`;
  if (plan.off.kind === 'percent' && plan.off.percent === 100) {
    return `${said} Nothing is charged and no card is asked for, and the licence is still issued.`;
  }
  return said;
};
