import { NextResponse } from 'next/server';
import { EDIT_CREDIT_PACKS } from '@vcwriter/domain';
import { resolveCaller } from '@/lib/ai-caller';
import { isAiConfigured } from '@/lib/ai';
import { balanceOf } from '@/lib/edit-credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The writer's edit-credit balance, in words, and the packs on sale
 * (addendum 47). Asked by the account page and by the app's Edit Check before
 * it offers the AI check. Nothing here costs anything.
 */
export async function GET(request: Request): Promise<Response> {
  const caller = await resolveCaller(request);
  if (!caller) {
    return NextResponse.json({ signedIn: false, configured: isAiConfigured(), balance: 0, packs: EDIT_CREDIT_PACKS });
  }
  try {
    return NextResponse.json({ signedIn: true, configured: isAiConfigured(), balance: await balanceOf(caller.userId), packs: EDIT_CREDIT_PACKS });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Credits could not be read' }, { status: 500 });
  }
}
