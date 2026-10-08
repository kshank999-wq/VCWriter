import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { dirname, join } from 'node:path';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import {
  copyTitle,
  createProjectFile,
  freeName,
  parseProjectFile,
  projectsNewestFirst,
  suggestedFileName,
  type ProjectFolder,
  type CaptureItem,
  type DeskStanding,
  type SaveKind,
  type LearningAidKind,
  type LearningSuggestion,
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
  requestLearningAid,
  requestSceneReview,
  sendOneSheet,
  requestSignInCode,
  resolveCapture,
  learningAidStatus,
  noteCategoriesStatus,
  requestNoteCategories,
  sceneReviewStatus,
  signOut,
  syncProject,
  roomStanding,
  contributeToRoom,
  fetchRoomMaster,
  verifySignInCode,
  type AccountStatus,
  type ActivationResult,
  type SceneReviewAvailability,
  type SyncOutcome,
} from './cloud';
import { deviceFingerprint, deviceName, devicePlatform } from './device';
import { licenseStanding } from './license-check';
import { checkForUpdate, downloadUpdate, runInstaller, type DownloadedUpdate, type UpdateStatus } from './updater';
import { reportError, reportingSettings, setReportingEnabled } from './reporting';
import { kindlePreviewerStatus, openInKindlePreviewer } from './kindle-previewer';
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
const homePath = () => join(app.getPath('userData'), 'projects-folder.json');

/**
 * Where new projects go on this machine (addendum 34).
 *
 * **A fact about the computer rather than about the document**, so it lives
 * beside the recents in `userData` and never in a project file: a book opened
 * on a second machine must not drag the first machine's folders with it.
 *
 * The default is what the program used before anybody could choose, so a
 * machine that has never been asked behaves exactly as it did.
 */
const defaultHome = () => join(app.getPath('documents'), 'VC Writer');

const readHome = async (): Promise<string> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(homePath(), 'utf8'));
    const folder = (parsed as { folder?: unknown })?.folder;
    return typeof folder === 'string' && folder.trim().length > 0 ? folder : defaultHome();
  } catch {
    return defaultHome();
  }
};

/**
 * **Remembered by being used.** Creating a project somewhere and saving one
 * somewhere both say where this writer keeps their work; *opening* one does
 * not, because a colleague's file read out of Downloads must not move where
 * your own books are written.
 */
