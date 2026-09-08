import {
  createProjectFile,
  parseProjectFile,
  printedPageCount,
  renderPrintDocumentHtml,
  serializeProjectFile,
  suggestedExportFileName,
  type ProjectFile,
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

const printDocument = (file: ProjectFile, options: Parameters<typeof renderPrintDocumentHtml>[1]): boolean => {
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.document.write(renderPrintDocumentHtml(file, options));
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

    listSnapshots: async () => ok([]),
    restoreSnapshot: async () => fail(NOT_HERE),

    async exportPdf(input) {
      const options = input.options ?? {};
      if (!printDocument(input.file, options)) return fail('The browser blocked the print window');
      return ok({ path: "your browser's Save as PDF", pageCount: printedPageCount(input.file, options) });
    },

    async print(input) {
      return ok(printDocument(input.file, input.options ?? {}));
    },

    appInfo: async () => ok({ version: 'preview', platform: 'browser' }),

    accountStatus: async () => ok({ configured: false, signedIn: false, email: null }),
    requestSignInCode: async () => fail(NOT_HERE),
    verifySignInCode: async () => fail(NOT_HERE),
    signOut: async () => ok(true as const),
    syncProject: async () => fail(NOT_HERE),
    listCaptures: async () => ok([]),
    resolveCapture: async () => fail(NOT_HERE),
    reviewScene: async () => fail(NOT_HERE),

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
