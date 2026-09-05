import { describe, expect, it } from 'vitest';
import { groupErrorReports, type ErrorReportRow } from '@/app/admin/errors/grouping';

const row = (overrides: Partial<ErrorReportRow> = {}): ErrorReportRow => ({
  id: crypto.randomUUID(),
  user_id: null,
  app_version: '1.0.0',
  platform: 'windows',
  os_version: '10.0.19045',
  error_name: 'TypeError',
  error_message: 'x is not a function',
  stack: 'TypeError: x is not a function\n    at save (<path>:12:3)',
  surface: 'main',
  created_at: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

describe('grouping error reports', () => {
  it('collapses the same failure into one row', () => {
    const groups = groupErrorReports([row(), row(), row()]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(3);
  });

  it('ignores numbers that vary between reports', () => {
    // Without this, one bug with a counter in its message looks like fifty
    // rare problems instead of one common one.
    const groups = groupErrorReports([
      row({ error_message: 'beat 4 is missing a unit' }),
      row({ error_message: 'beat 91 is missing a unit' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(2);
  });

  it('keeps two different failures apart', () => {
    const groups = groupErrorReports([row(), row({ error_name: 'RangeError' })]);
    expect(groups).toHaveLength(2);
  });

  it('counts distinct signed-in reporters, not reports', () => {
    const groups = groupErrorReports([
      row({ user_id: 'a' }),
      row({ user_id: 'a' }),
      row({ user_id: 'b' }),
      row({ user_id: null }),
    ]);
    expect(groups[0]?.count).toBe(4);
    expect(groups[0]?.knownUsers).toBe(2);
  });

  it('reports the latest sighting regardless of row order', () => {
    const groups = groupErrorReports([
      row({ created_at: '2026-09-01T00:00:00.000Z' }),
      row({ created_at: '2026-09-04T00:00:00.000Z' }),
    ]);
    expect(groups[0]?.lastSeen).toBe('2026-09-04T00:00:00.000Z');
  });

  it('gathers the versions and platforms a failure spans', () => {
    const groups = groupErrorReports([
      row({ app_version: '1.0.0', platform: 'windows' }),
      row({ app_version: '1.1.0', platform: 'macos' }),
    ]);
    expect(groups[0]?.versions).toEqual(['1.0.0', '1.1.0']);
    expect(groups[0]?.platforms).toEqual(['windows', 'macos']);
  });

  it('orders by how many people are hitting it', () => {
    const groups = groupErrorReports([
      row({ error_name: 'Rare' }),
      row({ error_name: 'Common' }),
      row({ error_name: 'Common' }),
    ]);
    expect(groups.map((group) => group.errorName)).toEqual(['Common', 'Rare']);
  });
});
