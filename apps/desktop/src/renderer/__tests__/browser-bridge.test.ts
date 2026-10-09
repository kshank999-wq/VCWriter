import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createBrowserBridge } from '../browser-bridge';

/**
 * The browser preview's bridge keeps projects in IndexedDB and behaves like
 * the desktop one for everything the renderer relies on: create, save,
 * reopen, recents, and an honest refusal for what a browser cannot do.
 */
describe('browser bridge', () => {
  it('creates, saves and reopens a project from the browser store', async () => {
    const bridge = createBrowserBridge();
    const created = await bridge.createProject({ title: 'Lighthouse', format: 'screenplay' });
    expect(created.ok).toBe(true);
    const { path, file, contentHash } = created.data!;
    expect(path).toBe('browser://Lighthouse.vcw');

    // Saving the same document writes nothing; a changed one writes.
    const same = await bridge.saveProject({ path, file, previousHash: contentHash });
    expect(same.data).toEqual({ contentHash, written: false });
    const changed = { ...file, project: { ...file.project, title: 'Lighthouse, revised' } };
    const saved = await bridge.saveProject({ path, file: changed, previousHash: contentHash });
    expect(saved.data?.written).toBe(true);

    const reopened = await bridge.openProjectAtPath(path);
    expect(reopened.data?.file.project.title).toBe('Lighthouse, revised');
    expect(reopened.data?.contentHash).toBe(saved.data?.contentHash);
    expect(bridge.current()?.file.project.title).toBe('Lighthouse, revised');
  });

  it('lists recents newest first and gives a second project of the same name its own path', async () => {
    const bridge = createBrowserBridge();
    const second = await bridge.createProject({ title: 'Lighthouse', format: 'novel' });
    expect(second.data?.path).toBe('browser://Lighthouse 2.vcw');
    const recents = await bridge.recentProjects();
    expect(recents.data?.[0]).toBe('browser://Lighthouse 2.vcw');
    expect(recents.data).toContain('browser://Lighthouse.vcw');
  });

  it('says what it cannot do instead of pretending', async () => {
    const bridge = createBrowserBridge();
    expect((await bridge.syncProject({ file: {} as never })).ok).toBe(false);
    expect((await bridge.activateLicense('X')).ok).toBe(false);
    expect((await bridge.openProjectAtPath('browser://Nope.vcw')).error).toMatch(/no longer in this browser/);
    expect((await bridge.accountStatus()).data).toEqual({ configured: false, signedIn: false, email: null });
  });

  /**
   * **The print window, and the button in it** (addendum 20 §9ah).
   *
   * What stood here asserted the window's *words* and that it printed
   * itself, and never asked whether its one control could be pressed — so
   * the button had been refused by the preview's own content policy since
   * the day it shipped with the suite green, which is §15a's rule a further
   * time: **a route needs a test per gesture**. The fake window grows a
   * button that records what is attached to it, so an `onclick` written back
   * into the markup fails here rather than at Ken's desk.
   */
  const printingWindow = () => {
    const written: string[] = [];
    const listeners: { type: string; run: () => void }[] = [];
    let printed = 0;
    let focused = 0;
    const popup = {
      document: {
        write: (html: string) => written.push(html),
        close: () => undefined,
        getElementById: (id: string) =>
          id === 'vcw-print-go'
            ? { addEventListener: (type: string, run: () => void) => listeners.push({ type, run }) }
            : null,
      },
      focus: () => {
        focused += 1;
      },
      print: () => {
        printed += 1;
      },
    };
    const globals = globalThis as unknown as { window?: unknown };
    globals.window = { setInterval: () => 0, open: () => popup };
    return {
      written,
      press: () => listeners.filter((one) => one.type === 'click').forEach((one) => one.run()),
      counts: () => ({ printed, focused, listeners: listeners.length }),
      done: () => {
        delete globals.window;
      },
    };
  };

  const bookHtml =
    '<!doctype html><html><head><title>Novel Test</title><style>@page { size: 5.5in 8.5in; margin: 0; }</style></head><body><section class="bk-page recto"></section><section class="bk-page verso"></section></body></html>';

  it('opens the book in a window that says what it is, named as the file should be, with the banner kept off the paper', async () => {
    const win = printingWindow();
    try {
      const bridge = createBrowserBridge();
      const created = await bridge.createProject({ title: 'Novel Test', format: 'novel' });
      const result = await bridge.exportPdf({ file: created.data!.file, kind: 'book', html: bookHtml, paper: { width: 5.5, height: 8.5 } });
      expect(result.ok).toBe(true);
      expect(result.data?.pageCount).toBe(2);
      // Nothing is on disk: the writer has not pressed anything yet, and the
      // dialog no longer opens over the words that say what to choose.
      expect(result.data?.path).toBeNull();
      expect(win.counts().printed).toBe(0);
      const page = win.written[0]!;
      // The tab is the file name, so Save as PDF names the file after the book.
      expect(page).toContain('<title>Novel Test (book)</title>');
      // The banner names the document and says what to choose; it never prints.
      expect(page).toContain('Novel Test as a book — 2 pages at 5.5 × 8.5 in');
      expect(page).toContain('The destination must be <b>Save as PDF</b>');
      expect(page).toContain('Microsoft Print to PDF');
      expect(page).toContain('turn <b>Headers and footers</b> off');
      expect(page).toContain('@media print { .vcw-print-banner { display: none !important; } }');
      // The book's own page rule is untouched underneath.
      expect(page).toContain('@page { size: 5.5in 8.5in; margin: 0; }');
    } finally {
      win.done();
    }
  });

  it('gives the window a button that is pressed rather than an inline script the policy refuses', async () => {
    const win = printingWindow();
    try {
      const bridge = createBrowserBridge();
      const created = await bridge.createProject({ title: 'Novel Test', format: 'novel' });
      await bridge.exportPdf({ file: created.data!.file, kind: 'book', html: bookHtml, paper: { width: 5.5, height: 8.5 } });
      // The fault, pinned by its absence: `script-src 'self'` is inherited by
      // the `about:blank` window, so an attribute handler is refused and the
      // control does nothing at all.
      expect(win.written[0]!).not.toContain('onclick');
      expect(win.counts().listeners).toBe(1);
      win.press();
      expect(win.counts().printed).toBe(1);
    } finally {
      win.done();
    }
  });

  it('prints at once when a printer is what was asked for, with the button there for a second go', async () => {
    const win = printingWindow();
    try {
      const bridge = createBrowserBridge();
      const created = await bridge.createProject({ title: 'Novel Test', format: 'novel' });
      const result = await bridge.print({ file: created.data!.file, kind: 'book', html: bookHtml });
      expect(result.data).toBe(true);
      expect(win.counts().printed).toBe(1);
      // A printer needs no destination chosen, so that half is not said here.
      expect(win.written[0]!).toContain('>Print…</button>');
      expect(win.written[0]!).not.toContain('The destination must be');
      win.press();
      expect(win.counts().printed).toBe(2);
    } finally {
      win.done();
    }
  });
});

