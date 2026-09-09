import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { orderKeyForIndex } from './ordering.js';
import { beatSchema, storyMarkerSchema, structuralUnitSchema } from './entities/structure.js';
import { beatsForUnit, lanesInOrder, unitsInStoryOrder } from './selectors.js';
import { defaultMarkerKind, placedMarkers } from './markers.js';
import { pagesForUnit } from './story-layout.js';
import { moveUnit, DomainError } from './mutations.js';
import type { ProjectFile } from './project-file.js';
import type { StoryMarker, StoryMarkerKind, StructuralUnit } from './entities/structure.js';
import type { BeatId, LaneId, StoryMarkerId, StructuralUnitId } from './ids.js';

/**
 * Story Sculptor: the spine of the canvas (addendum 03).
 *
 * The canvas runs **down** through story time and **across** into detail.
 * What runs down it is this: the story from its beginning to its end, cut
 * into regions by the structure points the writer has put in.
 *
 * **A region is a span, not a container** (addendum 03 §13.3). It runs from
 * its structure point to the next one, and it is computed from the story
 * order rather than stored beside it — the same shape an episode already has
 * (addendum 02 §17). So a scene dragged past a structure point is in the next
 * region because it *is* in the next region; there is nothing to keep in step
 * and nothing that can disagree.
 *
 * **Beginning and End are not data.** A story has a beginning and an end
 * whatever is in it, so the canvas draws them as bookends rather than storing
 * two nodes a writer could delete and be left with a story that starts
 * nowhere.
 */

export interface SculptorRegion {
  /**
   * The structure point that opens it, or null for the run before the first
   * one — the opening of the story, which belongs to no region yet and is not
   * an error. It is the state every project is in before anything is marked.
   */
  marker: StoryMarker | null;
  /** "ACT I", "Chapter 4", or the writer's own words for a milestone. */
  label: string;
  /** Where it sits in the story: first and last index, inclusive. Empty: -1. */
  fromIndex: number;
  toIndex: number;
  /** The scenes in it, in story order. */
  units: StructuralUnit[];
  beats: number;
  /** How much manuscript is under it, which is what makes it tall. */
  pages: number;
}

export interface SculptorSpine {
  /** The opening run first where there is one, then a region per structure point. */
  regions: SculptorRegion[];
  /** Every scene in the story, so the canvas can size itself against the whole. */
  units: number;
  pages: number;
}

/**
 * The story cut into its regions.
 *
 * Every structure point opens one, whatever kind it is: an act, a chapter, an
 * episode and a milestone of the writer's own are all points on the same
 * spine, and the Sculptor does not care which paradigm they came from — that
 * is the whole of §2's "any model the writer likes, or no named paradigm".
 */
export const sculptorSpine = (file: ProjectFile): SculptorSpine => {
  const units = unitsInStoryOrder(file);
  const placed = placedMarkers(file).sort((a, b) => a.unitIndex - b.unitIndex);

  const regionAt = (marker: StoryMarker | null, label: string, from: number, to: number): SculptorRegion => {
    const own = units.slice(from, to + 1);
    return {
      marker,
      label,
      fromIndex: own.length > 0 ? from : -1,
      toIndex: own.length > 0 ? to : -1,
      units: own,
      beats: own.reduce((total, unit) => total + beatsForUnit(file, unit.id).length, 0),
      pages: own.reduce((total, unit) => total + (unit.inScript ? pagesForUnit(file, unit.id) : 0), 0),
    };
  };

  const regions: SculptorRegion[] = [];

  // Whatever comes before the first structure point. Drawn only when there is
  // something in it: an empty opening is a rule about the story, not a part
  // of it, and a blank band saying nothing is worse than no band.
  const opensAt = placed[0]?.unitIndex ?? units.length;
  if (opensAt > 0) regions.push(regionAt(null, 'Opening', 0, opensAt - 1));

  placed.forEach((point, position) => {
    const next = placed[position + 1];
    const to = (next ? next.unitIndex : units.length) - 1;
    regions.push(regionAt(point.marker, point.label, point.unitIndex, to));
  });

  return {
    regions,
    units: units.length,
    pages: regions.reduce((total, region) => total + region.pages, 0),
  };
};

