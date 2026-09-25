import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { orderKeyBetween } from './ordering.js';
import { isInteractive } from './formats.js';
import {
  choiceSchema,
  emptyConditions,
  narrativeElementSchema,
  resourceDefinitionSchema,
  stateDefinitionSchema,
  type Choice,
  type ConditionGroup,
  type Effect,
  type NarrativeElement,
  type NarrativeKind,
  type ResourceDefinition,
  type ResourceKind,
  type StateDefinition,
  type StateKind,
} from './entities/narrative.js';
import { emptyGameSetup, gameSetupSchema, type GameSetup } from './entities/game.js';
import type {
  BeatId,
  ChoiceId,
  NarrativeElementId,
  ResourceDefinitionId,
  StateDefinitionId,
} from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * Interactive Narrative: the graph (addendum 18, stage 1).
 *
 * Reading and writing only. **Nothing here evaluates a rule** — that is stage
 * 2's one `evaluate`, read by the simulator, the map and the validator alike,
 * and keeping it out of this file is how there comes to be exactly one of it.
 *
 * The shapes are in `entities/narrative.ts` and the argument behind them is
 * §2 of the addendum: a choice is not an edge.
 */

const touch = (file: ProjectFile): ProjectFile => ({
  ...file,
  project: { ...file.project, updatedAt: nowIso() },
});

// ------------------------------------------------------------------ setup

/** Whether this project has a narrative graph at all. */
export const hasNarrative = (file: ProjectFile): boolean => isInteractive(file.project.format);

/**
 * What the designer said the game is (§2).
 *
 * A project that has said nothing reads as the empty setup rather than null,
 * so every caller gets the same shape and none has to ask twice.
 */
export const gameSetupOf = (file: ProjectFile): GameSetup =>
  file.gameSetup ?? emptyGameSetup(file.project.createdAt);

export const setGameSetup = (file: ProjectFile, patch: Partial<GameSetup>): ProjectFile =>
  touch({
    ...file,
    gameSetup: gameSetupSchema.parse({ ...gameSetupOf(file), ...patch, updatedAt: nowIso() }),
  });

// --------------------------------------------------------------- elements

export const elementsOf = (file: ProjectFile): NarrativeElement[] => file.narrativeElements ?? [];

export const findElement = (file: ProjectFile, elementId: NarrativeElementId): NarrativeElement | null =>
  elementsOf(file).find((one) => one.id === elementId) ?? null;

/** Where the player may start (§4 of the addendum). */
export const entryPoints = (file: ProjectFile): NarrativeElement[] =>
  elementsOf(file).filter((one) => one.entry);

export const addElement = (
  file: ProjectFile,
  input: { name?: string; kind?: NarrativeKind; boundBeatId?: BeatId | null; entry?: boolean } = {},
): { file: ProjectFile; element: NarrativeElement } => {
  const at = nowIso();
  const element = narrativeElementSchema.parse({
    id: newId<NarrativeElementId>(),
    projectId: file.project.id,
    name: input.name ?? '',
    kind: input.kind ?? 'scene',
    boundBeatId: input.boundBeatId ?? null,
    // The first node a designer makes is where the game starts, unless they
    // say otherwise. A graph whose every node is unreachable because nobody
    // ticked a box is a bad first five minutes.
    entry: input.entry ?? elementsOf(file).length === 0,
    conditions: emptyConditions(),
    createdAt: at,
    updatedAt: at,
  });
  return { file: touch({ ...file, narrativeElements: [...elementsOf(file), element] }), element };
};

export const updateElement = (
  file: ProjectFile,
  elementId: NarrativeElementId,
  patch: Partial<Omit<NarrativeElement, 'id' | 'projectId' | 'createdAt'>>,
): ProjectFile => {
  if (!findElement(file, elementId)) return file;
  return touch({
    ...file,
    narrativeElements: elementsOf(file).map((one) =>
      one.id === elementId ? narrativeElementSchema.parse({ ...one, ...patch, updatedAt: nowIso() }) : one,
    ),
  });
};

