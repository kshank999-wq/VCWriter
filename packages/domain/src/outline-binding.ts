import { addBeat, addMarker, addUnit, moveBeat, moveUnit, removeMarker, removeUnit } from './mutations.js';
import { beatsForUnit, tracksInOrder, unitsInStoryOrder } from './selectors.js';
import { orderKeyBetween } from './ordering.js';
import { nounsFor } from './formats.js';
import { nowIso } from './entities/common.js';
import { findOutline, findOutlineItem, outlineChildren, outlineParent, outlinesOf } from './outline.js';
import { claimedInScript, retitleScript } from './planning.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { Beat, StoryMarker, StructuralUnit } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, OutlineId, OutlineItemId, StoryMarkerId, StructuralUnitId } from './ids.js';

/**
 * Promotion: the outline into the script (addendum 06 §6), stage 5.
 *
 * **The point of the whole thing.** Everything before this is arranging, and
 * this is where the arrangement becomes the script — §12 says as much.
 *
 * Promotion *is* binding, the mechanism the board already uses: the same
 * one-claim rule, the same two-way rename, the same refusal to reorder the
 * script behind the writer's back. So this file is the Outliner's half of what
 * `sculptor-binding.ts` is for the board, and the rules that are about the
 * *pair* — who has claimed what, who gets renamed — live in `planning.ts`,
 * where there is one of each of them rather than two that would drift.
 */

/** What a row of this kind becomes in the script, if anything. */
export type PromoteKind = 'unit' | 'beat' | 'chapter' | null;

/**
 * What a row can become.
 *
 * **Scenes, beats — and chapters** (addendum 19 §2). Notes, Ideas, Characters,
 * Settings and Props are the writer's planning: they stay in the outline,
 * where they can be read while the scene is written, and there is nothing in
 * the script for them to turn into (§6). A chapter becomes a `chapter` story
 * marker, which is what a chapter in the manuscript has always been.
 */
export const promoteKindOf = (item: OutlineItem): PromoteKind =>
  item.kind === 'scene' ? 'unit' : item.kind === 'beat' ? 'beat' : item.kind === 'chapter' ? 'chapter' : null;

export const isPromoted = (item: OutlineItem): boolean =>
  item.boundUnitId !== null || item.boundBeatId !== null || item.boundMarkerId !== null;

/** The scene, beat or chapter marker a row **is**, resolved; null for a plan. */
export const promotedOf = (
  file: ProjectFile,
  item: OutlineItem,
): { kind: 'unit'; unit: StructuralUnit } | { kind: 'beat'; beat: Beat } | { kind: 'marker'; marker: StoryMarker } | null => {
  if (item.boundUnitId !== null) {
    const unit = file.units.find((candidate) => candidate.id === item.boundUnitId);
    return unit ? { kind: 'unit', unit } : null;
  }
  if (item.boundBeatId !== null) {
    const beat = file.beats.find((candidate) => candidate.id === item.boundBeatId);
    return beat ? { kind: 'beat', beat } : null;
  }
  if (item.boundMarkerId !== null) {
    const marker = file.markers.find((candidate) => candidate.id === item.boundMarkerId);
    return marker ? { kind: 'marker', marker } : null;
  }
  return null;
};

/** Why a row cannot go into the script, in the words the panel will use. */
export type Refusal =
  | 'nothing to promote'
  | 'already in the script'
  | 'its scene is still a plan'
  | 'there is no track to put a scene in'
  | 'a chapter starts on a section, and this one has none yet';

/** The Scene rows directly under a row, in their order — what a chapter is made of. */
const sectionsUnder = (outline: Outline, item: OutlineItem): OutlineItem[] =>
  outlineChildren(outline, item.id).filter((child) => child.kind === 'scene');

