import { sortByOrderKey } from './ordering.js';
import { onlyLiving } from './graveyard.js';
import { isUnresolved } from './entities/setups.js';
import { countWords } from './entities/manuscript.js';
import { refEquals, type StoryEntityRef, type StoryLink } from './entities/links.js';
import type { Beat, Track, StoryMarker, StructuralUnit } from './entities/structure.js';
import type { ResearchCategory, ResearchItem } from './entities/research.js';
import type { SetupPayoff } from './entities/setups.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, TrackId, ResearchCategoryId, StructuralUnitId } from './ids.js';

/** Read-only views over a project document. All results are ordered. */

export const tracksInOrder = (file: ProjectFile): Track[] => sortByOrderKey(file.tracks);

/** The scenes drawn in one track, in story order. */
export const unitsForTrack = (file: ProjectFile, trackId: TrackId): StructuralUnit[] =>
  sortByOrderKey(file.units.filter((unit) => unit.trackId === trackId));

export const beatsForUnit = (file: ProjectFile, unitId: StructuralUnitId): Beat[] =>
  sortByOrderKey(file.beats.filter((beat) => beat.unitId === unitId));

/**
 * The beats of a scene that are in the script: what the manuscript, the
 * page count and every export are made of. A beat switched off keeps its
 * text and is skipped here (addendum 02 §4).
 */
export const beatsInScript = (file: ProjectFile, unitId: StructuralUnitId): Beat[] =>
  beatsForUnit(file, unitId).filter((beat) => beat.inScript);

/**
 * Every scene in the order the story tells them, whatever track each is in
 * (addendum 02 §8). This is the print order.
 */
export const unitsInStoryOrder = (file: ProjectFile): StructuralUnit[] => sortByOrderKey(file.units);

/** Every beat in reading order: scene, then beat. */
export const beatsInStoryOrder = (file: ProjectFile): Beat[] =>
  unitsInStoryOrder(file).flatMap((unit) => beatsForUnit(file, unit.id));

/** Markers in the order of the scenes they start; one starting a missing scene is left out. */
export const markersInStoryOrder = (file: ProjectFile): StoryMarker[] => {
  const position = new Map(unitsInStoryOrder(file).map((unit, index) => [unit.id as string, index]));
  return file.markers
    .filter((marker) => position.has(marker.unitId))
    .sort((a, b) => (position.get(a.unitId) as number) - (position.get(b.unitId) as number) || a.id.localeCompare(b.id));
};

export const markerForUnit = (file: ProjectFile, unitId: StructuralUnitId): StoryMarker | undefined =>
  file.markers.find((marker) => marker.unitId === unitId);

export const findBeat = (file: ProjectFile, beatId: BeatId): Beat | undefined =>
  file.beats.find((beat) => beat.id === beatId);

export const findUnit = (file: ProjectFile, unitId: StructuralUnitId): StructuralUnit | undefined =>
  file.units.find((unit) => unit.id === unitId);

export const findTrack = (file: ProjectFile, trackId: TrackId): Track | undefined =>
  file.tracks.find((track) => track.id === trackId);

/** Categories the writer sees, in their chosen order; archived ones are hidden (§7.1). */
export const researchCategoriesInOrder = (file: ProjectFile, includeArchived = false): ResearchCategory[] =>
  sortByOrderKey(file.researchCategories.filter((category) => includeArchived || !category.archived));

/**
 * Research as the tree it is drawn as (addendum 02 §7): folders in order,
 * each with the folders under it, how many items are filed directly in it,
 * and how many are in it and everything below.
 *
 * A folder whose parent is missing — or whose parents form a loop, which
 * only a broken file could do — is shown at the top rather than vanishing.
 */
export interface ResearchFolder {
  category: ResearchCategory;
  depth: number;
  children: ResearchFolder[];
  /** Items filed directly here. */
  count: number;
  /** Items here and in every folder under this one. */
  total: number;
}

