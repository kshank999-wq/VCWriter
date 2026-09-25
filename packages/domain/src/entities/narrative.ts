import { z } from 'zod';
import { id, orderKey, timestamps } from './common.js';
import type {
  BeatId,
  ChoiceId,
  NarrativeElementId,
  ObjectiveId,
  ProjectId,
  QuestId,
  BehaviourId,
  CharacterId,
  SceneLayersId,
  InteractiveObjectId,
  VerbId,
  TriggerId,
  EnvironmentId,
  MechanicId,
  PuzzleId,
  PuzzleComponentId,
  ShotId,
  LocationId,
  ResourceDefinitionId,
  StructuralUnitId,
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

// ----------------------------------------------------------- endings (§11)

/**
 * One thing that earns an ending, and how much it counts for.
 *
 * §11 asks the system to *distinguish hard requirements from weighted
 * contributors*, and the audit inside the module's own spec is that **a hard
 * requirement is already a condition**: an ending is a node, a node is gated by
 * a `ConditionGroup`, and stages 2, 3 and 5 already evaluate, check and edit
 * it. Nothing to build.
 *
 * A weight is the half that genuinely is new, because **a condition group is
 * boolean and a weight is not**: a group answers *may this happen*, and a
 * contributor answers *how much of this ending has been earned*. Summing
 * booleans is not something a condition does.
 *
 * But the *test* is the same test, so this is a `Condition` with a number on
 * it — which means `sayCondition` already reads it back, `meets` already
 * evaluates it, and the rule builder's row already edits it. The seventh time
 * this project has found the general mechanism already built.
 */
export const endingContributorSchema = z.object({
  condition: conditionSchema,
  /** How much it adds. Negative is legal: some things count against. */
  weight: z.number().default(0),
  note: z.string().default(''),
});
export type EndingContributor = z.infer<typeof endingContributorSchema>;

// ------------------------------------------- dialogue and shots (add. 25 §6, §8)

/**
 * One line of dialogue on a node that is not bound to a beat (addendum 25 §6).
 *
 * A conversation or a cinematic bound to a beat keeps its words in the
 * manuscript, as a scene does; this is for the unbound one, which addendum
 * 18 §12 found had nowhere to put a line.
 */
export const dialogueLineSchema = z.object({
  characterId: id<CharacterId>().nullable().default(null),
  text: z.string().default(''),
  /** *Barely a whisper.* The parenthetical, in a script's terms. */
  direction: z.string().default(''),
});
export type DialogueLine = z.infer<typeof dialogueLineSchema>;

/**
 * One shot of a cinematic (spec §10). Presentation, so nothing evaluates it;
 * the node's own effects are what the cinematic changes. `seconds` is a
 * label, as a beat's timing is.
 */
export const shotSchema = z.object({
  id: id<ShotId>(),
  camera: z.string().default(''),
  action: z.string().default(''),
  lines: z.array(dialogueLineSchema).default([]),
  audio: z.string().default(''),
  seconds: z.number().int().min(0).default(0),
});
export type Shot = z.infer<typeof shotSchema>;

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
  /**
   * What earns this ending, and how much (§11). Meaningful only where the node
   * is one, exactly as `feeds` is meaningful only on ammunition.
   *
   * **An ending is a node and not a second record.** §7's table called an
   * `EndingDefinition` new, and it is not: a second object for the same thing
   * would need a join kept in step, and the moment it drifted the map and the
   * matrix would disagree about what the ending requires.
   */
  contributors: z.array(endingContributorSchema).default([]),
  /**
   * The score an ending needs, where it is scored at all.
   *
   * **Whether it is scored is read rather than declared** — an ending with
   * contributors is scored and one without is deterministic, so there is no
   * switch to set wrongly and no way for the switch and the rules to disagree.
   */
  threshold: z.number().default(0),
  /** The other side's lines, for a conversation or a cinematic not bound to a beat (addendum 25 §6). */
  lines: z.array(dialogueLineSchema).default([]),
  /** A cinematic's shots, in order (addendum 25 §8). Empty on every other kind. */
  shots: z.array(shotSchema).default([]),
  /** Whether the player may skip it. Meaningful on a cinematic. */
  skippable: z.boolean().default(true),
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
  /**
   * Whether it can be taken twice (addendum 25 §8). *Once* is read by the one
   * `evaluate`: a once-only choice already taken is not offered, and says so.
   * Repeatable is the default because it is what every choice did before.
   */
  repeat: z.enum(['repeatable', 'once']).default('repeatable'),
  /** A timed choice's seconds, for Game Studio. A label: there is no clock here. */
  timedSeconds: z.number().int().min(0).default(0),
  ...timestamps,
});
export type Choice = z.infer<typeof choiceSchema>;