/**
 * Whether this row can be sent to the script, and what to say when it cannot.
 *
 * Every refusal here is a sentence a writer can act on, which is the point of
 * answering rather than simply failing: *its scene is still a plan* tells them
 * what to do next, and a button that does nothing does not.
 *
 * A chapter with nothing under it is refused rather than given an empty
 * section to hang its marker on (addendum 19 §2): a marker starts *on* a
 * unit, and making one up would be inventing writing.
 */
export const canPromote = (file: ProjectFile, outline: Outline, item: OutlineItem): Refusal | null => {
  const kind = promoteKindOf(item);
  if (kind === null) return 'nothing to promote';
  if (isPromoted(item)) return 'already in the script';
  if (kind === 'unit') return tracksInOrder(file).length === 0 ? 'there is no track to put a scene in' : null;
  if (kind === 'chapter') {
    if (tracksInOrder(file).length === 0) return 'there is no track to put a scene in';
    return sectionsUnder(outline, item).length === 0
      ? 'a chapter starts on a section, and this one has none yet'
      : null;
  }
  // A beat lives inside a scene and never floats in a track (spec §19), so
  // there is nowhere to put one whose scene has not been written yet.
  const parent = outlineParent(outline, item);
  return parent?.boundUnitId ? null : 'its scene is still a plan';
};

const writeRow = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  patch: Partial<OutlineItem>,
): ProjectFile => {
  const at = new Date().toISOString();
  return {
    ...file,
    outlines: outlinesOf(file).map((candidate) =>
      candidate.id === outlineId
        ? {
            ...candidate,
            items: candidate.items.map((item) => (item.id === itemId ? { ...item, ...patch, updatedAt: at } : item)),
            updatedAt: at,
          }
        : candidate,
    ),
    project: { ...file.project, updatedAt: at },
  };
};

/**
 * Where a scene goes in the story, read off the outline: **after the scene of
 * the nearest promoted row above it, or before the nearest promoted row below
 * it, and at the end when it has neither.**
 *
 * Both directions matter. A row at the top of its group has nothing above it,
 * and landing at the end of the script because of that would put the first
 * scene last, which is the opposite of what the outline says.
 *
 * **Nothing already in the script moves** (§6, §10): this only says where one
 * new scene belongs.
 */
/**
 * Where a sibling stands in the script: the first and last position of what
 * it is, or null for a plan. A scene stands in one place; a chapter stands
 * across every unit its marker covers (addendum 19 §2), so what lands after
 * one lands after the whole of it rather than between its first section and
 * its second.
 */
type PlaceOf = (other: OutlineItem) => { first: number; last: number } | null;

const indexAmong = (item: OutlineItem, siblings: readonly OutlineItem[], placeOf: PlaceOf, end: number): number => {
  const at = siblings.findIndex((candidate) => candidate.id === item.id);

  for (let index = at - 1; index >= 0; index -= 1) {
    const place = placeOf(siblings[index] as OutlineItem);
    if (place) return place.last + 1;
  }
  for (let index = at + 1; index < siblings.length; index += 1) {
    const place = placeOf(siblings[index] as OutlineItem);
    if (place) return place.first;
  }
  return end;
};

/** Where each row at the unit level stands, in the story order. */
const unitPlaces = (file: ProjectFile): PlaceOf => {
  const order = unitsInStoryOrder(file).map((unit) => unit.id as string);
  return (other) => {
    if (other.boundMarkerId !== null) {
      const span = divisionSpan(file, other.boundMarkerId).map((unit) => order.indexOf(unit.id as string));
      return span.length === 0 ? null : { first: span[0] as number, last: span[span.length - 1] as number };
    }
    const anchor = anchorUnitOf(file, other);
    const position = anchor === null ? -1 : order.indexOf(anchor);
    return position === -1 ? null : { first: position, last: position };
  };
};

/** Where each row inside a unit stands, among its beats. */
const beatPlaces = (order: readonly Beat[]): PlaceOf => (other) => {
  const position = other.boundBeatId === null ? -1 : order.findIndex((beat) => beat.id === other.boundBeatId);
  return position === -1 ? null : { first: position, last: position };
};

