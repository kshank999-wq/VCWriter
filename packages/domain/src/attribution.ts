import { seatInitials, seatName, type Seat } from './room.js';
import type { Origin } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';

/**
 * Whose words these are (addendum 07 §6).
 *
 * **Colour is the fastest fact on a page**, and it is used in exactly four
 * places: the stamp in the top corner of a writer's page, the identity bar
 * above their version, the beat badge, and the overlay that tints the master
 * by source. Never on a lane — a lane is a thread of the story and a
 * contributor colour is a fact about who wrote a line, and two colour
 * languages on one page is neither (§6.2).
 *
 * **Read through, never copied across.** A record carries an `authorId` and
 * nothing else; the colour and the initials belong to the seat and are
 * resolved here. A writer who changes their colour has changed every page they
 * wrote, rather than leaving a hundred stale copies of the old one.
 *
 * **The master is clean and a contribution is signed** (§6.3). Attribution is
 * authoring metadata in exactly the sense the beat's internal title is (master
 * spec §5.3, §19): it belongs to the room, not to the script that leaves it.
 * But a writer's own draft, circulating inside the room, is *supposed* to say
 * whose it is — so the rule is not "never print it".
 */

/** What a page, a badge or a bar needs in order to say whose this is. */
export interface Attribution {
  authorId: string;
  name: string;
  initials: string;
  colour: string;
  /** Their credit in the room. Empty where none was given. */
  title: string;
}

/** The seats of a room, as the one map everything else reads through. */
export const attributionsOf = (seats: readonly Seat[]): Map<string, Attribution> => {
  const byAuthor = new Map<string, Attribution>();
  for (const seat of seats) {
    if (!seat.userId) continue;
    byAuthor.set(seat.userId, {
      authorId: seat.userId,
      name: seatName(seat),
      initials: seatInitials(seat),
      colour: seat.colour,
      title: seat.title,
    });
  }
  return byAuthor;
};

/**
 * Who made this, where the room knows.
 *
 * Returns null for anything written outside a room, and for an author whose
 * seat is not in this room's list — a contribution carried in from elsewhere,
 * or a seat taken out of a room the document was not loaded with. Null is
 * "unattributed" and is drawn as nothing at all rather than as a grey badge
 * saying somebody unknown wrote this.
 */
export const authorOf = (
  origin: Origin | null | undefined,
  byAuthor: ReadonlyMap<string, Attribution>,
): Attribution | null => (origin ? (byAuthor.get(origin.authorId) ?? null) : null);

/**
 * Stamping a record as this writer's, at this moment.
 *
 * Unassisted, because ordinary writing is. Work the room's AI helped with is
 * stamped by `assistedBy` instead, which says the same thing plus one more —
 * and says it about the *person*, never about the machine (§14).
 */
export const originNow = (authorId: string, at: string = new Date().toISOString()): Origin => ({
  authorId,
  at,
  assisted: false,
});

// ------------------------------------------------------- signing new work

/**
 * Every scene and beat the document already had.
 *
 * Taken once, when a branch is opened, and it is the whole of what `signNewWork`
 * needs to be right: on a writer's branch anything that was not there at the
 * start was made by them, because nobody else can write to it (§1 — and stage
 * 3 made that arithmetic rather than a promise).
 */
export const knownRecords = (file: ProjectFile): Set<string> =>
  new Set<string>([...file.units.map((unit) => unit.id as string), ...file.beats.map((beat) => beat.id as string)]);

/**
 * Sign what this writer made, and nothing else.
 *
 * Done in one place — the save, on the way out — rather than at every control
 * that can make a scene. There are a dozen of those and there will be more,
 * and threading an author through each of them would put a fact about the room
 * into a dozen components that have no business knowing there is one.
 *
 * Two records are left alone: anything already signed (an origin is immutable
 * — §6.3 — so a merge never re-attributes somebody else's work), and anything
 * that was in the document when the branch opened, which came from the master
 * and was written before this writer touched it.
 */