const rememberHome = async (folder: string): Promise<void> => {
  await writeFile(homePath(), JSON.stringify({ folder }), 'utf8').catch(() => undefined);
};

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

  /**
   * Where new projects go, and changing it (addendum 34).
   *
   * Two methods rather than one that both reads and writes: the panel asks on
   * every visit and only a press changes anything.
   */
  ipcMain.handle(
    'project:home',
    async (): Promise<DesktopApiResult<ProjectFolder>> => ok({ path: await readHome(), canChoose: true }),
  );

  ipcMain.handle('project:chooseHome', async (): Promise<DesktopApiResult<ProjectFolder>> => {
    try {
      const window = getWindow();
      const options = {
        properties: ['openDirectory' as const, 'createDirectory' as const],
        defaultPath: await readHome(),
        title: 'Where new projects go',
      };
      const choice = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
      const folder = choice.filePaths[0];
      // Dismissing is not a failure and must not paint one (addendum 29 §1):
      // the writer changed their mind, and nothing has moved.
      if (choice.canceled || !folder) return ok({ path: await readHome(), canChoose: true });
      await rememberHome(folder);
      return ok({ path: folder, canChoose: true });
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle(
    'project:create',
    async (
      _event,
      input: { title: string; format: ProjectFormat; author?: string; logline?: string; file?: ProjectFile },
    ): Promise<DesktopApiResult<OpenResult>> => {
      try {
        /**
         * **No second dialog.** The folder is set on the page the writer is
         * standing on, so asking again on the press would be two controls for
         * one act — and the save dialog it replaces was the question asked
         * after the screen that never mentioned it.
         */
        const folder = await readHome();
        await mkdir(folder, { recursive: true });
        const here = new Set(await readdir(folder).catch(() => [] as string[]));
        const stem = suggestedFileName(input.title, 'as');
        const name = freeName(stem, (candidate) => here.has(candidate), `.${PROJECT_EXTENSION}`);

        /**
         * **A document given, or an empty one** (addendum 33 §10). An import
         * is a project arriving, and it must arrive in a file of its own:
         * adopting it into the open project's path wrote a new book over
         * whatever was there.
         */
        const file = input.file ? parseProjectFile(input.file) : createProjectFile(input);
        const saved = await saveProject(join(folder, name), file);
        await rememberHome(folder);
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
      // *So when you open VC Writer, it'll be able to find that location.*
      const options = { properties: ['openFile' as const], filters: FILE_FILTERS, defaultPath: await readHome() };
      const choice = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
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

  /**
   * Save as, and save a copy (addendum 29 §1). **One handler, because the two
   * acts differ only in where the writer ends up** — which is the renderer's
   * business and not this file's: here both ask for a place and write the whole
   * document to it. A second handler would be a second answer to *how is a
   * project written somewhere else*, free to drift the first time one of them
   * learned something.
   *
   * The document is validated on the way in for `project:save`'s reason, and
   * **the place is remembered** by the same `rememberRecent` an open and a
   * create call, which is the whole of Ken's *save the location of that file so
   * it can re-find it*: no new record, and the copy turns up on `File ▸ Open`
   * and the Projects screen beside everything else.
   */
  ipcMain.handle(
    'project:saveAs',
    async (
      _event,
      input: { kind: SaveKind; file: unknown; suggestedName?: string },
    ): Promise<DesktopApiResult<{ path: string; file: ProjectFile; contentHash: string }>> => {
      try {
        const incoming = parseProjectFile(input.file);
        // **The copy says it is one and the original is untouched.** Only the
        // copy's title is changed, and only here, so the document the writer
        // goes on editing is byte-identical whichever act was asked for.
        const file: ProjectFile =
          input.kind === 'copy'
            ? { ...incoming, project: { ...incoming.project, title: copyTitle(incoming.project.title) } }
            : incoming;

        const name = input.suggestedName || suggestedFileName(file.project.title, input.kind);
        // It opens where this writer keeps their work rather than at a folder
        // the program picked once (addendum 34).
        const suggested = join(await readHome(), `${name}.${PROJECT_EXTENSION}`);
        const window = getWindow();
        const options = { defaultPath: suggested, filters: FILE_FILTERS };
        const choice = window
          ? await dialog.showSaveDialog(window, options)
          : await dialog.showSaveDialog(options);
        if (choice.canceled || !choice.filePath) return fail(new Error('Cancelled'));

        const saved = await saveProject(choice.filePath, file);
        // Putting a project somewhere says where this writer keeps them.
        await rememberHome(dirname(saved.path));
        await rememberRecent(saved.path, file.project.title);
        return ok({ path: saved.path, file, contentHash: saved.contentHash });
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

  // An export's files, into a folder of their own (addendum 23 §7). The
  // writer picks the parent; the folder is made there and the files go in,
  // so an eBook, its cover and its report arrive together.
  ipcMain.handle(
    'project:saveExport',
    async (
      _event,
      input: { folderName: string; files: { name: string; bytes: Uint8Array; mediaType: string }[] },
    ): Promise<DesktopApiResult<{ folder: string; paths: string[] } | null>> => {
      try {
        const window = getWindow();
        const options = { title: 'Where to put the export', properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] };
        const choice = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
        const parent = choice.filePaths[0];
        if (choice.canceled || !parent) return ok(null);
        const safe = input.folderName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim() || 'Export';
        const folder = join(parent, safe);
        await mkdir(folder, { recursive: true });
        const paths: string[] = [];
        for (const one of input.files) {
          const target = join(folder, one.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-'));
          await writeFile(target, Buffer.from(one.bytes));
          paths.push(target);
        }
        return ok({ folder, paths });
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle(
    'project:exportPdf',
    async (
      _event,
      input: {
        file: unknown;
        options?: PrintOptions;
        kind?: PrintKind;
        outlineId?: string;
        html?: string;
        paper?: { width: number; height: number };
      },
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
      input: {
        file: unknown;
        options?: PrintOptions;
        kind?: PrintKind;
        outlineId?: string;
        html?: string;
        paper?: { width: number; height: number };
      },
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

  // The Writers Room, from the desktop (addendum 07 §14, stage 11).
  //
  // Three doors and none of them is an overwrite: where this copy stands, work
  // sent up as a *contribution*, and the master fetched down as a document the
  // writer decides what to do with.
  ipcMain.handle(
    'room:standing',
    async (_event, input: { roomId: string; file: unknown }) => {
      try {
        return ok(await roomStanding(input));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle(
    'room:contribute',
    async (_event, input: { roomId: string; file: unknown; note?: string }) => {
      try {
        return ok(await contributeToRoom(input));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('room:fetchMaster', async (_event, input: { roomId: string }) => {
    try {
      return ok(await fetchRoomMaster(input));
    } catch (cause) {
      return fail(cause);
    }
  });

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

  ipcMain.handle(
    'cloud:suggestLearningAid',
    async (
      _event,
      input: { kind: LearningAidKind; sectionText: string; sectionTitle: string },
    ): Promise<DesktopApiResult<LearningSuggestion>> => {
      try {
        return ok(await requestLearningAid(input));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle(
    'cloud:sendOneSheet',
    async (
      _event,
      input: { to: string; message: string; sheet: Record<string, string> },
    ): Promise<DesktopApiResult<true>> => {
      try {
        return ok(await sendOneSheet(input));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('cloud:learningAidStatus', async (): Promise<DesktopApiResult<SceneReviewAvailability>> => {
    try {
      return ok(await learningAidStatus());
    } catch (cause) {
      return fail(cause);
    }
  });

  ipcMain.handle(
    'cloud:suggestNoteCategories',
    async (
      _event,
      input: { passages: string[]; categories: string[] },
    ): Promise<DesktopApiResult<Array<{ name: string; because: string }>>> => {
      try {
        return ok(await requestNoteCategories(input));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

  ipcMain.handle('cloud:noteCategoriesStatus', async (): Promise<DesktopApiResult<SceneReviewAvailability>> => {
    try {
      return ok(await noteCategoriesStatus());
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

  /**
   * What this machine last heard about its licence (addendum 32 §8).
   *
   * It answers with the record rather than with a live reading: what follows
   * from a status and a date is the domain's to decide, in one place, so this
   * hands over the facts and nothing else.
   */
  ipcMain.handle(
    'license:standing',
    async (_event, recheck?: boolean): Promise<DesktopApiResult<DeskStanding | null>> => {
      try {
        return ok(await licenseStanding(recheck === true));
      } catch (cause) {
        return fail(cause);
      }
    },
  );

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

  // Kindle Previewer (addendum 23 §9): where it is installed, and the EPUB opened in it.
  ipcMain.handle('app:kindlePreviewer', async (): Promise<DesktopApiResult<{ installed: boolean; path: string | null }>> => {
    try {
      return ok(await kindlePreviewerStatus());
    } catch (cause) {
      return fail(cause);
    }
  });
  ipcMain.handle('app:openInKindlePreviewer', async (_event, epubPath: string): Promise<DesktopApiResult<boolean>> => {
    try {
      const refusal = await openInKindlePreviewer(epubPath);
      return refusal ? { ok: false, error: refusal } : ok(true);
    } catch (cause) {
      return fail(cause);
    }
  });
};
