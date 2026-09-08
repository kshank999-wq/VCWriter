import { type BeatId, type ProjectFile, type StoryLayout, type StructuralUnitId } from '@vcwriter/domain';
import { StoryView, type ScriptDisplay, type ScriptLayout } from './StoryView';

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
  /** What the Script shows besides the manuscript; held by the workspace. */
  display?: ScriptDisplay;
  onDisplay?(next: ScriptDisplay): void;
  /** One continuous page or a stack of sheets, and how big they are (§6.1). */
  scriptLayout?: ScriptLayout;
  onScriptLayout?(next: ScriptLayout): void;
  pageZoom?: number;
  onPageZoom?(next: number): void;
}

/**
 * The Script, and nothing around it (addendum 02 §6).
 *
 * Research used to be a tab beside it, which meant that taking the Script
 * out to another monitor took research with it. It lives in the title bar
 * now (§3), where it does not depend on any section being here.
 */
export function MasterPanel(props: MasterPanelProps) {
  const { focusMode } = props;

  if (focusMode) {
    return (
      <section className="master focus" aria-label="Script">
        <StoryView {...props} />
      </section>
    );
  }

  return (
    <section className="master" aria-label="Master panel">
      <StoryView {...props} />
    </section>
  );
}
