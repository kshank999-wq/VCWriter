import { z } from 'zod';

/**
 * Writers Room: rooms, seats and what a seat may do (addendum 07, stage 1).
 *
 * **A room is not part of the project document.** Everything else in this
 * package describes a file a writer owns; a room describes who else is allowed
 * near it, and that answer lives in the cloud or it is not an answer at all —
 * §16 says the interface is never what decides access. So there are no
 * `ProjectFile` mutations here: these are the rules, and `apps/web` keeps the
 * rows.
 *
 * Two distinctions carry most of the file.
 *
 * **Role is not title** (§6). A role is permission and the database reads it; a
 * title is credit and the room reads it. One field for both is how a writer
 * ends up with producer rights because somebody wanted the word on a page.
 *
 * **Invited is not active** (§14). They bill differently, so they are
 * different states rather than one flag with a comment.
 */

// ------------------------------------------------------------------ roles

/**
 * What a seat may do. Four, in descending order of what they can reach, and
 * the order matters: `roleAtLeast` reads it.
 */
export const ROOM_ROLES = ['owner', 'writer', 'editor', 'viewer'] as const;
export const roomRoleSchema = z.enum(ROOM_ROLES);
export type RoomRole = (typeof ROOM_ROLES)[number];

/** What a role is called where a person reads it rather than a policy. */
export const ROLE_NAMES: Record<RoomRole, string> = {
  owner: 'Showrunner',
  writer: 'Writer',
  editor: 'Editor',
  viewer: 'Viewer',
};

/**
 * The things a room can be asked to do.
 *
 * Named for the act rather than the screen, so a table of permissions is a
 * table of decisions and not a map of the interface.
 */
export const ROOM_ACTIONS = [
  /** See the master draft and the room views they were given. */
  'read',
  /** Write to a branch of their own (§9). Never to anyone else's. */
  'writeOwnBranch',
  /** Say something on a scene, a beat, a line, a research item. */
  'comment',
  /** Enter material into review without being the one who wrote it (§7). */
  'propose',
  /** Send their own work for review (§10). */
  'submit',
  /** Read every contributor's work, not only the approved draft. */
  'readAllContributions',
  /** Take material into the tray and assemble a master version (§12). */
  'curate',
  /** Give a piece of the story to a person (§8). */
  'assign',
  /** Invite, retitle, recolour and deactivate seats (§6). */
  'manageSeats',
] as const;
export type RoomAction = (typeof ROOM_ACTIONS)[number];

/**
 * Who may do what.
 *
 * Written out rather than derived from the role order, because the interesting
 * cases are the ones an ordering gets wrong: an Editor may *propose* but not
 * write, and may read every contribution without being able to curate one.
 */
const RIGHTS: Record<RoomRole, readonly RoomAction[]> = {
  owner: [...ROOM_ACTIONS],
  writer: ['read', 'writeOwnBranch', 'comment', 'submit'],
  // An editor proposes: a submission from someone who is not a writer, landing
  // in the same queue rather than through a second mechanism (§7).
  editor: ['read', 'comment', 'propose', 'readAllContributions'],
  viewer: ['read'],
};

export const roleCan = (role: RoomRole, action: RoomAction): boolean => RIGHTS[role].includes(action);

/** Whether a role reaches at least as far as another. Owner reaches everything. */
export const roleAtLeast = (role: RoomRole, floor: RoomRole): boolean =>
  ROOM_ROLES.indexOf(role) <= ROOM_ROLES.indexOf(floor);

// ------------------------------------------------------------------ seats

/**
 * Where a seat stands.
 *
 * `invited` has been asked and has not answered; `active` is in the room;
 * `deactivated` has been taken out of it. Deactivating is not deleting —
 * §16: removing a seat removes access and never authorship.
 */
export const SEAT_STATES = ['invited', 'active', 'deactivated'] as const;
export const seatStateSchema = z.enum(SEAT_STATES);
export type SeatState = (typeof SEAT_STATES)[number];

/**
 * The colours a room hands out (§6).
 *
 * Chosen to stay apart on a page of white script and to survive being printed
 * small — the stamp in the top corner is often the only thing distinguishing
 * one draft from another (§6.1). The showrunner can overrule any of them; this
 * is what the room proposes so that nobody has to think about it to start.
 */
export const ROOM_COLOURS = [
  '#c2410c',
  '#1d4ed8',
  '#15803d',
  '#7e22ce',
  '#b91c1c',
  '#0f766e',
  '#a16207',
  '#be185d',
  '#4338ca',
  '#4d7c0f',
  '#9a3412',
  '#0e7490',
] as const;

