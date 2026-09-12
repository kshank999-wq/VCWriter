import { describe, expect, it } from 'vitest';
import {
  ROOM_COLOURS,
  activityIn,
  bodyOf,
  canComment,
  canEdit,
  canResolve,
  commentRefusalText,
  commentSchema,
  describeTarget,
  mentionFor,
  mentionsIn,
  newsFor,
  newsLine,
  openThreadsOn,
  askTitle,
  seatSchema,
  threadsIn,
  whereSaid,
  type Comment,
  type Seat,
} from '../index.js';

/**
 * Comments, mentions, what is new, and the activity trail (addendum 07 §14 and
 * §9, stage 10).
 *
 * Two claims carry the file. **A comment is speech about the work, not the
 * work** — so it can be corrected and never deleted, and a withdrawn one still
 * leaves the thread readable. And **the trail is a reading, not a second
 * recording** — every event in it comes off a record that already existed, so
 * there is nothing to drift.
 */

const AT = '2026-09-12T00:00:00.000Z';
const later = (n: number) => `2026-09-${String(12 + n).padStart(2, '0')}T00:00:00.000Z`;

const seat = (over: Partial<Seat>): Seat =>
  seatSchema.parse({ id: 's', roomId: 'r', email: '', invitedAt: AT, createdAt: AT, updatedAt: AT, ...over });

const JO = seat({ id: 's1', userId: 'jo', email: 'jo.calder@example.com', displayName: 'Jo Calder', initials: 'JC', colour: ROOM_COLOURS[1], state: 'active', acceptedAt: AT });
const MARA = seat({ id: 's2', userId: 'mara', email: 'm@example.com', displayName: 'Mara Oyelaran', initials: 'MO', state: 'active', acceptedAt: later(1) });
const JOSEPH = seat({ id: 's3', userId: 'joseph', email: 'j@example.com', displayName: 'Jo', initials: 'J', state: 'active' });
const GONE = seat({ id: 's4', userId: 'alex', email: 'a@example.com', displayName: 'Alex Byrne', state: 'deactivated', acceptedAt: AT, deactivatedAt: later(3) });

const said = (over: Partial<Comment>): Comment =>
  commentSchema.parse({ id: 'c1', roomId: 'r', authorId: 'jo', createdAt: AT, updatedAt: AT, ...over });

describe('who may speak', () => {
  it('is everybody but a viewer, who is here to read', () => {
    expect(canComment('owner')).toBe(true);
    expect(canComment('writer')).toBe(true);
    expect(canComment('editor')).toBe(true);
    expect(canComment('viewer')).toBe(false);
    expect(commentRefusalText({ reason: 'cannot_comment' })).toContain('to read');
  });

  it('lets whoever started a thread settle it, and whoever runs the room', () => {
    const thread = said({ authorId: 'jo' });
    expect(canResolve(thread, { userId: 'jo', role: 'writer' })).toBe(true);
    expect(canResolve(thread, { userId: 'ken', role: 'owner' })).toBe(true);
    // Not everybody: a thread closed by whoever was losing the argument is
    // worse than an open one.
    expect(canResolve(thread, { userId: 'mara', role: 'writer' })).toBe(false);
  });

  it('lets only the person who said it change what it says', () => {
    expect(canEdit(said({ authorId: 'jo' }), 'jo')).toBe(true);
    expect(canEdit(said({ authorId: 'jo' }), 'ken')).toBe(false);
  });
});

describe('mentions', () => {
  it('takes the longest name first, so Jo Calder beats Jo', () => {
    expect(mentionsIn('ask @Jo Calder about the docks', [JO, JOSEPH])).toEqual(['jo']);
    expect(mentionsIn('ask @Jo about the docks', [JO, JOSEPH])).toEqual(['joseph']);
  });

  it('matches initials and the front of an email, because people type what they have', () => {
    expect(mentionsIn('@MO what do you think', [JO, MARA])).toEqual(['mara']);
    expect(mentionsIn('@jo.calder can you take it', [JO, MARA])).toEqual(['jo']);
  });

  it('names somebody the room has lost, because that is attribution not address', () => {
    expect(mentionsIn('this was @Alex Byrne’s idea', [GONE])).toEqual(['alex']);
  });

  it('names nobody where nobody is named', () => {
    expect(mentionsIn('the docks are too long', [JO, MARA])).toEqual([]);
    expect(mentionFor(JO)).toBe('@Jo Calder');
  });
});

