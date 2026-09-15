import { findElement, findResource, findState, resourcesOf, statesOf } from './narrative.js';
import { sayCondition } from './narrative-eval.js';
import { emptyConditions } from './entities/narrative.js';
import type {
  Choice,
  Condition,
  ConditionGroup,
  Effect,
  EffectKind,
  NarrativeElement,
} from './entities/narrative.js';
import type { ProjectFile } from './project-file.js';

/**
 * Interactive Narrative: the rule builder (addendum 18, stage 5 — §15.2, §15.3).
 *
 * §15.3 asks for **readable designer language**: WHEN [conditions] → DO
 * [effects] → GO TO [destination]. This is that language, and two decisions
 * carry it.
 *
 * **There is no code box anywhere, and the sentence is the interface.** Twine
 * has macros, Ink has a language, and both mean a designer writes something a
 * parser must accept before the tool can say anything about it. Here a rule
 * *is* the `ConditionGroup` and the `Effect[]` that stages 2 and 3 already
 * read — no source text, no compile step, no intermediate form. So the builder
 * cannot produce a rule the evaluator will not run, and the validator cannot
 * be looking at something other than what the designer typed. It is §9's
 * *logic without code* column, and it is the reason `sayRule` can exist at
 * all: a sentence can only be written *back* out of a rule that was structured
 * to begin with.
 *
 * And **the builder never says whether a rule is true.** It is the obvious
 * feature and it would be a lie: at authoring time there is no state, because
 * the player arrives carrying whatever the path they took gave them. What it
 * says instead is what is *statically* true — stage 3's findings, which are
 * facts about the graph — and whether a rule holds right now is stage 7's
 * simulator, where somebody has actually walked there.
 */

// -------------------------------------------------------------- the sentence

const JOIN_WORDS: Record<ConditionGroup['join'], string> = {
  all: ' AND ',
  any: ' OR ',
  none: ' OR ',
};

export const JOIN_NAMES: Record<ConditionGroup['join'], string> = {
  all: 'ALL of',
  any: 'ANY of',
  none: 'NONE of',
};

/** The tests, as the designer reads them in the control that picks one. */
export const OP_NAMES: Record<Condition['op'], string> = {
  is: 'is',
  is_not: 'is not',
  at_least: 'is at least',
  at_most: 'is at most',
  more_than: 'is more than',
  less_than: 'is less than',
};

/**
 * What the value control should be, read off the definition rather than typed.
 *
 * A flag has two values and an enum has the ones somebody listed, so offering
 * a free text box for either would let a designer write `is mabye` and wait for
 * a bug report. Everything else is text, numbers included, because the number
 * is the designer's and `at_least 40` on something they think of as a score
 * should not be a spinner with opinions.
 */
export const valuesFor = (file: ProjectFile, condition: Condition): string[] | null => {
  if (condition.subject !== 'state') return null;
  const definition = findState(file, condition.subjectId as never);
  if (!definition) return null;
  if (definition.kind === 'flag') return ['true', 'false'];
  if (definition.kind === 'enum' && definition.choices.length > 0) return definition.choices;
  return null;
};

/**
 * A group of conditions as a line of English.
 *
 * Empty is empty rather than *always*: what to say about a thing with no rule
 * belongs to whatever is asking, because *available to everybody* and *happens
 * on arrival* are the same emptiness said two ways.
 */
export const sayGroup = (file: ProjectFile, group: ConditionGroup): string => {
  const parts = [
    ...group.conditions.map((one) => sayCondition(file, one)),
    ...group.groups.filter((one) => !isEmpty(one)).map((one) => `(${sayGroup(file, one)})`),
  ];
  if (parts.length === 0) return '';
  const joined = parts.join(JOIN_WORDS[group.join]);
  return group.join === 'none' ? `NOT (${joined})` : joined;
};

const isEmpty = (group: ConditionGroup): boolean =>
  group.conditions.length === 0 && group.groups.every(isEmpty);

const nameOfTarget = (file: ProjectFile, effect: Effect): string => {
  switch (effect.kind) {
    case 'set':
    case 'add':
      return findState(file, effect.targetId as never)?.key || 'a state that has gone';
    case 'grant':
    case 'consume':
      return findResource(file, effect.targetId as never)?.name || 'a resource that has gone';
    default:
      return findElement(file, effect.targetId as never)?.name || 'a node that has gone';
  }
};

