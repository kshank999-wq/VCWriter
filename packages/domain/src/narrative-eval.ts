import { choicesAt, elementsOf, entryPoints, findElement, findResource, findState } from './narrative.js';
import { beatsForUnit } from './selectors.js';
import type {
  Choice,
  Condition,
  ConditionGroup,
  Effect,
  InteractiveObject,
  NarrativeElement,
  Verb,
} from './entities/narrative.js';
import type { NarrativeElementId, ChoiceId, StructuralUnitId, VerbId } from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * Interactive Narrative: evaluation (addendum 18, stage 2).
 *
 * **There is one of these and there must only ever be one.** The simulator
 * calls it to say what is offered and why something is not; the map calls it to
 * colour; the validator calls it to find the impossible. Three readers, one
 * answer — the precedent is `applyTray` in the Writers Room, where the preview
 * runs the same pure function the commit runs, so the picture and the result
 * cannot disagree.
 *
 * A second implementation of "is this choice available" anywhere in the
 * codebase is the bug, whatever else it appears to fix.
 */

// ------------------------------------------------------------- the state

/**
 * Everything the player carries.
 *
 * Only ever held **inside a run**. Nothing here is stored on the project: a
 * playthrough is a thing somebody did, and stage 7 records those separately.
 * A state the graph has not mentioned is absent rather than defaulted into the
 * map, so `initialState` is the only place a default is decided.
 */
export interface PlayState {
  /** State id → its value, as text. Numbers are text too; `numberOf` reads them. */
  states: Readonly<Record<string, string>>;
  /** Resource id → how many. */
  resources: Readonly<Record<string, number>>;
  /**
   * Element id → whether the designer has blocked or unlocked it.
   *
   * **Absent means open.** A node nobody has spoken about is reachable, which
   * is the only non-surprising default: the alternative is a graph where
   * everything is locked until somebody remembers to unlock it, and a designer
   * who has written no rules at all should be able to walk their own game.
   */
  gates: Readonly<Record<string, boolean>>;
  /** Element id → revealed or hidden. Absent means revealed, for that reason. */
  shown: Readonly<Record<string, boolean>>;
  /**
   * Choice id → how many times it has been taken, for a once-only choice
   * (addendum 25 §8). Absent is never. Optional so a state written before it
   * existed is still a state.
   */
  taken?: Readonly<Record<string, number>>;
  /** Trigger id → fired, for a `once` trigger (addendum 25 §7). */
  fired?: Readonly<Record<string, boolean>>;
}

export const initialState = (file: ProjectFile): PlayState => ({
  states: Object.fromEntries((file.stateDefinitions ?? []).map((one) => [one.id as string, one.initial])),
  resources: Object.fromEntries((file.resourceDefinitions ?? []).map((one) => [one.id as string, one.initial])),
  gates: {},
  shown: {},
});

/** A flag is true only when it says so, so an unset one reads false. */
const flagOf = (value: string | undefined): boolean => value === 'true';

