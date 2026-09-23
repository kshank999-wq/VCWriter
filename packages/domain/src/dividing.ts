import { addBeat, addMarker, addUnit, moveBeat, removeBeat, removeUnit, splitUnit, updateBeat } from './mutations.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { defaultMarkerKind } from './markers.js';
import type { ProjectFile } from './project-file.js';
import type { Beat, StructuralUnit } from './entities/structure.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import type { BeatId, StoryMarkerId, StructuralUnitId, TrackId } from './ids.js';

/**
 * Dividing a manuscript where the writer points (addendum 21 §10).
 *
 * An imported book arrives as sections and passages the reader worked out
 * from headings and breaks, and it is often wrong in places a writer can see
 * at once. The tool for that is two clicks — *where it starts*, *where it
 * ends* — and the story is cut so that stretch is a chapter, or a passage,
 * of its own. Everything here is built from two primitives, **split before
 * an element** and **merge the neighbour in**, because a range is exactly
 * those: a cut at its start, a cut after its end, and whatever fell between
 * joined into one. Nothing about the words changes; no element is edited,
 * reordered or lost, and a test says so by reading the manuscript back in
 * order before and after.
 */

export interface ElementPlace {
  unit: StructuralUnit;
  beat: Beat;
  /** Where the element stands in its beat. */
  index: number;
  /** Where the beat stands in its unit. */
  beatIndex: number;
  /** Where the element stands in the whole manuscript, in story order. */
  order: number;
}

/** Every element of the manuscript in reading order, with where it lives. */
export const manuscriptSequence = (file: ProjectFile): ElementPlace[] => {
  const out: ElementPlace[] = [];
  for (const unit of unitsInStoryOrder(file)) {
    if (!unit.inScript) continue;
    beatsForUnit(file, unit.id).forEach((beat, beatIndex) => {
      beat.manuscript.elements.forEach((_element, index) => {
        out.push({ unit, beat, index, beatIndex, order: out.length });
      });
    });
  }
  return out;
};

export const locateElement = (file: ProjectFile, elementId: string): ElementPlace | null => {
  for (const place of manuscriptSequence(file)) {
    if ((place.beat.manuscript.elements[place.index]?.id as string) === elementId) return place;
  }
  return null;
};

/** The elements of a unit's beats, in order: what `carveUnit` promises to keep. */
export const manuscriptElementsOf = (file: ProjectFile, unitId: StructuralUnitId): ManuscriptElement[] =>
  beatsForUnit(file, unitId).flatMap((beat) => beat.manuscript.elements);

/**
 * Cut a beat before an element: the element and everything after it become
 * a beat of their own, straight after this one. Before the first element
 * there is nothing to cut, and the beat is handed back as it is.
 */
export const splitBeatBefore = (file: ProjectFile, elementId: string): { file: ProjectFile; beatId: BeatId } => {
  const place = locateElement(file, elementId);
  if (!place) throw new Error(`Element ${elementId} is not in the manuscript`);
  if (place.index === 0) return { file, beatId: place.beat.id };
  const elements = place.beat.manuscript.elements;
  const made = addBeat(file, { unitId: place.unit.id, index: place.beatIndex + 1 });
  let next = updateBeat(made.file, place.beat.id, { manuscript: { elements: elements.slice(0, place.index) } });
  next = updateBeat(next, made.beat.id, { manuscript: { elements: elements.slice(place.index) } });
  return { file: next, beatId: made.beat.id };
};

/**
 * Cut the story before an element: it and everything after it in its unit
 * become a unit of their own, straight after, in the same track. Before
 * the first element of a unit there is nothing to cut.
 */
export const splitUnitBefore = (file: ProjectFile, elementId: string): { file: ProjectFile; unitId: StructuralUnitId } => {
  const place = locateElement(file, elementId);
  if (!place) throw new Error(`Element ${elementId} is not in the manuscript`);
  // The unit's first element, whatever empty beats stand ahead of it.
  const first = manuscriptSequence(file).find((one) => one.unit.id === place.unit.id);
  if (first && first.order === place.order) return { file, unitId: place.unit.id };
  const cut = splitBeatBefore(file, elementId);
  const made = splitUnit(cut.file, place.unit.id, cut.beatId);
  return { file: made.file, unitId: made.unit.id };
};

