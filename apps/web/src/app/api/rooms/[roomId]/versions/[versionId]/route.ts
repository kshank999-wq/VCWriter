import { NextResponse } from 'next/server';
import { seatInitials, seatName, windowTitleFor } from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { versionWithDocument } from '@/lib/branches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One recorded version, opened to read (addendum 07 §13, stage 5).
 *
 * This is the route behind *Writer Version* and *Master Script*, and behind
 * several of them side by side (§3.4): a window at `/preview?room=…&version=…`
 * holds this and nothing else.
 *
 * **Whether the caller may read it is the database's answer, not this file's.**
 * A version that is not theirs and is not the room's master comes back as no
 * row at all, so the refusal happens one layer below anything that could be
 * argued with — and this returns the same 404 for *does not exist* and *not
 * yours*, because telling a showrunner which of the two it is would itself say
 * something about a draft that is not theirs (§7, §16).
 */

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string; versionId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });

  const found = await versionWithDocument(params.versionId);
  if (!found || found.version.roomId !== view.room.id) {
    return NextResponse.json({ error: 'That version is not yours to read.' }, { status: 404 });
  }

  const author = view.seats.find((seat) => seat.userId === found.version.authorId) ?? null;

  return NextResponse.json({
    version: found.version,
    file: found.document,
    // The window wears the author's name and colour, not the reader's: a page
    // of Jo's draft is stamped JC whoever is looking at it (§6.1).
    author: author
      ? { ...author, email: '', displayName: seatName(author), initials: seatInitials(author) }
      : null,
    title: windowTitleFor({ version: found.version, author }),
  });
}