/**
 * Take a node out, and every choice that was offered at it.
 *
 * A choice that led *here* is left alone with its destination cleared rather
 * than deleted: the designer wrote that choice, and silently removing it
 * because its destination went is the tool throwing work away. What it becomes
 * is a choice with effects and nowhere to go, which is legal (§2) and which
 * §12 will mention if it now has neither.
 */
export const removeElement = (file: ProjectFile, elementId: NarrativeElementId): ProjectFile =>
  touch({
    ...file,
    narrativeElements: elementsOf(file).filter((one) => one.id !== elementId),
    choices: choicesOf(file)
      .filter((choice) => choice.elementId !== elementId)
      .map((choice) =>
        choice.toElementId === elementId ? { ...choice, toElementId: null, updatedAt: nowIso() } : choice,
      ),
  });

// ---------------------------------------------------------------- choices

export const choicesOf = (file: ProjectFile): Choice[] => file.choices ?? [];

export const findChoice = (file: ProjectFile, choiceId: ChoiceId): Choice | null =>
  choicesOf(file).find((one) => one.id === choiceId) ?? null;

/** What is offered at a node, in the designer's order. */
export const choicesAt = (file: ProjectFile, elementId: NarrativeElementId): Choice[] =>
  choicesOf(file)
    .filter((one) => one.elementId === elementId)
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0));

/** Every choice that can put the player at this node — the edges in. */
export const choicesInto = (file: ProjectFile, elementId: NarrativeElementId): Choice[] =>
  choicesOf(file).filter((one) => one.toElementId === elementId);

export const addChoice = (
  file: ProjectFile,
  input: { elementId: NarrativeElementId; name?: string; text?: string; toElementId?: NarrativeElementId | null },
): { file: ProjectFile; choice: Choice } => {
  const at = nowIso();
  const siblings = choicesAt(file, input.elementId);
  const choice = choiceSchema.parse({
    id: newId<ChoiceId>(),
    elementId: input.elementId,
    name: input.name ?? '',
    text: input.text ?? '',
    orderKey: orderKeyBetween(siblings.at(-1)?.orderKey ?? null, null),
    conditions: emptyConditions(),
    toElementId: input.toElementId ?? null,
    createdAt: at,
    updatedAt: at,
  });
  return { file: touch({ ...file, choices: [...choicesOf(file), choice] }), choice };
};

export const updateChoice = (
  file: ProjectFile,
  choiceId: ChoiceId,
  patch: Partial<Omit<Choice, 'id' | 'elementId' | 'createdAt'>>,
): ProjectFile => {
  if (!findChoice(file, choiceId)) return file;
  return touch({
    ...file,
    choices: choicesOf(file).map((one) =>
      one.id === choiceId ? choiceSchema.parse({ ...one, ...patch, updatedAt: nowIso() }) : one,
    ),
  });
};

export const removeChoice = (file: ProjectFile, choiceId: ChoiceId): ProjectFile =>
  touch({ ...file, choices: choicesOf(file).filter((one) => one.id !== choiceId) });

// ------------------------------------------------------------------ state

export const statesOf = (file: ProjectFile): StateDefinition[] => file.stateDefinitions ?? [];

export const findState = (file: ProjectFile, stateId: StateDefinitionId): StateDefinition | null =>
  statesOf(file).find((one) => one.id === stateId) ?? null;

export const addState = (
  file: ProjectFile,
  input: { key?: string; kind?: StateKind; initial?: string; choices?: string[] } = {},
): { file: ProjectFile; state: StateDefinition } => {
  const at = nowIso();
  const state = stateDefinitionSchema.parse({
    id: newId<StateDefinitionId>(),
    projectId: file.project.id,
    key: input.key ?? '',
    kind: input.kind ?? 'flag',
    initial: input.initial ?? '',
    choices: input.choices ?? [],
    createdAt: at,
    updatedAt: at,
  });
  return { file: touch({ ...file, stateDefinitions: [...statesOf(file), state] }), state };
};

/**
 * Rename or retype a state.
 *
 * **Every rule follows, and nothing has to be touched**, because conditions
 * and effects hold the id (§6). This is the thing Twine cannot do and the
 * reason the id exists.
 */
