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
  }): Promise<DesktopApiResult<{ path: string; pageCount: number } | null>>;
  print(input: { file: ProjectFile; options?: PrintOptions }): Promise<DesktopApiResult<boolean>>;
  appInfo(): Promise<DesktopApiResult<{ version: string; platform: string }>>;

  // Sync is optional: a writer who never signs in has a fully working desktop
  // application whose projects live in files.
  accountStatus(): Promise<DesktopApiResult<AccountStatus>>;
  requestSignInCode(email: string): Promise<DesktopApiResult<true>>;
  verifySignInCode(input: { email: string; code: string }): Promise<DesktopApiResult<AccountStatus>>;
  signOut(): Promise<DesktopApiResult<true>>;
  syncProject(input: { file: ProjectFile }): Promise<DesktopApiResult<SyncOutcome>>;
  listCaptures(projectId: string | null): Promise<DesktopApiResult<CaptureItem[]>>;
  resolveCapture(capture: CaptureItem): Promise<DesktopApiResult<true>>;
  reviewScene(input: {
    sceneText: string;
    position?: string;
    format: 'screenplay' | 'prose';
  }): Promise<DesktopApiResult<SceneVerdict>>;

  // Licensing and updates (§3.3).
  activateLicense(serial: string): Promise<DesktopApiResult<ActivationResult>>;
  checkForUpdate(): Promise<DesktopApiResult<UpdateStatus>>;
  downloadUpdate(input: {
    expectedSha256: string;
    version: string;
  }): Promise<DesktopApiResult<{ path: string; version: string; verified: boolean }>>;
  installUpdate(path: string): Promise<DesktopApiResult<true>>;
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
  activateLicense: (serial) => ipcRenderer.invoke('license:activate', serial),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: (input) => ipcRenderer.invoke('update:download', input),
  installUpdate: (path) => ipcRenderer.invoke('update:install', path),
};

contextBridge.exposeInMainWorld('vcwriter', api);
