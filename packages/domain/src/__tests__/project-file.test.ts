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
    const laneId = file.lanes[0]!.id;
    const created = addUnit(file, { laneId, title: 'Second Scene' });
    file = addBeat(created.file, { unitId: created.unit.id, title: 'Turn' }).file;
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    file = addResearchItem(file, { categoryId: ideas.id, title: 'A note' });

    const reloaded = parseProjectFile(JSON.parse(serializeProjectFile(file)));

    expect(reloaded.project.title).toBe('Cross-platform Test');
    expect(reloaded.lanes).toHaveLength(file.lanes.length);
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

  it('reports validation failures rather than returning a partial project', () => {
    const file = JSON.parse(serializeProjectFile(createProjectFile({ title: 'Broken', format: 'screenplay' })));
    file.beats[0].unitId = 'not-a-uuid';
    expect(() => parseProjectFile(file)).toThrow(ProjectFormatError);
  });
});
