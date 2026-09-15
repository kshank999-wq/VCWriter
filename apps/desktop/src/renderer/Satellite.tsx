import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addLane,
  addMarker,
  defaultMarkerKind,
  beatsForUnit,
  beatsInStoryOrder,
  findBeat,
  storyLayout,
  threadLayout,
  timelineArcs,
  type BeatId,
  type LaneId,
  type ProjectFile,
  type StoryMarkerId,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { useLinkedProject } from './use-linked-project';
import { usePreference } from './use-split';
import { addBeatAfter, addSceneAfter } from './structure';
import { beatIdOf, paneTitle, type PaneKey } from './panes';
import { applyScheme, DEFAULT_SCHEME, type SchemeId } from './themes';
import { StoryView, DEFAULT_SCRIPT_DISPLAY, type ScriptDisplay, type ScriptLayout } from './components/StoryView';
import { AvSheet } from './components/AvSheet';
import { DEFAULT_PAGE_STYLE, type PageStyle } from './components/ScriptOptions';
import { DEFAULT_PRINT_SETUP, type PrintSetup } from './components/PageSetup';
import { usePrinting } from './printing';
import { ResearchBody } from './components/ResearchWindow';
import { SculptorWindow } from './components/SculptorWindow';
import { OutlinerWindow } from './components/OutlinerWindow';
import { EditorPanel } from './components/EditorPanel';
import { TimelineViewer } from './components/TimelineViewer';
import { MasterTimeline, DEFAULT_BEATS_PER_COLUMN } from './components/MasterTimeline';
import { Inspector } from './components/Inspector';
import { BeatWriter } from './components/BeatWriter';
import { BeatDialog } from './components/BeatDialog';
import { MarkerDialog } from './components/MarkerDialog';
import { SceneDialog } from './components/SceneDialog';
import { LaneDialog } from './components/LaneDialog';

/**
 * A section of the workspace, in a window of its own (addendum 02 §8).
 *
 * The window is opened with `?pane=` naming what it holds, and it edits the
 * workspace's project over the document link — the same document, not a copy
 * of it, so a line typed here is in the Script over there a moment later and
 * a beat dragged there moves its text here.
 *
 * What it deliberately does not have is a title bar full of the workspace's
 * business. A window that exists to be pushed onto a second monitor should be
 * the section and almost nothing else.
 */
export default function Satellite({ pane }: { pane: PaneKey }) {
  const project = useLinkedProject();
  const [scheme] = usePreference<SchemeId>('scheme', DEFAULT_SCHEME);
  const [paper] = usePreference('paper', true);
  useEffect(() => applyScheme(scheme), [scheme]);

  const file = project.file;
  useEffect(() => {
    const format = file?.project.format ?? null;
    document.title = file ? `${paneTitle(pane, format)} — ${file.project.title}` : paneTitle(pane);
  }, [pane, file]);

  if (!file) {
    return (
      <div className="satellite workspace">
        <p className="muted empty-state">
          {project.hubGone ? 'The workspace window closed.' : 'Waiting for the workspace…'}
        </p>
      </div>
    );
  }

  return (
    <div className={`satellite workspace${paper ? ' script-paper' : ''}`}>
      {project.hubGone ? (
        <p className="error banner" role="alert">
          The workspace window closed, so this one can no longer save. Reopen the project and this window will follow.
        </p>
      ) : null}
      <Section pane={pane} file={file} onUpdate={project.update} />
    </div>
  );
}

