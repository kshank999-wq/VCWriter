import { useState } from 'react';
import {
  COMMANDMENTS,
  COMMANDMENT_ASKS,
  COMMANDMENT_NAMES,
  actCommandments,
  answeredCount,
  sceneCommandments,
  setActCommandments,
  setSceneCommandment,
  setStoryCommandments,
  storyGridOf,
  type Commandment,
  type Commandments,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';

/**
 * The five commandments (addendum 04 §4), at the three scales the method
 * asks them at: the whole story, each act or region, and each scene.
 *
 * **Nothing derives them.** A story's inciting incident is a judgement, not a
 * measurement, so every box here is the writer's own and starts empty. What
 * the tool contributes is the question, asked in the same five words at every
 * scale, and a shape dense enough that an empty column is visible without
 * anybody counting.
 *
 * The progressive complication is the turn the Final Editor's grid has always
 * asked for. It is the same field, shown here under the name the method uses,
 * so filling it in either place fills it in both.
 */

type Scale = 'story' | 'acts' | 'scenes';

interface CommandmentsSectionProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGoToUnit?(unitId: StructuralUnitId): void;
}

export function CommandmentsSection({ file, onUpdate, onGoToUnit }: CommandmentsSectionProps) {
  const [scale, setScale] = useState<Scale>('story');
  const story = storyGridOf(file).story;
  const acts = actCommandments(file);
  const scenes = sceneCommandments(file);

  return (
    <section className="grid-commandments">
      <h3>
        The five commandments
        <span className="muted small grid-count">
          {answeredCount(story)} of 5 for the story
        </span>
      </h3>
      <p className="muted small commandments-note">
        The same five questions at every scale. Nothing fills them in — a story’s inciting incident is a
        judgement, not a measurement — and an empty column is the finding.
      </p>

      <div className="scale-switch" role="tablist" aria-label="At what scale">
        <ScaleTab name="The story" value="story" scale={scale} onPick={setScale} />
        <ScaleTab name={`Each act (${acts.length})`} value="acts" scale={scale} onPick={setScale} disabled={acts.length === 0} />
        <ScaleTab name={`Scene by scene (${scenes.length})`} value="scenes" scale={scale} onPick={setScale} />
      </div>

      {scale === 'story' ? (
        <div className="commandment-form">
          {COMMANDMENTS.map((which) => (
            <label key={which} className="field-row">
              <span>{COMMANDMENT_NAMES[which]}</span>
              <div className="field-input">
                <input
                  aria-label={`${COMMANDMENT_NAMES[which]}, for the story`}
                  placeholder={COMMANDMENT_ASKS[which]}
                  value={story[which]}
                  onChange={(event) =>
                    onUpdate((current) => setStoryCommandments(current, { [which]: event.target.value }))
                  }
                />
              </div>
            </label>
          ))}
        </div>
      ) : null}

      {scale === 'acts' ? (
        acts.length === 0 ? (
          <p className="muted small">
            Mark where the acts break and each one can be asked the same five questions.
          </p>
        ) : (
          <CommandmentTable
            heading="Act"
            rows={acts.map((act) => ({
              key: act.markerId as string,
              label: act.label,
              under: `scenes ${act.from}–${act.to}`,
              commandments: act.commandments,
              set: (which, text) =>
                onUpdate((current) => setActCommandments(current, act.markerId, { [which]: text })),
            }))}
          />
        )
      ) : null}

      {scale === 'scenes' ? (
        <CommandmentTable
          heading="Scene"
          rows={scenes.map((entry) => ({
            key: entry.unitId as string,
            label: entry.label,
            under: entry.act ? `${entry.position} · ${entry.act}` : `${entry.position}`,
            commandments: entry.commandments,
            set: (which, text) =>
              onUpdate((current) => setSceneCommandment(current, entry.unitId, which, text)),
            ...(onGoToUnit ? { onGo: () => onGoToUnit(entry.unitId) } : {}),
          }))}
        />
      ) : null}
    </section>
  );
}

function ScaleTab({
  name,
  value,
  scale,
  onPick,
  disabled,
}: {
  name: string;
  value: Scale;
  scale: Scale;
  onPick(next: Scale): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={scale === value}
      disabled={disabled ?? false}
      className={scale === value ? 'scale selected' : 'scale'}
      onClick={() => onPick(value)}
    >
      {name}
    </button>
  );
}

interface CommandmentRow {
  key: string;
  label: string;
  /** Where it sits: the scenes an act encloses, or a scene's number and act. */
  under: string;
  commandments: Commandments;
  set(which: Commandment, text: string): void;
  onGo?(): void;
}

/**
 * One row per act or scene, five narrow columns across (§5).
 *
 * Read **down** a column rather than across a row: three scenes in a row with
 * no crisis is a thing you see, not a thing a rule has to announce.
 */
function CommandmentTable({ heading, rows }: { heading: string; rows: CommandmentRow[] }) {
  if (rows.length === 0) return <p className="muted small">Nothing to ask yet.</p>;
  return (
    <div className="commandment-scroll">
      <table className="commandment-table">
        <thead>
          <tr>
            <th scope="col">{heading}</th>
            {COMMANDMENTS.map((which) => (
              <th key={which} scope="col" title={COMMANDMENT_ASKS[which]}>
                {COMMANDMENT_NAMES[which]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={answeredCount(row.commandments) === 0 ? 'commandment-empty' : undefined}>
              <th scope="row">
                {row.onGo ? (
                  <button type="button" className="link" onClick={row.onGo} title="Go to it">
                    {row.label}
                  </button>
                ) : (
                  row.label
                )}
                <span className="muted small under">{row.under}</span>
              </th>
              {COMMANDMENTS.map((which) => (
                <td key={which}>
                  <input
                    aria-label={`${COMMANDMENT_NAMES[which]}, ${row.label}`}
                    value={row.commandments[which]}
                    onChange={(event) => row.set(which, event.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
