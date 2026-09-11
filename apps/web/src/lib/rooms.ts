import { randomBytes, createHash } from 'node:crypto';
import {
  canDeactivate,
  canInvite,
  proposeColour,
  roomRoleFor,
  seatCount,
  seatSchema,
  roomSchema,
  type Room,
  type RoomRole,
  type Seat,
  type SeatCount,
  type SeatRefusal,
} from '@vcwriter/domain';
import { adminClient, serverClient } from './supabase';

/**
 * Writers Room: the data layer (addendum 07, stage 1).
 *
 * The rules live in `@vcwriter/domain/room`; this is the only place they meet
 * Supabase rows. Two things about it are decisions rather than plumbing.
 *
 * **Reading acts as the visitor; changing the room acts as the server.** A
 * member reads the room through their own session, so row-level security is
 * what decides what comes back — §16: the interface is never what decides
 * access. But inviting somebody writes a row *for a person who is not the
 * caller*, and an invitation token must never be readable by the room, so
 * those go through the service role after the domain has said the caller is
 * allowed.
 *
 * **A token is stored hashed.** The room's database is not where a working
 * invitation link should be recoverable from, any more than a password is: the
 * email carries the secret and this keeps only enough to recognise it.
 */

interface RoomRow {
  id: string;
  project_id: string;
  name: string;
  included_seats: number;
  created_at: string;
  updated_at: string;
}

