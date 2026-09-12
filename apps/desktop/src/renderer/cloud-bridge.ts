import {
  describeVersion,
  knownRecords,
  parseProjectFile,
  seatSchema,
  signNewWork,
  versionSchema,
  type ProjectFile,
  type Seat,
  type Version,
} from '@vcwriter/domain';
import { createBrowserBridge, type BrowserBridge } from './browser-bridge';
import type { DesktopApiResult, RoomIdentity } from '../preload/index';

/**
 * The third bridge: the renderer over a Writers Room (addendum 07 §3.1).
 *
 * The desktop implements `window.vcwriter` against Electron and the file
 * system; the preview implements it against IndexedDB; this implements it
 * against the cloud. **Nothing in `src/renderer` knows which it is** — that was
 * the whole point of the interface, and this is the third time it has paid.
 *
 * It is built *on* the browser bridge rather than beside it, because only a
 * handful of methods differ. Printing, the panes, the document link and the
 * menu are the same in a room as they are anywhere else; what changes is where
 * the project lives, which is exactly the two things §2 said would change.
 *
 * **A `path` here is a branch id.** The renderer passes the path it was given
 * back on every save, so the one string it already carries is the one thing
 * this needs, and no plumbing is added to a component to make a room work.
 */

const ok = <T>(data: T): DesktopApiResult<T> => ({ ok: true, data });
const fail = <T>(error: string): DesktopApiResult<T> => ({ ok: false, error });

/** Which room this window is in, if it is in one. */
export const roomFromLocation = (search: string): string | null => {
  const roomId = new URLSearchParams(search).get('room');
  return roomId && /^[0-9a-f-]{36}$/i.test(roomId) ? roomId : null;
};

interface OpenedBranch {
  branch: { id: string; name: string };
  file: unknown;
  contentHash: string;
}

const asError = async (response: Response): Promise<string> => {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'The room did not answer.';
};

export const createCloudBridge = (roomId: string): BrowserBridge => {
  const base = createBrowserBridge();
  const api = `/api/rooms/${roomId}/branch`;

  /** The branch this window is working on, once it has been opened. */
  let branchId: string | null = null;
  let current: { path: string; file: unknown } | null = null;

  /**
   * Who this writer is, and everything that was in the draft when they opened
   * it. Together they are all that signing needs (§6): on this branch, nobody
   * else can have made what was not there at the start.
   */
  let me: string | null = null;
  let known = new Set<string>();
  let identity: RoomIdentity | null = null;

  /**
   * The room's seats, fetched once when the draft opens.
   *
   * Every badge, bar and stamp reads through this; a failure here costs the
   * colour and nothing else, so it never keeps a writer out of their own draft.
   */
  const loadIdentity = async (): Promise<void> => {
    const response = await fetch(`/api/rooms/${roomId}/identity`, { headers: { accept: 'application/json' } });
    if (!response.ok) return;

    const body = (await response.json()) as RoomIdentity & { seats: unknown[]; you: unknown };
    const seats = body.seats
      .map((row) => seatSchema.safeParse(row))
      .filter((parsed): parsed is { success: true; data: Seat } => parsed.success)
      .map((parsed) => parsed.data);
    const you = seatSchema.safeParse(body.you);

    identity = {
      roomId: body.roomId,
      roomName: body.roomName ?? '',
      role: body.role ?? null,
      you: you.success ? you.data : null,
      seats,
      showing: body.showing === 'master' ? 'master' : 'contribution',
    };
    me = identity.you?.userId ?? null;
  };

  const open = async (): Promise<DesktopApiResult<{ path: string; file: never; contentHash: string }>> => {
    const [response] = await Promise.all([
      fetch(api, { headers: { accept: 'application/json' } }),
      identity ? Promise.resolve() : loadIdentity().catch(() => undefined),
    ]);
    if (!response.ok) return fail(await asError(response));

    const body = (await response.json()) as OpenedBranch;
    // Parsed here rather than trusted: what comes back is the same document a
    // file holds, and it goes through the same migration and the same schema.
    const file = parseProjectFile(body.file);
    branchId = body.branch.id;
    known = knownRecords(file);
    current = { path: body.branch.id, file };
    return ok({ path: body.branch.id, file: file as never, contentHash: body.contentHash });
  };

  return {
    ...base,

    // A room already has a project. There is nothing to pick and nothing to
    // create: opening the room *is* opening it, however you got here — which
    // is what `autoOpen` tells the application, so no Welcome screen asks a
    // question that has already been answered.
    autoOpen: () => true,

    async roomIdentity() {
      if (!identity) await loadIdentity().catch(() => undefined);
      return identity ? ok(identity) : fail<RoomIdentity>('The room did not say who is in it.');
    },

    /**
     * The writer's name on their own work, as they make it.
     *
     * The renderer calls this on every edit without knowing what it is for:
     * outside a room there is no such method and nothing happens, which is the
     * right answer for a script written alone.
     */
    signWork: (file) => (me ? signNewWork(file as ProjectFile, { authorId: me, known }) : file),

    createProject: open,
    openProject: open,
    openProjectAtPath: open,

    /**
     * Autosave, and the one place the writer's name is put on their work.
     *
     * Signing here rather than at every control that can make a scene: there
     * are a dozen of those and there will be more, and none of them should
     * have to know there is a room. What leaves this branch is signed; what
     * was already in it when the branch opened is left alone.
     */
    async saveProject(input) {
      if (!branchId) return fail('Open the draft first.');
      const file = me ? signNewWork(input.file as ProjectFile, { authorId: me, known }) : input.file;
      current = { path: input.path, file };

      const response = await fetch(api, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          branchId,
          file,
          previousHash: input.previousHash,
        }),
      });
      if (!response.ok) return fail(await asError(response));
      return ok((await response.json()) as { contentHash: string; written: boolean });
    },

    // One room, one draft. A list of recent projects is a desktop's question.
    recentProjects: async () => ok(branchId ? [branchId] : []),

    /**
     * The versions this writer may see, as the snapshots the renderer already
     * draws. A version is not quite a snapshot — it is the room's record rather
     * than a local recovery point — but it is the same list in the same place,
     * and giving it a second panel would be giving one idea two homes.
     */
    async listSnapshots() {
      const response = await fetch(`${api}/versions`, { headers: { accept: 'application/json' } });
      if (!response.ok) return fail(await asError(response));

      const body = (await response.json()) as { versions: unknown[] };
      return ok(
        body.versions
          .map((row) => versionSchema.safeParse(row))
          .filter((parsed): parsed is { success: true; data: Version } => parsed.success)
          .map((parsed) => ({
            id: parsed.data.id,
            path: parsed.data.id,
            createdAt: parsed.data.createdAt,
            sizeBytes: 0,
            // Every version in a room was made on purpose; none of them is a
            // timer's doing, and calling one 'before a sync that had
            // conflicts' would be telling a writer something untrue about
            // their own history.
            reason: 'manual' as const,
            label: describeVersion(parsed.data),
          })),
      );
    },

    async restoreSnapshot(input) {
      if (!branchId) return fail('Open the draft first.');

      const response = await fetch(`${api}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'restore', branchId, versionId: input.snapshotId }),
      });
      if (!response.ok) return fail(await asError(response));

      const body = (await response.json()) as { file: unknown; document: unknown; contentHash: string };
      const file = parseProjectFile(body.document ?? body.file);
      current = { path: branchId, file };
      return ok({ path: branchId, file: file as never, contentHash: body.contentHash });
    },

    current: () => (current ? { path: current.path, file: current.file as never } : null),
  };
};
