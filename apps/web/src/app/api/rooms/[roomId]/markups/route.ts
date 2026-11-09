import { NextResponse } from 'next/server';
import { z } from 'zod';
import { describeVersion, markSchema, noticeForMarkup, seatName } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { versionWithDocument } from '@/lib/branches';
import { sendMarkup } from '@/lib/markups';
import { sendRoomNotice } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Send a marked-up version back to its writer (addendum 07 §27).
 *
 * The version is read as the sender, so nobody can mark up a draft they were
 * never allowed to read; who it goes to is the version's own author, never a
 * name the browser supplied.
 */

const schema = z.object({
  versionId: z.string().uuid(),
  marks: z.array(markSchema).max(500),
  note: z.string().max(4000).default(''),
});

export async function POST(request: Request, { params }: { params: { roomId: string } }): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (view.role === 'viewer') {
    return NextResponse.json({ error: 'A viewer reads the room; marking up is for those who write in it.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That markup could not be read.' }, { status: 400 });
  if (parsed.data.marks.length === 0 && !parsed.data.note.trim()) {
    return NextResponse.json({ error: 'Mark something, or say something, before sending.' }, { status: 400 });
  }

  const found = await versionWithDocument(parsed.data.versionId);
  if (!found || found.version.roomId !== view.room.id) {
    return NextResponse.json({ error: 'That version is not yours to read.' }, { status: 404 });
  }

  try {
    const markup = await sendMarkup({
      roomId: view.room.id,
      versionId: found.version.id,
      authorId: user.id,
      recipientId: found.version.authorId,
      marks: parsed.data.marks,
      note: parsed.data.note.trim(),
    });

    const writer = view.seats.find((seat) => seat.userId === found.version.authorId);
    const versionLabel = writer ? `${seatName(writer)}’s ${describeVersion(found.version)}` : describeVersion(found.version);
    const notice = noticeForMarkup({ markup, seats: view.seats, roomName: view.room.name || view.projectTitle, versionLabel });
    if (notice) await sendRoomNotice(notice);

    return NextResponse.json({ markup });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The markup could not be sent.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
