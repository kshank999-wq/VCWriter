import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { orderKeyForIndex } from './ordering.js';
import { beatSchema, storyMarkerSchema, structuralUnitSchema } from './entities/structure.js';
import { beatsForUnit, lanesInOrder, unitsInStoryOrder } from './selectors.js';
import { defaultMarkerKind, placedMarkers } from './markers.js';
import { pagesForUnit } from './story-layout.js';
import { addBeat, addUnit, moveUnit, DomainError } from './mutations.js';
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

/**
 * The canvas is measured in **units**, not pixels: the domain says how much
 * room a thing needs and the renderer decides how big a unit is, so the zoom
 * is a property of the screen and the shape is a property of the story.
 *
 * A node is as tall as **what is inside it** (§4) — not as long as its
 * manuscript. This is a diagram of the structure, not a bar chart of the word
 * count: a region with eight scenes in it is tall because it has eight
 * scenes, whether or not a word of them is written.
 */
export const SCENE_UNITS = 2;
export const BEAT_UNITS = 1;
export const REGION_HEAD_UNITS = 2;
/** A region with nothing in it is still a place on the canvas. */
export const REGION_MIN_UNITS = 4;

export interface SculptorScene {
  unit: StructuralUnit;
  beats: number;
  /** How much of it is written. A figure to show, never a height. */
  pages: number;
  /** The room it needs: itself, and a row for each beat in it. */
  extent: number;
}

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
  /** The same scenes, each measured. */
  scenes: SculptorScene[];
  beats: number;
  /** How much manuscript is under it. A figure to show, never a height. */
  pages: number;
  /**
   * The room it needs: its own head, and everything under it. **This is the
   * automatic expansion** — put a scene in and the number goes up, because it
   * is a sum of what is there rather than a size somebody set.
   */
  extent: number;
}

export interface SculptorSpine {
  /** The opening run first where there is one, then a region per structure point. */
  regions: SculptorRegion[];
  /** Every scene in the story, so the canvas can size itself against the whole. */
  units: number;
  pages: number;
  /** The whole canvas, so a mini-map can be drawn against it later. */
  extent: number;
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
    const scenes: SculptorScene[] = own.map((unit) => {
      const beats = beatsForUnit(file, unit.id).length;
      return {
        unit,
        beats,
        pages: unit.inScript ? pagesForUnit(file, unit.id) : 0,
        extent: SCENE_UNITS + beats * BEAT_UNITS,
      };
    });
    const inside = scenes.reduce((total, scene) => total + scene.extent, 0);
    return {
      marker,
      label,
      fromIndex: own.length > 0 ? from : -1,
      toIndex: own.length > 0 ? to : -1,
      units: own,
      scenes,
      beats: scenes.reduce((total, scene) => total + scene.beats, 0),
      pages: scenes.reduce((total, scene) => total + scene.pages, 0),
      extent: Math.max(REGION_MIN_UNITS, REGION_HEAD_UNITS + inside),
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
    extent: regions.reduce((total, region) => total + region.extent, 0),
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
 * Put a scene in a region (§4).
 *
 * It goes at the end of the region's run, which is where a writer filling a
 * shape in puts the next one. Nothing about the region is edited: the scene
 * lands at that position in the story order and the region is bigger because
 * it now contains it — which is the whole of "automatic vertical expansion".
 *
 * The opening — the run before the first structure point — takes scenes the
 * same way, with `markerId` null.
 */
export const addSceneToRegion = (
  file: ProjectFile,
  markerId: StoryMarkerId | null,
  input: { title?: string } = {},
): { file: ProjectFile; unit: StructuralUnit; beatId: BeatId } => {
  const region = sculptorSpine(file).regions.find((candidate) =>
    markerId === null ? candidate.marker === null : candidate.marker?.id === markerId,
  );
  if (!region) throw new DomainError(`Region ${markerId ?? 'opening'} is not in the story`);

  // The lane the region is already plotted in, so a scene added to a subplot's
  // act does not jump to the main plot.
  const lane =
    region.units.at(-1)?.laneId ?? lanesInOrder(file)[0]?.id;
  if (!lane) throw new DomainError('A project needs a lane before a scene can be put in it');

  const made = addUnit(file, {
    laneId: lane,
    ...(input.title ? { title: input.title } : {}),
    index: region.toIndex >= 0 ? region.toIndex + 1 : 0,
  });
  const beat = addBeat(made.file, { unitId: made.unit.id });
  return { file: beat.file, unit: made.unit, beatId: beat.beat.id };
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