describe('threads', () => {
  const comments = [
    said({ id: 't1', targetKind: 'scene', targetId: 'u1', targetLabel: 'INT. DOCKS', body: 'Too long.' }),
    said({ id: 'r1', parentId: 't1', authorId: 'mara', body: 'Agreed.', createdAt: later(1) }),
    said({ id: 'r2', parentId: 't1', authorId: 'jo', body: 'Cutting it.', createdAt: later(2) }),
    said({ id: 't2', targetKind: 'room', body: 'Notes area.', createdAt: later(1) }),
    said({ id: 't3', targetKind: 'scene', targetId: 'u1', state: 'resolved', body: 'Done.', createdAt: AT }),
  ];

  it('is one level deep, with the replies oldest first inside it', () => {
    const [first] = threadsIn({ comments, seats: [JO, MARA] });
    expect(first!.comment.id).toBe('t1');
    expect(first!.replies.map((one) => one.comment.id)).toEqual(['r1', 'r2']);
    expect(first!.lastAt).toBe(later(2));
  });

  it('is most recently spoken in first, which is not the same as newest', () => {
    // t1 was said first and answered last, so it is at the top.
    expect(threadsIn({ comments, seats: [JO, MARA] }).map((one) => one.comment.id)).toEqual([
      't1',
      't2',
      't3',
    ]);
  });

  it('narrows to one record, and can leave the settled ones out', () => {
    expect(
      threadsIn({ comments, seats: [JO], target: { kind: 'scene', id: 'u1' } }).map((one) => one.comment.id),
    ).toEqual(['t1', 't3']);
    expect(
      threadsIn({ comments, seats: [JO], target: { kind: 'scene', id: 'u1' }, openOnly: true }).map(
        (one) => one.comment.id,
      ),
    ).toEqual(['t1']);
  });

  it('counts what is open on a record, for a badge beside it', () => {
    expect(openThreadsOn(comments, { kind: 'scene', id: 'u1' })).toBe(1);
    expect(openThreadsOn(comments, { kind: 'scene', id: 'nowhere' })).toBe(0);
  });

  it('says what a thread is about', () => {
    expect(describeTarget(comments[0]!)).toBe('Scene — INT. DOCKS');
    expect(describeTarget(comments[3]!)).toBe('The room');
  });
});

describe('a comment is never deleted', () => {
  it('reads as withdrawn rather than leaving a hole in the thread', () => {
    const taken = said({ state: 'withdrawn', body: 'Something regretted.' });
    expect(bodyOf(taken)).toBe('Withdrawn by the person who said it.');
    expect(bodyOf(said({ body: 'Still here.' }))).toBe('Still here.');
  });

  it('keeps a withdrawn thread that was answered, and drops one that was not', () => {
    // The line: a thread stays readable where there *is* a thread. Nobody
    // answered the second one, so there is no conversation to keep — and an
    // empty "withdrawn by the person who said it" is clutter, not record.
    const comments = [
      said({ id: 'kept', state: 'withdrawn' }),
      said({ id: 'reply', parentId: 'kept', authorId: 'mara', body: 'But wait.', createdAt: later(1) }),
      said({ id: 'dropped', state: 'withdrawn' }),
    ];
    expect(threadsIn({ comments, seats: [JO, MARA] }).map((one) => one.comment.id)).toEqual(['kept']);
  });
});

describe('how a room reads in a sentence', () => {
  it('says *in* the room and *on* a scene, because English does', () => {
    expect(whereSaid(said({}))).toBe('in the room');
    expect(whereSaid(said({ targetKind: 'scene', targetId: 'u1', targetLabel: 'INT. DOCKS' }))).toBe(
      'on scene — int. docks',
    );
  });

  it('names an ask without dragging its note and its full stop along', () => {
    const ask = {
      id: 'a1', roomId: 'r', assigneeId: 'mara', assignedBy: 'ken',
      targetKind: 'act' as const, targetId: 'x', targetLabel: 'Act Two',
      note: 'Find where it turns.', dueOn: null, state: 'assigned' as const,
      createdAt: AT, updatedAt: AT,
    };
    expect(askTitle(ask)).toBe('Act — Act Two');
    // With nothing to point at, the task itself — and not ending in two stops.
    expect(askTitle({ ...ask, targetKind: null, targetId: null, targetLabel: '' })).toBe('Find where it turns');
  });
});

