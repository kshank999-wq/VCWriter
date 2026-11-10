import { describe, expect, it } from 'vitest';
import {
  auditEventSchema,
  describeAuditEvent,
  grantedTaskNote,
  mayAskPermission,
  noticeForPermission,
  pendingRequests,
  permissionRequestSchema,
  seatSchema,
} from '../index.js';

/** Permission requests and the audit trail (addendum 07 §32; workflow spec v1.1 §7, §13). */

const T = '2026-11-10T00:00:00.000Z';
const ask = (over: Record<string, unknown> = {}) =>
  permissionRequestSchema.parse({
    id: 'p1',
    roomId: 'r',
    requesterId: 'jo',
    beatId: 'b3',
    targetLabel: 'Beat — The letter',
    assignmentId: 'a1',
    reason: 'The floorboard line contradicts scene 20.',
    createdAt: T,
    ...over,
  });
const seat = (userId: string, name: string) =>
  seatSchema.parse({ id: `s-${userId}`, roomId: 'r', userId, email: `${userId}@x`, displayName: name, state: 'active', invitedAt: T, createdAt: T, updatedAt: T });

describe('asking', () => {
  it('needs a reason, and one open request per thing', () => {
    expect(mayAskPermission([], { requesterId: 'jo', assignmentId: 'a1', beatId: 'b3', reason: '  ' })).toEqual({ reason: 'needs_reason' });
    expect(mayAskPermission([ask()], { requesterId: 'jo', assignmentId: 'a1', beatId: 'b3', reason: 'Again' })).toEqual({ reason: 'already_asked' });
    expect(mayAskPermission([ask({ state: 'denied' })], { requesterId: 'jo', assignmentId: 'a1', beatId: 'b3', reason: 'Again' })).toBe(true);
    expect(mayAskPermission([ask()], { requesterId: 'mara', assignmentId: 'a1', beatId: 'b3', reason: 'Mine' })).toBe(true);
  });

  it('queues what is waiting, oldest first', () => {
    const list = [ask({ id: 'new', createdAt: '2026-11-11T00:00:00.000Z' }), ask({ id: 'old' }), ask({ id: 'done', state: 'granted' })];
    expect(pendingRequests(list).map((one) => one.id)).toEqual(['old', 'new']);
  });

  it('gives the granted task the reason and the proposal', () => {
    expect(grantedTaskNote(ask({ proposed: 'She burns it instead.' }))).toBe(
      'Revise integrated material (Beat — The letter): The floorboard line contradicts scene 20.\nProposed: She burns it instead.',
    );
  });
});

describe('telling people', () => {
  const seats = [seat('jo', 'Jo Smith'), seat('sr', 'Ken Shank')];

  it('tells the showrunner a request came in, and the writer how it was answered', () => {
    const asked = noticeForPermission({ request: ask(), seats, roomName: 'Room', toUserId: 'sr', actorId: 'jo' })!;
    expect(asked.line).toBe('Jo Smith asks permission to revise Beat — The letter.');
    expect(asked.path).toBe('/rooms/r?view=tasks&section=permissions');
    const granted = noticeForPermission({ request: ask({ state: 'granted' }), seats, roomName: 'Room', toUserId: 'jo', actorId: 'sr' })!;
    expect(granted.line).toContain('A new task is waiting for you');
  });

  it('never tells somebody about their own act', () => {
    expect(noticeForPermission({ request: ask(), seats, roomName: 'Room', toUserId: 'jo', actorId: 'jo' })).toBeNull();
  });
});

describe('the trail', () => {
  it('says who did what, from where to where', () => {
    const event = auditEventSchema.parse({
      id: 'e1',
      roomId: 'r',
      actorId: 'sr',
      entityType: 'submission',
      entityId: 's1',
      action: 'decided',
      fromState: 'submitted',
      toState: 'revision_requested',
      note: 'Shorter.',
      createdAt: T,
    });
    expect(describeAuditEvent(event, (id) => (id === 'sr' ? 'Ken Shank' : '?'))).toBe(
      'Ken Shank decided on a version (submitted → revision_requested): Shorter.',
    );
  });
});
