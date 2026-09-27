import { describe, expect, it } from 'vitest';
import {
  addCharacter,
  addMarker,
  addRelationshipStage,
  addUnit,
  createProjectFile,
  describeRelationshipChange,
  fromRows,
  relate,
  relationshipStages,
  removeRelationshipStage,
  toRows,
  tracksInOrder,
  updateRelationship,
  updateRelationshipStage,
  type CharacterRelationshipId,
  type ProjectFile,
  type StructuralUnitId,
} from '../index.js';

/**
 * How a relationship changes (addendum 25 §6, stage 6).
 *
 * Two claims. **A step is anchored to the scene**, so where it falls in the
 * book is read every time and moving the scene moves the step. And **the
 * paragraph is the older spelling**: it stands where there are no steps, so
 * nobody's words are lost and one answer is on the screen at a time.
 */

interface World {
  file: ProjectFile;
  relId: CharacterRelationshipId;
  units: StructuralUnitId[];
}

const world = (): World => {
  let file = createProjectFile({ title: 'The Ledger', format: 'novel' });
  file = addCharacter(file, { name: 'Silas Crane' });
  file = addCharacter(file, { name: 'Tomas Hale' });
  const silas = file.characters[file.characters.length - 2]!.id;
  const tomas = file.characters[file.characters.length - 1]!.id;

  const track = tracksInOrder(file)[0]!;
  const units: StructuralUnitId[] = [];
  for (const title of ['The Counting House', "The Clerk's Coat", 'The Thaw']) {
    const made = addUnit(file, { trackId: track.id, title });
    file = made.file;
    units.push(made.unit.id);
  }

  const made = relate(file, { fromCharacterId: silas, toCharacterId: tomas, kind: 'professional' });
  return { file: made.file, relId: made.relationship!.id, units };
};

const rel = (file: ProjectFile, id: CharacterRelationshipId) =>
  file.characterRelationships.find((one) => one.id === id)!;

describe('the steps', () => {
  it('stand in the story order, whatever order they were made in', () => {
    const { file, relId, units } = world();
    const late = addRelationshipStage(file, relId, { unitId: units[2] as string, state: 'Partner' });
    const early = addRelationshipStage(late.file, relId, {
      unitId: units[0] as string,
      state: 'Uses him',
    });

    const rows = relationshipStages(early.file, rel(early.file, relId));
    expect(rows.map((row) => row.stage.state)).toEqual(['Uses him', 'Partner']);
  });

  it('puts what is planned but not placed after what is', () => {
    const { file, relId, units } = world();
    const planned = addRelationshipStage(file, relId, { state: 'Forgives the debt' });
    const placed = addRelationshipStage(planned.file, relId, {
      unitId: units[0] as string,
      state: 'Uses him',
    });

    const rows = relationshipStages(placed.file, rel(placed.file, relId));
    // `arcBoard`'s split: the manuscript decides where a placed one falls, and
    // what is not written yet has no place in the story to sort into.
    expect(rows.map((row) => row.stage.state)).toEqual(['Uses him', 'Forgives the debt']);
    expect(rows[1]!.at).toBeNull();
    expect(rows[1]!.unitTitle).toBeNull();
  });

  it('reads the division from where the scene falls, and moves when it does', () => {
    const { file, relId, units } = world();
    const marked = addMarker(file, { unitId: units[0]!, title: '', kind: 'chapter' }).file;
    const two = addMarker(marked, { unitId: units[2]!, title: '', kind: 'chapter' }).file;
    const made = addRelationshipStage(two, relId, {
      unitId: units[1] as string,
      state: 'Pays his doctor',
    });

    // The middle scene carries no marker of its own; it falls under the
    // nearest at or before, which is the question the column answers.
    expect(relationshipStages(made.file, rel(made.file, relId))[0]!.division).toBe('Chapter 1');

    // **Nothing is stored**: pointing the step at the third scene moves it
    // into the second chapter with nothing run.
    const moved = updateRelationshipStage(made.file, relId, rel(made.file, relId).stages[0]!.id, {
      unitId: units[2] as string,
    });
    expect(relationshipStages(moved, rel(moved, relId))[0]!.division).toBe('Chapter 2');
  });

  it('is taken away one at a time', () => {
    const { file, relId, units } = world();
    const a = addRelationshipStage(file, relId, { unitId: units[0] as string, state: 'Uses him' });
    const b = addRelationshipStage(a.file, relId, { unitId: units[1] as string, state: 'Partner' });
    const gone = removeRelationshipStage(b.file, relId, a.stage!.id);
    expect(relationshipStages(gone, rel(gone, relId)).map((row) => row.stage.state)).toEqual([
      'Partner',
    ]);
  });

  it('refuses a relationship that is not there, and changes nothing', () => {
    const { file } = world();
    const made = addRelationshipStage(file, 'nobody' as CharacterRelationshipId, { state: 'x' });
    expect(made.stage).toBeNull();
    expect(made.file).toBe(file);
  });

  it('is carried to the rows and back', () => {
    const { file, relId, units } = world();
    const made = addRelationshipStage(file, relId, { unitId: units[1] as string, state: 'Partner' });
    const back = fromRows(toRows(made.file));
    expect(rel(back, relId).stages).toEqual(rel(made.file, relId).stages);
  });
});

describe('the paragraph beside them', () => {
  /**
   * **The older spelling, kept.** Replacing it to make room for a better
   * shape would lose what a writer typed for a reason nobody asked for.
   */
  it('stands where there are no steps, and stands down where there are', () => {
    const { file, relId, units } = world();
    const said = updateRelationship(file, relId, { evolution: 'He stops needing him.' });
    expect(describeRelationshipChange(rel(said, relId))).toBe('He stops needing him.');

    const stepped = addRelationshipStage(said, relId, {
      unitId: units[0] as string,
      state: 'Uses him',
    }).file;
    // One answer at a time — and the words are **still there**, so taking the
    // step away brings the sentence back.
    expect(describeRelationshipChange(rel(stepped, relId))).toBe('');
    expect(rel(stepped, relId).evolution).toBe('He stops needing him.');

    const back = removeRelationshipStage(stepped, relId, rel(stepped, relId).stages[0]!.id);
    expect(describeRelationshipChange(rel(back, relId))).toBe('He stops needing him.');
  });

  it('says what a step is where there is neither', () => {
    const { file, relId } = world();
    expect(describeRelationshipChange(rel(file, relId))).toContain('at a scene');
  });
});
