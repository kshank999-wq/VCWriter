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
});