export const researchTree = (file: ProjectFile, includeArchived = false): ResearchFolder[] => {
  const categories = researchCategoriesInOrder(file, includeArchived);
  const known = new Set(categories.map((category) => category.id as string));
  const direct = new Map<string, number>();
  for (const item of file.researchItems) {
    if (item.archived) continue;
    direct.set(item.categoryId, (direct.get(item.categoryId) ?? 0) + 1);
  }

  /** The parent to draw under: null at the top, and null for a broken chain. */
  const parentOf = (category: ResearchCategory): string | null => {
    const parent = category.parentId;
    if (!parent || !known.has(parent)) return null;
    // Follow the chain up only to be sure it ends: a folder in a loop is
    // drawn at the top rather than disappearing from the tree.
    const seen = new Set<string>([category.id]);
    let cursor: string | null = parent;
    while (cursor) {
      if (seen.has(cursor)) return null;
      seen.add(cursor);
      const next = categories.find((candidate) => candidate.id === cursor);
      if (!next) return null;
      cursor = next.parentId && known.has(next.parentId) ? next.parentId : null;
    }
    return parent;
  };

  const build = (parent: string | null, depth: number): ResearchFolder[] =>
    categories
      .filter((category) => parentOf(category) === parent)
      .map((category) => {
        const children = build(category.id, depth + 1);
        const count = direct.get(category.id) ?? 0;
        return {
          category,
          depth,
          children,
          count,
          total: count + children.reduce((sum, child) => sum + child.total, 0),
        };
      });

  return build(null, 0);
};

/** Every folder id under this one, the folder itself included. */
export const researchSubtree = (file: ProjectFile, categoryId: ResearchCategoryId): ResearchCategoryId[] => {
  const found: ResearchCategoryId[] = [categoryId];
  const walk = (parent: ResearchCategoryId) => {
    for (const category of file.researchCategories) {
      if (category.parentId !== parent) continue;
      if (found.includes(category.id)) continue;
      found.push(category.id);
      walk(category.id);
    }
  };
  walk(categoryId);
  return found;
};

/** The smart folders: views over everything rather than places to file in. */
export type ResearchView = 'all' | 'used' | 'unused' | 'archived';

