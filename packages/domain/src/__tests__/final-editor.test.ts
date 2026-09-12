import { describe, expect, it } from 'vitest';
import {
  actShape,
  addBeat,
  addLane,
  addMarker,
  addUnit,
  characterPresence,
  createProjectFile,
  fromRows,
  runFinalEditor,
  setSceneGrid,
  threadRuns,
  toRows,
  updateBeat,
  type ProjectFile,
  type StructuralUnitId,
} from '../index.js';

/**
 * The Final Editor built out (spec §8.2): the writer's own structural
 * reading, the threads and arcs it runs on, and the shape of the acts.
 */

const el = (type: string, text: string) => ({
  id: crypto.randomUUID() as never,
  type: type as never,
  text,
  characterId: null,
  attributes: {},
});

/** A script of `count` scenes, each with a heading and one exchange. */
const script = (
  count: number,
  shape: (index: number) => { place: string; who: string[] } = () => ({ place: 'LIGHTHOUSE', who: ['MAEVE'] }),
): { file: ProjectFile; units: StructuralUnitId[] } => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });
  file = { ...file, units: [], beats: [] };
  const lane = file.lanes[0]!.id;
  const units: StructuralUnitId[] = [];

  for (let index = 0; index < count; index += 1) {
    const { place, who } = shape(index);
    const made = addUnit(file, { laneId: lane, title: `Scene ${index + 1}` });
    file = made.file;
    units.push(made.unit.id);
    const beat = addBeat(file, { unitId: made.unit.id });
    file = updateBeat(beat.file, beat.beat.id, {
      status: 'written',
      manuscript: {
        elements: [
          el('scene_heading', `INT. ${place} - NIGHT`),
          el('action', 'Rain on the glass, and the lamp turning above it all the while.'),
          ...who.flatMap((name) => [el('character', name), el('dialogue', 'Not tonight.')]),
        ],
      },
    });
  }
  return { file, units };
};

const kinds = (file: ProjectFile) => runFinalEditor(file).findings.map((finding) => finding.kind);

describe('the writer’s own reading of a scene', () => {
  it('is kept on the scene, patched a field at a time, and survives a sync', () => {
    const { file, units } = script(2);
    let next = setSceneGrid(file, units[0]!, { value: 'trust / betrayal' });
    next = setSceneGrid(next, units[0]!, { polarity: 'down' });

    // Answering one question does not wipe out the answer to another.
    expect(next.units[0]?.grid).toMatchObject({ value: 'trust / betrayal', polarity: 'down' });
    expect(fromRows(toRows(next)).units[0]?.grid).toMatchObject({ value: 'trust / betrayal', polarity: 'down' });
  });

  it('starts empty, and empty is not the same as “nothing changes”', () => {
    const { file } = script(2);
    expect(file.units[0]?.grid.polarity).toBe('');
    // Nothing unanswered is reported as flat.
    expect(kinds(file)).not.toContain('flat_scene');
  });

  it('raises a scene the writer marked as not moving', () => {
    const { file, units } = script(3);
    const next = setSceneGrid(file, units[1]!, { polarity: 'flat', value: 'hope / despair' });
    const finding = runFinalEditor(next).findings.find((entry) => entry.kind === 'flat_scene');
    expect(finding?.severity).toBe('blocking');
    expect(finding?.detail).toContain('hope / despair');
  });

  it('raises a run of scenes that all move the same way', () => {
    const { file, units } = script(5);
    let next = file;
    for (const unitId of units.slice(0, 4)) next = setSceneGrid(next, unitId, { polarity: 'down' });

    const finding = runFinalEditor(next).findings.find((entry) => entry.kind === 'one_note_run');
    expect(finding?.message).toContain('4 scenes');
    expect(finding?.detail).toContain('down');
  });

  it('says once, on a script of any size, that nothing has been read yet', () => {
    expect(kinds(script(6).file)).toContain('grid_unanswered');
    // A two-scene sketch is not nagged about it.
    expect(kinds(script(2).file)).not.toContain('grid_unanswered');
    // And once anything is answered, it stops.
    const { file, units } = script(6);
    expect(kinds(setSceneGrid(file, units[0]!, { polarity: 'up' }))).not.toContain('grid_unanswered');
  });

  it('counts what has been answered', () => {
    const { file, units } = script(4);
    const next = setSceneGrid(setSceneGrid(file, units[0]!, { polarity: 'up' }), units[1]!, { polarity: 'down' });
    expect(runFinalEditor(next).totals.gridded).toBe(2);
  });
});

