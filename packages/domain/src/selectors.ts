import { sortByOrderKey } from './ordering.js';
import { isUnresolved } from './entities/setups.js';
import { countWords } from './entities/manuscript.js';
import { refEquals, type StoryEntityRef, type StoryLink } from './entities/links.js';
import type { Beat, Lane, StructuralUnit } from './entities/structure.js';
import type { ResearchCategory, ResearchItem } from './entities/research.js';
import type { SetupPayoff } from './entities/setups.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, LaneId, ResearchCategoryId, StructuralUnitId } from './ids.js';

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

/** Categories the writer sees, in their chosen order; archived ones are hidden (§7.1). */
export const researchCategoriesInOrder = (file: ProjectFile, includeArchived = false): ResearchCategory[] =>
  sortByOrderKey(file.researchCategories.filter((category) => includeArchived || !category.archived));

/** Items in one category, newest ordering first honoured. */
export const researchItemsForCategory = (
  file: ProjectFile,
  categoryId: ResearchCategoryId,
  options: { usage?: 'used' | 'unused'; includeArchived?: boolean } = {},
): ResearchItem[] =>
  sortByOrderKey(
    file.researchItems.filter(
      (item) =>
        item.categoryId === categoryId &&
        (options.includeArchived || !item.archived) &&
        (options.usage === undefined || item.usage === options.usage),
    ),
  );

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

export interface ResolvedEntity {
  ref: StoryEntityRef;
  label: string;
  detail: string;
  /** False when the link points at something that is no longer in the project. */
  exists: boolean;
}

/**
 * Turn a link endpoint into something displayable.
 *
 * Links store `(type, id)` rather than a copied-out name (§7.4), so every
 * display of a relationship has to look the entity up — which is exactly what
 * makes a rename propagate everywhere it appears.
 */
export const resolveRef = (file: ProjectFile, target: StoryEntityRef): ResolvedEntity => {
  const found = (label: string, detail = ''): ResolvedEntity => ({ ref: target, label, detail, exists: true });
  const missing = (): ResolvedEntity => ({ ref: target, label: 'Missing element', detail: target.type, exists: false });

  switch (target.type) {
    case 'project':
      return file.project.id === target.id ? found(file.project.title, 'project') : missing();
    case 'lane': {
      const lane = file.lanes.find((candidate) => candidate.id === target.id);
      return lane ? found(lane.name, 'lane') : missing();
    }
    case 'unit': {
      const unit = file.units.find((candidate) => candidate.id === target.id);
      return unit ? found(unit.title || 'Untitled', unit.sequenceLabel || unit.kind) : missing();
    }
    case 'beat': {
      const beat = file.beats.find((candidate) => candidate.id === target.id);
      if (!beat) return missing();
      const parent = file.units.find((candidate) => candidate.id === beat.unitId);
      return found(beat.title || 'Untitled beat', parent ? parent.title || parent.kind : 'beat');
    }
    case 'research_item': {
      const item = file.researchItems.find((candidate) => candidate.id === target.id);
      if (!item) return missing();
      const category = file.researchCategories.find((candidate) => candidate.id === item.categoryId);
      return found(item.title, category?.name ?? 'research');
    }
    case 'character': {
      const character = file.characters.find((candidate) => candidate.id === target.id);
      return character ? found(character.name, 'character') : missing();
    }
    case 'setup_payoff': {
      const record = file.setupsPayoffs.find((candidate) => candidate.id === target.id);
      return record ? found(record.title, `setup/payoff · ${record.status}`) : missing();
    }
    default:
      return missing();
  }
};

export interface RelatedEntity {
  link: StoryLink;
  other: ResolvedEntity;
  /** True when `target` is the `from` side, which decides how to read the verb. */
  outgoing: boolean;
}

/** Everything linked to `target`, ready for the related-elements panel (§7.4). */
export const relatedEntities = (file: ProjectFile, target: StoryEntityRef): RelatedEntity[] =>
  linksFor(file, target).map((link) => {
    const outgoing = refEquals(link.from, target);
    return { link, outgoing, other: resolveRef(file, outgoing ? link.to : link.from) };
  });

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
