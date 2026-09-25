import { addChoice, addElement, choicesAt, choicesOf, elementsOf, findElement, updateChoice, updateElement } from './narrative.js';
import { addBeat, addUnit, DomainError } from './mutations.js';
import { beatsForUnit, tracksInOrder, unitsInStoryOrder } from './selectors.js';
import type { NarrativeElement } from './entities/narrative.js';
import type { BeatId, ChoiceId, NarrativeElementId, StructuralUnitId } from './ids.js';
import type { StructuralUnit } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';

/**
 * The Story Map's central lane: dropping a scene or a beat into it (addendum
 * 25 §4.3).
 *
 * Addendum 18 stage 4's rule is *nothing here is dragged*, and it stands: it
 * is about **position**, and a narrative node has none. A drop is not a
 * position. It is **an edit to the story** — a scene made in the story order
 * at the place it was dropped, or a node spliced into a connection — after
 * which the map is derived from the new graph exactly as before. Where the
 * card lands is where the logic puts it.
 *
 * Every drop writes the words' home first and the node second: the scene or
 * beat in the manuscript, then a node bound to it, because the spine is the
 * manuscript (addendum 18 §3) and a node on the lane with no beat behind it
 * would not be on the spine at all.
 */

export type LaneCard = 'scene' | 'beat';

export interface Dropped {
  file: ProjectFile;
  element: NarrativeElement;
}

/** The node bound to a beat of this scene, first or last in the scene's order. */
const spineNodeOf = (file: ProjectFile, unitId: StructuralUnitId, which: 'first' | 'last'): NarrativeElement | null => {
  const beats = beatsForUnit(file, unitId);
  const ordered = which === 'first' ? beats : [...beats].reverse();
  for (const beat of ordered) {
    const bound = elementsOf(file).find((one) => one.boundBeatId === beat.id);
    if (bound) return bound;
  }
  return null;
};

/** The next scene in the story after this one that has a node on the spine. */
const nextSpineNode = (file: ProjectFile, afterUnitId: StructuralUnitId | null): NarrativeElement | null => {
  const units = unitsInStoryOrder(file);
  const start = afterUnitId === null ? 0 : units.findIndex((one) => one.id === afterUnitId) + 1;
  for (const unit of units.slice(start)) {
    const node = spineNodeOf(file, unit.id, 'first');
    if (node) return node;
  }
  return null;
};

/** The last spine node at or before this scene. */
const previousSpineNode = (file: ProjectFile, atOrBefore: StructuralUnitId | null): NarrativeElement | null => {
  if (atOrBefore === null) return null;
  const units = unitsInStoryOrder(file);
  const end = units.findIndex((one) => one.id === atOrBefore);
  for (const unit of units.slice(0, end + 1).reverse()) {
    const node = spineNodeOf(file, unit.id, 'last');
    if (node) return node;
  }
  return null;
};

/**
 * Put a new node between two others on the story's line.
 *
 * Every choice that led from `before` to `after` now leads to the new node,
 * and the new node carries on to `after` — so the player's route is the same
 * route with a stop added. Where the two were not connected, nothing is
 * guessed: the new node is placed and the map draws it as it is.
 *
 * Two edges of the story get one more rule each, because otherwise the most
 * ordinary thing a writer does — dropping scene after scene onto the end of
 * the lane — would leave every one of them stranded:
 *
 * - **At the end**: when `before` offers no way on and is not meant to stop,
 *   it gets one, to the new node.
 * - **At the start**: when `after` is where the game starts, the new node
 *   takes that over, and leads to it.
 */
const splice = (
  file: ProjectFile,
  node: NarrativeElement,
  before: NarrativeElement | null,
  after: NarrativeElement | null,
): ProjectFile => {
  let next = file;
  if (before && after) {
    const linking = choicesAt(next, before.id).filter((one) => one.toElementId === after.id);
    for (const choice of linking) next = updateChoice(next, choice.id, { toElementId: node.id });
    if (linking.length > 0) next = addChoice(next, { elementId: node.id, toElementId: after.id }).file;
    return next;
  }
  if (before && !after) {
    const waysOn = choicesAt(next, before.id).filter((one) => one.toElementId !== null);
    if (waysOn.length === 0 && !before.endsHere) {
      next = addChoice(next, { elementId: before.id, toElementId: node.id }).file;
    }
    return next;
  }
  if (!before && after) {
    if (after.entry && after.id !== node.id) {
      next = updateElement(next, after.id, { entry: false });
      next = updateElement(next, node.id, { entry: true });
      next = addChoice(next, { elementId: node.id, toElementId: after.id }).file;
    }
  }
  return next;
};

