/**
 * Stable identifiers for every story entity.
 *
 * Spec §14 / §19: relationships are expressed with stable IDs, never with
 * display names. Branding the string types makes an accidental
 * `beatId` -> `unitId` assignment a compile error rather than a silent
 * data-integrity bug.
 */

export type Id<TBrand extends string> = string & { readonly __brand: TBrand };

export type UserId = Id<'User'>;
export type ProjectId = Id<'Project'>;
export type TrackId = Id<'Track'>;
export type StructuralUnitId = Id<'StructuralUnit'>;
export type BeatId = Id<'Beat'>;
export type StoryMarkerId = Id<'StoryMarker'>;
export type WritingSessionId = Id<'WritingSession'>;
export type BeatRevisionId = Id<'BeatRevision'>;
export type ResearchCategoryId = Id<'ResearchCategory'>;
export type ResearchItemId = Id<'ResearchItem'>;
export type CharacterId = Id<'Character'>;
export type CharacterCategoryId = Id<'CharacterCategory'>;
/* The Character Creator (addendum 08). */
export type CharacterTraitId = Id<'CharacterTrait'>;
export type CharacterizationItemId = Id<'CharacterizationItem'>;
export type UsageLinkId = Id<'UsageLink'>;
/** A theme and a motif are separate kinds (addendum 12 §2), so separate ids. */
export type ResearchThemeId = Id<'ResearchTheme'>;
export type ResearchMotifId = Id<'ResearchMotif'>;
export type ThemeMotifLinkId = Id<'ThemeMotifLink'>;
/** A place, and one of the several descriptions prepared for it (addendum 14). */
export type LocationId = Id<'Location'>;
export type LocationDescriptionId = Id<'LocationDescription'>;
export type CharacterArcId = Id<'CharacterArc'>;
export type ArcPointId = Id<'ArcPoint'>;
export type CharacterRelationshipId = Id<'CharacterRelationship'>;
/* The book index (addendum 10). */
export type IndexMarkId = Id<'IndexMark'>;
export type IndexRefId = Id<'IndexRef'>;
export type StoryLinkId = Id<'StoryLink'>;
/**
 * A narrative thread (addendum 15). Its *moments* are usage links and its
 * *dependencies* are story links, so this is the module's only new id.
 */
export type StoryThreadId = Id<'StoryThread'>;
/** An end-of-section learning aid (addendum 16 §10). */
export type LearningAidId = Id<'LearningAid'>;
/** One run of the research importer (addendum 16 §4). */
export type ImportBatchId = Id<'ImportBatch'>;
export type SetupPayoffId = Id<'SetupPayoff'>;
export type SetupPointId = Id<'SetupPoint'>;
export type CaptureItemId = Id<'CaptureItem'>;
export type SnapshotId = Id<'Snapshot'>;
export type ManuscriptElementId = Id<'ManuscriptElement'>;
export type AssetId = Id<'Asset'>;
/** The Story Sculptor's own (addendum 03 §15). */
export type BoardId = Id<'Board'>;
export type SculptorColumnId = Id<'SculptorColumn'>;
export type SculptorNodeId = Id<'SculptorNode'>;
export type SculptorFieldId = Id<'SculptorField'>;
export type SculptorLinkId = Id<'SculptorLink'>;
export type OutlineId = Id<'Outline'>;
export type OutlineItemId = Id<'OutlineItem'>;
/**
 * Interactive Narrative (addendum 18). Four ids and no more: a **choice** is
 * not an edge (§2) so it needs one of its own, and everything the spec calls a
 * relationship is either a choice's destination, a condition or an effect —
 * none of which is addressable on its own.
 */
export type NarrativeElementId = Id<'NarrativeElement'>;
export type ChoiceId = Id<'Choice'>;
export type StateDefinitionId = Id<'StateDefinition'>;
export type ResourceDefinitionId = Id<'ResourceDefinition'>;
export type SimulationRunId = Id<'SimulationRun'>;
/**
 * The Player Lane's one stored record, and the quests that string objectives
 * together (addendum 25 §3).
 */
export type ObjectiveId = Id<'Objective'>;
export type QuestId = Id<'Quest'>;
/** A scene's behavioural and presentation layers, on a game (addendum 25 §5). */
export type SceneLayersId = Id<'SceneLayers'>;
export type BehaviourId = Id<'Behaviour'>;
/** Addendum 25 §7–§8: objects, triggers, the environment, puzzles, shots. */
export type InteractiveObjectId = Id<'InteractiveObject'>;
export type VerbId = Id<'Verb'>;
export type TriggerId = Id<'Trigger'>;
export type EnvironmentId = Id<'Environment'>;
export type MechanicId = Id<'Mechanic'>;
export type PuzzleId = Id<'Puzzle'>;
export type PuzzleComponentId = Id<'PuzzleComponent'>;
export type ShotId = Id<'Shot'>;
/**
 * Game Studio's record that an authored thing has been built in an engine
 * (addendum 25 §2). VC Writer carries these and reads their status; it never
 * makes one.
 */
export type ImplementationBindingId = Id<'ImplementationBinding'>;
export type OrderId = Id<'Order'>;
export type LicenseId = Id<'License'>;
export type ReleaseBuildId = Id<'ReleaseBuild'>;
export type DeviceActivationId = Id<'DeviceActivation'>;

/** Any branded id, when a helper genuinely does not care which kind it holds. */
export type AnyId = Id<string>;

interface RandomSource {
  randomUUID?: () => string;
}

const randomUuid = (): string => {
  const cryptoRef = (globalThis as { crypto?: RandomSource }).crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  // Fallback for runtimes without WebCrypto.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Mint a new identifier of the requested kind. */
export const newId = <T extends AnyId>(): T => randomUuid() as T;

/** Cast used when reading trusted, already-validated storage. */
export const asId = <T extends AnyId>(value: string): T => value as T;
