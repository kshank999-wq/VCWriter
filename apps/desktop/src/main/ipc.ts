import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { join } from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';
import {
  createProjectFile,
  parseProjectFile,
  projectsNewestFirst,
  type CaptureItem,
  type PrintOptions,
  type ProjectEntry,
  type SceneVerdict,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { exportProjectPdf, printProject, type PrintKind } from './export-pdf';
import { applyApplicationMenu, commandSender, type MenuSpec } from './menu';
import {
  accessToken,
  accountStatus,
  activateLicense,
  listCaptures,
  requestSceneReview,
  requestSignInCode,
  resolveCapture,
  sceneReviewStatus,
  signOut,
  syncProject,
  verifySignInCode,
  type AccountStatus,
  type ActivationResult,
  type SceneReviewAvailability,
  type SyncOutcome,
} from './cloud';
import { deviceFingerprint, deviceName, devicePlatform } from './device';
import { checkForUpdate, downloadUpdate, runInstaller, type DownloadedUpdate, type UpdateStatus } from './updater';
import { reportError, reportingSettings, setReportingEnabled } from './reporting';
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

/**
 * What the machine remembers about a project it has seen.
 *
 * The title is kept beside the path deliberately. A list somebody deletes from
 * has to say what each project *is*, and opening ten whole project files to
 * read ten titles is a slow answer to a question the machine already knew.
 */
interface RecentProject {
  path: string;
  title: string;
}

/** Reads both shapes: the old file was an array of paths and may still be. */
const readRecentRecords = async (): Promise<RecentProject[]> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(recentsPath(), 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): RecentProject[] => {
      if (typeof entry === 'string') return [{ path: entry, title: '' }];
      if (entry && typeof entry === 'object' && typeof (entry as RecentProject).path === 'string') {
        const record = entry as RecentProject;
        return [{ path: record.path, title: typeof record.title === 'string' ? record.title : '' }];
      }
      return [];
    });
  } catch {
    return [];
  }
};

const readRecents = async (): Promise<string[]> => (await readRecentRecords()).map((record) => record.path);

const writeRecents = async (records: RecentProject[]): Promise<void> => {
  await writeFile(recentsPath(), JSON.stringify(records), 'utf8').catch(() => undefined);
};

const rememberRecent = async (path: string, title = ''): Promise<void> => {
  const records = await readRecentRecords();
  const kept = records.filter((record) => record.path !== path);
  // A remembered title is not lost by an operation that did not carry one.
  const known = records.find((record) => record.path === path)?.title ?? '';
  await writeRecents([{ path, title: title.trim() || known }, ...kept].slice(0, RECENTS_LIMIT));
  app.addRecentDocument(path);
};

const forgetRecent = async (path: string): Promise<void> => {
  const records = await readRecentRecords();
  await writeRecents(records.filter((record) => record.path !== path));
};

/**
 * Every project this machine has, as the list a writer chooses from (spec §4).
 *
 * A file that has been moved or deleted outside the application is **kept in
 * the list and marked missing** rather than quietly dropped: the row is the
 * only way left to take it off, and a list that tidied itself would leave a
 * writer wondering whether they imagined the project.
 */