/**
 * Write the words' home for a dropped card: a beat at the end of `anchor`, or
 * a new scene (with its one beat) straight after it — at `fallbackIndex` in
 * the story when there is no anchor.
 */
const writeHome = (
  file: ProjectFile,
  card: LaneCard,
  anchor: StructuralUnit | null,
  fallbackIndex: number,
  name: string,
): { file: ProjectFile; beatId: BeatId } => {
  if (card === 'beat' && anchor) {
    const made = addBeat(file, { unitId: anchor.id, title: name });
    return { file: made.file, beatId: made.beat.id };
  }
  const units = unitsInStoryOrder(file);
  const trackId = anchor?.trackId ?? tracksInOrder(file)[0]?.id;
  if (!trackId) throw new DomainError('The project has no track to put a scene in');
  const index = anchor ? units.findIndex((one) => one.id === anchor.id) + 1 : fallbackIndex;
  const scene = addUnit(file, { trackId, title: name, index });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: name });
  return { file: beat.file, beatId: beat.beat.id };
};

/**
 * Drop a card into the lane after a scene (or at the very start, with null).
 *
 * A **scene** card makes a new scene in the story order straight after
 * `afterUnitId`, with one beat in it. A **beat** card adds a beat to the end
 * of `afterUnitId` itself — the scene to the left of where it was dropped —
 * and is a scene card when there is no scene to the left.
 */
export const dropIntoLane = (
  file: ProjectFile,
  input: { card: LaneCard; afterUnitId: StructuralUnitId | null; name?: string },
): Dropped => {
  const units = unitsInStoryOrder(file);
  const after = input.afterUnitId === null ? null : units.find((one) => one.id === input.afterUnitId) ?? null;
  if (input.afterUnitId !== null && !after) {
    throw new DomainError(`Scene ${input.afterUnitId} does not exist`);
  }
  const name = input.name?.trim() || (input.card === 'beat' && after ? 'New beat' : 'New scene');

  // Whatever the spine looks like either side of the drop, read before it.
  const before = previousSpineNode(file, after?.id ?? null);
  const next = nextSpineNode(file, after?.id ?? null);

  const home = writeHome(file, input.card, after, 0, name);

  const made = addElement(home.file, { name, kind: 'scene', boundBeatId: home.beatId });
  const working = splice(made.file, made.element, before, next);
  return { file: working, element: findElement(working, made.element.id) ?? made.element };
};

/**
 * Drop a card onto a connection: the node the choice led to now comes after
 * a new one (addendum 25 §4.3).
 *
 * The new scene is made in the story order straight after the scene the
 * connection leaves from, when that one is on the spine, and at the end of the
 * story when it is not. A beat card puts the beat in that same scene.
 */
export const dropOnConnection = (
  file: ProjectFile,
  input: { card: LaneCard; choiceId: ChoiceId; name?: string },
): Dropped => {
  const choice = choicesOf(file).find((one) => one.id === input.choiceId);
  if (!choice) throw new DomainError(`Choice ${input.choiceId} does not exist`);
  if (!choice.toElementId) throw new DomainError('That choice leads nowhere, so there is nothing to put a node before');
  const from = findElement(file, choice.elementId);
  const fromBeat = from?.boundBeatId ? file.beats.find((one) => one.id === from.boundBeatId) ?? null : null;
  const units = unitsInStoryOrder(file);
  const anchor = fromBeat ? units.find((one) => one.id === fromBeat.unitId) ?? null : units.at(-1) ?? null;
  const name = input.name?.trim() || (input.card === 'beat' && anchor ? 'New beat' : 'New scene');

  const home = writeHome(file, input.card, anchor, units.length, name);

  const made = addElement(home.file, { name, kind: 'scene', boundBeatId: home.beatId });
  let working = updateChoice(made.file, choice.id, { toElementId: made.element.id });
  working = addChoice(working, { elementId: made.element.id, toElementId: choice.toElementId as NarrativeElementId }).file;
  return { file: working, element: findElement(working, made.element.id) ?? made.element };
};

/**
 * The places a card can be dropped into the lane, in story order: before the
 * first scene, then after each one. The screen draws a slot for each.
 */
export const laneSlots = (file: ProjectFile): { afterUnitId: StructuralUnitId | null; label: string }[] => {
  const units = unitsInStoryOrder(file);
  return [
    { afterUnitId: null, label: units.length ? 'Before the first scene' : 'Start the story' },
    ...units.map((unit, index) => ({
      afterUnitId: unit.id,
      label: `After ${unit.title.trim() || `scene ${index + 1}`}`,
    })),
  ];
};
