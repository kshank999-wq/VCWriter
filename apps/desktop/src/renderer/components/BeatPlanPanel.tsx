import { useMemo } from 'react';
import { beatPlan, type BeatId, type ProjectFile } from '@vcwriter/domain';

const KINDS: Record<string, { mark: string; name: string }> = {
  note: { mark: '✎', name: 'Note' },
  idea: { mark: '✦', name: 'Idea' },
  character: { mark: '☺', name: 'Character' },
  setting: { mark: '⌂', name: 'Setting' },
  prop: { mark: '❖', name: 'Prop' },
  beat: { mark: '◈', name: 'Beat' },
  scene: { mark: '▣', name: 'Scene' },
};

/**
 * **The beat's plan, beside its writing** (from Ken: *there needs to be a
 * button where you can open that in a side menu where you have a split
 * screen. So you have all your notes and everything available while you're
 * writing that beat… a side menu that fills part of the screen. And then you
 * can collapse that also*).
 *
 * What the Outliner holds under the beat being written — its own words, then
 * its notes, characters, settings and ideas, each with its words and the
 * research note it was dragged in from — read off `beatPlan`, so editing the
 * outline changes this with nothing copied.
 */
export function BeatPlanPanel({ file, beatId, onClose }: { file: ProjectFile; beatId: BeatId; onClose(): void }) {
  const plan = useMemo(() => beatPlan(file, beatId), [file, beatId]);
  return (
    <aside className="beat-plan" aria-label="Planned for this beat">
      <header className="beat-plan-head">
        <h3>Planned for this beat</h3>
        <button type="button" className="ghost small" aria-label="Hide the notes" title="Hide the notes" onClick={onClose}>
          ⇥
        </button>
      </header>
      {!plan.row ? (
        <p className="muted small">
          This beat has no row in the Outliner yet. Plan it there — notes, characters and ideas under it — and they show
          here while you write.
        </p>
      ) : (
        <>
          {plan.row.body.trim() ? <p className="beat-plan-own">{plan.row.body}</p> : null}
          {plan.lines.length === 0 ? (
            <p className="muted small">Nothing under this beat in the Outliner yet. Add notes, characters or ideas there.</p>
          ) : (
            <ul className="beat-plan-list">
              {plan.lines.map((line, index) => {
                const kind = KINDS[line.kind] ?? { mark: '•', name: line.kind };
                const words = line.body.trim() || line.research?.body.trim() || '';
                return (
                  <li key={index} style={{ marginLeft: line.depth * 14 }}>
                    <div className="beat-plan-line">
                      <span className="beat-plan-mark" title={kind.name} aria-label={kind.name}>
                        {kind.mark}
                      </span>
                      <strong>{line.title || kind.name}</strong>
                    </div>
                    {words ? <p className="beat-plan-words">{words}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
