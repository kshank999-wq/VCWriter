import {
  allConditions,
  allEffects,
  choicesAt,
  choicesOf,
  elementsOf,
  entryPoints,
  findElement,
  findResource,
  findState,
  resourcesOf,
  statesOf,
} from './narrative.js';
import { initialState, meets, reachable, sayCondition, unreachable } from './narrative-eval.js';
import type { Choice, Condition, ConditionGroup, Effect, NarrativeElement } from './entities/narrative.js';
import type { ChoiceId, NarrativeElementId, ResourceDefinitionId, StateDefinitionId } from './ids.js';
import type { PlayState } from './narrative-eval.js';
import type { ProjectFile } from './project-file.js';

/**
 * Interactive Narrative: validation (addendum 18, stage 3 — §8, and §12 of the
 * spec whole).
 *
 * **Checkable, never an opinion.** Every one of the twelve is a fact about the
 * graph: *this node cannot be reached*, *this condition can never be made
 * true*, *this weapon has no ammunition*. Compare the Character Creator's line
 * — *this character is thin* is not a thing software gets to say, and *this
 * cause is written after its effect* is. Nothing here says a game is good.
 *
 * **It is a reading** (§4): no `valid` column, no *validate* button, nothing
 * stored. Cut the choice and the finding appears the next time anything asks.
 *
 * And **it never cries wolf**, which is the discipline the whole module rests
 * on: a validator that reports something the designer can see is fine is one
 * they switch off, after which it catches nothing. So where the graph cannot be
 * certain — an `add` of an unknown amount, a condition under an ANY that
 * another branch satisfies, a dead end the designer has marked as an ending —
 * this says nothing at all. Every sentence below is one the designer cannot
 * argue with.
 *
 * It is built **off stage 2's reading** rather than beside it: `meets` decides
 * whether an effect could satisfy a condition, and `reachable` — with its one
 * node left out — answers both *is the key behind the door it opens* and *can a
 * path reach an ending without passing what is mandatory*.
 */

// ------------------------------------------------------------- the findings

export type CheckKind =
  /** §12.1. Nothing leads here. */
  | 'unreachable'
  /** §12.3, with its qualifier: a stop the designer has not called a stop. */
  | 'dead_end'
  /** §12.2. No consequence **and** nowhere to go. */
  | 'empty_choice'
  /** §12.4. A condition nothing in the project could ever satisfy. */
  | 'missing_prerequisite'
  /** §12.5. The only thing that opens the door is behind the door. */
  | 'circular_prerequisite'
  /** §12.6. Two conditions that cannot both hold. */
  | 'contradiction'
  /** §12.8. */
  | 'weapon_without_ammunition'
  /** §12.9. Spendable, never replaced, and needed later. */
  | 'exhaustible_resource'
  /** §12.10. */
  | 'impossible_ending'
  /** §12.11. A way past something marked mandatory. */
  | 'spine_bypassed'
  /** §12.12, first half: nothing consults it. */
  | 'state_never_read'
  /** §12.12, second half: nothing ever changes it. */
  | 'state_never_set'
  /** Not one of the twelve, and the reason none of them can be answered. */
  | 'no_entry_point';

/** What to open when somebody clicks a finding. */
export type FindingSubject =
  | { kind: 'element'; id: NarrativeElementId }
  | { kind: 'choice'; id: ChoiceId }
  | { kind: 'state'; id: StateDefinitionId }
  | { kind: 'resource'; id: ResourceDefinitionId };

export interface Finding {
  check: CheckKind;
  /** Null where the finding is about the graph rather than a thing in it. */
  at: FindingSubject | null;
  /** The whole finding, in a sentence. Nothing else is needed to act on it. */
  says: string;
}

/** For the list's grouping, and for §15.2's badge on a node. */
export const CHECK_WORDS: Record<CheckKind, string> = {
  no_entry_point: 'No way in',
  unreachable: 'Unreachable',
  impossible_ending: 'An ending that cannot happen',
  dead_end: 'Dead end',
  spine_bypassed: 'The spine can be missed',
  missing_prerequisite: 'A prerequisite nothing provides',
  circular_prerequisite: 'A prerequisite behind its own door',
  contradiction: 'Conditions that disagree',
  empty_choice: 'A choice that does nothing',
  exhaustible_resource: 'A resource that can run out',
  weapon_without_ammunition: 'A weapon with nothing to fire',
  state_never_read: 'Nothing reads it',
  state_never_set: 'Nothing sets it',
};