export const roomSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().default(''),
  /** How many seats the subscription covers before another is billed (§14). */
  includedSeats: z.number().int().min(1).default(1),
  /**
   * Whether this room may ask the AI for readings (addendum 07 §14, stage 12).
   *
   * The owner's switch, on by default — the usage control that can be honoured
   * completely, so it is the one that exists. A *spending cap* is a larger
   * promise needing metering per room, and a limit that silently does not hold
   * would be worse than none.
   */
  aiEnabled: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Room = z.infer<typeof roomSchema>;

export const seatSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  /** Null until the invitation is accepted: an invitation is to an address. */
  userId: z.string().nullable().default(null),
  email: z.string(),
  /** Permission. The database reads this one. */
  role: roomRoleSchema.default('writer'),
  /** Credit — *Staff Writer*, *Co-Producer*. Changes nothing about access. */
  title: z.string().default(''),
  displayName: z.string().default(''),
  /** Overrides what would be read off the name; the writer's own if they say so. */
  initials: z.string().default(''),
  colour: z.string().default(''),
  state: seatStateSchema.default('invited'),
  invitedAt: z.string(),
  acceptedAt: z.string().nullable().default(null),
  deactivatedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Seat = z.infer<typeof seatSchema>;

// ------------------------------------------------------------- how a seat reads

/**
 * The letters in the corner of the page (§6.1).
 *
 * Two from two words, two from one, and nothing at all rather than a guess at
 * a name that is only punctuation. The seat's own `initials` wins where the
 * writer has said what theirs are — *J.C.* and *JC* are not the same signature
 * to the person who owns it.
 */
export const seatInitials = (seat: Pick<Seat, 'displayName' | 'initials' | 'email'>): string => {
  const said = seat.initials.trim();
  if (said.length > 0) return said.slice(0, 4).toUpperCase();

  const from = seat.displayName.trim() || seat.email.split('@')[0] || '';
  const words = from.split(/[\s._-]+/).filter((word) => /[a-z0-9]/i.test(word));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
};

/** What a seat is called on a dashboard: the name, or the address it was asked at. */
export const seatName = (seat: Pick<Seat, 'displayName' | 'email'>): string =>
  seat.displayName.trim() || seat.email;

/**
 * A colour nobody in the room is using yet.
 *
 * Falls back to the palette by position rather than to grey: two writers
 * sharing a colour is a worse failure than a colour nobody chose, and a room
 * of thirteen is not the case worth designing for.
 */
export const proposeColour = (seats: readonly Pick<Seat, 'colour' | 'state'>[]): string => {
  const taken = new Set(
    seats.filter((seat) => seat.state !== 'deactivated').map((seat) => seat.colour.toLowerCase()),
  );
  const free = ROOM_COLOURS.find((colour) => !taken.has(colour.toLowerCase()));
  return free ?? ROOM_COLOURS[taken.size % ROOM_COLOURS.length]!;
};

// -------------------------------------------------------------- who is in it

/** The seat this person holds in this room, if they hold one at all. */
export const seatFor = (seats: readonly Seat[], userId: string | null): Seat | null =>
  userId ? (seats.find((seat) => seat.userId === userId && seat.state === 'active') ?? null) : null;

/**
 * What this person may do here.
 *
 * The project's owner is the room's owner whether or not anyone gave them a
 * seat, because a room is attached to a project somebody already owns and a
 * showrunner locked out of their own story is not a failure mode worth having.
 */
export const roomRoleFor = (
  seats: readonly Seat[],
  userId: string | null,
  projectOwnerId: string,
): RoomRole | null => {
  if (userId && userId === projectOwnerId) return 'owner';
  return seatFor(seats, userId)?.role ?? null;
};

export const mayInRoom = (
  seats: readonly Seat[],
  userId: string | null,
  projectOwnerId: string,
  action: RoomAction,
): boolean => {
  const role = roomRoleFor(seats, userId, projectOwnerId);
  return role !== null && roleCan(role, action);
};

// ------------------------------------------------------------------ billing

export interface SeatCount {
  /** In the room and working. */
  active: number;
  /** Asked and not yet answered. Not billed: §14 keeps the two apart. */
  invited: number;
  /** Taken out of the room. Their contributions stay (§1). */
  deactivated: number;
  /** What the subscription covers. */
  included: number;
  /** Active seats beyond that, which is what another seat costs. */
  billable: number;
}

/**
 * What the room bills for (§14).
 *
 * **An invitation is not a seat until it is accepted.** Charging for one would
 * be charging for an email, and a showrunner who invites six people and gets
 * two would be paying for four strangers.
 *
 * **A deactivated seat is not billed and is not deleted.** It is how a room
 * stops paying for someone who has left without losing what they wrote, which
 * is §1 applied to the invoice.
 */
export const seatCount = (room: Pick<Room, 'includedSeats'>, seats: readonly Seat[]): SeatCount => {
  const active = seats.filter((seat) => seat.state === 'active').length;
  const invited = seats.filter((seat) => seat.state === 'invited').length;
  const deactivated = seats.filter((seat) => seat.state === 'deactivated').length;
  return {
    active,
    invited,
    deactivated,
    included: room.includedSeats,
    billable: Math.max(0, active - room.includedSeats),
  };
};

