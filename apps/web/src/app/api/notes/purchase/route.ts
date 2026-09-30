import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  describeNotesPlan,
  mayCaptureNotes,
  notesPlan,
  notesStoreSchema,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { recordNotesSubscription } from '@/lib/notes-subscription';
import { askStore } from '@/lib/notes-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A purchase, and a restore, and a refresh (addendum 27 §14.2).
 *
 * **One route for all three, because they are one act.** *I have just bought
 * this*, *I have reinstalled and had the shop hand my purchase back*, and *my
 * subscription renewed last night* all arrive here as the same thing: a receipt
 * identifier, which the server takes to the shop. Three routes would be three
 * answers to *what is this account entitled to*.
 *
 * **The shape is the permission.** The payload has a store and a receipt
 * identifier and nothing else — no state, no period end, no plan, no user id —
 * so a client that decided it was subscribed has nowhere to say so, and a note
 * is always filed under whoever sent it. What the row ends up holding is
 * whatever Apple or Google answered.
 *
 * **A deployment that cannot verify refuses.** `askStore` says so in a sentence
 * rather than trusting the phone because the server has no key, which is the one
 * failure that would quietly make a paid app free.
 */

const schema = z.object({
  store: notesStoreSchema,
  /**
   * Apple's `originalTransactionId`, Google's `purchaseToken`. One field because
   * the shops' names differ and the thing does not: it is the handle the shop
   * answers questions about a subscription by.
   */
  receiptId: z.string().trim().min(1).max(4096),
});

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'That is not a purchase.' }, { status: 400 });
  }

  const verdict = await askStore(parsed.data);
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: verdict.status });
  }

  const written = await recordNotesSubscription(user.id, verdict.subscription);
  if (!written.ok) {
    return NextResponse.json({ error: written.reason }, { status: written.status });
  }

  const plan = notesPlan({ subscription: written.subscription, now: new Date().toISOString() });
  return NextResponse.json({
    plan,
    said: describeNotesPlan(plan),
    mayCapture: mayCaptureNotes(plan),
  });
}