/**
 * The order the list is read in: what stops the game from working, then what
 * stops a path from working, then what is merely written down and idle.
 */
const ORDER: CheckKind[] = [
  'no_entry_point',
  'unreachable',
  'impossible_ending',
  'dead_end',
  'spine_bypassed',
  'missing_prerequisite',
  'circular_prerequisite',
  'contradiction',
  'empty_choice',
  'exhaustible_resource',
  'weapon_without_ammunition',
  'state_never_read',
  'state_never_set',
];

// ------------------------------------------------------------ small readings

const nameOf = (element: NarrativeElement | null): string => element?.name || 'an unnamed node';
const nameOfChoice = (choice: Choice): string => choice.name || choice.text || 'an unnamed choice';

/** A choice carries the node it is offered at; an element does not. */
const isChoice = (one: NarrativeElement | Choice): one is Choice => 'elementId' in one;

/** Where a rule is asked: the node itself, or the node a choice is offered at. */
const askedAt = (on: NarrativeElement | Choice): NarrativeElementId =>
  isChoice(on) ? on.elementId : on.id;

/** A path stops here, one way or another. */
const isTerminal = (file: ProjectFile, element: NarrativeElement): boolean =>
  choicesAt(file, element.id).every((choice) => choice.toElementId === null);

/** The designer has said a stop here is meant. */
const meantToEnd = (element: NarrativeElement): boolean => element.endsHere || element.kind === 'ending';

/**
 * Every condition the thing **depends on** — ALL joins the whole way up.
 *
 * A condition under an ANY is not required (another branch may carry the
 * group), and one under a NONE is satisfied by being impossible. Checking those
 * is how a validator starts crying wolf, so they are not checked.
 */
const requiredConditions = (group: ConditionGroup): Condition[] =>
  group.join === 'all'
    ? [...group.conditions, ...group.groups.flatMap(requiredConditions)]
    : [];

/** The groups whose conditions must all hold, at any depth. */
const requiredGroups = (group: ConditionGroup): ConditionGroup[] =>
  group.join === 'all' ? [group, ...group.groups.flatMap(requiredGroups)] : [];

/** The state as it would be with one subject pinned to a value. */
const pinned = (file: ProjectFile, subjectId: string, value: string): PlayState => {
  const start = initialState(file);
  return { ...start, states: { ...start.states, [subjectId]: value } };
};

/**
 * Whether this effect could ever make this condition true.
 *
 * `set` and `grant` are answerable exactly, and the answer comes from stage 2's
 * `meets` rather than from a second reading of what `at_least` means. `add` and
 * `consume` move a number by an amount that depends on where it already is, so
 * they are taken as **possible** — the alternative is calling something
 * impossible that a designer can see is not.
 */
const couldSatisfy = (file: ProjectFile, condition: Condition, effect: Effect): boolean => {
  if (effect.targetId !== condition.subjectId) return false;
  if (condition.subject === 'state') {
    if (effect.kind === 'set') return meets(file, pinned(file, condition.subjectId, effect.value), condition);
    return effect.kind === 'add';
  }
  return effect.kind === 'grant' || effect.kind === 'consume';
};

// ------------------------------------------------------------- the twelve

/** §12.1, and the one that has to run first: everything else assumes a way in. */
export const unreachableNodes = (file: ProjectFile): Finding[] => {
  if (elementsOf(file).length === 0) return [];
  if (entryPoints(file).length === 0) {
    // One finding rather than one per node: the graph has a single problem and
    // a list repeating it for every node is a list nobody reads.
    return [
      {
        check: 'no_entry_point',
        at: null,
        says: 'No node is marked as a place the player can start, so nothing in the graph can be reached.',
      },
    ];
  }
  return unreachable(file)
    .filter((one) => !meantToEnd(one))
    .map((one) => {
      // §12.1 says *nodes or choices*, and a choice at a node nobody reaches is
      // the second half of it — said here rather than as a finding of its own,
      // because it is the same problem and one fix.
      const stranded = choicesAt(file, one.id).length;
      return {
        check: 'unreachable' as const,
        at: { kind: 'element' as const, id: one.id },
        says: `Nothing leads to ${nameOf(one)}${
          stranded === 0
            ? ''
            : `, so the ${stranded === 1 ? 'choice' : `${stranded} choices`} written there ${
                stranded === 1 ? 'is' : 'are'
              } never offered`
        }.`,
      };
    });
};