export const updateState = (
  file: ProjectFile,
  stateId: StateDefinitionId,
  patch: Partial<Omit<StateDefinition, 'id' | 'projectId' | 'createdAt'>>,
): ProjectFile => {
  if (!findState(file, stateId)) return file;
  return touch({
    ...file,
    stateDefinitions: statesOf(file).map((one) =>
      one.id === stateId ? stateDefinitionSchema.parse({ ...one, ...patch, updatedAt: nowIso() }) : one,
    ),
  });
};

/**
 * Take a state away, and with it every rule that mentioned it.
 *
 * A condition whose subject has gone cannot be evaluated and cannot be
 * repaired by guessing, so it goes too — and an *effect* that wrote to it goes
 * with it for the same reason. This is the one place in the module where
 * deleting one record deletes part of another, which is why it is worth
 * saying: the alternative is a rule that silently stops meaning anything.
 */
export const removeState = (file: ProjectFile, stateId: StateDefinitionId): ProjectFile =>
  touch({
    ...file,
    stateDefinitions: statesOf(file).filter((one) => one.id !== stateId),
    narrativeElements: elementsOf(file).map((one) => ({
      ...one,
      conditions: withoutSubject(one.conditions, stateId as string),
      effects: one.effects.filter((effect) => effect.targetId !== (stateId as string)),
    })),
    choices: choicesOf(file).map((one) => ({
      ...one,
      conditions: withoutSubject(one.conditions, stateId as string),
      effects: one.effects.filter((effect) => effect.targetId !== (stateId as string)),
    })),
    // An objective's completion is a rule like any other (addendum 25 §3).
    objectives: (file.objectives ?? []).map((one) => ({
      ...one,
      complete: withoutSubject(one.complete, stateId as string),
    })),
    // …and so is a behaviour's *when* (addendum 25 §5).
    sceneLayers: (file.sceneLayers ?? []).map((layers) => ({
      ...layers,
      behaviours: layers.behaviours.map((one) => ({ ...one, conditions: withoutSubject(one.conditions, stateId as string) })),
      triggers: (layers.triggers ?? []).map((one) => ({
        ...one,
        conditions: withoutSubject(one.conditions, stateId as string),
        effects: one.effects.filter((effect) => effect.targetId !== (stateId as string)),
      })),
    })),
    // Verbs and puzzles are rules too (addendum 25 §7–§8).
    interactiveObjects: (file.interactiveObjects ?? []).map((object) => ({
      ...object,
      verbs: object.verbs.map((verb) => ({
        ...verb,
        conditions: withoutSubject(verb.conditions, stateId as string),
        effects: verb.effects.filter((effect) => effect.targetId !== (stateId as string)),
      })),
    })),
    puzzles: (file.puzzles ?? []).map((puzzle) => ({
      ...puzzle,
      solution: withoutSubject(puzzle.solution, stateId as string),
      onSolve: puzzle.onSolve.filter((effect) => effect.targetId !== (stateId as string)),
    })),
  });

/** A group with every mention of one subject taken out, at any depth. */
export const withoutSubject = (group: ConditionGroup, subjectId: string): ConditionGroup => ({
  join: group.join,
  conditions: group.conditions.filter((one) => one.subjectId !== subjectId),
  groups: group.groups.map((one) => withoutSubject(one, subjectId)),
});

// -------------------------------------------------------------- resources

export const resourcesOf = (file: ProjectFile): ResourceDefinition[] => file.resourceDefinitions ?? [];

export const findResource = (file: ProjectFile, resourceId: ResourceDefinitionId): ResourceDefinition | null =>
  resourcesOf(file).find((one) => one.id === resourceId) ?? null;

export const addResource = (
  file: ProjectFile,
  input: { name?: string; kind?: ResourceKind; initial?: number; capacity?: number; feeds?: ResourceDefinitionId[] } = {},
): { file: ProjectFile; resource: ResourceDefinition } => {
  const at = nowIso();
  const resource = resourceDefinitionSchema.parse({
    id: newId<ResourceDefinitionId>(),
    projectId: file.project.id,
    name: input.name ?? '',
    kind: input.kind ?? 'consumable',
    initial: input.initial ?? 0,
    capacity: input.capacity ?? 0,
    feeds: input.feeds ?? [],
    createdAt: at,
    updatedAt: at,
  });
  return { file: touch({ ...file, resourceDefinitions: [...resourcesOf(file), resource] }), resource };
};

