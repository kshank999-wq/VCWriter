import {
  allConditions,
  allEffects,
  choicesOf,
  elementsOf,
  findElement,
  findResource,
  resourcesOf,
} from './narrative.js';
import { depths, reachable, sayCondition } from './narrative-eval.js';
import type { Choice, Condition, NarrativeElement, ResourceDefinition } from './entities/narrative.js';
import type { NarrativeElementId, ResourceDefinitionId } from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * Interactive Narrative: progression (addendum 18, stage 6 — §7, §8).
 *
 * The audit again, and the sixth time it has paid: **§8 is already built.** It
 * asks that *gameplay resources participate in the same relationship graph as
 * narrative choices* — a weapon unlocking a tactical path, low ammunition
 * making an assault unavailable, a clue exposing a dialogue choice, spent
 * currency altering a later mission. Every one of those is a **condition whose
 * subject is a resource**, which stage 1 built and stages 2, 3 and 5 already
 * evaluate, check and edit. There is no resource edge to add, because a
 * resource was never a second kind of thing: it is one of the two subjects a
 * rule can be about.
 *
 * So what §8 needed was not a mechanism but a **reading**: a designer could
 * write *needs a keycard* in four places and had nowhere to see that the
 * keycard is given out in one and spent in two.
 *
 * And **§7 asks for eight tables of fields, nearly all of which are readings**.
 * *Acquisition points*, *sources*, *sinks*, *use points*, *prerequisites*,
 * *thresholds*, *what it unlocks*, *optional or required* — all of them are
 * questions about where in the graph the thing is granted, consumed or asked
 * about, so storing them would be storing a second answer that goes stale the
 * moment a choice moves. Three things are **not** readings and are therefore
 * the only fields stage 6 added: the **tier** a designer intends, the resource
 * an upgrade **replaces**, and the **scarcity target** they are aiming at.
 * Everything below is computed every time.
 */

// ---------------------------------------------------------------- the points

/** Somewhere a resource is handed over or spent. */
export interface EconomyPoint {
  /** The node it happens at — a choice's own node, where it is on a choice. */
  element: NarrativeElement;
  /** The choice that does it, or null where arriving does. */
  choice: Choice | null;
  /** How many, as written. */
  amount: string;
  /** How far from a start, or null where nothing reaches it. */
  step: number | null;
}

/** Somewhere a rule asks about a resource. */
export interface EconomyGate {
  element: NarrativeElement;
  choice: Choice | null;
  condition: Condition;
  says: string;
  step: number | null;
  /** The story does not work without this node (§2.3). */
  mandatory: boolean;
}

export interface ResourceEconomy {
  resource: ResourceDefinition;
  /** Every `grant`, earliest first. §7's *acquisition points*. */
  sources: EconomyPoint[];
  /** Every `consume`. §7's *sinks*, *consumption*, *use points*. */
  sinks: EconomyPoint[];
  /** Every rule that asks about it. §8's *dependencies*, read from the graph. */
  gates: EconomyGate[];
  /** Ammunition this weapon takes, and weapons this ammunition feeds. */
  feeds: ResourceDefinition[];
  fedBy: ResourceDefinition[];
  /** What this replaces, and what replaces it (§7's upgrades and variants). */
  replaces: ResourceDefinition | null;
  replacedBy: ResourceDefinition[];
  /**
   * The player can have some: it starts with them or something grants it.
   * **Read, never declared** — a resource nothing grants and nobody starts
   * with is a design that has not been finished, not a flag to tick.
   */
  obtainable: boolean;
  /**
   * §7's *optional or required* for a clue or a collectible, read rather than
   * asked for: something mandatory asks for it.
   */
  required: boolean;
}

/** The node a rule or an effect is *at*: a choice's own node, or the element. */
const whereOf = (from: NarrativeElement | Choice): NarrativeElementId =>
  'elementId' in from ? from.elementId : from.id;

const stepOf = (rank: ReadonlyMap<string, number>, elementId: string): number | null =>
  rank.get(elementId) ?? null;

const byStep = (a: { step: number | null }, b: { step: number | null }): number => {
  if (a.step === null && b.step === null) return 0;
  if (a.step === null) return 1;
  if (b.step === null) return -1;
  return a.step - b.step;
};