/**
 * §12.3, **with its qualifier**: *dead-end branches that are not intentional
 * endings or fail states*. `endsHere` is how the designer says so, and a
 * validator that cannot be told it is wrong becomes noise.
 */
export const deadEnds = (file: ProjectFile): Finding[] => {
  const found = reachable(file);
  return elementsOf(file)
    .filter((one) => found.has(one.id as string) && isTerminal(file, one) && !meantToEnd(one))
    .map((one) => ({
      check: 'dead_end' as const,
      at: { kind: 'element' as const, id: one.id },
      says: `${nameOf(one)} has nowhere to go and is not marked as an ending. Mark it as one, or give it a choice that leads somewhere.`,
    }));
};

/**
 * §12.2, and the addendum's narrowing of it: no consequence **and** no
 * destination. The spec says *or*, and §2 says why that is wrong — a choice
 * that changes the world and leaves the player where they were is examining,
 * taking, refusing. What is empty is one that does neither.
 */
export const emptyChoices = (file: ProjectFile): Finding[] =>
  choicesOf(file)
    .filter((one) => one.effects.length === 0 && one.toElementId === null)
    .map((one) => ({
      check: 'empty_choice' as const,
      at: { kind: 'choice' as const, id: one.id },
      says: `${nameOfChoice(one)} at ${nameOf(findElement(file, one.elementId))} changes nothing and leads nowhere.`,
    }));

/**
 * §12.4, §12.5 and §12.7, which are one question asked at three distances.
 *
 * A prerequisite is **missing** when nothing anywhere in the project could
 * satisfy it, and **circular** when something could but only from behind the
 * very thing it gates — §12.7's *required before any possible acquisition
 * point* is that second one said about a resource. Both are answered by the
 * same walk with one node left out.
 *
 * A state nothing sets at all is left to `orphanState`, which names the state
 * rather than every rule that reads it: one problem, one finding.
 */
export const prerequisites = (file: ProjectFile): Finding[] => {
  const start = initialState(file);
  const effects = allEffects(file);
  const found = reachable(file);
  const findings: Finding[] = [];

  for (const { condition, on } of allConditions(file)) {
    if (!requiredConditions(on.conditions).includes(condition)) continue;
    if (meets(file, start, condition)) continue;

    const gate = askedAt(on);
    // Something unreachable is already reported; piling its rules on top is
    // three findings for one problem.
    if (!found.has(gate as string)) continue;

    const targeted = effects.filter((one) => one.effect.targetId === condition.subjectId);
    if (condition.subject === 'state' && targeted.length === 0) continue; // orphanState's

    const able = targeted.filter((one) => couldSatisfy(file, condition, one.effect));
    const where = isChoice(on)
      ? `${nameOfChoice(on)} at ${nameOf(findElement(file, on.elementId))}`
      : nameOf(on);

    if (able.length === 0) {
      findings.push({
        check: 'missing_prerequisite',
        at: isChoice(on) ? { kind: 'choice', id: on.id } : { kind: 'element', id: on.id },
        says: `${where} needs ${sayCondition(file, condition)}, and nothing anywhere in the game makes that true.`,
      });
      continue;
    }

    // Behind its own door. For a choice, only the choice itself is out of
    // reach — another choice at the same node can perfectly well hand over the
    // key without the player moving.
    const behind = isChoice(on)
      ? able.every((one) => isChoice(one.from) && one.from.id === on.id)
      : ((elsewhere) => able.every((one) => !elsewhere.has(askedAt(one.from) as string)))(
          reachable(file, { without: on.id }),
        );

    if (behind) {
      findings.push({
        check: 'circular_prerequisite',
        at: isChoice(on) ? { kind: 'choice', id: on.id } : { kind: 'element', id: on.id },
        says: `${where} needs ${sayCondition(file, condition)}, and the only thing that makes it true is behind ${
          isChoice(on) ? 'that same choice' : nameOf(on)
        }.`,
      });
    }
  }

  return findings;
};

