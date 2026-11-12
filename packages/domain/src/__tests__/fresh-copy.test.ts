import { describe, expect, it } from 'vitest';
import { createProjectFile, freshCopy, beatsForUnit, unitsInStoryOrder } from '../index.js';

describe('a fresh copy of a project (samples, from Ken, 12 November)', () => {
  it('gives every id a new one, keeps every reference, and leaves the words alone', () => {
    const file = createProjectFile({ title: 'Sample', format: 'screenplay' });
    const copy = freshCopy(file);
    expect(copy.project.id).not.toBe(file.project.id);
    expect(copy.project.title).toBe('Sample');
    const ids = (f: typeof file) => [f.project.id, ...f.units.map((u) => u.id), ...f.beats.map((b) => b.id), ...f.tracks.map((t) => t.id)] as string[];
    const before = new Set(ids(file));
    expect(ids(copy).some((one) => before.has(one))).toBe(false);
    // Every beat still belongs to its scene, every scene to its track.
    const unit = unitsInStoryOrder(copy)[0]!;
    expect(beatsForUnit(copy, unit.id).length).toBe(beatsForUnit(file, unitsInStoryOrder(file)[0]!.id).length);
    expect(copy.units.every((one) => copy.tracks.some((track) => track.id === one.trackId))).toBe(true);
    expect(copy.units.every((one) => one.projectId === copy.project.id)).toBe(true);
    expect(freshCopy(file).project.id).not.toBe(copy.project.id);
  });
});
