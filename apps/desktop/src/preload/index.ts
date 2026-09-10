import { contextBridge, ipcRenderer } from 'electron';
import type {
  CaptureItem,
  MergeResult,
  PrintOptions,
  ProjectFile,
  ProjectFormat,
  SceneVerdict,
  UpdateDecision,
} from '@vcwriter/domain';

/**
 * The only bridge between the renderer and the operating system.
 *
 * Each method is an explicit, typed channel. Nothing generic is exposed — no
 * `invoke(channel, ...)` escape hatch — so the renderer's reach is exactly this
 * list and no more.
 */

export interface DesktopApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface OpenResult {
  path: string;
  file: ProjectFile;
  contentHash: string;
}

export interface SnapshotSummary {
  id: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
  /** Why the recovery point exists, so the writer can find the right one. */
  reason: 'autosave' | 'manual' | 'pre_migration' | 'pre_sync';
}

export interface VcWriterApi {
  createProject(input: {
    title: string;
    format: ProjectFormat;
    author?: string;
    logline?: string;
  }): Promise<DesktopApiResult<OpenResult>>;
  openProject(): Promise<DesktopApiResult<OpenResult>>;
  openProjectAtPath(path: string): Promise<DesktopApiResult<OpenResult>>;
  saveProject(input: {
    path: string;
    file: ProjectFile;
    previousHash?: string;
    snapshot?: boolean;
  }): Promise<DesktopApiResult<{ contentHash: string; written: boolean }>>;
  recentProjects(): Promise<DesktopApiResult<string[]>>;
  listSnapshots(path: string): Promise<DesktopApiResult<SnapshotSummary[]>>;
  restoreSnapshot(input: { path: string; snapshotId: string }): Promise<DesktopApiResult<OpenResult>>;
  /** Returns null when the writer cancelled the save dialog. */
  exportPdf(input: {
    file: ProjectFile;
    options?: PrintOptions;
    /**
     * Which document: the manuscript, the AV sheet, or the board (addendum 05
     * §8). Omitted means the script — and a short-form project prints its
     * sheet whatever is asked for, because it has no script to print instead.
     */
    kind?: 'script' | 'sheet' | 'board';
  }): Promise<DesktopApiResult<{ path: string; pageCount: number } | null>>;
  print(input: {
    file: ProjectFile;
    options?: PrintOptions;
    kind?: 'script' | 'sheet' | 'board';
  }): Promise<DesktopApiResult<boolean>>;
  appInfo(): Promise<DesktopApiResult<{ version: string; platform: string }>>;

  // Sync is optional: a writer who never signs in has a fully working desktop
  // application whose projects live in files.
  accountStatus(): Promise<DesktopApiResult<AccountStatus>>;
  requestSignInCode(email: string): Promise<DesktopApiResult<true>>;
  verifySignInCode(input: { email: string; code: string }): Promise<DesktopApiResult<AccountStatus>>;
  signOut(): Promise<DesktopApiResult<true>>;
  syncProject(input: { file: ProjectFile; path?: string }): Promise<DesktopApiResult<SyncOutcome>>;
  listCaptures(projectId: string | null): Promise<DesktopApiResult<CaptureItem[]>>;
  resolveCapture(capture: CaptureItem): Promise<DesktopApiResult<true>>;
  reviewScene(input: {
    sceneText: string;
    position?: string;
    format: 'screenplay' | 'prose';
  }): Promise<DesktopApiResult<SceneVerdict>>;
  /** Whether a read can be asked for, and if not, what to tell the writer. */
  sceneReviewStatus(): Promise<DesktopApiResult<{ available: boolean; reason: string | null }>>;

  // Licensing and updates (§3.3).
  activateLicense(serial: string): Promise<DesktopApiResult<ActivationResult>>;
  checkForUpdate(): Promise<DesktopApiResult<UpdateStatus>>;
  downloadUpdate(input: {
    expectedSha256: string;
    version: string;
  }): Promise<DesktopApiResult<{ path: string; version: string; verified: boolean }>>;
  installUpdate(path: string): Promise<DesktopApiResult<true>>;
  /** Whether the writer has opted in to sending error reports. Off by default. */
  reportingSettings(): Promise<DesktopApiResult<{ enabled: boolean }>>;
  setReporting(enabled: boolean): Promise<DesktopApiResult<{ enabled: boolean }>>;
  reportError(input: { name: string; message: string; stack: string }): Promise<DesktopApiResult<boolean>>;

  /** Sections in windows of their own, and the link between them (§8). */
  panes: PaneApi;
  link: LinkApi;
  /** The native application menu (§13). */
  menu: MenuApi;
}

/**
 * The menus are described in the renderer and built natively here, so the
 * two can never say different things. `install` hands over that description
 * and which items are ticked; `onCommand` is how the choice comes back.
 */
export interface MenuApi {
  install(input: { menus: unknown; checked: string[] }): Promise<DesktopApiResult<true>>;
  onCommand(handler: (command: string) => void): () => void;
  /** True when the main process is drawing the real menu, so the in-app bar stands down. */
  native(): boolean;
}

