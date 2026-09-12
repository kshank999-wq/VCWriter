import { describe, expect, it } from 'vitest';
import {
  branchSchema,
  canPublishMaster,
  deskNote,
  desksIn,
  masterVersion,
  mayReadVersion,
  seatSchema,
  versionSchema,
  windowTitleFor,
  type Branch,
  type Seat,
  type Version,
} from '../index.js';

/**
 * The dashboard, desk by desk (addendum 07 §10, stage 5).
 *
 * The rule worth a test is the one a dashboard is most tempted to break: **a
 * writer's unsubmitted draft is not the showrunner's to read** (§7). Everything
 * else here — the ordering, the notes — is in service of saying that plainly
 * rather than showing a row that looks broken.
 */

const AT = '2026-09-11T00:00:00.000Z';

const seat = (over: Partial<Seat>): Seat =>
  seatSchema.parse({ id: 's', roomId: 'r', email: '', invitedAt: AT, createdAt: AT, updatedAt: AT, ...over });

const KEN = seat({ id: 's0', userId: 'ken', displayName: 'Ken Shank', role: 'owner', state: 'active' });
const JO = seat({ id: 's1', userId: 'jo', displayName: 'Jo Calder', state: 'active' });
const MARA = seat({ id: 's2', userId: 'mara', displayName: 'Mara Okonjo', state: 'active' });
const NEW = seat({ id: 's3', userId: null, email: 'new@example.test', state: 'invited' });
const GONE = seat({ id: 's4', userId: 'gone', displayName: 'Sam Reed', state: 'deactivated' });

const branch = (over: Partial<Branch>): Branch =>
  branchSchema.parse({ id: 'b', roomId: 'r', ownerId: 'x', createdAt: AT, updatedAt: AT, ...over });

const version = (over: Partial<Version>): Version =>
  versionSchema.parse({ id: 'v', roomId: 'r', createdAt: AT, ...over });

const JOS = branch({ id: 'b1', ownerId: 'jo' });
const MARAS = branch({ id: 'b2', ownerId: 'mara' });

const MASTER = version({ id: 'v0', kind: 'master', authorId: 'ken', label: 'Room Pass' });
const JOS_POINT = version({ id: 'v1', branchId: 'b1', authorId: 'jo', label: 'First pass' });
const MARAS_POINT = version({ id: 'v2', branchId: 'b2', authorId: 'mara', label: 'Docks rewrite' });

const room = (viewer: string | null) =>
  desksIn({
    seats: [KEN, JO, MARA, NEW, GONE],
    branches: [JOS, MARAS],
    versions: [MASTER, JOS_POINT, MARAS_POINT],
    viewer: { userId: viewer },
  });

describe('what a version may be opened by', () => {
  it('lets its author read it', () => {
    expect(mayReadVersion(JOS_POINT, { userId: 'jo' })).toBe(true);
  });

  it('does not let the showrunner read somebody else’s unsubmitted point', () => {
    expect(mayReadVersion(JOS_POINT, { userId: 'ken' })).toBe(false);
  });

  it('lets everybody read the master, which is what the room agreed', () => {
    expect(mayReadVersion(MASTER, { userId: 'mara' })).toBe(true);
    expect(mayReadVersion(MASTER, { userId: null })).toBe(true);
  });
});

describe('the room, desk by desk', () => {
  it('keeps the room’s own order rather than sorting by activity', () => {
    expect(room('ken').map((desk) => desk.seat.id)).toEqual(['s0', 's1', 's2', 's3']);
  });

  it('leaves a seat that was taken out of the room off the board', () => {
    expect(room('ken').some((desk) => desk.seat.id === GONE.id)).toBe(false);
  });

  it('shows the showrunner that a writer is working, and nothing of what they wrote', () => {
    const jo = room('ken').find((desk) => desk.seat.id === 's1')!;
    expect(jo.branch?.id).toBe('b1');
    expect(jo.versions).toEqual([]);
    expect(jo.state).toBe('working');
    expect(deskNote(jo)).toContain('theirs until they submit');
  });

  it('shows a writer their own recorded points', () => {
    const mine = room('jo').find((desk) => desk.seat.id === 's1')!;
    expect(mine.mine).toBe(true);
    expect(mine.versions.map((one) => one.id)).toEqual(['v1']);
    expect(mine.state).toBe('readable');
  });

  it('never counts the master as somebody’s desk work', () => {
    const ken = room('ken').find((desk) => desk.seat.id === 's0')!;
    expect(ken.versions).toEqual([]);
    expect(masterVersion([MASTER, JOS_POINT])?.id).toBe('v0');
  });

  it('says what an unanswered invitation is, rather than showing an empty desk', () => {
    const waiting = room('ken').find((desk) => desk.seat.id === 's3')!;
    expect(waiting.state).toBe('invited');
    expect(deskNote(waiting)).toContain('accept');
  });

  it('says a writer has not started when they have no line at all', () => {
    const desks = desksIn({ seats: [JO], branches: [], versions: [], viewer: { userId: 'ken' } });
    expect(desks[0]!.state).toBe('no_line');
    expect(deskNote(desks[0]!)).toContain('Jo Calder');
  });
});

describe('a window says whose it is', () => {
  it('names the writer before the point, which is what the reader is choosing between', () => {
    expect(windowTitleFor({ version: JOS_POINT, author: JO })).toBe('Jo Calder — First pass');
  });

  it('calls the master the master', () => {
    expect(windowTitleFor({ version: MASTER, author: KEN })).toContain('The master');
  });

  it('says so rather than guessing when the room does not know the author', () => {
    expect(windowTitleFor({ version: JOS_POINT, author: null })).toContain('Unattributed');
  });
});

describe('who may declare the room’s master', () => {
  it('is the showrunner, and not a writer or an editor', () => {
    expect(canPublishMaster('owner')).toBe(true);
    expect(canPublishMaster('writer')).toBe(false);
    expect(canPublishMaster('editor')).toBe(false);
    expect(canPublishMaster(null)).toBe(false);
  });
});
