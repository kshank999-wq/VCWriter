import { NextResponse } from 'next/server';
import {
  captureFromRow,
  readUploadBatch,
  uploadToRow,
  type CaptureItem,
} from '@vcwriter/domain';
import { currentUser, serverClient } from '@/lib/supabase';
import { requireNotesCapture } from '@/lib/notes-subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The door the phone posts through (addendum 09 §6, stage 2).
 *
 * The web capture page writes to the database directly and will go on doing so;
 * this exists because §14 asks for an endpoint, and because a companion app
 * built by somebody else — native or otherwise — should not need this project's
 * row-level-security rules in its head to send a note. It is deliberately thin:
 * the payload is `captureUploadBatchSchema` from the domain and the row is
 * `uploadToRow`, so there is **one** definition of what a phone may send and no
 * second copy here to drift from it.
 *
 * **Idempotent, because §11 asks for it and the database already enforces it.**
 * `client_capture_id` is unique per user (migration 0003), so a Sync press that
 * actually worked and then got retried upserts the same row rather than making
 * a second note. The id is made on the device when the note is saved — never at
 * send time, or a retry would make a new one.
 *
 * Everything is written as the caller's own session, so a note can only ever be
 * filed under the person who sent it. Nothing here trusts a user id in a body.
 */

export async function POST(request: Request): Promise<Response> {
  // Sending is the one thing the subscription decides (addendum 27 §14).
  // Reading, correcting and deleting are below and in `[noteId]`, and none of
  // them asks: a lapse never reaches a note somebody has already made.
  const gate = await requireNotesCapture();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  // Note by note (addendum 27 §17): one note the server will not take used to
  // refuse the whole batch, and every note queued behind it waited forever.
  const read = readUploadBatch(await request.json().catch(() => ({})));
  if (!read) return NextResponse.json({ error: 'That is not a note.' }, { status: 400 });

  const now = new Date().toISOString();
  const rows = read.notes.map((note) => uploadToRow(note, user.id, now));

  let accepted: string[] = [];
  if (rows.length > 0) {
    const { data, error } = await serverClient()
      .from('capture_items')
      .upsert(rows, { onConflict: 'user_id,client_capture_id', ignoreDuplicates: false })
      .select('client_capture_id');

    if (error) return NextResponse.json({ error: error.message, refused: read.refused }, { status: 400 });

    // The ids that landed, so a client can mark exactly those synced rather than
    // assuming the whole batch went through.
    accepted = ((data ?? []) as { client_capture_id: string | null }[])
      .map((row) => row.client_capture_id)
      .filter((id): id is string => typeof id === 'string');
  }

  return NextResponse.json({ accepted, count: accepted.length, refused: read.refused });
}

/**
 * What this project has caught (addendum 09 §7, stage 3).
 *
 * Everything the caller captured for one project, newest first — including
 * what has already been placed, because §9 wants the phone to keep a reviewable
 * copy after syncing rather than appearing to lose it. Which of those may still
 * be changed is `mayStillEdit` in the domain, and the database says the same
 * thing in migration 0042.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get('project');

  let query = serverClient()
    .from('capture_items')
    .select('*')
    // Cleared off the phone, kept in the desk's archive (addendum 27 §29).
    .is('cleared_from_phone_at', null)
    .order('captured_at', { ascending: false })
    .limit(500);
  // No project means the ones caught before a project was chosen, which is a
  // real state §11 allows rather than an empty filter.
  query = projectId ? query.eq('project_id', projectId) : query.is('project_id', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const notes: CaptureItem[] = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    captureFromRow(row as Parameters<typeof captureFromRow>[0]),
  );
  return NextResponse.json({ notes });
}
