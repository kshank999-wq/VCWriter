import { nowIso } from './entities/common.js';
import { choicesAt, elementsOf, findElement, findResource, gameSetupOf, isEmptyGroup } from './narrative.js';
import { sayEffects, sayGroup, sayRuleLine } from './narrative-rules.js';
import { objectivesIn, sayObjective } from './narrative-objectives.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { castCalled } from './characters.js';
import { speakersIn } from './story-threads.js';
import { locationOfScene } from './locations.js';
import { living } from './graveyard.js';
import { newId } from './ids.js';
import {
  behaviourSchema,
  emptyConditions,
  presentationSchema,
  sceneLayersSchema,
  triggerSchema,
  type Behaviour,
  type Trigger,
  type Condition,
  type ConditionGroup,
  type NarrativeElement,
  type Objective,
  type Presentation,
  type SceneLayers,
} from './entities/narrative.js';
import type { Character } from './entities/character.js';
import type { Location } from './entities/locations.js';
import type { BehaviourId, CharacterId, SceneLayersId, StructuralUnitId, TriggerId } from './ids.js';
import { objectsOf, puzzlesIn } from './narrative-world.js';
import type { ProjectFile } from './project-file.js';

/**
 * A game scene's four layers, and its element board (addendum 25 §5).
 *
 * | Layer | Kept where |
 * | --- | --- |
 * | 1. Narrative | **read**: the unit, its cast from the cues, its place from the slugline, its nodes' gates |
 * | 2. Behavioural | **stored** here: what each character does, and when |
 * | 3. Systemic | **read**: its nodes' rules and its objectives |
 * | 4. Presentation | **stored** here, beside each beat's own `visual` |
 *
 * Two layers stored and two read is the whole design: what the scene already
 * says somewhere is never said twice, so renaming a character, moving a beat
 * or changing a rule shows here with nothing done to keep it in step.
 */

const touch = (file: ProjectFile): ProjectFile => ({
  ...file,
  project: { ...file.project, updatedAt: nowIso() },
});

// ------------------------------------------------------------ the store

const layersFor = (file: ProjectFile, unitId: StructuralUnitId): SceneLayers | null =>
  (file.sceneLayers ?? []).find((one) => one.unitId === unitId) ?? null;

/** A scene's stored layers, or empty ones where nothing is written yet. */
export const sceneLayersOf = (
  file: ProjectFile,
  unitId: StructuralUnitId,
): { behaviours: Behaviour[]; presentation: Presentation; triggers: Trigger[] } => {
  const found = layersFor(file, unitId);
  return {
    behaviours: found?.behaviours ?? [],
    triggers: found?.triggers ?? [],
    presentation: found?.presentation ?? presentationSchema.parse({}),
  };
};

/**
 * Change one scene's layers, making the record the first time anything is
 * written — a scene nobody has described stores nothing.
 */
const withLayers = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  change: (layers: SceneLayers) => SceneLayers,
): ProjectFile => {
  const at = nowIso();
  const existing = layersFor(file, unitId);
  const base =
    existing ??
    sceneLayersSchema.parse({
      id: newId<SceneLayersId>(),
      projectId: file.project.id,
      unitId,
      createdAt: at,
      updatedAt: at,
    });
  const next = { ...change(base), updatedAt: at };
  return touch({
    ...file,
    sceneLayers: existing
      ? (file.sceneLayers ?? []).map((one) => (one.id === existing.id ? next : one))
      : [...(file.sceneLayers ?? []), next],
  });
};

export const updatePresentation = (file: ProjectFile, unitId: StructuralUnitId, patch: Partial<Presentation>): ProjectFile =>
  withLayers(file, unitId, (layers) => ({ ...layers, presentation: presentationSchema.parse({ ...layers.presentation, ...patch }) }));

export const addBehaviour = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  input: { characterId?: CharacterId | null; kind?: string } = {},
): { file: ProjectFile; behaviour: Behaviour } => {
  const behaviour = behaviourSchema.parse({
    id: newId<BehaviourId>(),
    characterId: input.characterId ?? null,
    kind: input.kind ?? '',
    conditions: emptyConditions(),
  });
  return { file: withLayers(file, unitId, (layers) => ({ ...layers, behaviours: [...layers.behaviours, behaviour] })), behaviour };
};

export const updateBehaviour = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  behaviourId: BehaviourId,
  patch: Partial<Omit<Behaviour, 'id'>>,
): ProjectFile =>
  withLayers(file, unitId, (layers) => ({
    ...layers,
    behaviours: layers.behaviours.map((one) => (one.id === behaviourId ? behaviourSchema.parse({ ...one, ...patch }) : one)),
  }));

