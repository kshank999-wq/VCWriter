import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectFile, ProjectFormat } from '@vcwriter/domain';

/**
 * Open project state plus autosave.
 *
 * Spec §15: autosave must be frequent but non-blocking, and no edit may be lost
 * to a crash. So edits land in memory immediately, a timer flushes them to disk
 * on the project's configured interval, and the main process skips the write
 * entirely when nothing changed. Every Nth flush also writes a snapshot, which
 * is the recovery path §6 asks for.
 */

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface UseProjectResult {
  path: string | null;
  file: ProjectFile | null;
  saveState: SaveState;
  error: string | null;
  lastSavedAt: string | null;
  createProject(input: { title: string; format: ProjectFormat; author?: string }): Promise<void>;
  openProject(): Promise<void>;
  openProjectAtPath(path: string): Promise<void>;
  /** Apply a domain mutation; the result is queued for autosave. */
  update(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Adopt a whole project wholesale — the result of a sync merge. */
  replace(next: ProjectFile): void;
  /**
   * Adopt a document the main process just wrote to disk — a restored
   * snapshot. Unlike `replace` this is already saved, so it must not be marked
   * dirty: writing it back would only make a second identical snapshot.
   */
  adoptLoaded(loaded: { path: string; file: ProjectFile; contentHash: string }): void;
  saveNow(): Promise<void>;
  closeProject(): void;
}

export const useProject = (): UseProjectResult => {
  const [path, setPath] = useState<string | null>(null);
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Refs, not state: the autosave timer must read the newest values without
  // being torn down and recreated on every keystroke.
  const fileRef = useRef<ProjectFile | null>(null);
  const pathRef = useRef<string | null>(null);
  const hashRef = useRef<string | undefined>(undefined);
  const dirtyRef = useRef(false);
  const savesSinceSnapshotRef = useRef(0);

  const adopt = useCallback((next: { path: string; file: ProjectFile; contentHash: string }) => {
    pathRef.current = next.path;
    fileRef.current = next.file;
    hashRef.current = next.contentHash;
    dirtyRef.current = false;
    savesSinceSnapshotRef.current = 0;
    setPath(next.path);
    setFile(next.file);
    setSaveState('saved');
    setError(null);
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    const currentPath = pathRef.current;
    const currentFile = fileRef.current;
    if (!currentPath || !currentFile || !dirtyRef.current) return;

    const snapshotEvery = currentFile.settings.snapshotEveryNSaves;
    dirtyRef.current = false;
    setSaveState('saving');

    const result = await window.vcwriter.saveProject({
      path: currentPath,
      file: currentFile,
      ...(hashRef.current ? { previousHash: hashRef.current } : {}),
      snapshot: savesSinceSnapshotRef.current + 1 >= snapshotEvery,
    });

    if (!result.ok || !result.data) {
      // Keep the edit pending so the next tick tries again rather than
      // discarding work because one write failed.
      dirtyRef.current = true;
      setSaveState('error');
      setError(result.error ?? 'Could not save the project');
      return;
    }

    hashRef.current = result.data.contentHash;
    savesSinceSnapshotRef.current =
      savesSinceSnapshotRef.current + 1 >= snapshotEvery ? 0 : savesSinceSnapshotRef.current + 1;
    if (result.data.written) setLastSavedAt(new Date().toISOString());
    setSaveState('saved');
    setError(null);
  }, []);

  useEffect(() => {
    const interval = file?.settings.autosaveIntervalMs ?? 5000;
    const timer = window.setInterval(() => {
      void flush();
    }, interval);
    return () => window.clearInterval(timer);
  }, [file?.settings.autosaveIntervalMs, flush]);

  // A close or reload must not strand the last few seconds of writing.
  useEffect(() => {
    const handler = () => {
      void flush();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [flush]);

  const runOpen = useCallback(
    async (
      operation: Promise<{
        ok: boolean;
        data?: { path: string; file: ProjectFile; contentHash: string };
        error?: string;
      }>,
    ) => {
      await flush();
      const result = await operation;
      if (!result.ok || !result.data) {
        if (result.error && !/cancelled/i.test(result.error)) setError(result.error);
        return;
      }
      adopt(result.data);
    },
    [adopt, flush],
  );

  const createProject = useCallback(
    async (input: { title: string; format: ProjectFormat; author?: string }) => {
      await runOpen(window.vcwriter.createProject(input));
    },
    [runOpen],
  );

  const openProject = useCallback(async () => {
    await runOpen(window.vcwriter.openProject());
  }, [runOpen]);

  const openProjectAtPath = useCallback(
    async (target: string) => {
      await runOpen(window.vcwriter.openProjectAtPath(target));
    },
    [runOpen],
  );

  const update = useCallback((mutate: (current: ProjectFile) => ProjectFile) => {
    const current = fileRef.current;
    if (!current) return;
    const next = mutate(current);
    fileRef.current = next;
    dirtyRef.current = true;
    setFile(next);
    setSaveState('dirty');
  }, []);

  /**
   * Adopt a merged project after a sync. It is marked dirty so the next flush
   * writes the merge to disk — the file on this machine and the copy in the
   * cloud should not disagree once the writer has been told they agree.
   */
  const replace = useCallback((next: ProjectFile) => {
    fileRef.current = next;
    dirtyRef.current = true;
    setFile(next);
    setSaveState('dirty');
  }, []);

  const adoptLoaded = useCallback(
    (loaded: { path: string; file: ProjectFile; contentHash: string }) => {
      adopt(loaded);
    },
    [adopt],
  );

  const closeProject = useCallback(() => {
    void flush().then(() => {
      pathRef.current = null;
      fileRef.current = null;
      hashRef.current = undefined;
      setPath(null);
      setFile(null);
      setSaveState('idle');
    });
  }, [flush]);

  return {
    path,
    file,
    saveState,
    error,
    lastSavedAt,
    createProject,
    openProject,
    openProjectAtPath,
    update,
    replace,
    adoptLoaded,
    saveNow: flush,
    closeProject,
  };
};
