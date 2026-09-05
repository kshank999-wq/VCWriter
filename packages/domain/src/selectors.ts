import { sortByOrderKey } from './ordering.js';
import { isUnresolved } from './entities/setups.js';
import { countWords } from './entities/manuscript.js';
import { refEquals, type StoryEntityRef, type StoryLink } from './entities/links.js';
import type { Beat, Lane, StructuralUnit } from './entities/structure.js';
import type { ResearchItem } from './entities/research.js';
import type { SetupPayoff } from './entities/setups.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, LaneId, StructuralUnitId } from './ids.js';

/** Read-only views over a project document. All results are ordered. */

export const lanesInOrder = (file: ProjectFile): Lane[] => sortByOrderKey(file.lanes);

export const unitsForLane = (file: ProjectFile, laneId: LaneId): StructuralUnit[] =>
  sortByOrderKey(file.units.filter((unit) => unit.laneId === laneId));

export const beatsForUnit = (file: ProjectFile, unitId: StructuralUnitId): Beat[] =>
  sortByOrderKey(file.beats.filter((beat) => beat.unitId === unitId));

/** Every unit across every lane, in lane order then unit order. */
export const unitsInStoryOrder = (file: ProjectFile): StructuralUnit[] =>
  lanesInOrder(file).flatMap((lane) => unitsForLane(file, lane.id));

/** Every beat in reading order: lane, then unit, then beat. */
export const beatsInStoryOrder = (file: ProjectFile): Beat[] =>
  unitsInStoryOrder(file).flatMap((unit) => beatsForUnit(file, unit.id));

export const findBeat = (file: ProjectFile, beatId: BeatId): Beat | undefined =>
  file.beats.find((beat) => beat.id === beatId);

export const findUnit = (file: ProjectFile, unitId: StructuralUnitId): StructuralUnit | undefined =>
  file.units.find((unit) => unit.id === unitId);

export const findLane = (file: ProjectFile, laneId: LaneId): Lane | undefined =>
  file.lanes.find((lane) => lane.id === laneId);

/** Working inventory of material not yet incorporated into the story (§7.2). */
export const unusedResearch = (file: ProjectFile): ResearchItem[] =>
  sortByOrderKey(file.researchItems.filter((item) => item.usage === 'unused' && !item.archived));

export const usedResearch = (file: ProjectFile): ResearchItem[] =>
  sortByOrderKey(file.researchItems.filter((item) => item.usage === 'used' && !item.archived));

/** Setups the writer has not yet paid off, and payoffs not yet established (§7.3). */
export const unresolvedSetupsPayoffs = (file: ProjectFile): SetupPayoff[] =>
  file.setupsPayoffs.filter(isUnresolved);

/** Every link touching `target`, in either direction. */
export const linksFor = (file: ProjectFile, target: StoryEntityRef): StoryLink[] =>
  file.links.filter((link) => refEquals(link.from, target) || refEquals(link.to, target));

/** The other end of each link touching `target` — powers the related-elements panel (§7.4). */
export const relatedRefs = (file: ProjectFile, target: StoryEntityRef): StoryEntityRef[] =>
  linksFor(file, target).map((link) => (refEquals(link.from, target) ? link.to : link.from));

export interface ProjectStats {
  laneCount: number;
  unitCount: number;
  beatCount: number;
  writtenBeatCount: number;
  wordCount: number;
  unusedResearchCount: number;
  unresolvedSetupCount: number;
  pendingCaptureCount: number;
}

/** Numbers behind the project dashboard (§4). */
export const projectStats = (file: ProjectFile): ProjectStats => ({
  laneCount: file.lanes.length,
  unitCount: file.units.length,
  beatCount: file.beats.length,
  writtenBeatCount: file.beats.filter((beat) => beat.status === 'written' || beat.status === 'revised').length,
  wordCount: file.beats.reduce((total, beat) => total + countWords(beat.manuscript), 0),
  unusedResearchCount: unusedResearch(file).length,
  unresolvedSetupCount: unresolvedSetupsPayoffs(file).length,
  pendingCaptureCount: 0,
});
