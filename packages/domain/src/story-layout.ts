import { layoutFor, paginateElements } from './pagination.js';
import { beatsForUnit, lanesInOrder, markersInStoryOrder, unitsInStoryOrder } from './selectors.js';
import type { Lane, StoryMarker, StructuralUnit } from './entities/structure.js';
import type { StoryEntityRef } from './entities/links.js';
import type { ProjectFile } from './project-file.js';
import type { StructuralUnitId } from './ids.js';

/**
 * The geometry of the Plot Lanes timeline (addendum 02 §5).
 *
 * The horizontal axis is story order measured in pages, so a scene block is
 * as wide as the pages it takes and the ruler above it is page numbers. This
 * module computes that once, in the domain, so the ruler, the acts track and
 * every lane row draw from the same numbers — and so the numbers can be
 * tested without a browser.
 *
 * Pages are fractional here: a scene that fills a page and a third occupies
 * 1.33 units of the axis. Rendering rounds to pixels; the printed page count
 * (`pageCount`) is still the whole-page figure the industry means.
 */

export interface StorySpan {
  unit: StructuralUnit;
  /** Position in story order, 0-based. */
  index: number;
  /** Where on the page axis this scene starts. */
  startPage: number;
  /** How many pages the scene takes; can be zero. */
  pages: number;
  beatCount: number;
  /** The marker this scene starts, if any. */
  marker: StoryMarker | null;
}

export interface ActBand {
  marker: StoryMarker;
  /** First and last story index the band covers, inclusive. */
  fromIndex: number;
  toIndex: number;
}

export interface StoryLayout {
  spans: StorySpan[];
  lanes: Lane[];
  /** Total of every scene's pages; the length of the axis. */
  totalPages: number;
  acts: ActBand[];
}

/** Fractional pages a unit's manuscript takes on its own. */
export const pagesForUnit = (file: ProjectFile, unitId: StructuralUnitId): number => {
  const layout = layoutFor(file.project.format);
  const elements = beatsForUnit(file, unitId).flatMap((beat) => beat.manuscript.elements);
  const pages = paginateElements(elements, layout);
  if (pages.length === 0) return 0;
  const last = pages[pages.length - 1];
  const lastFraction = last ? Math.min(1, last.lines.length / layout.linesPerPage) : 0;
  return pages.length - 1 + lastFraction;
};

export const storyLayout = (file: ProjectFile): StoryLayout => {
  const units = unitsInStoryOrder(file);
  const markers = markersInStoryOrder(file);
  const markerByUnit = new Map(markers.map((marker) => [marker.unitId as string, marker]));

  let cursor = 0;
  const spans: StorySpan[] = units.map((unit, index) => {
    // A scene that is off takes no pages: it is not in the manuscript.
    const pages = unit.inScript ? pagesForUnit(file, unit.id) : 0;
    const span: StorySpan = {
      unit,
      index,
      startPage: cursor,
      pages,
      beatCount: beatsForUnit(file, unit.id).length,
      marker: markerByUnit.get(unit.id) ?? null,
    };
    cursor += pages;
    return span;
  });

  const acts: ActBand[] = markers.map((marker, position) => {
    const fromIndex = units.findIndex((unit) => unit.id === marker.unitId);
    const following = markers[position + 1];
    const toIndex = following ? units.findIndex((unit) => unit.id === following.unitId) - 1 : units.length - 1;
    return { marker, fromIndex, toIndex: Math.max(fromIndex, toIndex) };
  });

  return { spans, lanes: lanesInOrder(file), totalPages: cursor, acts };
};

export interface TimelineArc {
  id: string;
  /**
   * `setup`: a setup point with its payoff recorded — the promise was kept.
   * `open`: a setup point still waiting for its payoff; `toIndex` is null.
   * `link`: a typed story link (§7.4) between two scenes.
   */
  kind: 'setup' | 'open' | 'link';
  label: string;
  fromIndex: number;
  toIndex: number | null;
}

/** Story index of the scene an entity reference falls in, if it falls in one. */
const storyIndexOf = (file: ProjectFile, order: Map<string, number>, target: StoryEntityRef | null): number | null => {
  if (!target) return null;
  if (target.type === 'unit') return order.get(target.id) ?? null;
  if (target.type === 'beat') {
    const beat = file.beats.find((candidate) => candidate.id === target.id);
    return beat ? (order.get(beat.unitId) ?? null) : null;
  }
  return null;
};

/**
 * The curves on the timeline's links track (addendum 02 §4): every setup and
 * payoff, and every story link, whose ends fall in scenes. A setup whose
 * payoff is in the same scene is not drawn — there is nothing to bridge —
 * and neither is a link between a scene and itself.
 */
export const timelineArcs = (file: ProjectFile): TimelineArc[] => {
  const order = new Map(unitsInStoryOrder(file).map((unit, index) => [unit.id as string, index]));
  const arcs: TimelineArc[] = [];

  for (const record of file.setupsPayoffs) {
    if (record.archived) continue;
    const payoffIndex = storyIndexOf(file, order, record.payoff?.location ?? null);
    for (const point of record.setups) {
      const fromIndex = storyIndexOf(file, order, point.location);
      if (fromIndex === null) continue;
      if (payoffIndex === null) {
        arcs.push({ id: point.id, kind: 'open', label: `${record.title} — not yet paid off`, fromIndex, toIndex: null });
      } else if (payoffIndex !== fromIndex) {
        arcs.push({ id: point.id, kind: 'setup', label: record.title, fromIndex, toIndex: payoffIndex });
      }
    }
  }

  for (const link of file.links) {
    const fromIndex = storyIndexOf(file, order, link.from);
    const toIndex = storyIndexOf(file, order, link.to);
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) continue;
    arcs.push({
      id: link.id,
      kind: 'link',
      label: link.label || link.type.replace(/_/g, ' '),
      fromIndex,
      toIndex,
    });
  }

  return arcs;
};

/**
 * Pixel width of a span at a zoom level. The floor keeps an empty scene a
 * block you can read and drop on; without it a scene with no words would be
 * zero pixels wide and impossible to find.
 */
export const spanWidth = (span: StorySpan, pixelsPerPage: number, minimum = 150): number =>
  Math.max(minimum, Math.round(span.pages * pixelsPerPage));