/** A line for the dashboard: what the room costs before anyone asks Stripe. */
export const describeSeats = (count: SeatCount): string => {
  const parts = [`${count.active} in the room`];
  if (count.invited > 0) parts.push(`${count.invited} invited`);
  parts.push(count.billable === 0 ? 'within the plan' : `${count.billable} extra`);
  return parts.join(' · ');
};

// ------------------------------------------------------- changing a seat

export type SeatRefusal =
  | { reason: 'already_invited'; email: string }
  | { reason: 'not_allowed' }
  | { reason: 'last_owner' };

/**
 * Whether this invitation can be sent.
 *
 * The same address twice is refused where the first invitation is still
 * standing or has been taken up — but an address that was deactivated can be
 * asked back, because people leave rooms and return to them.
 */
export const canInvite = (
  seats: readonly Seat[],
  email: string,
  by: RoomRole | null,
): SeatRefusal | null => {
  if (by === null || !roleCan(by, 'manageSeats')) return { reason: 'not_allowed' };
  const wanted = email.trim().toLowerCase();
  const standing = seats.find(
    (seat) => seat.email.toLowerCase() === wanted && seat.state !== 'deactivated',
  );
  return standing ? { reason: 'already_invited', email } : null;
};

/**
 * Whether this seat can be taken out of the room.
 *
 * A room without an owner has nobody who can curate it or invite anyone back,
 * so the last one cannot be removed. Every other seat can, and removing it
 * costs the access rather than the authorship (§16).
 */
export const canDeactivate = (
  seats: readonly Seat[],
  seatId: string,
  by: RoomRole | null,
): SeatRefusal | null => {
  if (by === null || !roleCan(by, 'manageSeats')) return { reason: 'not_allowed' };
  const seat = seats.find((candidate) => candidate.id === seatId);
  if (!seat) return { reason: 'not_allowed' };
  if (seat.role !== 'owner') return null;

  const owners = seats.filter(
    (candidate) => candidate.role === 'owner' && candidate.state === 'active',
  );
  return owners.length <= 1 ? { reason: 'last_owner' } : null;
};

/** What the refusal says, in a sentence a person can act on. */
export const seatRefusalText = (refusal: SeatRefusal): string => {
  switch (refusal.reason) {
    case 'already_invited':
      return `${refusal.email} is already in this room.`;
    case 'last_owner':
      return 'A room needs a showrunner. Give the room to someone else first.';
    default:
      return 'Only the showrunner can change who is in the room.';
  }
};

// ------------------------------------------------------- what you land on

/**
 * What a room says to the person who has just signed in (§5).
 *
 * **Signing in does not open the software; it opens the room.** One page
 * answering one question — *what is my part in this* — with a different answer
 * per role, rather than four pages that would drift apart.
 */
export type LandingSection =
  /** Who else is in the room: names, titles, colours. Everyone sees this. */
  | 'seats'
  /** Asking somebody in, and changing what they are called. */
  | 'invite'
  /** What the room costs, and what another seat would cost. */
  | 'billing';

export interface RoomLanding {
  /** One line saying what this person is here. */
  standing: string;
  /**
   * Which document the editor would open for them, or null where they have no
   * part in this room at all. A Writer opens **their own branch** and never
   * the master — that is §1 stated as a door rather than as a rule.
   */
  opens: 'master' | 'ownBranch' | null;
  sections: readonly LandingSection[];
}

export const landingFor = (
  role: RoomRole | null,
  seat?: Pick<Seat, 'title'> | null,
): RoomLanding => {
  if (role === null) return { standing: 'You are not in this room.', opens: null, sections: [] };

  // The title is what a person calls themselves here; the role is what the
  // room lets them do. Both belong in the sentence, and the title goes first
  // because it is the one they answer to (§6).
  const credit = seat?.title.trim() ? `${seat.title.trim()} · ${ROLE_NAMES[role]}` : ROLE_NAMES[role];

  switch (role) {
    case 'owner':
      return {
        standing: `You are the ${ROLE_NAMES.owner.toLowerCase()}.`,
        opens: 'master',
        sections: ['seats', 'invite', 'billing'],
      };
    case 'writer':
      return { standing: `You are a ${credit} here.`, opens: 'ownBranch', sections: ['seats'] };
    case 'editor':
      return { standing: `You are an ${credit} here.`, opens: 'master', sections: ['seats'] };
    default:
      return { standing: `You are a ${credit} here.`, opens: 'master', sections: ['seats'] };
  }
};

/** What the door says, given what it would open. */
export const OPENS_LABEL: Record<NonNullable<RoomLanding['opens']>, string> = {
  master: 'Open the room’s script',
  ownBranch: 'Open your draft',
};
