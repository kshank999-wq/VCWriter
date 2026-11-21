import type Stripe from 'stripe';
import { editCreditPack, purchaseSettled } from '@vcwriter/domain';
import { adminClient } from './supabase';

/**
 * The edit-credit ledger (addendum 47, migration 0090). Every change is a
 * row written here, by the server; the balance is their sum. Counted in words.
 */

export const balanceOf = async (userId: string): Promise<number> => {
  const { data, error } = await adminClient().from('edit_credit_entries').select('words').eq('user_id', userId);
  if (error) throw new Error('Your edit credits could not be read just now.');
  return (data ?? []).reduce((sum, row) => sum + (row.words as number), 0);
};

/**
 * **A paid pack becomes credits.** The pack's words are looked up here from
 * its id, never read from what the checkout carried, and the unique index on
 * the checkout id makes a redelivered event a no-op.
 */
export const grantPurchase = async (session: Stripe.Checkout.Session): Promise<'granted' | 'already' | 'unpaid'> => {
  if (!purchaseSettled(session.payment_status)) return 'unpaid';
  const pack = editCreditPack(session.metadata?.['pack'] ?? '');
  const userId = session.metadata?.['supabase_user_id'];
  if (!pack || !userId) throw new Error(`Edit credit checkout ${session.id} names no pack or no account`);
  const { error } = await adminClient()
    .from('edit_credit_entries')
    .insert({
      user_id: userId,
      words: pack.words,
      kind: 'purchase',
      pack: pack.id,
      amount_cents: session.amount_total ?? pack.priceCents,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      note: `${pack.words.toLocaleString('en-US')} words`,
    });
  if (error && error.code === '23505') return 'already';
  if (error) throw new Error(error.message);
  return 'granted';
};

/**
 * **A refunded or disputed pack is taken back.** The balance may go below
 * zero if the credits were already spent; nothing more can be checked until
 * it is back above.
 */
export const reversePurchase = async (paymentIntentId: string): Promise<boolean> => {
  const client = adminClient();
  const { data: purchase } = await client
    .from('edit_credit_entries')
    .select('user_id, words, pack')
    .eq('kind', 'purchase')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (!purchase) return false;
  const { error } = await client.from('edit_credit_entries').insert({
    user_id: purchase.user_id,
    words: -(purchase.words as number),
    kind: 'reversal',
    pack: purchase.pack,
    stripe_payment_intent_id: paymentIntentId,
    note: 'Payment refunded or disputed',
  });
  if (error && error.code !== '23505') throw new Error(error.message);
  return true;
};

/** Spend words for one run, if the balance holds them. Atomic per writer. */
export const spendCredits = async (userId: string, words: number, note: string): Promise<{ entryId: string | null; balance: number }> => {
  const { data, error } = await adminClient().rpc('spend_edit_credits', { p_user: userId, p_words: words, p_note: note });
  if (error) throw new Error('Your edit credits could not be checked just now.');
  const row = (Array.isArray(data) ? data[0] : data) as { entry_id: string | null; balance: number } | undefined;
  return { entryId: row?.entry_id ?? null, balance: row?.balance ?? 0 };
};

/** A run that failed gives its words back. */
export const refundRun = async (userId: string, words: number, note: string): Promise<void> => {
  await adminClient().from('edit_credit_entries').insert({ user_id: userId, words, kind: 'refund', note });
};

/** What a run cost us, on its row, for the margin. Never fails the run. */
export const recordRunCost = async (
  entryId: string,
  usage: { inputTokens: number; outputTokens: number },
  costDollars: number,
): Promise<void> => {
  try {
    await adminClient()
      .from('edit_credit_entries')
      .update({ input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, cost_cents: Math.round(costDollars * 10000) / 100 })
      .eq('id', entryId);
  } catch {
    // The writer has their findings; a lost cost row is ours to live with.
  }
};
