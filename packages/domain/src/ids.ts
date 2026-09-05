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
export type LaneId = Id<'Lane'>;
export type StructuralUnitId = Id<'StructuralUnit'>;
export type BeatId = Id<'Beat'>;
export type ResearchCategoryId = Id<'ResearchCategory'>;
export type ResearchItemId = Id<'ResearchItem'>;
export type CharacterId = Id<'Character'>;
export type StoryLinkId = Id<'StoryLink'>;
export type SetupPayoffId = Id<'SetupPayoff'>;
export type SetupPointId = Id<'SetupPoint'>;
export type CaptureItemId = Id<'CaptureItem'>;
export type SnapshotId = Id<'Snapshot'>;
export type ManuscriptElementId = Id<'ManuscriptElement'>;
export type AssetId = Id<'Asset'>;
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
