import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addLane,
  addMarker,
  beatsInStoryOrder,
  projectStats,
  storyLayout,
  threadLayout,
  timelineArcs,
  type BeatId,
  type LaneId,
  type ProjectFile,
  type StructuralUnitId,
  type SyncConflict,
} from '@vcwriter/domain';
import { useProject } from './use-project';
import { usePreference, useSplit } from './use-split';
import { createHub, createTransport, everyFew, type DocumentHub } from './link';
import { addBeatAfter, addSceneAfter } from './structure';
import {
  DEFAULT_ARRANGEMENT,
  movePane,
  normaliseArrangement,
  slotOf,
  type Arrangement,
  type PaneId,
  type SlotId,
} from './panes';
import { PaneFrame } from './components/PaneFrame';
import { Welcome } from './components/Welcome';
import { MasterTimeline } from './components/MasterTimeline';
import { MasterPanel } from './components/MasterPanel';
import { Inspector } from './components/Inspector';
import { TimelineViewer } from './components/TimelineViewer';
import { DEFAULT_SCRIPT_DISPLAY, type ScriptDisplay } from './components/StoryView';
import { LaneDialog } from './components/LaneDialog';
import { SceneDialog } from './components/SceneDialog';
import { ResearchWindow } from './components/ResearchWindow';
import { BeatDialog } from './components/BeatDialog';
import { PageBar, type View } from './components/PageBar';
import { PagePreview } from './components/PagePreview';
import { AccountPanel } from './components/AccountPanel';
import { CapturesPanel } from './components/CapturesPanel';
import { EditorPanel } from './components/EditorPanel';
import { ReadBackPanel } from './components/ReadBackPanel';
import { RecoveryPanel } from './components/RecoveryPanel';
import { Wordmark } from './components/Brand';
import { Preferences } from './components/Preferences';
import { applyScheme, DEFAULT_SCHEME, type SchemeId } from './themes';
import type { AccountStatus } from '../preload/index';

