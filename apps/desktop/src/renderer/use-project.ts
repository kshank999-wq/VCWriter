import { useCallback, useEffect, useRef, useState } from 'react';
import { isWritersAct, remember, type HistoryStep, type ProjectFile, type ProjectFormat } from '@vcwriter/domain';

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
  /**
   * Back one step, and forward again (addendum 02 §6c). Every act is a pure
   * function of the document, so undo is the document before it rather than a
   * per-act inverse — which is what makes *everything you do* true of an act
   * built tomorrow as much as of one built today.
   */
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
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
  /**
   * Undo and redo (addendum 02 §6c, from Ken). Refs for the same reason the
   * file is one — nothing here may be torn down and rebuilt on a keystroke —
   * with one small piece of state so the menu can grey what cannot be done.
   */
  const pastRef = useRef<HistoryStep[]>([]);
  const futureRef = useRef<ProjectFile[]>([]);
  const [steps, setSteps] = useState({ past: 0, future: 0 });
  const saySteps = useCallback(() => {
    setSteps({ past: pastRef.current.length, future: futureRef.current.length });
  }, []);
  /** A different document has a different history, and never the last one's. */
  const forget = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    setSteps({ past: 0, future: 0 });
  }, []);

  const adopt = useCallback((next: { path: string; file: ProjectFile; contentHash: string }) => {
    forget();
    pathRef.current = next.path;
    fileRef.current = next.file;
    hashRef.current = next.contentHash;
    dirtyRef.current = false;
    savesSinceSnapshotRef.current = 0;
    setPath(next.path);
    setFile(next.file);
    setSaveState('saved');
    setError(null);
  }, [forget]);

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
    // In a Writers Room the bridge puts this writer's name on whatever they
    // have just made (addendum 07 §6). Everywhere else there is no such method
    // and this line does nothing, which is the right answer for a script with
    // one author.
    const edited = mutate(current);
    const next = window.vcwriter.signWork?.(edited) ?? edited;
    // What the writer did is what they can take back (§6c). The clock's
    // once-a-minute tick is not one of those, and must not drop a step into
    // the middle of a paragraph or throw the redo stack away while they type.
    if (isWritersAct(current, next)) {
      pastRef.current = remember(pastRef.current, current, next, Date.now());
      futureRef.current = [];
      saySteps();
    }
    fileRef.current = next;
    dirtyRef.current = true;
    setFile(next);
    setSaveState('dirty');
  }, [saySteps]);

  /**
   * Back one step, and forward again (§6c).
   *
   * Every act in this program is a pure function of the document, so the step
   * before one **is** the document before it — there is no inverse to write
   * per act, and a module built tomorrow is undoable the day it is written.
   * Going back is marked dirty like any other change, because the document on
   * disk should be the one on the screen.
   */
  const step = useCallback(
    (from: 'past' | 'future') => {
      const current = fileRef.current;
      if (!current) return;
      if (from === 'past') {
        const last = pastRef.current[pastRef.current.length - 1];
        if (!last) return;
        pastRef.current = pastRef.current.slice(0, -1);
        futureRef.current = [...futureRef.current, current];
        fileRef.current = last.file;
        setFile(last.file);
      } else {
        const next = futureRef.current[futureRef.current.length - 1];
        if (!next) return;
        futureRef.current = futureRef.current.slice(0, -1);
        pastRef.current = [...pastRef.current, { file: current, at: Date.now() }];
        fileRef.current = next;
        setFile(next);
      }
      dirtyRef.current = true;
      setSaveState('dirty');
      saySteps();
    },
    [saySteps],
  );
  const undo = useCallback(() => step('past'), [step]);
  const redo = useCallback(() => step('future'), [step]);

  /**
   * Adopt a merged project after a sync. It is marked dirty so the next flush
   * writes the merge to disk — the file on this machine and the copy in the
   * cloud should not disagree once the writer has been told they agree.
   */
  const replace = useCallback(
    (next: ProjectFile) => {
      // A merge from the cloud is not this writer's act, and taking it back
      // would resurrect a document the other side has moved past — so the
      // history starts again here rather than offering to undo somebody else.
      forget();
      fileRef.current = next;
      dirtyRef.current = true;
      setFile(next);
      setSaveState('dirty');
    },
    [forget],
  );

  const adoptLoaded = useCallback(
    (loaded: { path: string; file: ProjectFile; contentHash: string }) => {
      adopt(loaded);
    },
    [adopt],
  );

  const closeProject = useCallback(() => {
    void flush().then(() => {
      forget();
      pathRef.current = null;
      fileRef.current = null;
      hashRef.current = undefined;
      setPath(null);
      setFile(null);
      setSaveState('idle');
    });
  }, [flush, forget]);

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
    undo,
    redo,
    canUndo: steps.past > 0,
    canRedo: steps.future > 0,
    replace,
    adoptLoaded,
    saveNow: flush,
    closeProject,
  };
};
