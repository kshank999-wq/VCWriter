import { z } from 'zod';
import { id, orderKey, timestamps } from './common.js';
import type {
  BeatId,
  ChoiceId,
  NarrativeElementId,
  ProjectId,
  ResourceDefinitionId,
  SimulationRunId,
  StateDefinitionId,
} from '../ids.js';

/**
 * The interactive narrative graph (addendum 18 §7).
 *
 * Read §2 of the addendum before changing anything here, because the shapes
 * below are that argument written down: **a choice is not an edge.** Three
 * things are kept apart on purpose —
 *
 * - an **edge** (`toElementId` on a choice) answers *where does the player go*;
 * - an **effect** answers *what changed*, and hangs on the **choice**;
 * - a **condition** answers *what may happen here*, and hangs on the **thing
 *   that is gated**.
 *
 * Every tool in the field hangs the logic on the connector, and §5 of the spec
 * is what that cannot express: a consequence fifty nodes away has no connector
 * to live on. Put an effect on an edge and *delayed* and *cumulative* become
 * impossible to author, which is most of what "limited" means.
 */

// --------------------------------------------------------------- state (§6)

/**
 * What kind of thing a state holds.
 *
 * Four, and the list is short because §6's examples collapse: a relationship
 * score and an evidence count are both numbers, and an inventory count is a
 * **resource**, which is its own record because §7 asks about where it comes
 * from and where it goes.
 */
export const stateKindSchema = z.enum(['flag', 'number', 'enum', 'text']);
export type StateKind = z.infer<typeof stateKindSchema>;

/**
 * A named piece of the player's history (§6).
 *
 * **Referenced by id, never by name** (§16 of the spec, §6 of the addendum).
 * In Twine a variable is a string inside a macro, so renaming it means editing
 * every passage that mentions it and missing one. Here a rename is one field
 * and every condition and effect follows, exactly as renaming a book-index
 * heading does — and it is what makes *set but never read* answerable at all,
 * because the references are structural rather than textual.
 *
 * `key` is the designer's handle (`trust_mara`) and is theirs to change; the
 * id is what anything else holds.
 */
export const stateDefinitionSchema = z.object({
  id: id<StateDefinitionId>(),
  projectId: id<ProjectId>(),
  /** `trust_mara`, `guard_spared`. Shown in rules; never referenced by it. */
  key: z.string().default(''),
  /** What it is for, in the designer's words. */
  note: z.string().default(''),
  kind: stateKindSchema.default('flag'),
  /** Where it starts. A flag's `''` reads false; a number's reads zero. */
  initial: z.string().default(''),
  /** The permitted values, for `enum`. Empty on every other kind. */
  choices: z.array(z.string()).default([]),
  ...timestamps,
});
export type StateDefinition = z.infer<typeof stateDefinitionSchema>;

// ----------------------------------------------------------- resources (§7)

/**
 * What a countable thing is (§7).
 *
 * **One record with a kind rather than eight tables.** §7's bullets — weapons,
 * ammunition, health, power-ups, abilities, key items, currency, collectibles
 * — differ in what a designer *says* about them and not in what they are: each
 * is something the player has some of, acquired somewhere and spent somewhere,
 * and §12's two economy checks ask the same question of all of them.
 *
 * The kind is not decoration: it is what lets a weapon be listed beside its
 * ammunition and what makes *a weapon with no compatible ammunition* a
 * checkable sentence rather than a guess.
 */
export const resourceKindSchema = z.enum([
  'weapon',
  'ammunition',
  'consumable',
  'currency',
  'key_item',
  'ability',
  'upgrade',
  'collectible',
]);
export type ResourceKind = z.infer<typeof resourceKindSchema>;

export const resourceDefinitionSchema = z.object({
  id: id<ResourceDefinitionId>(),
  projectId: id<ProjectId>(),
  name: z.string().default(''),
  kind: resourceKindSchema.default('consumable'),
  note: z.string().default(''),
  /** How many the player starts with. */
  initial: z.number().int().default(0),
  /**
   * The most that can be held, or zero for no ceiling.
   *
   * Zero rather than null because *no ceiling* and *a ceiling of none* are
   * different things and only one of them is meant.
   */
  capacity: z.number().int().min(0).default(0),
  /**
   * Which weapons this ammunition is for (§7, §12).
   *
   * Only meaningful on `ammunition`, and the reason it is here rather than on
   * the weapon is that §12 asks the question from the weapon's end — *a weapon
   * introduced without compatible ammunition* — and a reading can invert a
   * list where it cannot invent one.
   */
  feeds: z.array(id<ResourceDefinitionId>()).default([]),
  /**
   * Where it sits in the progression the designer intends (§7), or 0 for
   * unranked.
   *
   * One of the **three** things in §7's eight bullets that a reading cannot
   * work out. An ability granted in the first hour can be a late-tier ability
   * and an early-tier one can be handed over last, so the graph cannot tell
   * where something belongs in a progression — only where it happens to be
   * given out. Everything else §7 asks for (acquisition points, sources,
   * sinks, use points, prerequisites, thresholds) is read off the graph in
   * `narrative-economy.ts`.
   */
  tier: z.number().int().min(0).default(0),
  /**
   * The one it replaces, for §7's *upgrades* and *alternate variants*.
   *
   * The second unreadable thing: two rifles both granted somewhere, and
   * nothing in the graph says one supersedes the other.
   */
  upgradeOf: id<ResourceDefinitionId>().nullable().default(null),
  /**
   * §7's *scarcity target*, in the designer's own words — *about 30 rounds by
   * the reactor*.
   *
   * The third, and an intention rather than a fact: what the player **should**
   * have is not something any count of grants can discover, and nothing
   * evaluates it.
   */
  scarcityTarget: z.string().default(''),
  ...timestamps,
});
export type ResourceDefinition = z.infer<typeof resourceDefinitionSchema>;

