import { describe, expect, it } from 'vitest';
import {
  branchFor,
  branchNameFor,
  branchRefusalText,
  branchSchema,
  canOpenBranch,
  describeVersion,
  isUnchangedSince,
  masterVersion,
  versionChain,
  versionSchema,
  versionsOn,
  type Branch,
  type Version,
} from '../index.js';

/**
 * Branches and versions (addendum 07, stage 3).
 *
 * The distinction worth testing is **the desk is not the record**: a head is
 * rewritten forty times an afternoon and a version is made when somebody
 * decides a point has been reached, and the two must never be confused for one
 * another. After that, the chain — because a history that sorts by time is a
 * history that gets a restored version in the wrong place.
 */

const AT = (day: number): string => `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`;

const branch = (over: Partial<Branch> = {}): Branch =>
  branchSchema.parse({
    id: 'branch-1',
    roomId: 'room-1',
    ownerId: 'jo',
    createdAt: AT(1),
    updatedAt: AT(1),
    ...over,
  });

const version = (over: Partial<Version> = {}): Version =>
  versionSchema.parse({
    id: 'v1',
    roomId: 'room-1',
    branchId: 'branch-1',
    authorId: 'jo',
    createdAt: AT(1),
    ...over,
  });

describe('who gets a working line', () => {
  it('gives one to a writer and to the showrunner', () => {
    expect(canOpenBranch('writer')).toBeNull();
    expect(canOpenBranch('owner')).toBeNull();
  });

  it('gives none to an editor or a viewer, who are not writing the script', () => {
    expect(canOpenBranch('editor')?.reason).toBe('cannot_write');
    expect(canOpenBranch('viewer')?.reason).toBe('cannot_write');
  });

  it('tells the two refusals apart, because they are different answers', () => {
    expect(canOpenBranch(null)?.reason).toBe('no_seat');
    expect(branchRefusalText({ reason: 'no_seat' })).toBe('You are not in this room.');
    expect(branchRefusalText({ reason: 'cannot_write' })).toContain('read and comment');
  });

  it('finds the branch a person has, and none for anybody else', () => {
    const branches = [branch({ id: 'a', ownerId: 'jo' }), branch({ id: 'b', ownerId: 'mara' })];
    expect(branchFor(branches, 'mara')?.id).toBe('b');
    expect(branchFor(branches, 'sam')).toBeNull();
    expect(branchFor(branches, null)).toBeNull();
  });

  it('names a draft after whoever is writing it', () => {
    expect(branchNameFor('Jo Calder')).toBe('Jo Calder’s draft');
    expect(branchNameFor('   ')).toBe('A draft');
  });
});

describe('the history', () => {
  it('follows parents rather than sorting by time', () => {
    // Made out of order on purpose: a restored version is stamped now and its
    // parent is whatever it was taken from, so time is not the chain.
    const versions = [
      version({ id: 'c', parentVersionId: 'a', createdAt: AT(9) }),
      version({ id: 'a', parentVersionId: null, createdAt: AT(1) }),
      version({ id: 'b', parentVersionId: 'a', createdAt: AT(5) }),
    ];
    expect(versionChain(versions, 'c').map((entry) => entry.id)).toEqual(['c', 'a']);
    expect(versionChain(versions, 'b').map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('stops rather than spinning if a chain ever pointed at itself', () => {
    const versions = [version({ id: 'a', parentVersionId: 'b' }), version({ id: 'b', parentVersionId: 'a' })];
    expect(versionChain(versions, 'a').length).toBeLessThanOrEqual(versions.length + 1);
  });

  it('answers nothing for a version that is not there', () => {
    expect(versionChain([], 'missing')).toEqual([]);
    expect(versionChain([], null)).toEqual([]);
  });

  it('lists a branch’s own versions, newest first', () => {
    const versions = [
      version({ id: 'a', createdAt: AT(1) }),
      version({ id: 'b', createdAt: AT(9) }),
      version({ id: 'c', branchId: 'other', createdAt: AT(5) }),
    ];
    expect(versionsOn(versions, 'branch-1').map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('finds the room’s master, and says so when there is none', () => {
    expect(masterVersion([version({ id: 'a' })])).toBeNull();
    const withMaster = [
      version({ id: 'a', kind: 'master', createdAt: AT(1) }),
      version({ id: 'b', kind: 'master', createdAt: AT(9) }),
      version({ id: 'c', kind: 'snapshot', createdAt: AT(20) }),
    ];
    expect(masterVersion(withMaster)?.id).toBe('b');
  });
});

describe('what a version is called', () => {
  it('uses the name the writer gave it', () => {
    expect(describeVersion(version({ label: 'Network Notes' }))).toBe('Network Notes');
  });

  it('says what kind it is and when, rather than an id nobody can recognise', () => {
    const said = describeVersion(version({ label: '', kind: 'master' }));
    expect(said).toContain('Master');
    expect(said).not.toContain('v1');
  });

  it('survives a timestamp it cannot read', () => {
    expect(describeVersion(version({ label: '', createdAt: 'not a date' }))).toContain('not a date');
  });
});

describe('recording a point nobody has reached', () => {
  it('says a draft is unchanged when it hashes the same', () => {
    expect(isUnchangedSince(version({ contentHash: 'abc' }), 'abc')).toBe(true);
    expect(isUnchangedSince(version({ contentHash: 'abc' }), 'def')).toBe(false);
  });

  it('does not claim a match against a version with no hash on it', () => {
    expect(isUnchangedSince(version({ contentHash: '' }), '')).toBe(false);
    expect(isUnchangedSince(null, 'abc')).toBe(false);
  });
});