export const removeBehaviour = (file: ProjectFile, unitId: StructuralUnitId, behaviourId: BehaviourId): ProjectFile =>
  withLayers(file, unitId, (layers) => ({ ...layers, behaviours: layers.behaviours.filter((one) => one.id !== behaviourId) }));

export const addTrigger = (file: ProjectFile, unitId: StructuralUnitId, input: { name?: string; kind?: string } = {}): { file: ProjectFile; trigger: Trigger } => {
  const trigger = triggerSchema.parse({ id: newId<TriggerId>(), name: input.name ?? '', kind: input.kind ?? '' });
  return { file: withLayers(file, unitId, (layers) => ({ ...layers, triggers: [...(layers.triggers ?? []), trigger] })), trigger };
};

export const updateTrigger = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  triggerId: TriggerId,
  patch: Partial<Omit<Trigger, 'id'>>,
): ProjectFile =>
  withLayers(file, unitId, (layers) => ({
    ...layers,
    triggers: (layers.triggers ?? []).map((one) => (one.id === triggerId ? triggerSchema.parse({ ...one, ...patch }) : one)),
  }));

export const removeTrigger = (file: ProjectFile, unitId: StructuralUnitId, triggerId: TriggerId): ProjectFile =>
  withLayers(file, unitId, (layers) => ({ ...layers, triggers: (layers.triggers ?? []).filter((one) => one.id !== triggerId) }));

/** Trigger kinds offered, never enforced: what makes it fire is Game Studio's to build. */
export const TRIGGER_SUGGESTIONS = [
  'Proximity',
  'Overlap',
  'Line of sight',
  'Interact',
  'Timer',
  'State change',
  'Dialogue result',
  'Inventory',
  'Combat',
] as const;

/** Behaviour kinds offered, never enforced. */
export const BEHAVIOUR_SUGGESTIONS = [
  'Idle',
  'Patrol',
  'Follow',
  'Lead',
  'Guard',
  'Search',
  'Flee',
  'Assist',
  'Combat',
  'React',
  'Scripted',
] as const;

/** Every condition a behaviour reads, for the checks that ask what reads a state. */
export const behaviourConditions = (file: ProjectFile): { condition: Condition; on: Behaviour }[] => {
  const walk = (group: ConditionGroup): Condition[] => [...group.conditions, ...group.groups.flatMap(walk)];
  return (file.sceneLayers ?? []).flatMap((layers) =>
    layers.behaviours.flatMap((behaviour) => walk(behaviour.conditions).map((condition) => ({ condition, on: behaviour }))),
  );
};

// ------------------------------------------------------------- readings

/** The nodes bound to a scene's beats, in the scene's order. */
export const nodesInScene = (file: ProjectFile, unitId: StructuralUnitId): NarrativeElement[] => {
  const order = beatsForUnit(file, unitId).map((one) => one.id as string);
  return elementsOf(file)
    .filter((one) => one.boundBeatId !== null && order.includes(one.boundBeatId as string))
    .sort((a, b) => order.indexOf(a.boundBeatId as string) - order.indexOf(b.boundBeatId as string));
};

/** Who speaks in a scene, read off its cues: the working cast, each once. */
export const castInScene = (file: ProjectFile, unitId: StructuralUnitId): Character[] => {
  const seen = new Map<string, Character>();
  for (const beat of beatsForUnit(file, unitId)) {
    for (const cue of speakersIn(beat)) {
      for (const person of castCalled(file, cue)) seen.set(person.id as string, person);
    }
  }
  return [...seen.values()];
};

export interface NarrativeLayer {
  /** One-based place in the story order. */
  position: number;
  title: string;
  summary: string;
  place: Location | null;
  cast: Character[];
  nodes: NarrativeElement[];
  /** What must be true for the player to be here, per node, in words. */
  prerequisites: string[];
}

/** Layer 1, read. */
export const narrativeLayer = (file: ProjectFile, unitId: StructuralUnitId): NarrativeLayer | null => {
  const units = unitsInStoryOrder(file);
  const index = units.findIndex((one) => one.id === unitId);
  const unit = units[index];
  if (!unit) return null;
  const nodes = nodesInScene(file, unitId);
  return {
    position: index + 1,
    title: unit.title,
    summary: unit.summary,
    place: locationOfScene(file, unitId),
    cast: castInScene(file, unitId),
    nodes,
    prerequisites: nodes.filter((one) => !isEmptyGroup(one.conditions)).map((one) => sayGroup(file, one.conditions)),
  };
};