/**
 * One effect as a line of English.
 *
 * The verbs are the designer's rather than the machine's — *give* and *take*
 * rather than *grant* and *consume* — because the four element verbs
 * (`unlock`, `block`, `reveal`, `hide`) already read as English and a list
 * where half the rows are jargon reads worse than either.
 */
export const sayEffect = (file: ProjectFile, effect: Effect): string => {
  const name = nameOfTarget(file, effect);
  const value = effect.value || '(nothing)';
  switch (effect.kind) {
    case 'set':
      return `set ${name} to ${value}`;
    case 'add':
      return `add ${value} to ${name}`;
    case 'grant':
      return `give ${value} ${name}`;
    case 'consume':
      return `take ${value} ${name}`;
    case 'unlock':
      return `unlock ${name}`;
    case 'block':
      return `block ${name}`;
    case 'reveal':
      return `reveal ${name}`;
    case 'hide':
      return `hide ${name}`;
  }
};

/** Effects in the order they are applied, which is the order they are written. */
export const sayEffects = (file: ProjectFile, effects: readonly Effect[]): string =>
  effects.map((one) => sayEffect(file, one)).join(', then ');

export interface RuleLines {
  when: string;
  /** Empty where the choice changes nothing. */
  then: string;
  /** Empty where it leaves the player where they are, which is legal (§2). */
  goTo: string;
}

/**
 * §15.3's three lines, for one choice.
 *
 * Written out of the rule rather than into it: this is what the designer's
 * controls have built, said back to them in the words the spec asks for, so
 * they can read a screen of choices without opening each one.
 */
export const sayRule = (file: ProjectFile, choice: Choice): RuleLines => ({
  when: sayGroup(file, choice.conditions) || 'always',
  then: sayEffects(file, choice.effects),
  goTo: choice.toElementId ? findElement(file, choice.toElementId)?.name || 'a node that has gone' : '',
});

/** The same three lines as one string, for a list or a report. */
export const sayRuleLine = (file: ProjectFile, choice: Choice): string => {
  const lines = sayRule(file, choice);
  return [
    `WHEN ${lines.when}`,
    lines.then.length > 0 ? `DO ${lines.then}` : '',
    lines.goTo.length > 0 ? `GO TO ${lines.goTo}` : 'stay here',
  ]
    .filter((one) => one.length > 0)
    .join(' → ');
};

/**
 * What a node's own rule says: what must be true to be here, and what arriving
 * changes. A node has no GO TO, because it **is** the destination.
 */
export const sayElementRule = (file: ProjectFile, element: NarrativeElement): { when: string; onArrival: string } => ({
  when: sayGroup(file, element.conditions) || 'anybody who gets here may be here',
  onArrival: sayEffects(file, element.effects),
});

// ------------------------------------------------------- editing a group

/**
 * Where a group sits inside another: the indices to walk down `groups`.
 *
 * An empty path is the rule's own top group. Nesting is one level in the
 * interface (§15.3) and any depth here, because the schema allows it and a
 * builder that could not read back what a file holds would be a builder that
 * loses somebody's work.
 */
export type GroupPath = readonly number[];

const changeAt = (
  group: ConditionGroup,
  path: GroupPath,
  change: (found: ConditionGroup) => ConditionGroup,
): ConditionGroup => {
  if (path.length === 0) return change(group);
  const [head, ...rest] = path;
  if (head === undefined || !group.groups[head]) return group;
  return {
    ...group,
    groups: group.groups.map((one, index) => (index === head ? changeAt(one, rest, change) : one)),
  };
};

/** The group at a path, or null where the path has gone stale. */
export const groupAt = (group: ConditionGroup, path: GroupPath): ConditionGroup | null => {
  let here: ConditionGroup | undefined = group;
  for (const step of path) {
    here = here?.groups[step];
    if (!here) return null;
  }
  return here ?? null;
};

/**
 * A condition to start from.
 *
 * The first state the project has, or the first resource where it has no
 * states — because a new row that names nothing has to be repaired before it
 * can be read, and a designer pressing *+ Condition* means *ask about
 * something*, not *make an empty row*.
 */
export const newCondition = (file: ProjectFile): Condition | null => {
  const state = statesOf(file)[0];
  if (state) return { subject: 'state', subjectId: state.id as string, op: 'is', value: '' };
  const resource = resourcesOf(file)[0];
  if (resource) return { subject: 'resource', subjectId: resource.id as string, op: 'at_least', value: '1' };
  return null;
};

