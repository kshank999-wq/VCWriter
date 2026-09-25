import { useState } from 'react';
import {
  addQuest,
  addResource,
  addState,
  bibleEntries,
  describeEntry,
  findQuest,
  findResource,
  questSteps,
  removeQuest,
  removeResource,
  removeState,
  sayObjective,
  statesOf,
  unitsInStoryOrder,
  unplacedObjectives,
  updateQuest,
  updateResource,
  updateState,
  type BibleSection,
  type ProjectFile,
  type QuestId,
  type ResourceDefinitionId,
  type ResourceKind,
  type StateDefinitionId,
  type StateKind,
} from '@vcwriter/domain';
import { Economy, RESOURCE_KINDS, RESOURCE_WORDS, STATE_KINDS, STATE_WORDS } from './NarrativeWorldPanel';

/**
 * One of the Game Bible's own sections (addendum 25 §4.1): the cards down the
 * middle, the selected one on the right — Research's shape, because on a game
 * this *is* Research.
 *
 * It edits through the same domain functions as the world panel beside the
 * Story Map, so the two screens cannot disagree about a thing: they are two
 * windows onto one record. Every card's *used* is read off the rules.
 */

const ADD_WORDS: Record<BibleSection, string> = {
  resources: '+ Item',
  states: '+ State',
  quests: '+ Quest',
};

const EMPTY_WORDS: Record<BibleSection, string> = {
  resources:
    'Nothing yet. Weapons, keys, ammunition, currency and abilities are all items: + Item makes one, and the rules can then give it, take it and ask for it.',
  states:
    'Nothing yet. A state is something the story remembers — trust_mara, guard_spared. + State makes one for the rules to set and read.',
  quests: 'No quests yet. A quest strings objectives together; + Quest makes one.',
};