/**
 * Put a structure point in the story, and give it the scene it begins at.
 *
 * A marker marks *this scene starts this act*, so a structure point needs a
 * scene to mark — and a writer who has only a beginning and an end has none
 * yet. Making one is not a liberty: the point of the canvas is that the
 * largest forms come first and the scenes are filled in under them later, so
 * the scene this creates is the place that filling-in will happen.
 *
 * `index` is a position among every scene in the story, as `moveUnit` counts
 * them. Omitted, the point goes at the end.
 */
export const addStructurePoint = (
  file: ProjectFile,
  input: { title?: string; kind?: StoryMarkerKind; index?: number; laneId?: LaneId },
): { file: ProjectFile; marker: StoryMarker; unit: StructuralUnit; beatId: BeatId } => {
  const lane = input.laneId
    ? lanesInOrder(file).find((candidate) => candidate.id === input.laneId)
    : lanesInOrder(file)[0];
  if (!lane) throw new DomainError('A project needs a lane before a structure point can be put in it');

  const timestamp = nowIso();
  const order = unitsInStoryOrder(file);
  const at = Math.max(0, Math.min(input.index ?? order.length, order.length));

  const unit = structuralUnitSchema.parse({
    id: newId<StructuralUnitId>(),
    projectId: file.project.id,
    laneId: lane.id,
    kind: file.project.format === 'novel' || file.project.format === 'short_story' ? 'chapter' : 'scene',
    title: '',
    sequenceLabel: '',
    orderKey: orderKeyForIndex(order, at),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // A scene with nowhere to write in it is a scene the writer has to fix
  // before they can use it, so it comes with the one empty beat.
  const beat = beatSchema.parse({
    id: newId<BeatId>(),
    projectId: file.project.id,
    unitId: unit.id,
    title: '',
    orderKey: orderKeyForIndex([], 0),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const marker = storyMarkerSchema.parse({
    id: newId<StoryMarkerId>(),
    projectId: file.project.id,
    unitId: unit.id,
    kind: input.kind ?? defaultMarkerKind(file.project.format),
    title: input.title?.trim() ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    file: {
      ...file,
      units: [...file.units, unit],
      beats: [...file.beats, beat],
      markers: [...file.markers, marker],
      project: { ...file.project, updatedAt: timestamp },
    },
    marker,
    unit,
    beatId: beat.id,
  };
};

/**
 * Move a structure point, and take its region with it.
 *
 * "Move the midpoint earlier" means the midpoint *and what is under it* move
 * earlier — a boundary that slid off its material would leave the story
 * saying something the writer did not ask for. `toPosition` counts the
 * regions that have a structure point, in story order.
 */
export const moveStructurePoint = (
  file: ProjectFile,
  markerId: StoryMarkerId,
  toPosition: number,
): ProjectFile => {
  const spine = sculptorSpine(file);
  const marked = spine.regions.filter((region) => region.marker !== null);
  const from = marked.findIndex((region) => region.marker?.id === markerId);
  if (from < 0) throw new DomainError(`Structure point ${markerId} is not in the story`);

  const to = Math.max(0, Math.min(toPosition, marked.length - 1));
  if (to === from) return file;

  const moving = marked[from] as SculptorRegion;
  if (moving.units.length === 0) return file;

  // Where the run lands: the first scene of the region it is going in front
  // of, counted with the moving scenes taken out.
  const target = marked[to] as SculptorRegion;
  const staying = unitsInStoryOrder(file).filter(
    (unit) => !moving.units.some((own) => own.id === unit.id),
  );
  const anchor = to < from ? target.units[0] : (marked[to + 1]?.units[0] ?? null);
  const landing = anchor
    ? staying.findIndex((unit) => unit.id === anchor.id)
    : staying.length;

  let next = file;
  moving.units.forEach((unit, offset) => {
    next = moveUnit(next, {
      unitId: unit.id,
      toLaneId: unit.laneId,
      index: (landing < 0 ? staying.length : landing) + offset,
    });
  });
  return next;
};

/** What a structure point can be, in this format. */
export const structurePointKinds = (file: ProjectFile): StoryMarkerKind[] => {
  const format = file.project.format;
  if (format === 'series') return ['episode', 'act', 'sequence', 'note'];
  if (format === 'novel' || format === 'short_story') return ['part', 'chapter', 'note'];
  return ['act', 'sequence', 'note'];
};
