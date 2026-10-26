/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeSavedTo, parseProjectFile } from '@vcwriter/domain';
import { createBrowserBridge } from '../browser-bridge';

/**
 * Saving to the writer's own computer from the preview (addendum 29 §8).
 *
 * From Ken: Save as in the browser *just allows me to save in the browser*,
 * not to his Google Drive folder. These stand in for Chrome's save dialog
 * with a file that remembers what was written to it, and pin the three things
 * the fix is: the dialog is asked, the file is written, and a save-as keeps
 * writing it after.
 */

interface FakeFile {
  name: string;
  text: string;
  permission: PermissionState;
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
  queryPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
}

const fakeFile = (name: string, text = ''): FakeFile => {
  const file: FakeFile = {
    kind: 'file',
    name,
    text,
    permission: 'granted',
    getFile: async () => new File([file.text], file.name),
    createWritable: async () => {
      let pending = '';
      return {
        write: async (data) => {
          pending = typeof data === 'string' ? data : await data.text();
        },
        close: async () => {
          file.text = pending;
        },
      };
    },
    queryPermission: async () => file.permission,
    // Outside a press the browser refuses to ask, which is what an autosave meets.
    requestPermission: async () => file.permission,
  };
  return file;
};

type Picker = Record<string, unknown>;
const win = window as unknown as Picker;

afterEach(() => {
  delete win['showSaveFilePicker'];
  delete win['showOpenFilePicker'];
  delete win['showDirectoryPicker'];
  vi.restoreAllMocks();
});

describe('save as, where the browser can ask', () => {
  let chosen: FakeFile[];
  beforeEach(() => {
    chosen = [];
    win['showSaveFilePicker'] = vi.fn(async ({ suggestedName }: { suggestedName: string }) => {
      const file = fakeFile(suggestedName);
      chosen.push(file);
      return file;
    });
  });

  it('asks where, writes the file there, and keeps writing it at every save', async () => {
    const bridge = createBrowserBridge();
    const created = await bridge.createProject({ title: 'Harbour', format: 'novel' });
    const moved = await bridge.saveProjectAs({ kind: 'as', file: created.data!.file, suggestedName: 'Harbour' });

    expect(moved.ok).toBe(true);
    expect(win['showSaveFilePicker']).toHaveBeenCalledOnce();
    expect(chosen[0]!.name).toBe('Harbour.vcw');
    expect(parseProjectFile(JSON.parse(chosen[0]!.text)).project.title).toBe('Harbour');
    expect(moved.data!.where).toEqual({ place: 'Harbour.vcw, in the folder you chose', live: true });

    // The writer goes on writing; the file in the Drive folder follows.
    const edited = { ...moved.data!.file, project: { ...moved.data!.file.project, logline: 'A tide comes in.' } };
    const saved = await bridge.saveProject({ path: moved.data!.path, file: edited, previousHash: moved.data!.contentHash });
    expect(saved.ok).toBe(true);
    expect(parseProjectFile(JSON.parse(chosen[0]!.text)).project.logline).toBe('A tide comes in.');

    expect(describeSavedTo({ kind: 'as', path: moved.data!.path, working: true, where: moved.data!.where! })).toBe(
      'Saved to Harbour.vcw, in the folder you chose. You are writing in it from now on: every save goes to that file as well as to this browser.',
    );
  });

  it('a copy is written once and not kept up to date', async () => {
    const bridge = createBrowserBridge();
    const created = await bridge.createProject({ title: 'Quay', format: 'novel' });
    const copied = await bridge.saveProjectAs({ kind: 'copy', file: created.data!.file, suggestedName: 'Quay copy' });
    expect(chosen[0]!.name).toBe('Quay copy.vcw');
    const before = chosen[0]!.text;

    const edited = { ...copied.data!.file, project: { ...copied.data!.file.project, logline: 'Changed later.' } };
    await bridge.saveProject({ path: copied.data!.path, file: edited, previousHash: copied.data!.contentHash });
    expect(chosen[0]!.text).toBe(before);
  });

  it('a dismissed dialog saves nothing and says nothing went wrong', async () => {
    win['showSaveFilePicker'] = vi.fn(async () => {
      throw Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
    });
    const bridge = createBrowserBridge();
    const created = await bridge.createProject({ title: 'Pier', format: 'novel' });
    const before = (await bridge.recentProjects()).data!.length;
    const result = await bridge.saveProjectAs({ kind: 'as', file: created.data!.file });
    expect(result.ok).toBe(false);
    // `useProject` reads a cancel as the writer changing their mind.
    expect(result.error).toMatch(/cancel/i);
    expect((await bridge.recentProjects()).data!.length).toBe(before);
  });

  it('a file the browser may no longer write fails the save, says why, and keeps the work in the browser', async () => {
    const bridge = createBrowserBridge();
    const created = await bridge.createProject({ title: 'Jetty', format: 'novel' });
    const moved = await bridge.saveProjectAs({ kind: 'as', file: created.data!.file });
    chosen[0]!.permission = 'prompt';

    const edited = { ...moved.data!.file, project: { ...moved.data!.file.project, logline: 'After a reload.' } };
    const saved = await bridge.saveProject({ path: moved.data!.path, file: edited, previousHash: moved.data!.contentHash });
    expect(saved.ok).toBe(false);
    expect(saved.error).toMatch(/Saved in this browser.*press Save/);
    // Nothing was lost: the browser's copy has it.
    expect((await bridge.openProjectAtPath(moved.data!.path)).data!.file.project.logline).toBe('After a reload.');
  });
});

