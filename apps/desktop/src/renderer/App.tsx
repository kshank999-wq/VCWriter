import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  beatsInStoryOrder,
  pageCount,
  projectStats,
  type BeatId,
  type ProjectFile,
  type SyncConflict,
} from '@vcwriter/domain';
import { useProject } from './use-project';
import { Welcome } from './components/Welcome';
import { StructureBoard } from './components/StructureBoard';
import { BeatEditor } from './components/BeatEditor';
import { PagePreview } from './components/PagePreview';
import { ResearchPanel } from './components/ResearchPanel';
import { SetupsPanel } from './components/SetupsPanel';
import { AccountPanel } from './components/AccountPanel';
import { CapturesPanel } from './components/CapturesPanel';
import { EditorPanel } from './components/EditorPanel';
import { ReadBackPanel } from './components/ReadBackPanel';
import { RecoveryPanel } from './components/RecoveryPanel';
import type { AccountStatus } from '../preload/index';

const SAVE_LABEL: Record<string, string> = {
  idle: '',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

type View = 'write' | 'preview' | 'editor' | 'readback' | 'research' | 'setups' | 'captures' | 'recovery';

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' },
  { id: 'editor', label: 'Editors' },
  { id: 'readback', label: 'Read back' },
  { id: 'research', label: 'Research' },
  { id: 'setups', label: 'Setups & payoffs' },
  { id: 'captures', label: 'Captures' },
  { id: 'recovery', label: 'Recovery' },
];