export const addCondition = (group: ConditionGroup, path: GroupPath, condition: Condition): ConditionGroup =>
  changeAt(group, path, (found) => ({ ...found, conditions: [...found.conditions, condition] }));

export const updateCondition = (
  group: ConditionGroup,
  path: GroupPath,
  index: number,
  patch: Partial<Condition>,
): ConditionGroup =>
  changeAt(group, path, (found) => ({
    ...found,
    conditions: found.conditions.map((one, at) => (at === index ? { ...one, ...patch } : one)),
  }));

export const removeCondition = (group: ConditionGroup, path: GroupPath, index: number): ConditionGroup =>
  changeAt(group, path, (found) => ({
    ...found,
    conditions: found.conditions.filter((_, at) => at !== index),
  }));

export const setJoin = (group: ConditionGroup, path: GroupPath, join: ConditionGroup['join']): ConditionGroup =>
  changeAt(group, path, (found) => ({ ...found, join }));

export const addSubGroup = (group: ConditionGroup, path: GroupPath): ConditionGroup =>
  changeAt(group, path, (found) => ({
    ...found,
    // A nested group joins the other way by default, because a designer who
    // asks for one inside an ALL wants *any of these* nine times in ten.
    groups: [...found.groups, { ...emptyConditions(), join: found.join === 'all' ? 'any' : 'all' }],
  }));

export const removeSubGroup = (group: ConditionGroup, path: GroupPath, index: number): ConditionGroup =>
  changeAt(group, path, (found) => ({ ...found, groups: found.groups.filter((_, at) => at !== index) }));

// ------------------------------------------------------ editing the effects

export const EFFECT_NAMES: Record<EffectKind, string> = {
  set: 'Set a state',
  add: 'Add to a number',
  grant: 'Give a resource',
  consume: 'Take a resource',
  unlock: 'Unlock a node',
  block: 'Block a node',
  reveal: 'Reveal a node',
  hide: 'Hide a node',
};

/** Which list an effect of this kind picks its target from. */
export const targetKindOf = (kind: EffectKind): 'state' | 'resource' | 'element' =>
  kind === 'set' || kind === 'add' ? 'state' : kind === 'grant' || kind === 'consume' ? 'resource' : 'element';

/**
 * An effect to start from, aimed at something real.
 *
 * Null where the project has nothing of the kind to aim at, which is what
 * makes the control absent rather than an effect pointing at nothing.
 */
export const newEffect = (file: ProjectFile, kind: EffectKind): Effect | null => {
  const target =
    targetKindOf(kind) === 'state'
      ? statesOf(file)[0]?.id
      : targetKindOf(kind) === 'resource'
        ? resourcesOf(file)[0]?.id
        : file.narrativeElements?.[0]?.id;
  if (!target) return null;
  return {
    kind,
    targetId: target as string,
    value: kind === 'grant' || kind === 'consume' || kind === 'add' ? '1' : '',
    timing: 'immediate',
    note: '',
  };
};

export const addEffect = (effects: readonly Effect[], effect: Effect): Effect[] => [...effects, effect];

export const updateEffect = (effects: readonly Effect[], index: number, patch: Partial<Effect>): Effect[] =>
  effects.map((one, at) => {
    if (at !== index) return one;
    const next = { ...one, ...patch };
    // Changing the kind can change what the target must be, and an effect
    // aimed at the wrong list of things is worse than one aimed at nothing.
    if (patch.kind && targetKindOf(patch.kind) !== targetKindOf(one.kind)) {
      return { ...next, targetId: '' };
    }
    return next;
  });

export const removeEffect = (effects: readonly Effect[], index: number): Effect[] =>
  effects.filter((_, at) => at !== index);

/**
 * Effects are **stacked in order** (§15.3), and the order is not decoration:
 * stage 2 applies them one after another, so *give 1 key* then *take 1 key*
 * and the other way round are different rules.
 */
export const moveEffect = (effects: readonly Effect[], index: number, by: -1 | 1): Effect[] => {
  const to = index + by;
  if (index < 0 || index >= effects.length || to < 0 || to >= effects.length) return [...effects];
  const next = [...effects];
  const [moved] = next.splice(index, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
};
