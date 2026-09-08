import { beatsForUnit } from './selectors.js';
import { speakersIn } from './story-threads.js';
import type { SetupPayoff, SetupPoint } from './entities/setups.js';
import type { StoryEntityRef } from './entities/links.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, StructuralUnitId } from './ids.js';

/**
 * What a scene or a beat contains, for the dialogs' sidebars (addendum 02
 * §7): who speaks, and which promises are made or kept there. Both derive
 * from the script and the setups tracker, so the sidebar fills itself.
 */

/** Everyone who speaks anywhere in the scene, in order of first line. */
export const sceneCast = (file: ProjectFile, unitId: StructuralUnitId): string[] => {
  const names: string[] = [];
  for (const beat of beatsForUnit(file, unitId)) {
    for (const name of speakersIn(beat)) if (!names.includes(name)) names.push(name);
  }
  return names;
};

export interface Promise_ {
  record: SetupPayoff;
  /** `setup`: a setup point is placed here. `payoff`: the payoff lands here. */
  role: 'setup' | 'payoff';
  point: SetupPoint | null;
}

const refMatches = (target: StoryEntityRef | null, beatIds: ReadonlySet<string>, unitId: string | null): boolean =>
  target !== null &&
  ((target.type === 'beat' && beatIds.has(target.id)) || (target.type === 'unit' && target.id === unitId));

/**
 * Setups placed in, and payoffs landing in, a scene (every beat of it and
 * the scene itself) or a single beat.
 */
export const promisesIn = (
  file: ProjectFile,
  where: { unitId: StructuralUnitId } | { beatId: BeatId },
): Promise_[] => {
  const beatIds = new Set<string>(
    'unitId' in where ? beatsForUnit(file, where.unitId).map((beat) => beat.id) : [where.beatId],
  );
  const unitId = 'unitId' in where ? (where.unitId as string) : null;
  const found: Promise_[] = [];
  for (const record of file.setupsPayoffs) {
    if (record.archived) continue;
    for (const point of record.setups) {
      if (refMatches(point.location, beatIds, unitId)) found.push({ record, role: 'setup', point });
    }
    if (record.payoff && refMatches(record.payoff.location, beatIds, unitId)) {
      found.push({ record, role: 'payoff', point: null });
    }
  }
  return found;
};
