import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  TRAY_HOWS,
  TRAY_KINDS,
  canCurate,
  curatableFrom,
  orderKeyBetween,
  parseProjectFile,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { versionWithDocument } from '@/lib/branches';
import { takeIntoTray, trayIn } from '@/lib/curation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Taking a piece into the Curation Tray (addendum 07 §12, stage 9).
 *
 * **Taking copies nothing.** A tray row names the version and the record inside
 * it; the contribution is untouched and stays untouched right through the
 * merge, because a version cannot be changed once it exists. What the tray
 * holds is a decision, not a copy of somebody's scene.
 *
 * The label is read out of the version here rather than taken on the client's
 * word — the same reason an assignment resolves its own label (stage 8) — and
 * checking it exists is what stops a tray full of rows that name nothing.
 */

const schema = z.object({
  submissionId: z.string().uuid().nullable().default(null),
  versionId: z.string().uuid(),
  kind: z.enum(TRAY_KINDS),
  recordId: z.string().uuid(),
  how: z.enum(TRAY_HOWS).default('add'),
  intoUnitId: z.string().uuid().nullable().default(null),
});

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const view = await loadRoomById(params.roomId);
  if (!view || !view.role) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canCurate(view.role)) {
    return NextResponse.json({ error: 'The tray is the showrunner’s.' }, { status: 403 });
  }

  return NextResponse.json({ tray: await trayIn(view.room.id) });
}

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a piece.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canCurate(view.role)) {
    return NextResponse.json({ error: 'Assembling a master is the showrunner’s.' }, { status: 403 });
  }

  const found = await versionWithDocument(parsed.data.versionId);
  if (!found) return NextResponse.json({ error: 'That version is not yours to read.' }, { status: 404 });

  const offered = curatableFrom(parseProjectFile(found.document)).find(
    (one) => one.kind === parsed.data.kind && one.id === parsed.data.recordId,
  );
  if (!offered) return NextResponse.json({ error: 'That is not in the version it came from.' }, { status: 404 });

  // A version whose author is gone cannot be curated, because the merge record
  // would name nobody — and a master that cannot say where a scene came from
  // is the one thing §12 is for.
  if (!found.version.authorId) {
    return NextResponse.json({ error: 'That version no longer says who wrote it.' }, { status: 409 });
  }

  // At the end of the tray: the order things are taken in is the order the
  // showrunner put them there, and a merge reads it top to bottom.
  const tray = await trayIn(view.room.id);
  const last = tray[tray.length - 1]?.orderKey ?? null;

  const taken = await takeIntoTray({
    roomId: view.room.id,
    submissionId: parsed.data.submissionId,
    versionId: parsed.data.versionId,
    // Whose contribution it is, which is the version's author — the *record's*
    // own author travels on the record itself and may well be somebody else.
    authorId: found.version.authorId,
    kind: parsed.data.kind,
    recordId: parsed.data.recordId,
    label: offered.label,
    how: parsed.data.how,
    intoUnitId: parsed.data.intoUnitId,
    orderKey: orderKeyBetween(last, null),
  });
  if ('reason' in taken) return NextResponse.json({ error: taken.message }, { status: 409 });

  return NextResponse.json({ item: taken });
}
