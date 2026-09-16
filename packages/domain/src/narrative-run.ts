import { choicesAt, findChoice, findElement, entryPoints } from './narrative.js';
import { choose, evaluate, initialState } from './narrative-eval.js';
import { simulationRunSchema } from './entities/narrative.js';
import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import type { Choice, NarrativeElement, SimulationRun } from './entities/narrative.js';
import type { Mutation, PlayState, Reason, Situation } from './narrative-eval.js';
import type { ChoiceId, NarrativeElementId, SimulationRunId } from './ids.js';
import type { ProjectFile } from './project-file.js';

/** Same as everywhere else in this module: a change stamps the project. */
const touch = (file: ProjectFile): ProjectFile => ({
  ...file,
  project: { ...file.project, updatedAt: nowIso() },
});

/**
 * Interactive Narrative: the simulator (addendum 18, stage 7 — §13).
 *
 * **Nothing here decides anything.** Every question the simulator asks — what
 * is offered, why something is not, what a choice changes, where it leads — is
 * `evaluate` and `choose` from stage 2, which the map and the validator also
 * call. That was the point of stage 2: a simulator that answered differently
 * from the picture beside it would be worse than no simulator, because a
 * designer would have to work out which of them to believe.
 *
 * The one decision this stage makes is what a saved path **is**.
 *
 * A run stores **the choices, and never the states**. Stage 2 is
 * deterministic, so the counts, the flags and the log are all read back by
 * replaying those choices; keeping them as well would be keeping a second
 * answer about a version of the game that may no longer exist. Which makes
 * replaying an old path against today's graph the feature rather than the
 * limitation: **a recorded path that no longer runs is the finding**, and the
 * step it breaks at is the one that changed. Nothing else in this module can
 * tell a designer *the route I walked last week has stopped working*.
 */

// ------------------------------------------------------------ the recording

export const runsOf = (file: ProjectFile): SimulationRun[] => file.simulationRuns ?? [];

export const findRun = (file: ProjectFile, runId: SimulationRunId): SimulationRun | null =>
  runsOf(file).find((one) => one.id === runId) ?? null;

/**
 * Begin a path.
 *
 * §13's *start at any node*: a designer testing the third act should not have
 * to walk the first two, so the start is offered rather than assumed — and
 * where nobody says, the entry point is the sensible guess and not a rule.
 */
export const startRun = (
  file: ProjectFile,
  input: { startedAt?: NarrativeElementId | null; name?: string } = {},
): { file: ProjectFile; run: SimulationRun } | null => {
  const at = input.startedAt ?? entryPoints(file)[0]?.id ?? null;
  if (!at || !findElement(file, at)) return null;
  const now = nowIso();
  const run = simulationRunSchema.parse({
    id: newId<SimulationRunId>(),
    projectId: file.project.id,
    name: input.name ?? '',
    startedAt: at,
    steps: [],
    createdAt: now,
    updatedAt: now,
  });
  return { file: touch({ ...file, simulationRuns: [...runsOf(file), run] }), run };
};

export const updateRun = (
  file: ProjectFile,
  runId: SimulationRunId,
  patch: Partial<Omit<SimulationRun, 'id' | 'projectId' | 'createdAt'>>,
): ProjectFile => {
  if (!findRun(file, runId)) return file;
  return touch({
    ...file,
    simulationRuns: runsOf(file).map((one) =>
      one.id === runId ? simulationRunSchema.parse({ ...one, ...patch, updatedAt: nowIso() }) : one,
    ),
  });
};

export const removeRun = (file: ProjectFile, runId: SimulationRunId): ProjectFile =>
  touch({ ...file, simulationRuns: runsOf(file).filter((one) => one.id !== runId) });

/**
 * Take a choice, and record it **only if it happened**.
 *
 * A move stage 2 refuses did not happen — the door was shut and the player is
 * still where they were — so appending it would write a step no player could
 * have taken and leave the path broken from the moment it was walked. The
 * refusal comes back instead, in the sentence the domain already built, and it
 * is the caller's business to say it out loud.
 *
 * Which keeps the recording honest in both directions: a step is in the path
 * because it worked at the time, and a step that stops working later is the
 * graph having moved underneath it.
 */
