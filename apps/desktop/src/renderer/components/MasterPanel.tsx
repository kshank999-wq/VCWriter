import { type BeatId, type ProjectFile, type StoryLayout, type StructuralUnitId } from '@vcwriter/domain';
import { StoryView, type ScriptDisplay } from './StoryView';

interface MasterPanelProps {
  file: ProjectFile;
  layout?: StoryLayout;
  selectedBeatId: BeatId | null;
  onSelectBeat(beatId: BeatId): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  focusMode: boolean;
  focusTitleBeatId: BeatId | null;
  onTitleFocused(): void;
  dictationShortcut: string | null;
  onOpenUnit?(unitId: StructuralUnitId): void;
  onOpenBeat?(beatId: BeatId): void;
  /** The Research tab opens the research window over the workspace (§7). */
  onOpenResearch?(): void;
  /** What the Script shows besides the manuscript; held by the workspace. */
  display?: ScriptDisplay;
  onDisplay?(next: ScriptDisplay): void;
}

/**
 * The left editor window (addendum 02 §6): the Script, which is what this
 * quarter of the screen is for. Beside its tab is **Research**, which is
 * not a quarter of anything — it opens over the whole window with its
 * folders down the side (§7).
 */
export function MasterPanel(props: MasterPanelProps) {
  const { focusMode, onOpenResearch } = props;

  if (focusMode) {
    return (
      <section className="master focus" aria-label="Script">
        <StoryView {...props} />
      </section>
    );
  }

  return (
    <section className="master" aria-label="Master panel">
      <div className="master-tabs" role="tablist" aria-label="Master panel">
        <button type="button" role="tab" aria-selected className="tab selected">
          Script
        </button>
        {/* Research is not a quarter of the screen: it opens over the whole
            of it, with its folders down the side (addendum 02 §7). */}
        <button type="button" className="tab" title="Open the research window" onClick={onOpenResearch}>
          Research
        </button>
      </div>

      <StoryView {...props} />
    </section>
  );
}
