import { initialOrderKeys } from './ordering.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { divisionSpan } from './outline-binding.js';
import { madeItem, outlineChildren, sectionRowOf } from './outline.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { ProjectFile } from './project-file.js';
import type { OutlineItemId, StructuralUnitId } from './ids.js';

/**
 * **The outline and the track, kept in one order** (from Ken: *when it's
 * rearranged in the track, the beats need to be rearranged in the outliner
 * and vice versa. So they're definitely linked*).
 *
 * A promoted row is bound to a section (unit), a subsection (beat) or a
 * chapter (marker). Until now moving one side left the other where it was and
 * offered *Follow the outline* by hand. Now every change runs through
 * `keepLinked`: when the outline's shape changed, the track is put in the
 * outline's order; when only the track's order changed, the outline is put in
 * the track's. Rows and units that are not bound keep their places — only the
 * slots the bound ones occupy are refilled — so nothing unlinked moves.
 */

/** Every row in reading order, top to bottom, folds ignored. */
const reading = (outline: Outline): OutlineItem[] => {
  const out: OutlineItem[] = [];
  const walk = (parentId: OutlineItemId | null): void => {
    for (const child of outlineChildren(outline, parentId)) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(null);
  return out;
};

/** A list with the slots its chosen members hold refilled in a new order. */
const refill = <T>(list: readonly T[], chosen: (item: T) => boolean, order: readonly T[]): T[] => {
  const next = [...list];
  let k = 0;
  for (let index = 0; index < next.length; index += 1) {
    if (chosen(next[index] as T)) next[index] = order[k++] as T;
  }
  return next;
};

const sameIds = (a: readonly { id: string }[], b: readonly { id: string }[]): boolean =>
  a.length === b.length && a.every((one, index) => one.id === (b[index] as { id: string }).id);

// ---------------------------------------------------------- track follows outline

/**
 * The track put in the outline's order: sections in the order their rows read,
 * subsections in the order their rows read under their section (at any depth),
 * a subsection whose row now stands in another section moved into it, and each
 * chapter starting on the first of its sections.
 */
export const alignScriptToOutline = (file: ProjectFile): ProjectFile => {
  let current = file;
  for (const outline of current.outlines ?? []) {
    const rows = reading(outline);
    const unitIds = new Set(current.units.map((unit) => unit.id as string));

    // Sections.
    const wanted = rows
      .filter((row) => row.boundUnitId && unitIds.has(row.boundUnitId as string))
      .map((row) => row.boundUnitId as string)
      .filter((id, index, all) => all.indexOf(id) === index);
    const wantedSet = new Set(wanted);
    const story = unitsInStoryOrder(current);
    const byId = new Map(story.map((unit) => [unit.id as string, unit]));
    const nextStory = refill(story, (unit) => wantedSet.has(unit.id as string), wanted.map((id) => byId.get(id)!));
    if (!sameIds(story, nextStory)) {
      const keys = initialOrderKeys(nextStory.length);
      const keyOf = new Map(nextStory.map((unit, index) => [unit.id as string, keys[index] as string]));
      current = { ...current, units: current.units.map((unit) => ({ ...unit, orderKey: keyOf.get(unit.id as string) ?? unit.orderKey })) };
    }

    // Subsections, section by section.
    const beatIds = new Set(current.beats.map((beat) => beat.id as string));
    for (const section of rows.filter((row) => row.kind === 'scene' && row.boundUnitId && unitIds.has(row.boundUnitId as string))) {
      const unitId = section.boundUnitId as StructuralUnitId;
      const under = rows.filter(
        (row) => row.boundBeatId && beatIds.has(row.boundBeatId as string) && sectionRowOf(outline, row)?.id === section.id,
      );
      const want = under.map((row) => row.boundBeatId as string);
      // A subsection whose row moved into this section goes into it.
      const moved = new Set(want.filter((id) => current.beats.find((beat) => beat.id === id)?.unitId !== unitId));
      if (moved.size > 0) {
        current = { ...current, beats: current.beats.map((beat) => (moved.has(beat.id as string) ? { ...beat, unitId } : beat)) };
      }
      const order = beatsForUnit(current, unitId);
      const wantSet = new Set(want);
      const beatById = new Map(order.map((beat) => [beat.id as string, beat]));
      const nextOrder = refill(order, (beat) => wantSet.has(beat.id as string), want.map((id) => beatById.get(id)!).filter(Boolean));
      if (moved.size > 0 || !sameIds(order, nextOrder)) {
        const keys = initialOrderKeys(nextOrder.length);
        const keyOf = new Map(nextOrder.map((beat, index) => [beat.id as string, keys[index] as string]));
        current = { ...current, beats: current.beats.map((beat) => (keyOf.has(beat.id as string) ? { ...beat, orderKey: keyOf.get(beat.id as string)! } : beat)) };
      }
    }

    // Each chapter starts on the first of its sections.
    for (const chapter of rows.filter((row) => row.kind === 'chapter' && row.boundMarkerId)) {
      const first = rows.find((row) => row.boundUnitId && unitIds.has(row.boundUnitId as string) && isUnderRow(outline, row, chapter.id));
      const marker = current.markers.find((one) => one.id === chapter.boundMarkerId);
      if (first && marker && marker.unitId !== first.boundUnitId) {
        current = {
          ...current,
          markers: current.markers.map((one) => (one.id === marker.id ? { ...one, unitId: first.boundUnitId as StructuralUnitId } : one)),
        };
      }
    }
  }
  return current;
};

const isUnderRow = (outline: Outline, row: OutlineItem, ancestorId: OutlineItemId): boolean => {
  let at = row.parentId;
  for (let step = 0; at && step <= outline.items.length; step += 1) {
    if (at === ancestorId) return true;
    at = outline.items.find((one) => one.id === at)?.parentId ?? null;
  }
  return false;
};

// ---------------------------------------------------------- outline follows track

/** Re-key a parent's children to a given order. */
const rekey = (outline: Outline, parentId: OutlineItemId | null, order: readonly OutlineItem[]): Outline => {
  const keys = initialOrderKeys(order.length);
  const keyOf = new Map(order.map((row, index) => [row.id as string, keys[index] as string]));
  return {
    ...outline,
    items: outline.items.map((row) =>
      keyOf.has(row.id as string) && row.parentId === parentId ? { ...row, orderKey: keyOf.get(row.id as string)! } : row,
    ),
  };
};

/**
 * The outline put in the track's order: a section's row under the chapter
 * whose stretch of the track it now falls in, sections in story order among
 * their siblings, a subsection's row moved under the section its beat is now
 * in, and subsections in the order of their beats.
 */
export const alignOutlineToScript = (file: ProjectFile): ProjectFile => {
  const story = unitsInStoryOrder(file).map((unit) => unit.id as string);
  const unitAt = new Map(story.map((id, index) => [id, index]));
  const beatAt = new Map<string, number>();
  const beatUnit = new Map<string, string>();
  for (const unitId of story) {
    beatsForUnit(file, unitId as StructuralUnitId).forEach((beat, index) => {
      beatAt.set(beat.id as string, index);
      beatUnit.set(beat.id as string, unitId);
    });
  }

  const markerUnit = new Map(file.markers.map((marker) => [marker.id as string, marker.unitId as string]));
  const outlines = (file.outlines ?? []).map((original) => {
    let outline = original;
    const at = (id: OutlineItemId) => outline.items.find((one) => one.id === id);

    // A section's row under the chapter it now falls in.
    const chapterOfUnit = new Map<string, OutlineItemId>();
    for (const chapter of outline.items.filter((row) => row.kind === 'chapter' && row.boundMarkerId)) {
      for (const unit of divisionSpan(file, chapter.boundMarkerId!)) chapterOfUnit.set(unit.id as string, chapter.id);
    }
    outline = {
      ...outline,
      items: outline.items.map((row) => {
        if (row.kind !== 'scene' || !row.boundUnitId) return row;
        const chapterId = chapterOfUnit.get(row.boundUnitId as string);
        const parent = row.parentId ? at(row.parentId) : undefined;
        if (!chapterId || (parent && parent.kind !== 'chapter') || row.parentId === chapterId) return row;
        return { ...row, parentId: chapterId, orderKey: 'zz' };
      }),
    };

    // A subsection's row under the section its beat is now in.
    const sectionOfUnit = new Map(
      outline.items.filter((row) => row.kind === 'scene' && row.boundUnitId).map((row) => [row.boundUnitId as string, row.id]),
    );
    outline = {
      ...outline,
      items: outline.items.map((row) => {
        if (!row.boundBeatId) return row;
        const unitId = beatUnit.get(row.boundBeatId as string);
        const target = unitId ? sectionOfUnit.get(unitId) : undefined;
        if (!target || sectionRowOf(outline, row)?.id === target) return row;
        return { ...row, parentId: target, orderKey: 'zz' };
      }),
    };

    // Bound siblings in the track's order, parent by parent.
    const parents = new Set<string | null>(outline.items.map((row) => (row.parentId as string | null) ?? null));
    for (const parentId of parents) {
      const siblings = outlineChildren(outline, parentId as OutlineItemId | null);
      // Sections by their place in the track, and chapters by where they
      // start, a chapter standing just before the section it opens on.
      const placeOf = (row: OutlineItem): number | null => {
        if (row.boundUnitId && unitAt.has(row.boundUnitId as string)) return unitAt.get(row.boundUnitId as string)! * 2 + 1;
        const marker = row.boundMarkerId ? markerUnit.get(row.boundMarkerId as string) : undefined;
        return marker !== undefined && unitAt.has(marker) ? unitAt.get(marker)! * 2 : null;
      };
      const units = siblings.filter((row) => placeOf(row) !== null);
      const beats = siblings.filter((row) => row.boundBeatId && beatAt.has(row.boundBeatId as string));
      let next = siblings;
      if (units.length > 1) {
        const sorted = [...units].sort((a, b) => placeOf(a)! - placeOf(b)!);
        next = refill(next, (row) => units.includes(row), sorted);
      }
      if (beats.length > 1) {
        const sorted = [...beats].sort((a, b) => beatAt.get(a.boundBeatId as string)! - beatAt.get(b.boundBeatId as string)!);
        next = refill(next, (row) => beats.includes(row), sorted);
      }
      const misKeyed = siblings.some((row) => row.orderKey === 'zz');
      if (misKeyed || !sameIds(siblings, next)) outline = rekey(outline, parentId as OutlineItemId | null, next);
    }
    return outline;
  });
  return { ...file, outlines };
};

// ---------------------------------------------------------- track into outline

/**
 * **What is in the track is in the outline** (from Ken: *when new beats show
 * up in the track view, they need to also be included in the outliner, and
 * they'll just be marked as green because they're already in the track*).
 *
 * A section (unit) or subsection (beat) that no outline row is bound to gets
 * one, bound to it: a section's row under the chapter row whose stretch of
 * the track it falls in (or at the top), a subsection's under its section's
 * row. They arrive keyed last and `alignOutlineToScript` puts them in the
 * track's order. Only where the project has an outline at all.
 */
export const adoptScriptIntoOutline = (file: ProjectFile): ProjectFile => {
  const outline = (file.outlines ?? [])[0];
  if (!outline) return file;
  const boundUnits = new Set<string>();
  const boundBeats = new Set<string>();
  for (const one of file.outlines ?? []) {
    for (const row of one.items) {
      if (row.boundUnitId) boundUnits.add(row.boundUnitId as string);
      if (row.boundBeatId) boundBeats.add(row.boundBeatId as string);
    }
  }
  const story = unitsInStoryOrder(file);
  const missingUnits = story.filter((unit) => !boundUnits.has(unit.id as string));
  const missingBeats = file.beats.filter((beat) => !boundBeats.has(beat.id as string));
  if (missingUnits.length === 0 && missingBeats.length === 0) return file;

  const items = [...outline.items];
  const chapterOfUnit = new Map<string, OutlineItemId>();
  for (const chapter of items.filter((row) => row.kind === 'chapter' && row.boundMarkerId)) {
    for (const unit of divisionSpan(file, chapter.boundMarkerId!)) chapterOfUnit.set(unit.id as string, chapter.id);
  }
  const sectionOfUnit = new Map<string, OutlineItemId>();
  for (const one of file.outlines ?? []) {
    for (const row of one.items) if (row.kind === 'scene' && row.boundUnitId) sectionOfUnit.set(row.boundUnitId as string, row.id);
  }
  for (const unit of missingUnits) {
    const row = {
      ...madeItem({ outlineId: outline.id, parentId: chapterOfUnit.get(unit.id as string) ?? null, orderKey: 'zz', kind: 'scene', title: unit.title }),
      boundUnitId: unit.id,
    };
    items.push(row);
    sectionOfUnit.set(unit.id as string, row.id);
  }
  for (const beat of missingBeats) {
    const parentId = sectionOfUnit.get(beat.unitId as string);
    if (!parentId) continue;
    items.push({ ...madeItem({ outlineId: outline.id, parentId, orderKey: 'zz', kind: 'beat', title: beat.title }), boundBeatId: beat.id });
  }
  return { ...file, outlines: (file.outlines ?? []).map((one) => (one.id === outline.id ? { ...one, items } : one)) };
};

// ---------------------------------------------------------- one entry point

/** Where every row stands and what it is bound to: the outline's shape. */
const outlineShape = (file: ProjectFile): string =>
  (file.outlines ?? [])
    .map((outline) =>
      outline.items
        .map((row) => `${row.id}:${row.parentId}:${row.orderKey}:${row.boundUnitId}:${row.boundBeatId}:${row.boundMarkerId}`)
        .join('|'),
    )
    .join('#');

/** Where every section and subsection stands in the track. */
const scriptShape = (file: ProjectFile): string =>
  `${file.units.map((unit) => `${unit.id}:${unit.orderKey}`).join('|')}#${file.beats.map((beat) => `${beat.id}:${beat.unitId}:${beat.orderKey}`).join('|')}#${file.markers.map((marker) => `${marker.id}:${marker.unitId}`).join('|')}`;

/**
 * Keep the two in one order after a change. The side that moved leads: an
 * outline change puts the track in the outline's order, a track change (with
 * the outline untouched) puts the outline in the track's.
 */
export const keepLinked = (before: ProjectFile, after: ProjectFile): ProjectFile => {
  if (before === after || (after.outlines ?? []).length === 0) return after;
  // A section or subsection made in the track (or one never in the outline)
  // joins the outline, bound and green, then everything is put in order.
  const madeInTrack = before.units.length !== after.units.length || before.beats.length !== after.beats.length;
  if (madeInTrack) {
    const adopted = adoptScriptIntoOutline(after);
    if (adopted !== after) return alignOutlineToScript(adopted);
  }
  if (!(after.outlines ?? []).some((outline) => outline.items.some((row) => row.boundUnitId || row.boundBeatId))) {
    return after;
  }
  const outlineMoved = before.outlines !== after.outlines && outlineShape(before) !== outlineShape(after);
  if (outlineMoved) return alignScriptToOutline(after);
  const scriptMoved =
    (before.units !== after.units || before.beats !== after.beats || before.markers !== after.markers) &&
    scriptShape(before) !== scriptShape(after);
  if (scriptMoved) return alignOutlineToScript(after);
  return after;
};