export const signNewWork = (
  file: ProjectFile,
  input: { authorId: string; known: ReadonlySet<string>; at?: string },
): ProjectFile => {
  const origin = originNow(input.authorId, input.at);
  const sign = <T extends { id: unknown; origin: Origin | null }>(record: T): T =>
    record.origin || input.known.has(record.id as string) ? record : { ...record, origin };

  const units = file.units.map(sign);
  const beats = file.beats.map(sign);
  const changed = units.some((unit, at) => unit !== file.units[at]) || beats.some((beat, at) => beat !== file.beats[at]);
  return changed ? { ...file, units, beats } : file;
};

// ------------------------------------------------------------- the stamp

/**
 * What goes in the top corner of every page of a writer's draft (§6.1).
 *
 * The page number already sits **top right from page two**, because that is
 * where scripts put it, so the stamp goes **top left on every page including
 * the first**. Two things in one corner would be a choice between them; two
 * corners is an arrangement.
 */
export interface PageStamp {
  initials: string;
  colour: string;
  /** Spelled out on the first page, where there is room to learn it. */
  name: string;
}

export const stampFor = (who: Attribution | null): PageStamp | null =>
  who && who.initials.trim().length > 0
    ? { initials: who.initials, colour: who.colour || '#666666', name: who.name }
    : null;

/**
 * Whether this printing is signed.
 *
 * **The master is clean.** A draft of the room's approved script carries no
 * stamp, no badges and no tint, and that is what clean-reading mode shows on
 * screen. A writer's own version is the opposite case and the distinction is
 * the point: it is circulating inside the room and is supposed to say whose it
 * is.
 */
export const isSigned = (input: { showing: 'master' | 'contribution'; cleanReading?: boolean }): boolean =>
  input.showing === 'contribution' && input.cleanReading !== true;

// ------------------------------------------------------------ the filters

/**
 * Every contributor with something in this project, in the order the room
 * lists them.
 *
 * Read off the work rather than off the seats: a filter offering six names
 * when two of them have written nothing is a filter that mostly returns
 * nothing, and the question it answers is *whose work is in here*.
 */
export const contributorsIn = (
  file: ProjectFile,
  byAuthor: ReadonlyMap<string, Attribution>,
): Attribution[] => {
  const seen = new Set<string>();
  for (const record of [...file.units, ...file.beats]) {
    if (record.origin) seen.add(record.origin.authorId);
  }
  return [...byAuthor.values()].filter((who) => seen.has(who.authorId));
};

/**
 * Which beats are this contributor's.
 *
 * A set rather than a filtered list, because what the interface wants is to
 * *mark* the ones that match while the rest stay where they are — a filter
 * that removed everything else would take a scene's beats out from under it
 * and leave the writer reading a list of fragments (the same reasoning
 * addendum 06 §8 gives for bringing a match's parents with it).
 */
export const beatsBy = (file: ProjectFile, authorId: string | null): Set<string> => {
  const found = new Set<string>();
  if (!authorId) return found;
  for (const beat of file.beats) {
    if (beat.origin?.authorId === authorId) found.add(beat.id as string);
  }
  return found;
};

/** How much of the script each contributor originated, for the dashboard. */
export const contributionTally = (
  file: ProjectFile,
): { authorId: string; scenes: number; beats: number }[] => {
  const tally = new Map<string, { authorId: string; scenes: number; beats: number }>();
  const bump = (authorId: string, what: 'scenes' | 'beats'): void => {
    const row = tally.get(authorId) ?? { authorId, scenes: 0, beats: 0 };
    row[what] += 1;
    tally.set(authorId, row);
  };

  for (const unit of file.units) if (unit.origin) bump(unit.origin.authorId, 'scenes');
  for (const beat of file.beats) if (beat.origin) bump(beat.origin.authorId, 'beats');

  return [...tally.values()].sort((a, b) => b.beats + b.scenes - (a.beats + a.scenes));
};