/** Join the beat after into this one: its elements follow, and it goes. */
export const mergeBeatInto = (file: ProjectFile, keepId: BeatId, goneId: BeatId): ProjectFile => {
  const keep = file.beats.find((beat) => beat.id === keepId);
  const gone = file.beats.find((beat) => beat.id === goneId);
  if (!keep || !gone) return file;
  const joined = updateBeat(file, keepId, { manuscript: { elements: [...keep.manuscript.elements, ...gone.manuscript.elements] } });
  return removeBeat(joined, goneId);
};

/** Join the unit after into this one: its beats follow, its markers go with it, and it goes. */
export const mergeUnitInto = (file: ProjectFile, keepId: StructuralUnitId, goneId: StructuralUnitId): ProjectFile => {
  let next = file;
  const moving = beatsForUnit(file, goneId);
  for (const beat of moving) {
    next = moveBeat(next, { beatId: beat.id, toUnitId: keepId, index: beatsForUnit(next, keepId).length });
  }
  // A marker on the absorbed unit would be re-anchored onto whatever
  // follows and open a chapter nobody asked for; the range's own marker is
  // the caller's to place.
  next = { ...next, markers: next.markers.filter((marker) => marker.unitId !== goneId) };
  return removeUnit(next, goneId);
};

export interface Carved {
  file: ProjectFile;
  unitId: StructuralUnitId;
  markerId: StoryMarkerId | null;
  /** How many elements the range holds. */
  elements: number;
}

const idAt = (place: ElementPlace): string => place.beat.manuscript.elements[place.index]!.id as string;

/** The two ends in reading order, whichever way round they were given. */
const ordered = (file: ProjectFile, oneId: string, otherId: string): { from: ElementPlace; to: ElementPlace; fromId: string; toId: string } | string => {
  const one = locateElement(file, oneId);
  const other = locateElement(file, otherId);
  if (!one || !other) return 'That paragraph is no longer in the manuscript.';
  if (one.unit.trackId !== other.unit.trackId) return 'The start and the end are on different tracks.';
  const [from, to] = one.order <= other.order ? [one, other] : [other, one];
  return { from, to, fromId: idAt(from), toId: idAt(to) };
};

/**
 * Make the stretch from one element to another a chapter of its own: a unit
 * holding exactly those elements, with a chapter marker on it, in the story
 * where the stretch was. What stood before the start stays where it was;
 * what stood after the end becomes the unit that follows. Units the range
 * swallows whole are joined in, and any marker they carried goes, since
 * the range has one marker and it is this one. The start and the end may
 * be given either way round.
 */
export const carveUnit = (file: ProjectFile, oneId: string, otherId: string, options: { title?: string; marker?: boolean } = {}): Carved | string => {
  const places = ordered(file, oneId, otherId);
  if (typeof places === 'string') return places;
  const { from, to, fromId, toId } = places;
  const count = to.order - from.order + 1;

  // A cut at the start.
  let next = splitUnitBefore(file, fromId);
  const unitId = next.unitId;
  // A cut after the end, where anything follows it in its unit.
  const afterTo = manuscriptSequence(next.file).find((place) => place.order === to.order + 1);
  const toNow = locateElement(next.file, toId)!;
  if (afterTo && afterTo.unit.id === toNow.unit.id) {
    next = { file: splitUnitBefore(next.file, (afterTo.beat.manuscript.elements[afterTo.index]!.id as string)).file, unitId };
  }
  // Whatever fell between the two cuts, joined into the first, until the
  // end is in the same unit as the start.
  let working = next.file;
  for (;;) {
    if (locateElement(working, toId)?.unit.id === unitId) break;
    const order = unitsInStoryOrder(working).filter((unit) => unit.inScript);
    const following = order[order.findIndex((unit) => unit.id === unitId) + 1];
    if (!following) break;
    working = mergeUnitInto(working, unitId, following.id);
  }

  let markerId: StoryMarkerId | null = null;
  if (options.marker !== false) {
    const existing = working.markers.find((marker) => marker.unitId === unitId);
    if (existing) {
      markerId = existing.id;
      if (options.title !== undefined) {
        working = { ...working, markers: working.markers.map((marker) => (marker.id === existing.id ? { ...marker, title: options.title ?? marker.title } : marker)) };
      }
    } else {
      const made = addMarker(working, { unitId, title: options.title ?? '', kind: defaultMarkerKind(working.project.format) });
      working = made.file;
      markerId = made.marker.id;
    }
  }
  return { file: working, unitId, markerId, elements: count };
};

