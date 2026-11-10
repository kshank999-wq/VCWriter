import { z } from 'zod';
import { mayEmail, type Notice } from './notify.js';
import { seatName, type Seat } from './room.js';

/**
 * Permission requests, and the room's audit trail (addendum 07 §32; workflow
 * spec v1.1 §7, §11 flow C, §13).
 *
 * Material in the master is the showrunner's to change. A writer who wants to
 * revise something already integrated asks, saying what and why; the
 * showrunner grants or denies. **A grant never opens the master**: it gives
 * the writer a new task on that material, whose result is sent, reviewed and
 * integrated like any other. A denial changes nothing.
 */

export const PERMISSION_STATES = ['pending', 'granted', 'denied', 'withdrawn'] as const;
export const permissionStateSchema = z.enum(PERMISSION_STATES);
export type PermissionState = (typeof PERMISSION_STATES)[number];

export const PERMISSION_STATE_NAMES: Record<PermissionState, string> = {
  pending: 'Waiting for the showrunner',
  granted: 'Granted — a new task was made',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
};

export const permissionRequestSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  requesterId: z.string(),
  beatId: z.string().nullable().default(null),
  targetLabel: z.string().default(''),
  assignmentId: z.string().nullable().default(null),
  reason: z.string(),
  proposed: z.string().default(''),
  state: permissionStateSchema.default('pending'),
  decidedBy: z.string().nullable().default(null),
  decidedAt: z.string().nullable().default(null),
  decisionNote: z.string().default(''),
  grantedAssignmentId: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type PermissionRequest = z.infer<typeof permissionRequestSchema>;

export type PermissionRefusal = { reason: 'needs_reason' } | { reason: 'already_asked' } | { reason: 'answered' };

export const permissionRefusalText = (refusal: PermissionRefusal): string => {
  switch (refusal.reason) {
    case 'needs_reason':
      return 'Say what you want to change and why.';
    case 'already_asked':
      return 'You have already asked about this; the showrunner has not answered yet.';
    case 'answered':
      return 'This request has already been answered.';
  }
};

/** Whether this writer may ask about this material now. */
export const mayAskPermission = (
  requests: readonly PermissionRequest[],
  input: { requesterId: string; assignmentId: string | null; beatId: string | null; reason: string },
): true | PermissionRefusal => {
  if (!input.reason.trim()) return { reason: 'needs_reason' };
  const open = requests.some(
    (one) =>
      one.requesterId === input.requesterId &&
      one.state === 'pending' &&
      ((input.assignmentId && one.assignmentId === input.assignmentId) || (input.beatId && one.beatId === input.beatId)),
  );
  return open ? { reason: 'already_asked' } : true;
};

/** Requests waiting on the showrunner, oldest first (a queue). */
export const pendingRequests = (requests: readonly PermissionRequest[]): PermissionRequest[] =>
  requests.filter((one) => one.state === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/** The task a grant makes: about the same material, saying what was asked. */
export const grantedTaskNote = (request: PermissionRequest): string =>
  `Revise integrated material${request.targetLabel ? ` (${request.targetLabel})` : ''}: ${request.reason.trim()}${
    request.proposed.trim() ? `\nProposed: ${request.proposed.trim()}` : ''
  }`;

/** Tell the showrunner a request has come in, or the writer how it was answered. */
export const noticeForPermission = (input: {
  request: PermissionRequest;
  seats: readonly Seat[];
  roomName: string;
  /** Who it is going to: the showrunner on asking, the writer on an answer. */
  toUserId: string;
  actorId: string;
}): Notice | null => {
  const { request } = input;
  if (input.toUserId === input.actorId) return null;
  const seat = input.seats.find((one) => one.userId === input.toUserId) ?? null;
  if (!seat || !mayEmail(seat)) return null;
  const actor = input.seats.find((one) => one.userId === input.actorId);
  const who = actor ? seatName(actor) : 'The showrunner';
  const what = request.targetLabel || 'integrated material';
  const asking = request.state === 'pending';
  return {
    kind: 'permission',
    to: seat,
    subject: asking ? `${who} asks to revise ${what} — ${input.roomName}` : `Your request to revise ${what} was ${request.state} — ${input.roomName}`,
    line: asking
      ? `${who} asks permission to revise ${what}.`
      : request.state === 'granted'
        ? `${who} granted your request to revise ${what}. A new task is waiting for you.`
        : `${who} denied your request to revise ${what}.`,
    said: asking ? request.reason.trim() : request.decisionNote.trim(),
    path: `/rooms/${request.roomId}?view=tasks&section=permissions`,
  };
};

// ----------------------------------------------------------- the audit trail

export const AUDIT_ENTITIES = ['assignment', 'submission', 'master', 'permission_request', 'markup'] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const auditEventSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  actorId: z.string().nullable().default(null),
  entityType: z.enum(AUDIT_ENTITIES),
  entityId: z.string().nullable().default(null),
  action: z.string(),
  fromState: z.string().nullable().default(null),
  toState: z.string().nullable().default(null),
  note: z.string().default(''),
  createdAt: z.string(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

const ACTION_WORDS: Record<string, string> = {
  assigned: 'assigned it',
  moved: 'moved it',
  submitted: 'sent a version',
  decided: 'decided on a version',
  integrated: 'integrated it into the master',
  asked: 'asked permission to revise it',
  granted: 'granted the request',
  denied: 'denied the request',
  withdrawn: 'withdrew the request',
  marked_up: 'marked it up',
};

/** One line of the trail: who did what, from where to where. */
export const describeAuditEvent = (event: AuditEvent, nameOf: (userId: string | null) => string): string => {
  const did = ACTION_WORDS[event.action] ?? event.action.replace(/_/g, ' ');
  const states = event.fromState || event.toState ? ` (${event.fromState ?? '—'} → ${event.toState ?? '—'})` : '';
  return `${nameOf(event.actorId)} ${did}${states}${event.note ? `: ${event.note}` : ''}`;
};