export interface SystemicLayer {
  /** Stored here: what fires in the scene, and what it does. */
  triggers: { trigger: Trigger; says: string }[];
  /** Read: the objects placed in the scene, and what can be done to them. */
  objects: { name: string; verbs: string[] }[];
  /** Read: the puzzles in the scene, and what solves them. */
  puzzles: { name: string; says: string }[];
  /** What arriving changes, per node. */
  arrivals: string[];
  /** What is offered, and the rule on each, in the rule builder's sentence. */
  choices: { text: string; says: string }[];
  objectives: { objective: Objective; says: string }[];
  /** The scene is complete when these are done; empty when nothing is asked. */
  completion: string;
}

/** Layer 3, read off the scene's nodes and objectives. */
export const systemicLayer = (file: ProjectFile, unitId: StructuralUnitId): SystemicLayer => {
  const nodes = nodesInScene(file, unitId);
  const objectives = objectivesIn(file, unitId);
  const mandatory = objectives.filter((one) => one.mandatory).map((one) => one.name.trim() || 'an unnamed objective');
  const nodeIds = new Set(nodes.map((one) => one.id as string));
  const placed = objectsOf(file).filter((one) => one.placedAt.some((id) => id === (unitId as string) || nodeIds.has(id)));
  return {
    triggers: sceneLayersOf(file, unitId).triggers.map((trigger) => {
      const when = sayGroup(file, trigger.conditions) || 'always';
      const does = trigger.effects.length ? sayEffects(file, trigger.effects) : 'nothing yet';
      return { trigger, says: `WHEN ${when} → DO ${does}${trigger.once ? ' (once)' : ''}` };
    }),
    objects: placed.map((object) => ({
      name: object.name.trim() || 'An unnamed object',
      verbs: object.verbs.map((verb) => {
        const when = sayGroup(file, verb.conditions);
        const does = verb.effects.length ? sayEffects(file, verb.effects) : 'nothing yet';
        return `${verb.name.trim() || 'Use'}${when ? ` when ${when}` : ''} → ${does}`;
      }),
    })),
    puzzles: puzzlesIn(file, unitId).map((puzzle) => ({
      name: puzzle.name.trim() || 'An unnamed puzzle',
      says: sayGroup(file, puzzle.solution) ? `solved when ${sayGroup(file, puzzle.solution)}` : 'no solution written yet',
    })),
    arrivals: nodes.filter((one) => one.effects.length > 0).map((one) => sayEffects(file, one.effects)),
    choices: nodes.flatMap((node) =>
      choicesAt(file, node.id).map((choice) => ({
        text: choice.text.trim() || choice.name.trim() || 'An unnamed choice',
        says: sayRuleLine(file, choice),
      })),
    ),
    objectives: objectives.map((objective) => ({ objective, says: sayObjective(file, objective) })),
    completion: mandatory.length === 0 ? '' : mandatory.join(', '),
  };
};

/** Layer 4's reading half: what each beat already says about how it looks. */
export const beatVisuals = (file: ProjectFile, unitId: StructuralUnitId): { beat: string; visual: string }[] =>
  beatsForUnit(file, unitId)
    .filter((one) => one.visual.trim().length > 0)
    .map((one) => ({ beat: one.title.trim() || 'An untitled beat', visual: one.visual.trim() }));

// ---------------------------------------------------------- the board

export type BoardCardKind = 'player' | 'character' | 'place' | 'resource' | 'object' | 'puzzle' | 'trigger' | 'objective' | 'exit';

export interface BoardCard {
  kind: BoardCardKind;
  /** The record the card is, where it is one. */
  id: string | null;
  name: string;
  /** What the scene does with it, read. */
  says: string;
}

const RESOURCE_ROLE_WORDS = { grant: 'given here', consume: 'used here', need: 'needed here' } as const;

/**
 * The scene as cards (spec §7): the player, who is in it, where it is, what
 * its rules give, take and ask for, what the player must do, and the ways
 * out. **Every card is a reading** and the board stores nothing — adding a
 * card means defining the thing in the Bible or writing the rule that uses it.
 */
