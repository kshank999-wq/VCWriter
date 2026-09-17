import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addBeat, addTrack, addUnit, DomainError, linkEntities, moveBeat, moveUnit } from '../mutations.js';
import { beatsForUnit, tracksInOrder, linksFor, unitsForTrack } from '../selectors.js';
import { ref } from '../entities/links.js';
import { asId, type StructuralUnitId } from '../ids.js';

const newScreenplay = () => createProjectFile({ title: 'Test Feature', format: 'screenplay' });

describe('story structure', () => {
  it('creates a usable project: one track, one scene, one beat', () => {
    const file = newScreenplay();
    expect(file.tracks).toHaveLength(1);
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
    const trackId = file.tracks[0]!.id;
    const created = addUnit(file, { trackId, title: 'Second Scene' });
    file = created.file;

    const beat = file.beats[0]!;
    file = linkEntities(file, { from: ref('beat', beat.id), to: ref('track', trackId), type: 'relates_to' });

    file = moveBeat(file, { beatId: beat.id, toUnitId: created.unit.id, index: 0 });

    expect(beatsForUnit(file, firstUnitId)).toHaveLength(0);
    expect(beatsForUnit(file, created.unit.id).map((candidate) => candidate.id)).toEqual([beat.id]);
    expect(linksFor(file, ref('beat', beat.id))).toHaveLength(1);
  });

  it('moves a scene between tracks and keeps its beats attached', () => {
    let file = newScreenplay();
    const unitId = file.units[0]!.id;
    const subplot = addTrack(file, { name: 'Subplot', kind: 'subplot' });
    file = subplot.file;

    file = moveUnit(file, { unitId, toTrackId: subplot.track.id, index: 0 });

    expect(unitsForTrack(file, subplot.track.id).map((unit) => unit.id)).toEqual([unitId]);
    expect(beatsForUnit(file, unitId)).toHaveLength(1);
    expect(tracksInOrder(file).map((track) => track.name)).toEqual(['Main Plot', 'Subplot']);
  });

  it('does not create duplicate links', () => {
    let file = newScreenplay();
    const target = ref('track', file.tracks[0]!.id);
    const source = ref('beat', file.beats[0]!.id);
    file = linkEntities(file, { from: source, to: target, type: 'appears_in' });
    file = linkEntities(file, { from: source, to: target, type: 'appears_in' });
    expect(file.links).toHaveLength(1);
  });
});
