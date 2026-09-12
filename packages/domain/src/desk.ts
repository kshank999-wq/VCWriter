import { roleCan, seatName, type RoomRole, type Seat } from './room.js';
import { describeVersion, type Branch, type Version } from './branch.js';

/**
 * The room, desk by desk (addendum 07 §10, §13, stage 5).
 *
 * The showrunner's dashboard asks one question of every seat: *what is on that
 * writer's line, and may I read it?* The second half is the interesting one,
 * because the answer is usually **no** and that is the design rather than a
 * gap in it (§7). A room where everyone can read everyone's unfinished draft is
 * a room where nobody drafts; submitting is how work becomes the showrunner's
 * to read (§10), and until then a desk shows *that* it exists and nothing of
 * what is on it.
 *
 * So this file is careful about a distinction the interface must not blur:
 *
 * - **A branch** is public within the room. Who has one, and since when.
 * - **A desk** — what autosave rewrites — is private, always, to its owner.
 * - **A version** is readable by its author, and by the room when it is the
 *   master. Stage 6 adds the third case: a submission, readable by whoever it
 *   was submitted to.
 *
 * `mayReadVersion` is written to match the database's own policy rather than
 * to guess at it, and it is the one place the rule is stated for the interface.
 * The database is still the thing enforcing it: this decides what to *offer*,
 * and a link this file wrongly offered would be refused on the way through.
 */

/** Whether this reader may open a version at all. */
export const mayReadVersion = (
  version: Pick<Version, 'authorId' | 'kind'>,
  viewer: { userId: string | null },
): boolean => version.kind === 'master' || (version.authorId !== null && version.authorId === viewer.userId);

/**
 * What a reader is being told about one writer's line.
 *
 * `working` is the honest answer for somebody else's branch, and the note says
 * why rather than leaving a row that looks broken.
 */
export type DeskState = 'invited' | 'no_line' | 'working' | 'readable';

export interface Desk {
  seat: Seat;
  branch: Branch | null;
  /** Only the versions this reader may open; empty is the common case. */
  versions: Version[];
  state: DeskState;
  /** Whether this desk is the reader's own. */
  mine: boolean;
}

const stateOf = (seat: Seat, branch: Branch | null, readable: number, mine: boolean): DeskState => {
  if (seat.state !== 'active' || !seat.userId) return 'invited';
  if (!branch) return 'no_line';
  return readable > 0 || mine ? 'readable' : 'working';
};

/**
 * Every seat in the room, with what the reader may see of its work.
 *
 * Ordered the way the room lists its people rather than by activity: a
 * dashboard that reordered itself as writers saved would be one nobody could
 * point at across a table.
 */
export const desksIn = (input: {
  seats: readonly Seat[];
  branches: readonly Branch[];
  versions: readonly Version[];
  viewer: { userId: string | null };
}): Desk[] =>
  input.seats
    .filter((seat) => seat.state !== 'deactivated')
    .map((seat) => {
      const branch = input.branches.find((one) => one.ownerId === seat.userId) ?? null;
      const versions = input.versions.filter(
        (version) =>
          version.kind !== 'master' &&
          version.authorId === seat.userId &&
          mayReadVersion(version, input.viewer),
      );
      const mine = Boolean(seat.userId) && seat.userId === input.viewer.userId;
      return { seat, branch, versions, state: stateOf(seat, branch, versions.length, mine), mine };
    });

/** What the dashboard says about a desk, in the room's own words. */
export const deskNote = (desk: Desk): string => {
  switch (desk.state) {
    case 'invited':
      return 'Invited. Nothing starts until they accept.';
    case 'no_line':
      return `${seatName(desk.seat)} has not opened a draft yet.`;
    case 'working':
      // Said plainly, because it is the promise the room is built on and a
      // showrunner should meet it here rather than discover it later.
      return 'Working. What is on their desk is theirs until they submit it.';
    case 'readable':
      return desk.mine
        ? 'Your own line. Every point you have recorded on it is here.'
        : 'Submitted work, open to read.';
  }
};

/**
 * What a window holding this version should call itself (§3.4).
 *
 * Three windows showing the same scene are indistinguishable without it, which
 * is the reason §6's stamp is not decoration. The author's name comes first
 * because that is what the reader is choosing between.
 */
export const windowTitleFor = (input: { version: Version; author: Seat | null }): string => {
  if (input.version.kind === 'master') return `The master — ${describeVersion(input.version)}`;
  const who = input.author ? seatName(input.author) : 'Unattributed';
  return `${who} — ${describeVersion(input.version)}`;
};

/**
 * Whether this reader may take a version of the room's master.
 *
 * The room's approved draft is the showrunner's to declare, and stage 9 is
 * where a master is made out of what the room wrote. This is here so the
 * dashboard can offer it without deciding the rule twice.
 */
export const canPublishMaster = (role: RoomRole | null): boolean =>
  role !== null && roleCan(role, 'curate');
