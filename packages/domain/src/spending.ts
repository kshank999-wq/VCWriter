import { z } from 'zod';

/**
 * What the room's AI has cost, and the cap on it (addendum 07 §14, stage 13).
 *
 * §14 asks for *room-level usage and cost controls*. Stage 12 shipped the half
 * that could be honoured completely — one switch, the owner's — and said out
 * loud why the other half was not there: a cap needs **metering per room**, a
 * decision about **what happens when the number is reached**, and **somewhere
 * to show the running total**, and a limit that silently does not hold is worse
 * than no limit at all. This is those three.
 *
 * Four decisions carry it.
 *
 * **A cap stops the next reading, never the one in flight.** What a reading
 * costs is known only once the model has answered, so the check before it runs
 * is against what has already been spent. A room can therefore pass its cap by
 * one reading, and the interface says so rather than implying an exactness
 * nothing could deliver. The alternative — refusing anything that *might* take
 * it over — would mean guessing a price before asking, and a guess is what this
 * was built to avoid.
 *
 * **Spending is recorded, because it cannot be read off anything else.** The
 * rest of the module computes rather than stores — what is new, the trail, who
 * is used — precisely because the facts were already written down somewhere.
 * Tokens are not: they exist for the length of one HTTP response and then they
 * are gone. A row per reading is the only honest way to know, and it is a
 * record of an event rather than a second copy of a state, so there is nothing
 * for it to drift against.
 *
 * **The price of a model is not the domain's to assert.** Rates change and they
 * belong beside the model id, so this does arithmetic on a rate it is handed —
 * the same reason `pricing.ts` reads the price from Stripe rather than keeping
 * a constant that would eventually disagree with the till.
 *
 * **The cap is money, not readings.** Ten comparisons of two long scenes and a
 * hundred duplicate checks are not the same spend, and a count would let a room
 * with a cap of fifty spend anything at all.
 */

// --------------------------------------------------------------- the meter

/** What one reading cost, recorded when it comes back. */
export const aiUsageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  /** Whose reading it was. The cost belongs to a person as well as to a room. */
  userId: z.string().nullable().default(null),
  /** Which reading — `compare`, `duplicates`. Free text, so a new one needs no migration. */
  reading: z.string().default(''),
  inputTokens: z.number().int().min(0).default(0),
  outputTokens: z.number().int().min(0).default(0),
  /**
   * What it cost, in cents, worked out at the moment it happened.
   *
   * Stored rather than recomputed from the tokens: the rate that applied is the
   * rate that applied, and a price change six months from now must not silently
   * rewrite what last quarter cost.
   */
  costCents: z.number().min(0).default(0),
  at: z.string(),
});
export type AiUsage = z.infer<typeof aiUsageSchema>;

/** What a model costs, per million tokens, in cents. */
export interface TokenRate {
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
}

/**
 * What a reading cost.
 *
 * Rounded **up** to the cent, and never to zero for a reading that happened: a
 * meter that reads nothing after a hundred small questions is a meter that is
 * wrong in the direction nobody notices.
 */
export const costOf = (
  tokens: { inputTokens: number; outputTokens: number },
  rate: TokenRate,
): number => {
  const raw =
    (tokens.inputTokens * rate.inputCentsPerMillion +
      tokens.outputTokens * rate.outputCentsPerMillion) /
    1_000_000;
  if (raw <= 0) return 0;
  return Math.max(1, Math.ceil(raw));
};

// ------------------------------------------------------------- the window

/**
 * The first moment of the month a date falls in, in UTC.
 *
 * A calendar month rather than a rolling thirty days, because a cap is read
 * beside an invoice and an invoice is monthly. UTC rather than the reader's
 * zone: two people in one room must not see different totals, and a boundary
 * that moves with whoever is looking is exactly that.
 */
export const monthStart = (at: string | Date = new Date()): string => {
  const date = at instanceof Date ? at : new Date(at);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
};

/** What has been spent since a moment. */
export const spentSince = (usages: readonly AiUsage[], since: string): number =>
  usages.filter((usage) => usage.at >= since).reduce((total, usage) => total + usage.costCents, 0);

// ---------------------------------------------------------------- the cap

export interface CapStanding {
  /** Spent this month, in cents. */
  spentCents: number;
  /** The cap, or null where the room has not set one. */
  capCents: number | null;
  /** What is left before the next reading is refused. Null where there is no cap. */
  leftCents: number | null;
  /** Whether the next reading would be refused. */
  reached: boolean;
  /** How far through the cap, 0–1. Null where there is no cap. */
  through: number | null;
}

/**
 * Where the room stands against its cap.
 *
 * No cap is a real and default answer — a room that has not asked for a limit
 * does not have one, and inventing a number would be the product deciding what
 * somebody's work is worth.
 */
export const capStanding = (input: {
  spentCents: number;
  capCents: number | null;
}): CapStanding => {
  const spentCents = Math.max(0, Math.round(input.spentCents));
  const capCents = input.capCents === null ? null : Math.max(0, Math.round(input.capCents));
  if (capCents === null) {
    return { spentCents, capCents: null, leftCents: null, reached: false, through: null };
  }
  return {
    spentCents,
    capCents,
    leftCents: Math.max(0, capCents - spentCents),
    // At the cap is reached: a cap of ten dollars that allows the eleventh
    // dollar because the comparison was strict is a cap nobody can explain.
    reached: spentCents >= capCents,
    through: capCents === 0 ? 1 : Math.min(1, spentCents / capCents),
  };
};

/** Money, as a room reads it. Whole dollars where it is whole. */
export const money = (cents: number, currency: string = 'USD'): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

/**
 * What the dashboard says about the month, in one line.
 *
 * It names the overshoot rather than hiding it, because a room that has spent
 * $52 against a $50 cap should read that and not *$50 of $50* — the second
 * would make the one honest thing about the cap look like a bug.
 */
export const describeSpend = (standing: CapStanding): string => {
  if (standing.capCents === null) {
    return standing.spentCents === 0
      ? 'Nothing spent on readings this month.'
      : `${money(standing.spentCents)} on readings this month. No cap set.`;
  }
  if (standing.spentCents > standing.capCents) {
    return `${money(standing.spentCents)} of ${money(standing.capCents)} this month — the cap is reached, and the last reading took it over.`;
  }
  if (standing.reached) {
    return `${money(standing.spentCents)} of ${money(standing.capCents)} this month. The cap is reached.`;
  }
  return `${money(standing.spentCents)} of ${money(standing.capCents)} this month.`;
};

/**
 * The sentence beside the control, so nobody has to discover the rule.
 *
 * The one thing about a cap that has to be said before it bites: it is checked
 * before a reading and priced after one.
 */
export const CAP_CAVEAT =
  'A cap stops the next reading, not the one already running — so a room can pass it by one reading. Nothing already made is ever touched.';

/** The largest cap the interface offers, in cents. Above this, ask. */
export const CAP_MOST = 100_000;

/**
 * Whether a cap can be set to this.
 *
 * **Zero is allowed and means no readings**, which is a different statement
 * from the switch being off: the switch says *this room does not use AI*, and a
 * cap of nothing says *not until next month*. Negative is not a cap.
 */
export const capIsSane = (cents: number | null): boolean =>
  cents === null || (Number.isInteger(cents) && cents >= 0 && cents <= CAP_MOST);
