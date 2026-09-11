import { z } from 'zod';
import { roleCan, type RoomRole } from './room.js';

/**
 * Branches and versions (addendum 07, stage 3).
 *
 * **A writer never writes to the master.** That is not a rule the policies have
 * to be careful about; it is the shape of the thing. A writer's work lives on
 * *their branch*, which is a different table from the project's rows, so there
 * is no statement they can issue that reaches anyone else's draft. §1 stops
 * being a promise and becomes arithmetic.
 *
 * The distinction that carries the rest of the file:
 *
 * **The desk is not the record.** A branch has one mutable head — what autosave
 * writes to, forty times an afternoon — and a chain of **versions**, which are
 * immutable and are made when somebody decides a point has been reached. A
 * history that recorded every autosave would be a history nobody could read,
 * and one that recorded nothing would not be a history.
 */

export const VERSION_KINDS = ['snapshot', 'submission', 'master'] as const;
export const versionKindSchema = z.enum(VERSION_KINDS);
export type VersionKind = (typeof VERSION_KINDS)[number];

export const branchSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  /** Whose line it is. A branch without an owner is nobody's draft. */
  ownerId: z.string(),
  name: z.string().default(''),
  /** What it was taken from; null for a branch taken from the project as it stands. */
  baseVersionId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Branch = z.infer<typeof branchSchema>;

/**
 * A version without the document on it.
 *
 * The history is read far more often than any one version is opened — a list of
 * forty drafts should not be forty whole scripts crossing the wire — so the
 * document is fetched when something actually wants to read it.
 */
export const versionSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  branchId: z.string().nullable().default(null),
  authorId: z.string().nullable().default(null),
  /** What this came from, so the history is a chain and not a list. */
  parentVersionId: z.string().nullable().default(null),
  kind: versionKindSchema.default('snapshot'),
  /** What the writer called it — *First Draft*, *Room Pass*, *Network Notes*. */
  label: z.string().default(''),
  summary: z.string().default(''),
  contentHash: z.string().default(''),
  createdAt: z.string(),
});
export type Version = z.infer<typeof versionSchema>;

// -------------------------------------------------------- opening a branch

/**
 * Why somebody cannot open a draft here.
 *
 * `no_seat` and `cannot_write` are different answers and a writer deserves the
 * right one: one means you are not in this room, the other means you are, and
 * the room did not ask you to write.
 */
export type BranchRefusal = { reason: 'no_seat' } | { reason: 'cannot_write' };

/**
 * Whether this person gets a working line at all.
 *
 * A Viewer and an Editor do not: an Editor comments and proposes (§7), and
 * neither of them is writing the script. A branch nobody can write to is a
 * confusing thing to hand somebody.
 */
export const canOpenBranch = (role: RoomRole | null): BranchRefusal | null => {
  if (role === null) return { reason: 'no_seat' };
  return roleCan(role, 'writeOwnBranch') ? null : { reason: 'cannot_write' };
};

export const branchRefusalText = (refusal: BranchRefusal): string =>
  refusal.reason === 'no_seat'
    ? 'You are not in this room.'
    : 'You are in this room to read and comment, not to write a draft.';

/** The branch this person has here, if they have one. */
export const branchFor = (branches: readonly Branch[], userId: string | null): Branch | null =>
  userId ? (branches.find((branch) => branch.ownerId === userId) ?? null) : null;

/** What a new branch is called, before anyone renames it. */
export const branchNameFor = (displayName: string): string => {
  const said = displayName.trim();
  return said.length > 0 ? `${said}’s draft` : 'A draft';
};

// ------------------------------------------------------------- the history

/**
 * A version chain, newest first, following parents from a starting point.
 *
 * Walks parents rather than sorting by time, because time is not what makes
 * one version follow another — a restored version is stamped now and its
 * parent is whatever it was taken from. The step cap is the cycle guard: a
 * chain cannot be longer than the number of versions there are.
 */
export const versionChain = (versions: readonly Version[], fromId: string | null): Version[] => {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const chain: Version[] = [];
  let at = fromId;
  for (let step = 0; at && step <= versions.length; step += 1) {
    const version = byId.get(at);
    if (!version) break;
    chain.push(version);
    at = version.parentVersionId;
  }
  return chain;
};

/** Everything made on this branch, newest first. */
export const versionsOn = (versions: readonly Version[], branchId: string): Version[] =>
  versions
    .filter((version) => version.branchId === branchId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

/** The room's approved draft, where one has been made. */
export const masterVersion = (versions: readonly Version[]): Version | null =>
  versions
    .filter((version) => version.kind === 'master')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;

/**
 * What a version is called in a list.
 *
 * The label if it was given one, because that is what the writer will look
 * for; otherwise what kind of thing it is and when — never an id, which is the
 * one thing about a version nobody can recognise.
 */
export const describeVersion = (version: Version): string => {
  const said = version.label.trim();
  if (said.length > 0) return said;
  const when = new Date(version.createdAt);
  const stamp = Number.isNaN(when.getTime())
    ? version.createdAt
    : when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const what = version.kind === 'master' ? 'Master' : version.kind === 'submission' ? 'Submitted' : 'Snapshot';
  return `${what} · ${stamp}`;
};

/**
 * Whether anything has actually changed since a version was made.
 *
 * A snapshot of a draft nobody has touched is a snapshot that says nothing,
 * and a history full of them is a history that hides the real ones.
 */
export const isUnchangedSince = (version: Version | null, contentHash: string): boolean =>
  version !== null && version.contentHash.length > 0 && version.contentHash === contentHash;
