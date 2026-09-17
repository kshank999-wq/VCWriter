import { describe, expect, it } from 'vitest';
import {
  captureUploadBatchSchema,
  captureUploadSchema,
  mayStillEdit,
  uploadToRow,
} from '../capture-upload.js';
import { SYNC_TABLES, toRows } from '../sync-mapping.js';
import { createProjectFile } from '../project-file.js';

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

/**
 * Starting a project from the phone (addendum 09 §3.1, stage 5).
 *
 * The route runs `createProjectFile` and writes `toRows`, which is the same
 * pair the desktop's push uses. What these hold is why that matters: a phone
 * that wrote a bare `projects` row would have its own thinner idea of what a
 * project is, and the difference would only surface the first time somebody
 * opened it at a desk and found no folders in it.
 */
describe('a project started on the phone', () => {
  const owner = '5dfae143-9962-401f-9a36-b397fbbcb3d9';
  const started = () =>
    toRows(createProjectFile({ title: 'The Wreck', format: 'screenplay', ownerId: owner as never }));

  it('arrives with everything a desktop expects to find', () => {
    const rows = started();

    // A scene to write in, the beat inside it, and the track it sits on.
    expect(rows.units.length).toBeGreaterThan(0);
    expect(rows.beats.length).toBeGreaterThan(0);
    expect(rows.tracks.length).toBeGreaterThan(0);
    // The research folders and the cast headings, which is what the Mobile App
    // inbox drops notes into.
    expect(rows.researchCategories.length).toBeGreaterThan(0);
    expect(rows.characterCategories.length).toBeGreaterThan(0);
  });

  it('writes a row for every collection the sync knows about', () => {
    // Not that each is full — a new project has no characters — but that the
    // shape is the whole shape, so nothing is silently missing.
    const rows = started();
    for (const key of Object.keys(SYNC_TABLES)) {
      expect(Array.isArray(rows[key as keyof typeof SYNC_TABLES])).toBe(true);
    }
  });

  it('belongs to whoever asked for it', () => {
    expect(started().project['owner_id']).toBe(owner);
  });

  it('has the research folders the five categories file into', () => {
    const keys = started().researchCategories.map((row) => row['system_key']);
    for (const key of ['characters', 'ideas', 'plot_points', 'themes']) {
      expect(keys).toContain(key);
    }
  });
});
