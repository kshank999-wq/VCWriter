import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { advertisedLink, platformSchema } from '@vcwriter/domain';
import { strayAuthRedirect } from '@/lib/auth-redirect';

/**
 * What a client may say about a discount (addendum 31).
 *
 * **The shape is the permission**, which this project has now relied on four
 * times (addendum 07 §12, 16 §10, 26 §14a) — and the one worth pinning here is
 * the money: a browser may name a *code* and may not name what it is worth. So
 * this is the checkout body's own schema, handed everything a client might try
 * to decide for itself, with the assertion that all of it falls off.
 *
 * It is a copy of the route's schema rather than an import because a route
 * module pulls in Stripe and the whole Next request machinery — so the first
 * test **reads the route's own source** and holds the copy to it, a test whose
 * subject had quietly drifted being worse than no test at all.
 */
const bodySchema = z.object({
  platform: platformSchema,
  email: z.string().email().optional(),
  code: z.string().max(64).optional(),
});

const ROUTE = readFileSync(
  fileURLToPath(new URL('../../app/api/checkout/route.ts', import.meta.url)),
  'utf8',
);

describe('what a client may say about a discount', () => {
  it('is the schema the route actually declares', () => {
    const body = ROUTE.slice(ROUTE.indexOf('const bodySchema'), ROUTE.indexOf('});', ROUTE.indexOf('const bodySchema')));
    // The three fields this copy models, and no fourth that names money.
    expect(body).toContain('platform: platformSchema');
    expect(body).toContain('email:');
    expect(body).toContain('code: z.string().max(64).optional()');
    for (const money of ['percent', 'amount', 'discount', 'coupon', 'price', 'total']) {
      expect(body.toLowerCase()).not.toContain(`${money}:`);
    }
  });

  it('takes the word and nothing about the money', () => {
    const parsed = bodySchema.parse({
      platform: 'windows',
      code: 'LAUNCH20',
      // Everything a client might hope decides its own price.
      percentOff: 100,
      amountOff: 24995,
      discounts: [{ coupon: 'free_forever' }],
      promotionCodeId: 'promo_mine',
      priceCents: 1,
      total: 0,
    } as never);

    expect(parsed).toEqual({ platform: 'windows', code: 'LAUNCH20' });
    for (const key of ['percentOff', 'amountOff', 'discounts', 'promotionCodeId', 'priceCents', 'total']) {
      expect(parsed).not.toHaveProperty(key);
    }
  });

  it('refuses a code long enough to be an attack rather than a word', () => {
    expect(bodySchema.safeParse({ platform: 'macos', code: 'A'.repeat(65) }).success).toBe(false);
  });

  it('is still a checkout without one', () => {
    expect(bodySchema.parse({ platform: 'macos' })).toEqual({ platform: 'macos' });
  });
});

/**
 * The advertised link, against this site's own sign-in redirect (addendum 31).
 *
 * **The fault this pins was real and shipped-shaped**: the first draft built
 * the link on `?code=`, which `strayAuthRedirect` forwards to the auth
 * callback — so every reader who followed an advertisement landed on *your
 * sign-in link has expired*, with the discount never mentioned and the page
 * itself working perfectly. Nothing but driving the real site found it, and
 * nothing but this test would stop it coming back.
 */
describe('an advertised link survives the site it points at', () => {
  it('is not mistaken for a sign-in code', () => {
    const url = new URL(advertisedLink('https://vc-writer.com', 'LAUNCH20'));
    expect(strayAuthRedirect(url)).toBe(null);
  });

  it('and `?code=` really would have been', () => {
    // The other half of the claim: this is what the first draft did.
    const wrong = new URL('https://vc-writer.com/download?code=LAUNCH20');
    expect(strayAuthRedirect(wrong)?.pathname).toBe('/auth/callback');
  });
});

/**
 * The webhook's gate on a free purchase (addendum 31 §9).
 *
 * **The only way to pin this gate without a Stripe signature**, and it is worth
 * pinning for exactly the reason the schema above is: `payment_status === 'paid'`
 * was one plausible string comparison, it passed every test in the program, and
 * it dropped every free purchase on the floor without raising anything. The
 * reading itself is tested in the domain; what is tested here is that the route
 * still asks it rather than having drifted back to a literal.
 */
const WEBHOOK = readFileSync(
  fileURLToPath(new URL('../../app/api/stripe/webhook/route.ts', import.meta.url)),
  'utf8',
);

describe('the webhook gates fulfilment on the domain reading', () => {
  it('asks purchaseSettled', () => {
    expect(WEBHOOK).toContain("import { purchaseSettled } from '@vcwriter/domain'");
    expect(WEBHOOK).toContain('if (purchaseSettled(session.payment_status))');
  });

  it('no longer compares the status to a literal', () => {
    // A zero-amount session answers `no_payment_required`, so any literal here
    // is the bug coming back.
    expect(WEBHOOK).not.toMatch(/payment_status\s*===/);
  });
});