// -------------------------------------------------------------- conditions

/**
 * How a stored value is compared with the one a rule names.
 *
 * Named `test` rather than `comparison` because `Comparison` is already the
 * room AI's word for two drafts held side by side (addendum 07 §12), and one
 * name for two unrelated things is how a domain stops being readable.
 */
export const testSchema = z.enum(['is', 'is_not', 'at_least', 'at_most', 'more_than', 'less_than']);
export type Test = z.infer<typeof testSchema>;

/**
 * What a rule asks about one thing.
 *
 * A **state** or a **resource**, and nothing else — because those are the only
 * two things the player carries. *Has the player been here* is a state the
 * visit sets, and making visits a third kind of subject would be a second
 * mechanism for something the first already does.
 */
export const conditionSchema = z.object({
  subject: z.enum(['state', 'resource']),
  /** A `StateDefinitionId` or a `ResourceDefinitionId`, by subject. */
  subjectId: z.string(),
  op: testSchema.default('is'),
  /** Compared as a number where the subject is one, and as text otherwise. */
  value: z.string().default(''),
});
export type Condition = z.infer<typeof conditionSchema>;

/**
 * Conditions, grouped (§15.3).
 *
 * ALL / ANY / NOT, one level of nesting, and the nesting is what makes the
 * builder readable rather than a parenthesis-counting exercise. An empty group
 * is **satisfied** — a thing with no conditions is available, which is the only
 * answer that makes a new node usable before anybody has written a rule.
 */
export interface ConditionGroup {
  join: 'all' | 'any' | 'none';
  conditions: Condition[];
  groups: ConditionGroup[];
}

export const conditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.object({
    join: z.enum(['all', 'any', 'none']).default('all'),
    conditions: z.array(conditionSchema).default([]),
    groups: z.array(conditionGroupSchema).default([]),
  }),
) as z.ZodType<ConditionGroup>;

export const emptyConditions = (): ConditionGroup => ({ join: 'all', conditions: [], groups: [] });

// ----------------------------------------------------------------- effects

/**
 * What a choice changes.
 *
 * Eight kinds, and four of them are **the designer's vocabulary over one
 * mechanism**. `unlock`, `block`, `reveal` and `hide` name an *element* rather
 * than a state, and the evaluator keeps the state for them — so §4.1's words
 * survive into the interface without the designer having to invent a flag
 * called `tunnel_unlocked` and remember to read it. One mechanism underneath,
 * the designer's words on top.
 *
 * What is deliberately **not** here:
 *
 * - **Leads to** — that is the choice's destination, not an effect.
 * - **Requires** — that is a condition on the thing required.
 * - **Converges** — that is two edges into one node, and needs no word.
 * - **Delays** — §5's delayed consequence is a state set now and read later.
 *   There is no scheduler, because the absence *is* the mechanism: sparing the
 *   engineer writes a flag in hour one and the reactor reads it in hour nine.
 * - **Escalates** — that is `add` on a number.
 * - **Causes ending** — that is an ending's condition reading state.
 */
export const effectKindSchema = z.enum([
  /** Put a value in a state. */
  'set',
  /** Move a number by an amount, which may be negative. */
  'add',
  /** Give the player some of a resource. */
  'grant',
  /** Take some away. Never below zero, and §12 asks whether it could run out. */
  'consume',
  'unlock',
  'block',
  'reveal',
  'hide',
]);
export type EffectKind = z.infer<typeof effectKindSchema>;

/**
 * When a consequence lands, **as a label** (§4.3, §5).
 *
 * The spec asks the choice record to say whether a consequence is immediate,
 * delayed, cumulative or hidden, and this is that — *and nothing evaluates
 * it*. It is said for the designer and for §18's reports.
 *
 * Saying so here matters: a field that looks as though it schedules something
 * and does not is the worst kind of field. What actually makes a consequence
 * late is that the condition reading it is far away.
 */
export const effectTimingSchema = z.enum(['immediate', 'delayed', 'cumulative', 'hidden']);
export type EffectTiming = z.infer<typeof effectTimingSchema>;

export const effectSchema = z.object({
  kind: effectKindSchema.default('set'),
  /**
   * What is affected: a state, a resource, or — for the four element verbs —
   * a `NarrativeElementId`. Which it is follows from `kind`.
   */
  targetId: z.string(),
  /** The value to set, or the amount to add, grant or consume. */
  value: z.string().default(''),
  /** A label for the designer and the reports (§4.3). Nothing reads it. */
  timing: effectTimingSchema.default('immediate'),
  note: z.string().default(''),
});
export type Effect = z.infer<typeof effectSchema>;