/** One row into the script, without its children. */
const promoteOne = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
): { file: ProjectFile; unitId: StructuralUnitId | null; beatId: BeatId | null } => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  // A chapter is `promoteChapter`'s, being its sections and then a marker.
  if (!outline || !item || promoteKindOf(item) === 'chapter' || canPromote(file, outline, item) !== null) {
    return { file, unitId: null, beatId: null };
  }

  const title = item.title.trim();
  const siblings = outlineChildren(outline, item.parentId);

  if (promoteKindOf(item) === 'unit') {
    const track = tracksInOrder(file)[0] as { id: Parameters<typeof addUnit>[1]['trackId'] };
    const made = addUnit(file, {
      trackId: track.id,
      title,
      index: indexAmong(item, siblings, unitPlaces(file), file.units.length),
    });
    return {
      file: writeRow(made.file, outlineId, itemId, { boundUnitId: made.unit.id }),
      unitId: made.unit.id,
      beatId: null,
    };
  }

  const unitId = outlineParent(outline, item)?.boundUnitId as StructuralUnitId;
  const order = beatsForUnit(file, unitId);
  const made = addBeat(file, { unitId, title, index: indexAmong(item, siblings, beatPlaces(order), order.length) });
  return {
    file: writeRow(made.file, outlineId, itemId, { boundBeatId: made.beat.id }),
    unitId,
    beatId: made.beat.id,
  };
};

/**
 * **Send to Script**: a scene and its beats, in one move, in their order (§6).
 *
 * A scene row becomes a `StructuralUnit` and its child **Beat** rows become the
 * beats inside it. The supporting rows under those beats — the Notes, the
 * Ideas, the Characters — are not promoted and not lost: they are the writer's
 * planning, and they stay in the outline where they can be read while the
 * scene is written.
 *
 * Links to research survive without being carried, because they were
 * references and the ids do not change.
 *
 * A row already in the script is left exactly as it is rather than made twice,
 * which is the source specification's duplicate warning seen from the inside —
 * so sending a scene whose first beat is already real promotes the rest and
 * leaves that one alone.
 */
export const promoteRow = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
): { file: ProjectFile; unitId: StructuralUnitId | null; beats: BeatId[]; markerId: StoryMarkerId | null } => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  if (outline && item && item.kind === 'chapter') return promoteChapter(file, outline, item);

  const first = promoteOne(file, outlineId, itemId);
  if (first.unitId === null && first.beatId === null) return { file, unitId: null, beats: [], markerId: null };
  if (first.beatId !== null) return { file: first.file, unitId: first.unitId, beats: [first.beatId], markerId: null };

  // The scene is real; now its beats, in the order the outline has them, so
  // each lands after the one before it.
  let current = first.file;
  const beats: BeatId[] = [];
  const grown = findOutline(current, outlineId) as Outline;
  for (const child of outlineChildren(grown, itemId)) {
    if (child.kind !== 'beat' || isPromoted(child)) continue;
    const made = promoteOne(current, outlineId, child.id);
    current = made.file;
    if (made.beatId) beats.push(made.beatId);
  }

  return { file: current, unitId: first.unitId, beats, markerId: null };
};

/**
 * **A chapter is a page, not a container** (addendum 19 §2).
 *
 * Nothing is written *in* a chapter — it announces the subject and the writing
 * begins at the first section — which is exactly what a story marker is. So
 * promoting a Chapter row promotes the sections beneath it, each a unit with
 * its subsections as beats, in their order, and then places a `chapter`
 * marker on the first of them with the chapter's title, and binds the row to
 * the marker. From then on the two are one thing.
 *
 * A section already in the book is left where it is, as `promoteRow` has
 * always left a scene; the marker goes on whichever section reads first in
 * the outline, real before or real now. A chapter with no section under it
 * is refused by `canPromote` before anything happens here, because a marker
 * has to start on a unit and there is none to start it on.
 */