export const sceneBoard = (file: ProjectFile, unitId: StructuralUnitId): BoardCard[] => {
  const layer = narrativeLayer(file, unitId);
  if (!layer) return [];
  const { behaviours } = sceneLayersOf(file, unitId);
  const cards: BoardCard[] = [];

  const role = gameSetupOf(file)?.playerRole.trim();
  cards.push({ kind: 'player', id: null, name: role || 'The player', says: 'plays the scene' });

  const people = new Map<string, Character>(layer.cast.map((one) => [one.id as string, one]));
  for (const behaviour of behaviours) {
    const person = behaviour.characterId ? file.characters.find((one) => one.id === behaviour.characterId) : undefined;
    if (person && living(person)) people.set(person.id as string, person);
  }
  for (const person of people.values()) {
    const speaks = layer.cast.some((one) => one.id === person.id);
    const does = behaviours.filter((one) => one.characterId === person.id).length;
    const parts = [speaks ? 'speaks' : 'does not speak'];
    if (does > 0) parts.push(`${does} behaviour${does === 1 ? '' : 's'}`);
    cards.push({ kind: 'character', id: person.id as string, name: person.name, says: parts.join(' · ') });
  }

  if (layer.place) cards.push({ kind: 'place', id: layer.place.id as string, name: layer.place.name, says: 'where it happens' });

  const roles = new Map<string, Set<keyof typeof RESOURCE_ROLE_WORDS>>();
  const note = (id: string, what: keyof typeof RESOURCE_ROLE_WORDS) => {
    if (!findResource(file, id as never)) return;
    roles.set(id, new Set([...(roles.get(id) ?? []), what]));
  };
  const needs = (group: ConditionGroup): void => {
    if (group.join === 'none') return;
    for (const one of group.conditions) if (one.subject === 'resource') note(one.subjectId, 'need');
    group.groups.forEach(needs);
  };
  for (const node of layer.nodes) {
    needs(node.conditions);
    for (const effect of node.effects) {
      if (effect.kind === 'grant') note(effect.targetId, 'grant');
      if (effect.kind === 'consume') note(effect.targetId, 'consume');
    }
    for (const choice of choicesAt(file, node.id)) {
      needs(choice.conditions);
      for (const effect of choice.effects) {
        if (effect.kind === 'grant') note(effect.targetId, 'grant');
        if (effect.kind === 'consume') note(effect.targetId, 'consume');
      }
    }
  }
  for (const [id, what] of roles) {
    cards.push({
      kind: 'resource',
      id,
      name: findResource(file, id as never)?.name.trim() || 'An unnamed resource',
      says: (['need', 'grant', 'consume'] as const).filter((one) => what.has(one)).map((one) => RESOURCE_ROLE_WORDS[one]).join(' · '),
    });
  }

  const nodeIds = new Set(layer.nodes.map((one) => one.id as string));
  for (const object of objectsOf(file)) {
    if (!object.placedAt.some((id) => id === (unitId as string) || nodeIds.has(id))) continue;
    const verbs = object.verbs.map((one) => one.name.trim()).filter((one) => one.length > 0);
    cards.push({
      kind: 'object',
      id: object.id as string,
      name: object.name.trim() || 'An unnamed object',
      says: verbs.length ? verbs.join(' · ') : 'nothing to do to it yet',
    });
  }
  for (const puzzle of puzzlesIn(file, unitId)) {
    cards.push({
      kind: 'puzzle',
      id: puzzle.id as string,
      name: puzzle.name.trim() || 'An unnamed puzzle',
      says: puzzle.objective.trim() || 'to be solved here',
    });
  }
  for (const trigger of sceneLayersOf(file, unitId).triggers) {
    cards.push({
      kind: 'trigger',
      id: trigger.id as string,
      name: trigger.name.trim() || 'An unnamed trigger',
      says: trigger.kind.trim() ? `${trigger.kind.trim()}${trigger.once ? ', once' : ''}` : trigger.once ? 'fires once' : 'fires whenever it holds',
    });
  }

  for (const objective of objectivesIn(file, unitId)) {
    cards.push({
      kind: 'objective',
      id: objective.id as string,
      name: objective.name.trim() || 'An unnamed objective',
      says: objective.mandatory ? 'the scene needs it' : 'optional',
    });
  }

  // The ways out: a choice here that leads to a node that is not in this scene.
  const here = new Set(layer.nodes.map((one) => one.id as string));
  for (const node of layer.nodes) {
    for (const choice of choicesAt(file, node.id)) {
      if (!choice.toElementId || here.has(choice.toElementId as string)) continue;
      const to = findElement(file, choice.toElementId);
      cards.push({
        kind: 'exit',
        id: choice.id as string,
        name: choice.text.trim() || choice.name.trim() || 'An unnamed choice',
        says: `to ${to?.name.trim() || 'an untitled node'}`,
      });
    }
  }
  return cards;
};
