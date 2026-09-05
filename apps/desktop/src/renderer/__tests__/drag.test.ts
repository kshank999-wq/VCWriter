import { describe, expect, it } from 'vitest';
import { addBeat, addUnit, beatsForUnit, createProjectFile, moveBeat, updateBeat } from '@vcwriter/domain';
import type { ProjectFile } from '@vcwriter/domain';
import { adjustForSameList, indexForDrop, type DropEdge } from '../drag';

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
