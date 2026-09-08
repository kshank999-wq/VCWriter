import {
  addBeat,
  addUnit,
  beatsForUnit,
  findUnit,
  unitsInStoryOrder,
  type Beat,
  type BeatId,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * Adding structure, from wherever the writer is (addendum 02 §4).
 *
 * Each one adds after the selection and hands back what it made, so the
 * window that asked can select it and put the cursor in its title. They are
 * here rather than in the workspace because a window holding nothing but the
 * lanes has the same toolbar and must do the same thing with it.
 */

export interface Added {
  file: ProjectFile;
  beatId: BeatId;
}

/** A new scene after the selected one, with a beat in it ready to write. */
export const addSceneAfter = (file: ProjectFile, selected: Beat | null): Added | null => {
  const unit = selected ? findUnit(file, selected.unitId) : undefined;
  const order = unitsInStoryOrder(file);
  const position = unit ? order.findIndex((candidate) => candidate.id === unit.id) : order.length - 1;
  const laneId = unit?.laneId ?? file.lanes[0]?.id;
  if (!laneId) return null;
  const created = addUnit(file, { laneId, index: position + 1 });
  const withBeat = addBeat(created.file, { unitId: created.unit.id });
  return { file: withBeat.file, beatId: withBeat.beat.id };
};

/** A new beat straight after the selected one, in the same scene. */
export const addBeatAfter = (file: ProjectFile, selected: Beat | null): Added | null => {
  if (!selected) return null;
  const siblings = beatsForUnit(file, selected.unitId);
  const position = siblings.findIndex((beat) => beat.id === selected.id);
  const created = addBeat(file, { unitId: selected.unitId, index: position + 1 });
  return { file: created.file, beatId: created.beat.id };
};