/**
 * **Recovery points in the preview** (addendum 33 §12, from Ken: *do the
 * preview saved snapshots*).
 *
 * The desktop has kept rolling copies beside every project since it was
 * written and this host answered `listSnapshots` with an empty list — which
 * is how a second book imported over a finished story left nothing at all to
 * go back to. What is pinned here is the act and the promise: a point is
 * taken when the renderer asks for one, the writer can read them back, and
 * restoring one keeps what they had first.
 */
describe('the recovery points a browser keeps', () => {
  const bridgeWithProject = async (title: string) => {
    const bridge = createBrowserBridge();
    const created = await bridge.createProject({ title, format: 'screenplay' });
    return { bridge, ...created.data! };
  };

  it('takes one when the save asks for it, and none when it does not', async () => {
    // `useProject` has set this flag every twentieth save since autosave was
    // written; this host read it and did nothing with it.
    const { bridge, path, file, contentHash } = await bridgeWithProject('Recovery');
    const quiet = { ...file, project: { ...file.project, logline: 'one' } };
    await bridge.saveProject({ path, file: quiet, previousHash: contentHash });
    expect((await bridge.listSnapshots(path)).data).toHaveLength(0);

    const asked = { ...file, project: { ...file.project, logline: 'two' } };
    await bridge.saveProject({ path, file: asked, snapshot: true });
    const points = (await bridge.listSnapshots(path)).data!;
    expect(points).toHaveLength(1);
    expect(points[0]!.reason).toBe('autosave');
    expect(points[0]!.sizeBytes).toBeGreaterThan(0);
  });

  it('puts the saved copy back, and keeps what you had first', async () => {
    const { bridge, path, file } = await bridgeWithProject('Restore');
    const early = { ...file, project: { ...file.project, title: 'As it was' } };
    await bridge.saveProject({ path, file: early, snapshot: true });
    const later = { ...file, project: { ...file.project, title: 'After the accident' } };
    await bridge.saveProject({ path, file: later });

    const point = (await bridge.listSnapshots(path)).data![0]!;
    const back = await bridge.restoreSnapshot({ path, snapshotId: point.id });
    expect(back.data?.file.project.title).toBe('As it was');
    expect((await bridge.openProjectAtPath(path)).data?.file.project.title).toBe('As it was');

    // Restoring is itself reversible: what was there is on the list now.
    const after = (await bridge.listSnapshots(path)).data!;
    expect(after).toHaveLength(2);
    expect(after.some((one) => one.reason === 'manual')).toBe(true);
    const kept = after.find((one) => one.reason === 'manual')!;
    const undone = await bridge.restoreSnapshot({ path, snapshotId: kept.id });
    expect(undone.data?.file.project.title).toBe('After the accident');
  });

  it('takes one before a format upgrade rewrites anything', async () => {
    const { bridge, path, file } = await bridgeWithProject('Older');
    // A document written by an older build, as it would sit in the store.
    await bridge.saveProject({ path, file: { ...file, formatVersion: 1 } as never });
    const opened = await bridge.openProjectAtPath(path);
    expect(opened.ok).toBe(true);
    const points = (await bridge.listSnapshots(path)).data!;
    expect(points.map((one) => one.reason)).toContain('pre_migration');
  });

  it('takes the points with the project, so the row’s own sentence stays true', async () => {
    const { bridge, path, file } = await bridgeWithProject('Deleted');
    await bridge.saveProject({ path, file: { ...file, project: { ...file.project, logline: 'x' } }, snapshot: true });
    expect((await bridge.listSnapshots(path)).data).toHaveLength(1);
    await bridge.deleteProject(path);
    expect((await bridge.listSnapshots(path)).data).toHaveLength(0);
  });

  it('keeps one project’s points to itself', async () => {
    const one = await bridgeWithProject('Mine');
    const two = await bridgeWithProject('Theirs');
    await one.bridge.saveProject({ path: one.path, file: { ...one.file, project: { ...one.file.project, logline: 'a' } }, snapshot: true });
    expect((await one.bridge.listSnapshots(one.path)).data).toHaveLength(1);
    expect((await two.bridge.listSnapshots(two.path)).data).toHaveLength(0);
  });
});