export const updateResource = (
  file: ProjectFile,
  resourceId: ResourceDefinitionId,
  patch: Partial<Omit<ResourceDefinition, 'id' | 'projectId' | 'createdAt'>>,
): ProjectFile => {
  if (!findResource(file, resourceId)) return file;
  return touch({
    ...file,
    resourceDefinitions: resourcesOf(file).map((one) =>
      one.id === resourceId ? resourceDefinitionSchema.parse({ ...one, ...patch, updatedAt: nowIso() }) : one,
    ),
  });
};

/** As `removeState`, and for the same reason: a rule about nothing is worse. */
export const removeResource = (file: ProjectFile, resourceId: ResourceDefinitionId): ProjectFile =>
  touch({
    ...file,
    resourceDefinitions: resourcesOf(file)
      .filter((one) => one.id !== resourceId)
      .map((one) => ({ ...one, feeds: one.feeds.filter((fed) => fed !== resourceId) })),
    narrativeElements: elementsOf(file).map((one) => ({
      ...one,
      conditions: withoutSubject(one.conditions, resourceId as string),
      effects: one.effects.filter((effect) => effect.targetId !== (resourceId as string)),
    })),
    choices: choicesOf(file).map((one) => ({
      ...one,
      conditions: withoutSubject(one.conditions, resourceId as string),
      effects: one.effects.filter((effect) => effect.targetId !== (resourceId as string)),
    })),
    // An objective's completion is a rule like any other (addendum 25 §3).
    objectives: (file.objectives ?? []).map((one) => ({
      ...one,
      complete: withoutSubject(one.complete, resourceId as string),
    })),
    // …and so is a behaviour's *when* (addendum 25 §5).
    sceneLayers: (file.sceneLayers ?? []).map((layers) => ({
      ...layers,
      behaviours: layers.behaviours.map((one) => ({ ...one, conditions: withoutSubject(one.conditions, resourceId as string) })),
      triggers: (layers.triggers ?? []).map((one) => ({
        ...one,
        conditions: withoutSubject(one.conditions, resourceId as string),
        effects: one.effects.filter((effect) => effect.targetId !== (resourceId as string)),
      })),
    })),
    // Verbs and puzzles are rules too (addendum 25 §7–§8).
    interactiveObjects: (file.interactiveObjects ?? []).map((object) => ({
      ...object,
      verbs: object.verbs.map((verb) => ({
        ...verb,
        conditions: withoutSubject(verb.conditions, resourceId as string),
        effects: verb.effects.filter((effect) => effect.targetId !== (resourceId as string)),
      })),
    })),
    puzzles: (file.puzzles ?? []).map((puzzle) => ({
      ...puzzle,
      solution: withoutSubject(puzzle.solution, resourceId as string),
      onSolve: puzzle.onSolve.filter((effect) => effect.targetId !== (resourceId as string)),
    })),
  });

// ------------------------------------------------------------- the spine

/**
 * The nodes bound to the manuscript, in the manuscript's order (§3).
 *
 * **The spine is the story order**, so this reads it rather than keeping one:
 * moving a scene in the script moves the node along the spine, with nothing
 * run. A node bound to nothing is not on the spine and is not missing from it.
 */
export const spine = (file: ProjectFile, beatOrder: readonly BeatId[]): NarrativeElement[] => {
  const at = new Map(beatOrder.map((beatId, index) => [beatId as string, index]));
  return elementsOf(file)
    .filter((one) => one.boundBeatId !== null && at.has(one.boundBeatId as string))
    .sort((a, b) => at.get(a.boundBeatId as string)! - at.get(b.boundBeatId as string)!);
};

// ------------------------------------------------- reading rules for people

/** Every condition in a group, flattened — for counting and for §12. */
export const conditionsIn = (group: ConditionGroup): ConditionGroup['conditions'] => [
  ...group.conditions,
  ...group.groups.flatMap(conditionsIn),
];