const promoteChapter = (
  file: ProjectFile,
  outline: Outline,
  item: OutlineItem,
): { file: ProjectFile; unitId: StructuralUnitId | null; beats: BeatId[]; markerId: StoryMarkerId | null } => {
  const nothing = { file, unitId: null, beats: [], markerId: null };
  if (canPromote(file, outline, item) !== null) return nothing;

  let current = file;
  const beats: BeatId[] = [];
  for (const section of sectionsUnder(outline, item)) {
    if (isPromoted(section)) continue;
    const made = promoteRow(current, outline.id, section.id);
    current = made.file;
    beats.push(...made.beats);
  }

  const grown = findOutline(current, outline.id) as Outline;
  const first = sectionsUnder(grown, item).find((section) => section.boundUnitId !== null);
  if (!first || first.boundUnitId === null) return nothing;

  const placed = addMarker(current, { unitId: first.boundUnitId, kind: 'chapter', title: item.title.trim() });
  return {
    file: writeRow(placed.file, outline.id, item.id, { boundMarkerId: placed.marker.id }),
    unitId: first.boundUnitId,
    beats,
    markerId: placed.marker.id,
  };
};

/**
 * Both stay, no longer joined.
 *
 * The scene keeps its place in the script and everything written in it; the row
 * keeps its place in the outline and goes back to being a plan. Taking a
 * promoted row out of the outline is the same: §10 says deleting one offers to
 * unbind rather than to delete the scene, and the writing is never what the ×
 * on a row is allowed to cost. A chapter's marker stays for the same reason.
 */
export const unpromoteRow = (file: ProjectFile, outlineId: OutlineId, itemId: OutlineItemId): ProjectFile =>
  writeRow(file, outlineId, itemId, { boundUnitId: null, boundBeatId: null, boundMarkerId: null });

// ------------------------------------------- what a chapter is made of

/**
 * The units a chapter marker covers, read off the story order: from the unit
 * it starts on up to the next chapter's, or to the end (addendum 19 §2).
 *
 * **Never stored.** Which sections a division holds is a fact about where the
 * markers fall, so moving a section into the stretch puts it in the division
 * with nothing run — the same absence the section numbers rest on.
 *
 * It was `chapterSpan` while a chapter and a collection's story — both of
 * them chapter-kind markers — were all that asked; `collection.ts` had to
 * carry a comment explaining why a *story* read a *chapter*'s span, which is
 * the name having stretched past what it says. An **episode** is a different
 * kind, so the rename came with the fix (addendum 22 §7a).
 */
export const divisionSpan = (file: ProjectFile, markerId: StoryMarkerId): StructuralUnit[] => {
  const marker = file.markers.find((candidate) => candidate.id === markerId);
  if (!marker) return [];
  const order = unitsInStoryOrder(file);
  const start = order.findIndex((unit) => unit.id === marker.unitId);
  if (start === -1) return [];
  // It ends at the next marker **of its own kind**. It read `chapter`
  // outright while chapters and a collection's stories were the only callers
  // — both of them chapter-kind — and an episode, which is not, would have
  // run to the end of the series rather than stopping at the next episode.
  const starts = new Set(
    file.markers.filter((one) => one.kind === marker.kind && one.id !== markerId).map((one) => one.unitId as string),
  );
  const end = order.findIndex((unit, at) => at > start && starts.has(unit.id as string));
  return order.slice(start, end === -1 ? order.length : end);
};

/**
 * Whether nothing at all is written in a division — the story somebody
 * started by accident (addendum 22 §7, from Ken: *I added a story by
 * accident. I need the ability to remove a story also*). A **reading**, not a
 * flag: writing a word in it changes the answer with nothing run.
 */
const emptyDivision = (file: ProjectFile, markerId: StoryMarkerId): boolean =>
  divisionSpan(file, markerId).every((unit) =>
    beatsForUnit(file, unit.id).every((beat) => beat.manuscript.elements.every((element) => element.text.trim().length === 0)),
  );

