import { describe, expect, it } from 'vitest';
import { assignmentSchema, markupSchema, submissionSchema, workIn, workOf, workWaitingOn } from '../index.js';

/** A writer's work in the room as cards, and where each one stands (addendum 07 §28). */

const T = '2026-11-10T00:00:00.000Z';
const ask = (over: Record<string, unknown> = {}) =>
  assignmentSchema.parse({ id: 'a1', roomId: 'r', assigneeId: 'jo', assignedBy: 'sr', note: 'Tighten the cold open.', createdAt: T, updatedAt: T, ...over });
const sent = (over: Record<string, unknown> = {}) =>
  submissionSchema.parse({ id: 's1', roomId: 'r', versionId: 'v1', authorId: 'jo', createdAt: T, updatedAt: T, ...over });
const marked = (over: Record<string, unknown> = {}) =>
  markupSchema.parse({ id: 'm1', roomId: 'r', versionId: 'v1', authorId: 'sr', recipientId: 'jo', note: 'Shorter.', sentAt: T, createdAt: T, ...over });

describe('cards', () => {
  it('follows an assignment from given out to sent to marked up to done', () => {
    expect(workIn({ assignments: [ask()], submissions: [], markups: [] })[0]!.stage).toBe('assigned');
    expect(workIn({ assignments: [ask({ state: 'in_progress' })], submissions: [], markups: [] })[0]!.stage).toBe('in_progress');

    const returned = sent({ assignmentId: 'a1' });
    const waiting = workIn({ assignments: [ask()], submissions: [returned], markups: [] })[0]!;
    expect(waiting.stage).toBe('sent');
    expect(waiting.submissions).toHaveLength(1);

    const back = workIn({ assignments: [ask()], submissions: [returned], markups: [marked()] })[0]!;
    expect(back.stage).toBe('marked_up');
    expect(back.unseen).toBe(1);

    // Once the markup is dealt with and archived, the card is waiting on the showrunner again.
    expect(workIn({ assignments: [ask()], submissions: [returned], markups: [marked({ archivedAt: T })] })[0]!.stage).toBe('sent');
    expect(workIn({ assignments: [ask({ state: 'done' })], submissions: [returned], markups: [] })[0]!.stage).toBe('done');
    expect(workIn({ assignments: [ask({ state: 'cancelled' })], submissions: [], markups: [] })[0]!.stage).toBe('called_off');
  });

  it('makes work a writer sent on their own a card of its own, in its own kind', () => {
    const items = workIn({ assignments: [ask()], submissions: [sent({ id: 's2', note: 'A new cold open, unasked' })], markups: [] });
    const own = items.find((item) => item.kind === 'own')!;
    expect(own).toMatchObject({ title: 'A new cold open, unasked', ownerId: 'jo', stage: 'sent' });
    expect(items.find((item) => item.kind === 'assignment')!.submissions).toHaveLength(0);
  });

  it('lists a person’s cards and counts what is waiting on them', () => {
    const items = workIn({
      assignments: [ask(), ask({ id: 'a2', assigneeId: 'mara' }), ask({ id: 'a3', state: 'done' })],
      submissions: [],
      markups: [],
    });
    expect(workOf(items, 'jo')).toHaveLength(2);
    expect(workWaitingOn(items, 'jo')).toBe(1);
  });

  it('puts the soonest due first', () => {
    const items = workIn({
      assignments: [ask({ id: 'late', dueOn: '2026-12-01' }), ask({ id: 'soon', dueOn: '2026-11-12' }), ask({ id: 'whenever' })],
      submissions: [],
      markups: [],
    });
    expect(items.map((item) => item.assignment!.id)).toEqual(['soon', 'late', 'whenever']);
  });
});