describe('open from a folder', () => {
  it('keeps the file it came from, and saves go back to it', async () => {
    const bridge = createBrowserBridge();
    const source = (await bridge.createProject({ title: 'Drive book', format: 'novel' })).data!.file;
    const onDisk = fakeFile('Drive book.vcw', JSON.stringify(source));
    win['showOpenFilePicker'] = vi.fn(async () => [onDisk]);

    const opened = await bridge.openProject();
    expect(opened.ok).toBe(true);
    const edited = { ...opened.data!.file, project: { ...opened.data!.file.project, logline: 'Written in the browser.' } };
    await bridge.saveProject({ path: opened.data!.path, file: edited, previousHash: opened.data!.contentHash });
    expect(parseProjectFile(JSON.parse(onDisk.text)).project.logline).toBe('Written in the browser.');
  });
});

describe('exports ask where too', () => {
  it('one file goes where the writer says', async () => {
    const chosen: FakeFile[] = [];
    win['showSaveFilePicker'] = vi.fn(async ({ suggestedName }: { suggestedName: string }) => {
      const file = fakeFile(suggestedName);
      chosen.push(file);
      return file;
    });
    const bridge = createBrowserBridge();
    const saved = await bridge.saveFile({
      name: 'Harbour.txt',
      bytes: new TextEncoder().encode('The tide.'),
      mediaType: 'text/plain',
      kind: { name: 'Plain text', extension: 'txt' },
    });
    expect(saved.data).toEqual({ path: 'Harbour.txt, in the folder you chose' });
    expect(chosen[0]!.text).toBe('The tide.');
  });

  it('several files go into a folder of their own inside the one chosen', async () => {
    const written = new Map<string, FakeFile>();
    const folder = (name: string): unknown => ({
      name,
      getDirectoryHandle: async (child: string) => folder(`${name}/${child}`),
      getFileHandle: async (file: string) => {
        const made = fakeFile(file);
        written.set(`${name}/${file}`, made);
        return made;
      },
    });
    win['showDirectoryPicker'] = vi.fn(async () => folder('Google Drive'));
    const bridge = createBrowserBridge();
    const saved = await bridge.saveExport({
      folderName: 'Harbour - eBook Export',
      files: [
        { name: 'Harbour.epub', bytes: new Uint8Array([1, 2, 3]), mediaType: 'application/epub+zip' },
        { name: 'cover.jpg', bytes: new Uint8Array([4]), mediaType: 'image/jpeg' },
      ],
    });
    expect(saved.data).toEqual({ folder: 'Harbour - eBook Export, in Google Drive', paths: ['Harbour.epub', 'cover.jpg'] });
    expect([...written.keys()]).toEqual(['Google Drive/Harbour - eBook Export/Harbour.epub', 'Google Drive/Harbour - eBook Export/cover.jpg']);
  });
});

describe('where the browser cannot ask', () => {
  it('a save as is a download, and says so rather than claiming a folder', async () => {
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const bridge = createBrowserBridge();
    const created = await bridge.createProject({ title: 'Safari', format: 'novel' });
    const moved = await bridge.saveProjectAs({ kind: 'as', file: created.data!.file, suggestedName: 'Safari' });
    expect(clicks).toEqual(['Safari.vcw']);
    expect(moved.data!.where).toEqual({ place: "Safari.vcw in your browser's downloads folder", live: false });
    expect(describeSavedTo({ kind: 'as', path: moved.data!.path, working: true, where: moved.data!.where! })).toMatch(
      /cannot keep that file up to date/,
    );
  });
});