// ------------------------------------------ objectives and quests (add. 25 §3)

/**
 * What the player has to do: *find the vault key* (addendum 25 §3).
 *
 * The Player Lane is mostly a **reading** — what the player decides, gets,
 * spends and learns is already written down on the nodes and their choices.
 * An objective is the one thing that is not: it is not a choice, a resource or
 * a state, and addendum 18 §7 already said a setup-and-payoff is not close
 * enough. So it is the lane's one stored record.
 *
 * **Its completion is a condition**, so the one `evaluate` decides it, the rule
 * builder edits it and `sayCondition` reads it back. Nothing new evaluates
 * anything, and there is no stored *done* flag: whether an objective is done is
 * read off the player's state, like everything else in a run.
 */
export const objectiveSchema = z.object({
  id: id<ObjectiveId>(),
  projectId: id<ProjectId>(),
  /** *Find the vault key.* What the Player Lane shows. */
  name: z.string().default(''),
  note: z.string().default(''),
  /** The scene it sits under on the lane, or null for one not yet placed. */
  unitId: id<StructuralUnitId>().nullable().default(null),
  /** The quest it is a step of, if any. */
  questId: id<QuestId>().nullable().default(null),
  /**
   * The scene is not complete without it — which is all *scene completion*
   * means (spec §9): a scene's mandatory objectives, read, not a second rule.
   */
  mandatory: z.boolean().default(true),
  /** What makes it done. Empty is done on arrival, like an ungated node. */
  complete: conditionGroupSchema.default(emptyConditions()),
  /** Its order within its scene, and within its quest. */
  orderKey: orderKey(),
  ...timestamps,
});
export type Objective = z.infer<typeof objectiveSchema>;

/**
 * Objectives in order: *a small state machine* (addendum 18 §7), whose state
 * is which of its objectives are done — a reading too, so a quest stores only
 * its name. Its steps are the objectives that name it.
 */
export const questSchema = z.object({
  id: id<QuestId>(),
  projectId: id<ProjectId>(),
  name: z.string().default(''),
  note: z.string().default(''),
  orderKey: orderKey(),
  ...timestamps,
});
export type Quest = z.infer<typeof questSchema>;

// ------------------------------------- a scene's four layers (add. 25 §5)

/**
 * What one character does in a scene, and when (spec §6, layer 2).
 *
 * Written for the people who build the scene and exported for Game Studio;
 * nothing evaluates the words. The condition is a real one, so *she moves
 * ahead if trusted* is `trust_mara at least 1` and the rule builder, the
 * checks and a rename all reach it.
 */
export const behaviourSchema = z.object({
  id: id<BehaviourId>(),
  characterId: id<CharacterId>().nullable().default(null),
  /**
   * *Follow*, *patrol*, *flee*… Free text with suggestions, for `GAME_TYPES`'
   * reason: the list a designer needs is always one longer than ours.
   */
  kind: z.string().default(''),
  note: z.string().default(''),
  /** When it applies. Empty is always. */
  conditions: conditionGroupSchema.default(emptyConditions()),
});
export type Behaviour = z.infer<typeof behaviourSchema>;

/**
 * Something that happens in a scene when a condition becomes true (spec §9):
 * *the lantern flickers when the oil runs low*. Its kind is free text with
 * suggestions — proximity, timer, state change — because only Game Studio
 * cares what makes it physically fire. **What it does is ordinary effects**,
 * applied by the one evaluator after every step while its condition holds;
 * a `once` trigger fires the first time only.
 */
export const triggerSchema = z.object({
  id: id<TriggerId>(),
  name: z.string().default(''),
  kind: z.string().default(''),
  conditions: conditionGroupSchema.default(emptyConditions()),
  effects: z.array(effectSchema).default([]),
  once: z.boolean().default(true),
});
export type Trigger = z.infer<typeof triggerSchema>;

/** Spec §6, layer 4: how the scene is presented. Text, for the people who build it. */
export const presentationSchema = z.object({
  music: z.string().default(''),
  ambience: z.string().default(''),
  sound: z.string().default(''),
  camera: z.string().default(''),
  cinematic: z.string().default(''),
  atmosphere: z.string().default(''),
});
export type Presentation = z.infer<typeof presentationSchema>;

/**
 * The two layers of a game scene that nothing else holds (addendum 25 §5):
 * behaviour and presentation. **A collection of its own, keyed by the scene,
 * rather than fields on the unit**, because a unit is shared by every format
 * and a screenplay's scene has no NPC behaviour to carry. Layers 1 and 3 are
 * readings of the unit and its nodes and store nothing here.
 */
