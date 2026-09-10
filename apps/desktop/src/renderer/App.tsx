import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addLane,
  addMarker,
  defaultMarkerKind,
  beatsForUnit,
  beatsInStoryOrder,
  projectStats,
  setParagraphStyle,
  storyLayout,
  threadLayout,
  timelineArcs,
  type BeatId,
  type LaneId,
  type ProjectFile,
  type Episode,
  type ProjectFormat,
  type ResearchView,
  type StoryMarkerId,
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
  paneNamesFor,
  slotOf,
  type Arrangement,
  type PaneId,
  type SlotId,
} from './panes';
import { PaneFrame } from './components/PaneFrame';
import { TitleBar } from './components/TitleBar';
import { Welcome } from './components/Welcome';
import { MasterTimeline, DEFAULT_BEATS_PER_COLUMN } from './components/MasterTimeline';
import { MasterPanel } from './components/MasterPanel';
import { Inspector } from './components/Inspector';
import { TimelineViewer } from './components/TimelineViewer';
import { DEFAULT_SCRIPT_DISPLAY, type ScriptDisplay, type ScriptLayout } from './components/StoryView';
import { LaneDialog } from './components/LaneDialog';
import { SceneDialog } from './components/SceneDialog';
import { ResearchWindow } from './components/ResearchWindow';
import { BeatDialog } from './components/BeatDialog';
import { MarkerDialog } from './components/MarkerDialog';
import { PageBar, type View } from './components/PageBar';
import { PagePreview } from './components/PagePreview';
import { DEFAULT_PAGE_STYLE, type PageStyle } from './components/ScriptOptions';
import { DEFAULT_PRINT_SETUP, PageSetup, type PrintSetup } from './components/PageSetup';
import { TitlePageDialog } from './components/TitlePageDialog';
import { Reports, type ReportTab } from './components/Reports';
import { EpisodeRail } from './components/EpisodeRail';
import { ImportDialog } from './components/ImportDialog';
import { NewEpisodeDialog } from './components/NewEpisodeDialog';
import { useWritingClock } from './use-writing-clock';
import { FindPanel } from './components/FindPanel';
import { MenuBar } from './components/MenuBar';
import { menusFor, type CommandId } from './menus';
import { AccountPanel } from './components/AccountPanel';
import { CapturesPanel } from './components/CapturesPanel';
import { EditorPanel } from './components/EditorPanel';
import { ReadBackPanel } from './components/ReadBackPanel';
import { RecoveryPanel } from './components/RecoveryPanel';
import { Preferences } from './components/Preferences';
import { applyScheme, DEFAULT_SCHEME, type SchemeId } from './themes';
import type { AccountStatus } from '../preload/index';