const listProjects = async (): Promise<ProjectEntry[]> => {
  const records = await readRecentRecords();
  const entries = await Promise.all(
    records.map(async (record): Promise<ProjectEntry> => {
      try {
        const info = await stat(record.path);
        return {
          path: record.path,
          title: record.title,
          savedAt: info.mtime.toISOString(),
          sizeBytes: info.size,
          missing: false,
        };
      } catch {
        return { path: record.path, title: record.title, savedAt: null, sizeBytes: null, missing: true };
      }
    }),
  );
  return projectsNewestFirst(entries);
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

export interface PaneWindows {
  open(pane: string): void;
  close(pane: string): void;
  list(): string[];
  relay(fromWebContentsId: number, message: unknown): void;
}

export const registerIpcHandlers = (getWindow: () => BrowserWindow | null, panes?: PaneWindows): void => {
  /**
   * The renderer hands over its menu description and which items are ticked;
   * this builds the real menu from it (addendum 02 §13). It is re-installed
   * whenever a tick changes, which is cheap and keeps the two in step.
   */
  ipcMain.handle(
    'menu:install',
    (_event, input: { menus: MenuSpec[]; checked: string[] }): DesktopApiResult<true> => {
      try {
        applyApplicationMenu(input.menus ?? [], input.checked ?? [], commandSender(getWindow));
        return ok(true as const);
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  // --- sections in windows of their own, and the link between them ---------

  if (panes) {
    ipcMain.handle('panes:open', (_event, pane: string): DesktopApiResult<true> => {
      try {
        // The pane key comes from the renderer, and it ends up in a URL and a
        // window registry: keep it to the shape the workspace actually uses.
        if (typeof pane !== 'string' || !/^[a-z]+(:[A-Za-z0-9_-]+)?$/.test(pane)) {
          return fail(new Error('Unknown section'));
        }
        panes.open(pane);
        return ok(true as const);
      } catch (cause) {
        return fail(cause);
      }
    });

    ipcMain.handle('panes:close', (_event, pane: string): DesktopApiResult<true> => {
      try {
        panes.close(String(pane));
        return ok(true as const);
      } catch (cause) {
        return fail(cause);
      }
    });

    ipcMain.handle('panes:list', (): DesktopApiResult<string[]> => ok(panes.list()));

    /**
     * The document link (addendum 02 §8). The main process relays and does
     * not read: the message is whatever the windows agreed between them, and
     * it goes to every window but the sender.
     */
    ipcMain.on('link:send', (event, message: unknown) => {
      panes.relay(event.sender.id, message);
    });
  }

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
        await rememberRecent(saved.path, file.project.title);
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
      await rememberRecent(loaded.path, loaded.file.project.title);
      return ok(toOpenResult(loaded));
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle('project:openPath', async (_event, path: string): Promise<DesktopApiResult<OpenResult>> => {
    try {
      const loaded = await loadProject(path);
      await rememberRecent(loaded.path, loaded.file.project.title);
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

  ipcMain.handle('project:list', async (): Promise<DesktopApiResult<ProjectEntry[]>> => {
    try {
      return ok(await listProjects());
    } catch (cause) {
      return fail(cause);
    }
  });

  /**
   * Taking a project away (spec §4).
   *
   * **To the platform's bin, never unlinked.** `shell.trashItem` is the one
   * delete a writer can undo without us, and a project is somebody's months of
   * work: an application that removed the file outright would be asking them
   * to trust a confirmation dialog with everything. Where the file has already
   * gone, this only takes the row off the list, which is still worth doing.
   *
   * The asking happens in the interface, where the writer can see what they
   * are being asked about. By the time it reaches here the answer is yes.
   */
  ipcMain.handle(
    'project:delete',
    async (_event, path: string): Promise<DesktopApiResult<{ deleted: boolean; recoverable: boolean }>> => {
      try {
        let deleted = false;
        try {
          await stat(path);
          await shell.trashItem(path);
          deleted = true;
        } catch {
          // Already gone, or the platform refused the bin. Either way the row
          // is what is left to remove, and the writer is told which happened.
          deleted = false;
        }
        await forgetRecent(path);
        return ok({ deleted, recoverable: deleted });
      } catch (cause) {
        return fail(cause);
      }
    },
  );

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

  ipcMain.handle(
    'project:exportPdf',
    async (
      _event,
      input: { file: unknown; options?: PrintOptions; kind?: PrintKind; outlineId?: string },
    ): Promise<DesktopApiResult<{ path: string; pageCount: number } | null>> => {
      try {
        return ok(await exportProjectPdf(input, getWindow()));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle(
    'project:print',
    async (
      _event,
      input: { file: unknown; options?: PrintOptions; kind?: PrintKind; outlineId?: string },
    ): Promise<DesktopApiResult<boolean>> => {
      try {
        return ok(await printProject(input));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  // --- account, sync and captures ------------------------------------------

  ipcMain.handle('cloud:status', async (): Promise<DesktopApiResult<AccountStatus>> => {
    try {
      return ok(await accountStatus());
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle('cloud:requestCode', async (_event, email: string): Promise<DesktopApiResult<true>> => {
    try {
      await requestSignInCode(email);
      return ok(true);
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle(
    'cloud:verifyCode',
    async (_event, input: { email: string; code: string }): Promise<DesktopApiResult<AccountStatus>> => {
      try {
        return ok(await verifySignInCode(input.email, input.code));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('cloud:signOut', async (): Promise<DesktopApiResult<true>> => {
    try {
      await signOut();
      return ok(true);
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle(
    'cloud:sync',
    async (_event, input: { file: unknown; path?: string }): Promise<DesktopApiResult<SyncOutcome>> => {
      try {
        return ok(await syncProject(input));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle(
    'cloud:captures',
    async (_event, projectId: string | null): Promise<DesktopApiResult<CaptureItem[]>> => {
      try {
        return ok(await listCaptures(projectId));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('cloud:resolveCapture', async (_event, capture: CaptureItem): Promise<DesktopApiResult<true>> => {
    try {
      await resolveCapture(capture);
      return ok(true);
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle(
    'cloud:reviewScene',
    async (
      _event,
      input: { sceneText: string; position?: string; format: 'screenplay' | 'prose' },
    ): Promise<DesktopApiResult<SceneVerdict>> => {
      try {
        return ok(await requestSceneReview(input));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('cloud:sceneReviewStatus', async (): Promise<DesktopApiResult<SceneReviewAvailability>> => {
    try {
      return ok(await sceneReviewStatus());
    } catch (cause) {
      return fail(cause);
    }
  });

  // --- licensing and updates -----------------------------------------------

  ipcMain.handle('license:activate', async (_event, serial: string): Promise<DesktopApiResult<ActivationResult>> => {
    try {
      const platform = devicePlatform();
      if (!platform) return fail(new Error('VC Writer is licensed for Windows and macOS.'));
      return ok(
        await activateLicense({
          serial,
          deviceFingerprint: await deviceFingerprint(),
          deviceName: deviceName(),
          platform,
          appVersion: app.getVersion(),
        }),
      );
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle('update:check', async (): Promise<DesktopApiResult<UpdateStatus>> => {
    try {
      return ok(await checkForUpdate());
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle(
    'update:download',
    async (
      _event,
      input: { expectedSha256: string; version: string },
    ): Promise<DesktopApiResult<DownloadedUpdate>> => {
      try {
        return ok(await downloadUpdate({ ...input, accessToken: await accessToken() }));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('update:install', async (_event, path: string): Promise<DesktopApiResult<true>> => {
    try {
      await runInstaller(path);
      return ok(true);
    } catch (cause) {
      return fail(cause);
    }
  });

  // --- error reporting ------------------------------------------------------

  ipcMain.handle('reporting:get', async (): Promise<DesktopApiResult<{ enabled: boolean }>> => {
    try {
      return ok(await reportingSettings());
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle('reporting:set', async (_event, enabled: boolean): Promise<DesktopApiResult<{ enabled: boolean }>> => {
    try {
      return ok(await setReportingEnabled(enabled === true));
    } catch (cause) {
      return fail(cause);
    }
  });

  /**
   * A crash in the renderer. The message and stack arrive as strings and are
   * treated as untrusted text: the redactor runs over them in the main process
   * regardless of what the renderer did or did not do first.
   */
  ipcMain.handle(
    'reporting:report',
    async (_event, input: { name?: string; message?: string; stack?: string }): Promise<DesktopApiResult<boolean>> => {
      try {
        const error = new Error(String(input?.message ?? ''));
        error.name = String(input?.name ?? 'Error');
        error.stack = typeof input?.stack === 'string' ? input.stack : '';
        return ok(await reportError(error, 'renderer'));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('app:version', () => ok({ version: app.getVersion(), platform: process.platform }));
};
