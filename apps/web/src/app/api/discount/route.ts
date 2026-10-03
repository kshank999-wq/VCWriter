import { NextResponse } from 'next/server';
import { DISCOUNT_REFUSAL, describeOff, formatPrice, isRedeemable, priceWith } from '@vcwriter/domain';
import { findDiscount } from '@/lib/discounts';
import { fetchDisplayPrice } from '@/lib/pricing';
import { RULES, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What a discount code is worth, before anybody presses (addendum 31).
 *
 * **Public on purpose**, because the whole point of a code is that it is
 * printed in an advertisement anybody can read: a reader who follows the link
 * has to be told what it takes off on the page they land on, and one who types
 * a code has to be told it works before being sent to a payment screen. It is
 * rate-limited for the one thing that is not public about it — guessing at
 * codes nobody published — and the refusal is **one sentence for every way it
 * can fail**, which is the half that makes guessing worthless.
 *
 * It says what comes off and what is owed, and **grants nothing**: there is no
 * token here, nothing is reserved, and the answer is not carried to checkout.
 * The checkout route resolves the word again for itself.
 */
export async function GET(request: Request): Promise<Response> {
  const limited = await rateLimit(request, RULES.discount);
  if (limited) return limited;

  const said = new URL(request.url).searchParams.get('code')?.trim() ?? '';
  if (said.length === 0) {
    return NextResponse.json({ error: 'A code is required' }, { status: 400 });
  }

  const offer = await findDiscount(said);
  if (!offer || !isRedeemable(offer, new Date())) {
    return NextResponse.json({ ok: false, error: DISCOUNT_REFUSAL });
  }

  const price = await fetchDisplayPrice();
  const nowCents = price ? priceWith(price.amountCents, price.currency, offer.off) : null;

  return NextResponse.json({
    ok: true,
    code: offer.code,
    // What it takes off, always; what is then owed only where the shop can say
    // so for certain (a fixed amount in another currency cannot be).
    takes: describeOff(offer.off),
    was: price?.formatted ?? null,
    now: nowCents === null || !price ? null : formatPrice(nowCents, price.currency),
  });
}
