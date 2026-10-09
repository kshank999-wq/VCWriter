import {
  PROJECT_FORMAT_VERSION,
  copyTitle,
  createProjectFile,
  freeName,
  parseProjectFile,
  printedPageCount,
  projectsNewestFirst,
  renderBoardDocumentHtml,
  renderGridDocumentHtml,
  renderOutlineDocumentHtml,
  renderPrintDocumentHtml,
  renderSheetDocumentHtml,
  serializeProjectFile,
  snapshotsToDrop,
  suggestedBookFileName,
  suggestedExportFileName,
  type CaptureItem,
  type ProjectFile,
  type LearningSuggestion,
  type RecoveryReason,
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
const SNAPSHOTS = 'snapshots';
const NOT_HERE = 'Not available in the browser preview; use the desktop application.';

/**
 * **How many recovery points a project keeps here, and how much room they may
 * take** (addendum 33 §12).
 *
 * The desktop keeps thirty and never thinks about the disk. A browser's
 * storage is a quota shared with every other site, and a project carrying
 * pictures runs to megabytes, so there is a **budget in bytes as well as a
 * count** — the one rule the two hosts do not share, because a disk has no
 * such limit to pass.
 */
const KEEP_SNAPSHOTS = 20;
const SNAPSHOT_BUDGET_BYTES = 40 * 1024 * 1024;

interface StoredProject {
  path: string;
  file: ProjectFile;
  contentHash: string;
  savedAt: string;
}

/**
 * A recovery point, kept as **the bytes rather than the object** — which is
 * what the desktop keeps, and what makes a point written by an older build
 * readable by this one: it is parsed on the way back out like any file.
 */
interface StoredSnapshot {
  id: string;
  path: string;
  createdAt: string;
  reason: RecoveryReason;
  sizeBytes: number;
  text: string;
}

const ok = <T>(data: T): DesktopApiResult<T> => ({ ok: true, data });
const fail = <T>(error: string): DesktopApiResult<T> => ({ ok: false, error });

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    // Version 2 adds the recovery points (§12). The upgrade **adds a store
    // and touches no project**, so a browser that has been writing here for
    // months opens at the new version with everything it had.
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'path' });
      }
      if (!request.result.objectStoreNames.contains(SNAPSHOTS)) {
        const made = request.result.createObjectStore(SNAPSHOTS, { keyPath: 'id' });
        made.createIndex('path', 'path');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB refused to open'));
  });

const withNamed = async <T>(
  name: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(name, mode);
    const request = run(transaction.objectStore(name));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    transaction.oncomplete = () => db.close();
  });
};

const withStore = <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  withNamed(STORE, mode, run);

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
  // Nothing is ever replaced, which is `freeName`'s one rule — the same one
  // the desktop asks when it names a file in a folder (addendum 34).
  return freeName(`browser://${base}`, (candidate) => taken.has(candidate), '.vcw');
};

// ------------------------------------------------------- recovery points

const snapshotsFor = (path: string) =>
  withNamed<StoredSnapshot[]>(SNAPSHOTS, 'readonly', (store) =>
    store.index('path').getAll(path) as IDBRequest<StoredSnapshot[]>,
  );

const putSnapshot = (record: StoredSnapshot) =>
  withNamed<IDBValidKey>(SNAPSHOTS, 'readwrite', (store) => store.put(record));

const dropSnapshot = (id: string) =>
  withNamed<undefined>(SNAPSHOTS, 'readwrite', (store) => store.delete(id) as IDBRequest<undefined>);

/**
 * **Keep a copy of this project as it stands** (addendum 33 §12).
 *
 * Three rules, and the first is the one that matters: **a recovery point must
 * never cost somebody their save.** The quota is the browser's and it can
 * refuse at any moment, so the write is tried, pruned against and tried once
 * more, and if it still will not go the project is saved and nothing is said —
 * a notice about the net while the work itself landed would be a fault report
 * about something that did not fail.
 *
 * The pruning asks the domain (`snapshotsToDrop`), so this host and the
 * desktop throw away the same points, and it runs **after** the new one is in
 * rather than before: pruning to make room first would drop a copy that is
 * still the best there is if the write then fails anyway.
 */
