import { DomainError, moveUnit, removeTrack } from './mutations.js';
import { tracksInOrder, unitsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { Track } from './entities/structure.js';
import type { TrackId } from './ids.js';

/**
 * Removing a plot track (addendum 24 §5e, from Ken: *I need a delete for plots
 * and threads too*).
 *
 * **A track is not a research record and never goes to the graveyard.** The
 * seven buried kinds are things a writer keeps *about* the story; a track is
 * part of the story's structure, and burying one would have to bury its scenes
 * and its beats with it — which is §5's reason the manuscript is not in there.
 *
 * So the rule is the one the rest of the room already keeps, said for a track:
 * **the plot goes and the writing stays**. Its scenes move to another track,
 * at exactly the story positions they hold, because a scene's position is the
 * project's and not the track's. Cutting the writing is still possible — a
 * subplot dropped whole is a real act — but it is the *second* offer and it
 * says how many scenes it takes, rather than being what a bare × does.
 */

/** Where a track's scenes would go, and what the writer is being asked. */
export interface TrackRemoval {
  /** Whether the track may be removed at all. */
  allowed: boolean;
  /** The scenes on it. */
  sceneCount: number;
  /** The track its scenes would move to, where there is one. */
  moveTo: Track | null;
  /** The one sentence a screen shows. Always set. */
  sentence: string;
}

/**
 * What removing this track would do. **One reading, three screens** — the
 * Research list, the timeline's head and anything later — so they cannot
 * disagree about what a press does or promise something the act does not.
 */
export const trackRemoval = (file: ProjectFile, trackId: TrackId): TrackRemoval => {
  const track = file.tracks.find((one) => one.id === trackId);
  if (!track) {
    return { allowed: false, sceneCount: 0, moveTo: null, sentence: 'That plot is not here.' };
  }
  // The last one cannot go: scenes and chapters have nowhere to live without
  // a track, so this is a fact about the project rather than a warning.
  if (file.tracks.length === 1) {
    return {
      allowed: false,
      sceneCount: file.units.filter((unit) => unit.trackId === trackId).length,
      moveTo: null,
      sentence: 'A story needs one plot track, so this one stays.',
    };
  }

  const sceneCount = file.units.filter((unit) => unit.trackId === trackId).length;
  const moveTo = tracksInOrder(file).find((one) => one.id !== trackId) ?? null;
  if (sceneCount === 0) {
    return { allowed: true, sceneCount, moveTo, sentence: 'Nothing is on it.' };
  }
  const scenes = `${sceneCount} ${sceneCount === 1 ? 'scene' : 'scenes'}`;
  return {
    allowed: true,
    sceneCount,
    moveTo,
    sentence: `${scenes} ${sceneCount === 1 ? 'is' : 'are'} on it. They can move to ${
      moveTo?.name || 'the other plot'
    }, or go with it.`,
  };
};

/**
 * Remove the track and **keep every scene on it**, at the story position it
 * already holds. The plain answer to *I made a plot by accident*, and the one
 * a screen should offer first.
 */
export const dissolveTrack = (file: ProjectFile, trackId: TrackId): ProjectFile => {
  const reading = trackRemoval(file, trackId);
  if (!reading.allowed) throw new DomainError(reading.sentence);
  const moveTo = reading.moveTo;
  if (!moveTo) throw new DomainError('There is no other plot to move these scenes to');

  let next = file;
  // In story order, so what arrives on the other track arrives in the order it
  // was written rather than in whatever order the collection happens to hold.
  for (const unit of unitsInStoryOrder(file)) {
    if (unit.trackId !== trackId) continue;
    next = moveUnit(next, { unitId: unit.id, toTrackId: moveTo.id, keepPosition: true });
  }
  return removeTrack(next, trackId);
};
