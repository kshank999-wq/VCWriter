import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import {
  PROJECT_FORMAT_VERSION,
  ProjectFormatError,
  parseProjectFile,
  serializeProjectFile,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * Project persistence on disk.
 *
 * Spec §15 is absolute: no manuscript data loss on crash, update, connectivity
 * interruption or sync conflict. Three habits deliver that here.
 *
 *  1. Every save is atomic — write a sibling temp file, fsync-by-rename over
 *     the original. A crash mid-write leaves the previous good file intact
 *     rather than a truncated one.
 *  2. Rolling snapshots live beside the project, so a bad edit or a failed
 *     format migration is recoverable (§6, §14).
 *  3. Content hashing means an autosave that changed nothing writes nothing.
 *
 * The file itself is the platform-neutral document from @vcwriter/domain, which
 * is what makes a project written on Windows open on macOS (§3.1).
 */

export const PROJECT_EXTENSION = 'vcw';

const SNAPSHOT_DIR = '.vcwriter-snapshots';
const MAX_SNAPSHOTS = 30;

export interface LoadedProject {
  path: string;
  file: ProjectFile;
  /** Hash of the bytes on disk, so an unchanged autosave is a no-op. */
  contentHash: string;
}

export interface SnapshotSummary {
  id: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
}

const hash = (contents: string): string => createHash('sha256').update(contents).digest('hex');

const snapshotDirFor = (projectPath: string): string =>
  join(dirname(projectPath), SNAPSHOT_DIR, basename(projectPath, `.${PROJECT_EXTENSION}`));

export const loadProject = async (path: string): Promise<LoadedProject> => {
  const contents = await readFile(path, 'utf8');
  let raw: unknown;
  try {
    raw = JSON.parse(contents);
  } catch (cause) {
    throw new ProjectFormatError(`${basename(path)} is not a valid VC Writer project file`, cause);
  }

  const declaredVersion = (raw as { formatVersion?: number })?.formatVersion;
  // Take a recovery point before an upgrade rewrites anything (§14).
  if (typeof declaredVersion === 'number' && declaredVersion < PROJECT_FORMAT_VERSION) {
    await writeSnapshot(path, contents, 'pre_migration');
  }

  const file = parseProjectFile(raw);
  return { path, file, contentHash: hash(contents) };
};

export interface SaveResult {
  path: string;
  contentHash: string;
  /** False when the content was byte-identical and nothing was written. */
  written: boolean;
}

export const saveProject = async (
  path: string,
  file: ProjectFile,
  options: { previousHash?: string; snapshot?: boolean } = {},
): Promise<SaveResult> => {
  const contents = serializeProjectFile(file);
  const contentHash = hash(contents);
  if (options.previousHash === contentHash) {
    return { path, contentHash, written: false };
  }

  await mkdir(dirname(path), { recursive: true });

  // Atomic replace: a crash between these two steps leaves the old file whole.
  const temporaryPath = `${path}.saving-${process.pid}`;
  await writeFile(temporaryPath, contents, 'utf8');
  await rename(temporaryPath, path);

  if (options.snapshot) {
    await writeSnapshot(path, contents, 'autosave');
  }

  return { path, contentHash, written: true };
};

export const writeSnapshot = async (
  projectPath: string,
  contents: string,
  reason: 'autosave' | 'manual' | 'pre_migration',
): Promise<string> => {
  const directory = snapshotDirFor(projectPath);
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = join(directory, `${stamp}.${reason}.${PROJECT_EXTENSION}`);
  await writeFile(snapshotPath, contents, 'utf8');
  await pruneSnapshots(directory);
  return snapshotPath;
};

const pruneSnapshots = async (directory: string): Promise<void> => {
  const entries = (await readdir(directory)).filter((name) => name.endsWith(`.${PROJECT_EXTENSION}`)).sort();
  // Keep pre_migration snapshots: they are the only copy of the pre-upgrade
  // document, and they are rare.
  const disposable = entries.filter((name) => !name.includes('.pre_migration.'));
  const excess = disposable.length - MAX_SNAPSHOTS;
  for (let i = 0; i < excess; i += 1) {
    const name = disposable[i];
    if (name) await unlink(join(directory, name)).catch(() => undefined);
  }
};

export const listSnapshots = async (projectPath: string): Promise<SnapshotSummary[]> => {
  const directory = snapshotDirFor(projectPath);
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return [];
  }

  const summaries = await Promise.all(
    entries
      .filter((name) => name.endsWith(`.${PROJECT_EXTENSION}`))
      .map(async (name) => {
        const path = join(directory, name);
        const info = await stat(path);
        return {
          id: name,
          path,
          createdAt: info.mtime.toISOString(),
          sizeBytes: info.size,
        };
      }),
  );

  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/**
 * Restore a snapshot over the live project. The current file is snapshotted
 * first, so restoring is itself undoable (§19: reversible, never destructive).
 */
export const restoreSnapshot = async (projectPath: string, snapshotId: string): Promise<LoadedProject> => {
  const snapshotPath = join(snapshotDirFor(projectPath), snapshotId);
  const contents = await readFile(snapshotPath, 'utf8');
  const file = parseProjectFile(JSON.parse(contents));

  const current = await readFile(projectPath, 'utf8').catch(() => null);
  if (current) await writeSnapshot(projectPath, current, 'manual');

  await saveProject(projectPath, file);
  return loadProject(projectPath);
};
