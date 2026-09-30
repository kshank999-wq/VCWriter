import { NextResponse } from 'next/server';
import { describeNotesPlan, mayCaptureNotes, mayOfferNotes, notesRefusal, NOTES_PRODUCTS } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { notesPlanFor } from '@/lib/notes-subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where this account stands with Notes (addendum 27 §14).
 *
 * The app asks this when it opens, so it knows whether to show the paywall
 * before the writer has dictated a minute into a queue that will be refused.
 * Every answer on it is a reading of `notesPlan` — the sentence, whether to
 * offer the purchase, whether a note may be sent — so the phone holds no copy of
 * the rule and a screen cannot disagree with a route about who is subscribed.
 *
 * It carries the **product ids** too, because the app has to name them to the
 * shop and one list of them is better than two; the *price* comes from the shop
 * itself, localised, which is both truer and what both shops require.
 */
export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { plan } = await notesPlanFor(user.id);

  return NextResponse.json({
    plan,
    said: describeNotesPlan(plan),
    mayCapture: mayCaptureNotes(plan),
    mayOffer: mayOfferNotes(plan),
    refusal: notesRefusal(plan),
    products: NOTES_PRODUCTS,
  });
}
