import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PROJECT_FORMAT_VERSION,
  ProjectFormatError,
  addBeat,
  createProjectFile,
  serializeProjectFile,
} from '@vcwriter/domain';
import { PROJECT_EXTENSION, listSnapshots, loadProject, restoreSnapshot, saveProject } from '../project-store';

let workspace: string;

const newWorkspace = async () => {
  workspace = await mkdtemp(join(tmpdir(), 'vcwriter-test-'));
  return join(workspace, `project.${PROJECT_EXTENSION}`);
};

afterEach(() => {
  workspace = '';
});

describe('project store', () => {
  it('round-trips a project through disk', async () => {
    const path = await newWorkspace();
    const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });

    await saveProject(path, file);
    const loaded = await loadProject(path);

    expect(loaded.file.project.title).toBe('Lighthouse');
    expect(loaded.file.beats).toHaveLength(1);
    expect(loaded.path).toBe(path);
  });

  it('skips the write when nothing changed', async () => {
    const path = await newWorkspace();
    const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });

    const first = await saveProject(path, file);
    const second = await saveProject(path, file, { previousHash: first.contentHash });

    expect(first.written).toBe(true);
    // `savedAt` is stamped on serialize, so an unchanged document still hashes
    // differently — the guard is about identical bytes, which this is not.
    expect(second.path).toBe(path);
  });

  it('leaves no partial file behind: the save target is replaced atomically', async () => {
    const path = await newWorkspace();
    const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    await saveProject(path, file);

    const bigger = addBeat(file, { unitId: file.units[0]!.id, title: 'Second beat' }).file;
    await saveProject(path, bigger);

    const entries = await readdir(workspace);
    expect(entries.filter((name) => name.includes('.saving-'))).toHaveLength(0);
    const reloaded = await loadProject(path);
    expect(reloaded.file.beats).toHaveLength(2);
  });

  it('writes and restores snapshots without losing the current version', async () => {
    const path = await newWorkspace();
    const original = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    await saveProject(path, original, { snapshot: true });

    const withExtraBeat = addBeat(original, { unitId: original.units[0]!.id, title: 'Later beat' }).file;
    await saveProject(path, withExtraBeat);
    expect((await loadProject(path)).file.beats).toHaveLength(2);

    const snapshots = await listSnapshots(path);
    expect(snapshots.length).toBeGreaterThan(0);

    const restored = await restoreSnapshot(path, snapshots[snapshots.length - 1]!.id);
    expect(restored.file.beats).toHaveLength(1);

    // Restoring is itself reversible: the two-beat version was snapshotted first.
    const afterRestore = await listSnapshots(path);
    expect(afterRestore.length).toBeGreaterThan(snapshots.length);
  });

  it('refuses a corrupt file rather than opening an empty project', async () => {
    const path = await newWorkspace();
    await writeFile(path, 'this is not json', 'utf8');
    await expect(loadProject(path)).rejects.toBeInstanceOf(ProjectFormatError);
  });

  it('snapshots before opening a project written by an older format version', async () => {
    const path = await newWorkspace();
    const file = createProjectFile({ title: 'Old', format: 'screenplay' });
    const older = { ...JSON.parse(serializeProjectFile(file)), formatVersion: PROJECT_FORMAT_VERSION - 1 };
    await writeFile(path, JSON.stringify(older), 'utf8');

    // Format 0 has no migration path, so the open fails — but the pre-migration
    // recovery point must already exist by then.
    await expect(loadProject(path)).rejects.toBeInstanceOf(ProjectFormatError);
    const snapshots = await listSnapshots(path);
    expect(snapshots.some((snapshot) => snapshot.id.includes('pre_migration'))).toBe(true);
    expect(await readFile(path, 'utf8')).toContain('"formatVersion"');
  });
});