/** Whether no other division starts earlier in the story order. */
const isFirstDivision = (file: ProjectFile, markerId: StoryMarkerId): boolean => {
  const order = unitsInStoryOrder(file).map((unit) => unit.id as string);
  const at = (id: StoryMarkerId): number => {
    const marker = file.markers.find((one) => one.id === id);
    return marker ? order.indexOf(marker.unitId as string) : -1;
  };
  const mine = at(markerId);
  if (mine === -1) return false;
  return file.markers
    .filter((one) => one.kind === 'chapter' && one.id !== markerId)
    .every((one) => {
      const where = order.indexOf(one.unitId as string);
      return where === -1 || where > mine;
    });
};

/**
 * What goes if this division is removed, in the writer's own nouns (§7).
 *
 * The honest answer has two halves and neither is *delete the story*: where
 * something is written, **the break goes and the words stay**, joining the
 * division before, because a heading is not the writing under it; where
 * nothing is written, the division and its empty sections go, which is the
 * one Ken hit. Which of the two it is is read every time rather than asked.
 */
export const divisionRemoval = (file: ProjectFile, markerId: StoryMarkerId): string => {
  const noun = nounsFor(file.project.format).division.toLowerCase();
  const sections = divisionSpan(file, markerId);
  if (emptyDivision(file, markerId)) {
    return `Nothing is written in it, so the ${noun} and its empty ${sections.length === 1 ? 'section' : 'sections'} go.`;
  }
  const one = sections.length === 1;
  // There is nothing before the first one to join, so the words simply stay
  // where they are and stand ahead of what is now the first. Saying *joins
  // the one before* there would be a promise about a place that does not
  // exist — the words survive either way, but only one of the two sentences
  // is true.
  if (isFirstDivision(file, markerId)) {
    return `The ${noun} break goes. ${one ? 'Its section stays' : 'Its sections stay'} where ${one ? 'it is' : 'they are'}, ahead of the first ${noun}; not a word is cut.`;
  }
  return `The ${noun} break goes. ${one ? 'Its section joins' : 'Its sections join'} the one before; not a word is cut.`;
};

/**
 * Take a division out: the marker, and its sections too where nothing is
 * written in them. One act, so the Stories rail in the workspace and the
 * Layout rail cannot disagree about what a × does — `divisionRemoval` has
 * already said it in words.
 */
export const removeDivision = (file: ProjectFile, markerId: StoryMarkerId): ProjectFile => {
  const marker = file.markers.find((candidate) => candidate.id === markerId);
  if (!marker) return file;
  const sections = emptyDivision(file, markerId) ? divisionSpan(file, markerId) : [];
  let next = removeMarker(file, markerId);
  for (const unit of sections) next = removeUnit(next, unit.id);
  return next;
};

/**
 * Move a chapter — a story in a collection — as a block (addendum 22 §3):
 * its span goes, in its own order, to stand before another chapter's span
 * or at the end of the story, and only the units that moved get a new key.
 * The rail's drag reads this; the Outliner's *Move the chapter to match* is
 * the same idea pointed at a row. Nothing is stored about the chapter but
 * where its sections fall, which is why moving them is moving it.
 */
export const moveChapterBlock = (file: ProjectFile, markerId: StoryMarkerId, beforeMarkerId: StoryMarkerId | null): ProjectFile => {
  if (markerId === beforeMarkerId) return file;
  const span = divisionSpan(file, markerId);
  if (span.length === 0) return file;
  const moving = new Set(span.map((unit) => unit.id as string));
  const rest = unitsInStoryOrder(file).filter((unit) => !moving.has(unit.id as string));
  let at = rest.length;
  if (beforeMarkerId !== null) {
    const target = file.markers.find((marker) => marker.id === beforeMarkerId);
    if (!target) return file;
    at = rest.findIndex((unit) => unit.id === target.unitId);
    if (at === -1) return file;
  }
  let before = at > 0 ? (rest[at - 1]?.orderKey ?? null) : null;
  const after = rest[at]?.orderKey ?? null;
  const timestamp = nowIso();
  const keys = new Map<string, string>();
  for (const unit of span) {
    const key = orderKeyBetween(before, after);
    keys.set(unit.id as string, key);
    before = key;
  }
  return {
    ...file,
    project: { ...file.project, updatedAt: timestamp },
    units: file.units.map((unit) => (keys.has(unit.id as string) ? { ...unit, orderKey: keys.get(unit.id as string)!, updatedAt: timestamp } : unit)),
  };
};