/**
 * §12.6. Two conditions in one ALL that cannot both hold.
 *
 * Where one of the pair pins the subject to a value, the other is simply run
 * against it — stage 2's `meets` again, rather than a second opinion about what
 * `at_least` means. Two open-ended ranges are compared as bounds, and only a
 * gap that is certainly empty counts: `more than 5` with `less than 6` is
 * satisfiable by 5.5 and says nothing.
 */
export const contradictions = (file: ProjectFile): Finding[] => {
  const findings: Finding[] = [];

  const check = (on: NarrativeElement | Choice, group: ConditionGroup): void => {
    for (const [index, first] of group.conditions.entries()) {
      for (const second of group.conditions.slice(index + 1)) {
        if (first.subject !== second.subject || first.subjectId !== second.subjectId) continue;
        if (!impossibleTogether(file, first, second)) continue;
        findings.push({
          check: 'contradiction',
          at: isChoice(on) ? { kind: 'choice', id: on.id } : { kind: 'element', id: on.id },
          says: `${
            isChoice(on) ? `${nameOfChoice(on)} at ${nameOf(findElement(file, on.elementId))}` : nameOf(on)
          } asks for ${sayCondition(file, first)} and ${sayCondition(file, second)}, which cannot both be true.`,
        });
      }
    }
  };

  for (const element of elementsOf(file)) {
    for (const group of requiredGroups(element.conditions)) check(element, group);
  }
  for (const choice of choicesOf(file)) {
    for (const group of requiredGroups(choice.conditions)) check(choice, group);
  }
  return findings;
};

const AT_LEAST = new Set<Condition['op']>(['at_least', 'more_than']);
const AT_MOST = new Set<Condition['op']>(['at_most', 'less_than']);

const impossibleTogether = (file: ProjectFile, first: Condition, second: Condition): boolean => {
  // One of them pins the value, so the other can simply be asked.
  if (first.op === 'is') return !meets(file, pinned(file, first.subjectId, first.value), second);
  if (second.op === 'is') return !meets(file, pinned(file, second.subjectId, second.value), first);

  const lower = AT_LEAST.has(first.op) ? first : AT_LEAST.has(second.op) ? second : null;
  const upper = AT_MOST.has(first.op) ? first : AT_MOST.has(second.op) ? second : null;
  if (!lower || !upper || lower === upper) return false;

  const low = Number.parseFloat(lower.value);
  const high = Number.parseFloat(upper.value);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return false;
  // `at least 5` with `at most 4`, and `more than 5` with `less than 5`. A gap
  // that a fraction could still fall into is not a contradiction.
  return lower.op === 'at_least' && upper.op === 'at_most' ? low > high : low >= high;
};

/**
 * §12.12. A flag nobody consults, and one nothing ever changes.
 *
 * A state that is neither read nor set gets **one** finding rather than two: it
 * is a definition somebody made and has not used yet, which is one fact.
 */
export const orphanState = (file: ProjectFile): Finding[] => {
  const read = new Set(allConditions(file).map((one) => one.condition.subjectId));
  const written = new Set(allEffects(file).map((one) => one.effect.targetId));

  return statesOf(file).flatMap((state): Finding[] => {
    const id = state.id as string;
    const at = { kind: 'state' as const, id: state.id };
    const key = state.key || 'an unnamed state';
    if (!read.has(id) && !written.has(id)) {
      return [{ check: 'state_never_read' as const, at, says: `Nothing reads ${key} and nothing sets it.` }];
    }
    if (!read.has(id)) {
      return [
        {
          check: 'state_never_read' as const,
          at,
          says: `${key} is set but nothing ever reads it, so changing it changes nothing.`,
        },
      ];
    }
    if (!written.has(id)) {
      return [
        {
          check: 'state_never_set' as const,
          at,
          says: `${key} is read but nothing ever sets it, so it will always be ${
            state.initial === '' ? 'its empty starting value' : `“${state.initial}”`
          }.`,
        },
      ];
    }
    return [];
  });
};

