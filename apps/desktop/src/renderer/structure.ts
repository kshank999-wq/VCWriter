import {
  addBeat,
  addUnit,
  beatsForUnit,
  findUnit,
  unitsForTrack,
  unitsInStoryOrder,
  type Beat,
  type BeatId,
  type TrackId,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';

/**
 * Adding structure, from wherever the writer is (addendum 02 §4).
 *
 * Each one adds after the selection and hands back what it made, so the
 * window that asked can select it and put the cursor in its title. They are
 * here rather than in the workspace because a window holding nothing but the
 * tracks has the same toolbar and must do the same thing with it.
 *
 * "The selection" is a track, a scene and a beat, and the more particular one
 * wins. Clicking a track and adding a chapter puts the chapter in *that* track;
 * clicking a chapter and adding a beat puts the beat in *that* chapter, even
 * when it is empty and there is no beat to add after.
 */

export interface Selection {
  trackId: TrackId | null;
  unitId: StructuralUnitId | null;
  beat: Beat | null;
}

export interface Added {
  file: ProjectFile;
  beatId: BeatId;
  unitId: StructuralUnitId;
}

/** The scene the writer means: the one they clicked, else the one they are writing in. */
const selectedUnit = (file: ProjectFile, selection: Selection) => {
  const byClick = selection.unitId ? findUnit(file, selection.unitId) : undefined;
  return byClick ?? (selection.beat ? findUnit(file, selection.beat.unitId) : undefined);
};

/** A new scene after the selected one, in the selected track, with a beat in it. */
export const addSceneAfter = (file: ProjectFile, selection: Selection): Added | null => {
  const unit = selectedUnit(file, selection);
  // The track clicked into last, whether that was a track header or a scene in it.
  const trackId = selection.trackId ?? unit?.trackId ?? file.tracks[0]?.id;
  if (!trackId) return null;

  const order = unitsInStoryOrder(file);
  // After the selected scene when it is in this track; otherwise after the last
  // scene the track already has, so a chapter never lands in another plot.
  const anchor =
    unit && unit.trackId === trackId ? unit : (unitsForTrack(file, trackId).at(-1) ?? null);
  const position = anchor ? order.findIndex((candidate) => candidate.id === anchor.id) : order.length - 1;

  const created = addUnit(file, { trackId, index: position + 1 });
  const withBeat = addBeat(created.file, { unitId: created.unit.id });
  return { file: withBeat.file, beatId: withBeat.beat.id, unitId: created.unit.id };
};

/** A new beat straight after the selected one, in the selected scene. */
export const addBeatAfter = (file: ProjectFile, selection: Selection): Added | null => {
  const unit = selectedUnit(file, selection);
  if (!unit) return null;

  const siblings = beatsForUnit(file, unit.id);
  // After the selected beat when it belongs to this scene; otherwise at the
  // end, which is also the answer for a scene with nothing in it yet.
  const anchor = selection.beat && selection.beat.unitId === unit.id ? selection.beat : null;
  const position = anchor ? siblings.findIndex((beat) => beat.id === anchor.id) + 1 : siblings.length;

  const created = addBeat(file, { unitId: unit.id, index: position });
  return { file: created.file, beatId: created.beat.id, unitId: unit.id };
};