/**
 * The unit a row stands at in the story: its own, or the one its chapter
 * marker starts on. Null for a plan and for a beat, which stands in a unit
 * rather than among them.
 */
const anchorUnitOf = (file: ProjectFile, item: OutlineItem): string | null => {
  if (item.boundUnitId !== null) return item.boundUnitId as string;
  if (item.boundMarkerId !== null) {
    return (file.markers.find((marker) => marker.id === item.boundMarkerId)?.unitId as string | undefined) ?? null;
  }
  return null;
};

/** The scenes a row could be, in story order: every one not already spoken for. */
export const promotableUnits = (file: ProjectFile, itemId: OutlineItemId | null = null): StructuralUnit[] => {
  const taken = claimedInScript(file, itemId as string | null).units;
  return unitsInStoryOrder(file).filter((unit) => !taken.has(unit.id as string));
};

/**
 * This row **is** that scene, where the writer picks one that already exists
 * rather than making a new one.
 *
 * The row's name wins where it has one, because that is what the writer typed
 * in front of them; where the row is blank it takes the script's, so binding to
 * a scene that already has a name reads as recognising it rather than wiping
 * it.
 */
export const bindRow = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  unitId: StructuralUnitId,
): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  const unit = file.units.find((candidate) => candidate.id === unitId);
  if (!outline || !item || !unit) return file;
  if (promoteKindOf(item) !== 'unit') return file;
  if (claimedInScript(file, itemId as string).units.has(unitId as string)) return file;

  const title = item.title.trim() || unit.title;
  return retitleScript(
    writeRow(file, outlineId, itemId, { boundUnitId: unitId, boundBeatId: null, title }),
    { unitId },
    title,
  );
};

// ----------------------------- when the outline and the script disagree

/**
 * A promoted row whose neighbours in the outline are in a different order in
 * the script (§6).
 *
 * Moving a row moves the row, always — the outline never reorders the script
 * behind the writer's back. So the disagreement is said out loud instead, and
 * the offer to fix it is one click and is the writer's.
 */
export interface OutOfStepRow {
  itemId: OutlineItemId;
  /** The sibling it disagrees with, by name, for the sentence. */
  otherTitle: string;
  /** True where the outline puts this one first, which is what the script would become. */
  outlineFirst: boolean;
}

export const rowOutOfStep = (file: ProjectFile, outline: Outline, itemId: OutlineItemId): OutOfStepRow | null => {
  const item = findOutlineItem(outline, itemId);
  if (!item || !isPromoted(item)) return null;

  const siblings = outlineChildren(outline, item.parentId);
  const at = siblings.findIndex((candidate) => candidate.id === itemId);
  if (at === -1) return null;

  const parent = outlineParent(outline, item);
  // A chapter stands where its marker's unit stands (addendum 19 §2), so two
  // chapters, or a chapter and a section beside it, compare by their first
  // units in the story order.
  const amongUnits = item.boundUnitId !== null || item.boundMarkerId !== null;
  const order = amongUnits
    ? unitsInStoryOrder(file).map((unit) => unit.id as string)
    : parent?.boundUnitId
      ? beatsForUnit(file, parent.boundUnitId).map((beat) => beat.id as string)
      : file.beats.map((beat) => beat.id as string);

  const positionOf = (candidate: OutlineItem): number => {
    const id = amongUnits ? anchorUnitOf(file, candidate) : (candidate.boundBeatId as string | null);
    return id === null ? -1 : order.indexOf(id);
  };

  const mine = positionOf(item);
  if (mine === -1) return null;

  // The nearest promoted sibling either side is the one the sentence is
  // about: a disagreement with something three rows away is not what a writer
  // is looking at.
  for (const step of [-1, 1] as const) {
    for (let index = at + step; index >= 0 && index < siblings.length; index += step) {
      const other = siblings[index] as OutlineItem;
      const theirs = positionOf(other);
      if (theirs === -1) continue;
      const outlineFirst = step === 1;
      const scriptFirst = mine < theirs;
      if (outlineFirst !== scriptFirst) {
        return { itemId, otherTitle: other.title.trim() || 'the one beside it', outlineFirst };
      }
      break;
    }
  }
  return null;
};

