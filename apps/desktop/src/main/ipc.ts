import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import {
  createProjectFile,
  parseProjectFile,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import {
  PROJECT_EXTENSION,
  listSnapshots,
  loadProject,
  restoreSnapshot,
  saveProject,
  type LoadedProject,
  type SnapshotSummary,
} from './project-store';

/**
 * The main-process half of the desktop API.
 *
 * All file system access lives here. The renderer never touches disk directly;
 * it asks through a narrow, typed channel list exposed by the preload script,
 * which is what lets the window run with context isolation on and node
 * integration off.
 */

export interface OpenResult {
  path: string;
  file: ProjectFile;
  contentHash: string;
}

export interface DesktopApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const RECENTS_LIMIT = 10;
const recentsPath = () => join(app.getPath('userData'), 'recent-projects.json');

const readRecents = async (): Promise<string[]> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(recentsPath(), 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

const rememberRecent = async (path: string): Promise<void> => {
  const recents = await readRecents();
  const next = [path, ...recents.filter((entry) => entry !== path)].slice(0, RECENTS_LIMIT);
  await writeFile(recentsPath(), JSON.stringify(next), 'utf8').catch(() => undefined);
  app.addRecentDocument(path);
};

const ok = <T>(data: T): DesktopApiResult<T> => ({ ok: true, data });
const fail = (cause: unknown): DesktopApiResult<never> => ({
  ok: false,
  error: cause instanceof Error ? cause.message : String(cause),
});

const FILE_FILTERS = [{ name: 'VC Writer project', extensions: [PROJECT_EXTENSION] }];

const toOpenResult = (loaded: LoadedProject): OpenResult => ({
  path: loaded.path,
  file: loaded.file,
  contentHash: loaded.contentHash,
});

export const registerIpcHandlers = (getWindow: () => BrowserWindow | null): void => {
  ipcMain.handle(
    'project:create',
    async (
      _event,
      input: { title: string; format: ProjectFormat; author?: string; logline?: string },
    ): Promise<DesktopApiResult<OpenResult>> => {
      try {
        const window = getWindow();
        const suggested = join(
          app.getPath('documents'),
          'VC Writer',
          `${input.title.replace(/[^\w\-. ]+/g, '_') || 'Untitled'}.${PROJECT_EXTENSION}`,
        );
        const choice = window
          ? await dialog.showSaveDialog(window, { defaultPath: suggested, filters: FILE_FILTERS })
          : await dialog.showSaveDialog({ defaultPath: suggested, filters: FILE_FILTERS });
        if (choice.canceled || !choice.filePath) return fail(new Error('Project creation cancelled'));

        const file = createProjectFile(input);
        const saved = await saveProject(choice.filePath, file);
        await rememberRecent(saved.path);
        return ok({ path: saved.path, file, contentHash: saved.contentHash });
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('project:open', async (): Promise<DesktopApiResult<OpenResult>> => {
    try {
      const window = getWindow();
      const choice = window
        ? await dialog.showOpenDialog(window, { properties: ['openFile'], filters: FILE_FILTERS })
        : await dialog.showOpenDialog({ properties: ['openFile'], filters: FILE_FILTERS });
      const path = choice.filePaths[0];
      if (choice.canceled || !path) return fail(new Error('Open cancelled'));

      const loaded = await loadProject(path);
      await rememberRecent(loaded.path);
      return ok(toOpenResult(loaded));
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle('project:openPath', async (_event, path: string): Promise<DesktopApiResult<OpenResult>> => {
    try {
      const loaded = await loadProject(path);
      await rememberRecent(loaded.path);
      return ok(toOpenResult(loaded));
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle(
    'project:save',
    async (
      _event,
      input: { path: string; file: unknown; previousHash?: string; snapshot?: boolean },
    ): Promise<DesktopApiResult<{ contentHash: string; written: boolean }>> => {
      try {
        // Validate on the way in: the renderer is the least trusted half of the
        // app, and a malformed document must never reach the file.
        const file = parseProjectFile(input.file);
        const result = await saveProject(input.path, file, {
          ...(input.previousHash ? { previousHash: input.previousHash } : {}),
          snapshot: input.snapshot ?? false,
        });
        return ok({ contentHash: result.contentHash, written: result.written });
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('project:recents', async (): Promise<DesktopApiResult<string[]>> => {
    try {
      return ok(await readRecents());
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle('project:snapshots', async (_event, path: string): Promise<DesktopApiResult<SnapshotSummary[]>> => {
    try {
      return ok(await listSnapshots(path));
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle(
    'project:restoreSnapshot',
    async (_event, input: { path: string; snapshotId: string }): Promise<DesktopApiResult<OpenResult>> => {
      try {
        return ok(toOpenResult(await restoreSnapshot(input.path, input.snapshotId)));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('app:version', () => ok({ version: app.getVersion(), platform: process.platform }));
};