export interface CarvedBeat {
  file: ProjectFile;
  beatId: BeatId;
  elements: number;
}

/**
 * Make the stretch from one element to another a passage of its own, inside
 * the chapter it is in. A passage cannot cross a chapter — that stretch is
 * a chapter first — and the refusal says so.
 */
export const carveBeat = (file: ProjectFile, oneId: string, otherId: string, options: { title?: string } = {}): CarvedBeat | string => {
  const places = ordered(file, oneId, otherId);
  if (typeof places === 'string') return places;
  const { from, to, fromId, toId } = places;
  if (from.unit.id !== to.unit.id) return 'A passage cannot cross from one chapter into the next; make that stretch a chapter first.';
  const count = to.order - from.order + 1;

  let next = splitBeatBefore(file, fromId);
  const beatId = next.beatId;
  const afterTo = manuscriptSequence(next.file).find((place) => place.order === to.order + 1);
  const toNow = locateElement(next.file, toId)!;
  if (afterTo && afterTo.beat.id === toNow.beat.id) {
    next = { file: splitBeatBefore(next.file, idAt(afterTo)).file, beatId };
  }
  let working = next.file;
  for (;;) {
    const beats = beatsForUnit(working, from.unit.id);
    const at = beats.findIndex((beat) => beat.id === beatId);
    const following = beats[at + 1];
    if (!following || locateElement(working, toId)?.beat.id === beatId) break;
    working = mergeBeatInto(working, beatId, following.id);
  }
  if (options.title !== undefined) working = updateBeat(working, beatId, { title: options.title });
  return { file: working, beatId, elements: count };
};

/**
 * Carry a beat into a scene of its own (addendum 02 §6a, from Ken: *drag a
 * beat into a new lane and it creates a new scene*). The new unit stands
 * right after the one the beat came from in the story, on the track asked
 * for or the beat's own, and the beat is its only beat. What is left behind
 * is left as it is — a unit with no beats is a unit the writer can see is
 * empty and remove, where removing it silently would take a name and a
 * marker they may want.
 */
export const beatIntoNewUnit = (
  file: ProjectFile,
  beatId: BeatId,
  options: { trackId?: TrackId; title?: string; index?: number } = {},
): { file: ProjectFile; unitId: StructuralUnitId } => {
  const beat = file.beats.find((candidate) => candidate.id === beatId);
  if (!beat) throw new Error(`Beat ${beatId} is not in the project`);
  const from = file.units.find((unit) => unit.id === beat.unitId);
  if (!from) throw new Error(`Beat ${beatId} is in no unit`);
  const order = unitsInStoryOrder(file);
  const at = order.findIndex((unit) => unit.id === from.id);
  // Where in the story: asked for (a drop on a track's empty slot), or
  // straight after the unit the beat came from.
  const made = addUnit(file, { trackId: options.trackId ?? from.trackId, title: options.title ?? '', index: options.index ?? at + 1 });
  return { file: moveBeat(made.file, { beatId, toUnitId: made.unit.id, index: 0 }), unitId: made.unit.id };
};

// ------------------------------------------------- joining several into one

/**
 * Joining several into one (addendum 02 §6b, from Ken: *you should be able to
 * shift click several beats… and in this one it'll be merge*).
 *
 * The primitives at the top of this file already join **one** neighbour in;
 * what a writer picks on the screen is a **run**, so these fold that act over
 * the run and answer, before it is done, whether it can be and what it would
 * cost. The pair — a reading that refuses in a sentence, and an act that
 * cannot be asked for what the reading refused — is the shape the room's other
 * two-step acts already have (`trackRemoval`, `divisionRemoval`).
 *
 * **Not a word is cut**, which is what makes this safe to offer on a
 * right-click: the first of the run keeps its name, its status and its colour,
 * and takes the others' writing in order behind its own.
 */

