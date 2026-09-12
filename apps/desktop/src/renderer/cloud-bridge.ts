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

const UUID = /^[0-9a-f-]{36}$/i;

/** Which room this window is in, if it is in one. */
export const roomFromLocation = (search: string): string | null => {
  const roomId = new URLSearchParams(search).get('room');
  return roomId && UUID.test(roomId) ? roomId : null;
};

/**
 * Which recorded version this window is holding, if it is holding one
 * (addendum 07 §13, stage 5).
 *
 * Without it the window is the writer's own desk, which is what a room opens
 * by default. With it the window is a *reading* of one point in the room's
 * history — this writer's, that writer's, or the master — and several of them
 * sit side by side (§3.4).
 */
export const versionFromLocation = (search: string): string | null => {
  const versionId = new URLSearchParams(search).get('version');
  return versionId && UUID.test(versionId) ? versionId : null;
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

export const createCloudBridge = (roomId: string, versionId: string | null = null): BrowserBridge => {
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
  const readIdentity = async (): Promise<void> => {
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
      // On a desk the reader and the author are the same person. A version
      // window says otherwise below, once it knows whose it is.
      author: you.success ? you.data : null,
      seats,
      showing: body.showing === 'master' ? 'master' : 'contribution',
      readOnly: versionId !== null,
      label: body.roomName ?? '',
    };
    me = identity.you?.userId ?? null;
  };

  /**
   * The version this window holds, fetched once (§13, stage 5).
   *
   * Memoised rather than fetched per caller, because two things want it and
   * they race: the application opens the project, and the interface asks who
   * is in the room. A bar that drew the reader's name because it asked first
   * would be the one mistake §3.4 exists to prevent — so both wait on the same
   * answer, and neither has to know about the other.
   */
  interface ReadVersion {
    version: Version | null;
    author: Seat | null;
    title: string;
    file: unknown;
    error: string | null;
  }

  let versionOnce: Promise<ReadVersion> | null = null;
  const fetchVersion = async (): Promise<ReadVersion> => {
    const response = await fetch(`/api/rooms/${roomId}/versions/${versionId}`, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      return { version: null, author: null, title: '', file: null, error: await asError(response) };
    }

    const body = (await response.json()) as { version: unknown; file: unknown; author: unknown; title?: string };
    const version = versionSchema.safeParse(body.version);
    const author = seatSchema.safeParse(body.author);
    return {
      version: version.success ? version.data : null,
      author: author.success ? author.data : null,
      title: body.title ?? (version.success ? describeVersion(version.data) : ''),
      file: body.file,
      error: null,
    };
  };

  const readVersion = async (): Promise<ReadVersion> => {
    versionOnce ??= fetchVersion();
    const read = await versionOnce;

    if (identity && !read.error) {
      identity = {
        ...identity,
        // Whose draft this is, which is the reader's only where they are also
        // the author. The stamp and the bar follow this, never `you`.
        author: read.author,
        showing: read.version?.kind === 'master' ? 'master' : 'contribution',
        readOnly: true,
        label: read.title,
      };
    }

    return read;
  };

  /** Everything the window needs about the room before it draws anything. */
  const settle = async (): Promise<void> => {
    if (!identity) await readIdentity().catch(() => undefined);
    if (versionId) await readVersion().catch(() => undefined);
  };

  /** The writer's own desk: the branch, made from the master the first time. */
  const openDesk = async (): Promise<DesktopApiResult<{ path: string; file: never; contentHash: string }>> => {
    const [response] = await Promise.all([
      fetch(api, { headers: { accept: 'application/json' } }),
      identity ? Promise.resolve() : readIdentity().catch(() => undefined),
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

  /**
   * A recorded version, opened to read (§13, stage 5).
   *
   * Nothing is made and nothing is written: this is one point in the room's
   * history, and a version cannot be changed once it exists (§9) — the
   * database says so with a trigger, and this window says so before the reader
   * types anything. The `path` is the version's id, so a save that somehow got
   * through would still not be addressing anybody's desk.
   */
  const openVersion = async (): Promise<DesktopApiResult<{ path: string; file: never; contentHash: string }>> => {
    if (!identity) await readIdentity().catch(() => undefined);
    const read = await readVersion();
    if (read.error) return fail(read.error);

    const file = parseProjectFile(read.file);
    current = { path: versionId as string, file };
    return ok({
      path: versionId as string,
      file: file as never,
      contentHash: read.version?.contentHash ?? '',
    });
  };

  const open = versionId ? openVersion : openDesk;

  return {
    ...base,

    // A room already has a project. There is nothing to pick and nothing to
    // create: opening the room *is* opening it, however you got here — which
    // is what `autoOpen` tells the application, so no Welcome screen asks a
    // question that has already been answered.
    autoOpen: () => true,

    async roomIdentity() {
      await settle();
      return identity ? ok(identity) : fail<RoomIdentity>('The room did not say who is in it.');
    },

    /**
     * The writer's name on their own work, as they make it.
     *
     * The renderer calls this on every edit without knowing what it is for:
     * outside a room there is no such method and nothing happens, which is the
     * right answer for a script written alone.
     */
    signWork: (file) => (me && !versionId ? signNewWork(file as ProjectFile, { authorId: me, known }) : file),

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
      // A version is a record, not a desk. Refused here in the same words the
      // database uses, rather than letting autosave discover it (§9).
      if (versionId) return fail('This is a recorded version. It cannot be changed once it exists.');
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
     * A room has one project and it is not this window's to manage.
     *
     * The list is deliberately empty rather than showing the room's project
     * with a Delete beside it: a room's script belongs to the room, and taking
     * it away is a decision made there, by somebody who may not be whoever
     * happens to have this window open (addendum 07 §7).
     */
    /**
     * The one button (§10).
     *
     * Autosave first, so what is sent is what is on the screen — a writer who
     * presses Submit means *this*, not what the timer last happened to write.
     * The room takes the point on the line itself; nothing here copies the
     * draft anywhere.
     */
    async submitWork(input) {
      if (!branchId) return fail('Open your draft first.');
      if (versionId) return fail('This is a recorded version. Submit from your own draft.');

      const held = current?.file;
      if (held) {
        const saved = await fetch(api, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ branchId, file: held }),
        });
        if (!saved.ok) return fail(await asError(saved));
      }

      const response = await fetch(`/api/rooms/${roomId}/submissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: input.kind, note: input.note }),
      });
      if (!response.ok) return fail(await asError(response));

      const body = (await response.json()) as { version?: { label?: string; createdAt?: string } };
      return ok({
        label: body.version?.label ?? input.note,
        at: body.version?.createdAt ?? new Date().toISOString(),
      });
    },

    listProjects: async () => ok([]),
    deleteProject: async () =>
      fail('A room’s project is deleted from the room, not from here.'),

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
      // Restoring puts a version back on a *desk*, and a version window has
      // none. The writer's own window is where that belongs.
      if (versionId) return fail('Open your own draft to put a version back on the desk.');
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