/**
 * Everything the graph says about one resource (§7, §8).
 *
 * Nothing here is stored and there is no *recalculate*: move the choice that
 * grants the keycard and its acquisition point moves with it, cut the choice
 * and the resource reads as unobtainable the next time anything asks. It is
 * the same absence the whole module is built on.
 */
export const resourceEconomy = (file: ProjectFile, resourceId: ResourceDefinitionId): ResourceEconomy | null => {
  const resource = findResource(file, resourceId);
  if (!resource) return null;
  const id = resourceId as string;
  const rank = depths(file);

  const pointsOf = (kind: 'grant' | 'consume'): EconomyPoint[] =>
    allEffects(file)
      .filter((one) => one.effect.kind === kind && one.effect.targetId === id)
      .map((one) => {
        const choice = 'elementId' in one.from ? one.from : null;
        const at = whereOf(one.from);
        return {
          element: findElement(file, at)!,
          choice,
          amount: one.effect.value || '0',
          step: stepOf(rank, at as string),
        };
      })
      .filter((one) => one.element !== null)
      .sort(byStep);

  const gates: EconomyGate[] = allConditions(file)
    .filter((one) => one.condition.subject === 'resource' && one.condition.subjectId === id)
    .map((one) => {
      const choice = 'elementId' in one.on ? one.on : null;
      const at = whereOf(one.on);
      const element = findElement(file, at)!;
      return {
        element,
        choice,
        condition: one.condition,
        says: sayCondition(file, one.condition),
        step: stepOf(rank, at as string),
        mandatory: element?.mandatory ?? false,
      };
    })
    .filter((one) => one.element !== null)
    .sort(byStep);

  const sources = pointsOf('grant');

  return {
    resource,
    sources,
    sinks: pointsOf('consume'),
    gates,
    feeds: resourcesOf(file).filter((one) => one.feeds.includes(resourceId)),
    fedBy: resource.feeds
      .map((one) => findResource(file, one))
      .filter((one): one is ResourceDefinition => one !== null),
    replaces: resource.upgradeOf ? findResource(file, resource.upgradeOf) : null,
    replacedBy: resourcesOf(file).filter((one) => one.upgradeOf === resourceId),
    obtainable: resource.initial > 0 || sources.length > 0,
    required: gates.some((one) => one.mandatory),
  };
};

/** Every resource, read the same way — the list the progression screen draws. */
export const economyOf = (file: ProjectFile): ResourceEconomy[] =>
  resourcesOf(file)
    .map((one) => resourceEconomy(file, one.id))
    .filter((one): one is ResourceEconomy => one !== null);

/**
 * The economy in a sentence.
 *
 * Every clause is countable, and none of it is a verdict: *three sources, two
 * sinks* is a fact, and *too scarce* is the designer's to decide — which is
 * §12's line held one module further out.
 */
export const describeEconomy = (economy: ResourceEconomy): string => {
  const parts: string[] = [];
  // Nobody has used it yet, which is a different thing from having designed
  // it badly — and saying *nothing gives it* about a resource made a minute
  // ago is an accusation rather than a reading.
  const mentioned =
    economy.sources.length + economy.sinks.length + economy.gates.length > 0 || economy.resource.initial > 0;
  if (!mentioned) return 'Nothing in the game mentions it yet.';
  if (!economy.obtainable) {
    parts.push('nothing gives it and the player starts with none');
  } else {
    if (economy.resource.initial > 0) parts.push(`starts with ${economy.resource.initial}`);
    if (economy.sources.length > 0) {
      parts.push(`${economy.sources.length} source${economy.sources.length === 1 ? '' : 's'}`);
    }
  }
  if (economy.sinks.length > 0) parts.push(`${economy.sinks.length} sink${economy.sinks.length === 1 ? '' : 's'}`);
  if (economy.gates.length > 0) {
    parts.push(`${economy.gates.length} rule${economy.gates.length === 1 ? '' : 's'} ask about it`);
  }
  if (economy.required) parts.push('something mandatory needs it');
  return `${parts.join(' · ')}.`;
};

// ----------------------------------------------------------- the progression

export interface TierRow {
  /** 0 is the unranked group, which sorts last rather than first. */
  tier: number;
  resources: ResourceDefinition[];
}

