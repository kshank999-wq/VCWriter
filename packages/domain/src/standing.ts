import { z } from 'zod';

/**
 * Where a local project stands against the room's master (addendum 07 §14,
 * stage 11).
 *
 * §14 asks for four words — **current, ahead, behind, diverged** — and they are
 * the right four, because they are what a writer actually wants to know before
 * they decide whether to send anything. This adds a fifth, `unmoored`, which
 * §14 does not name and which is the honest answer for a file that has never
 * been in this room at all: calling that *diverged* would be a lie about a
 * project that has simply never met the room.
 *
 * **The rule is here rather than on a server**, because it is one comparison
 * and it must give the same answer everywhere. The room reports two facts —
 * which version is the master and what it hashes to — and this decides.
 */

/**
 * Where a document came from.
 *
 * A fact about the **content**, not about the machine: two copies of the same
 * file descend from the same master version, so this travels with the document
 * rather than sitting in a per-device setting. That is also what makes *behind*
 * knowable at all — without an ancestor, a file that differs from the master
 * could equally be ahead of it or behind it, and the room would have to guess.
 */
export const mooringSchema = z.object({
  roomId: z.string(),
  /** The master version this copy was taken from, or last agreed with. */
  versionId: z.string(),
  /** What the document hashed to at that moment — how *ahead* is detected. */
  contentHash: z.string(),
  at: z.string(),
});
export type Mooring = z.infer<typeof mooringSchema>;

export const STANDINGS = ['unmoored', 'current', 'ahead', 'behind', 'diverged'] as const;
export const standingSchema = z.enum(STANDINGS);
export type Standing = (typeof STANDINGS)[number];

/** §14's words, said to the writer rather than about the data. */
export const STANDING_WORDS: Record<Standing, string> = {
  unmoored: 'Not in the room',
  current: 'Current',
  ahead: 'Ahead',
  behind: 'Behind',
  diverged: 'Diverged',
};

export interface RoomMaster {
  /** Null where the room has not agreed on a draft yet. */
  versionId: string | null;
  contentHash: string;
  label: string;
}

/**
 * The comparison, in the order the cases actually occur.
 *
 * Written as a chain rather than a table because each step depends on the one
 * before it: without a mooring nothing else can be asked, and *behind* is only
 * meaningful once we know the local copy has not been touched since it was
 * moored.
 */
export const standingOfProject = (input: {
  mooring: Mooring | null;
  /** What the local document hashes to now. */
  localHash: string;
  master: RoomMaster;
  roomId: string;
}): Standing => {
  const { mooring, localHash, master } = input;

  // Never been in this room — or moored to a different one, which is the same
  // answer for this room and a different project's business for the other.
  if (!mooring || mooring.roomId !== input.roomId) return 'unmoored';

  // The room has agreed on nothing yet, so there is nothing to be behind.
  if (!master.versionId) return localHash === mooring.contentHash ? 'current' : 'ahead';

  // Byte for byte the master. Said before anything else, because it is true
  // however the two got there and is the only state with nothing to do.
  if (localHash === master.contentHash) return 'current';

  const roomMoved = mooring.versionId !== master.versionId;
  const localMoved = localHash !== mooring.contentHash;

  if (roomMoved && localMoved) return 'diverged';
  if (roomMoved) return 'behind';
  return 'ahead';
};

/**
 * What the writer should do about it, in the room's own words.
 *
 * **Nothing here ever proposes an overwrite**, and that is the whole of §14's
 * desktop rule: work that goes up becomes a *contribution*, and work that comes
 * down is a new master the room agreed on. There is no third move where one
 * side wins by being newer, because that is the decision §3.3 says a room must
 * never make automatically.
 */
export const whatToDo = (standing: Standing, master: RoomMaster): string => {
  switch (standing) {
    case 'unmoored':
      return 'This project is not in the room. Sending it makes a contribution the room can look at; nothing here becomes the master by itself.';
    case 'current':
      return 'The same as the room’s draft. Nothing to send and nothing to fetch.';
    case 'ahead':
      return 'You have work the room has not seen. Send it and it arrives as a contribution — it never overwrites the master.';
    case 'behind':
      return `The room has agreed on ${master.label || 'a newer draft'} since you last did. Fetch it, and anything you write after that is a contribution on top of it.`;
    case 'diverged':
      return `You have written since the room agreed on ${master.label || 'a newer draft'}. Send yours as a contribution and fetch theirs — both survive, and the showrunner decides what the master carries.`;
  }
};

/** Whether there is anything of this writer's the room has not seen. */
export const hasWorkToSend = (standing: Standing): boolean =>
  standing === 'ahead' || standing === 'diverged' || standing === 'unmoored';

/** Whether the room has moved on without this copy. */
export const hasWorkToFetch = (standing: Standing): boolean =>
  standing === 'behind' || standing === 'diverged';

/**
 * What gets hashed, said once.
 *
 * The standing turns on comparing a local hash with the room's, so the two must
 * be taken over *exactly* the same bytes — and they are computed on different
 * machines, by different code, in different processes. The digest can differ by
 * platform (node's crypto here, the server's there); what cannot differ is what
 * went into it, so that lives here rather than being written out twice and
 * quietly drifting apart.
 *
 * A parsed document, always: both sides parse with the same schema, so the key
 * order `JSON.stringify` walks is the schema's rather than whatever order the
 * bytes happened to arrive in.
 */
export const bytesToHash = (parsed: unknown): string => JSON.stringify(parsed);

/** Stamp a document with where it now stands, once it agrees with the room. */
export const moorTo = (input: {
  roomId: string;
  versionId: string;
  contentHash: string;
  at: string;
}): Mooring => mooringSchema.parse(input);

// ------------------------------------------------------------- taking it out

/**
 * What a whole-room backup carries (§14).
 *
 * **Everything the room recorded, and the master as a readable document.** The
 * other versions are named but their documents are left out, deliberately: a
 * room with twenty writers and a year of snapshots would produce a file nobody
 * could open, and the thing a backup is *for* — proving who wrote what, and
 * getting the script back — is answered by the master plus the trail. A full
 * archive of every draft is a different and larger promise, and saying that
 * here is better than shipping half of it quietly.
 */
export interface RoomExport {
  exportedAt: string;
  room: unknown;
  seats: unknown[];
  branches: unknown[];
  /** Every version's *record* — author, label, kind, moment — without its document. */
  versions: unknown[];
  submissions: unknown[];
  assignments: unknown[];
  comments: unknown[];
  /** The master, whole, so the script is in the file rather than referenced. */
  master: { versionId: string | null; document: unknown };
}

/** What to call the file somebody just downloaded. */
export const exportFileName = (roomName: string, at: string): string => {
  const day = at.slice(0, 10);
  const name = roomName.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  return `${name || 'room'}-${day}.vcroom.json`;
};

/** What the backup says about itself, for whoever opens it in a year. */
export const describeExport = (bundle: RoomExport): string => {
  const counts = [
    [bundle.seats.length, 'seat'],
    [bundle.versions.length, 'version'],
    [bundle.submissions.length, 'submission'],
    [bundle.assignments.length, 'assignment'],
    [bundle.comments.length, 'comment'],
  ] as const;
  const said = counts
    .filter(([n]) => n > 0)
    .map(([n, word]) => `${n} ${word}${n === 1 ? '' : 's'}`)
    .join(', ');
  return said.length > 0 ? said : 'an empty room';
};