/**
 * **The browser that has been writing here for months** (§12). Adding the
 * points means a database version, and an upgrade that lost a project would
 * be this feature causing the thing it exists to prevent.
 */
describe('opening a store written before there were recovery points', () => {
  const atVersionOne = (record: unknown): Promise<void> =>
    new Promise((resolve, reject) => {
      const wipe = indexedDB.deleteDatabase('vcwriter-preview');
      wipe.onerror = () => reject(wipe.error);
      wipe.onsuccess = () => {
        const open = indexedDB.open('vcwriter-preview', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('projects', { keyPath: 'path' });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const put = db.transaction('projects', 'readwrite').objectStore('projects').put(record);
          put.onerror = () => reject(put.error);
          put.onsuccess = () => {
            db.close();
            resolve();
          };
        };
      };
    });

  it('keeps every project and starts keeping points', async () => {
    const seed = createBrowserBridge();
    const made = (await seed.createProject({ title: 'Already here', format: 'novel' })).data!;
    await atVersionOne({ path: made.path, file: made.file, contentHash: made.contentHash, savedAt: new Date().toISOString() });

    const bridge = createBrowserBridge();
    const listed = (await bridge.listProjects()).data!;
    expect(listed.map((one) => one.title)).toContain('Already here');
    await bridge.saveProject({ path: made.path, file: { ...made.file, project: { ...made.file.project, logline: 'now' } }, snapshot: true });
    expect((await bridge.listSnapshots(made.path)).data).toHaveLength(1);
  });
});