/**
 * §7's *progression tier*, which is the one ordering the graph cannot give.
 *
 * Unranked sorts **last** rather than first: a designer who has not ranked
 * anything sees their resources in a list rather than in a tier called zero,
 * and a zero that displayed as the earliest tier would be a claim nobody made.
 */
export const progressionTiers = (file: ProjectFile): TierRow[] => {
  const byTier = new Map<number, ResourceDefinition[]>();
  for (const one of resourcesOf(file)) {
    byTier.set(one.tier, [...(byTier.get(one.tier) ?? []), one]);
  }
  return [...byTier.entries()]
    .sort((a, b) => (a[0] === 0 ? 1 : b[0] === 0 ? -1 : a[0] - b[0]))
    .map(([tier, resources]) => ({
      tier,
      resources: [...resources].sort((a, b) => a.name.localeCompare(b.name)),
    }));
};

/**
 * A resource and everything that replaces it, in order (§7's upgrades).
 *
 * A cycle — somebody makes A an upgrade of B and B an upgrade of A — stops
 * rather than spinning, because a chain that hangs the screen is worse than a
 * chain that is short.
 */
export const upgradeChain = (file: ProjectFile, resourceId: ResourceDefinitionId): ResourceDefinition[] => {
  const chain: ResourceDefinition[] = [];
  const seen = new Set<string>();
  let here = findResource(file, resourceId);
  // Walk back to the first of the line.
  while (here && here.upgradeOf && !seen.has(here.id as string)) {
    seen.add(here.id as string);
    const before = findResource(file, here.upgradeOf);
    if (!before) break;
    here = before;
  }
  seen.clear();
  while (here && !seen.has(here.id as string)) {
    seen.add(here.id as string);
    chain.push(here);
    here = resourcesOf(file).find((one) => one.upgradeOf === here!.id) ?? null;
  }
  return chain;
};

// ------------------------------------------------------- §9's resource overlay

/**
 * Every node a state or a resource touches — granted, spent, or asked about.
 *
 * §9's *optional overlays for resources* is this set handed to the map, which
 * then lights exactly the nodes where a thing matters. It takes a bare id
 * rather than a typed one because a condition's subject is a state **or** a
 * resource and the overlay is the same question either way.
 */
export const nodesTouching = (file: ProjectFile, subjectId: string): ReadonlySet<string> => {
  const found = new Set<string>();
  for (const { effect, from } of allEffects(file)) {
    if (effect.targetId !== subjectId) continue;
    found.add(whereOf(from) as string);
  }
  for (const { condition, on } of allConditions(file)) {
    if (condition.subjectId !== subjectId) continue;
    found.add(whereOf(on) as string);
  }
  // A choice that *leads to* a gated node is where the player meets the gate,
  // so it belongs on the overlay too: otherwise the door lights and the
  // corridor that reaches it does not.
  for (const choice of choicesOf(file)) {
    if (choice.toElementId && found.has(choice.toElementId as string)) {
      found.add(choice.elementId as string);
    }
  }
  return found;
};

/**
 * What the economy screen says about the game as a whole.
 *
 * Only two sentences are worth saying at this level, and both are countable:
 * how much of the economy is reachable at all, and how much of it nobody has
 * written a rule about. Anything else would be an opinion about balance.
 */
export const describeProgression = (file: ProjectFile): string => {
  const all = economyOf(file);
  if (all.length === 0) return 'No resources yet. A game without an economy is a game without one.';
  const unreachable = all.filter((one) => !one.obtainable).length;
  const idle = all.filter((one) => one.gates.length === 0 && one.sinks.length === 0).length;
  const parts = [`${all.length} resource${all.length === 1 ? '' : 's'}`];
  if (unreachable > 0) parts.push(`${unreachable} the player cannot get`);
  if (idle > 0) parts.push(`${idle} nothing spends or asks about`);
  return `${parts.join(' · ')}.`;
};

/** Which nodes a resource is reachable at, for the screen's *where* list. */
export const reachableAt = (file: ProjectFile, points: readonly EconomyPoint[]): EconomyPoint[] => {
  const found = reachable(file);
  return points.filter((one) => found.has(one.element.id as string));
};

/** Every node in the graph, for a caller that wants to name one. */
export const elementNames = (file: ProjectFile): Map<string, string> =>
  new Map(elementsOf(file).map((one) => [one.id as string, one.name || 'an unnamed node']));
