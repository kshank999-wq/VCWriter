import { describe, expect, it } from 'vitest';
import {
  PROJECT_FORMAT_VERSION,
  ProjectFormatError,
  createProjectFile,
  migrateProjectFile,
  parseProjectFile,
  serializeProjectFile,
} from '../project-file.js';
import { addBeat, addResearchItem, addUnit } from '../mutations.js';
import { projectStats } from '../selectors.js';

describe('project file format', () => {
  it('round-trips a project through serialize/parse without losing structure', () => {
    let file = createProjectFile({ title: 'Cross-platform Test', format: 'screenplay', author: 'K. Shank' });
    const trackId = file.tracks[0]!.id;
    const created = addUnit(file, { trackId, title: 'Second Scene' });
    file = addBeat(created.file, { unitId: created.unit.id, title: 'Turn' }).file;
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    file = addResearchItem(file, { categoryId: ideas.id, title: 'A note' });

    const reloaded = parseProjectFile(JSON.parse(serializeProjectFile(file)));

    expect(reloaded.project.title).toBe('Cross-platform Test');
    expect(reloaded.tracks).toHaveLength(file.tracks.length);
    expect(reloaded.units).toHaveLength(file.units.length);
    expect(reloaded.beats).toHaveLength(file.beats.length);
    expect(reloaded.researchItems).toHaveLength(1);
    expect(projectStats(reloaded)).toEqual(projectStats(file));
  });

  it('refuses a project saved by a newer build instead of silently dropping data', () => {
    const file = createProjectFile({ title: 'From the future', format: 'novel' });
    const future = { ...JSON.parse(serializeProjectFile(file)), formatVersion: PROJECT_FORMAT_VERSION + 1 };
    expect(() => parseProjectFile(future)).toThrow(ProjectFormatError);
  });

  it('rejects a document with no format version', () => {
    expect(() => migrateProjectFile({ project: {} })).toThrow(ProjectFormatError);
  });

  /**
   * A project saved before a lane became a track (format 2, migration 0051).
   * Ken's test projects in the browser were exactly this, and every one of
   * them failed to open with `units.0.trackId: Required`.
   */
  it('opens a format-2 project that still calls a track a lane', () => {
    const fresh = JSON.parse(serializeProjectFile(createProjectFile({ title: 'Novel Test', format: 'novel' })));
    const track = fresh.tracks[0];
    const unit = fresh.units[0];
    const older = {
      ...fresh,
      formatVersion: 2,
      lanes: fresh.tracks,
      units: fresh.units.map(({ trackId, ...rest }: { trackId: string }) => ({ ...rest, laneId: trackId })),
      links: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          projectId: fresh.project.id,
          from: { type: 'unit', id: unit.id },
          to: { type: 'lane', id: track.id },
          type: 'relates_to',
          note: '',
          createdAt: fresh.savedAt,
          updatedAt: fresh.savedAt,
        },
      ],
    };
    delete older.tracks;

    const opened = parseProjectFile(older);
    expect(opened.formatVersion).toBe(PROJECT_FORMAT_VERSION);
    expect(opened.tracks.map((one) => one.id)).toEqual([track.id]);
    expect(opened.units[0]?.trackId).toBe(track.id);
    expect(opened.links[0]?.to.type).toBe('track');
    expect('lanes' in opened).toBe(false);
  });

  it('leaves a format-2 project that already says track untouched', () => {
    const fresh = JSON.parse(serializeProjectFile(createProjectFile({ title: 'Already tracks', format: 'screenplay' })));
    const opened = parseProjectFile({ ...fresh, formatVersion: 2 });
    expect(opened.tracks).toHaveLength(fresh.tracks.length);
    expect(opened.units[0]?.trackId).toBe(fresh.units[0].trackId);
  });

  it('reports validation failures rather than returning a partial project', () => {
    const file = JSON.parse(serializeProjectFile(createProjectFile({ title: 'Broken', format: 'screenplay' })));
    file.beats[0].unitId = 'not-a-uuid';
    expect(() => parseProjectFile(file)).toThrow(ProjectFormatError);
  });
});