function Section({
  pane,
  file,
  onUpdate,
}: {
  pane: PaneKey;
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const beats = useMemo(() => beatsInStoryOrder(file), [file]);
  const [selectedBeatId, setSelectedBeatId] = useState<BeatId | null>(null);
  const [focusTitleBeatId, setFocusTitleBeatId] = useState<BeatId | null>(null);
  const [openLaneId, setOpenLaneId] = useState<LaneId | null>(null);
  // What was last clicked into: the scene a beat goes in, the lane a scene
  // lands in. The same rule as the workspace, because it is the same toolbar.
  const [selectedUnitId, setSelectedUnitId] = useState<StructuralUnitId | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<LaneId | null>(null);
  const [openUnitId, setOpenUnitId] = useState<StructuralUnitId | null>(null);
  const [openBeatId, setOpenBeatId] = useState<BeatId | null>(null);
  const [openMarkerId, setOpenMarkerId] = useState<StoryMarkerId | null>(null);
  const [scriptDisplay, setScriptDisplay] = usePreference<ScriptDisplay>('scriptDisplay', DEFAULT_SCRIPT_DISPLAY);
  const [scriptLayout, setScriptLayout] = usePreference<ScriptLayout>('scriptLayout', 'flow');
  // Zero is 'fit the width there is' — a page is 8½ inches and the
  // Script's column is not (§6.1).
  const [scriptZoom, setScriptZoom] = usePreference('scriptZoom', 0);
  // Paper, ink and face: the writer's, per machine, never project data (§6.3).
  const [pageStyle, setPageStyle] = usePreference<PageStyle>('pageStyle', DEFAULT_PAGE_STYLE);
  const [pixelsPerPage, setPixelsPerPage] = usePreference('zoom', 160);
  /**
   * Printing, from the same module the workspace uses, and with **no flush**:
   * this window has no file to flush, and does not need one — what goes to the
   * printer is the document in hand rather than the one on disk, and the two
   * windows hold the same document over the link.
   *
   * The page setup is a per-machine preference, so a printing from here
   * carries exactly what a printing from the workspace would.
   */
  const [printSetup] = usePreference<PrintSetup>('printSetup', DEFAULT_PRINT_SETUP);
  const printing = usePrinting({ file, setup: printSetup });
  const [beatsPerColumn] = usePreference('beatsPerColumn', DEFAULT_BEATS_PER_COLUMN);
  const [viewerZoom, setViewerZoom] = usePreference('viewerZoom', 180);
  const [isolatedCharacter, setIsolatedCharacter] = useState('');

  const selectedBeat = beats.find((beat) => beat.id === selectedBeatId) ?? beats[0] ?? null;
  const layout = useMemo(() => storyLayout(file), [file]);
  const arcs = useMemo(() => timelineArcs(file), [file]);
  const threads = useMemo(() => threadLayout(file, { layout, arcs }), [file, layout, arcs]);

  /** A beat opened from here gets its own window too, not a dialog over this one. */
  const openBeatWindow = useCallback((beatId: BeatId) => {
    void window.vcwriter?.panes?.open(`beat:${beatId}`);
  }, []);

  const selection = useMemo(
    () => ({ laneId: selectedLaneId, unitId: selectedUnitId, beat: selectedBeat }),
    [selectedLaneId, selectedUnitId, selectedBeat],
  );

  const addScene = useCallback(() => {
    const made = addSceneAfter(file, selection);
    if (!made) return;
    onUpdate(() => made.file);
    setSelectedBeatId(made.beatId);
    setSelectedUnitId(made.unitId);
    setFocusTitleBeatId(made.beatId);
  }, [file, selection, onUpdate]);

  const addBeat = useCallback(() => {
    const made = addBeatAfter(file, selection);
    if (!made) return;
    onUpdate(() => made.file);
    setSelectedBeatId(made.beatId);
    setSelectedUnitId(made.unitId);
    setFocusTitleBeatId(made.beatId);
  }, [file, selection, onUpdate]);

  const dialogs = (
    <>
      <LaneDialog file={file} laneId={openLaneId} onClose={() => setOpenLaneId(null)} onUpdate={onUpdate} />
      <SceneDialog
        file={file}
        unitId={openUnitId}
        onClose={() => setOpenUnitId(null)}
        onUpdate={onUpdate}
        onOpenBeat={setOpenBeatId}
        onSelectBeat={setSelectedBeatId}
      />
      <MarkerDialog file={file} markerId={openMarkerId} onClose={() => setOpenMarkerId(null)} onUpdate={onUpdate} />
      <BeatDialog
        file={file}
        beatId={openBeatId}
        onClose={() => setOpenBeatId(null)}
        onUpdate={onUpdate}
        onSelect={setSelectedBeatId}
        onPopOut={(beatId) => {
          setOpenBeatId(null);
          openBeatWindow(beatId);
        }}
      />
    </>
  );

  const beatId = beatIdOf(pane);
  if (beatId) {
    const beat = findBeat(file, beatId as BeatId);
    if (!beat) return <p className="muted empty-state">This beat is no longer in the project.</p>;
    return (
      <div className="satellite-body writer-window">
        <BeatWriter file={file} beat={beat} onUpdate={onUpdate} />
      </div>
    );
  }

  if (pane === 'research') {
    return (
      <div className="satellite-body research-window standalone">
        <ResearchBody file={file} currentBeatId={selectedBeat?.id ?? null} onClose={closeSelf} onUpdate={onUpdate} />
      </div>
    );
  }

  if (pane === 'script') {
    // Short form's document is the sheet, in its own window as anywhere else.
    if (file.project.format === 'short_form') {
      return (
        <div className="satellite-body master">
          <AvSheet file={file} onUpdate={onUpdate} onOpenRow={(beatId) => setSelectedBeatId(beatId)} />
        </div>
      );
    }
    return (
      <div className="satellite-body master">
        <StoryView
          file={file}
          layout={layout}
          selectedBeatId={selectedBeat?.id ?? null}
          onSelectBeat={setSelectedBeatId}
          onUpdate={onUpdate}
          focusMode={false}
          focusTitleBeatId={focusTitleBeatId}
          onTitleFocused={() => setFocusTitleBeatId(null)}
          dictationShortcut={null}
          display={{ ...DEFAULT_SCRIPT_DISPLAY, ...scriptDisplay }}
          onDisplay={setScriptDisplay}
          scriptLayout={scriptLayout}
          onScriptLayout={setScriptLayout}
          pageZoom={scriptZoom}
          onPageZoom={setScriptZoom}
          pageStyle={{ ...DEFAULT_PAGE_STYLE, ...pageStyle }}
          onPageStyle={setPageStyle}
          onOpenUnit={setOpenUnitId}
          onOpenBeat={openBeatWindow}
        />
        {dialogs}
      </div>
    );
  }

  if (pane === 'viewer') {
    return (
      <div className="satellite-body stage-top">
        <TimelineViewer
          file={file}
          threads={threads}
          selectedBeatId={selectedBeat?.id ?? null}
          onSelectBeat={setSelectedBeatId}
          onUpdate={onUpdate}
          zoom={viewerZoom}
          onZoom={setViewerZoom}
          isolated={isolatedCharacter}
          onIsolate={setIsolatedCharacter}
          onOpenMarker={setOpenMarkerId}
        />
        {dialogs}
      </div>
    );
  }

  if (pane === 'inspector') {
    return (
      <div className="satellite-body">
        <Inspector file={file} selectedBeatId={selectedBeat?.id ?? null} onUpdate={onUpdate} />
      </div>
    );
  }

  // The two rooms. Both already cover the whole workspace when they are
  // opened over it — `position: fixed; inset: 0` — so a window of their own
  // is the same component with nothing under it, and closing is closing the
  // window rather than uncovering the script.
  if (pane === 'sculptor') {
    return <SculptorWindow file={file} open onClose={closeSelf} onUpdate={onUpdate} />;
  }

  if (pane === 'outliner') {
    return (
      <OutlinerWindow
        file={file}
        open
        onClose={closeSelf}
        onUpdate={onUpdate}
        // The outline prints from here too. What is printed is the document in
        // hand — the same one the workspace holds, over the link — so a room on
        // the other monitor is not a room that can do less.
        onPrint={(outlineId) => void printing.print('outline', outlineId)}
        onExport={(outlineId) => void printing.exportPdf('outline', outlineId)}
      />
    );
  }

  if (pane === 'editors') {
    return (
      <div className="satellite-body editors-window">
        <EditorPanel
          file={file}
          currentUnitId={selectedUnitId ?? selectedBeat?.unitId ?? null}
          onUpdate={onUpdate}
          // There is no Write page over here to send somebody to, so a finding
          // opens the beat it is about in a window of its own — which is the
          // arrangement this page is for: what is wrong on one screen, the
          // passage it is wrong in on the other.
          onGoTo={openBeatWindow}
          onGoToUnit={(unitId) => {
            const first = beatsForUnit(file, unitId)[0];
            if (first) openBeatWindow(first.id);
          }}
          onPrintGrid={() => void printing.print('grid')}
          onExportGrid={() => void printing.exportPdf('grid')}
          busy={printing.busy}
          exportMessage={printing.message}
        />
      </div>
    );
  }

  if (pane !== 'lanes') {
    // Every key this build knows is above. Saying so is the point: the plot
    // lanes used to be the fallthrough, so a window asking for something this
    // version has not got — an older workspace, a hand-edited URL — opened
    // showing the lanes and claiming to be whatever it had asked for.
    return (
      <p className="muted empty-state">
        This build has no section called “{pane}”. Close this window and open it from the workspace’s Window menu.
      </p>
    );
  }

  return (
    <div className="satellite-body stage">
      <MasterTimeline
        file={file}
        layout={layout}
        arcs={arcs}
        threads={threads}
        selectedBeatId={selectedBeat?.id ?? null}
        onSelectBeat={setSelectedBeatId}
        selectedUnitId={selectedUnitId}
        onSelectUnit={(unitId, laneId) => {
          setSelectedUnitId(unitId);
          setSelectedLaneId(laneId);
        }}
        onSelectLane={setSelectedLaneId}
        beatsPerColumn={beatsPerColumn}
        onUpdate={onUpdate}
        pixelsPerPage={pixelsPerPage}
        onZoom={setPixelsPerPage}
        inspectorOpen={null}
        onToggleInspector={() => undefined}
        onAddScene={addScene}
        onAddBeat={addBeat}
        onAddLane={() => onUpdate((current) => addLane(current, { name: 'New lane' }).file)}
        onAddAct={() =>
          selectedBeat
            ? onUpdate((current) => addMarker(current, {
            unitId: selectedBeat.unitId,
            title: '',
            kind: defaultMarkerKind(current.project.format),
          }).file)
            : undefined
        }
        onOpenLane={setOpenLaneId}
        onOpenUnit={setOpenUnitId}
        onOpenBeat={setOpenBeatId}
      />
      {dialogs}
    </div>
  );
}

/** Closing research in its own window closes the window. */
const closeSelf = () => window.close();