export default function App() {
  const project = useProject();
  const [view, setView] = useState<View>('write');
  const [selectedBeatId, setSelectedBeatId] = useState<BeatId | null>(null);
  /**
   * What was last clicked into on the lanes: the scene a new beat goes in,
   * and the lane a new scene lands in. Held separately from the selected beat
   * because a scene with nothing in it is exactly the one you click before
   * adding the first beat, and it has no beat to be remembered by.
   */
  const [selectedUnitId, setSelectedUnitId] = useState<StructuralUnitId | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<LaneId | null>(null);
  const [focusTitleBeatId, setFocusTitleBeatId] = useState<BeatId | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  // What a printing carries, in one place, read by the Preview, the print
  // and the export alike (§13).
  const [printSetup, setPrintSetup] = usePreference<PrintSetup>('printSetup', DEFAULT_PRINT_SETUP);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState<ReportTab | null>(null);
  const [episodeRailOpen, setEpisodeRailOpen] = useState(false);
  const [newEpisodeOpen, setNewEpisodeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<'daily' | 'final' | 'grid'>('daily');
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
  // How many beats stack in a scene before the next column starts (§4).
  const [beatsPerColumn, setBeatsPerColumn] = usePreference('beatsPerColumn', DEFAULT_BEATS_PER_COLUMN);
  // The Timeline & Viewer screen: its own zoom, and whose thread is isolated.
  const [viewerZoom, setViewerZoom] = usePreference('viewerZoom', 180);
  const [isolatedCharacter, setIsolatedCharacter] = useState('');
  // What the Script shows besides the manuscript (addendum 02 §6).
  const [scriptDisplay, setScriptDisplay] = usePreference<ScriptDisplay>('scriptDisplay', DEFAULT_SCRIPT_DISPLAY);
  // One continuous page, or the script dealt out onto sheets (§6.1).
  const [scriptLayout, setScriptLayout] = usePreference<ScriptLayout>('scriptLayout', 'flow');
  // Zero is 'fit the width there is' — a page is 8½ inches and the
  // Script's column is not (§6.1).
  const [scriptZoom, setScriptZoom] = usePreference('scriptZoom', 0);
  // Paper, ink and face: the writer's, per machine, never project data (§6.3).
  const [pageStyle, setPageStyle] = usePreference<PageStyle>('pageStyle', DEFAULT_PAGE_STYLE);
  const [openLaneId, setOpenLaneId] = useState<LaneId | null>(null);
  const [openUnitId, setOpenUnitId] = useState<StructuralUnitId | null>(null);
  const [openBeatId, setOpenBeatId] = useState<BeatId | null>(null);
  const [openMarkerId, setOpenMarkerId] = useState<StoryMarkerId | null>(null);
  const [researchOpen, setResearchOpen] = useState(false);
  /**
   * File → New project shows the project screen even with one already open:
   * the format is chosen there, beside the title and a word on what each one
   * does, rather than guessed from a menu item's noun.
   */
  const [startingNew, setStartingNew] = useState(false);
  /** The title page's own screen: a page of the document, off the File menu. */
  const [titlePageOpen, setTitlePageOpen] = useState(false);
  /** Whose page it is: an episode's, or — null — the project's own. */
  const [titlePageEpisode, setTitlePageEpisode] = useState<Episode | null>(null);
  /** Set when something sent the writer to research to look at one thing. */
  const [researchView, setResearchView] = useState<ResearchView | undefined>(undefined);
  // Where the four sections sit, and which of them are in windows of their
  // own right now (addendum 02 §8).
  const [storedArrangement, setArrangement] = usePreference<Arrangement>('panes', DEFAULT_ARRANGEMENT);
  const arrangement = useMemo(() => normaliseArrangement(storedArrangement), [storedArrangement]);
  const [detached, setDetached] = useState<string[]>([]);
  const [dragging, setDragging] = useState<PaneId | null>(null);
  // Find and replace, opened from the Editor menu (§13).
  const [finding, setFinding] = useState<'off' | 'find' | 'replace'>('off');
  const [findStep, setFindStep] = useState(0);
  const [platform, setPlatform] = useState('');
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

  // A preference stored before an option existed has no answer for it, so
  // the defaults fill in underneath rather than leaving it undefined.
  const setup = useMemo(() => ({ ...DEFAULT_PRINT_SETUP, ...printSetup }), [printSetup]);

  const printOptions = useMemo(
    () => ({
      includeBeatTitles: setup.includeBeatTitles,
      includeChapterPages: setup.includeChapterPages,
      includeTitlePage: setup.includeTitlePage,
      includeSceneHeadings: setup.includeSceneHeadings,
      includeSceneNumbers: setup.includeSceneNumbers,
      includePageNumbers: setup.includePageNumbers,
      includeSceneSummary: setup.includeSceneSummary,
      includeSceneLinks: setup.includeSceneLinks,
      includePrintedAt: setup.includePrintedAt,
      ...(setup.watermark ? { watermark: setup.watermark } : {}),
    }),
    [setup],
  );

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
      setPlatform(result.data.platform);
      setDictationShortcut(
        result.data.platform === 'darwin' ? 'press Fn twice' : result.data.platform === 'win32' ? 'Windows key + H' : null,
      );
    });
  }, []);

  // ------------------------------------------------------- adding structure
  // Each adds after the selection and selects what it made (§4 of the
  // addendum), computed from the current document so the new id is known.

  const selection = useMemo(
    () => ({ laneId: selectedLaneId, unitId: selectedUnitId, beat: selectedBeat }),
    [selectedLaneId, selectedUnitId, selectedBeat],
  );

  const addSceneAfterSelection = useCallback(() => {
    if (!file) return;
    const made = addSceneAfter(file, selection);
    if (!made) return;
    project.update(() => made.file);
    setSelectedBeatId(made.beatId);
    setSelectedUnitId(made.unitId);
    setFocusTitleBeatId(made.beatId);
  }, [file, selection, project]);

  const addBeatAfterSelection = useCallback(() => {
    if (!file) return;
    const made = addBeatAfter(file, selection);
    if (!made) return;
    project.update(() => made.file);
    setSelectedBeatId(made.beatId);
    setSelectedUnitId(made.unitId);
    setFocusTitleBeatId(made.beatId);
  }, [file, selection, project]);

  const addLaneToProject = useCallback(() => {
    project.update((current) => addLane(current, { name: 'New lane' }).file);
  }, [project]);

  const addActAtSelection = useCallback(() => {
    if (!selectedBeat) return;
    project.update((current) => addMarker(current, {
            unitId: selectedBeat.unitId,
            title: '',
            kind: defaultMarkerKind(current.project.format),
          }).file);
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
    const result = await window.vcwriter.exportPdf({ file, options: printOptions });
    setExporting(false);
    if (!result.ok) {
      setExportMessage(result.error ?? 'The PDF could not be created');
      return;
    }
    setExportMessage(result.data ? `Exported ${result.data.pageCount} pages to ${result.data.path}` : null);
  }, [file, printOptions, project]);

  const print = useCallback(async () => {
    if (!file) return;
    setExporting(true);
    setExportMessage(null);
    await project.saveNow();
    const result = await window.vcwriter.print({ file, options: printOptions });
    setExporting(false);
    if (!result.ok) setExportMessage(result.error ?? 'The document could not be printed');
  }, [file, printOptions, project]);

  // ------------------------------------------------------------ the menus

  // The writing log's clock: it runs whenever a project is open, and counts
  // the time actually spent typing rather than the time the app is up (§15).
  useWritingClock(file !== null, project.update);

  /**
   * What every menu item does (addendum 02 §13). The menus themselves know
   * only a command's name and label; this is the one place that knows what
   * is open and can act on it, which is why it lives here and not there.
   */
  const runCommand = useCallback(
    (command: CommandId) => {
      switch (command) {
        case 'file.new':
          // The project screen, not six menu items. What kind of thing this
          // is going to be is the first decision of the work, and it is made
          // where the title and the author are, beside what each format does.
          return setStartingNew(true);
        case 'file.open':
          return void project.openProject();
        case 'file.import':
          return setImportOpen(true);
        case 'file.save':
          return void project.saveNow();
        case 'file.saveAs':
          // The desktop writes through the same channel a save does; the
          // browser preview hands back a file to keep.
          return void project.saveNow();
        case 'file.titlePage':
          setTitlePageEpisode(null);
          return setTitlePageOpen(true);
        case 'file.pageSetup':
          return setPageSetupOpen(true);
        case 'file.print':
          return void print();
        case 'file.exportPdf':
          return void exportPdf();
        case 'file.preferences':
          return setPreferencesOpen(true);
        case 'file.close':
          return project.closeProject();

        case 'editor.find':
          return setFinding('find');
        case 'editor.replace':
          return setFinding('replace');
        case 'editor.findNext':
          // The panel does the stepping; this only nudges it, so the
          // keystroke works with the cursor anywhere.
          setFinding((current) => (current === 'off' ? 'find' : current));
          return setFindStep((step) => step + 1);
        case 'editor.reformat':
          return setOpenBeatId(selectedBeat?.id ?? null);
        case 'editor.daily':
          setEditorTab('daily');
          return setView('editor');
        case 'editor.final':
          setEditorTab('final');
          return setView('editor');
        case 'editor.storyGrid':
          setEditorTab('grid');
          return setView('editor');
        case 'editor.readBack':
          return setView('readback');

        case 'file.new.episode':
          // Only a series has episodes; elsewhere the item does nothing but
          // say so, which is better than a menu that lies about what it does.
          if (file?.project.format !== 'series') return undefined;
          return setNewEpisodeOpen(true);
        case 'window.episodes':
          return setEpisodeRailOpen((current) => !current);

        case 'reports.writing':
          return setReportOpen('writing');
        case 'reports.story':
          return setReportOpen('story');

        case 'window.script':
        case 'window.viewer':
        case 'window.lanes':
        case 'window.inspector':
        case 'window.research': {
          // Ticked means it is out; choosing it again brings it back.
          const pane = command.slice('window.'.length);
          return detached.includes(pane) ? closePane(pane) : openPane(pane);
        }
        case 'window.beat':
          return selectedBeat ? openPane(`beat:${selectedBeat.id}`) : undefined;
        case 'window.bringAllBack':
          return detached.forEach((pane) => closePane(pane));
        case 'window.focus':
          return setFocusMode((current) => !current);
        case 'window.preferences':
          return setPreferencesOpen(true);

        case 'help.spec':
        case 'help.about':
          return setPreferencesOpen(true);
      }
    },
    [project, print, exportPdf, selectedBeat, detached, openPane, closePane],
  );

  /** The items with a tick beside them right now. */
  const checkedCommands = useMemo(() => {
    const on = new Set<CommandId>();
    for (const pane of detached) {
      if (pane.startsWith('beat:')) continue;
      on.add(`window.${pane}` as CommandId);
    }
    if (focusMode) on.add('window.focus');
    if (episodeRailOpen) on.add('window.episodes');
    return on;
  }, [detached, focusMode, episodeRailOpen]);

  /**
   * The menus for what is open: a series has New episode, nothing else does.
   * One list, used by the bar in the window and by the native menu, so the
   * two can never say different things.
   */
  const menus = useMemo(() => menusFor(file?.project.format ?? null), [file?.project.format]);

  /**
   * The native menu, rebuilt whenever a tick changes. On a Mac this is the
   * menu; everywhere else it is absent and the bar in the window is.
   */
  useEffect(() => {
    const menu = window.vcwriter?.menu;
    if (!menu?.native()) return;
    void menu.install({ menus, checked: [...checkedCommands] });
  }, [checkedCommands, menus]);

  useEffect(() => {
    const menu = window.vcwriter?.menu;
    if (!menu) return;
    return menu.onCommand((command) => runCommand(command as CommandId));
  }, [runCommand]);

  if (!file || startingNew) {
    return (
      <>
        <Welcome
          onCreate={(input) => {
            setStartingNew(false);
            void project.createProject(input);
          }}
          onOpen={() => {
            setStartingNew(false);
            void project.openProject();
          }}
          onImport={() => setImportOpen(true)}
          onOpenPath={(path) => {
            setStartingNew(false);
            void project.openProjectAtPath(path);
          }}
          // Only when there is something to go back to.
          {...(file ? { onCancel: () => setStartingNew(false), openTitle: file.project.title } : {})}
          error={project.error}
        />
        {/* Importing is most useful from here: it is how a script arrives. */}
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={(imported) => project.replace(imported)}
        />
      </>
    );
  }

  const writing = view === 'write';
  const focused = focusMode && writing;
  const showBottom = writing && timelineOpen && !focused;
  const showRight = writing && inspectorOpen && !focused;
  const away = new Set(detached);
  // A section in a window of its own leaves no gap here: its place is not
  // drawn and the rest of the workspace takes the room (§8).
  const here = (slot: SlotId) => !away.has(arrangement[slot]);
  const display = { ...DEFAULT_SCRIPT_DISPLAY, ...scriptDisplay };
  // A novel's finished pages are its manuscript, not its script (§6.4).
  const paneNames = paneNamesFor(file.project.format);

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
        scriptLayout={scriptLayout}
        onScriptLayout={setScriptLayout}
        pageZoom={scriptZoom}
        onPageZoom={setScriptZoom}
        pageStyle={{ ...DEFAULT_PAGE_STYLE, ...pageStyle }}
        onPageStyle={setPageStyle}
        onOpenUnit={setOpenUnitId}
        onOpenBeat={setOpenBeatId}
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
        onOpenMarker={setOpenMarkerId}
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
        selectedUnitId={selectedUnitId}
        onSelectUnit={(unitId, laneId) => {
          setSelectedUnitId(unitId);
          setSelectedLaneId(laneId);
        }}
        onSelectLane={setSelectedLaneId}
        beatsPerColumn={beatsPerColumn}
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
        onDetach={() => openPane(pane)}
        dragging={dragging}
        onDragStart={setDragging}
        onDragEnd={() => setDragging(null)}
        onDrop={(onto) => {
          if (dragging) setArrangement(movePane(arrangement, dragging, slotOf(arrangement, onto)));
          setDragging(null);
        }}
        names={paneNames}
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
        showBottom && here('bottom') ? 'with-timeline' : '',
        showRight && here('right') ? 'with-inspector' : '',
        here('left') ? '' : 'without-left',
        here('top') ? '' : 'without-top',
        here('bottom') ? '' : 'without-bottom',
        file.project.format === 'series' && !focused ? 'with-episode-tab' : '',
        episodeRailOpen && file.project.format === 'series' && !focused ? 'with-episodes' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--left-width': `${columns.size}px`, '--viewport-height': `${rows.size}px` } as React.CSSProperties}
    >
      <TitleBar
        menu={
          <MenuBar
            menus={menus}
            onCommand={runCommand}
            checked={checkedCommands}
            mac={platform === 'darwin'}
            native={window.vcwriter?.menu?.native() ?? false}
          />
        }
        file={file}
        pages={pages}
        beatCount={stats?.beatCount ?? 0}
        wordCount={stats?.wordCount ?? 0}
        writing={writing}
        focusMode={focusMode}
        onFocus={() => setFocusMode(!focusMode)}
        onOpenResearch={() => (away.has('research') ? openPane('research') : setResearchOpen(true))}
        away={detached}
        onBringBack={closePane}
        account={account}
        syncing={syncing}
        onSync={() => (account.signedIn ? void sync() : setView('captures'))}
        saveState={project.saveState}
        onSaveNow={() => void project.saveNow()}
        onCloseProject={project.closeProject}
        onPreferences={() => setPreferencesOpen(true)}
      />

      <Preferences
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        scheme={scheme}
        onScheme={setScheme}
        paper={paper}
        onPaper={setPaper}
        beatsPerColumn={beatsPerColumn}
        onBeatsPerColumn={setBeatsPerColumn}
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
              {here('left') ? (
                <>
                  <div className="place place-left">{inSlot('left')}</div>
                  <div
                    className="divider vertical"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize the script column"
                    {...columns.dividerProps}
                  />
                </>
              ) : null}
              <div className="stage">
                {here('top') ? (
                  <div className="stage-top">
                    <div className="place place-top">{inSlot('top')}</div>
                    {showRight && here('right') ? <div className="place place-right">{inSlot('right')}</div> : null}
                  </div>
                ) : null}
                {showBottom && here('bottom') ? (
                  <>
                    {here('top') ? (
                      <div
                        className="divider"
                        role="separator"
                        aria-orientation="horizontal"
                        aria-label="Resize the viewport"
                        {...rows.dividerProps}
                      />
                    ) : null}
                    <div className="place place-bottom">{inSlot('bottom')}</div>
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
          <FindPanel
            file={file}
            open={finding !== 'off'}
            replacing={finding === 'replace'}
            onClose={() => setFinding('off')}
            onUpdate={project.update}
            onGoTo={setSelectedBeatId}
            step={findStep}
          />
          <MarkerDialog file={file} markerId={openMarkerId} onClose={() => setOpenMarkerId(null)} onUpdate={project.update} />
          <ResearchWindow
            file={file}
            open={researchOpen && !away.has('research')}
            currentBeatId={selectedBeat?.id ?? null}
            {...(researchView ? { openOn: researchView } : {})}
            onClose={() => {
              setResearchOpen(false);
              setResearchView(undefined);
            }}
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
              includeBeatTitles={setup.includeBeatTitles}
              onToggleBeatTitles={(next) => setPrintSetup({ ...printSetup, includeBeatTitles: next })}
              includeChapterPages={printSetup.includeChapterPages}
              onToggleChapterPages={(next) => setPrintSetup({ ...printSetup, includeChapterPages: next })}
              includeTitlePage={setup.includeTitlePage}
              includeContentsPage={setup.includeContentsPage}
              onPageSetup={() => setPageSetupOpen(true)}
              onExportPdf={() => void exportPdf()}
              onPrint={() => void print()}
              busy={exporting}
              message={exportMessage}
            />
          ) : view === 'editor' ? (
            <EditorPanel
              file={file}
              currentUnitId={selectedBeat?.unitId ?? null}
              openOn={editorTab}
              onGoTo={(beatId) => {
                setSelectedBeatId(beatId);
                setView('write');
              }}
              // A scene named against a promise is a scene the writer wants to
              // look at: go to where it starts.
              onGoToUnit={(unitId) => {
                const first = beatsForUnit(file, unitId)[0];
                if (first) setSelectedBeatId(first.id);
                setView('write');
              }}
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

      {file.project.format === 'series' && !focused ? (
        <EpisodeRail
          file={file}
          open={episodeRailOpen}
          onOpen={setEpisodeRailOpen}
          currentUnitId={selectedBeat?.unitId ?? null}
          onGo={(episode) => {
            const first = episode.beats[0];
            if (first) setSelectedBeatId(first.id);
          }}
          onOpenTitlePage={(episode) => {
            setTitlePageEpisode(episode);
            setTitlePageOpen(true);
          }}
          onNew={() => setNewEpisodeOpen(true)}
        />
      ) : null}

      <NewEpisodeDialog
        file={file}
        open={newEpisodeOpen}
        onClose={() => setNewEpisodeOpen(false)}
        onCreate={project.update}
        onGo={(episode) => {
          const first = episode.beats[0];
          if (first) setSelectedBeatId(first.id);
          setEpisodeRailOpen(true);
          // Straight on to its front page: an episode is a script that goes
          // out on its own, and naming it is part of starting it.
          setTitlePageEpisode(episode);
          setTitlePageOpen(true);
        }}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(imported) => project.replace(imported)}
      />

      <Reports
        file={file}
        open={reportOpen}
        onClose={() => setReportOpen(null)}
        onTab={setReportOpen}
        printOptions={printOptions}
        onShowUnusedResearch={() => {
          // The count is the question; the folder of notes is the answer.
          setReportOpen(null);
          setResearchView('unused');
          setResearchOpen(true);
        }}
      />

      <PageSetup
        file={file}
        open={pageSetupOpen}
        onClose={() => setPageSetupOpen(false)}
        setup={setup}
        onSetup={setPrintSetup}
        onEditTitlePage={() => {
          setPageSetupOpen(false);
          setTitlePageEpisode(null);
          setTitlePageOpen(true);
        }}
        onParagraphStyle={(style) => project.update((current) => setParagraphStyle(current, style))}
        pages={pages}
        onPrint={() => void print()}
        onExportPdf={() => void exportPdf()}
        busy={exporting}
      />

      <TitlePageDialog
        file={file}
        open={titlePageOpen}
        episode={titlePageEpisode}
        onClose={() => setTitlePageOpen(false)}
        onUpdate={project.update}
      />

      {focused ? null : <PageBar view={view} onSelect={setView} counts={{ recovery: conflicts.length }} />}
    </div>
  );
}
