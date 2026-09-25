import { nowIso } from './entities/common.js';
import { addState, choicesAt, findElement, removeState, statesOf, updateChoice, updateState } from './narrative.js';
import { newId } from './ids.js';
import {
  environmentSchema,
  interactiveObjectSchema,
  mechanicSchema,
  puzzleComponentSchema,
  puzzleSchema,
  verbSchema,
  type Environment,
  type InteractiveObject,
  type Mechanic,
  type Puzzle,
  type PuzzleComponent,
  type Verb,
} from './entities/narrative.js';
import type {
  EnvironmentId,
  InteractiveObjectId,
  LocationId,
  MechanicId,
  NarrativeElementId,
  PuzzleComponentId,
  PuzzleId,
  StateDefinitionId,
  StructuralUnitId,
  VerbId,
} from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * Interactive objects, location mechanics and puzzles (addendum 25 §7–§8),
 * and the one choice behaviour that is a rule rather than a field: mutual
 * exclusion.
 *
 * An object and a puzzle each **own a state** — the object's current state,
 * the puzzle's *solved* — made with it, renamed with it and removed with it,
 * so every rule that asks about either asks through the one mechanism states
 * already are. Nothing here evaluates: the evaluator's `verbsAt`, `useVerb`
 * and `settle` do, beside `choose`.
 */

const touch = (file: ProjectFile): ProjectFile => ({
  ...file,
  project: { ...file.project, updatedAt: nowIso() },
});

