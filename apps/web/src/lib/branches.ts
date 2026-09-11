import { createHash } from 'node:crypto';
import {
  branchNameFor,
  branchSchema,
  canOpenBranch,
  versionSchema,
  type Branch,
  type BranchRefusal,
  type RoomRole,
  type Version,
  type VersionKind,
} from '@vcwriter/domain';
import { adminClient, serverClient } from './supabase';

/**
 * Branches and versions: the data layer (addendum 07, stage 3).
 *
 * **Everything here reads and writes as the visitor**, not as the server. That
 * is the opposite of `rooms.ts`, and deliberately so: inviting somebody writes
 * a row about a person who is not the caller, but a draft is the caller's own,
 * and row-level security is what should be deciding whether they may have it.
 * The one exception is opening a branch for the first time, which needs to read
 * the master version somebody else made.
 *
 * A **document** is the same `ProjectFile` the desktop writes to a file. Not a
 * second shape for a project — the same one, which is what lets the renderer
 * run over this bridge without knowing it is doing so (§3.1).
 */

interface BranchRow {
  id: string;
  room_id: string;
  owner_id: string;
  name: string;
  base_version_id: string | null;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  id: string;
  room_id: string;
  branch_id: string | null;
  author_id: string | null;
  parent_version_id: string | null;
  kind: VersionKind;
  label: string;
  summary: string;
  content_hash: string;
  created_at: string;
}

