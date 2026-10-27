import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { captureItemSchema, type CaptureItem } from '../entities/capture.js';
import { FROM_THE_PHONE, isArchived, phoneNoteGroups, transferNotes } from '../capture-transfer.js';
import { researchCategoriesInOrder } from '../selectors.js';
import { newId, type CaptureItemId, type UserId } from '../ids.js';

/**
 * Bringing the phone's notes over by hand (addendum 27 §25, from Ken: *if the
 * projects don't match perfectly, it's not going to really work automatically
 * transferring… You can select the project and it will sync and transfer those.
 * Once they're transferred, those notes need to go into an archive*).
 */

const PHONE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const OPEN = '33333333-3333-4333-8333-333333333333';

const note = (overrides: Partial<CaptureItem> = {}): CaptureItem =>
  captureItemSchema.parse({
    id: newId<CaptureItemId>(),
    userId: newId<UserId>(),
    source: 'mobile_voice',
    capturedAt: '2026-10-27T10:00:00.000Z',
    rawText: 'The bridge is out.',
    createdAt: '2026-10-27T10:00:00.000Z',
    updatedAt: '2026-10-27T10:00:00.000Z',
    ...overrides,
  });

describe('the phone’s notes, by the project they were said in', () => {
  it('groups what is waiting, names each by its phone project, and leaves out the open project and filed notes', () => {
    const notes = [
      note({ projectId: PHONE as never }),
      note({ projectId: PHONE as never }),
      note({ projectId: OTHER as never }),
      note({ projectId: null }),
      note({ projectId: PHONE as never, status: 'approved' }),
      note({ projectId: OPEN as never }),
    ];
    const groups = phoneNoteGroups(notes, [{ id: PHONE, title: 'Blackout (phone)' }], OPEN);
    expect(groups.map((one) => [one.title, one.notes.length])).toEqual([
      ['Blackout (phone)', 2],
      ['A project no longer on your account', 1],
      ['No project chosen', 1],
    ]);
  });
});

describe('transferring a group', () => {
  it('files each note where its suggestion goes, and marks them filed', () => {
    const file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    const notes = [note({ category: 'idea', rawText: 'A blackout across the city.' }), note({ category: 'unit', subjectName: 'The Bridge', rawText: 'Night. Rain.' })];
    const done = transferNotes(file, notes);
    expect(done.filed.map((one) => one.status)).toEqual(['approved', 'approved']);
    expect(done.filed.every(isArchived)).toBe(true);
    expect(done.file.researchItems.length - file.researchItems.length).toBe(2);
  });

  it('files a note with nowhere suggested into a From the phone folder, made once', () => {
    const bare = { ...createProjectFile({ title: 'Blackout', format: 'screenplay' }), researchCategories: [] };
    const done = transferNotes(bare, [note({ rawText: 'One.' }), note({ rawText: 'Two.' })]);
    const folders = researchCategoriesInOrder(done.file).filter((one) => one.name === FROM_THE_PHONE);
    expect(folders).toHaveLength(1);
    expect(done.file.researchItems.filter((item) => item.categoryId === folders[0]!.id).map((item) => item.body)).toEqual(['One.', 'Two.']);
  });

  it('skips a note already filed', () => {
    const file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    const done = transferNotes(file, [note({ category: 'idea', status: 'approved' })]);
    expect(done.filed).toHaveLength(0);
    expect(done.file).toBe(file);
  });
});
