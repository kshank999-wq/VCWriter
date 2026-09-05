import { describe, expect, it } from 'vitest';
import { createProjectFile, projectFileSchema, serializeProjectFile, parseProjectFile, type ProjectFile } from '../project-file.js';
import { addBeat, addLane, addUnit, updateBeat } from '../mutations.js';
import { beatsInStoryOrder, projectStats } from '../selectors.js';
import { pageCount, manuscriptElements } from '../pagination.js';
import { mergeProjects } from '../sync-merge.js';
import { newId, type ManuscriptElementId } from '../ids.js';

/**
 * Performance floors for a long project (spec §15: fast startup, responsive
 * editing in long projects, and large projects staying navigable).
 *
 * These are floors, not benchmarks. The numbers sit roughly fifty times above
 * what these operations actually take (1-15ms for the whole project), because
 * a test that fails when CI is busy teaches people to ignore it. What they catch is
 * the change that makes something quadratic — a selector that re-scans every
 * beat per beat, a merge that searches an array inside a loop over the same
 * array. That class of regression does not slow a large project down by ten
 * percent; it makes it unusable, and it is invisible on the small fixtures
 * every other test uses.
 */

const WORDS =
  'The lamp turns and the light crawls across the water without finding anything at all tonight '.split(' ');

/** A screenplay of roughly feature length: 8 lanes, 121 scenes, 601 beats. */
const largeProject = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });

  const paragraph = (seed: number): string =>
    Array.from({ length: 40 }, (_, index) => WORDS[(seed + index) % WORDS.length]).join(' ');

  for (let lane = 0; lane < 7; lane += 1) {
    file = addLane(file, { name: `Lane ${lane}` }).file;
  }

  const lanes = file.lanes;
  for (let scene = 0; scene < 120; scene += 1) {
    const lane = lanes[scene % lanes.length]!;
    const created = addUnit(file, { laneId: lane.id, title: `Scene ${scene}` });
    file = created.file;

    for (let beat = 0; beat < 5; beat += 1) {
      const added = addBeat(file, { unitId: created.unit.id, title: `Beat ${scene}.${beat}` });
      file = updateBeat(added.file, added.beat.id, {
        manuscript: {
          elements: [
            {
              id: newId<ManuscriptElementId>(),
              type: 'action',
              text: paragraph(scene + beat),
              characterId: null,
              attributes: {},
            },
          ],
        },
      });
    }
  }

  return file;
};

const took = (label: string, work: () => void): number => {
  const started = performance.now();
  work();
  const elapsed = performance.now() - started;
  // Printed so a real regression is legible in CI output even when it passes.
  console.info(`${label}: ${elapsed.toFixed(0)}ms`);
  return elapsed;
};

describe('a long project stays workable', () => {
  const file = largeProject();

  it('is actually large', () => {
    const stats = projectStats(file);
    // 120 scenes of 5 beats, plus the one a new project starts with.
    expect(stats.beatCount).toBe(601);
    expect(stats.wordCount).toBeGreaterThan(20_000);
  });

  it('orders the whole story quickly', () => {
    // The navigation path: this runs on every render of the structure board.
    expect(took('beatsInStoryOrder', () => void beatsInStoryOrder(file))).toBeLessThan(250);
  });

  it('counts statistics quickly', () => {
    // Runs on every keystroke, via the header word count.
    expect(took('projectStats', () => void projectStats(file))).toBeLessThan(250);
  });

  it('paginates the whole manuscript quickly', () => {
    expect(took('pageCount', () => void pageCount(file))).toBeLessThan(1000);
    expect(pageCount(file)).toBeGreaterThan(50);
  });

  it('builds the print element list quickly', () => {
    expect(took('manuscriptElements', () => void manuscriptElements(file, { includeBeatTitles: false }))).toBeLessThan(
      500,
    );
  });

  it('saves and re-opens quickly', () => {
    // Startup: this is the whole of "open a project".
    let serialized = '';
    expect(took('serialize', () => void (serialized = serializeProjectFile(file)))).toBeLessThan(500);
    expect(took('parse and validate', () => void parseProjectFile(JSON.parse(serialized)))).toBeLessThan(1000);
  });

  it('merges two large copies quickly', () => {
    // The one with the most room to go quadratic: a merge walks both sides and
    // has to find each record's counterpart.
    const edited = file.beats.filter((_, index) => index % 10 === 0).length;
    const other = projectFileSchema.parse({
      ...file,
      beats: file.beats.map((beat, index) =>
        index % 10 === 0 ? { ...beat, summary: 'edited elsewhere', updatedAt: '2027-01-01T00:00:00.000Z' } : beat,
      ),
    });

    let conflicts = -1;
    const elapsed = took('mergeProjects', () => {
      conflicts = mergeProjects(file, other, { lastSyncedAt: '2020-01-01T00:00:00.000Z' }).conflicts.length;
    });

    expect(elapsed).toBeLessThan(1000);
    expect(conflicts).toBe(edited);
  });
});
