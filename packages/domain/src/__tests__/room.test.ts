import { describe, expect, it } from 'vitest';
import {
  ROOM_ACTIONS,
  ROOM_COLOURS,
  canDeactivate,
  canInvite,
  describeSeats,
  mayInRoom,
  proposeColour,
  roleAtLeast,
  roleCan,
  roomRoleFor,
  seatCount,
  seatInitials,
  seatName,
  seatRefusalText,
  seatSchema,
  type RoomRole,
  type Seat,
} from '../index.js';

/**
 * Writers Room, stage 1: rooms, seats, and what a seat may do (addendum 07).
 *
 * The two distinctions the module hangs off are the ones worth testing —
 * **role is not title** and **invited is not active** — because both of them
 * are the kind of thing that gets quietly collapsed into one field later.
 */

const AT = '2026-09-11T00:00:00.000Z';

const seat = (over: Partial<Seat> = {}): Seat =>
  seatSchema.parse({
    id: over.id ?? 'seat-1',
    roomId: 'room-1',
    email: 'jo@example.test',
    invitedAt: AT,
    createdAt: AT,
    updatedAt: AT,
    ...over,
  });

const OWNER = 'user-owner';

describe('what a role may do', () => {
  it('gives the showrunner everything', () => {
    for (const action of ROOM_ACTIONS) expect(roleCan('owner', action)).toBe(true);
  });

  it('lets a writer write and submit, and curate nothing', () => {
    expect(roleCan('writer', 'writeOwnBranch')).toBe(true);
    expect(roleCan('writer', 'submit')).toBe(true);
    expect(roleCan('writer', 'curate')).toBe(false);
    expect(roleCan('writer', 'manageSeats')).toBe(false);
  });

  it('lets an editor propose without letting them write', () => {
    expect(roleCan('editor', 'propose')).toBe(true);
    expect(roleCan('editor', 'comment')).toBe(true);
    expect(roleCan('editor', 'writeOwnBranch')).toBe(false);
  });

  it('lets a viewer read and nothing else', () => {
    const allowed = ROOM_ACTIONS.filter((action) => roleCan('viewer', action));
    expect(allowed).toEqual(['read']);
  });

  it('does not let an editor read every contribution *and* curate one', () => {
    // The two are separate rights on purpose: reviewing is not deciding.
    expect(roleCan('editor', 'readAllContributions')).toBe(true);
    expect(roleCan('editor', 'curate')).toBe(false);
  });

  it('orders the roles by reach', () => {
    expect(roleAtLeast('owner', 'viewer')).toBe(true);
    expect(roleAtLeast('viewer', 'writer')).toBe(false);
    expect(roleAtLeast('writer', 'writer')).toBe(true);
  });
});

describe('who is in the room', () => {
  it('makes the project’s owner the showrunner whether or not anyone gave them a seat', () => {
    expect(roomRoleFor([], OWNER, OWNER)).toBe<RoomRole>('owner');
    expect(mayInRoom([], OWNER, OWNER, 'manageSeats')).toBe(true);
  });

  it('answers nothing at all for somebody with no seat', () => {
    expect(roomRoleFor([], 'stranger', OWNER)).toBeNull();
    expect(mayInRoom([], 'stranger', OWNER, 'read')).toBe(false);
  });

  it('ignores a seat that has been deactivated', () => {
    const gone = seat({ userId: 'jo', state: 'deactivated', role: 'writer' });
    expect(roomRoleFor([gone], 'jo', OWNER)).toBeNull();
  });

  it('ignores an invitation nobody has taken up', () => {
    const asked = seat({ userId: null, state: 'invited', role: 'writer' });
    expect(roomRoleFor([asked], 'jo', OWNER)).toBeNull();
  });
});

describe('the letters in the corner of the page', () => {
  it('takes the first and last of a name', () => {
    expect(seatInitials(seat({ displayName: 'Jo Calder' }))).toBe('JC');
    expect(seatInitials(seat({ displayName: 'Mara Beth Kessler' }))).toBe('MK');
  });

  it('takes two from a single name', () => {
    expect(seatInitials(seat({ displayName: 'Prince' }))).toBe('PR');
  });

  it('falls back to the address it was asked at', () => {
    expect(seatInitials(seat({ displayName: '', email: 'jo.calder@example.test' }))).toBe('JC');
  });

  it('lets the writer say what their own signature is', () => {
    expect(seatInitials(seat({ displayName: 'Jo Calder', initials: 'J.C.' }))).toBe('J.C.');
  });

  it('says nothing rather than guessing at punctuation', () => {
    expect(seatInitials(seat({ displayName: '—', email: '@example.test' }))).toBe('');
  });

  it('calls a seat by its name, or by the address if it has none yet', () => {
    expect(seatName(seat({ displayName: 'Jo Calder' }))).toBe('Jo Calder');
    expect(seatName(seat({ displayName: '  ' }))).toBe('jo@example.test');
  });
});