/**
 * §12.8. A weapon with no ammunition, and ammunition the player never gets.
 *
 * The second half is what *availability* means in the spec's wording: a
 * magazine that exists in the design and is never handed over is the same
 * problem one step along.
 */
export const weaponsWithoutAmmunition = (file: ProjectFile): Finding[] => {
  const granted = new Set(
    allEffects(file)
      .filter((one) => one.effect.kind === 'grant')
      .map((one) => one.effect.targetId),
  );

  return resourcesOf(file)
    .filter((one) => one.kind === 'weapon')
    .flatMap((weapon) => {
      const feeds = resourcesOf(file).filter(
        (one) => one.kind === 'ammunition' && one.feeds.includes(weapon.id),
      );
      const at = { kind: 'resource' as const, id: weapon.id };
      const name = weapon.name || 'an unnamed weapon';
      if (feeds.length === 0) {
        return [
          {
            check: 'weapon_without_ammunition' as const,
            at,
            says: `${name} has no ammunition: no resource says it feeds it.`,
          },
        ];
      }
      if (feeds.every((one) => !granted.has(one.id as string) && one.initial === 0)) {
        return [
          {
            check: 'weapon_without_ammunition' as const,
            at,
            says: `${name} has ammunition the player never gets: ${feeds
              .map((one) => one.name || 'an unnamed resource')
              .join(', ')} starts at none and is never granted.`,
          },
        ];
      }
      return [];
    });
};

/**
 * §12.9. *A required resource that can be permanently exhausted before a
 * mandatory use.*
 *
 * All three halves have to hold, which is what keeps it quiet: the supply is
 * **fixed** (nothing anywhere grants it), it can be **spent somewhere else**,
 * and something **mandatory** needs it. Two out of three is an economy, not a
 * fault.
 */
export const exhaustibleResources = (file: ProjectFile): Finding[] => {
  const granted = new Set(
    allEffects(file)
      .filter((one) => one.effect.kind === 'grant')
      .map((one) => one.effect.targetId),
  );
  const mandatory = new Set(
    elementsOf(file)
      .filter((one) => one.mandatory)
      .map((one) => one.id as string),
  );

  const needsIt = (resourceId: string): NarrativeElement | null => {
    for (const { condition, on } of allConditions(file)) {
      if (condition.subjectId !== resourceId) continue;
      const at = askedAt(on);
      if (mandatory.has(at as string)) return findElement(file, at);
    }
    for (const { effect, from } of allEffects(file)) {
      if (effect.kind !== 'consume' || effect.targetId !== resourceId) continue;
      const at = askedAt(from);
      if (mandatory.has(at as string)) return findElement(file, at);
    }
    return null;
  };

  return resourcesOf(file).flatMap((resource) => {
    const id = resource.id as string;
    if (granted.has(id)) return [];
    const spends = allEffects(file).filter(
      (one) => one.effect.kind === 'consume' && one.effect.targetId === id,
    );
    const need = needsIt(id);
    if (!need) return [];
    const elsewhere = spends.filter((one) => (askedAt(one.from) as string) !== (need.id as string));
    if (elsewhere.length === 0) return [];
    return [
      {
        check: 'exhaustible_resource' as const,
        at: { kind: 'resource' as const, id: resource.id },
        says: `${resource.name || 'an unnamed resource'} is never granted anywhere and can be spent before ${nameOf(
          need,
        )}, which is mandatory, needs it.`,
      },
    ];
  });
};

/**
 * §12.10. An ending that cannot happen.
 *
 * Endings are stage 8's records; until they exist an ending is a node whose
 * kind says so, and the check is written against that so stage 8 slots in. It
 * is its own finding rather than a plain `unreachable` because an ending
 * nobody can reach is the thing a designer most wants told.
 */
export const impossibleEndings = (file: ProjectFile): Finding[] => {
  if (entryPoints(file).length === 0) return [];
  const found = reachable(file);
  return elementsOf(file)
    .filter((one) => meantToEnd(one) && !found.has(one.id as string))
    .map((one) => ({
      check: 'impossible_ending' as const,
      at: { kind: 'element' as const, id: one.id },
      says: `${nameOf(one)} is an ending nothing leads to, so it can never happen.`,
    }));
};

