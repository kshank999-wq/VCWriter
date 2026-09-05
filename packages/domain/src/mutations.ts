import { newId } from './ids.js';
import { orderKeyForIndex } from './ordering.js';
import { nowIso } from './entities/common.js';
import { beatSchema, laneSchema, structuralUnitSchema } from './entities/structure.js';
import { researchCategorySchema, researchItemSchema } from './entities/research.js';
import { setupPayoffSchema, setupPointSchema } from './entities/setups.js';
import { characterSchema } from './entities/character.js';
import {
  storyLinkSchema,
  refEquals,
  type StoryEntityRef,
  type StoryLink,
  type StoryLinkType,
} from './entities/links.js';
import { beatsForUnit, lanesInOrder, researchCategoriesInOrder, unitsForLane } from './selectors.js';
import type { ManuscriptSegment } from './entities/manuscript.js';
import type { VoiceAssignment } from './entities/project.js';
import type { ResearchCategory, ResearchItem } from './entities/research.js';
import type { SetupPayoff, SetupPoint } from './entities/setups.js';
import type { Beat, Lane, LaneKind, StructuralUnit, StructuralUnitKind } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type {
  BeatId,
  CharacterId,
  LaneId,
  ResearchCategoryId,
  ResearchItemId,
  SetupPayoffId,
  SetupPointId,
  StoryLinkId,
  StructuralUnitId,
} from './ids.js';

/**
 * Pure structural edits.
 *
 * Every function returns a new `ProjectFile`; nothing mutates its input. That
 * keeps undo/redo, autosave snapshots and optimistic sync (spec §14) simple to
 * build on top, and makes each rule directly testable.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

const touch = <T extends { updatedAt: string }>(record: T): T => ({ ...record, updatedAt: nowIso() });

const touchProject = (file: ProjectFile): ProjectFile => ({
  ...file,
  project: touch(file.project),
});

export const addLane = (
  file: ProjectFile,
  input: { name: string; kind?: LaneKind; color?: string; index?: number },
): { file: ProjectFile; lane: Lane } => {
  const timestamp = nowIso();
  const lane = laneSchema.parse({
    id: newId<LaneId>(),
    projectId: file.project.id,
    name: input.name,
    kind: input.kind ?? 'custom',
    ...(input.color ? { color: input.color } : {}),
    orderKey: orderKeyForIndex(lanesInOrder(file), input.index ?? file.lanes.length),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { file: touchProject({ ...file, lanes: [...file.lanes, lane] }), lane };
};

export const addUnit = (
  file: ProjectFile,
  input: { laneId: LaneId; kind?: StructuralUnitKind; title?: string; sequenceLabel?: string; index?: number },
): { file: ProjectFile; unit: StructuralUnit } => {
  if (!file.lanes.some((lane) => lane.id === input.laneId)) {
    throw new DomainError(`Lane ${input.laneId} does not exist in this project`);
  }
  const timestamp = nowIso();
  const siblings = unitsForLane(file, input.laneId);
  const unit = structuralUnitSchema.parse({
    id: newId<StructuralUnitId>(),
    projectId: file.project.id,
    laneId: input.laneId,
    kind: input.kind ?? (file.project.format === 'novel' || file.project.format === 'short_story' ? 'chapter' : 'scene'),
    title: input.title ?? '',
    sequenceLabel: input.sequenceLabel ?? '',
    orderKey: orderKeyForIndex(siblings, input.index ?? siblings.length),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { file: touchProject({ ...file, units: [...file.units, unit] }), unit };
};

/**
 * Beats are created inside a scene/chapter container. There is deliberately no
 * way to create a beat that belongs only to a lane (spec §19).
 */
