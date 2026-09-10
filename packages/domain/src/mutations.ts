import { newId } from './ids.js';
import { orderKeyForIndex } from './ordering.js';
import { nowIso } from './entities/common.js';
import {
  LANE_COLOURS,
  beatSchema,
  chapterPageSchema,
  laneSchema,
  sceneGridSchema,
  sceneReadSchema,
  storyMarkerSchema,
  structuralUnitSchema,
} from './entities/structure.js';
import { researchCategorySchema, researchItemSchema } from './entities/research.js';
import { setupPayoffSchema, setupPointSchema } from './entities/setups.js';
import { characterCategorySchema, characterSchema } from './entities/character.js';
import { knowsCharacter, spokenNames } from './characters.js';
import { episodeNumberClash } from './episodes.js';
import { countWords } from './entities/manuscript.js';
import { characterCategoriesInOrder } from './characters.js';
import {
  storyLinkSchema,
  refEquals,
  type StoryEntityRef,
  type StoryLink,
  type StoryLinkType,
} from './entities/links.js';
import {
  beatsForUnit,
  lanesInOrder,
  researchCategoriesInOrder,
  researchSubtree,
  unitsInStoryOrder,
} from './selectors.js';
import type { ManuscriptSegment } from './entities/manuscript.js';
import { titlePageSchema } from './entities/title-page.js';
import type { TitlePage } from './entities/title-page.js';
import type { ParagraphStyle, ScriptFormat, VoiceAssignment } from './entities/project.js';
import type { Character, CharacterCategory } from './entities/character.js';
import type { SceneGrid, SceneRead } from './entities/structure.js';
import type { ResearchCategory, ResearchItem } from './entities/research.js';
import type { SetupPayoff, SetupPoint } from './entities/setups.js';
import type {
  Beat,
  Lane,
  LaneKind,
  ChapterPage,
  StoryMarker,
  StoryMarkerKind,
  StructuralUnit,
  StructuralUnitKind,
} from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type {
  BeatId,
  BeatRevisionId,
  CharacterCategoryId,
  CharacterId,
  LaneId,
  ManuscriptElementId,
  ResearchCategoryId,
  ResearchItemId,
  SetupPayoffId,
  SetupPointId,
  StoryLinkId,
  StoryMarkerId,
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
  // The next colour in the sequence the project has not used yet, so three
  // lanes added in a row come out gold, red, blue rather than all one grey.
  const used = new Set(file.lanes.map((lane) => lane.color));
  const nextColour = LANE_COLOURS.find((colour) => !used.has(colour)) ?? LANE_COLOURS[file.lanes.length % LANE_COLOURS.length];
  const lane = laneSchema.parse({
    id: newId<LaneId>(),
    projectId: file.project.id,
    name: input.name,
    kind: input.kind ?? 'custom',
    color: input.color ?? nextColour,
    orderKey: orderKeyForIndex(lanesInOrder(file), input.index ?? file.lanes.length),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { file: touchProject({ ...file, lanes: [...file.lanes, lane] }), lane };
};

/**
 * Add a scene/chapter to a lane at a position in the story.
 *
 * `index` is a position among *every* scene in the project, not among the
 * lane's own (addendum 02 §8): a subplot scene added "after scene 3" lands
 * after scene 3 whatever lane scene 3 is in. Omitted, the scene goes at the
 * end of the story.
 */
export const addUnit = (
  file: ProjectFile,
  input: { laneId: LaneId; kind?: StructuralUnitKind; title?: string; sequenceLabel?: string; index?: number },
): { file: ProjectFile; unit: StructuralUnit } => {
  if (!file.lanes.some((lane) => lane.id === input.laneId)) {
    throw new DomainError(`Lane ${input.laneId} does not exist in this project`);
  }
  const timestamp = nowIso();
  const siblings = unitsInStoryOrder(file);
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

/**
 * Move a scene/chapter to a lane and a position in the story.
 *
 * `index` counts every scene in the project except the one moving, in story
 * order (addendum 02 §8). Pass `keepPosition: true` to change only the lane:
 * the scene stays where it is in the story and simply draws in another row.
 */
export const moveUnit = (
  file: ProjectFile,
  input: { unitId: StructuralUnitId; toLaneId: LaneId; index?: number; keepPosition?: boolean },
): ProjectFile => {
  const unit = file.units.find((candidate) => candidate.id === input.unitId);
  if (!unit) throw new DomainError(`Scene/chapter ${input.unitId} does not exist`);
  if (!file.lanes.some((lane) => lane.id === input.toLaneId)) {
    throw new DomainError(`Lane ${input.toLaneId} does not exist`);
  }
  if (input.keepPosition || input.index === undefined) {
    if (unit.laneId === input.toLaneId) return file;
    const relaned = touch({ ...unit, laneId: input.toLaneId });
    return touchProject({
      ...file,
      units: file.units.map((candidate) => (candidate.id === unit.id ? relaned : candidate)),
    });
  }
  const siblings = unitsInStoryOrder(file).filter((candidate) => candidate.id !== unit.id);
  const moved = touch({ ...unit, laneId: input.toLaneId, orderKey: orderKeyForIndex(siblings, input.index) });
  return touchProject({
    ...file,
    units: file.units.map((candidate) => (candidate.id === unit.id ? moved : candidate)),
  });
};

// ---------------------------------------------------------------------------
// Story markers: acts in a script, chapters in a book (addendum 02 §9, §11)
// ---------------------------------------------------------------------------

/** A scene starts at most one marker; adding another replaces its label. */
export const addMarker = (
  file: ProjectFile,
  input: { unitId: StructuralUnitId; title: string; kind?: StoryMarkerKind },
): { file: ProjectFile; marker: StoryMarker } => {
  if (!file.units.some((unit) => unit.id === input.unitId)) {
    throw new DomainError(`Scene/chapter ${input.unitId} does not exist`);
  }
  const existing = file.markers.find((marker) => marker.unitId === input.unitId);
  if (existing) {
    const updated = touch({ ...existing, title: input.title, kind: input.kind ?? existing.kind });
    return {
      file: touchProject({
        ...file,
        markers: file.markers.map((marker) => (marker.id === existing.id ? updated : marker)),
      }),
      marker: updated,
    };
  }
  const timestamp = nowIso();
  const marker = storyMarkerSchema.parse({
    id: newId<StoryMarkerId>(),
    projectId: file.project.id,
    unitId: input.unitId,
    kind: input.kind ?? 'act',
    title: input.title,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { file: touchProject({ ...file, markers: [...file.markers, marker] }), marker };
};

export const updateMarker = (
  file: ProjectFile,
  markerId: StoryMarkerId,
  patch: Partial<Pick<StoryMarker, 'title' | 'kind' | 'unitId' | 'notes'>>,
): ProjectFile => {
  if (!file.markers.some((marker) => marker.id === markerId)) {
    throw new DomainError(`Marker ${markerId} does not exist`);
  }
  if (patch.unitId !== undefined && !file.units.some((unit) => unit.id === patch.unitId)) {
    throw new DomainError(`Scene/chapter ${patch.unitId} does not exist`);
  }
  return touchProject({
    ...file,
    markers: file.markers.map((marker) => (marker.id === markerId ? touch({ ...marker, ...patch }) : marker)),
  });
};

export const removeMarker = (file: ProjectFile, markerId: StoryMarkerId): ProjectFile =>
  touchProject({ ...file, markers: file.markers.filter((marker) => marker.id !== markerId) });

/**
 * The page a chapter opens with (addendum 02 §11). Patched rather than
 * replaced, so turning the page on does not wipe what was designed on it
 * last time and turning it off keeps the design for when it comes back —
 * `include` is a switch, never a delete.
 */
export const setChapterPage = (
  file: ProjectFile,
  markerId: StoryMarkerId,
  patch: Partial<ChapterPage>,
): ProjectFile => {
  const existing = file.markers.find((marker) => marker.id === markerId);
  if (!existing) throw new DomainError(`Marker ${markerId} does not exist`);
  const page = chapterPageSchema.parse({ ...existing.page, ...patch });
  return touchProject({
    ...file,
    markers: file.markers.map((marker) => (marker.id === markerId ? touch({ ...marker, page }) : marker)),
  });
};

/**
 * When scenes go, a marker anchored to one of them moves to the next
 * surviving scene in story order, or to the last surviving scene when there
 * is no next; with no scenes left it goes too. A scene that already starts a
 * marker keeps its own, and the displaced marker is dropped rather than
 * stacked — two acts cannot start at one scene.
 */
const reanchorMarkers = (file: ProjectFile, removedUnitIds: ReadonlySet<string>): StoryMarker[] => {
  const before = unitsInStoryOrder(file);
  const surviving = before.filter((unit) => !removedUnitIds.has(unit.id));
  if (surviving.length === 0) return [];
  const kept: StoryMarker[] = [];
  const taken = new Set(file.markers.filter((marker) => !removedUnitIds.has(marker.unitId)).map((m) => m.unitId as string));

  for (const marker of file.markers) {
    if (!removedUnitIds.has(marker.unitId)) {
      kept.push(marker);
      continue;
    }
    const position = before.findIndex((unit) => unit.id === marker.unitId);
    const next = before.slice(position + 1).find((unit) => !removedUnitIds.has(unit.id));
    const target = next ?? surviving[surviving.length - 1];
    if (!target || taken.has(target.id)) continue;
    taken.add(target.id);
    kept.push(touch({ ...marker, unitId: target.id }));
  }
  return kept;
};

export const updateBeat = (
  file: ProjectFile,
  beatId: BeatId,
  patch: Partial<
    Pick<
      Beat,
      | 'title'
      | 'summary'
      | 'status'
      | 'color'
      | 'revisionName'
      | 'inScript'
      // A row of an AV sheet: what is seen, and how long it runs (addendum 05).
      | 'visual'
      | 'seconds'
    >
  > & { manuscript?: ManuscriptSegment },
): ProjectFile => {
  if (!file.beats.some((beat) => beat.id === beatId)) throw new DomainError(`Beat ${beatId} does not exist`);
  return touchProject({
    ...file,
    beats: file.beats.map((beat) => (beat.id === beatId ? touch({ ...beat, ...patch }) : beat)),
  });
};

/**
 * Print a speech beside the one before it, or stop doing so (addendum 02
 * §7.1). The mark goes on the character cue; a cue with nothing to sit
 * beside simply prints as an ordinary speech until there is.
 */
export const setDualDialogue = (
  file: ProjectFile,
  beatId: BeatId,
  elementId: ManuscriptElementId,
  dual: boolean,
): ProjectFile => {
  const beat = file.beats.find((candidate) => candidate.id === beatId);
  if (!beat) throw new DomainError(`Beat ${beatId} does not exist`);
  const element = beat.manuscript.elements.find((candidate) => candidate.id === elementId);
  if (!element) throw new DomainError(`Element ${elementId} is not in beat ${beatId}`);
  if (element.type !== 'character') throw new DomainError('Only a character cue can be marked dual');

  const elements = beat.manuscript.elements.map((candidate) => {
    if (candidate.id !== elementId) return candidate;
    const attributes = { ...candidate.attributes };
    if (dual) attributes['dual'] = true;
    else delete attributes['dual'];
    return { ...candidate, attributes };
  });
  return updateBeat(file, beatId, { manuscript: { elements } });
};

// ---------------------------------------------------------------------------
// Beat revisions (addendum 02 §4)
// ---------------------------------------------------------------------------

const withBeat = (file: ProjectFile, beatId: BeatId, change: (beat: Beat) => Beat): ProjectFile => {
  if (!file.beats.some((beat) => beat.id === beatId)) throw new DomainError(`Beat ${beatId} does not exist`);
  return touchProject({
    ...file,
    beats: file.beats.map((beat) => (beat.id === beatId ? touch(change(beat)) : beat)),
  });
};

/**
 * Start a new draft of a beat (addendum 02 §19).
 *
 * The text in hand is kept whole under its own name, and the beat is
 * **cleared**: a new draft is a new attempt at the scene, not an edit of the
 * last one. That is the point of drafting a beat rather than revising it —
 * you write it again, and then you read the two side by side.
 *
 * `from: 'copy'` keeps the old text as the starting point instead, for the
 * pass that is a revision rather than a rewrite.
 */
export const startRevision = (
  file: ProjectFile,
  beatId: BeatId,
  name: string,
  options: { from?: 'blank' | 'copy' } = {},
): ProjectFile =>
  withBeat(file, beatId, (beat) => ({
    ...beat,
    revisions: [
      ...beat.revisions,
      { id: newId<BeatRevisionId>(), name: beat.revisionName, manuscript: beat.manuscript, savedAt: nowIso() },
    ],
    manuscript: options.from === 'copy' ? beat.manuscript : { elements: [] },
    revisionName: name.trim() || `Draft ${beat.revisions.length + 2}`,
  }));

/** Every draft of a beat, the working one included, in the order they were made. */
export const draftsOf = (beat: Beat): Array<{ id: string; name: string; working: boolean; words: number }> => [
  ...beat.revisions.map((revision) => ({
    id: revision.id as string,
    name: revision.name,
    working: false,
    words: countWords(revision.manuscript),
  })),
  { id: 'working', name: beat.revisionName, working: true, words: countWords(beat.manuscript) },
];

/** The text of one draft by its id, for reading beside the one being written. */
export const draftText = (beat: Beat, draftId: string): ManuscriptSegment | null => {
  if (draftId === 'working') return beat.manuscript;
  return beat.revisions.find((revision) => (revision.id as string) === draftId)?.manuscript ?? null;
};

/** Make a kept revision the working one; the working text is kept in its place. */
export const switchRevision = (file: ProjectFile, beatId: BeatId, revisionId: BeatRevisionId): ProjectFile =>
  withBeat(file, beatId, (beat) => {
    const chosen = beat.revisions.find((revision) => revision.id === revisionId);
    if (!chosen) throw new DomainError(`Revision ${revisionId} does not exist`);
    return {
      ...beat,
      manuscript: chosen.manuscript,
      revisionName: chosen.name,
      revisions: [
        ...beat.revisions.filter((revision) => revision.id !== revisionId),
        { id: chosen.id, name: beat.revisionName, manuscript: beat.manuscript, savedAt: nowIso() },
      ],
    };
  });

export const removeRevision = (file: ProjectFile, beatId: BeatId, revisionId: BeatRevisionId): ProjectFile =>
  withBeat(file, beatId, (beat) => ({
    ...beat,
    revisions: beat.revisions.filter((revision) => revision.id !== revisionId),
  }));

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
  input: {
    name: string;
    description?: string;
    voice?: VoiceAssignment | null;
    categoryId?: CharacterCategoryId | null;
  },
): ProjectFile => {
  const timestamp = nowIso();
  const character = characterSchema.parse({
    id: newId<CharacterId>(),
    projectId: file.project.id,
    name: input.name,
    description: input.description ?? '',
    voice: input.voice ?? null,
    // Unfiled unless the writer said where. A name typed into the script is
    // a character before anyone has decided how important they are.
    categoryId: input.categoryId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return touchProject({ ...file, characters: [...file.characters, character] });
};

/**
 * Every name the script speaks with is in the cast (addendum 02 §16).
 *
 * A character cue *is* the act of introducing someone. Typing one and then
 * having to go and enter the same name in Research is asking the writer to
 * say it twice, and every list built on the cast — who is offered while the
 * next cue is typed, the character track on the timeline, read-back's voices,
 * an episode's carry-over — is wrong until they do.
 *
 * So this is run after a cue is written: any name the manuscript uses and the
 * cast does not know is added, unfiled. Unfiled because a name typed into a
 * script is a character before anyone has decided how important they are, and
 * guessing at that from one line would be inventing a judgement.
 *
 * Nothing is ever removed. Deleting a line is not the same as saying the
 * character never existed, and a cast list that emptied itself as the writer
 * cut a scene would be a trap.
 */
export const notedCast = (file: ProjectFile): ProjectFile => {
  const missing = spokenNames(file).filter((name) => knowsCharacter(file, name) === null);
  if (missing.length === 0) return file;

  const timestamp = nowIso();
  const added = missing.map((name) =>
    characterSchema.parse({
      id: newId<CharacterId>(),
      projectId: file.project.id,
      name,
      categoryId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );
  return touchProject({ ...file, characters: [...file.characters, ...added] });
};

export const updateCharacter = (
  file: ProjectFile,
  characterId: CharacterId,
  patch: Partial<Pick<Character, 'name' | 'description' | 'arcNotes' | 'aliases' | 'categoryId' | 'archived'>>,
): ProjectFile => {
  if (!file.characters.some((character) => character.id === characterId)) {
    throw new DomainError(`Character ${characterId} does not exist`);
  }
  if (patch.categoryId != null && !(file.characterCategories ?? []).some((c) => c.id === patch.categoryId)) {
    throw new DomainError(`Character category ${patch.categoryId} does not exist`);
  }
  return touchProject({
    ...file,
    characters: file.characters.map((character) =>
      character.id === characterId ? touch({ ...character, ...patch }) : character,
    ),
  });
};

export const removeCharacter = (file: ProjectFile, characterId: CharacterId): ProjectFile => {
  const removed = new Set<string>([characterId]);
  return touchProject({
    ...file,
    characters: file.characters.filter((character) => character.id !== characterId),
    links: withoutLinksTouching(file, removed),
  });
};

/**
 * The writer's structural reading of a scene (spec §8.2).
 *
 * A patch, not a replacement: answering "which way does it move" must not
 * wipe out what is at stake, and the two are answered at different moments.
 */
export const setSceneGrid = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  patch: Partial<SceneGrid>,
): ProjectFile => {
  if (!file.units.some((unit) => unit.id === unitId)) {
    throw new DomainError(`Scene/chapter ${unitId} does not exist`);
  }
  return touchProject({
    ...file,
    units: file.units.map((unit) =>
      unit.id === unitId ? touch({ ...unit, grid: sceneGridSchema.parse({ ...unit.grid, ...patch }) }) : unit,
    ),
  });
};

/**
 * Keep an AI read on the scene it is about (spec §8.2).
 *
 * Whole, not patched: a reading is one answer given at one moment, and half
 * of an old one mixed into a new one would be neither. Passing null forgets
 * it — the writer disagreed, or the scene has been rewritten under it.
 *
 * The timestamp is set here rather than taken from the server: it is the
 * document saying when it learnt this, which is what "read before the
 * rewrite" has to be measured against.
 */
export const setSceneRead = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  read: Omit<SceneRead, 'readAt'> | null,
): ProjectFile => {
  if (!file.units.some((unit) => unit.id === unitId)) {
    throw new DomainError(`Scene/chapter ${unitId} does not exist`);
  }
  const stored = read === null ? null : sceneReadSchema.parse({ ...read, readAt: nowIso() });
  return touchProject({
    ...file,
    units: file.units.map((unit) => (unit.id === unitId ? touch({ ...unit, aiRead: stored }) : unit)),
  });
};

// --------------------------------------------------------- the editor's own settings

/**
 * How the manuscript sets its paragraphs (spec §6.4).
 *
 * A property of the document rather than of one printing: the writer sees the
 * style they chose while they are writing, and it comes out of the printer
 * the same way.
 */
export const setParagraphStyle = (file: ProjectFile, paragraphStyle: ParagraphStyle): ProjectFile =>
  touchProject({ ...file, settings: { ...file.settings, paragraphStyle } });

/**
 * Which house a script is set in (spec §6.5): US studio format, or the BBC's.
 *
 * A project setting rather than a machine one. It changes the page geometry,
 * and therefore the page count, so two people opening the same script have to
 * be looking at the same thing.
 */
export const setScriptFormat = (file: ProjectFile, scriptFormat: ScriptFormat): ProjectFile =>
  touchProject({ ...file, settings: { ...file.settings, scriptFormat } });

/**
 * Whether the acts break the script into pages of their own (spec §6.5).
 *
 * A network episode is written that way and a streaming one is not, so it is
 * a choice rather than something inferred from the format.
 */
export const setActBreaks = (file: ProjectFile, actBreaks: boolean): ProjectFile =>
  touchProject({ ...file, settings: { ...file.settings, actBreaks } });

/**
 * The title page (spec §6.1).
 *
 * A patch, because the six fields are filled in at different moments: the
 * title and the name when the project is made, the draft and the contact when
 * it goes out to somebody.
 */
export const setTitlePage = (file: ProjectFile, patch: Partial<TitlePage>): ProjectFile =>
  touchProject({
    ...file,
    settings: {
      ...file.settings,
      titlePage: titlePageSchema.parse({ ...file.settings.titlePage, ...patch }),
    },
  });

/**
 * An episode's own title page (addendum 02 §17).
 *
 * The same patch as the project's, addressed to the marker that starts the
 * episode. Passing null gives the episode back to the series' page.
 */
export const setEpisodeTitlePage = (
  file: ProjectFile,
  markerId: StoryMarkerId,
  patch: Partial<TitlePage> | null,
): ProjectFile => {
  const marker = file.markers.find((candidate) => candidate.id === markerId);
  if (!marker) throw new DomainError(`Marker ${markerId} does not exist`);
  const next =
    patch === null ? null : titlePageSchema.parse({ ...(marker.titlePage ?? {}), ...patch });

  // Two scripts cannot be Episode 1. The number lives on the front page
  // (§6.1), so this is where it is kept unique — the screen that edits the
  // page asks first, and this is the backstop under it.
  if (next !== null) {
    const clash = episodeNumberClash(file, markerId, next.episode);
    if (clash) {
      throw new DomainError(
        `${clash.label} already carries that number. Two episodes cannot be numbered the same.`,
      );
    }
  }

  return touchProject({
    ...file,
    markers: file.markers.map((candidate) =>
      candidate.id === markerId ? touch({ ...candidate, titlePage: next }) : candidate,
    ),
  });
};

/**
 * Switch a Daily Editor rule off, or back on (spec §8.1).
 *
 * The writer's judgement about a rule is a property of the project, not of a
 * sitting: a script whose action is deliberately dense should not be told
 * about walls of action every time it is opened.
 */
export const setEditorRule = (file: ProjectFile, kind: string, on: boolean): ProjectFile => {
  const ignored = new Set(file.settings.editorIgnoredRules ?? []);
  if (on) ignored.delete(kind);
  else ignored.add(kind);
  return touchProject({ ...file, settings: { ...file.settings, editorIgnoredRules: [...ignored] } });
};

/** "That is a word." Said once, and the typo check never asks again. */
export const allowWord = (file: ProjectFile, word: string): ProjectFile => {
  const clean = word.trim().toLowerCase();
  if (clean.length === 0) return file;
  const allowed = new Set((file.settings.editorAllowedWords ?? []).map((entry) => entry.toLowerCase()));
  if (allowed.has(clean)) return file;
  allowed.add(clean);
  return touchProject({ ...file, settings: { ...file.settings, editorAllowedWords: [...allowed] } });
};

// ------------------------------------------------- the headings the cast sits under

/**
 * A heading of the writer's own (addendum 02 §16). New ones go at the end,
 * because a category added later is rarely the most important one.
 */
export const addCharacterCategory = (
  file: ProjectFile,
  input: { name: string; index?: number },
): { file: ProjectFile; category: CharacterCategory } => {
  const timestamp = nowIso();
  const siblings = characterCategoriesInOrder(file);
  const category = characterCategorySchema.parse({
    id: newId<CharacterCategoryId>(),
    projectId: file.project.id,
    name: input.name,
    orderKey: orderKeyForIndex(siblings, input.index ?? siblings.length),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return {
    file: touchProject({ ...file, characterCategories: [...(file.characterCategories ?? []), category] }),
    category,
  };
};

export const renameCharacterCategory = (
  file: ProjectFile,
  categoryId: CharacterCategoryId,
  name: string,
): ProjectFile => {
  if (!(file.characterCategories ?? []).some((category) => category.id === categoryId)) {
    throw new DomainError(`Character category ${categoryId} does not exist`);
  }
  return touchProject({
    ...file,
    characterCategories: (file.characterCategories ?? []).map((category) =>
      category.id === categoryId ? touch({ ...category, name }) : category,
    ),
  });
};

export const moveCharacterCategory = (
  file: ProjectFile,
  categoryId: CharacterCategoryId,
  index: number,
): ProjectFile => {
  const siblings = characterCategoriesInOrder(file).filter((category) => category.id !== categoryId);
  const moving = (file.characterCategories ?? []).find((category) => category.id === categoryId);
  if (!moving) throw new DomainError(`Character category ${categoryId} does not exist`);
  return touchProject({
    ...file,
    characterCategories: (file.characterCategories ?? []).map((category) =>
      category.id === categoryId ? touch({ ...category, orderKey: orderKeyForIndex(siblings, index) }) : category,
    ),
  });
};

/**
 * Remove a heading. The people under it are **unfiled, not deleted** — losing
 * a character because a heading was tidied away would be indefensible.
 */
export const removeCharacterCategory = (file: ProjectFile, categoryId: CharacterCategoryId): ProjectFile =>
  touchProject({
    ...file,
    characterCategories: (file.characterCategories ?? []).filter((category) => category.id !== categoryId),
    characters: file.characters.map((character) =>
      character.categoryId === categoryId ? touch({ ...character, categoryId: null }) : character,
    ),
  });

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
  patch: Partial<Pick<Lane, 'name' | 'kind' | 'color' | 'description' | 'arc' | 'collapsed'>>,
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
    markers: reanchorMarkers(file, removedUnitIds),
    links: withoutLinksTouching(file, removed),
  });
};

export const updateUnit = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  patch: Partial<Pick<StructuralUnit, 'title' | 'sequenceLabel' | 'summary' | 'notes' | 'status' | 'collapsed' | 'inScript'>>,
): ProjectFile => {
  if (!file.units.some((unit) => unit.id === unitId)) {
    throw new DomainError(`Scene/chapter ${unitId} does not exist`);
  }
  return touchProject({
    ...file,
    units: file.units.map((unit) => (unit.id === unitId ? touch({ ...unit, ...patch }) : unit)),
  });
};

/**
 * Split a scene in two at one of its beats (addendum 02 §5).
 *
 * The beat chosen, and everything after it, moves into a new scene that
 * takes the story position immediately after this one — in the same lane,
 * untitled, the way a cut in an editing timeline leaves the second half to
 * be named. Nothing about the manuscript changes: the beats keep their
 * order, so the script reads exactly as it did before the cut. Splitting
 * at the first beat would leave an empty scene behind and is refused.
 */
export const splitUnit = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  atBeatId: BeatId,
): { file: ProjectFile; unit: StructuralUnit } => {
  const unit = file.units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new DomainError(`Scene/chapter ${unitId} does not exist`);

  const beats = beatsForUnit(file, unitId);
  const at = beats.findIndex((beat) => beat.id === atBeatId);
  if (at === -1) throw new DomainError(`Beat ${atBeatId} is not in ${unitId}`);
  if (at === 0) throw new DomainError('A scene cannot be split at its first beat');

  const order = unitsInStoryOrder(file);
  const position = order.findIndex((candidate) => candidate.id === unitId);
  const created = addUnit(file, {
    laneId: unit.laneId,
    kind: unit.kind,
    // Straight after this scene in the story, which is where a cut leaves it.
    index: position + 1,
  });

  const moving = new Set(beats.slice(at).map((beat) => beat.id as string));
  const timestamp = nowIso();
  return {
    file: touchProject({
      ...created.file,
      beats: created.file.beats.map((beat) =>
        moving.has(beat.id) ? { ...beat, unitId: created.unit.id, updatedAt: timestamp } : beat,
      ),
    }),
    unit: created.unit,
  };
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
    markers: reanchorMarkers(file, new Set<string>([unitId])),
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
  input: { name: string; description?: string; index?: number; parentId?: ResearchCategoryId | null; color?: string | null },
): { file: ProjectFile; category: ResearchCategory } => {
  const timestamp = nowIso();
  const parentId = input.parentId ?? null;
  if (parentId && !file.researchCategories.some((category) => category.id === parentId)) {
    throw new DomainError(`Research category ${parentId} does not exist`);
  }
  const siblings = researchCategoriesInOrder(file).filter((category) => (category.parentId ?? null) === parentId);
  const category = researchCategorySchema.parse({
    id: newId<ResearchCategoryId>(),
    projectId: file.project.id,
    name: input.name,
    description: input.description ?? '',
    parentId,
    color: input.color ?? null,
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
  patch: Partial<Pick<ResearchCategory, 'name' | 'description' | 'color'>>,
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

/**
 * File a folder inside another one, or at the top with `null` (addendum 02
 * §7). A folder cannot be filed inside itself or inside its own descendants
 * — that would cut it out of the tree — and the seeded folders stay where
 * they are, the way Causality's blue folders do.
 */
export const reparentResearchCategory = (
  file: ProjectFile,
  categoryId: ResearchCategoryId,
  parentId: ResearchCategoryId | null,
): ProjectFile => {
  const category = file.researchCategories.find((candidate) => candidate.id === categoryId);
  if (!category) throw new DomainError(`Research category ${categoryId} does not exist`);
  if (category.systemKey !== null) throw new DomainError('A seeded folder cannot be moved');
  if (parentId !== null) {
    if (!file.researchCategories.some((candidate) => candidate.id === parentId)) {
      throw new DomainError(`Research category ${parentId} does not exist`);
    }
    if (researchSubtree(file, categoryId).includes(parentId)) {
      throw new DomainError('A folder cannot be filed inside itself');
    }
  }
  const siblings = researchCategoriesInOrder(file).filter(
    (candidate) => (candidate.parentId ?? null) === parentId && candidate.id !== categoryId,
  );
  return touchProject({
    ...file,
    researchCategories: file.researchCategories.map((candidate) =>
      candidate.id === categoryId
        ? touch({ ...candidate, parentId, orderKey: orderKeyForIndex(siblings, siblings.length) })
        : candidate,
    ),
  });
};

/**
 * Remove a folder. Nothing filed in it is lost: its items and the folders
 * under it move up to where it was, which is the answer to "what happened
 * to my notes" that a writer should never have to ask. Seeded folders stay.
 */
export const removeResearchCategory = (file: ProjectFile, categoryId: ResearchCategoryId): ProjectFile => {
  const category = file.researchCategories.find((candidate) => candidate.id === categoryId);
  if (!category) throw new DomainError(`Research category ${categoryId} does not exist`);
  if (category.systemKey !== null) throw new DomainError('A seeded folder cannot be removed');

  const parentId = category.parentId ?? null;
  const home =
    parentId ?? researchCategoriesInOrder(file).find((candidate) => candidate.id !== categoryId)?.id ?? null;
  if (home === null) throw new DomainError('The last research folder cannot be removed');

  return touchProject({
    ...file,
    researchCategories: file.researchCategories
      .filter((candidate) => candidate.id !== categoryId)
      .map((candidate) => (candidate.parentId === categoryId ? touch({ ...candidate, parentId }) : candidate)),
    researchItems: file.researchItems.map((item) =>
      item.categoryId === categoryId ? touch({ ...item, categoryId: home }) : item,
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
