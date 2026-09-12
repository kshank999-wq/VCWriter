import { describe, expect, it } from 'vitest';
import {
  canMove,
  canReview,
  canSubmit,
  describeSubmission,
  isDecided,
  isOpen,
  nextStates,
  queueOf,
  seatSchema,
  standingOf,
  submissionSchema,
  submitRefusalText,
  submitterName,
  versionSchema,
  waitingCount,
  type Seat,
  type Submission,
  type SubmissionState,
  type Version,
} from '../index.js';

/**
 * Submitting, and the queue (addendum 07 §10, stage 6).
 *
 * The rules worth testing are the ones §1 turns on. **Nothing is deleted by a
 * state**: rejected is a state, and a rejected submission is still there,
 * still pointing at a version that still exists. And **a decision can be
 * unmade** — a showrunner who rejected the wrong scene at midnight should not
 * have to ask the writer to send it again.
 */

const AT = '2026-09-11T00:00:00.000Z';

const seat = (over: Partial<Seat>): Seat =>
  seatSchema.parse({ id: 's', roomId: 'r', email: '', invitedAt: AT, createdAt: AT, updatedAt: AT, ...over });

const JO = seat({ id: 's1', userId: 'jo', displayName: 'Jo Calder' });
const MARA = seat({ id: 's2', userId: 'mara', displayName: 'Mara Okonjo' });

const version = (id: string): Version =>
  versionSchema.parse({ id, roomId: 'r', kind: 'submission', createdAt: AT });

const sent = (over: Partial<Submission> = {}): Submission =>
  submissionSchema.parse({
    id: 'sub-1',
    roomId: 'r',
    versionId: 'v1',
    authorId: 'jo',
    createdAt: AT,
    updatedAt: AT,
    ...over,
  });

describe('who may send work for review', () => {
  it('is a writer, and an editor, who proposes through the same door', () => {
    expect(canSubmit('writer')).toBe(true);
    expect(canSubmit('editor')).toBe(true);
    expect(canSubmit('owner')).toBe(true);
  });

  it('is not a viewer, who is here to read', () => {
    expect(canSubmit('viewer')).toBe(false);
    expect(canSubmit(null)).toBe(false);
    expect(submitRefusalText({ reason: 'cannot_submit' })).toContain('not to send work');
  });

  it('leaves deciding to the showrunner', () => {
    expect(canReview('owner')).toBe(true);
    expect(canReview('writer')).toBe(false);
    expect(canReview('editor')).toBe(false);
  });
});

describe('where a submission can go from where it is', () => {
  it('goes out for review and comes back decided', () => {
    expect(canMove('submitted', 'in_review')).toBe(true);
    expect(canMove('in_review', 'approved')).toBe(true);
    expect(canMove('in_review', 'rejected')).toBe(true);
  });

  it('lets a decision be unmade, which is the point of §1', () => {
    expect(canMove('rejected', 'in_review')).toBe(true);
    expect(canMove('approved', 'revision_requested')).toBe(true);
  });

  it('takes another pass back into the queue', () => {
    expect(canMove('revision_requested', 'submitted')).toBe(true);
  });

  it('closes only one door, and closes it for a reason', () => {
    // Incorporated means the master carries it; unsaying that is a change to
    // the master, not to this row.
    expect(nextStates('incorporated')).toEqual([]);
    expect(canMove('incorporated', 'rejected')).toBe(false);
  });

  it('never invents a move that was not written down', () => {
    expect(canMove('draft', 'approved')).toBe(false);
    expect(canMove('submitted', 'incorporated')).toBe(false);
  });
});

describe('what is still waiting', () => {
  const states: SubmissionState[] = ['draft', 'submitted', 'in_review'];

  it('is anything nobody has decided on', () => {
    for (const state of states) expect(isOpen(sent({ state }))).toBe(true);
    expect(isDecided(sent({ state: 'approved' }))).toBe(true);
    expect(isOpen(sent({ state: 'approved' }))).toBe(false);
  });

  it('is the number a dashboard shows', () => {
    const queue = [sent({ id: 'a' }), sent({ id: 'b', state: 'rejected' }), sent({ id: 'c', kind: 'research' })];
    expect(waitingCount(queue)).toBe(2);
    expect(waitingCount(queue, 'script')).toBe(1);
    expect(waitingCount(queue, 'research')).toBe(1);
  });
});

describe('the queue', () => {
  const older = sent({ id: 'a', createdAt: '2026-09-01T00:00:00.000Z', authorId: 'jo', note: 'The warehouse' });
  const newer = sent({ id: 'b', createdAt: '2026-09-09T00:00:00.000Z', authorId: 'mara', versionId: 'v2' });
  const research = sent({ id: 'c', createdAt: '2026-09-05T00:00:00.000Z', kind: 'research', authorId: 'mara' });

  const queue = (over: Parameters<typeof queueOf>[0] extends infer T ? Partial<T> : never = {}) =>
    queueOf({
      submissions: [newer, older, research],
      seats: [JO, MARA],
      versions: [version('v1'), version('v2')],
      ...over,
    });

  it('is oldest first, because that is who has waited longest', () => {
    expect(queue().map((row) => row.submission.id)).toEqual(['a', 'c', 'b']);
  });

  it('carries the seat, so the colour is read through the room', () => {
    expect(submitterName(queue()[0]!)).toBe('Jo Calder');
  });

  it('says so rather than guessing when the sender has left the room', () => {
    const gone = queueOf({ submissions: [older], seats: [], versions: [] });
    expect(submitterName(gone[0]!)).toContain('no longer in the room');
  });

  it('can be asked for one kind, which is what the two destinations are', () => {
    expect(queue({ kind: 'research' }).map((row) => row.submission.id)).toEqual(['c']);
  });

  it('can be asked for only what is still waiting', () => {
    const decided = queueOf({
      submissions: [older, sent({ id: 'z', state: 'rejected' })],
      seats: [JO],
      versions: [],
      openOnly: true,
    });
    expect(decided.map((row) => row.submission.id)).toEqual(['a']);
  });

  it('hands back the version it references, never a copy of the work', () => {
    expect(queue()[0]?.version?.id).toBe('v1');
  });
});

describe('what each of them says', () => {
  it('reads back the writer’s own note, which is what they wanted read', () => {
    expect(describeSubmission(sent({ note: '  The docks rewrite  ' }))).toBe('The docks rewrite');
  });

  it('says what kind of thing it is where nobody said anything', () => {
    expect(describeSubmission(sent())).toBe('A pass on the script');
    expect(describeSubmission(sent({ kind: 'research' }))).toBe('Research and ideas');
  });

  it('tells the writer where it stands, in their terms and not the database’s', () => {
    expect(standingOf(sent({ state: 'submitted' }))).toBe('Waiting to be read.');
    expect(standingOf(sent({ state: 'revision_requested' }))).toContain('draft is untouched');
    // §1: nothing in this vocabulary means gone.
    expect(standingOf(sent({ state: 'rejected' }))).toContain('Nothing has been deleted');
  });
});
