import { describe, expect, it } from 'vitest';
import {
  ASSIGNEE_STATES,
  addBeat,
  addResearchItem,
  addUnit,
  assigneeMaySet,
  assigneeName,
  askedOf,
  assignRefusalText,
  assignableThings,
  assignmentSchema,
  assignmentsFor,
  assignmentsOn,
  canAssign,
  canMakeAssignment,
  canMoveAssignment,
  createProjectFile,
  describeAssignment,
  isOverdue,
  isOwed,
  labelFor,
  nextAssignmentStates,
  owedBySeat,
  owedNote,
  seatSchema,
  type Assignment,
  type Seat,
} from '../index.js';

/**
 * Assignments (addendum 07 §8, stage 8).
 *
 * The rule worth a test of its own: **an assignment is not a lock.** Nothing
 * here refuses anybody anything on the strength of who a scene is assigned to,
 * and the words the writer is shown say so out loud, because a room where two
 * writers took a run at the same scene is a room working properly.
 */

const AT = '2026-09-12T00:00:00.000Z';
const TODAY = '2026-09-12';

const seat = (over: Partial<Seat>): Seat =>
  seatSchema.parse({ id: 's', roomId: 'r', email: '', invitedAt: AT, createdAt: AT, updatedAt: AT, ...over });

const JO = seat({ id: 's1', userId: 'jo', displayName: 'Jo Calder', state: 'active' });
const MARA = seat({ id: 's2', userId: 'mara', displayName: 'Mara Oyelaran', state: 'active' });
const GONE = seat({ id: 's3', userId: 'alex', displayName: 'Alex Byrne', state: 'deactivated' });
const WAITING = seat({ id: 's4', userId: 'sam', email: 'sam@example.com', state: 'invited' });

const made = (over: Partial<Assignment> = {}): Assignment =>
  assignmentSchema.parse({ id: 'a1', roomId: 'r', assigneeId: 'jo', createdAt: AT, updatedAt: AT, ...over });

describe('who may give out work', () => {
  it('is the showrunner’s, and says so rather than hiding the menu', () => {
    expect(canAssign('owner')).toBe(true);
    expect(canAssign('writer')).toBe(false);
    expect(canAssign('editor')).toBe(false);
    expect(canAssign(null)).toBe(false);
    expect(assignRefusalText({ reason: 'cannot_assign' })).toContain('showrunner');
  });

  it('refuses somebody who is not in the room, and somebody taken out of it', () => {
    const base = { role: 'owner' as const, seats: [JO, GONE], targetKind: 'scene' as const, note: '' };
    expect(canMakeAssignment({ ...base, assigneeId: 'nobody' })).toEqual({ reason: 'no_such_seat' });
    expect(canMakeAssignment({ ...base, assigneeId: 'alex' })).toEqual({ reason: 'seat_gone' });
  });

  it('allows a seat that has not answered its invitation yet', () => {
    // Giving somebody work before they arrive is how a room actually runs.
    expect(
      canMakeAssignment({ role: 'owner', seats: [WAITING], assigneeId: 'sam', targetKind: 'scene', note: '' }),
    ).toBe(true);
  });

  it('refuses an assignment that points at nothing and says nothing', () => {
    const base = { role: 'owner' as const, seats: [JO], assigneeId: 'jo' };
    expect(canMakeAssignment({ ...base, targetKind: null, note: '   ' })).toEqual({ reason: 'nothing_asked' });
    // …but a task with no target and a note is the thing Ken asked for.
    expect(canMakeAssignment({ ...base, targetKind: null, note: 'Write the cold open' })).toBe(true);
  });
});

describe('the states', () => {
  it('has no one-way door — a room changes its mind', () => {
    for (const from of ['assigned', 'accepted', 'in_progress', 'done', 'cancelled'] as const) {
      expect(nextAssignmentStates(from).length).toBeGreaterThan(0);
    }
    expect(canMoveAssignment('done', 'in_progress')).toBe(true);
    expect(canMoveAssignment('cancelled', 'assigned')).toBe(true);
  });

  it('lets a writer say how their own work is going, and not call it off', () => {
    expect(ASSIGNEE_STATES).toEqual(['accepted', 'in_progress', 'done']);
    expect(assigneeMaySet('done')).toBe(true);
    expect(assigneeMaySet('cancelled')).toBe(false);
  });

  it('counts what is still owed, and what is late', () => {
    expect(isOwed(made({ state: 'in_progress' }))).toBe(true);
    expect(isOwed(made({ state: 'done' }))).toBe(false);
    expect(isOwed(made({ state: 'cancelled' }))).toBe(false);

    expect(isOverdue(made({ dueOn: '2026-09-10' }), TODAY)).toBe(true);
    expect(isOverdue(made({ dueOn: '2026-09-20' }), TODAY)).toBe(false);
    // Done is never late, whatever the date said.
    expect(isOverdue(made({ dueOn: '2026-09-10', state: 'done' }), TODAY)).toBe(false);
    expect(isOverdue(made({ dueOn: null }), TODAY)).toBe(false);
  });

  it('tells the writer it is not a lock', () => {
    expect(askedOf(made({ state: 'assigned' }))).toContain('anybody can write it');
    expect(askedOf(made({ state: 'cancelled' }))).toContain('still here');
  });
});

