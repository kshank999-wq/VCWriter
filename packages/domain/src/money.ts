/**
 * Money, written out.
 *
 * Two jobs that look like one, which is why they were two private copies
 * before this file existed — `formatPrice` in the shop's `pricing.ts` and
 * `formatMoney` in the admin console — each in a module that also reaches
 * Stripe or the database, so a screen that merely wanted to write `$10` could
 * not have one without dragging a server client into the browser with it.
 *
 * They are kept apart rather than merged because they answer different
 * questions: **a price is advertised and a figure is accounted for.**
 */

/** `$249.95`, `€10.00` — a figure in a ledger, where the cents always show. */
export const formatMoney = (cents: number, currency: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

/**
 * `$249`, `$249.95` — a price on a page, where a whole amount reads better
 * without the two zeros nobody is being asked for.
 */
export const formatPrice = (cents: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
