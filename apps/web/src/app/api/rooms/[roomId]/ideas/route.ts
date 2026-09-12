import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  canReview,
  fileIdeas,
  fileRefusalText,
  ideasIn,
  parseProjectFile,
  researchItemSchema,
} from '@vcwriter/domain';
import { currentUser } from '@/lib/supabase';
import { loadRoomById } from '@/lib/rooms';
import { versionWithDocument } from '@/lib/branches';
import { decideSubmission, submissionsIn } from '@/lib/submissions';
import { projectDocument, writeResearch } from '@/lib/project-research';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Filing an idea into the room's research (addendum 07 §11, stage 7).
 *
 * **Filing does not consume it.** The submission stays exactly where it is —
 * this copies the chosen items into the project's own research and then marks
 * the submission taken up, which is a fact about the room rather than about the
 * research. §1 is about ideas as much as it is about pages.
 *
 * Only whoever runs the room may file: writing into the project's research is
 * `may_write_project`, which is the owner's, and `canReview` draws the control
 * so a writer is told rather than refused silently.
 */

const schema = z.object({
  submissionId: z.string().uuid(),
  categoryId: z.string().uuid(),
  /** Which of the ideas in it. Empty means all of them. */
  itemIds: z.array(z.string()).default([]),
});

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That is not a filing.' }, { status: 400 });

  const view = await loadRoomById(params.roomId);
  if (!view) return NextResponse.json({ error: 'No such room.' }, { status: 404 });
  if (!canReview(view.role)) {
    return NextResponse.json({ error: 'Filing what the room keeps is the showrunner’s.' }, { status: 403 });
  }

  const submission = (await submissionsIn(view.room.id)).find((one) => one.id === parsed.data.submissionId);
  if (!submission) return NextResponse.json({ error: 'No such submission.' }, { status: 404 });

  const found = await versionWithDocument(submission.versionId);
  if (!found) return NextResponse.json({ error: 'That version is not yours to read.' }, { status: 404 });

  const sentFile = parseProjectFile(found.document);
  const wanted = new Set(parsed.data.itemIds);
  const items = ideasIn(sentFile).filter((item) => wanted.size === 0 || wanted.has(item.id as string));

  const project = await projectDocument(view.room.projectId);
  if (!project) return NextResponse.json({ error: 'The project could not be read.' }, { status: 404 });

  const filed = fileIdeas(project, {
    items: items.map((item) => researchItemSchema.parse(item)),
    categoryId: parsed.data.categoryId as never,
    authorId: submission.authorId,
  });
  if ('reason' in filed) return NextResponse.json({ error: fileRefusalText(filed) }, { status: 409 });

  await writeResearch(filed);

  // Taken up, and still here — which is the whole of §11's promise.
  await decideSubmission({
    submissionId: submission.id,
    to: 'incorporated',
    reply: submission.reply,
    decidedBy: user.id,
  });

  return NextResponse.json({ filed: items.length });
}