describe('what a room is shown', () => {
  it('gives a writer their own asks, newest first', () => {
    const list = [
      made({ id: 'old', createdAt: '2026-09-01T00:00:00.000Z' }),
      made({ id: 'new', createdAt: '2026-09-11T00:00:00.000Z' }),
      made({ id: 'theirs', assigneeId: 'mara' }),
    ];
    expect(assignmentsFor(list, 'jo').map((one) => one.id)).toEqual(['new', 'old']);
  });

  it('finds what is on a record, and leaves the called-off out of it', () => {
    const list = [
      made({ id: 'x', targetKind: 'scene', targetId: 'u1' }),
      made({ id: 'y', targetKind: 'scene', targetId: 'u1', state: 'cancelled' }),
      made({ id: 'z', targetKind: 'beat', targetId: 'u1' }),
    ];
    expect(assignmentsOn(list, { kind: 'scene', id: 'u1' }).map((one) => one.id)).toEqual(['x']);
  });

  it('lists every active seat, including whoever is free', () => {
    const rows = owedBySeat({
      assignments: [made({ assigneeId: 'jo' }), made({ id: 'a2', assigneeId: 'jo', dueOn: '2026-09-01' })],
      seats: [JO, MARA, GONE],
      today: TODAY,
    });
    expect(rows.map((row) => row.seat.id)).toEqual(['s1', 's2']);
    expect(owedNote(rows[0]!)).toBe('2 things outstanding, 1 past its date.');
    expect(owedNote(rows[1]!)).toBe('Nothing outstanding.');
  });

  it('reads a row after the person has gone, because the row is not theirs to take', () => {
    expect(assigneeName(made({ assigneeId: 'ghost' }), [JO])).toContain('no longer in the room');
    expect(assigneeName(made({ assigneeId: 'jo' }), [JO])).toBe('Jo Calder');
  });

  it('describes the ask: the record, the note, or both', () => {
    expect(describeAssignment(made({ targetKind: 'scene', targetLabel: 'INT. DOCKS' })))
      .toBe('Scene — INT. DOCKS');
    expect(describeAssignment(made({ targetKind: 'scene', targetLabel: 'INT. DOCKS', note: 'Shorter' })))
      .toBe('Scene — INT. DOCKS: Shorter');
    expect(describeAssignment(made({ note: 'Write the cold open' }))).toBe('Write the cold open');
    expect(describeAssignment(made())).toContain('nothing said');
  });
});

describe('what the menu can point at', () => {
  it('reads acts, scenes, beats and research out of the project itself', () => {
    let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    file = { ...file, units: [], beats: [] };
    const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. WAREHOUSE - NIGHT' });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'Mara enters' });
    const ideas = beat.file.researchCategories.find((one) => one.systemKey === 'ideas')!;
    file = addResearchItem(beat.file, { categoryId: ideas.id, title: 'The case is empty' });

    const things = assignableThings(file);
    expect(things.filter((one) => one.kind === 'scene').map((one) => one.label)).toEqual([
      'INT. WAREHOUSE - NIGHT',
    ]);
    expect(things.filter((one) => one.kind === 'beat').map((one) => one.label)).toEqual(['Mara enters']);
    expect(things.filter((one) => one.kind === 'research').map((one) => one.label)).toEqual([
      'The case is empty',
    ]);

    expect(labelFor(file, { kind: 'scene', id: scene.unit.id as string })).toBe('INT. WAREHOUSE - NIGHT');
    expect(labelFor(file, { kind: 'scene', id: 'nowhere' })).toBe('');
  });

  it('keeps the label it was given, so a renamed scene does not erase the ask', () => {
    // The label is copied onto the row at the time, deliberately: a writer who
    // cannot see the scene still needs the row to read.
    const one = made({ targetKind: 'scene', targetId: 'u1', targetLabel: 'INT. DOCKS - NIGHT' });
    expect(describeAssignment(one)).toContain('INT. DOCKS - NIGHT');
  });
});