// ---------------------------------------------------------------- elements

/**
 * What kind of thing a node is (§3).
 *
 * The kinds change what the node is *drawn* as and what the designer is asked
 * for; they change nothing about evaluation, which is why a game that wants a
 * kind this list has not got loses nothing by calling it something near.
 */
export const narrativeKindSchema = z.enum([
  'scene',
  'encounter',
  'conversation',
  'cinematic',
  'mission',
  'hub',
  'state_change',
  'ending',
]);
export type NarrativeKind = z.infer<typeof narrativeKindSchema>;

export const narrativeElementSchema = z.object({
  id: id<NarrativeElementId>(),
  projectId: id<ProjectId>(),
  name: z.string().default(''),
  kind: narrativeKindSchema.default('scene'),
  note: z.string().default(''),
  /**
   * The beat this node **is**, where it is one (§3 of the addendum).
   *
   * The spine is the manuscript, so a node that is a scene points at the beat
   * whose words it holds rather than keeping a second copy of them. Null is
   * ordinary and expected: a cinematic, a hub, a state change with nothing
   * written yet. **Binding is an offer, never a requirement.**
   */
  boundBeatId: id<BeatId>().nullable().default(null),
  /**
   * The player can start here.
   *
   * Reachability walks from these (§4 of the addendum), so a graph with none
   * has nothing reachable — which is true, and is one of §12's findings rather
   * than something to paper over with a guess at which node came first.
   */
  entry: z.boolean().default(false),
  /**
   * A path that stops here is **meant** to stop here.
   *
   * §12 asks for *dead-end branches that are not intentional endings or fail
   * states*, and the qualifier is the whole of it: a validator that cannot be
   * told it is wrong becomes noise, and noise gets switched off. An ending and
   * a fail state both set this; so does a stub the designer knows about.
   */
  endsHere: z.boolean().default(false),
  /** Part of §2.3's spine: the story does not work without it. */
  mandatory: z.boolean().default(false),
  /** What must be true for the player to be here at all (§4.1 *Requires*). */
  conditions: conditionGroupSchema.default(emptyConditions()),
  /** Applied on arrival, before any choice is offered. */
  effects: z.array(effectSchema).default([]),
  ...timestamps,
});
export type NarrativeElement = z.infer<typeof narrativeElementSchema>;

// ----------------------------------------------------------------- choices

export const choiceSchema = z.object({
  id: id<ChoiceId>(),
  /** The node this is offered at. A choice never floats. */
  elementId: id<NarrativeElementId>(),
  /** What the designer calls it in the rules and the reports. */
  name: z.string().default(''),
  /** What the player reads or does. */
  text: z.string().default(''),
  orderKey: orderKey(),
  /** Whether it is offered (§4.3 *availability conditions*). */
  conditions: conditionGroupSchema.default(emptyConditions()),
  /** What taking it changes (§4.3). */
  effects: z.array(effectSchema).default([]),
  /**
   * Where the player goes — **the edge, and the only one**.
   *
   * Null is legal and is not an oversight: a choice that changes the world and
   * leaves the player where they were is an ordinary thing (examining, taking,
   * refusing), and §12 asks about a choice with *no consequence **and** no
   * destination*, which is a different and emptier thing.
   */
  toElementId: id<NarrativeElementId>().nullable().default(null),
  note: z.string().default(''),
  ...timestamps,
});
export type Choice = z.infer<typeof choiceSchema>;

// ------------------------------------------------------- a playthrough (§13)

/**
 * A saved path through the game, and **the one thing in this module that is
 * stored**.
 *
 * Everything else here is a reading, because everything else is a fact about
 * the work: whether a node can be reached, what a resource costs, whether a
 * rule can ever be satisfied. A playthrough is not a fact about the work at
 * all — it is a record of what a person did one afternoon, which nothing can
 * derive from the graph. That is the whole of why it has a table when
 * reachability does not.
 *
 * And it stores **what was chosen, never what the game did**. The states, the
 * counts and the log are all read back by replaying the choices through stage
 * 2, which is deterministic — so storing them would be keeping a second answer
 * about a version of the game that may no longer exist. Replaying an old path
 * against today's graph is not a limitation of this design; it is the feature:
 * **a recorded path that no longer runs is the finding**, and the step it
 * breaks at is the one that changed.
 */
export const simulationRunSchema = z.object({
  id: id<SimulationRunId>(),
  projectId: id<ProjectId>(),
  /** What the designer called this path. */
  name: z.string().default(''),
  /** §13's *start at any node*, so not necessarily an entry point. */
  startedAt: id<NarrativeElementId>(),
  /** The choices taken, in order, and nothing else. */
  steps: z.array(id<ChoiceId>()).default([]),
  note: z.string().default(''),
  ...timestamps,
});
export type SimulationRun = z.infer<typeof simulationRunSchema>;