export function GameBiblePanel({
  file,
  section,
  onUpdate,
}: {
  file: ProjectFile;
  section: BibleSection;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const entries = bibleEntries(file, section);
  const picked = entries.find((one) => one.id === chosen) ?? null;

  const add = (): void => {
    onUpdate((current) =>
      section === 'resources'
        ? addResource(current).file
        : section === 'states'
          ? addState(current).file
          : addQuest(current, { name: '' }).file,
    );
  };

  return (
    <div className="bible-section">
      <div className="bible-cards-column">
        <div className="bible-actions">
          <button type="button" className="tool" onClick={add}>
            {ADD_WORDS[section]}
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="muted empty-state">{EMPTY_WORDS[section]}</p>
        ) : (
          <ul className="bible-cards" aria-label="Cards">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={entry.id === chosen ? 'bible-card chosen' : 'bible-card'}
                  aria-pressed={entry.id === chosen}
                  onClick={() => setChosen(entry.id)}
                >
                  <span className="bible-card-name">{entry.name.trim() || 'Untitled'}</span>
                  <span className="bible-card-reads">{describeEntry(section, entry)}</span>
                  {/* Research's own marker for a note nothing has used. */}
                  <span className={entry.used ? 'bible-used used' : 'bible-used'}>
                    {entry.used ? 'Used' : 'Not yet used'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {section === 'quests' ? <LooseObjectives file={file} /> : null}
      </div>

      <aside className="research-detail bible-detail" aria-label="Detail">
        {!picked ? (
          <p className="muted empty-state">Pick something to see it here.</p>
        ) : section === 'resources' ? (
          <ResourceDetail file={file} resourceId={picked.id as ResourceDefinitionId} onUpdate={onUpdate} />
        ) : section === 'states' ? (
          <StateDetail file={file} stateId={picked.id as StateDefinitionId} onUpdate={onUpdate} />
        ) : (
          <QuestDetail file={file} questId={picked.id as QuestId} onUpdate={onUpdate} />
        )}
      </aside>
    </div>
  );
}

function ResourceDetail({
  file,
  resourceId,
  onUpdate,
}: {
  file: ProjectFile;
  resourceId: ResourceDefinitionId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const resource = findResource(file, resourceId);
  if (!resource) return null;
  const set = (patch: Parameters<typeof updateResource>[2]) =>
    onUpdate((current) => updateResource(current, resourceId, patch));
  const count = (value: string) => Math.max(0, Math.trunc(Number(value) || 0));
  return (
    <div className="bible-fields">
      <label className="field">
        <span>Name</span>
        <input value={resource.name} placeholder="Old Lantern" onChange={(event) => set({ name: event.target.value })} />
      </label>
      <label className="field">
        <span>Kind</span>
        <select value={resource.kind} onChange={(event) => set({ kind: event.target.value as ResourceKind })}>
          {RESOURCE_KINDS.map((one) => (
            <option key={one} value={one}>
              {RESOURCE_WORDS[one]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>What it is</span>
        <textarea value={resource.note} placeholder="Where it comes from, what it is for" onChange={(event) => set({ note: event.target.value })} />
      </label>
      <div className="bible-numbers">
        <label className="field">
          <span>Starts with</span>
          <input type="number" min={0} value={resource.initial} onChange={(event) => set({ initial: count(event.target.value) })} />
        </label>
        <label className="field">
          <span title="Zero for no ceiling">Most held</span>
          <input type="number" min={0} value={resource.capacity} onChange={(event) => set({ capacity: count(event.target.value) })} />
        </label>
        <label className="field">
          <span title="Where it belongs in the progression; zero for unranked">Tier</span>
          <input type="number" min={0} value={resource.tier} onChange={(event) => set({ tier: count(event.target.value) })} />
        </label>
      </div>
      <label className="field">
        <span>How much the player should have</span>
        <input
          value={resource.scarcityTarget}
          placeholder="about 30 rounds by the reactor"
          onChange={(event) => set({ scarcityTarget: event.target.value })}
        />
      </label>
      <h4>Where it comes and goes</h4>
      <Economy file={file} resourceId={resourceId} />
      <button
        type="button"
        className="ghost small bible-remove"
        title="Remove it, and every rule that mentions it"
        onClick={() => onUpdate((current) => removeResource(current, resourceId))}
      >
        Remove this item and the rules that mention it
      </button>
    </div>
  );
}

function StateDetail({
  file,
  stateId,
  onUpdate,
}: {
  file: ProjectFile;
  stateId: StateDefinitionId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const state = statesOf(file).find((one) => one.id === stateId);
  if (!state) return null;
  const set = (patch: Parameters<typeof updateState>[2]) => onUpdate((current) => updateState(current, stateId, patch));
  return (
    <div className="bible-fields">
      <label className="field">
        <span>Name</span>
        <input value={state.key} placeholder="trust_mara" onChange={(event) => set({ key: event.target.value })} />
      </label>
      <p className="muted small">Renaming it reaches every rule that reads it — a rule holds the state, not its name.</p>
      <label className="field">
        <span>Kind</span>
        <select value={state.kind} onChange={(event) => set({ kind: event.target.value as StateKind })}>
          {STATE_KINDS.map((one) => (
            <option key={one} value={one}>
              {STATE_WORDS[one]}
            </option>
          ))}
        </select>
      </label>
      {state.kind === 'enum' ? (
        <label className="field">
          <span>Its values, separated by commas</span>
          <input
            value={state.choices.join(', ')}
            placeholder="hostile, wary, friendly"
            onChange={(event) =>
              set({ choices: event.target.value.split(',').map((one) => one.trim()).filter((one) => one.length > 0) })
            }
          />
        </label>
      ) : null}
      <label className="field">
        <span>Starts as</span>
        <input value={state.initial} onChange={(event) => set({ initial: event.target.value })} />
      </label>
      <label className="field">
        <span>What it is for</span>
        <textarea value={state.note} onChange={(event) => set({ note: event.target.value })} />
      </label>
      <button
        type="button"
        className="ghost small bible-remove"
        title="Remove it, and every rule that mentions it"
        onClick={() => onUpdate((current) => removeState(current, stateId))}
      >
        Remove this state and the rules that mention it
      </button>
    </div>
  );
}

function QuestDetail({
  file,
  questId,
  onUpdate,
}: {
  file: ProjectFile;
  questId: QuestId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const quest = findQuest(file, questId);
  if (!quest) return null;
  const scenes = new Map(unitsInStoryOrder(file).map((unit, index) => [unit.id as string, { unit, index }]));
  const steps = questSteps(file, questId);
  return (
    <div className="bible-fields">
      <label className="field">
        <span>Name</span>
        <input
          value={quest.name}
          placeholder="The Lost Expedition"
          onChange={(event) => onUpdate((current) => updateQuest(current, questId, { name: event.target.value }))}
        />
      </label>
      <label className="field">
        <span>What it is about</span>
        <textarea value={quest.note} onChange={(event) => onUpdate((current) => updateQuest(current, questId, { note: event.target.value }))} />
      </label>
      <h4>Steps</h4>
      {steps.length === 0 ? (
        <p className="muted small">
          None yet. Objectives are written on their scene, on the Story Map&rsquo;s Player Lane; give one this quest and it
          appears here.
        </p>
      ) : (
        <ol className="narrmap-quest-steps">
          {steps.map((step) => {
            const at = step.unitId ? scenes.get(step.unitId as string) : undefined;
            return (
              <li key={step.id as string}>
                <span>
                  {sayObjective(file, step)}
                  <span className="muted small">
                    {' — '}
                    {at ? `scene ${at.index + 1}${at.unit.title.trim() ? ` · ${at.unit.title.trim()}` : ''}` : 'no scene'}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <button
        type="button"
        className="ghost small bible-remove"
        title="Remove the quest. Its objectives stay, in no quest."
        onClick={() => onUpdate((current) => removeQuest(current, questId))}
      >
        Remove this quest (its objectives stay)
      </button>
    </div>
  );
}

/** Objectives under no scene, waiting to be put somewhere. */
function LooseObjectives({ file }: { file: ProjectFile }) {
  const loose = unplacedObjectives(file);
  if (loose.length === 0) return null;
  return (
    <section className="bible-loose">
      <h4>Objectives not under a scene</h4>
      <ul className="narrmap-quest-steps">
        {loose.map((one) => (
          <li key={one.id as string} className="muted small">
            {sayObjective(file, one)}
          </li>
        ))}
      </ul>
    </section>
  );
}