/** A designer-readable key from a name: *Rusted Lever* → `rusted_lever`. */
export const keyFrom = (name: string, fallback: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;

// ------------------------------------------------------------- objects

export const objectsOf = (file: ProjectFile): InteractiveObject[] => file.interactiveObjects ?? [];

export const findObject = (file: ProjectFile, objectId: InteractiveObjectId): InteractiveObject | null =>
  objectsOf(file).find((one) => one.id === objectId) ?? null;

const withObject = (file: ProjectFile, objectId: InteractiveObjectId, change: (one: InteractiveObject) => InteractiveObject): ProjectFile =>
  touch({
    ...file,
    interactiveObjects: objectsOf(file).map((one) =>
      one.id === objectId ? interactiveObjectSchema.parse({ ...change(one), updatedAt: nowIso() }) : one,
    ),
  });

/** The states an object starts with, until the designer names its own. */
export const DEFAULT_OBJECT_STATES = ['ready', 'used'] as const;

/** Make an object, and the state it owns. */
export const addObject = (
  file: ProjectFile,
  input: { name?: string; states?: string[]; placedAt?: string[] } = {},
): { file: ProjectFile; object: InteractiveObject } => {
  const name = input.name ?? '';
  const states = input.states && input.states.length > 0 ? input.states : [...DEFAULT_OBJECT_STATES];
  const made = addState(file, { key: `${keyFrom(name, 'object')}_state`, kind: 'enum', initial: states[0]!, choices: states });
  const at = nowIso();
  const object = interactiveObjectSchema.parse({
    id: newId<InteractiveObjectId>(),
    projectId: file.project.id,
    name,
    stateId: made.state.id,
    placedAt: input.placedAt ?? [],
    verbs: [],
    createdAt: at,
    updatedAt: at,
  });
  return { file: touch({ ...made.file, interactiveObjects: [...objectsOf(made.file), object] }), object };
};

/**
 * Change an object. Renaming it renames the state it owns, so *the lever* and
 * `lever_state` never drift apart; every rule holds the id and follows.
 */
export const updateObject = (
  file: ProjectFile,
  objectId: InteractiveObjectId,
  patch: Partial<Pick<InteractiveObject, 'name' | 'note' | 'placedAt'>>,
): ProjectFile => {
  const object = findObject(file, objectId);
  if (!object) return file;
  let next = withObject(file, objectId, (one) => ({ ...one, ...patch }));
  if (patch.name !== undefined) next = updateState(next, object.stateId, { key: `${keyFrom(patch.name, 'object')}_state` });
  return next;
};

/** An object's states, which are its owned state's values; the first is where it starts unless told. */
export const setObjectStates = (
  file: ProjectFile,
  objectId: InteractiveObjectId,
  states: string[],
  initial?: string,
): ProjectFile => {
  const object = findObject(file, objectId);
  if (!object) return file;
  const clean = states.map((one) => one.trim()).filter((one) => one.length > 0);
  const owned = statesOf(file).find((one) => one.id === object.stateId);
  const start = initial && clean.includes(initial) ? initial : clean.includes(owned?.initial ?? '') ? owned!.initial : (clean[0] ?? '');
  return updateState(file, object.stateId, { choices: clean, initial: start });
};

/** Put an object somewhere, or take it away: a scene or a node. */
export const placeObject = (file: ProjectFile, objectId: InteractiveObjectId, placeId: string, placed: boolean): ProjectFile => {
  const object = findObject(file, objectId);
  if (!object) return file;
  const without = object.placedAt.filter((one) => one !== placeId);
  return withObject(file, objectId, (one) => ({ ...one, placedAt: placed ? [...without, placeId] : without }));
};

export const addVerb = (file: ProjectFile, objectId: InteractiveObjectId, input: { name?: string } = {}): { file: ProjectFile; verb: Verb } => {
  const verb = verbSchema.parse({ id: newId<VerbId>(), name: input.name ?? '' });
  return { file: withObject(file, objectId, (one) => ({ ...one, verbs: [...one.verbs, verb] })), verb };
};

export const updateVerb = (
  file: ProjectFile,
  objectId: InteractiveObjectId,
  verbId: VerbId,
  patch: Partial<Omit<Verb, 'id'>>,
): ProjectFile =>
  withObject(file, objectId, (one) => ({
    ...one,
    verbs: one.verbs.map((verb) => (verb.id === verbId ? verbSchema.parse({ ...verb, ...patch }) : verb)),
  }));

export const removeVerb = (file: ProjectFile, objectId: InteractiveObjectId, verbId: VerbId): ProjectFile =>
  withObject(file, objectId, (one) => ({ ...one, verbs: one.verbs.filter((verb) => verb.id !== verbId) }));

/** Remove an object, and the state it owns — and so every rule that asks about it. */
export const removeObject = (file: ProjectFile, objectId: InteractiveObjectId): ProjectFile => {
  const object = findObject(file, objectId);
  if (!object) return file;
  const without = touch({ ...file, interactiveObjects: objectsOf(file).filter((one) => one.id !== objectId) });
  return removeState(without, object.stateId);
};

// ------------------------------------------------------------- puzzles

export const puzzlesOf = (file: ProjectFile): Puzzle[] => file.puzzles ?? [];

export const findPuzzle = (file: ProjectFile, puzzleId: PuzzleId): Puzzle | null =>
  puzzlesOf(file).find((one) => one.id === puzzleId) ?? null;

const withPuzzle = (file: ProjectFile, puzzleId: PuzzleId, change: (one: Puzzle) => Puzzle): ProjectFile =>
  touch({
    ...file,
    puzzles: puzzlesOf(file).map((one) => (one.id === puzzleId ? puzzleSchema.parse({ ...change(one), updatedAt: nowIso() }) : one)),
  });

/** Make a puzzle, and the *solved* flag it owns. */
export const addPuzzle = (
  file: ProjectFile,
  input: { name?: string; unitId?: StructuralUnitId | null } = {},
): { file: ProjectFile; puzzle: Puzzle } => {
  const name = input.name ?? '';
  const flag = addState(file, { key: `${keyFrom(name, 'puzzle')}_solved`, kind: 'flag', initial: '' });
  const at = nowIso();
  const puzzle = puzzleSchema.parse({
    id: newId<PuzzleId>(),
    projectId: file.project.id,
    name,
    unitId: input.unitId ?? null,
    solvedStateId: flag.state.id,
    createdAt: at,
    updatedAt: at,
  });
  return { file: touch({ ...flag.file, puzzles: [...puzzlesOf(flag.file), puzzle] }), puzzle };
};

/** Change a puzzle; renaming it renames its flag, as an object's state follows its name. */
export const updatePuzzle = (
  file: ProjectFile,
  puzzleId: PuzzleId,
  patch: Partial<Omit<Puzzle, 'id' | 'projectId' | 'createdAt' | 'solvedStateId'>>,
): ProjectFile => {
  const puzzle = findPuzzle(file, puzzleId);
  if (!puzzle) return file;
  let next = withPuzzle(file, puzzleId, (one) => ({ ...one, ...patch }));
  if (patch.name !== undefined) next = updateState(next, puzzle.solvedStateId, { key: `${keyFrom(patch.name, 'puzzle')}_solved` });
  return next;
};

export const addComponent = (file: ProjectFile, puzzleId: PuzzleId, input: { name?: string } = {}): ProjectFile =>
  withPuzzle(file, puzzleId, (one) => ({
    ...one,
    components: [...one.components, puzzleComponentSchema.parse({ id: newId<PuzzleComponentId>(), name: input.name ?? '' })],
  }));

export const updateComponent = (
  file: ProjectFile,
  puzzleId: PuzzleId,
  componentId: PuzzleComponentId,
  patch: Partial<Omit<PuzzleComponent, 'id'>>,
): ProjectFile =>
  withPuzzle(file, puzzleId, (one) => ({
    ...one,
    components: one.components.map((part) => (part.id === componentId ? { ...part, ...patch } : part)),
  }));

export const removeComponent = (file: ProjectFile, puzzleId: PuzzleId, componentId: PuzzleComponentId): ProjectFile =>
  withPuzzle(file, puzzleId, (one) => ({ ...one, components: one.components.filter((part) => part.id !== componentId) }));

/** Remove a puzzle, and its *solved* flag with every rule that reads it. */
export const removePuzzle = (file: ProjectFile, puzzleId: PuzzleId): ProjectFile => {
  const puzzle = findPuzzle(file, puzzleId);
  if (!puzzle) return file;
  const without = touch({ ...file, puzzles: puzzlesOf(file).filter((one) => one.id !== puzzleId) });
  return removeState(without, puzzle.solvedStateId);
};

/** The puzzles in a scene. */
export const puzzlesIn = (file: ProjectFile, unitId: StructuralUnitId): Puzzle[] =>
  puzzlesOf(file).filter((one) => one.unitId === unitId);

// ------------------------------------------------------ owned states

/**
 * Whose state this is, where an object or a puzzle owns it. The Bible shows
 * an owned state with its owner and without a remove of its own: removing it
 * means removing the object or the puzzle.
 */
export const ownerOfState = (
  file: ProjectFile,
  stateId: StateDefinitionId,
): { kind: 'object' | 'puzzle'; id: string; name: string } | null => {
  const object = objectsOf(file).find((one) => one.stateId === stateId);
  if (object) return { kind: 'object', id: object.id as string, name: object.name };
  const puzzle = puzzlesOf(file).find((one) => one.solvedStateId === stateId);
  if (puzzle) return { kind: 'puzzle', id: puzzle.id as string, name: puzzle.name };
  return null;
};

// ------------------------------------------------------- environments

/** Mechanics a designer is offered for a place, never limited to. */
export const MECHANIC_SUGGESTIONS = [
  'Darkness',
  'Traversal',
  'Hazard',
  'Visibility',
  'Water',
  'Audio cue',
  'Resource drain',
  'Navigation',
  'Environmental puzzle',
] as const;

export const mechanicsOf = (file: ProjectFile, locationId: LocationId): Mechanic[] =>
  (file.environments ?? []).find((one) => one.locationId === locationId)?.mechanics ?? [];

/** Change one location's mechanics, making its record the first time anything is written. */
const withEnvironment = (file: ProjectFile, locationId: LocationId, change: (mechanics: Mechanic[]) => Mechanic[]): ProjectFile => {
  const at = nowIso();
  const existing = (file.environments ?? []).find((one) => one.locationId === locationId);
  const base: Environment =
    existing ??
    environmentSchema.parse({ id: newId<EnvironmentId>(), projectId: file.project.id, locationId, createdAt: at, updatedAt: at });
  const next = { ...base, mechanics: change(base.mechanics), updatedAt: at };
  return touch({
    ...file,
    environments: existing
      ? (file.environments ?? []).map((one) => (one.id === existing.id ? next : one))
      : [...(file.environments ?? []), next],
  });
};

export const addMechanic = (
  file: ProjectFile,
  locationId: LocationId,
  input: Partial<Omit<Mechanic, 'id'>> = {},
): { file: ProjectFile; mechanic: Mechanic } => {
  const mechanic = mechanicSchema.parse({ id: newId<MechanicId>(), ...input });
  return { file: withEnvironment(file, locationId, (list) => [...list, mechanic]), mechanic };
};

export const updateMechanic = (
  file: ProjectFile,
  locationId: LocationId,
  mechanicId: MechanicId,
  patch: Partial<Omit<Mechanic, 'id'>>,
): ProjectFile =>
  withEnvironment(file, locationId, (list) => list.map((one) => (one.id === mechanicId ? mechanicSchema.parse({ ...one, ...patch }) : one)));

export const removeMechanic = (file: ProjectFile, locationId: LocationId, mechanicId: MechanicId): ProjectFile =>
  withEnvironment(file, locationId, (list) => list.filter((one) => one.id !== mechanicId));

// ------------------------------------------------ mutual exclusion (§8)

/**
 * Make the choices at a node mutually exclusive: taking one closes the
 * others, wherever they are offered again (addendum 25 §8).
 *
 * **Not a field, a rule** — one state and one rule per choice, written the way
 * a designer would write them by hand: a state whose values are the choices,
 * each choice setting it to its own value, and each offered only while the
 * state is still empty. So it evaluates with nothing new, the checks read it,
 * and the designer can open any of it in the rule builder and change it.
 */
export const makeChoicesExclusive = (file: ProjectFile, elementId: NarrativeElementId): ProjectFile => {
  const node = findElement(file, elementId);
  const offered = choicesAt(file, elementId);
  if (!node || offered.length < 2) return file;
  const labels = offered.map((one, index) => one.text.trim() || one.name.trim() || `choice ${index + 1}`);
  const unique = labels.map((label, index) => (labels.indexOf(label) === index ? label : `${label} (${index + 1})`));
  const made = addState(file, { key: `${keyFrom(node.name, 'choice')}_choice`, kind: 'enum', initial: '', choices: unique });
  let next = made.file;
  offered.forEach((choice, index) => {
    const open = { subject: 'state' as const, subjectId: made.state.id as string, op: 'is' as const, value: '' };
    // Added to an ALL group as one more thing it asks; any other group is kept
    // whole inside a new ALL, so what it meant is unchanged.
    const conditions =
      choice.conditions.join === 'all'
        ? { ...choice.conditions, conditions: [...choice.conditions.conditions, open] }
        : { join: 'all' as const, conditions: [open], groups: [choice.conditions] };
    next = updateChoice(next, choice.id, {
      conditions,
      effects: [...choice.effects, { kind: 'set', targetId: made.state.id, value: unique[index]!, timing: 'immediate', note: '' }],
    });
  });
  return next;
};