/**
 * Move the script to match the outline, for one row, because the writer asked.
 *
 * The scene goes to the position its row has among its promoted siblings, and
 * nothing else is touched. **This is the only way the outline ever changes the
 * story order, and it is always a click.**
 */
export const followOutline = (file: ProjectFile, outlineId: OutlineId, itemId: OutlineItemId): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  if (!outline || !item || !isPromoted(item)) return file;

  const siblings = outlineChildren(outline, item.parentId);
  if (siblings.findIndex((candidate) => candidate.id === itemId) === -1) return file;

  if (item.boundMarkerId !== null) return followChapter(file, item, siblings);

  if (item.boundUnitId !== null) {
    const order = unitsInStoryOrder(file);
    const positionOf = (id: string) => order.findIndex((unit) => (unit.id as string) === id);
    // The index `moveUnit` wants counts every scene but this one, so a scene
    // moving down loses the place it is vacating.
    const target = indexAmong(item, siblings, unitPlaces(file), order.length);
    const here = positionOf(item.boundUnitId as string);
    const index = here !== -1 && target > here ? target - 1 : target;
    const unit = file.units.find((candidate) => candidate.id === item.boundUnitId);
    if (!unit) return file;
    // Its own track: the outline says where a scene is in the story, never
    // which thread it belongs to (addendum 02 §8).
    return moveUnit(file, { unitId: item.boundUnitId, toTrackId: unit.trackId, index });
  }

  const unitId = outlineParent(outline, item)?.boundUnitId ?? null;
  if (unitId === null || item.boundBeatId === null) return file;
  const order = beatsForUnit(file, unitId);
  const positionOf = (id: string) => order.findIndex((beat) => (beat.id as string) === id);
  const target = indexAmong(item, siblings, beatPlaces(order), order.length);
  const here = positionOf(item.boundBeatId as string);
  const index = here !== -1 && target > here ? target - 1 : target;
  return moveBeat(file, { beatId: item.boundBeatId, toUnitId: unitId, index });
};

/**
 * A chapter moved to match the outline moves **the whole of it** (addendum
 * 19 §2): every unit its marker covers, as one block, to after the last unit
 * of whatever promoted sibling is above it in the outline — or before the
 * first unit of the one below, or to the end. A chapter is a page and its
 * sections are what it is; moving the page and leaving them behind would
 * put the heading of chapter three over the sections of chapter two.
 *
 * The block is walked one unit at a time and each lands directly after the
 * one placed before it, read from the live order, so nothing is counted
 * twice however the block and its neighbours were interleaved.
 */
