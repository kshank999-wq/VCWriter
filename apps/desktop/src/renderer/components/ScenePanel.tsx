import { useState } from 'react';
import {
  addBehaviour,
  beatVisuals,
  BEHAVIOUR_SUGGESTIONS,
  living,
  narrativeLayer,
  removeBehaviour,
  sceneBoard,
  sceneLayersOf,
  systemicLayer,
  updateBehaviour,
  updatePresentation,
  type BeatId,
  type BoardCardKind,
  type CharacterId,
  type ConditionGroup,
  type Presentation,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { ConditionGroupEditor, RuleSentence } from './RuleBuilder';

/**
 * A game scene's four layers, and its board (addendum 25 §5), in the far
 * column beside the script.
 *
 * Two of the four are **written here** — what each character does, and how
 * the scene is presented — and two are **read**: the narrative context from
 * the scene itself, and the systemic rules from its nodes and objectives. A
 * read layer says where it is written, so nobody looks for the box to type in.
 */

type Layer = 'narrative' | 'behaviour' | 'systemic' | 'presentation';

const LAYER_WORDS: Record<Layer, string> = {
  narrative: '1 · Narrative',
  behaviour: '2 · Behaviour',
  systemic: '3 · Systemic',
  presentation: '4 · Presentation',
};

const PRESENTATION_FIELDS: { key: keyof Presentation; label: string; hint: string }[] = [
  { key: 'music', label: 'Music', hint: 'Low strings as the door opens' },
  { key: 'ambience', label: 'Ambience', hint: 'Dripping water, a distant rumble' },
  { key: 'sound', label: 'Sound', hint: 'The lever grinds; the seam drains' },
  { key: 'camera', label: 'Camera', hint: 'Door framed centre; push in on the key' },
  { key: 'cinematic', label: 'Cinematic', hint: 'Skippable. Returns control at the camp.' },
  { key: 'atmosphere', label: 'Atmosphere', hint: 'Claustrophobic, hopeful' },
];

const CARD_WORDS: Record<BoardCardKind, string> = {
  player: 'Player',
  character: 'Character',
  place: 'Place',
  resource: 'Item',
  objective: 'Objective',
  exit: 'Way out',
};

export function ScenePanel({
  file,
  beatId,
  onUpdate,
}: {
  file: ProjectFile;
  beatId: BeatId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const [view, setView] = useState<'layers' | 'board'>('layers');
  const [open, setOpen] = useState<Record<Layer, boolean>>({ narrative: true, behaviour: true, systemic: true, presentation: true });
  const [openRule, setOpenRule] = useState<string | null>(null);

  const unitId = beatId ? (file.beats.find((one) => one.id === beatId)?.unitId ?? null) : null;
  const layer = unitId ? narrativeLayer(file, unitId) : null;
  if (!unitId || !layer) {
    return <p className="muted empty-state">Select a beat to see its scene’s layers.</p>;
  }
  const scene: StructuralUnitId = unitId;
  const stored = sceneLayersOf(file, scene);
  const systemic = systemicLayer(file, scene);
  const visuals = beatVisuals(file, scene);
  const cast = file.characters.filter((one) => living(one) && !one.archived);

  const heading = (which: Layer) => (
    <button
      type="button"
      className="ghost scene-layer-head"
      aria-expanded={open[which]}
      onClick={() => setOpen({ ...open, [which]: !open[which] })}
    >
      {open[which] ? '▾' : '▸'} {LAYER_WORDS[which]}
    </button>
  );

  return (
    <section className="game-inspector-section scene-panel">
      <h3>
        Scene {layer.position}
        {layer.title.trim() ? ` · ${layer.title.trim()}` : ''}
      </h3>
      <div className="scene-view-switch" role="group" aria-label="How to show the scene">
        {(['layers', 'board'] as const).map((one) => (
          <button key={one} type="button" className={view === one ? 'tool on' : 'tool'} aria-pressed={view === one} onClick={() => setView(one)}>
            {one === 'layers' ? 'Layers' : 'Board'}
          </button>
        ))}
      </div>

      {view === 'board' ? (
        <ul className="scene-board" aria-label="The scene as cards">
          {sceneBoard(file, scene).map((card, index) => (
            <li key={`${card.kind}-${card.id ?? index}`} className={`scene-card kind-${card.kind}`}>
              <span className="scene-card-kind">{CARD_WORDS[card.kind]}</span>
              <strong>{card.name}</strong>
              <span className="muted small">{card.says}</span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {heading('narrative')}
          {open.narrative ? (
            <div className="scene-layer">
              <p className="muted small">Read from the scene: its summary, its heading and who speaks in it.</p>
              {layer.summary.trim() ? <p>{layer.summary.trim()}</p> : <p className="muted small">No summary yet.</p>}
              <dl className="scene-facts">
                <dt>Where</dt>
                <dd>{layer.place?.name ?? 'No place in the scene heading yet'}</dd>
                <dt>Who speaks</dt>
                <dd>{layer.cast.length ? layer.cast.map((one) => one.name).join(', ') : 'Nobody yet'}</dd>
                <dt>To be here</dt>
                <dd>{layer.prerequisites.length ? layer.prerequisites.join('; ') : 'Anybody who gets here'}</dd>
              </dl>
            </div>
          ) : null}

          {heading('behaviour')}
          {open.behaviour ? (
            <div className="scene-layer">
              <datalist id="behaviour-kinds">
                {BEHAVIOUR_SUGGESTIONS.map((one) => (
                  <option key={one} value={one} />
                ))}
              </datalist>
              {stored.behaviours.length === 0 ? (
                <p className="muted small">What do the characters do here? Add a behaviour.</p>
              ) : null}
              <ul className="game-inspector-list">
                {stored.behaviours.map((behaviour) => {
                  const id = behaviour.id as string;
                  const ruleOpen = openRule === id;
                  return (
                    <li key={id} className="scene-behaviour">
                      <div className="rule-row">
                        <select
                          value={(behaviour.characterId as string) ?? ''}
                          aria-label="Who"
                          onChange={(event) =>
                            onUpdate((current) =>
                              updateBehaviour(current, scene, behaviour.id, {
                                characterId: (event.target.value || null) as CharacterId | null,
                              }),
                            )
                          }
                        >
                          <option value="">Somebody</option>
                          {cast.map((person) => (
                            <option key={person.id as string} value={person.id as string}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                        <input
                          list="behaviour-kinds"
                          value={behaviour.kind}
                          placeholder="Follow"
                          aria-label="What they do"
                          onChange={(event) =>
                            onUpdate((current) => updateBehaviour(current, scene, behaviour.id, { kind: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="ghost small"
                          aria-label="Remove this behaviour"
                          onClick={() => onUpdate((current) => removeBehaviour(current, scene, behaviour.id))}
                        >
                          ✕
                        </button>
                      </div>
                      <textarea
                        value={behaviour.note}
                        placeholder="How, and why: stays three paces behind; moves ahead if she trusts you"
                        aria-label="The behaviour, in words"
                        onChange={(event) =>
                          onUpdate((current) => updateBehaviour(current, scene, behaviour.id, { note: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="ghost small"
                        aria-expanded={ruleOpen}
                        onClick={() => setOpenRule(ruleOpen ? null : id)}
                      >
                        {ruleOpen ? '▴ When' : '▾ When'}
                      </button>
                      <RuleSentence file={file} group={behaviour.conditions} empty="Always." />
                      {ruleOpen ? (
                        <ConditionGroupEditor
                          file={file}
                          group={behaviour.conditions}
                          onChange={(next: ConditionGroup) =>
                            onUpdate((current) => updateBehaviour(current, scene, behaviour.id, { conditions: next }))
                          }
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="tool"
                onClick={() => onUpdate((current) => addBehaviour(current, scene, { characterId: layer.cast[0]?.id ?? null }).file)}
              >
                + Behaviour
              </button>
            </div>
          ) : null}

          {heading('systemic')}
          {open.systemic ? (
            <div className="scene-layer">
              <p className="muted small">Read from the rules. Write them in Rules or on the Story Map; objectives on the Player Lane.</p>
              {systemic.arrivals.length === 0 && systemic.choices.length === 0 && systemic.objectives.length === 0 ? (
                <p className="muted small">No rules here yet.</p>
              ) : null}
              {systemic.arrivals.map((one, index) => (
                <p key={`arrive-${index}`} className="rule-said">
                  On arrival: {one}
                </p>
              ))}
              {systemic.choices.map((one, index) => (
                <div key={`choice-${index}`}>
                  <strong>{one.text}</strong>
                  <p className="rule-said">{one.says}</p>
                </div>
              ))}
              {systemic.objectives.map((one) => (
                <p key={one.objective.id as string} className="rule-said">
                  {one.says}
                </p>
              ))}
              {systemic.completion ? <p className="small">Complete when: {systemic.completion}</p> : null}
            </div>
          ) : null}

          {heading('presentation')}
          {open.presentation ? (
            <div className="scene-layer">
              {PRESENTATION_FIELDS.map((field) => (
                <label key={field.key} className="field">
                  <span>{field.label}</span>
                  <input
                    value={stored.presentation[field.key]}
                    placeholder={field.hint}
                    onChange={(event) =>
                      onUpdate((current) => updatePresentation(current, scene, { [field.key]: event.target.value }))
                    }
                  />
                </label>
              ))}
              {visuals.length > 0 ? (
                <>
                  <p className="muted small">What the beats already say is seen:</p>
                  {visuals.map((one, index) => (
                    <p key={`visual-${index}`} className="small">
                      <strong>{one.beat}:</strong> {one.visual}
                    </p>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
