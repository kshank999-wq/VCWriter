import { describe, expect, it } from 'vitest';
import {
  deleteRefusal,
  deleteRefusalText,
  deletionNote,
  deletionQuestion,
  fileNameOf,
  projectName,
  projectSize,
  projectsNewestFirst,
  type ProjectEntry,
} from '../index.js';

/**
 * The list of projects, and taking one away (spec §4).
 *
 * Deleting is the one thing in the application that cannot be undone, so it is
 * the one thing that asks — and the question has to name the project, because
 * nobody can answer *are you sure?* about something they cannot see the name
 * of. The other rule worth a test is the refusal: the project you have open is
 * not deletable, because deleting the file under an open document leaves a
 * window whose every save fails.
 */

const entry = (over: Partial<ProjectEntry> = {}): ProjectEntry => ({
  path: '/home/ken/Documents/VC Writer/blackout.vcw',
  title: 'Blackout',
  savedAt: '2026-09-10T10:00:00.000Z',
  sizeBytes: 48_000,
  missing: false,
  ...over,
});

describe('what a project is called in the list', () => {
  it('is its own title', () => {
    expect(projectName(entry())).toBe('Blackout');
  });

  it('falls back to the file’s name, never the whole path', () => {
    expect(projectName(entry({ title: '   ' }))).toBe('blackout.vcw');
    expect(fileNameOf('C:\\Users\\Ken\\Documents\\blackout.vcw')).toBe('blackout.vcw');
  });
});

describe('the order they are offered in', () => {
  it('is newest first, which is how a writer looks for one', () => {
    const older = entry({ path: 'a', title: 'Older', savedAt: '2026-01-01T00:00:00.000Z' });
    const newer = entry({ path: 'b', title: 'Newer', savedAt: '2026-09-01T00:00:00.000Z' });
    expect(projectsNewestFirst([older, newer]).map((one) => one.title)).toEqual(['Newer', 'Older']);
  });

  it('puts the ones with no date last rather than first', () => {
    const dated = entry({ path: 'a', title: 'Dated' });
    const undated = entry({ path: 'b', title: 'Undated', savedAt: null });
    expect(projectsNewestFirst([undated, dated]).map((one) => one.title)).toEqual(['Dated', 'Undated']);
  });
});

describe('the question', () => {
  it('names the project rather than asking about nothing', () => {
    expect(deletionQuestion(entry())).toBe('Delete “Blackout”?');
  });

  it('says where it goes, in the machine’s own word for it', () => {
    expect(deletionNote({ entry: entry(), recoverable: true, binName: 'Recycle Bin' })).toContain('Recycle Bin');
    expect(deletionNote({ entry: entry(), recoverable: true, binName: 'Trash' })).toContain('put back');
  });

  it('does not reassure anybody where nothing can be recovered', () => {
    expect(deletionNote({ entry: entry(), recoverable: false, binName: 'Trash' })).toContain('cannot be recovered');
  });

  it('says plainly when the file has already gone', () => {
    const note = deletionNote({ entry: entry({ missing: true }), recoverable: true, binName: 'Trash' });
    expect(note).toContain('already gone');
    expect(note).toContain('off the list');
  });
});

describe('the one that cannot be deleted', () => {
  it('is the project you have open', () => {
    const refusal = deleteRefusal({ entry: entry(), openPath: entry().path });
    expect(refusal).toEqual({ reason: 'open' });
    expect(deleteRefusalText(refusal!)).toContain('Close it first');
  });

  it('is not any of the others', () => {
    expect(deleteRefusal({ entry: entry(), openPath: '/somewhere/else.vcw' })).toBeNull();
    expect(deleteRefusal({ entry: entry(), openPath: null })).toBeNull();
  });
});

describe('how big it is', () => {
  it('is rounded, because nobody counts bytes', () => {
    expect(projectSize(entry({ sizeBytes: 900 }))).toBe('900 bytes');
    expect(projectSize(entry({ sizeBytes: 48_000 }))).toBe('47 KB');
    expect(projectSize(entry({ sizeBytes: 4_800_000 }))).toBe('4.6 MB');
  });

  it('says what it is rather than a size, for a file that is not there', () => {
    expect(projectSize(entry({ missing: true }))).toBe('missing');
  });
});
