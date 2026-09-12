import {
  parseProjectFile,
  trayItemSchema,
  type MergeRecord,
  type ProjectFile,
  type TrayPiece,
  type TrayHow,
  type TrayItem,
  type TrayKind,
  type Version,
} from '@vcwriter/domain';
import { adminClient, serverClient } from './supabase';
import { hashDocument, versionWithDocument } from './branches';
import { projectDocument } from './project-document';

/**
 * The Curation Tray and the master merge: the data layer (addendum 07 §12).
 *
 * **The merge writes one row and changes none.** Committing inserts a master
 * version beside the one before it and points the room at the new one; nothing
 * here updates a submission's document, a branch head, or the version a piece
 * came out of — the database would refuse the last of those anyway, and does,
 * even for the service role.
 */

interface TrayRow {
  id: string;
  room_id: string;
  submission_id: string | null;
  version_id: string;
  author_id: string;
  kind: TrayKind;
  record_id: string;
  label: string;
  how: TrayHow;
  into_unit_id: string | null;
  note: string;
  order_key: string;
  created_at: string;
}

const COLUMNS =
  'id, room_id, submission_id, version_id, author_id, kind, record_id, label, how, into_unit_id, note, order_key, created_at';

const fromRow = (row: TrayRow): TrayItem =>
  trayItemSchema.parse({
    id: row.id,
    roomId: row.room_id,
    submissionId: row.submission_id,
    versionId: row.version_id,
    authorId: row.author_id,
    kind: row.kind,
    recordId: row.record_id,
    label: row.label,
    how: row.how,
    intoUnitId: row.into_unit_id,
    note: row.note,
    orderKey: row.order_key,
    createdAt: row.created_at,
  });

/**
 * What is in the tray, in the order it will be taken.
 *
 * Read as the visitor, and the policy answers: a writer sees nothing here at
 * all. The tray is the showrunner's workbench rather than the room's
 * noticeboard — a writer watching their scene sit in it for three days learns
 * nothing they can act on.
 */
export const trayIn = async (roomId: string): Promise<TrayItem[]> => {
  const { data } = await serverClient()
    .from('curation_items')
    .select(COLUMNS)
    .eq('room_id', roomId)
    .order('order_key', { ascending: true });
  return ((data ?? []) as TrayRow[]).map(fromRow);
};

export type TrayFailure = { reason: 'refused'; message: string };