export const recordStep = (
  file: ProjectFile,
  runId: SimulationRunId,
  choiceId: ChoiceId,
): { file: ProjectFile; refused: Reason[] } => {
  const run = findRun(file, runId);
  if (!run) return { file, refused: [{ kind: 'missing', says: 'that path has gone' }] };
  const played = replayRun(file, run);
  if (!played.at) return { file, refused: [{ kind: 'missing', says: 'the node it started at has gone' }] };
  const move = choose(file, played.state, played.at.id, choiceId);
  if (move.refused.length > 0) return { file, refused: move.refused };
  return { file: updateRun(file, runId, { steps: [...run.steps, choiceId] }), refused: [] };
};

/**
 * Take the last step back.
 *
 * There is no *undo the state*, because no state was stored: dropping the
 * choice and replaying is the same thing and cannot get out of step with
 * itself.
 */
export const stepBack = (file: ProjectFile, runId: SimulationRunId): ProjectFile => {
  const run = findRun(file, runId);
  if (!run || run.steps.length === 0) return file;
  return updateRun(file, runId, { steps: run.steps.slice(0, -1) });
};

// -------------------------------------------------------------- the replay

export interface PlayedStep {
  /** The choice taken, or null where it has been cut out of the game. */
  choice: Choice | null;
  from: NarrativeElement;
  /** Where it led, or null where it stayed put or the path broke. */
  to: NarrativeElement | null;
  /** Every change it made, in order — §16.2's *log every state mutation*. */
  log: Mutation[];
  /** Why the step no longer works. Empty while the path still runs. */
  refused: Reason[];
}

export interface Played {
  run: SimulationRun;
  steps: PlayedStep[];
  /** Where the player is now, or null where the start itself has gone. */
  at: NarrativeElement | null;
  /** What is offered there, and why anything is not. */
  situation: Situation | null;
  state: PlayState;
  /**
   * The index of the first step that no longer runs, or null while the whole
   * path still works. **This is what a saved run is for**: the graph moved and
   * the route walked last week stops here.
   */
  brokenAt: number | null;
}

/**
 * Walk a recorded path against the graph as it stands now.
 *
 * It refuses to guess past a break. Once a step cannot be taken the run stops
 * there, because everything after it was chosen in a game that no longer
 * exists and pretending otherwise would put a state on the screen that no
 * player could ever hold.
 */
export const replayRun = (file: ProjectFile, run: SimulationRun): Played => {
  const start = findElement(file, run.startedAt);
  if (!start) {
    return {
      run,
      steps: [],
      at: null,
      situation: null,
      state: initialState(file),
      brokenAt: run.steps.length > 0 ? 0 : null,
    };
  }

  let state = initialState(file);
  let at: NarrativeElementId = start.id;
  const steps: PlayedStep[] = [];
  let brokenAt: number | null = null;

  for (const [index, choiceId] of run.steps.entries()) {
    const from = findElement(file, at)!;
    const choice = findChoice(file, choiceId);
    if (!choice) {
      // The designer cut the choice. That is the most ordinary break there is,
      // and it deserves a sentence rather than a silent stop.
      steps.push({
        choice: null,
        from,
        to: null,
        log: [],
        refused: [{ kind: 'missing', says: 'that choice has been cut from the game' }],
      });
      brokenAt = index;
      break;
    }
    const move = choose(file, state, at, choiceId);
    if (move.refused.length > 0) {
      steps.push({ choice, from, to: null, log: [], refused: move.refused });
      brokenAt = index;
      break;
    }
    state = move.state;
    const landed = move.at;
    steps.push({
      choice,
      from,
      to: landed === at ? null : findElement(file, landed),
      log: move.log,
      refused: [],
    });
    at = landed;
  }

  return { run, steps, at: findElement(file, at), situation: evaluate(file, state, at), state, brokenAt };
};

/** The run in a sentence, for the list of saved paths. */
export const describeRun = (file: ProjectFile, run: SimulationRun): string => {
  const played = replayRun(file, run);
  const steps = run.steps.length;
  const walked = `${steps} choice${steps === 1 ? '' : 's'}`;
  const here = played.at;
  // The start having gone is asked first: it is the more specific answer, and
  // it is the one a designer can act on.
  if (!here) return `${walked} — the node it started at has gone.`;
  if (played.brokenAt !== null) {
    return `${walked} — stops working at step ${played.brokenAt + 1}.`;
  }
  const ending = here.endsHere || here.kind === 'ending';
  return `${walked} — ${ending ? 'ends at' : 'stops at'} ${here.name || 'an unnamed node'}.`;
};

// ------------------------------------------------------------ the comparison

export interface StateDifference {
  /** The state's key or the resource's name, as a designer reads it. */
  subject: string;
  left: string;
  right: string;
}

