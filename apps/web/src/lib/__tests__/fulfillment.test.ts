import { describe, expect, it } from 'vitest';
import { fulfillCheckout, parsePlatform, type FulfillmentInput } from '../fulfillment';
import { createFakeSupabase } from './fake-supabase';

/**
 * The money path (spec §12.2, §17).
 *
 * Stripe delivers at least once, so the acceptance criterion is blunt: a
 * successful purchase creates exactly one valid license however many times the
 * webhook arrives. These run against a fake that enforces the same unique
 * constraints Postgres does, so a passing test here is testing the real rule.
 */

const purchase = (overrides: Partial<FulfillmentInput> = {}): FulfillmentInput => ({
  checkoutSessionId: 'cs_test_123',
  paymentIntentId: 'pi_test_123',
  stripeCustomerId: 'cus_test_123',
  customerEmail: 'Buyer@Example.com',
  amountCents: 9900,
  currency: 'usd',
  selectedPlatform: 'windows',
  userId: null,
  ...overrides,
});

let serialCounter = 0;
const deps = (fake: ReturnType<typeof createFakeSupabase>) => ({
  client: fake.client,
  newSerial: () => {
    serialCounter += 1;
    return `VCW-TEST${serialCounter}-AAAAA-BBBBB-CCCCC`;
  },
});

describe('fulfilling a purchase', () => {
  it('creates an account, an order and a license for a first-time buyer', async () => {
    const fake = createFakeSupabase();

    const result = await fulfillCheckout(purchase(), deps(fake));

    expect(result.created).toBe(true);
    expect(fake.state.orders).toHaveLength(1);
    expect(fake.state.licenses).toHaveLength(1);
    expect(fake.state.licenses[0]?.['entitled_platforms']).toEqual(['windows', 'macos']);
    expect(fake.state.orders[0]?.['status']).toBe('paid');
    expect(fake.state.orders[0]?.['selected_platform']).toBe('windows');
  });

  it('creates exactly one license however many times the webhook arrives', async () => {
    const fake = createFakeSupabase();

    const first = await fulfillCheckout(purchase(), deps(fake));
    const second = await fulfillCheckout(purchase(), deps(fake));
    const third = await fulfillCheckout(purchase(), deps(fake));

    expect(fake.state.orders).toHaveLength(1);
    expect(fake.state.licenses).toHaveLength(1);
    expect(second.created).toBe(false);
    expect(third.created).toBe(false);
    expect(second.serial).toBe(first.serial);
    expect(second.licenseId).toBe(first.licenseId);
  });

  it('survives two deliveries racing on the same order', async () => {
    const fake = createFakeSupabase();

    const [a, b] = await Promise.all([
      fulfillCheckout(purchase(), deps(fake)),
      fulfillCheckout(purchase(), deps(fake)),
    ]);

    expect(fake.state.licenses).toHaveLength(1);
    expect(a.licenseId).toBe(b.licenseId);
    // Exactly one of the two won the insert.
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
  });

  it('finds a returning customer by email instead of creating a second account', async () => {
    const fake = createFakeSupabase({
      profiles: [{ id: '11111111-1111-4111-8111-111111111111', email: 'buyer@example.com' }],
      authUsers: [{ id: '11111111-1111-4111-8111-111111111111', email: 'buyer@example.com' }],
    });

    const result = await fulfillCheckout(purchase(), deps(fake));

    expect(result.userId).toBe('11111111-1111-4111-8111-111111111111');
    expect(fake.state.authUsers).toHaveLength(1);
    expect(fake.state.profiles).toHaveLength(1);
  });

  it('matches a returning customer whatever case they typed their email in', async () => {
    const fake = createFakeSupabase({
      profiles: [{ id: '22222222-2222-4222-8222-222222222222', email: 'buyer@example.com' }],
      authUsers: [{ id: '22222222-2222-4222-8222-222222222222', email: 'buyer@example.com' }],
    });

    const result = await fulfillCheckout(purchase({ customerEmail: 'BUYER@EXAMPLE.COM' }), deps(fake));

    expect(result.userId).toBe('22222222-2222-4222-8222-222222222222');
    expect(fake.state.profiles).toHaveLength(1);
  });

  it('uses the signed-in account when the buyer was signed in at checkout', async () => {
    const fake = createFakeSupabase();

    const result = await fulfillCheckout(purchase({ userId: 'signed-in-user' }), deps(fake));

    expect(result.userId).toBe('signed-in-user');
    // No account creation attempted at all.
    expect(fake.state.authUsers).toHaveLength(0);
  });

  it('records the platform chosen at checkout without restricting the license to it', async () => {
    const fake = createFakeSupabase();

    await fulfillCheckout(purchase({ selectedPlatform: 'macos' }), deps(fake));

    expect(fake.state.orders[0]?.['selected_platform']).toBe('macos');
    // §18: one purchase covering both installers is data, not a hard rule.
    expect(fake.state.licenses[0]?.['entitled_platforms']).toEqual(['windows', 'macos']);
  });

  it('keeps separate purchases separate', async () => {
    const fake = createFakeSupabase();

    await fulfillCheckout(purchase({ checkoutSessionId: 'cs_a' }), deps(fake));
    await fulfillCheckout(purchase({ checkoutSessionId: 'cs_b', customerEmail: 'other@example.com' }), deps(fake));

    expect(fake.state.orders).toHaveLength(2);
    expect(fake.state.licenses).toHaveLength(2);
    expect(fake.state.licenses[0]?.['serial']).not.toBe(fake.state.licenses[1]?.['serial']);
  });
});

describe('platform metadata', () => {
  it('accepts the two platforms and rejects anything else', () => {
    expect(parsePlatform('windows')).toBe('windows');
    expect(parsePlatform('macos')).toBe('macos');
    expect(parsePlatform('linux')).toBeNull();
    expect(parsePlatform(undefined)).toBeNull();
    expect(parsePlatform('')).toBeNull();
  });
});