const followChapter = (file: ProjectFile, item: OutlineItem, siblings: readonly OutlineItem[]): ProjectFile => {
  const block = divisionSpan(file, item.boundMarkerId as StoryMarkerId).map((unit) => unit.id as string);
  if (block.length === 0) return file;
  const moving = new Set(block);

  /** The units a sibling stands for, first to last, or nothing for a plan. */
  const spanOf = (sibling: OutlineItem): string[] => {
    if (sibling.boundMarkerId !== null) {
      return divisionSpan(file, sibling.boundMarkerId).map((unit) => unit.id as string).filter((id) => !moving.has(id));
    }
    const anchor = anchorUnitOf(file, sibling);
    return anchor === null || moving.has(anchor) ? [] : [anchor];
  };

  const at = siblings.findIndex((candidate) => candidate.id === item.id);
  let after: string | null = null;
  let before: string | null = null;
  for (let index = at - 1; index >= 0 && after === null; index -= 1) {
    const span = spanOf(siblings[index] as OutlineItem);
    if (span.length > 0) after = span[span.length - 1] as string;
  }
  if (after === null) {
    for (let index = at + 1; index < siblings.length && before === null; index += 1) {
      const span = spanOf(siblings[index] as OutlineItem);
      if (span.length > 0) before = span[0] as string;
    }
  }

  let current = file;
  let previous: string | null = null;
  for (const unitId of block) {
    const unit = current.units.find((candidate) => (candidate.id as string) === unitId);
    if (!unit) continue;
    // `moveUnit` counts every unit but the one moving, so the place is read
    // from the order with this one lifted out.
    const rest = unitsInStoryOrder(current).map((one) => one.id as string).filter((id) => id !== unitId);
    const index =
      previous !== null
        ? rest.indexOf(previous) + 1
        : after !== null
          ? rest.indexOf(after) + 1
          : before !== null
            ? rest.indexOf(before)
            : rest.length;
    current = moveUnit(current, { unitId: unit.id, toTrackId: unit.trackId, index });
    previous = unitId;
  }
  return current;
};

// --------------------------------------------- the scene card (§7)

/**
 * What a Scene row says about itself, resolved from wherever it lives.
 *
 * **The card shows what exists**, which is the same rule the rest of the
 * module follows: read through rather than copy across. A row that is still a
 * plan has a name, a note and a status of its own, because that is all a plan
 * is. A row in the script has a number, a synopsis, a purpose, a point of view
 * and a track as well — and those are **the scene's own fields**, shown here
 * rather than copied here (§7), so there is no second set of them to keep in
 * step and promotion adds to the card rather than moving it.
 *
 * Empty throughout is the honest starting state. An unanswered field is not a
 * gap to be nagged about.
 */
export interface SceneCard {
  /** Whether these are the scene's fields or the row's own. */
  inScript: boolean;
  title: string;
  /** The scene's label in the script — "Sc. 14" — or null for a plan. */
  number: string | null;
  /** The summary, or the row's own note while it is still a plan. */
  synopsis: string;
  /** Why the scene is in the script (spec §8.2). Null for a plan. */
  purpose: string | null;
  /** Whose eyes it is seen through. Null for a plan. */
  pov: string | null;
  /** The thread it is drawn in (addendum 02 §8). Null for a plan. */
  track: { id: string; name: string } | null;
  status: string;
  /** How many beat rows are under it, promoted or not. */
  beats: number;
}

export const sceneCardOf = (file: ProjectFile, outline: Outline, item: OutlineItem): SceneCard | null => {
  if (item.kind !== 'scene') return null;

  const beats = outlineChildren(outline, item.id).filter((child) => child.kind === 'beat').length;
  const promoted = promotedOf(file, item);

  if (promoted?.kind !== 'unit') {
    return {
      inScript: false,
      title: item.title,
      number: null,
      synopsis: item.body,
      purpose: null,
      pov: null,
      track: null,
      status: item.status,
      beats,
    };
  }

  const unit = promoted.unit;
  const track = file.tracks.find((candidate) => candidate.id === unit.trackId);
  return {
    inScript: true,
    title: unit.title,
    number: unit.sequenceLabel,
    synopsis: unit.summary,
    purpose: unit.grid.purpose,
    pov: unit.grid.pov,
    track: track ? { id: track.id as string, name: track.name } : null,
    status: unit.status,
    beats,
  };
};