describe('what is new', () => {
  const comments = [
    said({ id: 't1', authorId: 'jo', body: 'Too long.' }),
    said({ id: 'r1', parentId: 't1', authorId: 'mara', body: 'Agreed.', createdAt: later(1) }),
    said({ id: 't2', authorId: 'mara', body: 'ask @Jo Calder', mentions: ['jo'], createdAt: later(2) }),
    said({ id: 'r2', parentId: 't1', authorId: 'jo', body: 'Mine.', createdAt: later(3) }),
  ];

  it('is a mention of you, and an answer in a thread you are in', () => {
    const news = newsFor({ comments, userId: 'jo', since: null });
    expect(news.map((one) => [one.kind, one.comment.id])).toEqual([
      ['mention', 't2'],
      ['reply', 'r1'],
    ]);
  });

  it('never counts your own words as news to you', () => {
    expect(newsFor({ comments, userId: 'jo', since: null }).some((one) => one.comment.authorId === 'jo')).toBe(
      false,
    );
  });

  it('stops at when they last looked', () => {
    expect(newsFor({ comments, userId: 'jo', since: later(1) }).map((one) => one.comment.id)).toEqual(['t2']);
  });

  it('says it in a sentence', () => {
    const [first] = newsFor({ comments, userId: 'jo', since: null });
    expect(newsLine(first!, [JO, MARA])).toContain('Mara Oyelaran named you');
  });
});

describe('the activity trail is a reading, not a second recording', () => {
  it('reads seats, versions, submissions, assignments and comments into one order', () => {
    const events = activityIn({
      seats: [JO, MARA, GONE],
      versions: [
        { id: 'v1', roomId: 'r', branchId: 'b1', authorId: 'jo', parentVersionId: null, kind: 'snapshot', label: 'First pass', summary: '', contentHash: 'h', createdAt: later(2) },
        { id: 'v2', roomId: 'r', branchId: null, authorId: 'ken', parentVersionId: 'v1', kind: 'master', label: 'Room Pass', summary: '', contentHash: 'h', createdAt: later(4) },
      ],
      submissions: [
        { id: 'sub1', roomId: 'r', branchId: 'b1', versionId: 'v1', authorId: 'jo', kind: 'script', state: 'approved', note: 'The docks', reply: '', decidedBy: 'ken', decidedAt: later(3), createdAt: later(2), updatedAt: later(3) },
      ],
      assignments: [
        { id: 'a1', roomId: 'r', assigneeId: 'mara', assignedBy: 'ken', targetKind: null, targetId: null, targetLabel: '', note: 'Write the cold open', dueOn: null, state: 'assigned', createdAt: AT, updatedAt: AT },
      ],
      comments: [said({ id: 'c1', authorId: 'mara', body: 'Good.', createdAt: later(5) })],
    });

    // Newest first: a history answers "what changed since I looked".
    expect(events[0]!.kind).toBe('said');
    expect(events.map((one) => one.kind)).toContain('master');
    expect(events.map((one) => one.kind)).toContain('decided');
    expect(events.map((one) => one.kind)).toContain('joined');
    expect(events.map((one) => one.kind)).toContain('left');
    // §16: a seat taken out keeps what it wrote, and the trail says so.
    expect(events.find((one) => one.kind === 'left')!.line).toContain('still theirs');
  });

  it('does not report an assignment nobody has touched as having moved', () => {
    const events = activityIn({
      seats: [MARA],
      versions: [],
      submissions: [],
      assignments: [
        { id: 'a1', roomId: 'r', assigneeId: 'mara', assignedBy: 'ken', targetKind: null, targetId: null, targetLabel: '', note: 'Cold open', dueOn: null, state: 'assigned', createdAt: AT, updatedAt: AT },
      ],
      comments: [],
    });
    expect(events.filter((one) => one.kind === 'assignment_moved')).toHaveLength(0);
  });

  it('leaves a withdrawn comment out of the trail, having already said so in the thread', () => {
    const events = activityIn({
      seats: [JO],
      versions: [],
      submissions: [],
      assignments: [],
      comments: [said({ state: 'withdrawn' })],
    });
    expect(events.filter((one) => one.kind === 'said')).toHaveLength(0);
  });

  it('can be narrowed to what happened since somebody last looked', () => {
    const events = activityIn({
      seats: [],
      versions: [],
      submissions: [],
      assignments: [],
      comments: [
        said({ id: 'a', createdAt: AT }),
        said({ id: 'b', createdAt: later(4) }),
      ],
      since: later(2),
    });
    expect(events).toHaveLength(1);
  });
});