export default function App() {
  const project = useProject();
  const [view, setView] = useState<View>('write');
  const [selectedBeatId, setSelectedBeatId] = useState<BeatId | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [includeBeatTitles, setIncludeBeatTitles] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountStatus>({ configured: false, signedIn: false, email: null });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  // Conflicts persist until the writer has dealt with them. A sync that
  // overwrote a scene is not resolved by the writer clicking past a status
  // line, and the losing versions live here until they say otherwise.
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  const file = project.file;
  const beats = useMemo(() => (file ? beatsInStoryOrder(file) : []), [file]);
  const selectedBeat = beats.find((beat) => beat.id === selectedBeatId) ?? beats[0] ?? null;
  const stats = file ? projectStats(file) : null;
  const pages = useMemo(() => (file ? pageCount(file) : 0), [file]);

  // Focus mode hides everything but the page being written (§6).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFocusMode((current) => !current);
      }
      if (event.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    void window.vcwriter.accountStatus().then((result) => {
      if (result.ok && result.data) setAccount(result.data);
    });
  }, []);

  const sync = useCallback(async () => {
    if (!file) return;
    setSyncing(true);
    setSyncMessage(null);
    // Flush first so the merge sees what is actually on disk.
    await project.saveNow();

    const result = await window.vcwriter.syncProject({
      file,
      ...(project.path ? { path: project.path } : {}),
    });
    setSyncing(false);
    if (!result.ok || !result.data) {
      setSyncMessage(result.error ?? 'Sync failed');
      return;
    }

    const { merged, conflicts: fresh, summary } = result.data;
    project.replace(merged);

    const parts: string[] = [];
    if (summary.pulled > 0) parts.push(`${summary.pulled} in`);
    if (summary.pushed > 0) parts.push(`${summary.pushed} out`);
    if (summary.deletedLocally > 0) parts.push(`${summary.deletedLocally} removed`);
    if (summary.revivedByEdit > 0) parts.push(`${summary.revivedByEdit} kept after an edit elsewhere`);
    if (fresh.length > 0) {
      // Name what was overwritten rather than reporting a number, and say
      // where the overwritten version went: it still exists, and telling
      // someone their work was replaced without telling them how to get it
      // back is the half of this that would actually hurt.
      setConflicts((current) => [
        ...fresh,
        ...current.filter((existing) => !fresh.some((candidate) => candidate.id === existing.id)),
      ]);
      parts.push(
        `${fresh.length} ${fresh.length === 1 ? 'conflict' : 'conflicts'} — kept the newer edit of ${fresh
          .slice(0, 3)
          .map((conflict) => conflict.label)
          .join(', ')}. The other versions are under Recovery.`,
      );
    }
    setSyncMessage(parts.length === 0 ? 'Already up to date' : parts.join(' · '));
  }, [file, project]);

  const exportPdf = useCallback(async () => {
    if (!file) return;
    setExporting(true);
    setExportMessage(null);
    // Flush first: the export reads the project it is handed, and a writer who
    // just typed a line expects it in the PDF.
    await project.saveNow();
    const result = await window.vcwriter.exportPdf({ file, options: { includeBeatTitles } });
    setExporting(false);
    if (!result.ok) {
      setExportMessage(result.error ?? 'The PDF could not be created');
      return;
    }
    setExportMessage(result.data ? `Exported ${result.data.pageCount} pages to ${result.data.path}` : null);
  }, [file, includeBeatTitles, project]);

  const print = useCallback(async () => {
    if (!file) return;
    setExporting(true);
    setExportMessage(null);
    await project.saveNow();
    const result = await window.vcwriter.print({ file, options: { includeBeatTitles } });
    setExporting(false);
    if (!result.ok) setExportMessage(result.error ?? 'The document could not be printed');
  }, [file, includeBeatTitles, project]);

  if (!file) {
    return (
      <Welcome
        onCreate={(input) => void project.createProject(input)}
        onOpen={() => void project.openProject()}
        onOpenPath={(path) => void project.openProjectAtPath(path)}
        error={project.error}
      />
    );
  }

  const writing = view === 'write';

  return (
    <div className={focusMode && writing ? 'workspace focus-mode' : 'workspace'}>
      <header className="titlebar">
        <div className="titlebar-left">
          <strong>{file.project.title}</strong>
          <span className="muted"> · {file.project.format.replace(/_/g, ' ')}</span>
          <nav className="views" aria-label="Workspace">
            {VIEWS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={view === option.id ? 'view selected' : 'view'}
                aria-current={view === option.id}
                onClick={() => setView(option.id)}
              >
                {option.label}
                {option.id === 'research' && stats && stats.unusedResearchCount > 0
                  ? ` (${stats.unusedResearchCount})`
                  : ''}
                {option.id === 'setups' && stats && stats.unresolvedSetupCount > 0
                  ? ` (${stats.unresolvedSetupCount})`
                  : ''}
                {option.id === 'recovery' && conflicts.length > 0 ? ` (${conflicts.length})` : ''}
              </button>
            ))}
          </nav>
        </div>
        <div className="titlebar-right">
          {stats ? (
            <span className="muted">
              {pages} {pages === 1 ? 'page' : 'pages'} · {stats.beatCount} beats · {stats.wordCount} words
            </span>
          ) : null}
          {writing ? (
            <button
              type="button"
              className={focusMode ? 'ghost active' : 'ghost'}
              title="Focus mode (Ctrl/Cmd+Shift+F)"
              aria-pressed={focusMode}
              onClick={() => setFocusMode(!focusMode)}
            >
              Focus
            </button>
          ) : null}
          {account.configured ? (
            <button
              type="button"
              className="ghost"
              disabled={syncing}
              title={account.signedIn ? 'Sync this project' : 'Sign in to sync'}
              onClick={() => (account.signedIn ? void sync() : setView('captures'))}
            >
              {syncing ? 'Syncing…' : account.signedIn ? 'Sync' : 'Sign in'}
            </button>
          ) : null}
          <span className={`save-state ${project.saveState}`}>{SAVE_LABEL[project.saveState]}</span>
          <button type="button" className="ghost" onClick={() => void project.saveNow()}>
            Save now
          </button>
          <button type="button" className="ghost" onClick={project.closeProject}>
            Close
          </button>
        </div>
      </header>

      {project.error ? (
        <p className="error banner" role="alert">
          {project.error}
        </p>
      ) : null}

      {syncMessage ? (
        <p className="notice banner" role="status">
          {syncMessage}
          <button type="button" className="ghost" onClick={() => setSyncMessage(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      {writing ? (
        <div className="workspace-body">
          {focusMode ? null : (
            <StructureBoard
              file={file}
              selectedBeatId={selectedBeat?.id ?? null}
              onSelectBeat={setSelectedBeatId}
              onUpdate={project.update}
            />
          )}
          <main>
            {selectedBeat ? (
              <BeatEditor file={file} beat={selectedBeat} focusMode={focusMode} onUpdate={project.update} />
            ) : (
              <p className="muted empty-state">Add a beat to a scene or chapter to start writing.</p>
            )}
          </main>
        </div>
      ) : (
        <main className="full">
          {view === 'preview' ? (
            <PagePreview
              file={file}
              unitId={selectedBeat?.unitId ?? null}
              includeBeatTitles={includeBeatTitles}
              onToggleBeatTitles={setIncludeBeatTitles}
              onExportPdf={() => void exportPdf()}
              onPrint={() => void print()}
              busy={exporting}
              message={exportMessage}
            />
          ) : view === 'editor' ? (
            <EditorPanel
              file={file}
              currentUnitId={selectedBeat?.unitId ?? null}
              signedIn={account.signedIn}
              onUpdate={project.update}
            />
          ) : view === 'readback' ? (
            <ReadBackPanel
              file={file}
              currentUnitId={selectedBeat?.unitId ?? null}
              onUpdate={project.update}
            />
          ) : view === 'research' ? (
            <ResearchPanel file={file} currentBeatId={selectedBeat?.id ?? null} onUpdate={project.update} />
          ) : view === 'setups' ? (
            <SetupsPanel file={file} currentBeatId={selectedBeat?.id ?? null} onUpdate={project.update} />
          ) : view === 'recovery' ? (
            project.path ? (
              <RecoveryPanel
                file={file}
                path={project.path}
                conflicts={conflicts}
                onRestoreVersion={(next: ProjectFile) => project.replace(next)}
                onRestoreSnapshot={project.adoptLoaded}
                onConflictResolved={(id: string) =>
                  setConflicts((current) => current.filter((conflict) => conflict.id !== id))
                }
              />
            ) : (
              <p className="muted empty-state">Save the project to a file to keep recovery points.</p>
            )
          ) : account.signedIn ? (
            <CapturesPanel file={file} onUpdate={project.update} />
          ) : (
            <AccountPanel
              status={account}
              onSignedIn={setAccount}
              onSignOut={() => {
                void window.vcwriter.signOut();
                setAccount({ ...account, signedIn: false, email: null });
              }}
            />
          )}
        </main>
      )}
    </div>
  );
}