const branchFromRow = (row: BranchRow): Branch =>
  branchSchema.parse({
    id: row.id,
    roomId: row.room_id,
    ownerId: row.owner_id,
    name: row.name,
    baseVersionId: row.base_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

const versionFromRow = (row: VersionRow): Version =>
  versionSchema.parse({
    id: row.id,
    roomId: row.room_id,
    branchId: row.branch_id,
    authorId: row.author_id,
    parentVersionId: row.parent_version_id,
    kind: row.kind,
    label: row.label,
    summary: row.summary,
    contentHash: row.content_hash,
    createdAt: row.created_at,
  });

/**
 * What a document hashes to.
 *
 * The same question the desktop asks — "has anything actually changed" — so
 * autosave can decline to write, and a snapshot can decline to record a draft
 * nobody has touched. Over the whole document rather than a field of it,
 * because a hash that misses a change is worse than no hash.
 */
export const hashDocument = (document: unknown): string =>
  createHash('sha256').update(JSON.stringify(document)).digest('hex');

// ------------------------------------------------------------ the branch

export interface OpenedBranch {
  branch: Branch;
  document: unknown;
  contentHash: string;
}

/**
 * The writer's draft, made if they do not have one yet.
 *
 * **A new branch is taken from the room's master**, and from the project's own
 * rows only where no master has been made yet — which is the state every room
 * starts in. Either way the writer begins from what the room has agreed, not
 * from an empty file.
 */
export const openBranch = async (input: {
  roomId: string;
  projectId: string;
  userId: string;
  role: RoomRole | null;
  displayName: string;
}): Promise<OpenedBranch | BranchRefusal> => {
  const refusal = canOpenBranch(input.role);
  if (refusal) return refusal;

  const db = serverClient();
  const { data: existing } = await db
    .from('branches')
    .select('*')
    .eq('room_id', input.roomId)
    .eq('owner_id', input.userId)
    .maybeSingle();

  if (existing) {
    const branch = branchFromRow(existing as BranchRow);
    const { data: head } = await db
      .from('branch_heads')
      .select('document, content_hash')
      .eq('branch_id', branch.id)
      .maybeSingle();
    const row = head as { document: unknown; content_hash: string } | null;
    if (row) return { branch, document: row.document, contentHash: row.content_hash };

    // A branch whose head never landed: take it from the room again rather
    // than handing back a draft that is not there.
    const fresh = await documentToStartFrom(input.roomId, input.projectId);
    return seedHead(branch, fresh);
  }

  const fresh = await documentToStartFrom(input.roomId, input.projectId);
  const { data: made, error } = await db
    .from('branches')
    .insert({
      room_id: input.roomId,
      owner_id: input.userId,
      name: branchNameFor(input.displayName),
      base_version_id: fresh.fromVersionId,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  return seedHead(branchFromRow(made as BranchRow), fresh);
};

const seedHead = async (
  branch: Branch,
  fresh: { document: unknown; fromVersionId: string | null },
): Promise<OpenedBranch> => {
  const contentHash = hashDocument(fresh.document);
  const { error } = await serverClient()
    .from('branch_heads')
    .upsert({ branch_id: branch.id, document: fresh.document, content_hash: contentHash });
  if (error) throw new Error(error.message);
  return { branch, document: fresh.document, contentHash };
};

/**
 * What a new branch starts from: the room's master, or the project itself.
 *
 * Reads the master with the service role because a version another writer
 * authored is not readable by this one until it *is* the master — and by then
 * the policy allows it, so this is belt and braces rather than a way round the
 * rule. The room membership was already checked before we got here.
 */
const documentToStartFrom = async (
  roomId: string,
  projectId: string,
): Promise<{ document: unknown; fromVersionId: string | null }> => {
  const admin = adminClient();
  const { data: room } = await admin
    .from('rooms')
    .select('master_version_id')
    .eq('id', roomId)
    .maybeSingle();

  const masterId = (room as { master_version_id: string | null } | null)?.master_version_id ?? null;
  if (masterId) {
    const { data: version } = await admin
      .from('versions')
      .select('id, document')
      .eq('id', masterId)
      .maybeSingle();
    const row = version as { id: string; document: unknown } | null;
    if (row) return { document: row.document, fromVersionId: row.id };
  }

  // No master yet, which is where every room begins. The project's own rows,
  // assembled the way the desktop assembles them.
  const { projectDocument } = await import('./project-document');
  return { document: await projectDocument(projectId), fromVersionId: null };
};

/**
 * Autosave.
 *
 * Declines to write when nothing changed, exactly as the desktop's save does —
 * the writer's `previousHash` is what says so, and a matching one means the
 * keystroke that triggered this did not alter the document.
 */
export const saveBranch = async (input: {
  branchId: string;
  document: unknown;
  previousHash?: string;
}): Promise<{ contentHash: string; written: boolean }> => {
  const contentHash = hashDocument(input.document);
  if (input.previousHash && input.previousHash === contentHash) return { contentHash, written: false };

  const { error } = await serverClient()
    .from('branch_heads')
    .upsert({
      branch_id: input.branchId,
      document: input.document,
      content_hash: contentHash,
      saved_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
  return { contentHash, written: true };
};

// ----------------------------------------------------------- the history

/** Every version this person is allowed to see in this room, newest first. */
export const versionsFor = async (roomId: string): Promise<Version[]> => {
  const { data } = await serverClient()
    .from('versions')
    .select('id, room_id, branch_id, author_id, parent_version_id, kind, label, summary, content_hash, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });
  return ((data ?? []) as VersionRow[]).map(versionFromRow);
};

/**
 * A point on the branch, kept for good.
 *
 * The head is copied into a version rather than moved: the writer carries on
 * from where they were, and what was recorded stops being theirs to change
 * (the database refuses it outright, §1).
 */
export const takeSnapshot = async (input: {
  roomId: string;
  branchId: string;
  userId: string;
  label: string;
  summary?: string;
}): Promise<Version | { reason: 'nothing_to_record' }> => {
  const db = serverClient();
  const { data: head } = await db
    .from('branch_heads')
    .select('document, content_hash')
    .eq('branch_id', input.branchId)
    .maybeSingle();
  const desk = head as { document: unknown; content_hash: string } | null;
  if (!desk) return { reason: 'nothing_to_record' };

  const { data: last } = await db
    .from('versions')
    .select('id, content_hash')
    .eq('branch_id', input.branchId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const previous = last as { id: string; content_hash: string } | null;

  const { data, error } = await db
    .from('versions')
    .insert({
      room_id: input.roomId,
      branch_id: input.branchId,
      author_id: input.userId,
      parent_version_id: previous?.id ?? null,
      kind: 'snapshot',
      label: input.label,
      summary: input.summary ?? '',
      document: desk.document,
      content_hash: desk.content_hash,
    })
    .select('id, room_id, branch_id, author_id, parent_version_id, kind, label, summary, content_hash, created_at')
    .single();
  if (error) throw new Error(error.message);
  return versionFromRow(data as VersionRow);
};

/**
 * Putting an earlier version back on the desk.
 *
 * **Restoring adds; it never removes.** The versions made after this one are
 * untouched and still there, because §1 says nothing in the Room's vocabulary
 * means gone — so restoring the wrong one is undone by restoring the other.
 */
export const restoreVersion = async (input: {
  branchId: string;
  versionId: string;
}): Promise<{ document: unknown; contentHash: string } | { reason: 'no_such_version' }> => {
  const { data } = await serverClient()
    .from('versions')
    .select('document, content_hash')
    .eq('id', input.versionId)
    .maybeSingle();
  const version = data as { document: unknown; content_hash: string } | null;
  if (!version) return { reason: 'no_such_version' };

  await saveBranch({ branchId: input.branchId, document: version.document });
  return { document: version.document, contentHash: version.content_hash };
};