/**
 * Moving a section of the workspace to a window of its own — and, from there,
 * to another monitor. A pane key is `script`, `research`, `viewer`, `lanes`,
 * or `beat:<id>`; beats key on their own id so two can be open at once.
 */
export interface PaneApi {
  open(pane: string): Promise<DesktopApiResult<true>>;
  close(pane: string): Promise<DesktopApiResult<true>>;
  list(): Promise<DesktopApiResult<string[]>>;
  /** Told whenever a section is taken out or put back. Returns an unsubscribe. */
  onChanged(handler: (panes: string[]) => void): () => void;
  /** Which section this window *is*, or null in the workspace itself. */
  self(): string | null;
}

/**
 * The document link. The main process relays these messages between windows
 * and never reads them; what they mean is agreed in the renderer (`link.ts`).
 */
export interface LinkApi {
  send(message: Record<string, unknown>): void;
  subscribe(handler: (message: Record<string, unknown>) => void): () => void;
}

export interface ActivationResult {
  activated: boolean;
  reason?: string;
  message?: string;
}

export interface UpdateStatus {
  decision: UpdateDecision;
  currentVersion: string;
}

export interface AccountStatus {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
}

export interface SyncOutcome {
  merged: ProjectFile;
  conflicts: MergeResult['conflicts'];
  summary: MergeResult['summary'];
  syncedAt: string;
}

const api: VcWriterApi = {
  createProject: (input) => ipcRenderer.invoke('project:create', input),
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectAtPath: (path) => ipcRenderer.invoke('project:openPath', path),
  saveProject: (input) => ipcRenderer.invoke('project:save', input),
  recentProjects: () => ipcRenderer.invoke('project:recents'),
  listSnapshots: (path) => ipcRenderer.invoke('project:snapshots', path),
  restoreSnapshot: (input) => ipcRenderer.invoke('project:restoreSnapshot', input),
  exportPdf: (input) => ipcRenderer.invoke('project:exportPdf', input),
  print: (input) => ipcRenderer.invoke('project:print', input),
  appInfo: () => ipcRenderer.invoke('app:version'),
  accountStatus: () => ipcRenderer.invoke('cloud:status'),
  requestSignInCode: (email) => ipcRenderer.invoke('cloud:requestCode', email),
  verifySignInCode: (input) => ipcRenderer.invoke('cloud:verifyCode', input),
  signOut: () => ipcRenderer.invoke('cloud:signOut'),
  syncProject: (input) => ipcRenderer.invoke('cloud:sync', input),
  listCaptures: (projectId) => ipcRenderer.invoke('cloud:captures', projectId),
  resolveCapture: (capture) => ipcRenderer.invoke('cloud:resolveCapture', capture),
  reviewScene: (input) => ipcRenderer.invoke('cloud:reviewScene', input),
  sceneReviewStatus: () => ipcRenderer.invoke('cloud:sceneReviewStatus'),
  activateLicense: (serial) => ipcRenderer.invoke('license:activate', serial),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: (input) => ipcRenderer.invoke('update:download', input),
  installUpdate: (path) => ipcRenderer.invoke('update:install', path),
  reportingSettings: () => ipcRenderer.invoke('reporting:get'),
  setReporting: (enabled) => ipcRenderer.invoke('reporting:set', enabled),
  reportError: (input) => ipcRenderer.invoke('reporting:report', input),

  panes: {
    open: (pane) => ipcRenderer.invoke('panes:open', pane),
    close: (pane) => ipcRenderer.invoke('panes:close', pane),
    list: () => ipcRenderer.invoke('panes:list'),
    onChanged(handler) {
      const listener = (_event: unknown, panes: string[]) => handler(panes);
      ipcRenderer.on('panes:changed', listener);
      return () => ipcRenderer.off('panes:changed', listener);
    },
    // Which section this window is, from the URL the main process opened it
    // with. The workspace has no `pane`, so it gets null. The preload is
    // compiled against Node's types, hence the reach for the window's own.
    self: () => {
      const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
      return new URLSearchParams(search).get('pane');
    },
  },

  menu: {
    install: (input) => ipcRenderer.invoke('menu:install', input),
    onCommand(handler) {
      const listener = (_event: unknown, command: string) => handler(command);
      ipcRenderer.on('menu:command', listener);
      return () => ipcRenderer.off('menu:command', listener);
    },
    // Only a Mac keeps its menus outside the window; everywhere else the bar
    // in the window is the one the writer uses.
    native: () => process.platform === 'darwin',
  },

  link: {
    send: (message) => ipcRenderer.send('link:send', message),
    subscribe(handler) {
      const listener = (_event: unknown, message: Record<string, unknown>) => handler(message);
      ipcRenderer.on('link:message', listener);
      return () => ipcRenderer.off('link:message', listener);
    },
  },
};

contextBridge.exposeInMainWorld('vcwriter', api);
