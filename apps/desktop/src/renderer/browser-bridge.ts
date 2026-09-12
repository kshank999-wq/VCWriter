import {
  createProjectFile,
  parseProjectFile,
  printedPageCount,
  projectsNewestFirst,
  renderBoardDocumentHtml,
  renderGridDocumentHtml,
  renderOutlineDocumentHtml,
  renderPrintDocumentHtml,
  renderSheetDocumentHtml,
  serializeProjectFile,
  suggestedExportFileName,
  type ProjectFile,
  type SceneVerdict,
} from '@vcwriter/domain';
import type { DesktopApiResult, OpenResult, VcWriterApi } from '../preload/index';

/**
 * The bridge for the browser preview (docs/deployment.md, "Browser preview").
 *
 * In the desktop application `window.vcwriter` is the preload script's door
 * to the main process: files on disk, snapshots, the cloud, licensing. Here
 * it is the same interface implemented on what a browser has — projects in
 * IndexedDB, the print dialog for PDF, nothing for the cloud — so the
 * renderer runs unchanged at a URL and a change pushed to main is on screen
 * at the next refresh. It exists so the interface can be tried without an
 * installer; it is not the product, and every method it cannot honour says
 * so rather than pretending.
 */

const DB_NAME = 'vcwriter-preview';
const STORE = 'projects';
const NOT_HERE = 'Not available in the browser preview; use the desktop application.';

interface StoredProject {
  path: string;
  file: ProjectFile;
  contentHash: string;
  savedAt: string;
}

const ok = <T>(data: T): DesktopApiResult<T> => ({ ok: true, data });
const fail = <T>(error: string): DesktopApiResult<T> => ({ ok: false, error });

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'path' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB refused to open'));
  });

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    transaction.oncomplete = () => db.close();
  });
};

const readAll = () => withStore<StoredProject[]>('readonly', (store) => store.getAll() as IDBRequest<StoredProject[]>);
const remove = (path: string) => withStore<undefined>('readwrite', (store) => store.delete(path) as IDBRequest<undefined>);
const read = (path: string) =>
  withStore<StoredProject | undefined>('readonly', (store) => store.get(path) as IDBRequest<StoredProject | undefined>);
const write = (record: StoredProject) => withStore<IDBValidKey>('readwrite', (store) => store.put(record));

/**
 * Content hash of a document, ignoring the save timestamp — otherwise every
 * save would differ from the last and the "nothing changed" short-circuit
 * could never fire.
 */
const hashOf = async (file: ProjectFile): Promise<string> => {
  const text = JSON.stringify({ ...file, savedAt: '' });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** A readable, unique "path" for a project kept in the browser. */
const pathFor = async (title: string): Promise<string> => {
  const base = (title.trim() || 'Untitled').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const taken = new Set((await readAll()).map((record) => record.path));
  let candidate = `browser://${base}.vcw`;
  for (let n = 2; taken.has(candidate); n += 1) candidate = `browser://${base} ${n}.vcw`;
  return candidate;
};

const store = async (path: string, file: ProjectFile): Promise<OpenResult> => {
  const contentHash = await hashOf(file);
  await write({ path, file, contentHash, savedAt: new Date().toISOString() });
  return { path, file, contentHash };
};

/** Ask for a .vcw from disk; resolves null when the picker is dismissed. */
const pickFile = (): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vcw,application/json';
    input.style.display = 'none';
    document.body.append(input);
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });

