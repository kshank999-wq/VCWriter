import { describe, expect, it } from 'vitest';
import {
  commentSchema,
  assignmentSchema,
  mayEmail,
  noticeForAssignment,
  noticeForDecision,
  noticesForComment,
  seatSchema,
  submissionSchema,
  type Assignment,
  type Comment,
  type Seat,
  type Submission,
} from '../index.js';

/**
 * Email notification (addendum 07 §14, stage 14).
 *
 * The whole design is one sentence — **the room notifies; email interrupts, so
 * email carries only what was addressed to you** — and most of these hold the
 * refusals that follow from it. A test suite for a notifier is mostly a list of
 * things it must not send.
 */

const seat = (over: Partial<Seat> = {}): Seat =>
  seatSchema.parse({
    id: crypto.randomUUID(),
    roomId: 'room',
    userId: 'mara',
    email: 'mara@example.com',
    role: 'writer',
    displayName: 'Mara',
    state: 'active',
    invitedAt: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  });

const SEATS: Seat[] = [
  seat(),
  seat({ userId: 'sal', email: 'sal@example.com', displayName: 'Sal', role: 'owner' }),
];

const comment = (over: Partial<Comment> = {}): Comment =>
  commentSchema.parse({
    id: crypto.randomUUID(),
    roomId: 'room',
    parentId: null,
    authorId: 'sal',
    targetKind: 'room',
    targetId: null,
    targetLabel: '',
    body: 'Mara — can the diner be at night?',
    mentions: ['mara'],
    state: 'open',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    ...over,
  });

const assignment = (over: Partial<Assignment> = {}): Assignment =>
  assignmentSchema.parse({
    id: crypto.randomUUID(),
    roomId: 'room',
    assigneeId: 'mara',
    assignedBy: 'sal',
    targetKind: 'scene',
    targetId: crypto.randomUUID(),
    targetLabel: 'INT. DINER - NIGHT',
    note: '',
    dueOn: '2026-09-20',
    state: 'assigned',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    ...over,
  });

const submission = (over: Partial<Submission> = {}): Submission =>
  submissionSchema.parse({
    id: crypto.randomUUID(),
    roomId: 'room',
    branchId: null,
    versionId: crypto.randomUUID(),
    authorId: 'mara',
    kind: 'script',
    state: 'approved',
    note: 'The diner, second pass',
    reply: 'This is the one.',
    decidedBy: 'sal',
    decidedAt: '2026-09-14T12:00:00.000Z',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T12:00:00.000Z',
    ...over,
  });

const forComment = (one: Comment, seats: readonly Seat[] = SEATS) =>
  noticesForComment({ comment: one, seats, roomName: 'Blackout' });

describe('who the room may write to', () => {
  it('writes to an active seat that has not turned it off', () => {
    expect(mayEmail(seat())).toBe(true);
  });

  it('does not write to a seat that has not accepted', () => {
    // They cannot read the room, so mail about its work would be the one way
    // into it that does not go through RLS.
    expect(mayEmail(seat({ state: 'invited' }))).toBe(false);
  });

  it('does not write to a seat taken out of the room', () => {
    // Their contributions stay (§16); their inbox is not part of the room.
    expect(mayEmail(seat({ state: 'deactivated' }))).toBe(false);
  });

  it('does not write to somebody who said not to', () => {
    expect(mayEmail(seat({ notifyByEmail: false }))).toBe(false);
  });

  it('does not write to an address that is not one', () => {
    expect(mayEmail(seat({ email: '  ' }))).toBe(false);
  });
});

