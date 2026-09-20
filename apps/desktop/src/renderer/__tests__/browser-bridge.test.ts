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

  it('prints through a window that says what it is, named as the file should be, with the banner kept off the paper', async () => {
    // This file runs without a DOM: the window here is only what printing touches.
    const written: string[] = [];
    let printed = 0;
    const globals = globalThis as unknown as { window?: unknown };
    globals.window = {
      setInterval: () => 0,
      open: () => ({
        document: { write: (html: string) => written.push(html), close: () => undefined },
        focus: () => undefined,
        print: () => {
          printed += 1;
        },
      }),
    };
    try {
      const bridge = createBrowserBridge();
      const created = await bridge.createProject({ title: 'Novel Test', format: 'novel' });
      const html = '<!doctype html><html><head><title>Novel Test</title><style>@page { size: 5.5in 8.5in; margin: 0; }</style></head><body><section class="bk-page recto"></section><section class="bk-page verso"></section></body></html>';
      const result = await bridge.exportPdf({ file: created.data!.file, kind: 'book', html, paper: { width: 5.5, height: 8.5 } });
      expect(result.ok).toBe(true);
      expect(result.data?.pageCount).toBe(2);
      expect(printed).toBe(1);
      const page = written[0]!;
      // The tab is the file name, so Save as PDF names the file after the book.
      expect(page).toContain('<title>Novel Test (book)</title>');
      // The banner names the document and says what to choose; it never prints.
      expect(page).toContain('Novel Test as a book — 2 pages at 5.5 × 8.5 in');
      expect(page).toContain('choose <b>Save as PDF</b> as the destination');
      expect(page).toContain('turn <b>Headers and footers</b> off');
      expect(page).toContain('@media print { .vcw-print-banner { display: none !important; } }');
      // The book's own page rule is untouched underneath.
      expect(page).toContain('@page { size: 5.5in 8.5in; margin: 0; }');
    } finally {
      delete globals.window;
    }
  });
});