export interface RunComparison {
  /** How many choices the two paths share from the start. */
  shared: number;
  /** The step they part at, or null where one is a prefix of the other. */
  divergedAt: number | null;
  /** Where each finishes. */
  leftEnd: NarrativeElement | null;
  rightEnd: NarrativeElement | null;
  /** Everything the player holds differently at the end. */
  differences: StateDifference[];
}

/**
 * Two paths, side by side (§13's *compared with other paths*).
 *
 * What is worth comparing is where they **part** and what the player is left
 * holding, because those are the two questions a branching designer actually
 * has: *when did this stop being the same story*, and *what did that cost*.
 * The middle of the walk is not compared, since two paths through a hub can
 * differ in twelve places and mean nothing by it.
 */
export const compareRuns = (file: ProjectFile, left: SimulationRun, right: SimulationRun): RunComparison => {
  const a = replayRun(file, left);
  const b = replayRun(file, right);

  let shared = 0;
  while (
    shared < left.steps.length &&
    shared < right.steps.length &&
    left.steps[shared] === right.steps[shared]
  ) {
    shared += 1;
  }
  const divergedAt = shared < left.steps.length && shared < right.steps.length ? shared : null;

  const differences: StateDifference[] = [];
  for (const definition of file.stateDefinitions ?? []) {
    const id = definition.id as string;
    const one = a.state.states[id] ?? definition.initial;
    const two = b.state.states[id] ?? definition.initial;
    if (one !== two) {
      differences.push({ subject: definition.key || 'an unnamed state', left: one, right: two });
    }
  }
  for (const definition of file.resourceDefinitions ?? []) {
    const id = definition.id as string;
    const one = a.state.resources[id] ?? definition.initial;
    const two = b.state.resources[id] ?? definition.initial;
    if (one !== two) {
      differences.push({
        subject: definition.name || 'an unnamed resource',
        left: String(one),
        right: String(two),
      });
    }
  }

  return { shared, divergedAt, leftEnd: a.at, rightEnd: b.at, differences };
};

/** The comparison in a sentence. */
export const describeComparison = (comparison: RunComparison): string => {
  const parts = [
    comparison.divergedAt === null
      ? comparison.shared === 0
        ? 'They share nothing.'
        : `One is the first ${comparison.shared} of the other.`
      : `They part at step ${comparison.divergedAt + 1}.`,
  ];
  if (comparison.leftEnd && comparison.rightEnd) {
    parts.push(
      comparison.leftEnd.id === comparison.rightEnd.id
        ? `Both finish at ${comparison.leftEnd.name || 'an unnamed node'}.`
        : `One finishes at ${comparison.leftEnd.name || 'an unnamed node'}, the other at ${
            comparison.rightEnd.name || 'an unnamed node'
          }.`,
    );
  }
  parts.push(
    comparison.differences.length === 0
      ? 'The player ends up holding the same things.'
      : `${comparison.differences.length} thing${comparison.differences.length === 1 ? '' : 's'} differ at the end.`,
  );
  return parts.join(' ');
};

// ------------------------------------------------------- what to show at a node

export interface Holding {
  subject: string;
  value: string;
  /** Different from where it started — the thing a designer is watching for. */
  moved: boolean;
}

/**
 * What the player is carrying, for §13's *watches the current state update*.
 *
 * Everything defined is listed rather than only what has changed, because a
 * flag that is still false is information when you are three choices into
 * testing the door that reads it — and what has moved is marked so it can be
 * found at a glance.
 */
export const holdings = (file: ProjectFile, state: PlayState): Holding[] => [
  ...(file.stateDefinitions ?? []).map((one) => {
    const value = state.states[one.id as string] ?? one.initial;
    return {
      subject: one.key || 'an unnamed state',
      value: one.kind === 'flag' ? (value === 'true' ? 'true' : 'false') : value || '—',
      moved: value !== one.initial,
    };
  }),
  ...(file.resourceDefinitions ?? []).map((one) => {
    const value = state.resources[one.id as string] ?? one.initial;
    return { subject: one.name || 'an unnamed resource', value: String(value), moved: value !== one.initial };
  }),
];

/** Every node a run could start at, for §13's *any node*. */
export const startPoints = (file: ProjectFile): NarrativeElement[] => {
  const entries = entryPoints(file);
  const rest = (file.narrativeElements ?? []).filter((one) => !one.entry);
  return [...entries, ...rest];
};

/** What is offered where the player is standing, in the designer's order. */
export const offeredAt = (file: ProjectFile, at: NarrativeElementId): Choice[] => choicesAt(file, at);
