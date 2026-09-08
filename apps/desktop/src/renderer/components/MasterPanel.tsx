import { useState } from 'react';
import {
  addLane,
  laneKindSchema,
  lanesInOrder,
  removeLane,
  researchCategoriesInOrder,
  updateLane,
  type BeatId,
  type ProjectFile,
  type ResearchCategoryId,
  type StoryLayout,
} from '@vcwriter/domain';
import { StoryView } from './StoryView';
import { ResearchPanel } from './ResearchPanel';
import { SetupsPanel } from './SetupsPanel';
import { InlineText } from './InlineText';

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
}

type MasterTab = 'script' | 'research';
type ResearchTab = { kind: 'category'; id: ResearchCategoryId } | { kind: 'plots' } | { kind: 'setups' };

const sameTab = (a: ResearchTab, b: ResearchTab): boolean =>
  a.kind === b.kind && (a.kind !== 'category' || b.kind !== 'category' || a.id === b.id);

/**
 * The left editor window (addendum 02 §5, §6): the Script, and under a
 * second tab the research material — one tab per category, one for the
 * plot lanes as records, one for setups and payoffs. The selected beat is
 * shared with the timeline and the inspector, so "mark used in the current
 * beat" on a research tab means the beat the writer was just in.
 */
export function MasterPanel(props: MasterPanelProps) {
  const { file, selectedBeatId, onUpdate, focusMode } = props;
  const [tab, setTab] = useState<MasterTab>('script');
  const [researchTab, setResearchTab] = useState<ResearchTab | null>(null);

  const categories = researchCategoriesInOrder(file);
  const researchTabs: Array<{ tab: ResearchTab; label: string; count?: number }> = [
    ...categories.map((category) => ({
      tab: { kind: 'category', id: category.id } as ResearchTab,
      label: category.name,
      count: file.researchItems.filter((item) => item.categoryId === category.id && item.usage === 'unused' && !item.archived).length,
    })),
    { tab: { kind: 'plots' }, label: 'Plots', count: file.lanes.length },
    {
      tab: { kind: 'setups' },
      label: 'Setups & payoffs',
      count: file.setupsPayoffs.filter((record) => !record.archived && record.status !== 'resolved').length,
    },
  ];
  // A remembered category tab whose category has gone (removed here, or by a
  // sync) must not leave the strip with nothing highlighted.
  const stillThere = researchTab && researchTabs.some((entry) => sameTab(entry.tab, researchTab));
  const activeResearch: ResearchTab = stillThere && researchTab ? researchTab : (researchTabs[0]?.tab ?? { kind: 'plots' });
  const tabKey = (tab: ResearchTab) => (tab.kind === 'category' ? `category:${tab.id}` : tab.kind);

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
        <button type="button" role="tab" aria-selected={tab === 'script'} className={tab === 'script' ? 'tab selected' : 'tab'} onClick={() => setTab('script')}>
          Script
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'research'}
          className={tab === 'research' ? 'tab selected' : 'tab'}
          onClick={() => setTab('research')}
        >
          Research
        </button>
      </div>

      {tab === 'script' ? (
        <StoryView {...props} />
      ) : (
        <div className="research-area">
          <div className="master-subtabs" role="tablist" aria-label="Research">
            {researchTabs.map((entry) => {
              const selected = sameTab(entry.tab, activeResearch);
              return (
                <button
                  key={tabKey(entry.tab)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={selected ? 'tab selected' : 'tab'}
                  onClick={() => setResearchTab(entry.tab)}
                >
                  {entry.label}
                  {entry.count ? <span className="page-count">{entry.count}</span> : null}
                </button>
              );
            })}
          </div>
          {activeResearch.kind === 'category' ? (
            <ResearchPanel file={file} currentBeatId={selectedBeatId} onUpdate={onUpdate} categoryId={activeResearch.id} />
          ) : activeResearch.kind === 'setups' ? (
            <SetupsPanel file={file} currentBeatId={selectedBeatId} onUpdate={onUpdate} />
          ) : (
            <PlotsTab file={file} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </section>
  );
}

/** The plot lanes as records: the same rows the timeline draws, as text. */
function PlotsTab({ file, onUpdate }: { file: ProjectFile; onUpdate: MasterPanelProps['onUpdate'] }) {
  const lanes = lanesInOrder(file);
  return (
    <div className="plots">
      <div className="panel-header">
        <h2>Plot lanes</h2>
        <button type="button" className="ghost" onClick={() => onUpdate((current) => addLane(current, { name: 'New lane' }).file)}>
          + Lane
        </button>
      </div>
      <ul className="plot-list">
        {lanes.map((lane) => (
          <li key={lane.id} className="plot-row" style={{ borderLeftColor: lane.color }}>
            <div className="plot-head">
              <input
                type="color"
                className="swatch"
                value={lane.color}
                aria-label={`${lane.name} colour`}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { color: event.target.value }))}
              />
              <InlineText
                value={lane.name}
                ariaLabel="Lane name"
                className="plot-name"
                onCommit={(name) => onUpdate((current) => updateLane(current, lane.id, { name: name || 'Lane' }))}
              />
              <select
                aria-label={`${lane.name} kind`}
                value={lane.kind}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { kind: event.target.value as typeof lane.kind }))}
              >
                {laneKindSchema.options.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <span className="count muted">{file.units.filter((unit) => unit.laneId === lane.id).length} scenes</span>
              {lanes.length > 1 ? (
                <button
                  type="button"
                  className="ghost danger"
                  title="Remove lane and its scenes"
                  onClick={() => onUpdate((current) => removeLane(current, lane.id))}
                >
                  ×
                </button>
              ) : null}
            </div>
            <textarea
              rows={2}
              placeholder="What this thread of the story is about"
              aria-label={`${lane.name} description`}
              value={lane.description}
              onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { description: event.target.value }))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
