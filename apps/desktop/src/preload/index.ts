import { contextBridge, ipcRenderer } from 'electron';
import type { PrintOptions, ProjectFile, ProjectFormat } from '@vcwriter/domain';

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
};

contextBridge.exposeInMainWorld('vcwriter', api);
