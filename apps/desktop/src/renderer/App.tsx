import { useMemo, useState } from 'react';
import { beatsInStoryOrder, projectStats, type BeatId } from '@vcwriter/domain';
import { useProject } from './use-project';
import { Welcome } from './components/Welcome';
import { StructureBoard } from './components/StructureBoard';
import { BeatEditor } from './components/BeatEditor';

const SAVE_LABEL: Record<string, string> = {
  idle: '',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

export default function App() {
  const project = useProject();
  const [selectedBeatId, setSelectedBeatId] = useState<BeatId | null>(null);

  const beats = useMemo(() => (project.file ? beatsInStoryOrder(project.file) : []), [project.file]);
  const selectedBeat = beats.find((beat) => beat.id === selectedBeatId) ?? beats[0] ?? null;
  const stats = project.file ? projectStats(project.file) : null;

  if (!project.file) {
    return (
      <Welcome
        onCreate={(input) => void project.createProject(input)}
        onOpen={() => void project.openProject()}
        onOpenPath={(path) => void project.openProjectAtPath(path)}
        error={project.error}
      />
    );
  }

  return (
    <div className="workspace">
      <header className="titlebar">
        <div>
          <strong>{project.file.project.title}</strong>
          <span className="muted"> · {project.file.project.format.replace(/_/g, ' ')}</span>
        </div>
        <div className="titlebar-right">
          {stats ? (
            <span className="muted">
              {stats.unitCount} scenes/chapters · {stats.beatCount} beats · {stats.wordCount} words
              {stats.unresolvedSetupCount > 0 ? ` · ${stats.unresolvedSetupCount} unresolved setups` : ''}
            </span>
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

      <div className="workspace-body">
        <StructureBoard
          file={project.file}
          selectedBeatId={selectedBeat?.id ?? null}
          onSelectBeat={setSelectedBeatId}
          onUpdate={project.update}
        />
        <main>
          {selectedBeat ? (
            <BeatEditor file={project.file} beat={selectedBeat} onUpdate={project.update} />
          ) : (
            <p className="muted empty-state">Add a beat to a scene or chapter to start writing.</p>
          )}
        </main>
      </div>
    </div>
  );
}