const SAVE_LABEL: Record<string, string> = {
  idle: '',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

export default function App() {
  const project = useProject();
  const [view, setView] = useState<View>('write');
  const [selectedBeatId, setSelectedBeatId] = useState<BeatId | null>(null);
  const [focusTitleBeatId, setFocusTitleBeatId] = useState<BeatId | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [includeBeatTitles, setIncludeBeatTitles] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountStatus>({ configured: false, signedIn: false, email: null });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [dictationShortcut, setDictationShortcut] = useState<string | null>(null);
  // Conflicts persist until the writer has dealt with them. A sync that
  // overwrote a scene is not resolved by the writer clicking past a status
  // line, and the losing versions live here until they say otherwise.
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  // Per-machine layout preferences (addendum 02 §3), not project data.
  const [inspectorOpen, setInspectorOpen] = usePreference('inspector', true);
  const [scheme, setScheme] = usePreference<SchemeId>('scheme', DEFAULT_SCHEME);
  const [paper, setPaper] = usePreference('paper', true);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  useEffect(() => applyScheme(scheme), [scheme]);
  const [timelineOpen, setTimelineOpen] = usePreference('timeline', true);
  const [pixelsPerPage, setPixelsPerPage] = usePreference('zoom', 160);
  // The Timeline & Viewer screen: its own zoom, and whose thread is isolated.
  const [viewerZoom, setViewerZoom] = usePreference('viewerZoom', 180);
  const [isolatedCharacter, setIsolatedCharacter] = useState('');
  // What the Script shows besides the manuscript (addendum 02 §6).
  const [scriptDisplay, setScriptDisplay] = usePreference<ScriptDisplay>('scriptDisplay', DEFAULT_SCRIPT_DISPLAY);
  const [openLaneId, setOpenLaneId] = useState<LaneId | null>(null);
  const [openUnitId, setOpenUnitId] = useState<StructuralUnitId | null>(null);
  const [openBeatId, setOpenBeatId] = useState<BeatId | null>(null);
  const [researchOpen, setResearchOpen] = useState(false);
  // Where the four sections sit, and which of them are in windows of their
  // own right now (addendum 02 §8).
  const [storedArrangement, setArrangement] = usePreference<Arrangement>('panes', DEFAULT_ARRANGEMENT);
  const arrangement = useMemo(() => normaliseArrangement(storedArrangement), [storedArrangement]);
  const [detached, setDetached] = useState<string[]>([]);
  const [dragging, setDragging] = useState<PaneId | null>(null);
  // The Edit-page proportions (addendum 02 §3): a quarter for the script,
  // and of the rest, just under half for the viewport above the lanes.
  const columns = useSplit({ key: 'leftWidth', initial: 0.25, min: 300, reserve: 640, axis: 'x' });
  const rows = useSplit({ key: 'viewportHeight', initial: 0.48, min: 160, reserve: 200, axis: 'y' });

  const file = project.file;
  const beats = useMemo(() => (file ? beatsInStoryOrder(file) : []), [file]);
  const selectedBeat = beats.find((beat) => beat.id === selectedBeatId) ?? beats[0] ?? null;
  const stats = file ? projectStats(file) : null;
  // The story's geometry, paginated once per document rather than once per
  // pane: the timeline, the viewport and the script all draw from these.
  const layout = useMemo(() => (file ? storyLayout(file) : null), [file]);
  const arcs = useMemo(() => (file ? timelineArcs(file) : null), [file]);
  const threads = useMemo(
    () => (file && layout && arcs ? threadLayout(file, { layout, arcs }) : null),
    [file, layout, arcs],
  );
  const pages = layout ? Math.ceil(layout.totalPages) : 0;

  const clearTitleFocus = useCallback(() => setFocusTitleBeatId(null), []);

  // ------------------------------------------------ the same project, elsewhere

  /**
   * The workspace is the one window that holds the document (addendum 02 §8).
   * Every section that has been moved to a window of its own edits it from
   * there over the link: it proposes, this window decides and publishes, and
   * the autosave below stays the only thing that writes to disk.
   */
  const hub = useRef<DocumentHub | null>(null);
  const latest = useRef<{ file: ProjectFile | null; path: string | null }>({ file: null, path: null });
  latest.current = { file: project.file, path: project.path };

  useEffect(() => {
    const made = createHub({
      transport: createTransport(),
      // A held-down key in another window is one document a few times a
      // second, not one per character.
      schedule: everyFew(60),
      onProposal: (next) => project.replace(next),
      current: () => latest.current,
    });
    hub.current = made;
    return () => {
      hub.current = null;
      made.stop();
    };
    // The project's `replace` is stable; the hub must outlive every document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (project.file) hub.current?.publish(project.file, project.path);
  }, [project.file, project.path]);

  // Which sections are out of the workspace, so it can hold their places.
  useEffect(() => {
    const panes = window.vcwriter?.panes;
    if (!panes) return;
    void panes.list().then((result) => {
      if (result.ok && result.data) setDetached(result.data);
    });
    return panes.onChanged(setDetached);
  }, []);

  const openPane = useCallback((pane: string) => {
    void window.vcwriter?.panes?.open(pane);
  }, []);
  const closePane = useCallback((pane: string) => {
    void window.vcwriter?.panes?.close(pane);
  }, []);

  // Keyboard: focus mode, the panes, and stepping through beats (addendum 02 §11).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const chord = (event.metaKey || event.ctrlKey) && event.shiftKey;
      if (chord && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFocusMode((current) => !current);
      } else if (chord && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setInspectorOpen(!inspectorOpen);
      } else if (chord && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        setTimelineOpen(!timelineOpen);
      } else if (event.altKey && (event.key === 'PageUp' || event.key === 'PageDown')) {
        event.preventDefault();
        const position = beats.findIndex((beat) => beat.id === selectedBeat?.id);
        const next = beats[position + (event.key === 'PageDown' ? 1 : -1)];
        if (next) setSelectedBeatId(next.id);
      } else if (event.key === 'Escape') {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [beats, selectedBeat, inspectorOpen, timelineOpen, setInspectorOpen, setTimelineOpen]);

  useEffect(() => {
    void window.vcwriter.accountStatus().then((result) => {
      if (result.ok && result.data) setAccount(result.data);
    });
    void window.vcwriter.appInfo().then((result) => {
      if (!result.ok || !result.data) return;
      setDictationShortcut(
        result.data.platform === 'darwin' ? 'press Fn twice' : result.data.platform === 'win32' ? 'Windows key + H' : null,
      );
    });
  }, []);

  // ------------------------------------------------------- adding structure
  // Each adds after the selection and selects what it made (§4 of the
  // addendum), computed from the current document so the new id is known.

  const addSceneAfterSelection = useCallback(() => {
    if (!file) return;
    const made = addSceneAfter(file, selectedBeat);
    if (!made) return;
    project.update(() => made.file);
    setSelectedBeatId(made.beatId);
    setFocusTitleBeatId(made.beatId);
  }, [file, selectedBeat, project]);

  const addBeatAfterSelection = useCallback(() => {
    if (!file) return;
    const made = addBeatAfter(file, selectedBeat);
    if (!made) return;
    project.update(() => made.file);
    setSelectedBeatId(made.beatId);
    setFocusTitleBeatId(made.beatId);
  }, [file, selectedBeat, project]);

  const addLaneToProject = useCallback(() => {
    project.update((current) => addLane(current, { name: 'New lane' }).file);
  }, [project]);

  const addActAtSelection = useCallback(() => {
    if (!selectedBeat) return;
    project.update((current) => addMarker(current, { unitId: selectedBeat.unitId, title: 'New act' }).file);
  }, [selectedBeat, project]);

  // ------------------------------------------------------------- sync, export

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
  const focused = focusMode && writing;
  const showBottom = writing && timelineOpen && !focused;
  const showRight = writing && inspectorOpen && !focused;
  const away = new Set(detached);
  const display = { ...DEFAULT_SCRIPT_DISPLAY, ...scriptDisplay };

  /** Each section, drawn once, ready to be placed wherever it has been put. */
  const sections: Record<PaneId, React.ReactNode> = {
    script: (
      <MasterPanel
        file={file}
        layout={layout ?? undefined}
        selectedBeatId={selectedBeat?.id ?? null}
        onSelectBeat={setSelectedBeatId}
        onUpdate={project.update}
        focusMode={false}
        focusTitleBeatId={focusTitleBeatId}
        onTitleFocused={clearTitleFocus}
        dictationShortcut={dictationShortcut}
        display={display}
        onDisplay={setScriptDisplay}
        onOpenUnit={setOpenUnitId}
        onOpenBeat={setOpenBeatId}
        onOpenResearch={() => (away.has('research') ? openPane('research') : setResearchOpen(true))}
      />
    ),
    viewer: (
      <TimelineViewer
        file={file}
        threads={threads ?? undefined}
        selectedBeatId={selectedBeat?.id ?? null}
        onSelectBeat={setSelectedBeatId}
        onUpdate={project.update}
        zoom={viewerZoom}
        onZoom={setViewerZoom}
        isolated={isolatedCharacter}
        onIsolate={setIsolatedCharacter}
      />
    ),
    lanes: (
      <MasterTimeline
        file={file}
        layout={layout ?? undefined}
        arcs={arcs ?? undefined}
        threads={threads ?? undefined}
        selectedBeatId={selectedBeat?.id ?? null}
        onSelectBeat={setSelectedBeatId}
        onUpdate={project.update}
        pixelsPerPage={pixelsPerPage}
        onZoom={setPixelsPerPage}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen(!inspectorOpen)}
        onAddScene={addSceneAfterSelection}
        onAddBeat={addBeatAfterSelection}
        onAddLane={addLaneToProject}
        onAddAct={addActAtSelection}
        onOpenLane={setOpenLaneId}
        onOpenUnit={setOpenUnitId}
        onOpenBeat={setOpenBeatId}
      />
    ),
    inspector: <Inspector file={file} selectedBeatId={selectedBeat?.id ?? null} onUpdate={project.update} />,
  };

  /**
   * A section in its place, with the strip that lets it be moved out of it.
   * Dropping one section on another swaps the two, which is the only move
   * there is: four sections, four places.
   */
  const inSlot = (slot: SlotId) => {
    const pane = arrangement[slot];
    return (
      <PaneFrame
        pane={pane}
        arrangement={arrangement}
        onMove={(moved, to) => setArrangement(movePane(arrangement, moved, to))}
        detached={away.has(pane)}
        onDetach={() => openPane(pane)}
        onAttach={() => closePane(pane)}
        dragging={dragging}
        onDragStart={setDragging}
        onDragEnd={() => setDragging(null)}
        onDrop={(onto) => {
          if (dragging) setArrangement(movePane(arrangement, dragging, slotOf(arrangement, onto)));
          setDragging(null);
        }}
      >
        {sections[pane]}
      </PaneFrame>
    );
  };

  return (
    <div
      className={[
        'workspace',
        focused ? 'focus-mode' : '',
        paper ? 'script-paper' : '',
        showBottom ? 'with-timeline' : '',
        showRight ? 'with-inspector' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--left-width': `${columns.size}px`, '--viewport-height': `${rows.size}px` } as React.CSSProperties}
    >
      <header className="titlebar">
        <div className="titlebar-left">
          <Wordmark compact />
          <strong className="project-title" title={`${file.project.title} · ${file.project.format.replace(/_/g, ' ')}`}>
            {file.project.title}
          </strong>
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
          <button
            type="button"
            className="ghost"
            title="Preferences"
            aria-label="Preferences"
            aria-haspopup="dialog"
            onClick={() => setPreferencesOpen(true)}
          >
            ⚙
          </button>
        </div>
      </header>

      <Preferences
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        scheme={scheme}
        onScheme={setScheme}
        paper={paper}
        onPaper={setPaper}
      />

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
          {focused ? (
            // Focus mode is the page and nothing else: no places, no strips.
            <MasterPanel
              file={file}
              layout={layout ?? undefined}
              selectedBeatId={selectedBeat?.id ?? null}
              onSelectBeat={setSelectedBeatId}
              onUpdate={project.update}
              focusMode
              focusTitleBeatId={focusTitleBeatId}
              onTitleFocused={clearTitleFocus}
              dictationShortcut={dictationShortcut}
              display={display}
              onDisplay={setScriptDisplay}
            />
          ) : (
            <>
              {/* The tall column down the side. Which section is in it is the
                  writer's arrangement, not ours (addendum 02 §8). */}
              <div className="slot slot-left">{inSlot('left')}</div>
              <div
                className="divider vertical"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize the script column"
                {...columns.dividerProps}
              />
              <div className="stage">
                <div className="stage-top">
                  <div className="slot slot-top">{inSlot('top')}</div>
                  {showRight ? <div className="slot slot-right">{inSlot('right')}</div> : null}
                </div>
                {showBottom ? (
                  <>
                    <div
                      className="divider"
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Resize the viewport"
                      {...rows.dividerProps}
                    />
                    <div className="slot slot-bottom">{inSlot('bottom')}</div>
                  </>
                ) : null}
              </div>
            </>
          )}
          <LaneDialog file={file} laneId={openLaneId} onClose={() => setOpenLaneId(null)} onUpdate={project.update} />
          <SceneDialog
            file={file}
            unitId={openUnitId}
            onClose={() => setOpenUnitId(null)}
            onUpdate={project.update}
            onOpenBeat={setOpenBeatId}
            onSelectBeat={setSelectedBeatId}
          />
          <BeatDialog
            file={file}
            beatId={openBeatId}
            onClose={() => setOpenBeatId(null)}
            onUpdate={project.update}
            onSelect={setSelectedBeatId}
            onPopOut={(beatId) => {
              setOpenBeatId(null);
              openPane(`beat:${beatId}`);
            }}
          />
          <ResearchWindow
            file={file}
            open={researchOpen && !away.has('research')}
            currentBeatId={selectedBeat?.id ?? null}
            onClose={() => setResearchOpen(false)}
            onUpdate={project.update}
            onPopOut={() => {
              setResearchOpen(false);
              openPane('research');
            }}
          />
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
            <ReadBackPanel file={file} currentUnitId={selectedBeat?.unitId ?? null} onUpdate={project.update} />
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

      {focused ? null : <PageBar view={view} onSelect={setView} counts={{ recovery: conflicts.length }} />}
    </div>
  );
}