describe('the colour a room proposes', () => {
  it('gives the first one to an empty room', () => {
    expect(proposeColour([])).toBe(ROOM_COLOURS[0]);
  });

  it('does not offer a colour somebody is already using', () => {
    const used = ROOM_COLOURS.slice(0, 3).map((colour, index) =>
      seat({ id: `s${index}`, colour, state: 'active' }),
    );
    expect(proposeColour(used)).toBe(ROOM_COLOURS[3]);
  });

  it('offers a colour back once the seat using it has gone', () => {
    const left = [seat({ colour: ROOM_COLOURS[0], state: 'deactivated' })];
    expect(proposeColour(left)).toBe(ROOM_COLOURS[0]);
  });

  it('ignores how a colour was capitalised', () => {
    const shouted = [seat({ colour: ROOM_COLOURS[0]!.toUpperCase(), state: 'active' })];
    expect(proposeColour(shouted)).toBe(ROOM_COLOURS[1]);
  });
});

describe('what the room bills for', () => {
  const room = { includedSeats: 2 };

  it('does not bill for an invitation nobody has answered', () => {
    const seats = [
      seat({ id: 'a', state: 'active' }),
      seat({ id: 'b', state: 'invited' }),
      seat({ id: 'c', state: 'invited' }),
    ];
    const count = seatCount(room, seats);
    expect(count.active).toBe(1);
    expect(count.invited).toBe(2);
    expect(count.billable).toBe(0);
  });

  it('bills for the active seats past what the plan covers', () => {
    const seats = ['a', 'b', 'c', 'd'].map((id) => seat({ id, state: 'active' }));
    expect(seatCount(room, seats).billable).toBe(2);
  });

  it('stops billing for someone who has left, and keeps their seat', () => {
    const seats = [
      seat({ id: 'a', state: 'active' }),
      seat({ id: 'b', state: 'active' }),
      seat({ id: 'c', state: 'deactivated' }),
    ];
    const count = seatCount(room, seats);
    expect(count.billable).toBe(0);
    expect(count.deactivated).toBe(1);
  });

  it('says it in a line', () => {
    expect(describeSeats(seatCount(room, [seat({ id: 'a', state: 'active' })]))).toBe(
      '1 in the room · within the plan',
    );
    expect(
      describeSeats(seatCount(room, ['a', 'b', 'c'].map((id) => seat({ id, state: 'active' })))),
    ).toBe('3 in the room · 1 extra');
  });
});

describe('changing who is in the room', () => {
  it('lets only the showrunner invite', () => {
    expect(canInvite([], 'new@example.test', 'owner')).toBeNull();
    expect(canInvite([], 'new@example.test', 'writer')?.reason).toBe('not_allowed');
    expect(canInvite([], 'new@example.test', null)?.reason).toBe('not_allowed');
  });

  it('refuses an address that is already in the room', () => {
    const seats = [seat({ email: 'jo@example.test', state: 'active' })];
    expect(canInvite(seats, 'JO@example.test', 'owner')?.reason).toBe('already_invited');
  });

  it('lets somebody who left be asked back', () => {
    const seats = [seat({ email: 'jo@example.test', state: 'deactivated' })];
    expect(canInvite(seats, 'jo@example.test', 'owner')).toBeNull();
  });

  it('will not take the last showrunner out of the room', () => {
    const seats = [
      seat({ id: 'a', role: 'owner', state: 'active' }),
      seat({ id: 'b', role: 'writer', state: 'active' }),
    ];
    expect(canDeactivate(seats, 'a', 'owner')?.reason).toBe('last_owner');
    expect(canDeactivate(seats, 'b', 'owner')).toBeNull();
  });

  it('takes one of two showrunners out without complaint', () => {
    const seats = ['a', 'b'].map((id) => seat({ id, role: 'owner', state: 'active' }));
    expect(canDeactivate(seats, 'a', 'owner')).toBeNull();
  });

  it('says why, in a sentence somebody can act on', () => {
    expect(seatRefusalText({ reason: 'last_owner' })).toContain('needs a showrunner');
    expect(seatRefusalText({ reason: 'already_invited', email: 'jo@example.test' })).toContain(
      'jo@example.test',
    );
  });
});