/** Whether a group asks anything at all. An empty one is satisfied (§15.3). */
export const isEmptyGroup = (group: ConditionGroup): boolean => conditionsIn(group).length === 0;

/**
 * The node a scene-level rule is read as sitting at (addendum 25 §7–§8): the
 * first node bound to one of the scene's beats. A trigger, a puzzle and an
 * object placed in a scene have no node of their own, and the checks that ask
 * *where on the graph* a rule is need one. Null for a scene with no node —
 * nothing reaches it, and a rule there changes nothing yet.
 */
const hostInScene = (file: ProjectFile, unitId: string): NarrativeElement | null => {
  const beats = (file.beats ?? [])
    .filter((one) => one.unitId === unitId)
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0))
    .map((one) => one.id as string);
  return (
    elementsOf(file)
      .filter((one) => one.boundBeatId !== null && beats.includes(one.boundBeatId as string))
      .sort((a, b) => beats.indexOf(a.boundBeatId as string) - beats.indexOf(b.boundBeatId as string))[0] ?? null
  );
};

/** Where an object's verbs are read as sitting: a node it is placed at, or its scene's first node. */
const hostOfObject = (file: ProjectFile, placedAt: readonly string[]): NarrativeElement | null => {
  for (const id of placedAt) {
    const node = elementsOf(file).find((one) => (one.id as string) === id);
    if (node) return node;
    const inScene = hostInScene(file, id);
    if (inScene) return inScene;
  }
  return null;
};

/**
 * The rules that live off the graph but act on it (addendum 25 §7–§8) —
 * verbs, triggers, puzzle solutions — each with the node it is read at.
 */
const offGraphRules = (
  file: ProjectFile,
): { host: NarrativeElement; conditions: ConditionGroup; effects: readonly Effect[] }[] => {
  const out: { host: NarrativeElement; conditions: ConditionGroup; effects: readonly Effect[] }[] = [];
  for (const object of file.interactiveObjects ?? []) {
    const host = hostOfObject(file, object.placedAt);
    if (!host) continue;
    for (const verb of object.verbs) out.push({ host, conditions: verb.conditions, effects: verb.effects });
  }
  for (const layers of file.sceneLayers ?? []) {
    const host = hostInScene(file, layers.unitId as string);
    if (!host) continue;
    for (const trigger of layers.triggers ?? []) out.push({ host, conditions: trigger.conditions, effects: trigger.effects });
  }
  for (const puzzle of file.puzzles ?? []) {
    const host = puzzle.unitId ? hostInScene(file, puzzle.unitId as string) : null;
    if (!host) continue;
    out.push({
      host,
      conditions: puzzle.solution,
      effects: [{ kind: 'set', targetId: puzzle.solvedStateId as string, value: 'true', timing: 'immediate', note: '' }, ...puzzle.onSolve],
    });
  }
  return out;
};

/**
 * Every effect anywhere in the game, with what carried it. Verbs, triggers and
 * puzzles are carried by the node they are read at, so a key handed out by
 * pulling a lever is a key the game gives (addendum 25 §7).
 */
export const allEffects = (file: ProjectFile): { effect: Effect; from: NarrativeElement | Choice }[] => [
  ...elementsOf(file).flatMap((element) => element.effects.map((effect) => ({ effect, from: element }))),
  ...choicesOf(file).flatMap((choice) => choice.effects.map((effect) => ({ effect, from: choice }))),
  ...offGraphRules(file).flatMap((rule) => rule.effects.map((effect) => ({ effect, from: rule.host }))),
];

/** Every condition anywhere, with what it gates. */
export const allConditions = (
  file: ProjectFile,
): { condition: ConditionGroup['conditions'][number]; on: NarrativeElement | Choice }[] => [
  ...elementsOf(file).flatMap((element) =>
    conditionsIn(element.conditions).map((condition) => ({ condition, on: element })),
  ),
  ...choicesOf(file).flatMap((choice) => conditionsIn(choice.conditions).map((condition) => ({ condition, on: choice }))),
  ...offGraphRules(file).flatMap((rule) => conditionsIn(rule.conditions).map((condition) => ({ condition, on: rule.host }))),
];
