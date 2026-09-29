import { NextResponse } from 'next/server';
import {
  WAITING_STATUSES,
  captureFromRow,
  captureItemSchema,
  captureReviewToRow,
  type CaptureItem,
} from '@vcwriter/domain';
import { currentUser, serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The desk's door to the phone's notes (addendum 09 §15).
 *
 * `/api/notes` is the **phone's** door — what it posts, and the reviewable copy
 * it reads back. This is the other end of the same queue: what is still waiting
 * to be placed, and the one write that marks a note placed. The desktop
 * application talks to Supabase directly (`apps/desktop/src/main/cloud.ts`) and
 * needs none of this; **the browser preview cannot**, having no keychain and a
 * content security policy of `connect-src 'self'` — and the preview is served
 * from vc-writer.com behind the administrator gate, so the session cookie that
 * fetched the page is already good here. That is `reviewScene`'s argument,
 * which is the only other cloud call the preview makes.
 *
 * **The query is the same query, said once in each host, and what stops them
 * drifting is that the part worth getting wrong is in the domain.**
 * `WAITING_STATUSES` is what *waiting* means and `captureReviewToRow` is what a
 * resolution writes, so neither host decides either for itself.
 */

/**
 * What is still waiting for this project.
 *
 * A note with **no project** belongs to whichever project is open — the writer
 * had not decided yet, and the desk is where they decide — which is why this is
 * an `or` rather than an equality, and why it is not the phone's own `GET`.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get('project');

  let query = serverClient()
    .from('capture_items')
    .select('*')
    .in('status', [...WAITING_STATUSES])
    .order('captured_at', { ascending: false })
    .limit(200);
  if (projectId) query = query.or(`project_id.eq.${projectId},project_id.is.null`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const notes: CaptureItem[] = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    captureFromRow(row as Parameters<typeof captureFromRow>[0]),
  );
  return NextResponse.json({ notes });
}

/**
 * Record what was done with a note.
 *
 * **The project change is made in the renderer with the domain functions and
 * this only writes back the outcome** — which is `resolveCapture`'s own
 * sentence on the desktop, and the reason `captureReviewToRow` touches four
 * columns and never `raw_text`: a wrong call can be read back and redone (§9).
 * The shape is the permission here as elsewhere, since what is written is that
 * function's four fields and not whatever a caller put in the body.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = captureItemSchema.safeParse(
    ((await request.json().catch(() => ({}))) as { capture?: unknown }).capture,
  );
  if (!parsed.success) return NextResponse.json({ error: 'That is not a note.' }, { status: 400 });

  const { error } = await serverClient()
    .from('capture_items')
    .update(captureReviewToRow(parsed.data))
    .eq('id', parsed.data.id as string);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ resolved: true });
}