export const addBeat = (
  file: ProjectFile,
  input: { unitId: StructuralUnitId; title?: string; summary?: string; index?: number },
): { file: ProjectFile; beat: Beat } => {
  if (!file.units.some((unit) => unit.id === input.unitId)) {
    throw new DomainError(`Scene/chapter ${input.unitId} does not exist; a beat cannot float in a lane`);
  }
  const timestamp = nowIso();
  const siblings = beatsForUnit(file, input.unitId);
  const beat = beatSchema.parse({
    id: newId<BeatId>(),
    projectId: file.project.id,
    unitId: input.unitId,
    title: input.title ?? '',
    summary: input.summary ?? '',
    orderKey: orderKeyForIndex(siblings, input.index ?? siblings.length),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { file: touchProject({ ...file, beats: [...file.beats, beat] }), beat };
};

/**
 * Move a beat within or between scene/chapter containers. Links, manuscript and
 * structural metadata travel with the beat (§5.3) because only its `unitId` and
 * `orderKey` change — links reference the beat by id.
 */
export const moveBeat = (
  file: ProjectFile,
  input: { beatId: BeatId; toUnitId: StructuralUnitId; index: number },
): ProjectFile => {
  const beat = file.beats.find((candidate) => candidate.id === input.beatId);
  if (!beat) throw new DomainError(`Beat ${input.beatId} does not exist`);
  if (!file.units.some((unit) => unit.id === input.toUnitId)) {
    throw new DomainError(`Scene/chapter ${input.toUnitId} does not exist`);
  }
  const siblings = beatsForUnit(file, input.toUnitId).filter((candidate) => candidate.id !== beat.id);
  const moved = touch({ ...beat, unitId: input.toUnitId, orderKey: orderKeyForIndex(siblings, input.index) });
  return touchProject({
    ...file,
    beats: file.beats.map((candidate) => (candidate.id === beat.id ? moved : candidate)),
  });
};

export const moveUnit = (
  file: ProjectFile,
  input: { unitId: StructuralUnitId; toLaneId: LaneId; index: number },
): ProjectFile => {
  const unit = file.units.find((candidate) => candidate.id === input.unitId);
  if (!unit) throw new DomainError(`Scene/chapter ${input.unitId} does not exist`);
  if (!file.lanes.some((lane) => lane.id === input.toLaneId)) {
    throw new DomainError(`Lane ${input.toLaneId} does not exist`);
  }
  const siblings = unitsForLane(file, input.toLaneId).filter((candidate) => candidate.id !== unit.id);
  const moved = touch({ ...unit, laneId: input.toLaneId, orderKey: orderKeyForIndex(siblings, input.index) });
  return touchProject({
    ...file,
    units: file.units.map((candidate) => (candidate.id === unit.id ? moved : candidate)),
  });
};

export const updateBeat = (
  file: ProjectFile,
  beatId: BeatId,
  patch: Partial<Pick<Beat, 'title' | 'summary' | 'status'>> & { manuscript?: ManuscriptSegment },
): ProjectFile => {
  if (!file.beats.some((beat) => beat.id === beatId)) throw new DomainError(`Beat ${beatId} does not exist`);
  return touchProject({
    ...file,
    beats: file.beats.map((beat) => (beat.id === beatId ? touch({ ...beat, ...patch }) : beat)),
  });
};

export const addResearchItem = (
  file: ProjectFile,
  input: { categoryId: ResearchCategoryId; title: string; body?: string; tags?: string[]; origin?: 'desktop' | 'mobile_capture' | 'import' },
): ProjectFile => {
  if (!file.researchCategories.some((category) => category.id === input.categoryId)) {
    throw new DomainError(`Research category ${input.categoryId} does not exist`);
  }
  const timestamp = nowIso();
  const siblings = file.researchItems.filter((item) => item.categoryId === input.categoryId);
  const item = researchItemSchema.parse({
    id: newId<ResearchItemId>(),
    projectId: file.project.id,
    categoryId: input.categoryId,
    title: input.title,
    body: input.body ?? '',
    tags: input.tags ?? [],
    origin: input.origin ?? 'desktop',
    orderKey: orderKeyForIndex(siblings, siblings.length),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return touchProject({ ...file, researchItems: [...file.researchItems, item] });
};

/**
 * Mark research as incorporated (§7.2). `confirmed: false` records a *suggestion*
 * from automatic detection; only a confirmed transition should be treated as the
 * writer's decision.
 */
export const markResearchUsed = (
  file: ProjectFile,
  input: { itemId: ResearchItemId; beatId?: BeatId; confirmed?: boolean },
): ProjectFile => {
  const item = file.researchItems.find((candidate) => candidate.id === input.itemId);
  if (!item) throw new DomainError(`Research item ${input.itemId} does not exist`);
  const usedInBeatIds = input.beatId && !item.usedInBeatIds.includes(input.beatId)
    ? [...item.usedInBeatIds, input.beatId]
    : item.usedInBeatIds;
  const updated = touch({
    ...item,
    usage: 'used' as const,
    usedAt: nowIso(),
    usedInBeatIds,
    usedConfirmed: input.confirmed ?? true,
  });
  return touchProject({
    ...file,
    researchItems: file.researchItems.map((candidate) => (candidate.id === item.id ? updated : candidate)),
  });
};

/** Reverse of `markResearchUsed` — used material returns to the active list (§7.2). */
export const restoreResearchItem = (file: ProjectFile, itemId: ResearchItemId): ProjectFile => {
  const item = file.researchItems.find((candidate) => candidate.id === itemId);
  if (!item) throw new DomainError(`Research item ${itemId} does not exist`);
  const updated = touch({
    ...item,
    usage: 'unused' as const,
    usedAt: null,
    usedConfirmed: false,
    archived: false,
  });
  return touchProject({
    ...file,
    researchItems: file.researchItems.map((candidate) => (candidate.id === itemId ? updated : candidate)),
  });
};

export const setResearchArchived = (file: ProjectFile, itemId: ResearchItemId, archived: boolean): ProjectFile => {
  if (!file.researchItems.some((item) => item.id === itemId)) {
    throw new DomainError(`Research item ${itemId} does not exist`);
  }
  return touchProject({
    ...file,
    researchItems: file.researchItems.map((item) => (item.id === itemId ? touch({ ...item, archived }) : item)),
  });
};

/** Create a typed relationship between two entities (§7.4). Duplicates are ignored. */
export const linkEntities = (
  file: ProjectFile,
  input: { from: StoryEntityRef; to: StoryEntityRef; type?: StoryLinkType; label?: string; notes?: string },
): ProjectFile => {
  const exists = file.links.some(
    (link) =>
      link.type === (input.type ?? 'relates_to') &&
      refEquals(link.from, input.from) &&
      refEquals(link.to, input.to),
  );
  if (exists) return file;
  const timestamp = nowIso();
  const link = storyLinkSchema.parse({
    id: newId<StoryLinkId>(),
    projectId: file.project.id,
    from: input.from,
    to: input.to,
    type: input.type ?? 'relates_to',
    label: input.label ?? '',
    notes: input.notes ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return touchProject({ ...file, links: [...file.links, link] });
};

export const unlink = (file: ProjectFile, linkId: StoryLinkId): ProjectFile =>
  touchProject({ ...file, links: file.links.filter((link) => link.id !== linkId) });

export const addSetupPayoff = (
  file: ProjectFile,
  input: { title: string; description?: string },
): ProjectFile => {
  const timestamp = nowIso();
  const record = setupPayoffSchema.parse({
    id: newId<SetupPayoffId>(),
    projectId: file.project.id,
    title: input.title,
    description: input.description ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return touchProject({ ...file, setupsPayoffs: [...file.setupsPayoffs, record] });
};

/** A payoff may have any number of setup points; all of them are tracked (§7.3). */
export const addSetupPoint = (
  file: ProjectFile,
  input: {
    setupPayoffId: SetupPayoffId;
    description: string;
    location?: StoryEntityRef | null;
    strength?: 'planned' | 'written' | 'weak';
  },
): ProjectFile => {
  const record = file.setupsPayoffs.find((candidate) => candidate.id === input.setupPayoffId);
  if (!record) throw new DomainError(`Setup/payoff ${input.setupPayoffId} does not exist`);
  const point = setupPointSchema.parse({
    id: newId<SetupPointId>(),
    description: input.description,
    location: input.location ?? null,
    strength: input.strength ?? 'planned',
    createdAt: nowIso(),
  });
  const updated = touch({
    ...record,
    setups: [...record.setups, point],
    status: record.status === 'open' && point.strength === 'written' ? ('established' as const) : record.status,
  });
  return touchProject({
    ...file,
    setupsPayoffs: file.setupsPayoffs.map((candidate) => (candidate.id === record.id ? updated : candidate)),
  });
};

export const recordPayoff = (
  file: ProjectFile,
  input: { setupPayoffId: SetupPayoffId; description: string; location?: StoryEntityRef | null },
): ProjectFile => {
  const record = file.setupsPayoffs.find((candidate) => candidate.id === input.setupPayoffId);
  if (!record) throw new DomainError(`Setup/payoff ${input.setupPayoffId} does not exist`);
  const updated = touch({
    ...record,
    payoff: { description: input.description, location: input.location ?? null, writtenAt: nowIso() },
    status: 'resolved' as const,
  });
  return touchProject({
    ...file,
    setupsPayoffs: file.setupsPayoffs.map((candidate) => (candidate.id === record.id ? updated : candidate)),
  });
};

/** Archiving keeps history and links; it is reversible (§7.3, §19). */
export const setSetupPayoffArchived = (
  file: ProjectFile,
  setupPayoffId: SetupPayoffId,
  archived: boolean,
): ProjectFile => {
  if (!file.setupsPayoffs.some((record) => record.id === setupPayoffId)) {
    throw new DomainError(`Setup/payoff ${setupPayoffId} does not exist`);
  }
  return touchProject({
    ...file,
    setupsPayoffs: file.setupsPayoffs.map((record) =>
      record.id === setupPayoffId ? touch({ ...record, archived }) : record,
    ),
  });
};

export const addCharacter = (
  file: ProjectFile,
  input: { name: string; description?: string; voice?: VoiceAssignment | null },
): ProjectFile => {
  const timestamp = nowIso();
  const character = characterSchema.parse({
    id: newId<CharacterId>(),
    projectId: file.project.id,
    name: input.name,
    description: input.description ?? '',
    voice: input.voice ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return touchProject({ ...file, characters: [...file.characters, character] });
};

/** Voice assignment persists per project/character and stays editable (§10). */
export const assignCharacterVoice = (
  file: ProjectFile,
  characterId: CharacterId,
  voice: VoiceAssignment | null,
): ProjectFile => {
  if (!file.characters.some((character) => character.id === characterId)) {
    throw new DomainError(`Character ${characterId} does not exist`);
  }
  return touchProject({
    ...file,
    characters: file.characters.map((character) =>
      character.id === characterId ? touch({ ...character, voice }) : character,
    ),
  });
};

// ---------------------------------------------------------------------------
// Editing and removing structure
// ---------------------------------------------------------------------------

/**
 * Drop every link that points at an entity that no longer exists.
 *
 * Links are typed records between ids (§7.4), so removing a scene has to take
 * its links with it — a dangling reference would show up in the
 * related-elements panel as an entry nothing can resolve.
 */
const withoutLinksTouching = (file: ProjectFile, removedIds: ReadonlySet<string>): StoryLink[] =>
  file.links.filter((link) => !removedIds.has(link.from.id) && !removedIds.has(link.to.id));

export const updateLane = (
  file: ProjectFile,
  laneId: LaneId,
  patch: Partial<Pick<Lane, 'name' | 'kind' | 'color' | 'description' | 'collapsed'>>,
): ProjectFile => {
  if (!file.lanes.some((lane) => lane.id === laneId)) throw new DomainError(`Lane ${laneId} does not exist`);
  return touchProject({
    ...file,
    lanes: file.lanes.map((lane) => (lane.id === laneId ? touch({ ...lane, ...patch }) : lane)),
  });
};

export const moveLane = (file: ProjectFile, laneId: LaneId, index: number): ProjectFile => {
  const lane = file.lanes.find((candidate) => candidate.id === laneId);
  if (!lane) throw new DomainError(`Lane ${laneId} does not exist`);
  const siblings = lanesInOrder(file).filter((candidate) => candidate.id !== laneId);
  const moved = touch({ ...lane, orderKey: orderKeyForIndex(siblings, index) });
  return touchProject({
    ...file,
    lanes: file.lanes.map((candidate) => (candidate.id === laneId ? moved : candidate)),
  });
};

/**
 * Remove a lane and everything inside it. The last lane cannot be removed:
 * scenes and chapters have nowhere to live without one.
 */
export const removeLane = (file: ProjectFile, laneId: LaneId): ProjectFile => {
  if (!file.lanes.some((lane) => lane.id === laneId)) throw new DomainError(`Lane ${laneId} does not exist`);
  if (file.lanes.length === 1) throw new DomainError('A project needs at least one plot lane');

  const removedUnitIds = new Set(file.units.filter((unit) => unit.laneId === laneId).map((unit) => unit.id as string));
  const removedBeatIds = new Set(
    file.beats.filter((beat) => removedUnitIds.has(beat.unitId)).map((beat) => beat.id as string),
  );
  const removed = new Set<string>([laneId, ...removedUnitIds, ...removedBeatIds]);

  return touchProject({
    ...file,
    lanes: file.lanes.filter((lane) => lane.id !== laneId),
    units: file.units.filter((unit) => !removedUnitIds.has(unit.id)),
    beats: file.beats.filter((beat) => !removedBeatIds.has(beat.id)),
    links: withoutLinksTouching(file, removed),
  });
};

export const updateUnit = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  patch: Partial<Pick<StructuralUnit, 'title' | 'sequenceLabel' | 'summary' | 'notes' | 'status' | 'collapsed'>>,
): ProjectFile => {
  if (!file.units.some((unit) => unit.id === unitId)) {
    throw new DomainError(`Scene/chapter ${unitId} does not exist`);
  }
  return touchProject({
    ...file,
    units: file.units.map((unit) => (unit.id === unitId ? touch({ ...unit, ...patch }) : unit)),
  });
};

/** Remove a scene/chapter and the beats inside it. */
export const removeUnit = (file: ProjectFile, unitId: StructuralUnitId): ProjectFile => {
  if (!file.units.some((unit) => unit.id === unitId)) {
    throw new DomainError(`Scene/chapter ${unitId} does not exist`);
  }
  const removedBeatIds = new Set(
    file.beats.filter((beat) => beat.unitId === unitId).map((beat) => beat.id as string),
  );
  const removed = new Set<string>([unitId, ...removedBeatIds]);

  return touchProject({
    ...file,
    units: file.units.filter((unit) => unit.id !== unitId),
    beats: file.beats.filter((beat) => !removedBeatIds.has(beat.id)),
    links: withoutLinksTouching(file, removed),
  });
};

export const removeBeat = (file: ProjectFile, beatId: BeatId): ProjectFile => {
  if (!file.beats.some((beat) => beat.id === beatId)) throw new DomainError(`Beat ${beatId} does not exist`);
  return touchProject({
    ...file,
    beats: file.beats.filter((beat) => beat.id !== beatId),
    links: withoutLinksTouching(file, new Set<string>([beatId])),
    // Research that was marked used in this beat keeps its used state; only the
    // now-meaningless back-reference goes.
    researchItems: file.researchItems.map((item) =>
      item.usedInBeatIds.includes(beatId)
        ? touch({ ...item, usedInBeatIds: item.usedInBeatIds.filter((candidate) => candidate !== beatId) })
        : item,
    ),
  });
};

// ---------------------------------------------------------------------------
// Research categories (§7.1: create, rename, reorder, archive)
// ---------------------------------------------------------------------------

export const addResearchCategory = (
  file: ProjectFile,
  input: { name: string; description?: string; index?: number },
): { file: ProjectFile; category: ResearchCategory } => {
  const timestamp = nowIso();
  const siblings = researchCategoriesInOrder(file);
  const category = researchCategorySchema.parse({
    id: newId<ResearchCategoryId>(),
    projectId: file.project.id,
    name: input.name,
    description: input.description ?? '',
    orderKey: orderKeyForIndex(siblings, input.index ?? siblings.length),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return {
    file: touchProject({ ...file, researchCategories: [...file.researchCategories, category] }),
    category,
  };
};

export const updateResearchCategory = (
  file: ProjectFile,
  categoryId: ResearchCategoryId,
  patch: Partial<Pick<ResearchCategory, 'name' | 'description'>>,
): ProjectFile => {
  if (!file.researchCategories.some((category) => category.id === categoryId)) {
    throw new DomainError(`Research category ${categoryId} does not exist`);
  }
  return touchProject({
    ...file,
    researchCategories: file.researchCategories.map((category) =>
      category.id === categoryId ? touch({ ...category, ...patch }) : category,
    ),
  });
};

export const moveResearchCategory = (
  file: ProjectFile,
  categoryId: ResearchCategoryId,
  index: number,
): ProjectFile => {
  const category = file.researchCategories.find((candidate) => candidate.id === categoryId);
  if (!category) throw new DomainError(`Research category ${categoryId} does not exist`);
  const siblings = researchCategoriesInOrder(file).filter((candidate) => candidate.id !== categoryId);
  const moved = touch({ ...category, orderKey: orderKeyForIndex(siblings, index) });
  return touchProject({
    ...file,
    researchCategories: file.researchCategories.map((candidate) =>
      candidate.id === categoryId ? moved : candidate,
    ),
  });
};

/** Archiving a category hides it and its items from the working view, reversibly. */
export const setResearchCategoryArchived = (
  file: ProjectFile,
  categoryId: ResearchCategoryId,
  archived: boolean,
): ProjectFile => {
  if (!file.researchCategories.some((category) => category.id === categoryId)) {
    throw new DomainError(`Research category ${categoryId} does not exist`);
  }
  return touchProject({
    ...file,
    researchCategories: file.researchCategories.map((category) =>
      category.id === categoryId ? touch({ ...category, archived }) : category,
    ),
  });
};

export const updateResearchItem = (
  file: ProjectFile,
  itemId: ResearchItemId,
  patch: Partial<Pick<ResearchItem, 'title' | 'body' | 'tags'>>,
): ProjectFile => {
  if (!file.researchItems.some((item) => item.id === itemId)) {
    throw new DomainError(`Research item ${itemId} does not exist`);
  }
  return touchProject({
    ...file,
    researchItems: file.researchItems.map((item) => (item.id === itemId ? touch({ ...item, ...patch }) : item)),
  });
};

export const moveResearchItem = (
  file: ProjectFile,
  input: { itemId: ResearchItemId; toCategoryId: ResearchCategoryId; index: number },
): ProjectFile => {
  const item = file.researchItems.find((candidate) => candidate.id === input.itemId);
  if (!item) throw new DomainError(`Research item ${input.itemId} does not exist`);
  if (!file.researchCategories.some((category) => category.id === input.toCategoryId)) {
    throw new DomainError(`Research category ${input.toCategoryId} does not exist`);
  }
  const siblings = file.researchItems
    .filter((candidate) => candidate.categoryId === input.toCategoryId && candidate.id !== item.id)
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
  const moved = touch({
    ...item,
    categoryId: input.toCategoryId,
    orderKey: orderKeyForIndex(siblings, input.index),
  });
  return touchProject({
    ...file,
    researchItems: file.researchItems.map((candidate) => (candidate.id === item.id ? moved : candidate)),
  });
};

// ---------------------------------------------------------------------------
// Setups and payoffs (§7.3)
// ---------------------------------------------------------------------------

export const updateSetupPayoff = (
  file: ProjectFile,
  setupPayoffId: SetupPayoffId,
  patch: Partial<Pick<SetupPayoff, 'title' | 'description' | 'status'>>,
): ProjectFile => {
  if (!file.setupsPayoffs.some((record) => record.id === setupPayoffId)) {
    throw new DomainError(`Setup/payoff ${setupPayoffId} does not exist`);
  }
  return touchProject({
    ...file,
    setupsPayoffs: file.setupsPayoffs.map((record) =>
      record.id === setupPayoffId ? touch({ ...record, ...patch }) : record,
    ),
  });
};

export const updateSetupPoint = (
  file: ProjectFile,
  input: {
    setupPayoffId: SetupPayoffId;
    setupPointId: SetupPointId;
    patch: Partial<Pick<SetupPoint, 'description' | 'strength' | 'location'>>;
  },
): ProjectFile => {
  const record = file.setupsPayoffs.find((candidate) => candidate.id === input.setupPayoffId);
  if (!record) throw new DomainError(`Setup/payoff ${input.setupPayoffId} does not exist`);
  if (!record.setups.some((point) => point.id === input.setupPointId)) {
    throw new DomainError(`Setup point ${input.setupPointId} does not exist`);
  }
  const updated = touch({
    ...record,
    setups: record.setups.map((point) =>
      point.id === input.setupPointId ? { ...point, ...input.patch } : point,
    ),
  });
  return touchProject({
    ...file,
    setupsPayoffs: file.setupsPayoffs.map((candidate) => (candidate.id === record.id ? updated : candidate)),
  });
};

export const removeSetupPoint = (
  file: ProjectFile,
  input: { setupPayoffId: SetupPayoffId; setupPointId: SetupPointId },
): ProjectFile => {
  const record = file.setupsPayoffs.find((candidate) => candidate.id === input.setupPayoffId);
  if (!record) throw new DomainError(`Setup/payoff ${input.setupPayoffId} does not exist`);
  const updated = touch({
    ...record,
    setups: record.setups.filter((point) => point.id !== input.setupPointId),
  });
  return touchProject({
    ...file,
    setupsPayoffs: file.setupsPayoffs.map((candidate) => (candidate.id === record.id ? updated : candidate)),
  });
};

/**
 * Reverse of `recordPayoff`: the obligation returns to the active list with its
 * setup points intact, because deciding a payoff is not written yet is an
 * ordinary revision, not a mistake to be punished with lost history.
 */
export const reopenPayoff = (file: ProjectFile, setupPayoffId: SetupPayoffId): ProjectFile => {
  const record = file.setupsPayoffs.find((candidate) => candidate.id === setupPayoffId);
  if (!record) throw new DomainError(`Setup/payoff ${setupPayoffId} does not exist`);
  const updated = touch({
    ...record,
    payoff: null,
    status: record.setups.some((point) => point.strength === 'written')
      ? ('established' as const)
      : ('open' as const),
  });
  return touchProject({
    ...file,
    setupsPayoffs: file.setupsPayoffs.map((candidate) => (candidate.id === record.id ? updated : candidate)),
  });
};