describe('threads and arcs', () => {
  it('says where each thread runs', () => {
    const { file } = script(3);
    const threads = threadRuns(file);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.scenes).toEqual([1, 2, 3]);
    expect(threads[0]?.first).toBe(1);
    expect(threads[0]?.last).toBe(3);
  });

  it('raises a thread that stops before the story does', () => {
    // A subplot that runs early and never comes back.
    const { file } = script(9);
    const made = addLane(file, { name: 'The subplot' });
    let next = made.file;
    const early = addUnit(next, { laneId: made.lane.id, title: 'Subplot', index: 1 });
    next = early.file;
    const beat = addBeat(next, { unitId: early.unit.id });
    next = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [el('action', 'It begins.')] } });
    const second = addUnit(next, { laneId: made.lane.id, title: 'Subplot again', index: 2 });
    next = second.file;
    next = addBeat(next, { unitId: second.unit.id }).file;

    const finding = runFinalEditor(next).findings.find((entry) => entry.kind === 'thread_dropped');
    expect(finding?.message).toContain('The subplot');
  });

  it('raises a thread that happens once', () => {
    const { file } = script(4);
    const made = addLane(file, { name: 'The one-off' });
    let next = made.file;
    const unit = addUnit(next, { laneId: made.lane.id, title: 'Once' });
    next = addBeat(unit.file, { unitId: unit.unit.id }).file;

    expect(kinds(next)).toContain('thread_single_scene');
  });

  it('maps each character across the story, busiest first', () => {
    const { file } = script(4, (index) => ({
      place: 'LIGHTHOUSE',
      who: index === 0 || index === 3 ? ['MAEVE', 'THE KEEPER'] : ['MAEVE'],
    }));

    const arcs = characterPresence(file);
    expect(arcs.map((arc) => arc.name)).toEqual(['MAEVE', 'THE KEEPER']);
    expect(arcs[0]?.appearances).toHaveLength(4);
    expect(arcs[1]?.first).toBe(1);
    expect(arcs[1]?.last).toBe(4);
    // The keeper is gone for scenes 2 and 3.
    expect(arcs[1]?.longestGap).toBe(2);
    expect(arcs[1]?.gapAfter).toBe(1);
  });

  it('raises an arc with a long silence in the middle of it', () => {
    const { file } = script(20, (index) => ({
      place: `PLACE ${index}`,
      who: index === 0 || index === 1 || index === 19 ? ['MAEVE', 'THE KEEPER'] : ['MAEVE'],
    }));
    const finding = runFinalEditor(file).findings.find((entry) => entry.kind === 'arc_gap');
    expect(finding?.message).toContain('THE KEEPER');
    expect(finding?.message).toContain('17 scenes');
  });
});

describe('the shape of the whole', () => {
  it('measures what each act encloses, as a share of the pages', () => {
    const { file, units } = script(9, (index) => ({ place: `PLACE ${index}`, who: ['MAEVE'] }));
    let next = addMarker(file, { unitId: units[0]!, kind: 'act', title: 'One' }).file;
    next = addMarker(next, { unitId: units[2]!, kind: 'act', title: 'Two' }).file;
    next = addMarker(next, { unitId: units[7]!, kind: 'act', title: 'Three' }).file;

    const acts = actShape(next);
    expect(acts.map((act) => act.label)).toEqual(['ACT I', 'ACT II', 'ACT III']);
    expect(acts.map((act) => [act.from, act.to])).toEqual([
      [1, 2],
      [3, 7],
      [8, 9],
    ]);
    // The shares add up to the whole.
    expect(acts.reduce((sum, act) => sum + act.share, 0)).toBeCloseTo(1, 5);
  });

  it('asks about an act that is a tenth of the script', () => {
    const { file, units } = script(12, (index) => ({ place: `PLACE ${index}`, who: ['MAEVE'] }));
    let next = addMarker(file, { unitId: units[0]!, kind: 'act', title: 'One' }).file;
    next = addMarker(next, { unitId: units[1]!, kind: 'act', title: 'Two' }).file;
    next = addMarker(next, { unitId: units[2]!, kind: 'act', title: 'Three' }).file;

    const finding = runFinalEditor(next).findings.find((entry) => entry.kind === 'act_out_of_proportion');
    expect(finding).toBeTruthy();
    expect(finding?.detail).toContain('a quarter, a half, a quarter');
  });

  it('says when a long script has no acts marked at all', () => {
    expect(kinds(script(10, (index) => ({ place: `PLACE ${index}`, who: ['MAEVE'] })).file)).toContain('no_acts');
    expect(kinds(script(3).file)).not.toContain('no_acts');
  });
});

describe('scenes that repeat themselves', () => {
  it('raises two running scenes with the same cast in the same place', () => {
    const { file } = script(3, () => ({ place: 'LIGHTHOUSE', who: ['MAEVE'] }));
    expect(kinds(file)).toContain('repetitive_scene');
  });

  it('leaves a scene alone when the place or the people change', () => {
    const moved = script(3, (index) => ({ place: `PLACE ${index}`, who: ['MAEVE'] }));
    expect(kinds(moved.file)).not.toContain('repetitive_scene');

    const recast = script(3, (index) => ({ place: 'LIGHTHOUSE', who: index === 1 ? ['THE KEEPER'] : ['MAEVE'] }));
    expect(kinds(recast.file)).not.toContain('repetitive_scene');
  });
});

describe('what it will not do', () => {
  it('never claims to know whether a scene turns on its own', () => {
    const { file } = script(3);
    const report = runFinalEditor(file);
    expect(report.scenes.every((scene) => scene.aiVerdict === null)).toBe(true);
    expect(report.totals.reviewed).toBe(0);
  });

  it('changes nothing about the project', () => {
    const { file } = script(3);
    const before = JSON.stringify(file);
    runFinalEditor(file);
    expect(JSON.stringify(file)).toBe(before);
  });
});
