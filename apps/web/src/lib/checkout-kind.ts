/**
 * What a completed checkout is for, read from the metadata it was stamped
 * with, so the webhook fulfils only VC Writer's own desktop purchases.
 *
 * Every product of VC Software sells through the one Stripe account, and
 * Stripe sends every product's events to every product's webhook. A checkout
 * stamped with another product (`metadata.product`, e.g. 'vc-game-studio')
 * is that product's to fulfil, and a Writers Room seat checkout (`room_id`)
 * is billed through its subscription events, not a desktop licence. Only what
 * is left is a VC Writer desktop purchase: older checkouts carry no product
 * stamp and are VC Writer's.
 */
export const OWN_PRODUCT = 'vc-writer';

export type CheckoutKind = 'desktop' | 'room' | 'other-product';

export const checkoutKind = (session: { metadata?: Record<string, string> | null }): CheckoutKind => {
  const product = session.metadata?.['product'];
  if (product && product !== OWN_PRODUCT) return 'other-product';
  if (session.metadata?.['room_id']) return 'room';
  return 'desktop';
};
