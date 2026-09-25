import { useState } from 'react';
import {
  addComponent,
  addMechanic,
  addObject,
  addPuzzle,
  addVerb,
  findObject,
  findPuzzle,
  locationsInOrder,
  MECHANIC_SUGGESTIONS,
  mechanicsOf,
  ownerOfState,
  placeObject,
  removeComponent,
  removeMechanic,
  removeObject,
  removePuzzle,
  removeVerb,
  setObjectStates,
  updateComponent,
  updateMechanic,
  updateObject,
  updatePuzzle,
  updateVerb,
  type ConditionGroup,
  type Effect,
  type InteractiveObjectId,
  type LocationId,
  type PuzzleId,
  type StructuralUnitId,
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
import { ConditionGroupEditor, EffectList, RuleSentence } from './RuleBuilder';

/**
 * One of the Game Bible's own sections (addendum 25 §4.1): the cards down the
 * middle, the selected one on the right — Research's shape, because on a game
 * this *is* Research.
 *
 * It edits through the same domain functions as the world panel beside the
 * Story Map, so the two screens cannot disagree about a thing: they are two
 * windows onto one record. Every card's *used* is read off the rules.
 */

const ADD_WORDS: Record<BibleSection, string | null> = {
  resources: '+ Item',
  states: '+ State',
  objects: '+ Object',
  puzzles: '+ Puzzle',
  // Places are made in Locations; the Bible gives them their mechanics.
  environments: null,
  quests: '+ Quest',
};

const EMPTY_WORDS: Record<BibleSection, string> = {
  resources:
    'Nothing yet. Weapons, keys, ammunition, currency and abilities are all items: + Item makes one, and the rules can then give it, take it and ask for it.',
  states:
    'Nothing yet. A state is something the story remembers — trust_mara, guard_spared. + State makes one for the rules to set and read.',
  objects:
    'Nothing yet. A lever, a door, a collapsing ledge: + Object makes one, with states it can be in and things the player can do to it.',
  puzzles: 'Nothing yet. + Puzzle makes one: what the player is trying to do, its parts, and the condition that solves it.',
  environments: 'No places yet. Places come from Locations; each one can carry mechanics here — darkness, a crawl, rising water.',
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
          : section === 'objects'
            ? addObject(current).file
            : section === 'puzzles'
              ? addPuzzle(current).file
              : section === 'quests'
                ? addQuest(current, { name: '' }).file
                : current,
    );
  };

  return (
    <div className="bible-section">
      <div className="bible-cards-column">
        {ADD_WORDS[section] ? (
          <div className="bible-actions">
            <button type="button" className="tool" onClick={add}>
              {ADD_WORDS[section]}
            </button>
          </div>
        ) : null}
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
        ) : section === 'objects' ? (
          <ObjectDetail file={file} objectId={picked.id as InteractiveObjectId} onUpdate={onUpdate} />
        ) : section === 'puzzles' ? (
          <PuzzleDetail file={file} puzzleId={picked.id as PuzzleId} onUpdate={onUpdate} />
        ) : section === 'environments' ? (
          <EnvironmentDetail file={file} locationId={picked.id as LocationId} onUpdate={onUpdate} />
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
  // An object's state and a puzzle's flag are theirs: named with them and
  // removed with them, so here they are read, not edited.
  const owner = ownerOfState(file, stateId);
  if (owner) {
    return (
      <div className="bible-fields">
        <h4>{state.key}</h4>
        <p className="small">
          {owner.kind === 'object'
            ? `The state of ${owner.name.trim() || 'an unnamed object'}: ${state.choices.join(', ') || 'no states yet'}, starting ${state.initial || 'unset'}.`
            : `Whether ${owner.name.trim() || 'an unnamed puzzle'} is solved. Set the moment its solution holds.`}
        </p>
        <p className="muted small">
          It belongs to the {owner.kind}: it is named with it and removed with it. Change it under{' '}
          {owner.kind === 'object' ? 'Interactive objects' : 'Puzzles'}.
        </p>
      </div>
    );
  }
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

/** The scenes in story order, for placing an object and siting a puzzle. */
const scenesOf = (file: ProjectFile) =>
  unitsInStoryOrder(file).map((unit, index) => ({
    id: unit.id,
    label: `Scene ${index + 1}${unit.title.trim() ? ` · ${unit.title.trim()}` : ''}`,
  }));

function ObjectDetail({
  file,
  objectId,
  onUpdate,
}: {
  file: ProjectFile;
  objectId: InteractiveObjectId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const object = findObject(file, objectId);
  const [statesText, setStatesText] = useState<string | null>(null);
  if (!object) return null;
  const owned = statesOf(file).find((one) => one.id === object.stateId);
  const states = owned?.choices ?? [];
  return (
    <div className="bible-fields">
      <label className="field">
        <span>Name</span>
        <input
          value={object.name}
          placeholder="Rusted Lever"
          onChange={(event) => onUpdate((current) => updateObject(current, objectId, { name: event.target.value }))}
        />
      </label>
      <label className="field">
        <span>What it is</span>
        <textarea value={object.note} onChange={(event) => onUpdate((current) => updateObject(current, objectId, { note: event.target.value }))} />
      </label>
      <label className="field">
        <span>Its states, separated by commas</span>
        <input
          value={statesText ?? states.join(', ')}
          placeholder="down, up"
          onChange={(event) => setStatesText(event.target.value)}
          onBlur={() => {
            if (statesText === null) return;
            onUpdate((current) => setObjectStates(current, objectId, statesText.split(',')));
            setStatesText(null);
          }}
        />
      </label>
      <label className="field">
        <span>Starts</span>
        <select
          value={owned?.initial ?? ''}
          onChange={(event) => onUpdate((current) => setObjectStates(current, objectId, states, event.target.value))}
        >
          {states.map((one) => (
            <option key={one} value={one}>
              {one}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">Rules ask about it as {owned?.key || 'its state'}.</p>

      <h4>Where it is</h4>
      <ul className="bible-checks">
        {scenesOf(file).map((scene) => (
          <li key={scene.id as string}>
            <label>
              <input
                type="checkbox"
                checked={object.placedAt.includes(scene.id as string)}
                onChange={(event) => onUpdate((current) => placeObject(current, objectId, scene.id as string, event.target.checked))}
              />
              <span>{scene.label}</span>
            </label>
          </li>
        ))}
      </ul>

      <h4>What the player can do to it</h4>
      {object.verbs.length === 0 ? <p className="muted small">Nothing yet. + Verb adds one: pull, open, light.</p> : null}
      {object.verbs.map((verb) => (
        <div key={verb.id as string} className="bible-verb">
          <div className="rule-row">
            <input
              value={verb.name}
              placeholder="Pull"
              aria-label="The verb"
              onChange={(event) => onUpdate((current) => updateVerb(current, objectId, verb.id, { name: event.target.value }))}
            />
            <button
              type="button"
              className="ghost small"
              aria-label={`Remove ${verb.name || 'this verb'}`}
              onClick={() => onUpdate((current) => removeVerb(current, objectId, verb.id))}
            >
              ✕
            </button>
          </div>
          <span className="muted small">WHEN</span>
          <ConditionGroupEditor
            file={file}
            group={verb.conditions}
            onChange={(next: ConditionGroup) => onUpdate((current) => updateVerb(current, objectId, verb.id, { conditions: next }))}
          />
          <RuleSentence file={file} group={verb.conditions} empty="Whenever the player is there." />
          <span className="muted small">DO</span>
          <EffectList
            file={file}
            effects={verb.effects}
            onChange={(next: Effect[]) => onUpdate((current) => updateVerb(current, objectId, verb.id, { effects: next }))}
          />
        </div>
      ))}
      <button type="button" className="tool" onClick={() => onUpdate((current) => addVerb(current, objectId).file)}>
        + Verb
      </button>
      <button
        type="button"
        className="ghost small bible-remove"
        title="Remove it, its state, and every rule that asks about its state"
        onClick={() => onUpdate((current) => removeObject(current, objectId))}
      >
        Remove this object and the rules about it
      </button>
    </div>
  );
}

function PuzzleDetail({
  file,
  puzzleId,
  onUpdate,
}: {
  file: ProjectFile;
  puzzleId: PuzzleId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const puzzle = findPuzzle(file, puzzleId);
  if (!puzzle) return null;
  const set = (patch: Parameters<typeof updatePuzzle>[2]) => onUpdate((current) => updatePuzzle(current, puzzleId, patch));
  const flag = statesOf(file).find((one) => one.id === puzzle.solvedStateId);
  return (
    <div className="bible-fields">
      <label className="field">
        <span>Name</span>
        <input value={puzzle.name} placeholder="The Vault Door" onChange={(event) => set({ name: event.target.value })} />
      </label>
      <label className="field">
        <span>What the player is trying to do</span>
        <input
          value={puzzle.objective}
          placeholder="Drain the seam, then turn the key"
          onChange={(event) => set({ objective: event.target.value })}
        />
      </label>
      <label className="field">
        <span>Scene</span>
        <select
          value={(puzzle.unitId as string) ?? ''}
          onChange={(event) => set({ unitId: (event.target.value || null) as StructuralUnitId | null })}
        >
          <option value="">Not in a scene yet</option>
          {scenesOf(file).map((scene) => (
            <option key={scene.id as string} value={scene.id as string}>
              {scene.label}
            </option>
          ))}
        </select>
      </label>

      <h4>Its parts</h4>
      {puzzle.components.map((part) => (
        <div key={part.id as string} className="rule-row">
          <input
            value={part.name}
            placeholder="The lever"
            aria-label="A part of the puzzle"
            onChange={(event) => onUpdate((current) => updateComponent(current, puzzleId, part.id, { name: event.target.value }))}
          />
          <button
            type="button"
            className="ghost small"
            aria-label={`Remove ${part.name || 'this part'}`}
            onClick={() => onUpdate((current) => removeComponent(current, puzzleId, part.id))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="tool" onClick={() => onUpdate((current) => addComponent(current, puzzleId))}>
        + Part
      </button>

      <h4>Solved when</h4>
      <ConditionGroupEditor file={file} group={puzzle.solution} onChange={(next: ConditionGroup) => set({ solution: next })} />
      <RuleSentence file={file} group={puzzle.solution} empty="No solution written yet, so it is never checked." />
      <p className="muted small">Rules ask whether it is solved as {flag?.key || 'its flag'}.</p>

      <h4>Solving it</h4>
      <EffectList file={file} effects={puzzle.onSolve} onChange={(next: Effect[]) => set({ onSolve: next })} />

      <label className="field">
        <span>Hints, one to a line</span>
        <textarea
          value={puzzle.hints.join('\n')}
          placeholder={'The water is holding the door shut.\nListen for where the echo changes.'}
          onChange={(event) => set({ hints: event.target.value.split('\n') })}
        />
      </label>
      <label className="field">
        <span>Failing, and resetting</span>
        <input
          value={puzzle.failure}
          placeholder="Pulling it twice floods the chamber; the lever resets"
          onChange={(event) => set({ failure: event.target.value })}
        />
      </label>
      <button
        type="button"
        className="ghost small bible-remove"
        title="Remove it, its solved flag, and every rule that reads the flag"
        onClick={() => onUpdate((current) => removePuzzle(current, puzzleId))}
      >
        Remove this puzzle and the rules about it
      </button>
    </div>
  );
}

function EnvironmentDetail({
  file,
  locationId,
  onUpdate,
}: {
  file: ProjectFile;
  locationId: LocationId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const place = locationsInOrder(file, true).find((one) => one.id === locationId);
  if (!place) return null;
  const mechanics = mechanicsOf(file, locationId);
  return (
    <div className="bible-fields">
      <h4>{place.name}</h4>
      <p className="muted small">
        What the place does, for Game Studio to build. Nothing here is evaluated; where a mechanic has a rule — the lantern
        drains in the dark — write it as a trigger in the scene.
      </p>
      <datalist id="mechanic-kinds">
        {MECHANIC_SUGGESTIONS.map((one) => (
          <option key={one} value={one} />
        ))}
      </datalist>
      {mechanics.map((mechanic) => (
        <div key={mechanic.id as string} className="bible-verb">
          <div className="rule-row">
            <input
              list="mechanic-kinds"
              value={mechanic.kind}
              placeholder="Darkness"
              aria-label="The mechanic"
              onChange={(event) => onUpdate((current) => updateMechanic(current, locationId, mechanic.id, { kind: event.target.value }))}
            />
            <input
              value={mechanic.variant}
              placeholder="crawl, collapse, rising water"
              aria-label="What kind"
              onChange={(event) => onUpdate((current) => updateMechanic(current, locationId, mechanic.id, { variant: event.target.value }))}
            />
            <button
              type="button"
              className="ghost small"
              aria-label="Remove this mechanic"
              onClick={() => onUpdate((current) => removeMechanic(current, locationId, mechanic.id))}
            >
              ✕
            </button>
          </div>
          <textarea
            value={mechanic.note}
            placeholder="Narrow squeeze on the left branch; the player crouches"
            aria-label="The mechanic, in words"
            onChange={(event) => onUpdate((current) => updateMechanic(current, locationId, mechanic.id, { note: event.target.value }))}
          />
          <input
            value={mechanic.params}
            placeholder="visibility 2m · drain 1 oil a minute"
            aria-label="Settings for Game Studio"
            onChange={(event) => onUpdate((current) => updateMechanic(current, locationId, mechanic.id, { params: event.target.value }))}
          />
        </div>
      ))}
      <button type="button" className="tool" onClick={() => onUpdate((current) => addMechanic(current, locationId).file)}>
        + Mechanic
      </button>
    </div>
  );
}
