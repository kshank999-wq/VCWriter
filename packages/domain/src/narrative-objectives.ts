import { nowIso } from './entities/common.js';
import { orderKeyBetween } from './ordering.js';
import { choicesAt, elementsOf, findElement, findResource, isEmptyGroup } from './narrative.js';
import { meetsGroup } from './narrative-eval.js';
import { sayGroup } from './narrative-rules.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { newId } from './ids.js';
import {
  emptyConditions,
  objectiveSchema,
  questSchema,
  type Condition,
  type ConditionGroup,
  type Effect,
  type NarrativeElement,
  type Objective,
  type Quest,
} from './entities/narrative.js';
import type { PlayState } from './narrative-eval.js';
import type { ObjectiveId, QuestId, StructuralUnitId } from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * Objectives, quests and the Player Lane (addendum 25 §3).
 *
 * The lane under the spine says what the player must **do, learn, acquire,
 * overcome or decide** to get through each scene. Nearly all of that is
 * written down already, on the nodes bound to the scene and on their choices,
 * so the lane **reads** it rather than keeping a copy that would drift. The one
 * thing written nowhere else is an **objective**, and that is the only record
 * this module adds, with quests to string objectives together.
 *
 * Whether an objective is done, whether a scene is complete and how far a
 * quest has got are all readings of a player's state through the one
 * `meetsGroup` — nothing here evaluates anything for itself, and nothing
 * stores *done*.
 */

const touch = (file: ProjectFile): ProjectFile => ({
  ...file,
  project: { ...file.project, updatedAt: nowIso() },
});

const byOrder = <T extends { orderKey: string }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0));

// ------------------------------------------------------------ objectives

export const objectivesOf = (file: ProjectFile): Objective[] => byOrder(file.objectives ?? []);

export const findObjective = (file: ProjectFile, objectiveId: ObjectiveId): Objective | null =>
  objectivesOf(file).find((one) => one.id === objectiveId) ?? null;

/** The objectives under one scene on the lane, in order. */
export const objectivesIn = (file: ProjectFile, unitId: StructuralUnitId): Objective[] =>
  objectivesOf(file).filter((one) => one.unitId === unitId);

/**
 * Objectives under no scene that exists: never placed, or placed under a scene
 * since cut. Read rather than repaired, so cutting a scene loses nobody's
 * objective — it waits here to be put somewhere else.
 */
export const unplacedObjectives = (file: ProjectFile): Objective[] => {
  const units = new Set(file.units.map((one) => one.id as string));
  return objectivesOf(file).filter((one) => one.unitId === null || !units.has(one.unitId as string));
};

export const addObjective = (
  file: ProjectFile,
  input: { name?: string; unitId?: StructuralUnitId | null; questId?: QuestId | null; mandatory?: boolean } = {},
): { file: ProjectFile; objective: Objective } => {
  const at = nowIso();
  const objective = objectiveSchema.parse({
    id: newId<ObjectiveId>(),
    projectId: file.project.id,
    name: input.name ?? '',
    unitId: input.unitId ?? null,
    questId: input.questId ?? null,
    mandatory: input.mandatory ?? true,
    complete: emptyConditions(),
    orderKey: orderKeyBetween(objectivesOf(file).at(-1)?.orderKey ?? null, null),
    createdAt: at,
    updatedAt: at,
  });
  return { file: touch({ ...file, objectives: [...(file.objectives ?? []), objective] }), objective };
};

export const updateObjective = (
  file: ProjectFile,
  objectiveId: ObjectiveId,
  patch: Partial<Omit<Objective, 'id' | 'projectId' | 'createdAt'>>,
): ProjectFile => {
  if (!findObjective(file, objectiveId)) return file;
  return touch({
    ...file,
    objectives: (file.objectives ?? []).map((one) =>
      one.id === objectiveId ? objectiveSchema.parse({ ...one, ...patch, updatedAt: nowIso() }) : one,
    ),
  });
};

export const removeObjective = (file: ProjectFile, objectiveId: ObjectiveId): ProjectFile =>
  touch({ ...file, objectives: (file.objectives ?? []).filter((one) => one.id !== objectiveId) });

// ---------------------------------------------------------------- quests

export const questsOf = (file: ProjectFile): Quest[] => byOrder(file.quests ?? []);

export const findQuest = (file: ProjectFile, questId: QuestId): Quest | null =>
  questsOf(file).find((one) => one.id === questId) ?? null;

