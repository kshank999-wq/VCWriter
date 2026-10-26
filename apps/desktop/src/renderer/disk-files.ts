/**
 * **Files on the writer's own computer, from the browser** (addendum 29 §8).
 *
 * From Ken: *I tried to use the save as function to save a copy of my work to
 * a folder on my Google Drive, but it doesn't allow me. It just allows me to
 * save in the browser.* The preview's Save as wrote a second copy into the
 * browser's own storage and nowhere else, and every export went wherever the
 * browser puts downloads. Nothing asked where.
 *
 * Chrome and Edge can ask: the File System Access API opens the system's own
 * save dialog, every folder on the machine in it — a Google Drive, Dropbox or
 * OneDrive folder included, **a cloud drive being a folder** (`saving.ts`).
 * It hands back a handle the page may write to again, so a file saved there
 * stays the one being written to, not a snapshot of the moment.
 *
 * Safari and Firefox have no such dialog. There a save is a download, which
 * the browser puts in its downloads folder or asks about, as its own settings
 * say; and the sentence afterwards says which happened, rather than claiming a
 * place it did not choose.
 */

/** The parts of the File System Access API used here, which TypeScript's DOM library does not carry. */
interface WritableFile {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}
export interface DiskFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFile>;
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
}
interface DiskFolderHandle {
  readonly name: string;
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<DiskFolderHandle>;
  getFileHandle(name: string, options: { create: boolean }): Promise<DiskFileHandle>;
}
interface FileType {
  description: string;
  accept: Record<string, string[]>;
}
interface PickerWindow {
  showSaveFilePicker?(options: { suggestedName: string; types?: FileType[]; id?: string }): Promise<DiskFileHandle>;
  showOpenFilePicker?(options: { types?: FileType[]; multiple?: boolean; id?: string }): Promise<DiskFileHandle[]>;
  showDirectoryPicker?(options: { mode: 'readwrite'; id?: string }): Promise<DiskFolderHandle>;
}

const pickers = (): PickerWindow => (typeof window === 'undefined' ? {} : (window as unknown as PickerWindow));

/** Whether this browser can ask where to save, and write there again. */
export const canChooseWhere = (): boolean => typeof pickers().showSaveFilePicker === 'function';

/** What the dialog offers a file as: *VC Writer project*, `.vcw`. */
export interface FileKind {
  name: string;
  extension: string;
  mediaType: string;
}

export const PROJECT_KIND: FileKind = { name: 'VC Writer project', extension: 'vcw', mediaType: 'application/json' };

const typeFor = (kind: FileKind): FileType => ({
  description: kind.name,
  accept: { [kind.mediaType || 'application/octet-stream']: [`.${kind.extension.replace(/^\./, '')}`] },
});

const isCancel = (error: unknown): boolean => (error as { name?: string })?.name === 'AbortError';