/** Where a run of beats stands, in the unit they share, or a sentence saying why not. */
const beatRun = (file: ProjectFile, beatIds: readonly BeatId[]): { unitId: StructuralUnitId; beats: Beat[] } | string => {
  const wanted = [...new Set(beatIds.map((id) => id as string))];
  if (wanted.length < 2) return 'Choose two or more to join them.';
  const found = wanted.map((id) => file.beats.find((beat) => (beat.id as string) === id));
  if (found.some((beat) => beat === undefined)) return 'One of them is no longer in the project.';
  const beats = found as Beat[];
  const unitId = beats[0]!.unitId;
  if (beats.some((beat) => beat.unitId !== unitId)) return 'They are in different ones. Join what is in one at a time.';
  // Adjacent, in the order they are written: joining the first and the third
  // would have to carry the second's writing with it, which is a reordering
  // rather than a join — and one nobody asked for.
  const order = beatsForUnit(file, unitId);
  const at = beats.map((beat) => order.findIndex((one) => one.id === beat.id)).sort((a, b) => a - b);
  if (at.some((index, step) => step > 0 && index !== at[step - 1]! + 1)) return 'They do not follow one another.';
  return { unitId, beats: at.map((index) => order[index]!) };
};

/** Why these beats cannot be joined, or **what joining them would do**. */
export const beatsJoin = (
  file: ProjectFile,
  beatIds: readonly BeatId[],
  noun = 'beat',
): { may: false; why: string } | { may: true; says: string } => {
  const run = beatRun(file, beatIds);
  if (typeof run === 'string') return { may: false, why: run };
  const kept = run.beats[0]!;
  const named = kept.title.trim();
  return {
    may: true,
    says: `${run.beats.length} ${noun}s become one${named ? `, called ${named}` : ''}. Not a word is cut.`,
  };
};

/** Join a run of beats into the first of them, or hand back the refusal. */
export const joinBeats = (file: ProjectFile, beatIds: readonly BeatId[]): ProjectFile | string => {
  const run = beatRun(file, beatIds);
  if (typeof run === 'string') return run;
  const keep = run.beats[0]!.id;
  let working = file;
  for (const beat of run.beats.slice(1)) working = mergeBeatInto(working, keep, beat.id);
  return working;
};

/** The same for units — a script's scenes, a textbook's sections. */
const unitRun = (file: ProjectFile, unitIds: readonly StructuralUnitId[]): StructuralUnit[] | string => {
  const wanted = [...new Set(unitIds.map((id) => id as string))];
  if (wanted.length < 2) return 'Choose two or more to join them.';
  const order = unitsInStoryOrder(file);
  const at = wanted.map((id) => order.findIndex((unit) => (unit.id as string) === id)).sort((a, b) => a - b);
  if (at.some((index) => index < 0)) return 'One of them is no longer in the project.';
  if (at.some((index, step) => step > 0 && index !== at[step - 1]! + 1)) return 'They do not follow one another in the story.';
  const units = at.map((index) => order[index]!);
  // The story order runs across the tracks, so two units next to each other in
  // it may be on different subplots; joining those would take one off its
  // track without being asked.
  if (units.some((unit) => unit.trackId !== units[0]!.trackId)) return 'They are on different tracks.';
  return units;
};

export const unitsJoin = (
  file: ProjectFile,
  unitIds: readonly StructuralUnitId[],
  noun = 'scene',
): { may: false; why: string } | { may: true; says: string } => {
  const run = unitRun(file, unitIds);
  if (typeof run === 'string') return { may: false, why: run };
  const named = run[0]!.title.trim();
  // A break carried by one of the absorbed units goes with it, which is the
  // one thing a writer would not guess, so it is the thing that is said.
  const breaks = run.slice(1).filter((unit) => file.markers.some((marker) => marker.unitId === unit.id)).length;
  return {
    may: true,
    says:
      `${run.length} ${noun}s become one${named ? `, called ${named}` : ''}. Not a word is cut.` +
      (breaks > 0 ? ` ${breaks === 1 ? 'One break goes' : `${breaks} breaks go`} with them.` : ''),
  };
};

export const joinUnits = (file: ProjectFile, unitIds: readonly StructuralUnitId[]): ProjectFile | string => {
  const run = unitRun(file, unitIds);
  if (typeof run === 'string') return run;
  const keep = run[0]!.id;
  let working = file;
  for (const unit of run.slice(1)) working = mergeUnitInto(working, keep, unit.id);
  return working;
};
