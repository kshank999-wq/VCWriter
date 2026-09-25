import { useState, type ReactNode } from 'react';
import {
  addElement,
  choicesAt,
  describeFindings,
  elementsOf,
  findingsAt,
  implementationCounts,
  implementationOverview,
  IMPLEMENTATION_WORDS,
  narrativeFindings,
  sayRuleLine,
  updateElement,
  type BeatId,
  type ConditionGroup,
  type Effect,
  type ImplementationStatus,
  type ProjectFile,
} from '@vcwriter/domain';
import { ConditionGroupEditor, EffectList, RuleSentence } from './RuleBuilder';
import { NarrativeWorldPanel } from './NarrativeWorldPanel';
import { NarrativePlayPanel } from './NarrativePlayPanel';
import { NarrativeEndingsPanel } from './NarrativeEndingsPanel';

/**
 * The far column on a game (addendum 25 §4.2): the Inspector with a vertical
 * menu down its edge, each entry opening in place.
 *
 * Not a new chrome and not a new section: it is the Inspector, and on every
 * other format it is exactly what it was. On a game the writer is writing a
 * beat in the script and wants, beside it, the rule that beat's node carries,
 * what the player carries, the simulator, the checks, the endings — so those
 * are here, one press away, without the map having to be open. A room on the
 * other monitor must not be able to do less than the panel it came out of,
 * and the reverse holds too: every one of these is the same component the
 * Story Map uses.
 */

type GamePanel = 'beat' | 'rules' | 'world' | 'play' | 'checks' | 'endings' | 'built';

const PANELS: { panel: GamePanel; label: string; title: string }[] = [
  { panel: 'beat', label: 'Beat', title: 'The beat, its scene and its track' },
  { panel: 'rules', label: 'Rules', title: "The rule on this beat's node: what must be true here, what arriving changes, what is offered" },
  { panel: 'world', label: 'World', title: 'The states and resources every rule asks about' },
  { panel: 'play', label: 'Play', title: 'Walk the game as a player' },
  { panel: 'checks', label: 'Checks', title: 'What the checks say about the game' },
  { panel: 'endings', label: 'Endings', title: 'What decides each ending' },
  { panel: 'built', label: 'Built', title: 'How much of the game VC Game Studio has built' },
];