/** One file the browser downloads; it decides where, by its own settings. */
export const downloadBlob = (name: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** Write the whole of a file through a handle, replacing what was there. */
export const writeHandle = async (handle: DiskFileHandle, data: Blob | string): Promise<void> => {
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
};

/**
 * Where a save went, in words the screen can say back.
 *
 * `live` is whether this page holds the file and can write it again — true
 * for a file chosen in the dialog, false for a download, which is a copy of
 * the moment and nothing more.
 */
export type DiskSave =
  | { kind: 'written'; handle: DiskFileHandle; where: string; live: true }
  | { kind: 'downloaded'; where: string; live: false }
  | { kind: 'cancelled' };

const downloadedWhere = (name: string): string => `${name} in your browser's downloads folder`;
const chosenWhere = (name: string): string => `${name}, in the folder you chose`;

/**
 * Ask where, then write. **The dialog comes first**: a browser opens it only
 * in the moments after a press, so nothing slow may run before it — the bytes
 * are asked for after the place has been chosen.
 */
export const saveToDisk = async (
  name: string,
  kind: FileKind,
  bytes: () => Blob | Promise<Blob>,
): Promise<DiskSave> => {
  const picker = pickers().showSaveFilePicker;
  if (picker) {
    let handle: DiskFileHandle;
    try {
      handle = await picker.call(window, { suggestedName: name, types: [typeFor(kind)], id: `vcwriter-${kind.extension}` });
    } catch (error) {
      if (isCancel(error)) return { kind: 'cancelled' };
      // A dialog the browser would not open (a page not focused, a press too
      // long ago) is no reason to lose the save: it becomes a download.
      downloadBlob(name, await bytes());
      return { kind: 'downloaded', where: downloadedWhere(name), live: false };
    }
    await writeHandle(handle, await bytes());
    return { kind: 'written', handle, where: chosenWhere(handle.name), live: true };
  }
  downloadBlob(name, await bytes());
  return { kind: 'downloaded', where: downloadedWhere(name), live: false };
};

/**
 * Several files into a folder of their own (an eBook export): the writer
 * chooses the folder, the export's own folder is made inside it. Where the
 * browser cannot ask, each file is a download.
 */
export const saveFilesToDisk = async (
  folderName: string,
  files: { name: string; blob: Blob }[],
): Promise<{ kind: 'written'; folder: string; paths: string[] } | { kind: 'downloaded'; folder: string; paths: string[] } | { kind: 'cancelled' }> => {
  const picker = pickers().showDirectoryPicker;
  if (picker) {
    let parent: DiskFolderHandle | null = null;
    try {
      parent = await picker.call(window, { mode: 'readwrite', id: 'vcwriter-export' });
    } catch (error) {
      if (isCancel(error)) return { kind: 'cancelled' };
    }
    if (parent) {
      const folder = await parent.getDirectoryHandle(folderName, { create: true });
      for (const one of files) await writeHandle(await folder.getFileHandle(one.name, { create: true }), one.blob);
      return { kind: 'written', folder: `${folderName}, in ${parent.name}`, paths: files.map((one) => one.name) };
    }
  }
  for (const one of files) downloadBlob(one.name, one.blob);
  return { kind: 'downloaded', folder: "your browser's downloads folder", paths: files.map((one) => one.name) };
};

/**
 * Ask for a file to open, keeping its handle where the browser can give one,
 * so what was opened from a folder can be saved back to it. Null when the
 * writer dismissed the dialog.
 */
export const openFromDisk = async (kind: FileKind): Promise<{ file: File; handle: DiskFileHandle | null } | null> => {
  const picker = pickers().showOpenFilePicker;
  if (picker) {
    try {
      const [handle] = await picker.call(window, { types: [typeFor(kind)], multiple: false, id: `vcwriter-${kind.extension}` });
      return handle ? { file: await handle.getFile(), handle } : null;
    } catch (error) {
      if (isCancel(error)) return null;
      // Refused for some other reason: fall through to the plain chooser.
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `.${kind.extension},${kind.mediaType}`;
    input.style.display = 'none';
    document.body.append(input);
    const finish = (file: File | null) => {
      input.remove();
      resolve(file ? { file, handle: null } : null);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
};

/**
 * Whether the page may write through a handle now, asking where it may.
 *
 * A browser forgets the permission when the page is closed (or keeps it, if
 * the writer said *allow on every visit*), and it asks again **only during a
 * press** — so an autosave cannot ask and a Save can. Asked from an autosave
 * the request is refused and this answers false; the save says so, and the
 * next press of Save asks.
 */
export const mayWrite = async (handle: DiskFileHandle): Promise<boolean> => {
  if (!handle.queryPermission) return true;
  const now = await handle.queryPermission({ mode: 'readwrite' }).catch(() => 'prompt' as PermissionState);
  if (now === 'granted') return true;
  if (now === 'denied' || !handle.requestPermission) return false;
  const asked = await handle.requestPermission({ mode: 'readwrite' }).catch(() => 'prompt' as PermissionState);
  return asked === 'granted';
};
