import { describe, expect, it } from 'vitest';
import {
  captureUploadBatchSchema,
  captureUploadSchema,
  mayStillEdit,
  uploadToRow,
} from '../capture-upload.js';

/**
 * The upload contract (addendum 09 §6, stage 2).
 *
 * **The shape is the permission.** A capture row carries fields that belong to
 * the desktop, and the phone has no business setting any of them — so rather
 * than checking that on the way in, the payload has nowhere to put them. These
 * hold that the hole stays a hole.
 */

const good = {
  clientCaptureId: 'c-1',
  capturedAt: new Date().toISOString(),
  rawText: 'She never lets anyone else drive.',
};

describe('what the phone may send', () => {
  it('takes a note with only the four things a note needs', () => {
    const parsed = captureUploadSchema.parse(good);
    expect(parsed.projectId).toBeNull();
    expect(parsed.category).toBeNull();
    expect(parsed.subjectName).toBeNull();
    expect(parsed.source).toBe('mobile_voice');
  });

  it('allows no project, because a thought can arrive before one is chosen', () => {
    expect(captureUploadSchema.parse({ ...good, projectId: null }).projectId).toBeNull();
  });

  it('refuses a note with no words in it', () => {
    expect(() => captureUploadSchema.parse({ ...good, rawText: '' })).toThrow();
  });

  it('refuses a category that is not one of the five', () => {
    expect(() => captureUploadSchema.parse({ ...good, category: 'location' })).toThrow();
  });

  it('has no field for status, so a client cannot claim a note was approved', () => {
    const parsed = captureUploadSchema.parse({ ...good, status: 'approved' } as never);
    expect('status' in parsed).toBe(false);
  });

  it('has no field for inference or for what the note became', () => {
    const parsed = captureUploadSchema.parse({
      ...good,
      inference: { categoryKey: 'ideas', confidence: 1 },
      resultRef: { type: 'research_item', id: 'x' },
    } as never);

    expect('inference' in parsed).toBe(false);
    expect('resultRef' in parsed).toBe(false);
  });
});

describe('the row an upload becomes', () => {
  it('files it under the caller, whatever the body said', () => {
    const row = uploadToRow(captureUploadSchema.parse(good), 'user-42');
    expect(row['user_id']).toBe('user-42');
  });

  it('always arrives pending, because the desktop places', () => {
    const row = uploadToRow(captureUploadSchema.parse(good), 'user-42');
    expect(row['status']).toBe('pending');
  });

  it('carries the category and the spoken name through to the columns', () => {
    const row = uploadToRow(
      captureUploadSchema.parse({ ...good, category: 'arc', subjectName: 'MARA' }),
      'user-42',
    );
    expect(row['category']).toBe('arc');
    expect(row['subject_name']).toBe('MARA');
  });

  it('keeps the id the device made, which is what makes a retry safe', () => {
    // Unique per user in the database since 0003: a second send of the same
    // note is an upsert of the same row rather than a second thought.
    const row = uploadToRow(captureUploadSchema.parse(good), 'user-42');
    expect(row['client_capture_id']).toBe('c-1');
  });
});

describe('a whole Sync press', () => {
  it('takes everything waiting in one call', () => {
    const batch = captureUploadBatchSchema.parse({ notes: [good, { ...good, clientCaptureId: 'c-2' }] });
    expect(batch.notes).toHaveLength(2);
  });

  it('refuses an empty one, which is a bug rather than a request', () => {
    expect(() => captureUploadBatchSchema.parse({ notes: [] })).toThrow();
  });
});

describe('whether the phone may still change a note', () => {
  it('says yes while it is waiting', () => {
    expect(mayStillEdit('pending')).toBe(true);
    expect(mayStillEdit('needs_review')).toBe(true);
  });

  it('says no once the desktop has placed it', () => {
    // The research note exists by then; rewriting the capture would change
    // nothing about the project and everything about where the work came from.
    expect(mayStillEdit('approved')).toBe(false);
    expect(mayStillEdit('rejected')).toBe(false);
  });
});