export const sceneLayersSchema = z.object({
  id: id<SceneLayersId>(),
  projectId: id<ProjectId>(),
  unitId: id<StructuralUnitId>(),
  behaviours: z.array(behaviourSchema).default([]),
  presentation: presentationSchema.default({}),
  triggers: z.array(triggerSchema).default([]),
  ...timestamps,
});
export type SceneLayers = z.infer<typeof sceneLayersSchema>;

// ------------------------------------ objects, environment, puzzles (add. 25 §7, §8)

/**
 * Something the player can do to an interactive object: *pull* the lever.
 * **A verb is a choice that stays where it is** — its conditions and effects
 * are the types every rule uses, so the builder edits them and `evaluate`'s
 * own helpers decide them.
 */
export const verbSchema = z.object({
  id: id<VerbId>(),
  name: z.string().default(''),
  conditions: conditionGroupSchema.default(emptyConditions()),
  effects: z.array(effectSchema).default([]),
});
export type Verb = z.infer<typeof verbSchema>;

/**
 * An interactive object, a *smart object* (spec §9): a lever, a door, a
 * collapsing ledge.
 *
 * **Its state is a state definition it owns** — an enum whose values are the
 * object's states — so *the lever is up* is an ordinary condition and
 * *pulling it* is an ordinary `set`. There is no second mechanism for object
 * state, and the checks, the rule builder and a rename all reach it.
 */
export const interactiveObjectSchema = z.object({
  id: id<InteractiveObjectId>(),
  projectId: id<ProjectId>(),
  name: z.string().default(''),
  note: z.string().default(''),
  /** The owned state. Its `choices` are the object's states. */
  stateId: id<StateDefinitionId>(),
  /** Where it is: scene ids and node ids. The verbs are offered there. */
  placedAt: z.array(z.string()).default([]),
  verbs: z.array(verbSchema).default([]),
  ...timestamps,
});
export type InteractiveObject = z.infer<typeof interactiveObjectSchema>;

/**
 * One environmental mechanic, as authored intent (spec §9): darkness, a
 * crawl, rising water. **All text, and nothing evaluates it** — VC Writer
 * says what should happen and Game Studio makes it physical. Where a
 * mechanic has a rule (*the lantern drains in the dark*), the rule is a
 * trigger, which does evaluate.
 */
export const mechanicSchema = z.object({
  id: id<MechanicId>(),
  /** *Darkness*, *traversal*, *hazard*… free text with suggestions. */
  kind: z.string().default(''),
  /** *Crawl*, *collapse*, *rising water*. */
  variant: z.string().default(''),
  note: z.string().default(''),
  /** Numbers and settings for Game Studio, in the designer's words. */
  params: z.string().default(''),
});
export type Mechanic = z.infer<typeof mechanicSchema>;

/**
 * A location's mechanics, on a game (addendum 25 §7). **A collection of its
 * own keyed by the location**, not a field on it, for the scene layers'
 * reason: locations are shared by every format and synchronised, and a
 * screenplay's place has no mechanics to carry.
 */
export const environmentSchema = z.object({
  id: id<EnvironmentId>(),
  projectId: id<ProjectId>(),
  locationId: id<LocationId>(),
  mechanics: z.array(mechanicSchema).default([]),
  ...timestamps,
});
export type Environment = z.infer<typeof environmentSchema>;

export const puzzleComponentSchema = z.object({
  id: id<PuzzleComponentId>(),
  name: z.string().default(''),
  note: z.string().default(''),
});
export type PuzzleComponent = z.infer<typeof puzzleComponentSchema>;

/**
 * A puzzle (spec §9): an objective, its parts, and **a solution that is a
 * condition** — *the lever is up and the player holds the key*.
 *
 * Solved is **a flag the puzzle owns**, set by the one evaluator the moment
 * the solution holds, and `onSolve` runs once then. Everything else reads the
 * flag like any state, so a door gated on the puzzle is an ordinary gate.
 * Failure and reset are words for Game Studio; there is no clock or attempt
 * counter here to evaluate them against.
 */
export const puzzleSchema = z.object({
  id: id<PuzzleId>(),
  projectId: id<ProjectId>(),
  name: z.string().default(''),
  /** What the player is trying to do, in words. */
  objective: z.string().default(''),
  note: z.string().default(''),
  /** The scene it is in, where its solution is checked. */
  unitId: id<StructuralUnitId>().nullable().default(null),
  components: z.array(puzzleComponentSchema).default([]),
  solution: conditionGroupSchema.default(emptyConditions()),
  hints: z.array(z.string()).default([]),
  onSolve: z.array(effectSchema).default([]),
  /** What failing looks like, and whether it resets. For Game Studio. */
  failure: z.string().default(''),
  /** The owned flag: true once solved. */
  solvedStateId: id<StateDefinitionId>(),
  ...timestamps,
});
export type Puzzle = z.infer<typeof puzzleSchema>;

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
