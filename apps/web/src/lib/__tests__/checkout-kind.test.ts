import { describe, expect, it } from 'vitest';
import { checkoutKind } from '../checkout-kind';

/** The webhook fulfils a desktop licence only for VC Writer's own desktop checkouts. */
describe('checkout kind', () => {
  it("is a desktop purchase for VC Writer's own checkouts, stamped or not", () => {
    expect(checkoutKind({ metadata: { platform: 'windows', supabase_user_id: 'u1', plan: 'monthly' } })).toBe('desktop');
    expect(checkoutKind({ metadata: { product: 'vc-writer', platform: 'macos' } })).toBe('desktop');
    expect(checkoutKind({ metadata: null })).toBe('desktop');
    expect(checkoutKind({})).toBe('desktop');
  });

  it("leaves another VC product's checkout to that product", () => {
    expect(checkoutKind({ metadata: { product: 'vc-game-studio', supabase_user_id: 'u1', plan: 'studio' } })).toBe('other-product');
  });

  it('is no desktop purchase for a Writers Room seat checkout', () => {
    expect(checkoutKind({ metadata: { room_id: 'r1' } })).toBe('room');
  });
});