export const addQuest = (file: ProjectFile, input: { name?: string } = {}): { file: ProjectFile; quest: Quest } => {
  const at = nowIso();
  const quest = questSchema.parse({
    id: newId<QuestId>(),
    projectId: file.project.id,
    name: input.name ?? '',
    orderKey: orderKeyBetween(questsOf(file).at(-1)?.orderKey ?? null, null),
    createdAt: at,
    updatedAt: at,
  });
  return { file: touch({ ...file, quests: [...(file.quests ?? []), quest] }), quest };
};

export const updateQuest = (
  file: ProjectFile,
  questId: QuestId,
  patch: Partial<Omit<Quest, 'id' | 'projectId' | 'createdAt'>>,
): ProjectFile => {
  if (!findQuest(file, questId)) return file;
  return touch({
    ...file,
    quests: (file.quests ?? []).map((one) =>
      one.id === questId ? questSchema.parse({ ...one, ...patch, updatedAt: nowIso() }) : one,
    ),
  });
};

/**
 * Remove a quest and **keep its objectives**, no longer part of any quest. The
 * designer wrote those steps, and taking the string away should not throw the
 * beads away with it — the same reason deleting a node keeps the choices that
 * led to it (addendum 18 stage 1).
 */
export const removeQuest = (file: ProjectFile, questId: QuestId): ProjectFile =>
  touch({
    ...file,
    quests: (file.quests ?? []).filter((one) => one.id !== questId),
    objectives: (file.objectives ?? []).map((one) => (one.questId === questId ? { ...one, questId: null } : one)),
  });

/** A quest's steps: the objectives that name it, in order. */
export const questSteps = (file: ProjectFile, questId: QuestId): Objective[] =>
  objectivesOf(file).filter((one) => one.questId === questId);

// -------------------------------------------------------------- readings

/** Whether an objective is done, for a player holding this state. */
export const objectiveDone = (file: ProjectFile, state: PlayState, objective: Objective): boolean =>
  meetsGroup(file, state, objective.complete).ok;

/**
 * Whether a scene is complete (spec §9): every one of its mandatory objectives
 * done. A scene with none is complete — nothing was asked of the player.
 */
export const sceneCompletion = (
  file: ProjectFile,
  state: PlayState,
  unitId: StructuralUnitId,
): { complete: boolean; missing: Objective[] } => {
  const missing = objectivesIn(file, unitId).filter((one) => one.mandatory && !objectiveDone(file, state, one));
  return { complete: missing.length === 0, missing };
};

export interface QuestProgress {
  quest: Quest;
  steps: { objective: Objective; done: boolean }[];
  done: number;
  total: number;
  /** The first step not yet done, which is what a quest log shows. */
  next: Objective | null;
}

export const questProgress = (file: ProjectFile, state: PlayState, questId: QuestId): QuestProgress | null => {
  const quest = findQuest(file, questId);
  if (!quest) return null;
  const steps = questSteps(file, questId).map((objective) => ({ objective, done: objectiveDone(file, state, objective) }));
  return {
    quest,
    steps,
    done: steps.filter((one) => one.done).length,
    total: steps.length,
    next: steps.find((one) => !one.done)?.objective ?? null,
  };
};

/** An objective in one line: its name, and what makes it done. */
export const sayObjective = (file: ProjectFile, objective: Objective): string => {
  const name = objective.name.trim() || 'An unnamed objective';
  const when = sayGroup(file, objective.complete);
  return when ? `${name} — done when ${when}` : `${name} — done on arrival`;
};

/** Every condition an objective reads, for the checks that ask what reads a state. */
export const objectiveConditions = (file: ProjectFile): { condition: Condition; on: Objective }[] => {
  const walk = (group: ConditionGroup): Condition[] => [...group.conditions, ...group.groups.flatMap(walk)];
  return objectivesOf(file).flatMap((objective) => walk(objective.complete).map((condition) => ({ condition, on: objective })));
};

// ----------------------------------------------------------- the lane

/**
 * What one line under a scene on the Player Lane says.
 *
 * - **objective** — stored: what the player must do.
 * - **decide** — a node offering more than one choice.
 * - **need** — a resource a node or its choices ask for.
 * - **acquire** / **spend** — `grant` and `consume`, on arrival or on a choice.
 * - **learn** — `reveal`: something the player comes to know of.
 * - **overcome** — an encounter or a mission on the spine.
 */
export type LaneItemKind = 'objective' | 'decide' | 'need' | 'acquire' | 'spend' | 'learn' | 'overcome';

