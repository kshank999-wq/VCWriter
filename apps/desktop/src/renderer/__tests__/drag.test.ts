import { describe, expect, it } from 'vitest';
import { addBeat, addUnit, beatsForUnit, createProjectFile, moveBeat, updateBeat } from '@vcwriter/domain';
import type { ProjectFile } from '@vcwriter/domain';
import { adjustForSameList, indexForDrop, scrollNudge, zoneAt, type DropEdge } from '../drag';

/**
 * The reordering arithmetic between a drop gesture and `moveBeat`.
 *
 * `moveBeat` indexes the sibling list with the dragged beat already lifted out,
 * while a drop reports a position in the list the writer can see. Getting that
 * conversion wrong produces the classic bug where dragging an item one place
 * down does nothing, so it is worth pinning down away from the DOM.
 */

const threeBeats = (): { file: ProjectFile; unitId: ReturnType<typeof addUnit>['unit']['id'] } => {
  let file = createProjectFile({ title: 'Drag', format: 'screenplay' });
  const unitId = file.units[0]!.id;
  file = updateBeat(file, file.beats[0]!.id, { title: 'A' });
  file = addBeat(file, { unitId, title: 'B' }).file;
  file = addBeat(file, { unitId, title: 'C' }).file;
  return { file, unitId };
};

/** Perform the same conversion the structure board does on drop. */
const dropBeat = (
  file: ProjectFile,
  unitId: ReturnType<typeof addUnit>['unit']['id'],
  draggedTitle: string,
  overTitle: string,
  edge: DropEdge,
): ProjectFile => {
  const siblings = beatsForUnit(file, unitId);
  const dragged = siblings.find((beat) => beat.title === draggedTitle)!;
  const overIndex = siblings.findIndex((beat) => beat.title === overTitle);
  const currentIndex = siblings.findIndex((beat) => beat.id === dragged.id);
  return moveBeat(file, {
    beatId: dragged.id,
    toUnitId: unitId,
    index: adjustForSameList(indexForDrop(overIndex, edge), currentIndex),
  });
};

const titles = (file: ProjectFile, unitId: ReturnType<typeof addUnit>['unit']['id']): string[] =>
  beatsForUnit(file, unitId).map((beat) => beat.title);

describe('reordering within a container', () => {
  it('moves a beat to the end when dropped after the last one', () => {
    const { file, unitId } = threeBeats();
    expect(titles(file, unitId)).toEqual(['A', 'B', 'C']);
    expect(titles(dropBeat(file, unitId, 'A', 'C', 'after'), unitId)).toEqual(['B', 'C', 'A']);
  });

  it('moves a beat to the front when dropped before the first one', () => {
    const { file, unitId } = threeBeats();
    expect(titles(dropBeat(file, unitId, 'C', 'A', 'before'), unitId)).toEqual(['C', 'A', 'B']);
  });

  it('moves a beat exactly one place down', () => {
    const { file, unitId } = threeBeats();
    // The off-by-one this guards: dropping A after B must not leave A in place.
    expect(titles(dropBeat(file, unitId, 'A', 'B', 'after'), unitId)).toEqual(['B', 'A', 'C']);
  });

  it('moves a beat exactly one place up', () => {
    const { file, unitId } = threeBeats();
    expect(titles(dropBeat(file, unitId, 'C', 'B', 'before'), unitId)).toEqual(['A', 'C', 'B']);
  });

  it('leaves the order alone when a beat is dropped on itself', () => {
    const { file, unitId } = threeBeats();
    expect(titles(dropBeat(file, unitId, 'B', 'B', 'before'), unitId)).toEqual(['A', 'B', 'C']);
    expect(titles(dropBeat(file, unitId, 'B', 'B', 'after'), unitId)).toEqual(['A', 'B', 'C']);
  });
});

describe('moving between containers', () => {
  it('inserts at the dropped position without the same-list adjustment', () => {
    const { file: base, unitId } = threeBeats();
    const created = addUnit(base, { laneId: base.lanes[0]!.id, title: 'Second scene' });
    let file = created.file;
    file = addBeat(file, { unitId: created.unit.id, title: 'X' }).file;
    file = addBeat(file, { unitId: created.unit.id, title: 'Y' }).file;

    const beatB = beatsForUnit(file, unitId).find((beat) => beat.title === 'B')!;
    const targetSiblings = beatsForUnit(file, created.unit.id);
    const overIndex = targetSiblings.findIndex((beat) => beat.title === 'X');

    file = moveBeat(file, {
      beatId: beatB.id,
      toUnitId: created.unit.id,
      // currentIndex is null across containers: nothing was lifted out of this list.
      index: adjustForSameList(indexForDrop(overIndex, 'after'), null),
    });

    expect(titles(file, unitId)).toEqual(['A', 'C']);
    expect(titles(file, created.unit.id)).toEqual(['X', 'B', 'Y']);
  });
});

/**
 * The Outliner's three zones (addendum 06 §8).
 *
 * A tree needs an answer the structure board does not — *inside* — and the
 * arithmetic that turns a pointer into one of three answers is worth pinning
 * down away from the DOM, because getting it wrong makes a drop land
 * somewhere the writer did not aim.
 */
describe('where a dropped row lands', () => {
  // A row of the height the Outliner actually draws.
  const ROW = 26;
  const zone = (y: number) => zoneAt(y, 100, ROW);

  it('says beside it at the top and the bottom, and inside it in the middle', () => {
    expect(zone(101)).toBe('before');
    expect(zone(113)).toBe('into');
    expect(zone(125)).toBe('after');
  });

  it('gives the three an equal share, and each one a target a hand can hit', () => {
    const zones = Array.from({ length: ROW }, (unused, offset) => zone(100 + offset + 0.5));
    const count = (which: string) => zones.filter((candidate) => candidate === which).length;
    // Reordering wants the edges and nesting wants the middle; neither is the
    // rarer thing to be doing, so neither gets the larger target.
    expect(Math.max(count('before'), count('into'), count('after'))).toBeLessThanOrEqual(
      Math.min(count('before'), count('into'), count('after')) + 1,
    );
    expect(Math.min(count('before'), count('into'), count('after'))).toBeGreaterThanOrEqual(8);
  });

  it('answers something for a row with no height rather than dividing by zero', () => {
    expect(zoneAt(100, 100, 0)).toBe('into');
  });

  it('scrolls only near the edges, and the right way', () => {
    expect(scrollNudge(500, 100, 900)).toBe(0);
    expect(scrollNudge(110, 100, 900)).toBeLessThan(0);
    expect(scrollNudge(890, 100, 900)).toBeGreaterThan(0);
  });
});