interface SeatRow {
  id: string;
  room_id: string;
  user_id: string | null;
  email: string;
  role: RoomRole;
  title: string;
  display_name: string;
  initials: string;
  colour: string;
  state: Seat['state'];
  invited_at: string;
  accepted_at: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

const roomFromRow = (row: RoomRow): Room =>
  roomSchema.parse({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    includedSeats: row.included_seats,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

const seatFromRow = (row: SeatRow): Seat =>
  seatSchema.parse({
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    email: row.email,
    role: row.role,
    title: row.title,
    displayName: row.display_name,
    initials: row.initials,
    colour: row.colour,
    state: row.state,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
    deactivatedAt: row.deactivated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export interface RoomView {
  room: Room;
  seats: Seat[];
  /** The project's owner, who is the showrunner whether or not they hold a seat. */
  projectOwnerId: string;
  /** What the person asking may do here, or null if they are not in the room. */
  role: RoomRole | null;
  seats_count: SeatCount;
}

/**
 * The room, as the person asking is allowed to see it.
 *
 * Read through the visitor's own session: a stranger gets nothing back because
 * the database says so, not because this function checked.
 */
export const loadRoom = async (projectId: string): Promise<RoomView | null> => {
  const db = serverClient();
  const { data: auth } = await db.auth.getUser();
  const userId = auth.user?.id ?? null;

  const { data: roomRow } = await db.from('rooms').select('*').eq('project_id', projectId).maybeSingle();
  if (!roomRow) return null;

  const { data: project } = await db.from('projects').select('owner_id').eq('id', projectId).maybeSingle();
  const { data: seatRows } = await db.from('room_seats').select('*').eq('room_id', (roomRow as RoomRow).id);

  const room = roomFromRow(roomRow as RoomRow);
  const seats = ((seatRows ?? []) as SeatRow[]).map(seatFromRow);
  const projectOwnerId = (project as { owner_id: string } | null)?.owner_id ?? '';

  return {
    room,
    seats,
    projectOwnerId,
    role: roomRoleFor(seats, userId, projectOwnerId),
    seats_count: seatCount(room, seats),
  };
};

/** A room over a project its owner already has. One per project. */
export const createRoom = async (input: {
  projectId: string;
  name: string;
  includedSeats?: number;
}): Promise<Room> => {
  const db = adminClient();
  const { data, error } = await db
    .from('rooms')
    .insert({
      project_id: input.projectId,
      name: input.name,
      included_seats: input.includedSeats ?? 1,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return roomFromRow(data as RoomRow);
};

// --------------------------------------------------------------- invitations

/**
 * The secret that goes in the email, and the fingerprint that stays here.
 *
 * 32 bytes because an invitation is a bearer credential for the length of its
 * life, and a short one is a thing to be guessed at rather than a thing to be
 * sent.
 */
const newToken = (): { token: string; digest: string } => {
  const token = randomBytes(32).toString('base64url');
  return { token, digest: createHash('sha256').update(token).digest('hex') };
};

export const INVITE_DAYS = 14;

export interface Invitation {
  seat: Seat;
  /** The only time this is ever readable. It goes in the email and nowhere else. */
  token: string;
  expiresAt: string;
}

/**
 * Ask somebody into the room.
 *
 * The domain decides whether the invitation is allowed — the caller's role,
 * and whether this address already has a standing seat — and the service role
 * writes it, because the row is about a person who is not the one asking.
 */
export const inviteSeat = async (input: {
  room: Room;
  seats: readonly Seat[];
  by: RoomRole | null;
  email: string;
  role: RoomRole;
  title?: string;
  displayName?: string;
}): Promise<Invitation | SeatRefusal> => {
  const refusal = canInvite(input.seats, input.email, input.by);
  if (refusal) return refusal;

  const db = adminClient();
  const { token, digest } = newToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();

  const { data, error } = await db
    .from('room_seats')
    .insert({
      room_id: input.room.id,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      title: input.title ?? '',
      display_name: input.displayName ?? '',
      // The room proposes one so that nobody has to think about it to start;
      // the showrunner can overrule it afterwards (§6).
      colour: proposeColour(input.seats),
      state: 'invited',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const seat = seatFromRow(data as SeatRow);
  const stored = await db
    .from('room_invitations')
    .insert({ seat_id: seat.id, token: digest, expires_at: expiresAt });
  if (stored.error) throw new Error(stored.error.message);

  return { seat, token, expiresAt };
};

/**
 * Take up an invitation.
 *
 * Matched on the fingerprint rather than the secret, and refused once it has
 * expired. Accepting is what turns an invitation into a seat the room bills
 * for (§14), which is why it is the moment `user_id` is finally written.
 */
export const acceptInvitation = async (input: {
  token: string;
  userId: string;
}): Promise<Seat | { reason: 'no_such_invitation' | 'expired' }> => {
  const db = adminClient();
  const digest = createHash('sha256').update(input.token).digest('hex');

  const { data: invitation } = await db
    .from('room_invitations')
    .select('seat_id, expires_at')
    .eq('token', digest)
    .maybeSingle();
  if (!invitation) return { reason: 'no_such_invitation' };

  const { seat_id: seatId, expires_at: expiresAt } = invitation as { seat_id: string; expires_at: string };
  if (new Date(expiresAt).getTime() < Date.now()) return { reason: 'expired' };

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('room_seats')
    .update({ user_id: input.userId, state: 'active', accepted_at: now })
    .eq('id', seatId)
    .eq('state', 'invited')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { reason: 'no_such_invitation' };

  // Spent. The link is not a way back in afterwards.
  await db.from('room_invitations').delete().eq('seat_id', seatId);
  return seatFromRow(data as SeatRow);
};

// -------------------------------------------------------- managing a seat

/** The showrunner's to set: what somebody is called, credited as, and drawn in. */
export const setSeatIdentity = async (input: {
  seats: readonly Seat[];
  by: RoomRole | null;
  seatId: string;
  displayName?: string;
  title?: string;
  colour?: string;
  initials?: string;
  role?: RoomRole;
}): Promise<Seat | SeatRefusal> => {
  if (input.by === null || input.by !== 'owner') return { reason: 'not_allowed' };

  const patch: Record<string, unknown> = {};
  if (input.displayName !== undefined) patch['display_name'] = input.displayName;
  if (input.title !== undefined) patch['title'] = input.title;
  if (input.colour !== undefined) patch['colour'] = input.colour;
  if (input.initials !== undefined) patch['initials'] = input.initials;
  if (input.role !== undefined) patch['role'] = input.role;

  const { data, error } = await adminClient()
    .from('room_seats')
    .update(patch)
    .eq('id', input.seatId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return seatFromRow(data as SeatRow);
};

/**
 * Take a seat out of the room.
 *
 * **Deactivating, never deleting** (§16). The row stays, so everything that
 * seat ever wrote keeps its author, and the room stops paying for it (§14).
 */
export const deactivateSeat = async (input: {
  seats: readonly Seat[];
  by: RoomRole | null;
  seatId: string;
}): Promise<Seat | SeatRefusal> => {
  const refusal = canDeactivate(input.seats, input.seatId, input.by);
  if (refusal) return refusal;

  const db = adminClient();
  const { data, error } = await db
    .from('room_seats')
    .update({ state: 'deactivated', deactivated_at: new Date().toISOString() })
    .eq('id', input.seatId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  // An invitation nobody took up stops working when the seat goes.
  await db.from('room_invitations').delete().eq('seat_id', input.seatId);
  return seatFromRow(data as SeatRow);
};