export interface LaneItem {
  kind: LaneItemKind;
  text: string;
  /** The objective, where the line is one. */
  objectiveId?: ObjectiveId;
  /** The node the line is read from, where it is read from one. */
  elementId?: NarrativeElement['id'];
  /** An objective the scene is not complete without. */
  mandatory?: boolean;
}

export interface LaneScene {
  unitId: StructuralUnitId;
  title: string;
  /** One-based, in the story order. */
  position: number;
  /** The nodes bound to the scene's beats, in the scene's order. */
  nodes: NarrativeElement[];
  items: LaneItem[];
}

export const LANE_WORDS: Record<LaneItemKind, string> = {
  objective: 'Do',
  decide: 'Decide',
  need: 'Needs',
  acquire: 'Gets',
  spend: 'Uses',
  learn: 'Learns',
  overcome: 'Overcomes',
};

const nameOfResource = (file: ProjectFile, id: string): string =>
  findResource(file, id as never)?.name.trim() || 'an unnamed resource';

/**
 * The Player Lane, scene by scene in the story order (addendum 25 §3).
 *
 * Read off the scene's objectives and the nodes bound to its beats. A branch
 * off the spine is not on the lane — the lane is what the player does *on the
 * way through*, and a branch is drawn above or below the spine where it is.
 * Each resource is said once per scene, however many rules mention it.
 */
export const playerLane = (file: ProjectFile): LaneScene[] =>
  unitsInStoryOrder(file).map((unit, index) => {
    const beats = new Set(beatsForUnit(file, unit.id).map((one) => one.id as string));
    const order = beatsForUnit(file, unit.id).map((one) => one.id as string);
    const nodes = elementsOf(file)
      .filter((one) => one.boundBeatId !== null && beats.has(one.boundBeatId as string))
      .sort((a, b) => order.indexOf(a.boundBeatId as string) - order.indexOf(b.boundBeatId as string));

    const items: LaneItem[] = objectivesIn(file, unit.id).map((objective) => ({
      kind: 'objective' as const,
      text: objective.name.trim() || 'An unnamed objective',
      objectiveId: objective.id,
      mandatory: objective.mandatory,
    }));

    const said = new Set<string>();
    const once = (key: string, item: LaneItem): void => {
      if (said.has(key)) return;
      said.add(key);
      items.push(item);
    };
    const fromEffects = (effects: readonly Effect[], element: NarrativeElement): void => {
      for (const effect of effects) {
        if (effect.kind === 'grant') {
          once(`acquire:${effect.targetId}`, { kind: 'acquire', text: nameOfResource(file, effect.targetId), elementId: element.id });
        } else if (effect.kind === 'consume') {
          once(`spend:${effect.targetId}`, { kind: 'spend', text: nameOfResource(file, effect.targetId), elementId: element.id });
        } else if (effect.kind === 'reveal') {
          const shown = findElement(file, effect.targetId as never);
          once(`learn:${effect.targetId}`, {
            kind: 'learn',
            text: shown?.name.trim() || 'something unnamed',
            elementId: element.id,
          });
        }
      }
    };
    const fromConditions = (group: ConditionGroup, element: NarrativeElement): void => {
      if (group.join === 'none') return;
      for (const condition of group.conditions) {
        if (condition.subject !== 'resource') continue;
        once(`need:${condition.subjectId}`, { kind: 'need', text: nameOfResource(file, condition.subjectId), elementId: element.id });
      }
      for (const nested of group.groups) fromConditions(nested, element);
    };

    for (const node of nodes) {
      const offered = choicesAt(file, node.id);
      if (offered.length > 1) {
        items.push({
          kind: 'decide',
          text: offered.map((one) => one.text.trim() || one.name.trim() || 'an unnamed choice').join(' / '),
          elementId: node.id,
        });
      }
      if (node.kind === 'encounter' || node.kind === 'mission') {
        once(`overcome:${node.id as string}`, { kind: 'overcome', text: node.name.trim() || 'an unnamed encounter', elementId: node.id });
      }
      if (!isEmptyGroup(node.conditions)) fromConditions(node.conditions, node);
      for (const choice of offered) fromConditions(choice.conditions, node);
      fromEffects(node.effects, node);
      for (const choice of offered) fromEffects(choice.effects, node);
    }

    const rank: Record<LaneItemKind, number> = { objective: 0, decide: 1, need: 2, acquire: 3, spend: 4, learn: 5, overcome: 6 };
    items.sort((a, b) => rank[a.kind] - rank[b.kind]);
    return { unitId: unit.id, title: unit.title, position: index + 1, nodes, items };
  });