describe('being named', () => {
  it('writes to whoever was named, and says what was said', () => {
    // Speech travels: a mention you have to click to read one sentence is a
    // notification that wastes a click.
    const [notice] = forComment(comment());
    expect(notice?.kind).toBe('mention');
    expect(notice?.to.userId).toBe('mara');
    expect(notice?.said).toContain('can the diner be at night');
    expect(notice?.subject).toContain('Blackout');
  });

  it('never writes to you about your own comment', () => {
    expect(forComment(comment({ authorId: 'mara', mentions: ['mara'] }))).toEqual([]);
  });

  it('says nothing about a withdrawn comment', () => {
    expect(forComment(comment({ state: 'withdrawn' }))).toEqual([]);
  });

  it('does not write about a reply, only about being named', () => {
    // A reply is news in the room and is not an interruption: a busy thread
    // would send a writer twenty emails in an afternoon, and the second one is
    // already being ignored.
    expect(forComment(comment({ mentions: [], parentId: crypto.randomUUID() }))).toEqual([]);
  });

  it('does not write to somebody who is not in the room', () => {
    expect(forComment(comment({ mentions: ['a-stranger'] }))).toEqual([]);
  });

  it('shortens a long one rather than mailing a wall', () => {
    const long = comment({ body: 'x'.repeat(2000) });
    const [notice] = forComment(long);
    expect(notice!.said.length).toBeLessThan(700);
    expect(notice!.said.endsWith('…')).toBe(true);
  });
});

describe('being asked for something', () => {
  it('writes to the person it is being asked of, with the date', () => {
    const notice = noticeForAssignment({ assignment: assignment(), seats: SEATS, roomName: 'Blackout' });
    expect(notice?.kind).toBe('assigned');
    expect(notice?.to.userId).toBe('mara');
    expect(notice?.line).toContain('INT. DINER - NIGHT');
    expect(notice?.line).toContain('2026-09-20');
  });

  it('says nothing when somebody gives themselves work', () => {
    expect(
      noticeForAssignment({
        assignment: assignment({ assigneeId: 'sal', assignedBy: 'sal' }),
        seats: SEATS,
        roomName: 'Blackout',
      }),
    ).toBeNull();
  });

  it('says nothing to somebody who has turned it off', () => {
    const quiet = [seat({ notifyByEmail: false }), SEATS[1]!];
    expect(
      noticeForAssignment({ assignment: assignment(), seats: quiet, roomName: 'Blackout' }),
    ).toBeNull();
  });
});

describe('a decision on your own work', () => {
  it('writes to the writer, and carries the reply', () => {
    // A rejection whose reason is one click away is a rejection read without
    // its reason.
    const notice = noticeForDecision({ submission: submission(), seats: SEATS, roomName: 'Blackout' });
    expect(notice?.kind).toBe('decided');
    expect(notice?.to.userId).toBe('mara');
    expect(notice?.line).toContain('approved');
    expect(notice?.said).toBe('This is the one.');
  });

  it('says nothing about a submission nobody has decided', () => {
    expect(
      noticeForDecision({
        submission: submission({ state: 'submitted', decidedAt: null, decidedBy: null }),
        seats: SEATS,
        roomName: 'Blackout',
      }),
    ).toBeNull();
  });

  it('says nothing when the showrunner decides their own', () => {
    expect(
      noticeForDecision({
        submission: submission({ authorId: 'sal', decidedBy: 'sal' }),
        seats: SEATS,
        roomName: 'Blackout',
      }),
    ).toBeNull();
  });

  it('says nothing to a writer who has left the room', () => {
    const gone = [seat({ state: 'deactivated' }), SEATS[1]!];
    expect(
      noticeForDecision({ submission: submission(), seats: gone, roomName: 'Blackout' }),
    ).toBeNull();
  });
});

describe('what never goes in an email', () => {
  it('carries no manuscript, only the room’s own sentence and what was said', () => {
    // Mail is not a place anybody agreed to put the script. A notice has four
    // pieces of text and none of them can hold a draft: the subject, the line,
    // the path, and — for speech only — what was said.
    const notices = [
      ...forComment(comment()),
      noticeForAssignment({ assignment: assignment(), seats: SEATS, roomName: 'Blackout' })!,
      noticeForDecision({ submission: submission(), seats: SEATS, roomName: 'Blackout' })!,
    ];

    for (const notice of notices) {
      expect(Object.keys(notice).sort()).toEqual(['kind', 'line', 'path', 'said', 'subject', 'to']);
      expect(notice.path).toBe('/rooms/room');
    }
  });
});