export const takeIntoTray = async (input: {
  roomId: string;
  submissionId: string | null;
  versionId: string;
  authorId: string;
  kind: TrayKind;
  recordId: string;
  label: string;
  how: TrayHow;
  intoUnitId: string | null;
  orderKey: string;
}): Promise<TrayItem | TrayFailure> => {
  const { data, error } = await serverClient()
    .from('curation_items')
    .insert({
      room_id: input.roomId,
      submission_id: input.submissionId,
      version_id: input.versionId,
      author_id: input.authorId,
      kind: input.kind,
      record_id: input.recordId,
      label: input.label,
      how: input.how,
      into_unit_id: input.intoUnitId,
      order_key: input.orderKey,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    // The unique constraint, said in words: taking the same piece twice is a
    // mistake rather than an intention.
    const already = error.code === '23505';
    return {
      reason: 'refused',
      message: already ? 'That piece is already in the tray.' : 'That is not yours to curate.',
    };
  }
  return fromRow(data as TrayRow);
};

/** How a piece will be taken, and where a beat joins. */
export const setTrayItem = async (input: {
  itemId: string;
  how?: TrayHow;
  intoUnitId?: string | null;
  note?: string;
}): Promise<TrayItem | TrayFailure> => {
  const patch: Record<string, unknown> = {};
  if (input.how !== undefined) patch['how'] = input.how;
  if (input.intoUnitId !== undefined) patch['into_unit_id'] = input.intoUnitId;
  if (input.note !== undefined) patch['note'] = input.note;

  const { data, error } = await serverClient()
    .from('curation_items')
    .update(patch)
    .eq('id', input.itemId)
    .select(COLUMNS)
    .maybeSingle();

  if (error || !data) return { reason: 'refused', message: 'That is not yours to change.' };
  return fromRow(data as TrayRow);
};

/**
 * Take a piece back out of the tray.
 *
 * **The one delete in the whole Room, and it is the right one** (§1). It
 * destroys nothing: the submission is untouched, the version it came from
 * cannot be changed, and the piece is exactly where it was. The tray is a
 * scratch surface, and a tray that could not be cleared would make a
 * showrunner commit things to be rid of them.
 */
export const dropFromTray = async (itemId: string): Promise<boolean> => {
  const { error } = await serverClient().from('curation_items').delete().eq('id', itemId);
  return !error;
};

/**
 * Commit the merge: a new master version, and the room pointed at it.
 *
 * Two writes, in this order, and the order matters. The version first, because
 * a room pointed at a version that does not exist is a room nobody can open;
 * the pointer second, because until it moves the master is still the old one
 * and nothing has changed for anybody.
 *
 * **The pointer moves as the server**, like `writeResearch` and for the same
 * reason: `rooms` is written by whoever may write the *project*, and a
 * co-showrunner holds the room's owner seat without owning the project. Whether
 * this person may curate at all was `canCurate`'s question, and the route asks
 * it before this is called. The version itself is inserted as the visitor,
 * because the policy can answer that one on its own — and since 0034 it does.
 */
export const commitMerge = async (input: {
  roomId: string;
  userId: string;
  label: string;
  summary: string;
  document: unknown;
  record: MergeRecord;
  parentVersionId: string | null;
}): Promise<Version | TrayFailure> => {
  const { data, error } = await serverClient()
    .from('versions')
    .insert({
      room_id: input.roomId,
      branch_id: null,
      author_id: input.userId,
      parent_version_id: input.parentVersionId,
      kind: 'master',
      label: input.label,
      summary: input.summary,
      document: input.document,
      content_hash: hashDocument(input.document),
      merge: input.record,
    })
    .select('id, room_id, branch_id, author_id, parent_version_id, kind, label, summary, content_hash, created_at')
    .single();

  if (error || !data) {
    return { reason: 'refused', message: 'Assembling a master is the showrunner’s.' };
  }

  const made = data as {
    id: string;
    room_id: string;
    branch_id: string | null;
    author_id: string;
    parent_version_id: string | null;
    kind: string;
    label: string;
    summary: string;
    content_hash: string;
    created_at: string;
  };

  const { error: pointed } = await adminClient()
    .from('rooms')
    .update({ master_version_id: made.id })
    .eq('id', input.roomId);
  if (pointed) throw new Error(pointed.message);

  return {
    id: made.id,
    roomId: made.room_id,
    branchId: made.branch_id,
    authorId: made.author_id,
    parentVersionId: made.parent_version_id,
    kind: 'master',
    label: made.label,
    summary: made.summary,
    contentHash: made.content_hash,
    createdAt: made.created_at,
  };
};

/** Empty the tray once its pieces are in the master. */
export const clearTray = async (roomId: string): Promise<void> => {
  await serverClient().from('curation_items').delete().eq('room_id', roomId);
};

// ------------------------------------------------------ assembling the pieces

/**
 * The tray's pieces, read out of the versions they came from.
 *
 * **One read per version rather than one per piece**, because a tray usually
 * holds several scenes out of the same pass and reading that document four
 * times would be four times the work for the same answer.
 *
 * A version that cannot be read — the submission withdrawn, the reader's
 * standing changed — yields no piece rather than an error: `applyTray` says
 * which one is missing, in words, and a tray that refused to render because one
 * row went stale would be a tray nobody could fix.
 */
export const piecesFor = async (tray: readonly TrayItem[]): Promise<TrayPiece[]> => {
  const wanted = [...new Set(tray.map((item) => item.versionId))];
  const read = await Promise.all(
    wanted.map(async (versionId) => {
      const found = await versionWithDocument(versionId);
      return [versionId, found ? parseProjectFile(found.document) : null] as const;
    }),
  );
  const byVersion = new Map(read);

  return tray.flatMap((item): TrayPiece[] => {
    const file = byVersion.get(item.versionId);
    if (!file) return [];

    if (item.kind === 'scene') {
      const unit = file.units.find((one) => (one.id as string) === item.recordId) ?? null;
      if (!unit) return [];
      return [
        {
          item,
          unit,
          beats: file.beats
            .filter((beat) => (beat.unitId as string) === (unit.id as string))
            .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1)),
        },
      ];
    }

    const beat = file.beats.find((one) => (one.id as string) === item.recordId);
    return beat ? [{ item, unit: null, beats: [beat] }] : [];
  });
};

/**
 * The master as it stands, and the version it is.
 *
 * The room's master version where there is one, and the project's own rows
 * where there is not — which is where every room begins, and the same answer
 * `openBranch` gives a writer taking their first branch.
 */
export const masterNow = async (
  roomId: string,
  projectId: string,
): Promise<{ file: ProjectFile; versionId: string | null }> => {
  const { data: room } = await adminClient()
    .from('rooms')
    .select('master_version_id')
    .eq('id', roomId)
    .maybeSingle();

  const masterId = (room as { master_version_id: string | null } | null)?.master_version_id ?? null;
  if (masterId) {
    const found = await versionWithDocument(masterId);
    if (found) return { file: parseProjectFile(found.document), versionId: masterId };
  }

  return { file: await projectDocument(projectId), versionId: null };
};
