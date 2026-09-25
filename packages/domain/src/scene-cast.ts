import { beatsForUnit } from './selectors.js';
import { speakersIn } from './story-threads.js';
import { workingSetups } from './setups.js';
import { isProseFormat } from './formats.js';
import { updateBeat } from './mutations.js';
import { newId } from './ids.js';
import type { SetupPayoff, SetupPoint } from './entities/setups.js';
import type { ManuscriptElementId } from './ids.js';
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

/**
 * Putting somebody in a scene (addendum 02 §4b, from Ken: *wire them to the
 * cue*). The reading above is the cast **off the cues**, so the only way a
 * name can appear in it is for a cue to be written — which is why this act
 * writes one rather than keeping a list of who is in a scene beside the
 * script. A second list would be a second answer, and cutting the speech
 * would leave it saying she is there.
 *
 * It lives beside `sceneCast` on purpose: the act and the reading it feeds
 * are one idea, and a reader who finds one finds the other.
 */
export interface CueOffer {
  /** The beat the cue goes in — the scene's last, where its writing ends. */
  beatId: BeatId | null;
  /** Why it cannot be done, in a sentence a writer can act on. */
  refusal: string | null;
  /** What pressing would do. */
  sentence: string;
}

const cueName = (name: string): string => name.trim().toUpperCase();

export const cueOffer = (file: ProjectFile, unitId: StructuralUnitId, name: string): CueOffer => {
  const called = cueName(name);
  const beats = beatsForUnit(file, unitId);
  const last = beats[beats.length - 1] ?? null;
  // A cue is a screenplay element. On a novel there is no such thing, and the
  // control is absent rather than refusing — this answer is for a caller that
  // asks anyway.
  if (isProseFormat(file.project.format)) {
    return { beatId: null, refusal: 'A novel has no character cues.', sentence: '' };
  }
  if (called.length === 0) return { beatId: null, refusal: 'Nobody is named.', sentence: '' };
  if (last === null) {
    return { beatId: null, refusal: 'There is nothing written here yet to put a cue in.', sentence: '' };
  }
  if (sceneCast(file, unitId).includes(called)) {
    return { beatId: last.id, refusal: `${called} already speaks here.`, sentence: '' };
  }
  return {
    beatId: last.id,
    refusal: null,
    sentence: `${called} gets a cue at the end of the writing. Type the line and the list fills itself.`,
  };
};

/**
 * Write the cue. It refuses everything `cueOffer` refuses, so a caller
 * cannot get past the reading by not reading it — `trackRemoval`'s shape.
 * An empty speech follows the cue so the writing screen opens where the
 * words go.
 */
export const bringIntoScene = (file: ProjectFile, unitId: StructuralUnitId, name: string): ProjectFile => {
  const offer = cueOffer(file, unitId, name);
  if (offer.refusal !== null || offer.beatId === null) return file;
  const beat = beatsForUnit(file, unitId).find((one) => one.id === offer.beatId)!;
  const made = [
    { id: newId<ManuscriptElementId>(), type: 'character' as const, text: cueName(name), characterId: null, attributes: {} },
    { id: newId<ManuscriptElementId>(), type: 'dialogue' as const, text: '', characterId: null, attributes: {} },
  ];
  return updateBeat(file, beat.id, {
    manuscript: { ...beat.manuscript, elements: [...beat.manuscript.elements, ...made] },
  });
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
  // Ditto: a scene went on saying it carried a promise that had been deleted.
  for (const record of workingSetups(file)) {
    for (const point of record.setups) {
      if (refMatches(point.location, beatIds, unitId)) found.push({ record, role: 'setup', point });
    }
    if (record.payoff && refMatches(record.payoff.location, beatIds, unitId)) {
      found.push({ record, role: 'payoff', point: null });
    }
  }
  return found;
};
