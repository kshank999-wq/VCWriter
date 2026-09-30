import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import {
  mayCaptureNotes,
  notesPlan,
  notesRefusal,
  notesSubscriptionSchema,
  worthReVerifying,
  type NotesPlan,
  type NotesSubscription,
} from '@vcwriter/domain';
import { adminClient, currentUser, serverClient } from '@/lib/supabase';
import { askStore } from '@/lib/notes-store';

/**
 * The Notes subscription's data layer, and the one gate (addendum 27 §14).
 *
 * `notes-plan.ts` in the domain decides what a subscription *means*; this reads
 * the row, asks the shop when the row has gone stale, and writes what came back.
 * The division is `room-billing.ts`'s: every rule worth getting wrong is in the
 * domain under the same tests as everything else, and what lives here is the
 * fetching.
 *
 * **One gate, in one place.** `requireNotesCapture` is what every door the phone
 * pushes through asks, for the reason §2 gave about `currentUser`: *who is
 * calling* must have one answer, and so must *may they*. A second copy of this
 * predicate in a route would be a second answer, free to disagree the first time
 * either was edited.
 */

interface Row {
  store: string;
  product_id: string;
  store_transaction_id: string;
  state: string;
  current_period_end: string | null;
  auto_renews: boolean;
  environment: string;
  last_verified_at: string | null;
}

const fromRow = (row: Row | null): NotesSubscription | null => {
  if (!row) return null;
  const parsed = notesSubscriptionSchema.safeParse({
    store: row.store,
    productId: row.product_id,
    storeTransactionId: row.store_transaction_id,
    state: row.state,
    periodEnd: row.current_period_end,
    autoRenews: row.auto_renews,
    environment: row.environment,
    lastVerifiedAt: row.last_verified_at,
  });
  // A row this build cannot read is read as no subscription rather than thrown
  // over: a newer phone's word for a state must not be able to take the routes
  // down, which is 0060's own lesson said in code.
  return parsed.success ? parsed.data : null;
};

const toRow = (subscription: NotesSubscription, userId: string) => ({
  user_id: userId,
  store: subscription.store,
  product_id: subscription.productId,
  store_transaction_id: subscription.storeTransactionId,
  state: subscription.state,
  current_period_end: subscription.periodEnd,
  auto_renews: subscription.autoRenews,
  environment: subscription.environment,
  last_verified_at: subscription.lastVerifiedAt,
});

const SELECT =
  'store, product_id, store_transaction_id, state, current_period_end, auto_renews, environment, last_verified_at';

/** The caller's own row, read as the caller so row-level security answers. */
export const readNotesSubscription = async (): Promise<NotesSubscription | null> => {
  const { data } = await serverClient().from('notes_subscriptions').select(SELECT).maybeSingle();
  return fromRow((data as Row | null) ?? null);
};

export type Recorded =
  | { ok: true; subscription: NotesSubscription }
  | { ok: false; reason: string; status: number };

/**
 * Write down what the shop said.
 *
 * Service role, because the table has no write policy at all — an entitlement a
 * client may write is not an entitlement.
 *
 * The one refusal worth its own sentence is the unique index doing its job: a
 * receipt already on somebody else's account. That is the single fraud a
 * receipt-based entitlement is open to, and the database refuses it rather than
 * this code hoping to notice.
 */
export const recordNotesSubscription = async (
  userId: string,
  subscription: NotesSubscription,
): Promise<Recorded> => {
  const { error } = await adminClient()
    .from('notes_subscriptions')
    .upsert(toRow(subscription, userId), { onConflict: 'user_id' });

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        status: 409,
        reason:
          'That subscription is already on another VC Writer account. Sign in with the account you bought it on, or write to support@vc-writer.com.',
      };
    }
    return { ok: false, status: 400, reason: error.message };
  }
  return { ok: true, subscription };
};

/**
 * Where this account stands, asking the shop only where the row has run out.
 *
 * `worthReVerifying` is the rule and it is in the domain: a paid-up subscription
 * costs no network, and a renewal costs one question the first time anybody
 * looks. There are no store-to-server notifications yet (§14.4), so this is what
 * makes a renewal land at all — and a failure to reach the shop leaves the row
 * alone rather than writing a lapse nobody confirmed.
 */
/**
 * When this account first sent a note, or null if it never has.
 *
 * The grandfather (§14.1) read off a table that already exists rather than a
 * flag on the account: **anybody who was using Notes before it became a paid
 * app keeps it**, and nothing had to be set on the right accounts by hand. RLS
 * scopes it to the caller's own rows, so this asks a question about them and
 * cannot ask one about anybody else.
 */
const firstCapture = async (): Promise<string | null> => {
  const { data } = await serverClient()
    .from('capture_items')
    .select('captured_at')
    .order('captured_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { captured_at: string | null } | null)?.captured_at ?? null;
};

export const notesPlanFor = async (userId: string): Promise<{ plan: NotesPlan; subscription: NotesSubscription | null }> => {
  let subscription = await readNotesSubscription();
  const now = new Date().toISOString();

  if (worthReVerifying(subscription, now) && subscription) {
    const verdict = await askStore({
      store: subscription.store,
      receiptId: subscription.storeTransactionId,
    });
    if (verdict.ok) {
      const written = await recordNotesSubscription(userId, verdict.subscription);
      if (written.ok) subscription = written.subscription;
    }
  }

  // Asked only where nothing is being paid for, which is the one case it can
  // change the answer — a subscriber costs no extra query.
  const live = notesPlan({ subscription, now });
  if (mayCaptureNotes(live)) return { plan: live, subscription };

  return {
    plan: notesPlan({ subscription, firstCapturedAt: await firstCapture(), now }),
    subscription,
  };
};

export type NotesGate = { ok: true; user: User; plan: NotesPlan } | { ok: false; response: Response };

/**
 * The one gate: signed in, and paid up enough to send a note.
 *
 * **What it decides is sending, and nothing else.** Reading notes back,
 * correcting one that is still waiting, deleting one, and everything the desk
 * does with notes it already has never ask this — which is why it is named for
 * the act rather than for the subscription.
 */
export const requireNotesCapture = async (): Promise<NotesGate> => {
  const user = await currentUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  }

  const { plan } = await notesPlanFor(user.id);
  if (!mayCaptureNotes(plan)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: notesRefusal(plan) ?? 'Notes needs a subscription.',
          plan,
          // Named so a client can tell *not subscribed* from *not signed in*
          // without reading the sentence, and offer the right thing.
          subscription: false,
        },
        { status: 402 },
      ),
    };
  }

  return { ok: true, user, plan };
};
