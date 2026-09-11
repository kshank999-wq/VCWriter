import { nowIso } from './entities/common.js';
import type { Board } from './entities/sculptor.js';
import type { Outline } from './entities/outline.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, StructuralUnitId } from './ids.js';

/**
 * Where the plan and the script meet.
 *
 * The project has **two plans** — the Story Sculptor's board (addendum 03) and
 * the Outliner's tree (addendum 06) — and one script. Both plans say the same
 * thing about it: *a node is an idea, a row is a plan, until the writer says
 * otherwise*, and saying otherwise binds it to a scene or a beat, after which
 * the two are one object.
 *
 * That shared sentence has consequences neither module can keep on its own.
 * A scene claimed by a board node must not be claimable by an outline row, or
 * one scene would be two different plans. A scene renamed in the script has to
 * be renamed on the board **and** in the outline. A scene deleted has to let go
 * of both. So the rules that are about *the pair* live here, where there is one
 * of each of them, rather than twice over in two modules that would drift.
 */

/** Anything in a plan that can be the same object as something in the script. */
interface Bound {
  boundUnitId: StructuralUnitId | null;
  boundBeatId: BeatId | null;
}

const boardsOf = (file: ProjectFile): Board[] => file.boards ?? [];
const outlinesOf = (file: ProjectFile): Outline[] => file.outlines ?? [];

/**
 * Every scene and beat already spoken for, by a node or a row, anywhere.
 *
 * **One plan per scene.** "The two are one thing" only means anything if it is
 * one thing: two cards on the same scene would be one scene that is two
 * different intentions about it. `except` is the one asking, so a card still
 * sees what it already holds — without it, nothing could stay bound.
 */
export const claimedInScript = (
  file: ProjectFile,
  except: string | null = null,
): { units: Set<string>; beats: Set<string> } => {
  const units = new Set<string>();
  const beats = new Set<string>();

  const take = (id: string, row: Bound) => {
    if (id === except) return;
    if (row.boundUnitId !== null) units.add(row.boundUnitId as string);
    if (row.boundBeatId !== null) beats.add(row.boundBeatId as string);
  };

  for (const board of boardsOf(file)) for (const node of board.nodes) take(node.id as string, node);
  for (const outline of outlinesOf(file)) for (const item of outline.items) take(item.id as string, item);

  return { units, beats };
};

/**
 * Rename what a node is bound to, from the board.
 *
 * The board half of "rename it in either place and it is renamed in both".
 * A node that is an idea renames only itself; a bound one renames the scene,
 * because they are the same object and a card that disagreed with the script
 * would be exactly the duplicate content §6 exists to avoid.
 */
export const retitleScript = (
  file: ProjectFile,
  target: { unitId: StructuralUnitId } | { beatId: BeatId },
  title: string,
): ProjectFile => {
  const at = nowIso();
  if ('unitId' in target) {
    if (!file.units.some((unit) => unit.id === target.unitId)) return file;
    return {
      ...file,
      units: file.units.map((unit) => (unit.id === target.unitId ? { ...unit, title, updatedAt: at } : unit)),
      project: { ...file.project, updatedAt: at },
    };
  }
  if (!file.beats.some((beat) => beat.id === target.beatId)) return file;
  return {
    ...file,
    beats: file.beats.map((beat) => (beat.id === target.beatId ? { ...beat, title, updatedAt: at } : beat)),
    project: { ...file.project, updatedAt: at },
  };
};

/**
 * Rename whatever is bound to a scene or beat, from the script.
 *
 * The other half of "rename it in either place". Called by `updateUnit` and
 * `updateBeat` when a title changes, so a scene renamed in the workspace is
 * renamed on **every board and in every outline** that says it is real —
 * because the plan and the script are the same object, and there is no version
 * of this where two of them disagree.
 */
export const retitlePlans = (
  file: ProjectFile,
  target: { unitId: StructuralUnitId } | { beatId: BeatId },
  title: string,
): ProjectFile => {
  const at = nowIso();
  const hits = (row: Bound): boolean =>
    'unitId' in target ? row.boundUnitId === target.unitId : row.boundBeatId === target.beatId;

  let changed = false;

  const boards = boardsOf(file).map((board) => {
    let touched = false;
    const nodes = board.nodes.map((node) => {
      if (!hits(node) || node.title === title) return node;
      touched = true;
      return { ...node, title, updatedAt: at };
    });
    if (!touched) return board;
    changed = true;
    return { ...board, nodes, updatedAt: at };
  });

  const outlines = outlinesOf(file).map((outline) => {
    let touched = false;
    const items = outline.items.map((item) => {
      if (!hits(item) || item.title === title) return item;
      touched = true;
      return { ...item, title, updatedAt: at };
    });
    if (!touched) return outline;
    changed = true;
    return { ...outline, items, updatedAt: at };
  });

  return changed ? { ...file, boards, outlines } : file;
};

/**
 * Let go of a scene or beat that has left the script.
 *
 * Called by `removeUnit` and `removeBeat`. A card pointing at something that no
 * longer exists is worse than a plan — it claims to be real and cannot say what
 * it is — so it goes back to being a plan, which is what it was before the
 * writer bound it. Nothing else about it changes, on either the board or the
 * outline.
 */
export const unbindRemovedFromPlans = (
  file: ProjectFile,
  removed: { units: Set<string>; beats: Set<string> },
): ProjectFile => {
  const at = nowIso();
  let changed = false;

  /** The same card with whichever binding has gone cleared, or itself. */
  const letGo = <T extends Bound & { updatedAt: string }>(row: T): T => {
    const unitGone = row.boundUnitId !== null && removed.units.has(row.boundUnitId as string);
    const beatGone = row.boundBeatId !== null && removed.beats.has(row.boundBeatId as string);
    if (!unitGone && !beatGone) return row;
    changed = true;
    return {
      ...row,
      boundUnitId: unitGone ? null : row.boundUnitId,
      boundBeatId: beatGone ? null : row.boundBeatId,
      updatedAt: at,
    };
  };

  const boards = boardsOf(file).map((board) => {
    const nodes = board.nodes.map(letGo);
    return nodes.some((node, at2) => node !== board.nodes[at2]) ? { ...board, nodes, updatedAt: at } : board;
  });
  const outlines = outlinesOf(file).map((outline) => {
    const items = outline.items.map(letGo);
    return items.some((item, at2) => item !== outline.items[at2]) ? { ...outline, items, updatedAt: at } : outline;
  });

  return changed ? { ...file, boards, outlines } : file;
};