const matches = (item: ResearchItem, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return (
    item.title.toLowerCase().includes(needle) ||
    item.body.toLowerCase().includes(needle) ||
    item.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
};

/**
 * What the contents pane shows: a folder and everything under it, or one of
 * the smart folders, narrowed by the search box.
 */
export const researchItemsIn = (
  file: ProjectFile,
  where: { categoryId: ResearchCategoryId } | { view: ResearchView },
  options: { query?: string; includeDescendants?: boolean } = {},
): ResearchItem[] => {
  const query = options.query ?? '';
  // The graveyard is not a view (addendum 24): a buried note is out of every
  // one of these, including *archived*, because being put away and being
  // deleted are two different things a writer did.
  const live = onlyLiving(file.researchItems);
  if ('view' in where) {
    const items = live.filter((item) => {
      if (where.view === 'archived') return item.archived;
      if (item.archived) return false;
      if (where.view === 'used') return item.usage === 'used';
      if (where.view === 'unused') return item.usage === 'unused';
      return true;
    });
    return sortByOrderKey(items.filter((item) => matches(item, query)));
  }

  // Folder by folder, down the tree, and in order within each: what is
  // filed here comes before what is filed in the folders under it.
  const folders = options.includeDescendants === false ? [where.categoryId] : researchSubtree(file, where.categoryId);
  const place = new Map(folders.map((id, index) => [id as string, index]));
  const items = live.filter(
    (item) => !item.archived && place.has(item.categoryId) && matches(item, query),
  );
  return sortByOrderKey(items).sort(
    (a, b) => (place.get(a.categoryId) as number) - (place.get(b.categoryId) as number),
  );
};

/** Items in one category, newest ordering first honoured. */
export const researchItemsForCategory = (
  file: ProjectFile,
  categoryId: ResearchCategoryId,
  options: { usage?: 'used' | 'unused'; includeArchived?: boolean } = {},
): ResearchItem[] =>
  sortByOrderKey(
    onlyLiving(file.researchItems).filter(
      (item) =>
        item.categoryId === categoryId &&
        (options.includeArchived || !item.archived) &&
        (options.usage === undefined || item.usage === options.usage),
    ),
  );

/** Working inventory of material not yet incorporated into the story (§7.2). */
export const unusedResearch = (file: ProjectFile): ResearchItem[] =>
  sortByOrderKey(onlyLiving(file.researchItems).filter((item) => item.usage === 'unused' && !item.archived));

export const usedResearch = (file: ProjectFile): ResearchItem[] =>
  sortByOrderKey(onlyLiving(file.researchItems).filter((item) => item.usage === 'used' && !item.archived));

/**
 * Setups the writer has not yet paid off, and payoffs not yet established
 * (§7.3).
 *
 * `onlyLiving` because what the project *owes* is read from here — the home
 * page's figure and the reports' — and a deleted promise is not owed
 * (addendum 24 §5i). Not `workingSetups`: putting one away is a different
 * statement from deleting it, and an archived record that is still unresolved
 * has always counted here.
 */
export const unresolvedSetupsPayoffs = (file: ProjectFile): SetupPayoff[] =>
  onlyLiving(file.setupsPayoffs).filter(isUnresolved);

/** Every link touching `target`, in either direction. */
export const linksFor = (file: ProjectFile, target: StoryEntityRef): StoryLink[] =>
  file.links.filter((link) => refEquals(link.from, target) || refEquals(link.to, target));

/** The other end of each link touching `target` — powers the related-elements panel (§7.4). */
export const relatedRefs = (file: ProjectFile, target: StoryEntityRef): StoryEntityRef[] =>
  linksFor(file, target).map((link) => (refEquals(link.from, target) ? link.to : link.from));

export interface ProjectStats {
  trackCount: number;
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
    case 'track': {
      const track = file.tracks.find((candidate) => candidate.id === target.id);
      return track ? found(track.name, 'track') : missing();
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
    // A point in somebody's arc (addendum 08 §13). Resolved here rather than in
    // the module, so a cross-arc link appears in the Related Elements box for
    // free — which is what §3.1 meant by nothing new being built for it.
    case 'arc_point': {
      const point = file.arcPoints.find((candidate) => candidate.id === target.id);
      if (!point) return missing();
      const person = file.characters.find((candidate) => candidate.id === point.characterId);
      return found(point.text, person ? `${person.name}'s arc` : 'arc point');
    }
    // A moment of a narrative thread (addendum 15 §3). Resolved here for the
    // same reason: a dependency between two moments then reads in the Related
    // Elements box without that box being told threads exist.
    case 'thread_node': {
      const node = file.usageLinks.find((candidate) => candidate.id === target.id);
      if (!node || node.ownerKind !== 'thread') return missing();
      const thread = (file.threads ?? []).find((candidate) => candidate.id === node.ownerId);
      const beat = file.beats.find((candidate) => candidate.id === node.beatId);
      return found(
        node.note || node.quote || beat?.title || 'A moment',
        thread ? `${thread.name || 'Untitled thread'} · thread` : 'thread',
      );
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
  trackCount: file.tracks.length,
  unitCount: file.units.length,
  beatCount: file.beats.length,
  writtenBeatCount: file.beats.filter((beat) => beat.status === 'written' || beat.status === 'revised').length,
  wordCount: file.beats.reduce((total, beat) => total + countWords(beat.manuscript), 0),
  unusedResearchCount: unusedResearch(file).length,
  unresolvedSetupCount: unresolvedSetupsPayoffs(file).length,
  pendingCaptureCount: 0,
});