export function GameInspector({
  file,
  selectedBeatId,
  onUpdate,
  beatPanel,
}: {
  file: ProjectFile;
  selectedBeatId: BeatId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** What the Inspector shows on every other format: the beat's properties. */
  beatPanel: ReactNode;
}) {
  const [panel, setPanel] = useState<GamePanel>('beat');
  const findings = narrativeFindings(file).length;
  const back = () => setPanel('beat');

  return (
    <div className="game-inspector">
      <div className="game-inspector-panel">
        {panel === 'beat' ? (
          beatPanel
        ) : panel === 'rules' ? (
          <BeatRules file={file} beatId={selectedBeatId} onUpdate={onUpdate} />
        ) : panel === 'world' ? (
          <NarrativeWorldPanel file={file} onUpdate={onUpdate} onClose={back} />
        ) : panel === 'play' ? (
          <NarrativePlayPanel file={file} onUpdate={onUpdate} onClose={back} />
        ) : panel === 'checks' ? (
          <Checks file={file} beatId={selectedBeatId} />
        ) : panel === 'endings' ? (
          <NarrativeEndingsPanel file={file} onClose={back} />
        ) : (
          <Built file={file} />
        )}
      </div>
      <nav className="game-rail" aria-label="Game panels">
        {PANELS.map((one) => (
          <button
            key={one.panel}
            type="button"
            className={panel === one.panel ? 'game-rail-button on' : 'game-rail-button'}
            aria-pressed={panel === one.panel}
            title={one.title}
            onClick={() => setPanel(one.panel)}
          >
            <span>{one.label}</span>
            {one.panel === 'checks' && findings > 0 ? <span className="game-rail-count">{findings}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * The rule on the node this beat **is** (addendum 18 §3: the spine is the
 * manuscript). A beat with no node yet gets one on request, because binding
 * is an offer and never a requirement.
 */
function BeatRules({
  file,
  beatId,
  onUpdate,
}: {
  file: ProjectFile;
  beatId: BeatId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  if (!beatId) {
    return <p className="muted empty-state">Select a beat to see the rule on it.</p>;
  }
  const beat = file.beats.find((one) => one.id === beatId);
  const node = elementsOf(file).find((one) => one.boundBeatId === beatId) ?? null;
  if (!node) {
    return (
      <section className="game-inspector-section">
        <h3>Rules</h3>
        <p className="muted small">This beat is not on the Story Map yet, so nothing decides whether the player gets here.</p>
        <button
          type="button"
          className="tool"
          onClick={() =>
            onUpdate(
              (current) => addElement(current, { name: beat?.title.trim() || '', kind: 'scene', boundBeatId: beatId }).file,
            )
          }
        >
          Put this beat on the Story Map
        </button>
      </section>
    );
  }
  const offered = choicesAt(file, node.id);
  return (
    <section className="game-inspector-section">
      <h3>{node.name.trim() || 'Untitled node'}</h3>
      <h4>Being here</h4>
      <ConditionGroupEditor
        file={file}
        group={node.conditions}
        onChange={(next: ConditionGroup) => onUpdate((current) => updateElement(current, node.id, { conditions: next }))}
      />
      <RuleSentence file={file} group={node.conditions} empty="Anybody who gets here may be here." />
      <h4>On arrival</h4>
      <EffectList
        file={file}
        effects={node.effects}
        onChange={(next: Effect[]) => onUpdate((current) => updateElement(current, node.id, { effects: next }))}
      />
      <h4>Choices</h4>
      {offered.length === 0 ? (
        <p className="muted small">Nothing is offered here yet. Choices are written on the Story Map.</p>
      ) : (
        <ul className="game-inspector-list">
          {offered.map((choice) => (
            <li key={choice.id as string}>
              <strong>{choice.text.trim() || choice.name.trim() || 'An unnamed choice'}</strong>
              <p className="rule-said">{sayRuleLine(file, choice)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Stage 3's findings: this beat's node's first, then everything else. */
function Checks({ file, beatId }: { file: ProjectFile; beatId: BeatId | null }) {
  const all = narrativeFindings(file);
  const node = beatId ? elementsOf(file).find((one) => one.boundBeatId === beatId) ?? null : null;
  const here = node ? findingsAt(file, node.id) : [];
  const rest = all.filter((one) => !here.some((mine) => mine.says === one.says));
  return (
    <section className="game-inspector-section">
      <h3>Checks</h3>
      {/* Said out loud when it is happy: an empty box looks broken. */}
      <p className="muted small">{describeFindings(all)}</p>
      {here.length > 0 ? (
        <>
          <h4>On this beat</h4>
          <ul className="game-inspector-list findings">
            {here.map((one, index) => (
              <li key={`here-${index}`}>{one.says}</li>
            ))}
          </ul>
        </>
      ) : null}
      {rest.length > 0 ? (
        <>
          <h4>{here.length > 0 ? 'Elsewhere' : 'In the game'}</h4>
          <ul className="game-inspector-list findings">
            {rest.map((one, index) => (
              <li key={`rest-${index}`}>{one.says}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

const STATUS_ORDER: ImplementationStatus[] = ['conflict', 'needs_update', 'partial', 'implemented', 'unbound'];

/**
 * Game Studio's reading (addendum 25 §1–§2), shown and never changed here:
 * greyed rather than absent, because on a game it applies and simply cannot
 * be done in VC Writer.
 */
function Built({ file }: { file: ProjectFile }) {
  const counts = implementationCounts(file);
  const names = new Map<string, string>([
    ...elementsOf(file).map((one) => [one.id as string, one.name] as const),
    ...file.choices.map((one) => [one.id as string, one.text || one.name] as const),
    ...file.resourceDefinitions.map((one) => [one.id as string, one.name] as const),
    ...file.stateDefinitions.map((one) => [one.id as string, one.key] as const),
  ]);
  const worth = implementationOverview(file).filter((one) => one.status !== 'unbound');
  worth.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  return (
    <section className="game-inspector-section">
      <h3>Built</h3>
      <p className="muted small">Binding the game to an engine happens in VC Game Studio. What it has built shows here.</p>
      <ul className="game-inspector-list">
        {STATUS_ORDER.map((status) => (
          <li key={status} className="game-built-row">
            <span>{IMPLEMENTATION_WORDS[status]}</span>
            <span className="count muted">{counts[status]}</span>
          </li>
        ))}
      </ul>
      {worth.length > 0 ? (
        <ul className="game-inspector-list">
          {worth.map((one) => (
            <li key={`${one.sourceType}:${one.sourceId}`}>
              <strong>{names.get(one.sourceId)?.trim() || 'Something no longer in the game'}</strong>
              <span className="muted small"> — {IMPLEMENTATION_WORDS[one.status]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