const download = (name: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

type PrintInput = Parameters<VcWriterApi['print']>[0];
type PrintOptions = NonNullable<PrintInput['options']>;

/**
 * The same choice of document the desktop makes (`main/export-pdf.ts`).
 *
 * The preview used to print the script whatever it was asked for, which meant
 * every document but one was unreachable at the URL Ken actually looks at.
 * The renderings are all in `@vcwriter/domain`, so the browser can make the
 * same choice the main process does rather than a poorer one.
 */
const documentFor = (input: PrintInput): string => {
  const options: PrintOptions = input.options ?? {};
  if (input.kind === 'outline') return renderOutlineDocumentHtml(input.file, input.outlineId ?? null, options);
  if (input.kind === 'grid') return renderGridDocumentHtml(input.file, options);
  if (input.kind === 'board') return renderBoardDocumentHtml(input.file, options);
  if (input.kind === 'sheet' || input.file.project.format === 'short_form') {
    return renderSheetDocumentHtml(input.file, options);
  }
  return renderPrintDocumentHtml(input.file, options);
};

const printDocument = (input: PrintInput): boolean => {
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.document.write(documentFor(input));
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
};

export interface BrowserBridge extends VcWriterApi {
  /** The project most recently saved this session, for the download control. */
  current(): { path: string; file: ProjectFile } | null;
  downloadCurrent(): boolean;
}

/**
 * Sections in windows of their own, in a browser.
 *
 * The desktop application asks the main process for a real window; here the
 * browser opens one, which the writer can drag to another monitor exactly the
 * same way. The two windows are the same origin, so the document link between
 * them is a `BroadcastChannel` rather than an IPC relay — the protocol above
 * it (`link.ts`) does not know or care which.
 */
const createPaneWindows = (): VcWriterApi['panes'] => {
  const popups = new Map<string, Window>();
  const listeners = new Set<(panes: string[]) => void>();

  const live = () => {
    for (const [pane, popup] of popups) if (popup.closed) popups.delete(pane);
    return [...popups.keys()];
  };
  const announce = () => {
    const panes = live();
    for (const listener of listeners) listener(panes);
  };

  // A browser gives no event when a window someone else closed goes away, so
  // the set is swept; a second a time is far below noticing and costs nothing.
  if (typeof window !== 'undefined') window.setInterval(announce, 1000);

  return {
    async open(pane) {
      const existing = popups.get(pane);
      if (existing && !existing.closed) {
        existing.focus();
        return ok(true as const);
      }
      const url = new URL(window.location.href);
      url.search = `?pane=${encodeURIComponent(pane)}`;
      const shape = pane.startsWith('beat') || pane === 'script' ? 'width=900,height=1040' : 'width=1280,height=860';
      const popup = window.open(url.toString(), `vcwriter-${pane}`, `popup=yes,${shape}`);
      if (!popup) return fail<true>('The browser blocked the new window — allow pop-ups for this site.');
      popups.set(pane, popup);
      announce();
      return ok(true as const);
    },
    async close(pane) {
      popups.get(pane)?.close();
      popups.delete(pane);
      announce();
      return ok(true as const);
    },
    async list() {
      return ok(live());
    },
    onChanged(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    self: () => new URLSearchParams(window.location.search).get('pane'),
  };
};

const createLink = (): VcWriterApi['link'] => {
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('vcwriter-link') : null;
  return {
    send: (message) => channel?.postMessage(message),
    subscribe(handler) {
      if (!channel) return () => undefined;
      const listener = (event: MessageEvent) => handler(event.data as Record<string, unknown>);
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
  };
};

export const createBrowserBridge = (): BrowserBridge => {
  let current: { path: string; file: ProjectFile } | null = null;

  return {
    panes: createPaneWindows(),
    link: createLink(),
    // A browser has no application menu, so the bar in the window is the
    // only one there is and nothing needs installing.
    menu: {
      install: async () => ok(true as const),
      onCommand: () => () => undefined,
      native: () => false,
    },

    async createProject(input) {
      try {
        const file = createProjectFile(input);
        const result = await store(await pathFor(input.title), file);
        current = { path: result.path, file };
        return ok(result);
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    async openProject() {
      try {
        const picked = await pickFile();
        if (!picked) return fail('No file chosen');
        const file = parseProjectFile(JSON.parse(await picked.text()));
        const result = await store(await pathFor(file.project.title), file);
        current = { path: result.path, file };
        return ok(result);
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    async openProjectAtPath(path) {
      try {
        const record = await read(path);
        if (!record) return fail('That project is no longer in this browser');
        const file = parseProjectFile(record.file);
        current = { path, file };
        return ok({ path, file, contentHash: record.contentHash });
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    async saveProject(input) {
      try {
        const contentHash = await hashOf(input.file);
        current = { path: input.path, file: input.file };
        if (contentHash === input.previousHash) return ok({ contentHash, written: false });
        await write({ path: input.path, file: input.file, contentHash, savedAt: new Date().toISOString() });
        return ok({ contentHash, written: true });
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    async recentProjects() {
      try {
        const records = await readAll();
        records.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
        return ok(records.map((record) => record.path));
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    /**
     * The projects in this browser, as the list a writer deletes from (§3).
     *
     * A size in bytes is a question this store cannot answer without reading
     * every project back out, so it does not pretend to: the row says what it
     * is and when it was written, and nothing about how big it is.
     */
    async listProjects() {
      try {
        const records = await readAll();
        return ok(
          projectsNewestFirst(
            records.map((record) => ({
              path: record.path,
              title: record.file.project.title,
              savedAt: record.savedAt,
              sizeBytes: null,
              missing: false,
            })),
          ),
        );
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    /**
     * Out of the browser's store for good.
     *
     * A browser has no bin to put it in, so this one really is final — which
     * is why `recoverable` is false and the question says so before it is
     * asked rather than after it is answered.
     */
    async deleteProject(path) {
      try {
        await remove(path);
        if (current?.path === path) current = null;
        return ok({ deleted: true, recoverable: false });
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    listSnapshots: async () => ok([]),
    restoreSnapshot: async () => fail(NOT_HERE),

    async exportPdf(input) {
      if (!printDocument(input)) return fail('The browser blocked the print window');
      // Only the manuscript is paginated by hand; the browser decides the rest
      // as it lays them out, and it has not laid them out yet.
      const pageCount = input.kind && input.kind !== 'script' ? 0 : printedPageCount(input.file, input.options ?? {});
      return ok({ path: "your browser's Save as PDF", pageCount });
    },

    async print(input) {
      return ok(printDocument(input));
    },

    appInfo: async () => ok({ version: 'preview', platform: 'browser' }),

    accountStatus: async () => ok({ configured: false, signedIn: false, email: null }),
    requestSignInCode: async () => fail(NOT_HERE),
    verifySignInCode: async () => fail(NOT_HERE),
    signOut: async () => ok(true as const),
    syncProject: async () => fail(NOT_HERE),
    // The Writers Room from the *desktop* (addendum 07 §14). Refused here, and
    // the refusal is the honest answer rather than a gap: a project open in the
    // browser already lives where the room does, so there is no local copy to
    // be ahead or behind of, nothing to send up and nothing to fetch down.
    roomStanding: async () => fail('This project is already in the room.'),
    contributeToRoom: async () => fail('Use Submit — this project is already in the room.'),
    fetchRoomMaster: async () => fail('This project is already in the room.'),
    listCaptures: async () => ok([]),
    resolveCapture: async () => fail(NOT_HERE),
    /**
     * The one cloud call the preview can honestly make.
     *
     * Everything else here is unavailable because a browser has no keychain
     * and no files; this is different. The preview is served from
     * vc-writer.com behind the administrator gate, so the same session cookie
     * that got the page is already good for the site's own API — no token to
     * hold, no key to ship, same origin, and the content security policy
     * allows it (`connect-src 'self'`).
     */
    async reviewScene(input) {
      try {
        const response = await fetch('/api/ai/scene-review', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        });
        const payload = (await response.json().catch(() => null)) as
          | { verdict?: SceneVerdict; error?: string }
          | null;
        if (!response.ok || !payload?.verdict) {
          return fail(payload?.error ?? `The structural read failed (${response.status})`);
        }
        return ok(payload.verdict);
      } catch {
        return fail('The structural read could not be sent. Check your connection.');
      }
    },

    async sceneReviewStatus() {
      try {
        const response = await fetch('/api/ai/scene-review', { credentials: 'same-origin' });
        const payload = (await response.json().catch(() => null)) as
          | { configured?: boolean; entitled?: boolean; reason?: string | null }
          | null;
        if (!response.ok || !payload) return ok({ available: false, reason: 'AI review could not be reached.' });
        return ok({
          available: payload.configured === true && payload.entitled === true,
          reason: payload.reason ?? null,
        });
      } catch {
        return ok({ available: false, reason: 'AI review could not be reached.' });
      }
    },

    activateLicense: async () => fail(NOT_HERE),
    checkForUpdate: async () => fail(NOT_HERE),
    downloadUpdate: async () => fail(NOT_HERE),
    installUpdate: async () => fail(NOT_HERE),
    reportingSettings: async () => ok({ enabled: false }),
    setReporting: async () => ok({ enabled: false }),
    reportError: async () => ok(false),

    current: () => current,
    downloadCurrent: () => {
      if (!current) return false;
      download(suggestedExportFileName(current.file).replace(/\.pdf$/i, '') + '.vcw', serializeProjectFile(current.file));
      return true;
    },
  };
};