const keepSnapshot = async (path: string, text: string, reason: RecoveryReason): Promise<void> => {
  const createdAt = new Date().toISOString();
  const record: StoredSnapshot = {
    id: `${path}#${createdAt}#${reason}`,
    path,
    createdAt,
    reason,
    sizeBytes: text.length,
    text,
  };
  const prune = async () => {
    const going = snapshotsToDrop(await snapshotsFor(path), {
      keep: KEEP_SNAPSHOTS,
      budgetBytes: SNAPSHOT_BUDGET_BYTES,
    });
    for (const id of going) await dropSnapshot(id).catch(() => undefined);
  };
  try {
    await putSnapshot(record);
  } catch {
    await prune().catch(() => undefined);
    try {
      await putSnapshot(record);
    } catch {
      return;
    }
  }
  await prune().catch(() => undefined);
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
  // The book arrives drawn (addendum 20 §4): its pages exist only where the
  // type was measured, which is this window. Its own `@page` names the trim.
  if (input.kind === 'book') return input.html ?? '';
  if (input.kind === 'outline') return renderOutlineDocumentHtml(input.file, input.outlineId ?? null, options);
  if (input.kind === 'grid') return renderGridDocumentHtml(input.file, options);
  if (input.kind === 'board') return renderBoardDocumentHtml(input.file, options);
  if (input.kind === 'sheet' || input.file.project.format === 'short_form') {
    return renderSheetDocumentHtml(input.file, options);
  }
  return renderPrintDocumentHtml(input.file, options);
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** What the print window is showing, in words: for the banner and the tab. */
const describeDocument = (input: PrintInput): { name: string; what: string } => {
  const title = input.file.project.title || 'Untitled';
  if (input.kind === 'book') {
    const pages = (input.html ?? '').split('class="bk-page').length - 1;
    const paper = input.paper ? `${input.paper.width} × ${input.paper.height} in` : 'its trim';
    return { name: suggestedBookFileName(title).replace(/\.pdf$/, ''), what: `${title} as a book — ${pages} ${pages === 1 ? 'page' : 'pages'} at ${paper}, every page as it stands in the Layout room` };
  }
  return { name: suggestedExportFileName(input.file).replace(/\.pdf$/, ''), what: `${title} — ${input.kind ?? 'the script'}` };
};

/**
 * Which act the window is opened for: a printer, or a file.
 *
 * They are two different asks and only one of them can go wrong in the
 * dialog, which is why the window says different things. *Print…* asks for
 * a printer and the dialog is the whole of it. *Export the book…* asks for
 * **a file**, and in a browser the print dialog is the only road to one —
 * so that road has a destination to choose and a setting to turn off, and
 * getting either wrong is what Ken spent an afternoon on.
 */
type PrintAct = 'print' | 'save';

/** The one control in the print window; its handler is attached, not written. */
const PRINT_BUTTON_ID = 'vcw-print-go';

/**
 * A browser has no `printToPDF`; its print dialog is the only way to a file.
 * The dialog belongs to the browser, so what it stamps on a page — the date,
 * the tab's title, the URL, a page count — is its own setting and not ours,
 * and with a printer chosen (rather than *Save as PDF*) it uses that
 * printer's paper and margins over the document's `@page`. Ken saw exactly
 * that: the book on Letter with a date in the corner and `about:blank` at
 * the foot, and nothing on the screen saying what the thing was. So the
 * window says: a banner above the pages, on the screen and never in the
 * print, naming the document and what to choose; and the tab is named as
 * the file should be, since *Save as PDF* takes its file name from it.
 *
 * **The markup carries no script at all** (addendum 20 §9ah). A window opened
 * with `window.open('')` is `about:blank`, which inherits the opener's
 * content policy — and the preview's is `script-src 'self'`, *no inline
 * scripts*, as its own comment in `preview-gate.ts` says. An `onclick`
 * attribute is an inline script, so the one control in this window was
 * refused and did nothing whatever, while `style-src` carries
 * `'unsafe-inline'` and the banner drew perfectly: **one inline thing
 * allowed and one forbidden, so it looked right and could not act.** The
 * handler is attached from the opener instead, which is its own script and
 * so is allowed.
 */
const bannerHtml = (description: { name: string; what: string }, act: PrintAct): string => {
  const how =
    act === 'save'
      ? `<ul class="vcw-print-how">
        <li>A browser cannot write a PDF by itself, so its print dialog is the one road to the file.</li>
        <li>The destination must be <b>Save as PDF</b>, the browser's own. Everything else on that list is a printer — <i>Microsoft Print to PDF</i> among them — and a printer prints on its own paper, so the book arrives on Letter with its pages shrunk to fit.</li>
        <li>Under <b>More settings</b>, turn <b>Headers and footers</b> off, or the date, the page count and <code>about:blank</code> print on every page.</li>
      </ul>
      <p class="vcw-print-name">The file is named <b>${escapeHtml(description.name)}.pdf</b>.</p>`
      : `<ul class="vcw-print-how">
        <li>Under <b>More settings</b>, turn <b>Headers and footers</b> off, or the date, the page count and <code>about:blank</code> print on every page.</li>
      </ul>`;
  return `<style>
      /* A measure, for the one paragraph in this window that has to be read:
         at a full 1440 the destination sentence ran 200 characters to the
         line, which is the room's own argument said about its own banner. */
      .vcw-print-banner { font: 14px/1.5 system-ui, sans-serif; background: #1f2430; color: #f4f4f6; padding: 14px 20px 16px; }
      .vcw-print-banner > * { max-width: 68ch; }
      .vcw-print-banner p { margin: 0 0 6px; }
      .vcw-print-banner strong { font-weight: 600; }
      .vcw-print-banner .vcw-print-how { margin: 0 0 10px; padding-left: 20px; opacity: 0.85; }
      .vcw-print-banner .vcw-print-how li { margin: 2px 0; }
      .vcw-print-banner .vcw-print-name { opacity: 0.85; }
      .vcw-print-banner code { font-family: ui-monospace, monospace; }
      .vcw-print-banner button { font: inherit; margin-top: 4px; padding: 8px 18px; border-radius: 6px; border: 0; background: #d6b25e; color: #1f2430; cursor: pointer; }
      @media print { .vcw-print-banner { display: none !important; } }
    </style>
    <div class="vcw-print-banner" role="note">
      <p><strong>${escapeHtml(description.what)}.</strong></p>
      ${how}
      <button id="${PRINT_BUTTON_ID}" type="button">${act === 'save' ? 'Save as PDF…' : 'Print…'}</button>
    </div>`;
};

const withBanner = (html: string, description: { name: string; what: string }, act: PrintAct): string => {
  const banner = bannerHtml(description, act);
  const titled = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(description.name)}</title>`);
  return titled.includes('<body>') ? titled.replace('<body>', `<body>${banner}`) : `${banner}${titled}`;
};

/**
 * Open the window on the document, with its banner and a button that works.
 *
 * The listener is added here rather than in the markup for the reason above:
 * a closure made in this window is this window's script, and the policy that
 * refuses an `onclick` attribute has nothing to say about it.
 */
const openPrintWindow = (input: PrintInput, act: PrintAct): Window | null => {
  const popup = window.open('', '_blank');
  if (!popup) return null;
  popup.document.write(withBanner(documentFor(input), describeDocument(input), act));
  popup.document.close();
  popup.document.getElementById(PRINT_BUTTON_ID)?.addEventListener('click', () => popup.print());
  popup.focus();
  return popup;
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
      // The same proportions the desktop's registry gives each kind: a page
      // is tall, a board is wide, an outline is between the two.
      const shape =
        pane.startsWith('beat') || pane === 'script'
          ? 'width=900,height=1040'
          : pane === 'sculptor'
            ? 'width=1400,height=900'
            : pane === 'outliner'
              ? 'width=1040,height=940'
              : 'width=1280,height=860';
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

    /**
     * A browser has no folders, so there is nowhere to choose (addendum 34).
     * It is **said rather than left out**: a panel that simply omitted the row
     * here would read as the feature not being there.
     */
    async projectsFolder() {
      return ok({ path: null, canChoose: false });
    },

    async chooseProjectsFolder() {
      return ok({ path: null, canChoose: false });
    },

    async createProject(input) {
      try {
        // A document given, or an empty one (addendum 33 §10) — the same
        // rule as the desktop's, so an import lands in its own entry here
        // too rather than over the one the writer has open.
        const file = input.file ? parseProjectFile(input.file) : createProjectFile(input);
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
        /**
         * **Before an upgrade rewrites anything** (§12), which is the one
         * recovery point that is the only copy of a document — the desktop
         * has taken it since `loadProject` was written, and the reading is
         * the same: the version the bytes declare, against this build's.
         */
        const declared = (record.file as { formatVersion?: number })?.formatVersion;
        if (typeof declared === 'number' && declared < PROJECT_FORMAT_VERSION) {
          await keepSnapshot(path, JSON.stringify(record.file), 'pre_migration');
        }
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
        /**
         * **The caller was asking all along** (addendum 33 §12). `useProject`
         * has set `snapshot` every twentieth save since autosave was written
         * and this host read the flag and did nothing with it — addendum 09
         * §15's `ok([])` in its third shape, and the one that cost Ken a
         * finished story. Taken after the write, so a recovery point is never
         * a copy of something that failed to save.
         */
        if (input.snapshot) await keepSnapshot(input.path, serializeProjectFile(input.file), 'autosave');
        return ok({ contentHash, written: true });
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    /**
     * Save as, and save a copy, in the preview (addendum 29 §1).
     *
     * **Present rather than refused, because this is the build Ken uses.** The
     * temptation is to say a browser has no folders and leave the two items
     * dead here — which is addendum 09 §15's `ok([])` exactly: a feature that
     * is there, tested and working, and reads as unbuilt from the one chair it
     * is looked at from.
     *
     * A browser has one place rather than many, so there is nothing to ask the
     * writer: the document is written into the preview's own library under a
     * name of its own, and the `browser://` the path carries is **worth
     * saying rather than hiding** — it is the one thing somebody needs to know
     * about a copy made here, that it is in this browser and not on their disk.
     *
     * `pathFor` already refuses to collide and `store` already writes and
     * answers in the shape an open does, so this adds no storage rule of its
     * own; a second one would be a second answer to what a project in a
     * browser is keyed by.
     */
    async saveProjectAs(input) {
      try {
        // The copy says it is one; a save-as is the same book elsewhere. The
        // one place either act touches the document, and never the one the
        // writer stays in — the caller is handed this back and adopts it only
        // where the kind says to.
        const file: ProjectFile =
          input.kind === 'copy'
            ? { ...input.file, project: { ...input.file.project, title: copyTitle(input.file.project.title) } }
            : input.file;
        return ok(await store(await pathFor(file.project.title), file));
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
        /**
         * **The recovery points go with it** (§12). Keeping them would make
         * the row's own sentence — *this cannot be undone in a browser* —
         * untrue, and leave copies nothing can reach, the Recovery page
         * needing an open project to list any.
         */
        for (const record of await snapshotsFor(path).catch(() => [])) {
          await dropSnapshot(record.id).catch(() => undefined);
        }
        if (current?.path === path) current = null;
        return ok({ deleted: true, recoverable: false });
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    /**
     * **The recovery points this browser holds for a project** (§12), newest
     * first, which is the order somebody looking for *the one from before I
     * did that* reads them in.
     */
    async listSnapshots(path) {
      try {
        const records = await snapshotsFor(path);
        return ok(
          records
            .map((record) => ({
              id: record.id,
              path: record.path,
              createdAt: record.createdAt,
              sizeBytes: record.sizeBytes,
              reason: record.reason,
            }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    /**
     * **Restoring is itself reversible** (§12, and spec §19): what the writer
     * has now is kept first, so a restore chosen in a hurry is one more row on
     * the same list rather than the second thing lost in a morning.
     */
    async restoreSnapshot(input) {
      try {
        const records = await snapshotsFor(input.path);
        const wanted = records.find((record) => record.id === input.snapshotId);
        if (!wanted) return fail('That recovery point is no longer in this browser');
        const file = parseProjectFile(JSON.parse(wanted.text));
        const now = await read(input.path);
        if (now) await keepSnapshot(input.path, serializeProjectFile(now.file), 'manual');
        const result = await store(input.path, file);
        current = { path: result.path, file };
        return ok(result);
      } catch (error) {
        return fail((error as Error).message);
      }
    },

    /**
     * **The dialog comes after the words rather than over them.** The window
     * used to open and print itself in the same breath, so the banner saying
     * which destination makes a file stood *behind* the dialog the
     * destination is chosen in — the one thing a writer had to read, arriving
     * after the press that needed it. So this opens the window and waits; the
     * button is the act. *Print…* keeps its dialog, a printer being what that
     * one asks for.
     *
     * And nothing is on disk when this returns, so `path` is **null** rather
     * than a sentence stuffed into a field that means a file: it answered
     * *your browser's Save as PDF*, which the room then read out as
     * `Exported 46 pages to your browser's Save as PDF` before a single byte
     * had been written.
     */
    async exportPdf(input) {
      if (!openPrintWindow(input, 'save')) return fail('The browser blocked the print window');
      // Only the manuscript is paginated by hand; the browser decides the rest
      // as it lays them out, and it has not laid them out yet.
      const pageCount =
        input.kind === 'book'
          ? (input.html ?? '').split('class="bk-page').length - 1
          : input.kind && input.kind !== 'script'
            ? 0
            : printedPageCount(input.file, input.options ?? {});
      return ok({ path: null, pageCount });
    },

    async print(input) {
      const popup = openPrintWindow(input, 'print');
      popup?.print();
      return ok(popup !== null);
    },

    // An export in the browser is a download per file: the browser decides
    // where they land, and the folder is whatever it downloads to.
    async saveExport(input) {
      const paths: string[] = [];
      for (const one of input.files) {
        const url = URL.createObjectURL(new Blob([one.bytes as BlobPart], { type: one.mediaType }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = one.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        paths.push(one.name);
      }
      return ok({ folder: "your browser's downloads folder", paths });
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
    /**
     * The phone's notes, which the preview used to swear there were none of
     * (addendum 09 §15, from Ken: *you need a sync function or it needs to
     * automatically sync when you load the app*).
     *
     * **This answered `ok([])` — always.** The Research window loads the queue
     * the moment it opens, so the sync Ken asked for was already there and was
     * being handed an empty list, which is indistinguishable from a phone that
     * had sent nothing. Every note he dictated was on the server and the one
     * screen built to show them could not see them, on the one build he
     * actually uses.
     *
     * It goes through the site's own route for `reviewScene`'s reason, said
     * below: same origin, the gate's own cookie, nothing to ship.
     */
    async listCaptures(projectId) {
      try {
        const response = await fetch(
          `/api/notes/inbox${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`,
          { credentials: 'same-origin', cache: 'no-store' },
        );
        const body = (await response.json().catch(() => ({}))) as {
          notes?: CaptureItem[];
          error?: string;
        };
        if (!response.ok) return fail(body.error ?? 'The phone’s notes could not be read');
        return ok(body.notes ?? []);
      } catch (cause) {
        return fail(cause instanceof Error ? cause.message : 'The phone’s notes could not be read');
      }
    },

    /**
     * Mark a note placed.
     *
     * The project change is made in the renderer with the domain functions;
     * this writes back the outcome and never the words, so a wrong call can be
     * read back and redone. Without it a note filed here would be filed again
     * tomorrow, which is the half of the queue a read alone does not give.
     */
    async resolveCapture(capture) {
      try {
        const response = await fetch('/api/notes/inbox', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ capture }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) return fail(body.error ?? 'That note could not be marked done');
        return ok(true as const);
      } catch (cause) {
        return fail(cause instanceof Error ? cause.message : 'That note could not be marked done');
      }
    },

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

    /**
     * The second cloud call the preview can make, for the same reason as the
     * first: same origin, session cookie already good, no key to ship.
     */
    async suggestLearningAid(input) {
      try {
        const response = await fetch('/api/ai/learning-aid', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        });
        const payload = (await response.json().catch(() => null)) as
          | { suggestion?: LearningSuggestion; error?: string }
          | null;
        if (!response.ok || !payload?.suggestion) {
          return fail(payload?.error ?? `The suggestion could not be written (${response.status})`);
        }
        return ok(payload.suggestion);
      } catch {
        return fail('The suggestion could not be asked for. Check your connection.');
      }
    },

    async learningAidStatus() {
      try {
        const response = await fetch('/api/ai/learning-aid', { credentials: 'same-origin' });
        const payload = (await response.json().catch(() => null)) as
          | { configured?: boolean; entitled?: boolean; reason?: string | null }
          | null;
        if (!response.ok || !payload) {
          return ok({ available: false, reason: 'Suggestions could not be reached.' });
        }
        return ok({
          available: payload.configured === true && payload.entitled === true,
          reason: payload.reason ?? null,
        });
      } catch {
        return ok({ available: false, reason: 'Suggestions could not be reached.' });
      }
    },

    /**
     * Naming groupings for the Note Sorter (addendum 26 §14a): same origin,
     * session cookie already good, no key to ship — the third cloud call the
     * preview makes, for the first one's reason.
     */
    async suggestNoteCategories(input) {
      try {
        const response = await fetch('/api/ai/note-categories', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ideas?: Array<{ name: string; because: string }>; error?: string }
          | null;
        if (!response.ok || !payload?.ideas) {
          return fail(payload?.error ?? `The groupings could not be named (${response.status})`);
        }
        return ok(payload.ideas);
      } catch {
        return fail('The groupings could not be asked for. Check your connection.');
      }
    },

    async noteCategoriesStatus() {
      try {
        const response = await fetch('/api/ai/note-categories', { credentials: 'same-origin' });
        const payload = (await response.json().catch(() => null)) as
          | { configured?: boolean; entitled?: boolean; reason?: string | null }
          | null;
        if (!response.ok || !payload) {
          return ok({ available: false, reason: 'Naming groupings could not be reached.' });
        }
        return ok({
          available: payload.configured === true && payload.entitled === true,
          reason: payload.reason ?? null,
        });
      } catch {
        return ok({ available: false, reason: 'Naming groupings could not be reached.' });
      }
    },

    async sendOneSheet(input) {
      try {
        const response = await fetch('/api/one-sheet', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        });
        const payload = (await response.json().catch(() => null)) as
          | { sent?: boolean; error?: string }
          | null;
        if (!response.ok || payload?.sent !== true) {
          return fail(payload?.error ?? `The one-sheet could not be sent (${response.status})`);
        }
        return ok(true as const);
      } catch {
        return fail('The one-sheet could not be sent. Check your connection.');
      }
    },

    activateLicense: async () => fail(NOT_HERE),
    /**
     * Nothing has been heard, and nothing ever will be here (addendum 32 §8).
     *
     * **A browser is not a licensed install**: the preview is reached through
     * the gate it is behind, and a room's writers are there on their seats
     * rather than on a desktop subscription — so this is a statement rather
     * than a refusal, which `activateLicense` beside it correctly is. Answered
     * as *no record*, which is the writable state, because the one thing this
     * must never do is make the browser preview read-only.
     */
    licenseStanding: async () => ok(null),
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
