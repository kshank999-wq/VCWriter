import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addBeat, addLane, addUnit, DomainError, linkEntities, moveBeat, moveUnit } from '../mutations.js';
import { beatsForUnit, lanesInOrder, linksFor, unitsForLane } from '../selectors.js';
import { ref } from '../entities/links.js';
import { asId, type StructuralUnitId } from '../ids.js';

const newScreenplay = () => createProjectFile({ title: 'Test Feature', format: 'screenplay' });

describe('story structure', () => {
  it('creates a usable project: one lane, one scene, one beat', () => {
    const file = newScreenplay();
    expect(file.lanes).toHaveLength(1);
    expect(file.units).toHaveLength(1);
    expect(file.beats).toHaveLength(1);
    expect(file.units[0]?.kind).toBe('scene');
    expect(file.beats[0]?.unitId).toBe(file.units[0]?.id);
  });

  it('uses chapters for novels', () => {
    const file = createProjectFile({ title: 'Test Novel', format: 'novel' });
    expect(file.units[0]?.kind).toBe('chapter');
  });

  it('refuses to create a beat outside a scene/chapter container', () => {
    const file = newScreenplay();
    expect(() => addBeat(file, { unitId: asId<StructuralUnitId>('11111111-1111-4111-8111-111111111111') }))
      .toThrow(DomainError);
  });

  it('keeps beats ordered within their container', () => {
    let file = newScreenplay();
    const unitId = file.units[0]!.id;
    file = addBeat(file, { unitId, title: 'Second' }).file;
    file = addBeat(file, { unitId, title: 'Third' }).file;
    file = addBeat(file, { unitId, title: 'Inserted', index: 1 }).file;
    expect(beatsForUnit(file, unitId).map((beat) => beat.title)).toEqual([
      'Opening beat',
      'Inserted',
      'Second',
      'Third',
    ]);
  });

  it('moves a beat to another scene while preserving its links and manuscript', () => {
    let file = newScreenplay();
    const firstUnitId = file.units[0]!.id;
    const laneId = file.lanes[0]!.id;
    const created = addUnit(file, { laneId, title: 'Second Scene' });
    file = created.file;

    const beat = file.beats[0]!;
    file = linkEntities(file, { from: ref('beat', beat.id), to: ref('lane', laneId), type: 'relates_to' });

    file = moveBeat(file, { beatId: beat.id, toUnitId: created.unit.id, index: 0 });

    expect(beatsForUnit(file, firstUnitId)).toHaveLength(0);
    expect(beatsForUnit(file, created.unit.id).map((candidate) => candidate.id)).toEqual([beat.id]);
    expect(linksFor(file, ref('beat', beat.id))).toHaveLength(1);
  });

  it('moves a scene between lanes and keeps its beats attached', () => {
    let file = newScreenplay();
    const unitId = file.units[0]!.id;
    const subplot = addLane(file, { name: 'Subplot', kind: 'subplot' });
    file = subplot.file;

    file = moveUnit(file, { unitId, toLaneId: subplot.lane.id, index: 0 });

    expect(unitsForLane(file, subplot.lane.id).map((unit) => unit.id)).toEqual([unitId]);
    expect(beatsForUnit(file, unitId)).toHaveLength(1);
    expect(lanesInOrder(file).map((lane) => lane.name)).toEqual(['Main Plot', 'Subplot']);
  });

  it('does not create duplicate links', () => {
    let file = newScreenplay();
    const target = ref('lane', file.lanes[0]!.id);
    const source = ref('beat', file.beats[0]!.id);
    file = linkEntities(file, { from: source, to: target, type: 'appears_in' });
    file = linkEntities(file, { from: source, to: target, type: 'appears_in' });
    expect(file.links).toHaveLength(1);
  });
});