/** An unset number is zero; anything unparseable is zero too, and says so. */
const numberOf = (value: string | number | undefined): number => {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

// ---------------------------------------------------------- the reasons

/**
 * Why something is not available, **in a sentence** (§13).
 *
 * The spec asks the simulator to *explain why a choice is blocked*, and the
 * explanation is built here rather than in a component for the reason every
 * rule in this project lives in the domain: a sentence assembled in a React
 * file cannot be tested, and this one is the module's answer to the question a
 * designer asks most often.
 */
export interface Reason {
  kind: 'condition' | 'blocked' | 'missing' | 'taken';
  says: string;
}

const nameOfSubject = (file: ProjectFile, condition: Condition): string => {
  if (condition.subject === 'state') {
    return findState(file, condition.subjectId as never)?.key || 'a state that has gone';
  }
  return findResource(file, condition.subjectId as never)?.name || 'a resource that has gone';
};

const TEST_WORDS: Record<Condition['op'], string> = {
  is: 'is',
  is_not: 'is not',
  at_least: 'is at least',
  at_most: 'is at most',
  more_than: 'is more than',
  less_than: 'is less than',
};

/** `trust_mara is at least 40`. The designer's key, the designer's number. */
export const sayCondition = (file: ProjectFile, condition: Condition): string =>
  `${nameOfSubject(file, condition)} ${TEST_WORDS[condition.op]} ${condition.value || '(nothing)'}`;

// -------------------------------------------------------- the comparison

/** What one condition currently sees. */
const seen = (file: ProjectFile, state: PlayState, condition: Condition): { text: string; count: number } => {
  if (condition.subject === 'resource') {
    const count = state.resources[condition.subjectId] ?? 0;
    return { text: String(count), count };
  }
  const definition = findState(file, condition.subjectId as never);
  const raw = state.states[condition.subjectId] ?? definition?.initial ?? '';
  // A flag normalises, so `is false` is true of one nobody has set — which is
  // what a designer means and what a raw empty string would get wrong.
  if (definition?.kind === 'flag') return { text: flagOf(raw) ? 'true' : 'false', count: flagOf(raw) ? 1 : 0 };
  return { text: raw, count: numberOf(raw) };
};

export const meets = (file: ProjectFile, state: PlayState, condition: Condition): boolean => {
  const now = seen(file, state, condition);
  const want = condition.value;
  switch (condition.op) {
    case 'is':
      return now.text === want;
    case 'is_not':
      return now.text !== want;
    case 'at_least':
      return now.count >= numberOf(want);
    case 'at_most':
      return now.count <= numberOf(want);
    case 'more_than':
      return now.count > numberOf(want);
    case 'less_than':
      return now.count < numberOf(want);
  }
};

/**
 * Whether a group is satisfied, and what is failing where it is not.
 *
 * An **empty group is satisfied** — a thing nobody has written a rule about is
 * available, which is the only answer that lets a new node be walked through
 * before the rules exist.
 */
export const meetsGroup = (
  file: ProjectFile,
  state: PlayState,
  group: ConditionGroup,
): { ok: boolean; failing: Reason[] } => {
  const own = group.conditions.map((condition) => ({ condition, ok: meets(file, state, condition) }));
  const nested = group.groups.map((one) => ({ one, result: meetsGroup(file, state, one) }));
  const results = [...own.map((one) => one.ok), ...nested.map((one) => one.result.ok)];

  const ok =
    results.length === 0
      ? true
      : group.join === 'all'
        ? results.every(Boolean)
        : group.join === 'any'
          ? results.some(Boolean)
          : !results.some(Boolean);

  if (ok) return { ok, failing: [] };

  // What to name depends on the join, and naming the wrong thing is worse than
  // naming nothing: under ANY *everything* failed, under NONE what failed is
  // the one that passed.
  const named: Reason[] =
    group.join === 'none'
      ? own
          .filter((one) => one.ok)
          .map((one) => ({ kind: 'condition' as const, says: sayCondition(file, one.condition) }))
      : own
          .filter((one) => !one.ok)
          .map((one) => ({ kind: 'condition' as const, says: sayCondition(file, one.condition) }));

  return { ok, failing: [...named, ...nested.flatMap((one) => one.result.failing)] };
};

// --------------------------------------------------------- the standing

/** One choice as it currently stands: offered, or not and why. */
export interface ChoiceOffer {
  choice: Choice;
  available: boolean;
  /** Empty where it is available. §13's *explain why*. */
  blockedBy: Reason[];
}

/**
 * What is true at one node.
 *
 * Named `Situation` rather than the obvious `Standing` because `Standing` is
 * already the desktop's word for where a copy of the project sits against the
 * room's master — current, ahead, behind, diverged (addendum 07 §14). Same
 * reason `Comparison` became `Test`: one name for two unrelated things is how a
 * domain stops being readable.
 */
export interface Situation {
  element: NarrativeElement;
  /** Whether the player may be here at all. */
  available: boolean;
  blockedBy: Reason[];
  /** Every choice written here, available or not — a hidden one explains less. */
  choices: ChoiceOffer[];
}

/** Whether the designer has blocked this node. Absent means open. */
const gateOf = (state: PlayState, elementId: NarrativeElementId): boolean =>
  state.gates[elementId as string] ?? true;

/**
 * What is true at one node, and why anything is not (§16.2).
 *
 * The one function. Availability conditions are read first and nothing is
 * applied: this answers *what is*, never *what happens* — `choose` does that.
 */
export const evaluate = (file: ProjectFile, state: PlayState, at: NarrativeElementId): Situation | null => {
  const element = findElement(file, at);
  if (!element) return null;

  const own = meetsGroup(file, state, element.conditions);
  const gated = gateOf(state, at);
  const blockedBy: Reason[] = [
    ...own.failing,
    ...(gated ? [] : [{ kind: 'blocked' as const, says: `${element.name || 'this'} has been blocked` }]),
  ];

  return {
    element,
    available: own.ok && gated,
    blockedBy,
    choices: choicesAt(file, at).map((choice) => {
      const met = meetsGroup(file, state, choice.conditions);
      const short = shortOf(file, state, choice.effects);
      // A once-only choice already taken is not offered, and says so
      // (addendum 25 §8) — the same *not offered, and why* as any other.
      const spent: Reason[] =
        choice.repeat === 'once' && (state.taken?.[choice.id as string] ?? 0) > 0
          ? [{ kind: 'taken', says: 'already chosen, and it can only be chosen once' }]
          : [];
      return {
        choice,
        available: met.ok && short.length === 0 && spent.length === 0,
        blockedBy: [...met.failing, ...short, ...spent],
      };
    }),
  };
};

/**
 * What a choice would spend that the player has not got.
 *
 * A `consume` the player cannot pay is a **reason the choice is not offered**
 * rather than a thing that happens and takes the count negative. §12 asks the
 * same question statically — *a required resource that can be exhausted before
 * a mandatory use* — and both readings sit on this one.
 */
const shortOf = (file: ProjectFile, state: PlayState, effects: readonly Effect[]): Reason[] =>
  effects
    .filter((effect) => effect.kind === 'consume')
    .flatMap((effect) => {
      const have = state.resources[effect.targetId] ?? 0;
      const want = numberOf(effect.value);
      if (have >= want) return [];
      const name = findResource(file, effect.targetId as never)?.name || 'a resource that has gone';
      return [{ kind: 'missing' as const, says: `not enough ${name} — ${want} needed, ${have} held` }];
    });

// ------------------------------------------------------- what happens

/** One state change, kept so the simulator can show its working (§16.2). */
export interface Mutation {
  effect: Effect;
  says: string;
}

export interface Move {
  /** Where the player is now. Unchanged where the choice had no destination. */
  at: NarrativeElementId;
  state: PlayState;
  /** Every change, in the order it was applied. */
  log: Mutation[];
  /** Why nothing happened, where nothing did. */
  refused: Reason[];
}

const applyOne = (file: ProjectFile, state: PlayState, effect: Effect): { state: PlayState; says: string } => {
  const target = effect.targetId;
  switch (effect.kind) {
    case 'set': {
      const key = findState(file, target as never)?.key || 'a state that has gone';
      return { state: { ...state, states: { ...state.states, [target]: effect.value } }, says: `${key} = ${effect.value}` };
    }
    case 'add': {
      const definition = findState(file, target as never);
      const before = numberOf(state.states[target] ?? definition?.initial);
      const after = before + numberOf(effect.value);
      return {
        state: { ...state, states: { ...state.states, [target]: String(after) } },
        says: `${definition?.key || 'a state that has gone'} ${before} → ${after}`,
      };
    }
    case 'grant':
    case 'consume': {
      const definition = findResource(file, target as never);
      const before = state.resources[target] ?? 0;
      const moved = effect.kind === 'grant' ? numberOf(effect.value) : -numberOf(effect.value);
      // Never below zero, and never above a capacity the designer set. Zero
      // capacity is *no ceiling* rather than a ceiling of none (§7).
      const ceiling = definition && definition.capacity > 0 ? definition.capacity : Number.POSITIVE_INFINITY;
      const after = Math.min(ceiling, Math.max(0, before + moved));
      return {
        state: { ...state, resources: { ...state.resources, [target]: after } },
        says: `${definition?.name || 'a resource that has gone'} ${before} → ${after}`,
      };
    }
    case 'unlock':
    case 'block': {
      const name = findElement(file, target as never)?.name || 'a node that has gone';
      return {
        state: { ...state, gates: { ...state.gates, [target]: effect.kind === 'unlock' } },
        says: `${name} ${effect.kind === 'unlock' ? 'unlocked' : 'blocked'}`,
      };
    }
    case 'reveal':
    case 'hide': {
      const name = findElement(file, target as never)?.name || 'a node that has gone';
      return {
        state: { ...state, shown: { ...state.shown, [target]: effect.kind === 'reveal' } },
        says: `${name} ${effect.kind === 'reveal' ? 'revealed' : 'hidden'}`,
      };
    }
  }
};

/** Effects, in the order written, each one logged (§16.2). */
export const applyEffects = (
  file: ProjectFile,
  state: PlayState,
  effects: readonly Effect[],
): { state: PlayState; log: Mutation[] } =>
  effects.reduce<{ state: PlayState; log: Mutation[] }>(
    (carried, effect) => {
      const done = applyOne(file, carried.state, effect);
      return { state: done.state, log: [...carried.log, { effect, says: done.says }] };
    },
    { state, log: [] },
  );

/**
 * Take a choice (§16.2).
 *
 * **Availability first, then the effects atomically, then the destination.**
 * A refused choice changes nothing at all — the effects are applied only once
 * the answer is yes, so a simulator that refuses leaves no half-applied state
 * behind.
 *
 * A choice whose *destination* is unavailable is refused rather than silently
 * hidden or silently entered. Hiding it would make a choice vanish for a
 * reason nobody can see; entering would put the player somewhere the rules say
 * they cannot be. Saying so is what a designer can act on, and §12 finds the
 * same thing standing still.
 */
export const choose = (
  file: ProjectFile,
  state: PlayState,
  at: NarrativeElementId,
  choiceId: ChoiceId,
): Move => {
  const standing = evaluate(file, state, at);
  const here = standing?.choices.find((one) => one.choice.id === choiceId);
  if (!standing || !here) {
    return { at, state, log: [], refused: [{ kind: 'missing', says: 'that choice is not offered here' }] };
  }
  if (!here.available) return { at, state, log: [], refused: here.blockedBy };

  // Taking a choice is remembered, for a once-only one (addendum 25 §8).
  const counted: PlayState = {
    ...state,
    taken: { ...(state.taken ?? {}), [choiceId as string]: (state.taken?.[choiceId as string] ?? 0) + 1 },
  };

  const destination = here.choice.toElementId;
  if (destination) {
    const after = applyEffects(file, counted, here.choice.effects);
    const arriving = evaluate(file, after.state, destination);
    if (!arriving || !arriving.available) {
      return { at, state, log: [], refused: arriving?.blockedBy ?? [{ kind: 'missing', says: 'that node has gone' }] };
    }
    const arrived = applyEffects(file, after.state, arriving.element.effects);
    const settled = settle(file, arrived.state, destination);
    return { at: destination, state: settled.state, log: [...after.log, ...arrived.log, ...settled.log], refused: [] };
  }

  const after = applyEffects(file, counted, here.choice.effects);
  const settled = settle(file, after.state, at);
  return { at, state: settled.state, log: [...after.log, ...settled.log], refused: [] };
};

/** Where a run starts: the first entry point, with its arrival effects run. */
export const beginRun = (file: ProjectFile): Move | null => {
  const start = entryPoints(file)[0];
  if (!start) return null;
  const arrived = applyEffects(file, initialState(file), start.effects);
  const settled = settle(file, arrived.state, start.id);
  return { at: start.id, state: settled.state, log: [...arrived.log, ...settled.log], refused: [] };
};

// ------------------------------------ objects, triggers, puzzles (add. 25 §7–§8)

/**
 * The scene a node is in, read through the beat it is bound to. Null for a
 * node bound to nothing: a branch has no scene of its own.
 */
export const sceneOf = (file: ProjectFile, elementId: NarrativeElementId): StructuralUnitId | null => {
  const element = findElement(file, elementId);
  if (!element?.boundBeatId) return null;
  return (file.beats.find((one) => one.id === element.boundBeatId)?.unitId as StructuralUnitId | undefined) ?? null;
};

/** The objects the player can use at a node: placed at it, or in its scene. */
export const objectsAt = (file: ProjectFile, elementId: NarrativeElementId): InteractiveObject[] => {
  const scene = sceneOf(file, elementId);
  return (file.interactiveObjects ?? []).filter(
    (one) => one.placedAt.includes(elementId as string) || (scene !== null && one.placedAt.includes(scene as string)),
  );
};

/** One verb as it currently stands: offered, or not and why — a choice's shape. */
export interface VerbOffer {
  object: InteractiveObject;
  verb: Verb;
  available: boolean;
  blockedBy: Reason[];
}

/**
 * What the player can do to the objects here (addendum 25 §7). **The same
 * reading as a choice's**, through the same `meetsGroup` and the same *not
 * enough to spend* rule, because a verb is a choice that stays where it is.
 */
export const verbsAt = (file: ProjectFile, state: PlayState, at: NarrativeElementId): VerbOffer[] =>
  objectsAt(file, at).flatMap((object) =>
    object.verbs.map((verb) => {
      const met = meetsGroup(file, state, verb.conditions);
      const short = shortOf(file, state, verb.effects);
      return { object, verb, available: met.ok && short.length === 0, blockedBy: [...met.failing, ...short] };
    }),
  );

/** Use a verb: its effects, then whatever that sets off, and the player stays put. */
export const useVerb = (file: ProjectFile, state: PlayState, at: NarrativeElementId, verbId: VerbId): Move => {
  const here = verbsAt(file, state, at).find((one) => one.verb.id === verbId);
  if (!here) return { at, state, log: [], refused: [{ kind: 'missing', says: 'that is not something you can do here' }] };
  if (!here.available) return { at, state, log: [], refused: here.blockedBy };
  const after = applyEffects(file, state, here.verb.effects);
  const settled = settle(file, after.state, at);
  return { at, state: settled.state, log: [...after.log, ...settled.log], refused: [] };
};

/**
 * What a step sets off in the scene the player is in (addendum 25 §7, §8):
 * every trigger whose condition now holds — once for a `once` trigger — and
 * every puzzle whose solution now holds, which is marked solved and runs its
 * `onSolve`.
 *
 * **One pass, in the order written, with no cascade**: a trigger that makes
 * another trigger's condition true fires that one on the next step, not this
 * one. A chain that settled itself would be a loop waiting to happen, and a
 * designer reading the log can see exactly what one step did.
 */
export const settle = (file: ProjectFile, state: PlayState, at: NarrativeElementId): { state: PlayState; log: Mutation[] } => {
  const scene = sceneOf(file, at);
  if (!scene) return { state, log: [] };
  let current = state;
  const log: Mutation[] = [];

  const layers = (file.sceneLayers ?? []).find((one) => one.unitId === scene);
  for (const trigger of layers?.triggers ?? []) {
    if (trigger.once && current.fired?.[trigger.id as string]) continue;
    if (!meetsGroup(file, current, trigger.conditions).ok) continue;
    const done = applyEffects(file, current, trigger.effects);
    current = { ...done.state, fired: { ...(done.state.fired ?? {}), [trigger.id as string]: true } };
    // Each change is said with the trigger that made it, so the log shows
    // what fired without inventing an entry for the firing itself.
    const name = trigger.name.trim() || 'A trigger';
    log.push(...done.log.map((one) => ({ effect: one.effect, says: `${name}: ${one.says}` })));
  }

  for (const puzzle of file.puzzles ?? []) {
    if (puzzle.unitId !== scene) continue;
    const flag = puzzle.solvedStateId as string;
    if (current.states[flag] === 'true') continue;
    if (!meetsGroup(file, current, puzzle.solution).ok) continue;
    const solved = applyEffects(file, current, [
      { kind: 'set', targetId: flag, value: 'true', timing: 'immediate', note: '' },
      ...puzzle.onSolve,
    ]);
    current = solved.state;
    // The first change is the puzzle's own flag, and it is said as what it means.
    const [flagged, ...rest] = solved.log;
    log.push({ effect: flagged!.effect, says: `${puzzle.name.trim() || 'A puzzle'} is solved` }, ...rest);
  }
  return { state: current, log };
};

/** A node's scene's first node, for the checks that ask where a rule sits. */
export const firstNodeInScene = (file: ProjectFile, unitId: StructuralUnitId): NarrativeElement | null => {
  const order = beatsForUnit(file, unitId).map((one) => one.id as string);
  return (
    elementsOf(file)
      .filter((one) => one.boundBeatId !== null && order.includes(one.boundBeatId as string))
      .sort((a, b) => order.indexOf(a.boundBeatId as string) - order.indexOf(b.boundBeatId as string))[0] ?? null
  );
};

// ------------------------------------------------------- reachability

/**
 * Every node the player could ever get to (§4 of the addendum).
 *
 * **A reading, never a stored flag.** There is no `reachable` column, no
 * *validate* command and nowhere to press one: cut the only choice that led
 * somewhere and that somewhere is unreachable the next time anything asks,
 * exactly as cutting a scene turns a characterization item red.
 *
 * It is **structural** — it follows every edge regardless of conditions —
 * and that is a decision rather than a shortcut. *Could the player ever get
 * here* and *can a condition ever be satisfied* are two questions, and the
 * second is §12's own check. Conflating them would draw a node behind a hard
 * but possible gate as unreachable, which is a false alarm; and a validator
 * that cries wolf is one somebody switches off.
 */
export const edgesOut = (file: ProjectFile): ReadonlyMap<string, NarrativeElementId[]> => {
  const out = new Map<string, NarrativeElementId[]>();
  for (const choice of file.choices ?? []) {
    if (!choice.toElementId) continue;
    const from = choice.elementId as string;
    out.set(from, [...(out.get(from) ?? []), choice.toElementId]);
  }
  return out;
};

/**
 * `without` leaves one node out of the walk, which is how stage 3 asks the two
 * questions a plain reachability cannot: *is the thing that unlocks this door
 * behind the door*, and *can a path reach an ending without passing the node
 * the designer marked mandatory*. Both are the same walk with one node removed,
 * which is why it is a parameter here rather than a second copy over there.
 */
export const reachable = (
  file: ProjectFile,
  options: { without?: NarrativeElementId } = {},
): ReadonlySet<string> => {
  const out = edgesOut(file);
  const skip = options.without ? (options.without as string) : null;

  const found = new Set<string>();
  const queue = entryPoints(file)
    .map((one) => one.id)
    .filter((one) => (one as string) !== skip);
  while (queue.length > 0) {
    const here = queue.shift()!;
    if (found.has(here as string)) continue;
    found.add(here as string);
    for (const next of out.get(here as string) ?? []) {
      if ((next as string) !== skip) queue.push(next);
    }
  }
  return found;
};

/** The nodes nothing can reach — §12's first finding, read the other way. */
export const unreachable = (file: ProjectFile): NarrativeElement[] => {
  const found = reachable(file);
  return elementsOf(file).filter((one) => !found.has(one.id as string));
};

/**
 * How far each node is from a start, in choices.
 *
 * This is what the canvas ranks by (§1 of the addendum): the layout is derived
 * from the graph rather than dragged, so a node added by drawing an edge takes
 * its place without anybody arranging it. Unreachable nodes are absent, which
 * is the map's problem to draw rather than this function's to guess at.
 */
export const depths = (file: ProjectFile): ReadonlyMap<string, number> => {
  const out = edgesOut(file);
  const depth = new Map<string, number>();
  let edge = entryPoints(file).map((one) => one.id as string);
  let step = 0;
  while (edge.length > 0) {
    const next: string[] = [];
    for (const here of edge) {
      if (depth.has(here)) continue;
      depth.set(here, step);
      for (const to of out.get(here) ?? []) if (!depth.has(to as string)) next.push(to as string);
    }
    edge = next;
    step += 1;
  }
  return depth;
};