/**
 * §12.11. *Branches that never return to the intended spine when they are
 * supposed to.*
 *
 * **`mandatory` is what *supposed to* means** — §2.3's spine notes are the
 * designer saying the story does not work without this node. So the question is
 * whether a path exists from a start to a stop that never passes it, and that
 * is the walk with one node left out.
 */
export const spineBypassed = (file: ProjectFile): Finding[] => {
  const found = reachable(file);
  return elementsOf(file)
    .filter((one) => one.mandatory && found.has(one.id as string))
    .flatMap((one) => {
      const without = reachable(file, { without: one.id });
      const stop = elementsOf(file).find(
        (other) => without.has(other.id as string) && (isTerminal(file, other) || meantToEnd(other)),
      );
      if (!stop) return [];
      return [
        {
          check: 'spine_bypassed' as const,
          at: { kind: 'element' as const, id: one.id },
          says: `${nameOf(one)} is marked mandatory, and a path can reach ${nameOf(stop)} without passing it.`,
        },
      ];
    });
};

// ----------------------------------------------------------------- the list

/**
 * Every finding, in the order a designer wants to read them (§8).
 *
 * The whole list every time, from nothing stored. It costs one walk of the
 * graph per mandatory node and per gated condition, which is nothing against
 * the size of a screenplay, and is why there is no *validate* button: there is
 * nothing to press.
 */
export const narrativeFindings = (file: ProjectFile): Finding[] => {
  const all = [
    ...unreachableNodes(file),
    ...impossibleEndings(file),
    ...deadEnds(file),
    ...spineBypassed(file),
    ...prerequisites(file),
    ...contradictions(file),
    ...emptyChoices(file),
    ...exhaustibleResources(file),
    ...weaponsWithoutAmmunition(file),
    ...orphanState(file),
  ];
  return all.sort((a, b) => ORDER.indexOf(a.check) - ORDER.indexOf(b.check));
};

/**
 * What §15.2's inspector shows against the selected node.
 *
 * A node's findings are its own, its choices', and those about a state or
 * resource its rules mention — because a warning a designer can only find by
 * reading a list elsewhere is one they do not find.
 */
export const findingsAt = (file: ProjectFile, elementId: NarrativeElementId): Finding[] => {
  const element = findElement(file, elementId);
  if (!element) return [];
  const mine = new Set<string>([elementId as string]);
  for (const choice of choicesAt(file, elementId)) mine.add(choice.id as string);
  for (const condition of [
    ...requiredConditions(element.conditions),
    ...choicesAt(file, elementId).flatMap((one) => requiredConditions(one.conditions)),
  ]) {
    mine.add(condition.subjectId);
  }
  for (const effect of [
    ...element.effects,
    ...choicesAt(file, elementId).flatMap((one) => one.effects),
  ]) {
    mine.add(effect.targetId);
  }
  return narrativeFindings(file).filter((one) => one.at !== null && mine.has(one.at.id as string));
};

/** Whether anything is worth drawing on a node's badge, without the sentences. */
export const hasFindings = (file: ProjectFile, elementId: NarrativeElementId): boolean =>
  findingsAt(file, elementId).length > 0;

/**
 * The graph as a sentence, for the head of the list.
 *
 * *Nothing to report* is worth saying out loud: a validator that shows an empty
 * box when it is happy looks broken.
 */
export const describeFindings = (findings: readonly Finding[]): string => {
  if (findings.length === 0) return 'Nothing to report. Every node can be reached and every rule can be satisfied.';
  const kinds = new Set(findings.map((one) => one.check));
  return `${findings.length} finding${findings.length === 1 ? '' : 's'} across ${kinds.size} check${
    kinds.size === 1 ? '' : 's'
  }.`;
};

/** Where a state or a resource is named, for the finding a designer clicks. */
export const subjectName = (file: ProjectFile, subject: FindingSubject): string => {
  switch (subject.kind) {
    case 'element':
      return nameOf(findElement(file, subject.id));
    case 'choice':
      return choicesOf(file).find((one) => one.id === subject.id)?.name || 'an unnamed choice';
    case 'state':
      return findState(file, subject.id)?.key || 'an unnamed state';
    case 'resource':
      return findResource(file, subject.id)?.name || 'an unnamed resource';
  }
};
