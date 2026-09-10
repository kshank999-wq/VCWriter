import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addUnit,
  createProjectFile,
  fromRows,
  gridFromRead,
  runFinalEditor,
  setSceneGrid,
  setSceneRead,
  toRows,
  updateBeat,
  type ProjectFile,
  type SceneVerdict,
  type StructuralUnitId,
} from '../index.js';

/**
 * The AI structural read (spec §8.2): what the document keeps of it, and what
 * happens when the writer takes it as their own.
 */

const el = (type: string, text: string) => ({
  id: crypto.randomUUID() as never,
  type: type as never,
  text,
  characterId: null,
  attributes: {},
});

const scene = (): { file: ProjectFile; unitId: StructuralUnitId } => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });
  file = { ...file, units: [], beats: [] };
  const made = addUnit(file, { laneId: file.lanes[0]!.id, title: 'The stair' });
  const beat = addBeat(made.file, { unitId: made.unit.id });
  file = updateBeat(beat.file, beat.beat.id, {
    status: 'written',
    manuscript: {
      elements: [
        el('scene_heading', 'INT. LIGHTHOUSE - NIGHT'),
        el('action', 'She climbs, and does not look down.'),
        el('character', 'MAEVE'),
        el('dialogue', 'Not tonight.'),
      ],
    },
  });
  return { file, unitId: made.unit.id };
};

const verdict = (over: Partial<SceneVerdict> = {}): SceneVerdict => ({
  opening: 'She is afraid of the climb.',
  change: 'She climbs it anyway.',
  turn: 'The moment she lets go of the rail.',
  valueShift: 'positive',
  purpose: 'It buys the ending its credibility.',
  concerns: ['The keeper is mentioned but never seen.'],
  inciting: 'The lamp goes out.',
  crisis: 'Climb blind, or leave the boats to it.',
  climax: 'She climbs.',
  resolution: null,
  model: 'a-model',
  ...over,
});

describe('a read the document keeps', () => {
  it('is stored on the scene it is about, dated, and survives a sync', () => {
    const { file, unitId } = scene();
    const next = setSceneRead(file, unitId, verdict());

    expect(next.units[0]?.aiRead?.turn).toBe('The moment she lets go of the rail.');
    // Dated by the document, so a read made before a rewrite can be spotted.
    expect(Date.parse(next.units[0]?.aiRead?.readAt ?? '')).not.toBeNaN();
    expect(fromRows(toRows(next)).units[0]?.aiRead?.purpose).toBe('It buys the ending its credibility.');
  });

  it('is what the Final Editor shows, with no panel holding it', () => {
    const { file, unitId } = scene();
    const before = runFinalEditor(file);
    expect(before.scenes[0]?.aiVerdict).toBeNull();
    expect(before.totals.reviewed).toBe(0);

    const after = runFinalEditor(setSceneRead(file, unitId, verdict()));
    expect(after.scenes[0]?.aiVerdict?.opening).toBe('She is afraid of the climb.');
    expect(after.totals.reviewed).toBe(1);
  });

  it('is replaced whole, and can be forgotten', () => {
    const { file, unitId } = scene();
    let next = setSceneRead(file, unitId, verdict());
    next = setSceneRead(next, unitId, verdict({ turn: null, valueShift: 'none', concerns: [] }));

    // Not merged: a reading is one answer given at one moment.
    expect(next.units[0]?.aiRead?.turn).toBeNull();
    expect(next.units[0]?.aiRead?.concerns).toEqual([]);

    expect(setSceneRead(next, unitId, null).units[0]?.aiRead).toBeNull();
  });

  it('is read from a document written before reads existed', () => {
    const { file } = scene();
    const rows = toRows(file);
    for (const row of rows.units) delete (row as Record<string, unknown>)['ai_read'];
    expect(fromRows(rows).units[0]?.aiRead).toBeNull();
  });

  it('says nothing about a scene the writer has not asked about', () => {
    const { file, unitId } = scene();
    const other = addUnit(file, { laneId: file.lanes[0]!.id, title: 'The lamp' });
    const next = setSceneRead(other.file, unitId, verdict());
    expect(runFinalEditor(next).scenes[1]?.aiVerdict).toBeNull();
  });
});

describe('taking a read as your own', () => {
  it('answers the three questions it was asked, and leaves the rest alone', () => {
    const { file, unitId } = scene();
    const mine = setSceneGrid(file, unitId, { value: 'fear / courage', conflict: 'She against the stair.' });
    const taken = setSceneGrid(mine, unitId, gridFromRead(verdict()));

    expect(taken.units[0]?.grid).toMatchObject({
      polarity: 'up',
      turn: 'The moment she lets go of the rail.',
      purpose: 'It buys the ending its credibility.',
      // The writer's own answers are not overwritten with silence.
      value: 'fear / courage',
      conflict: 'She against the stair.',
    });
  });

  it('turns a scene that does not move into a claim the checks can act on', () => {
    const { file, unitId } = scene();
    const flat = gridFromRead(verdict({ valueShift: 'none', turn: null }));
    expect(flat).toMatchObject({ polarity: 'flat', turn: '' });

    const taken = setSceneGrid(file, unitId, flat);
    expect(runFinalEditor(taken).findings.map((finding) => finding.kind)).toContain('flat_scene');
  });

  it('carries each direction across as the grid says it', () => {
    expect(gridFromRead(verdict({ valueShift: 'negative' })).polarity).toBe('down');
    expect(gridFromRead(verdict({ valueShift: 'mixed' })).polarity).toBe('mixed');
  });

  it('changes nothing on its own — the read alone leaves the grid empty', () => {
    const { file, unitId } = scene();
    const next = setSceneRead(file, unitId, verdict());
    expect(next.units[0]?.grid.polarity).toBe('');
    expect(runFinalEditor(next).totals.gridded).toBe(0);
  });
});

/**
 * The five commandments, at scene scale (addendum 04 §4, §8 stage 4). The
 * read answers them alongside what it already answered; the writer's own
 * answers still win.
 */
describe('the five commandments in a read', () => {
  it('carries the four new ones across, with the turn as the complication', () => {
    const taken = gridFromRead(verdict());
    expect(taken).toMatchObject({
      inciting: 'The lamp goes out.',
      turn: 'The moment she lets go of the rail.',
      crisis: 'Climb blind, or leave the boats to it.',
      climax: 'She climbs.',
    });
  });

  it('leaves a question the read did not find alone rather than blanking it', () => {
    const { file, unitId } = scene();
    // The writer has a resolution; the read found none.
    const mine = setSceneGrid(file, unitId, { resolution: 'The boats come in.' });
    const taken = setSceneGrid(mine, unitId, gridFromRead(verdict()));
    expect(taken.units[0]?.grid.resolution).toBe('The boats come in.');
  });

  it('does not offer an answer it did not find', () => {
    const taken = gridFromRead(verdict({ inciting: null, crisis: null, climax: null }));
    expect(taken).not.toHaveProperty('inciting');
    expect(taken).not.toHaveProperty('crisis');
    expect(taken).not.toHaveProperty('climax');
  });

  it('treats a read of nothing but whitespace as nothing found', () => {
    expect(gridFromRead(verdict({ inciting: '   ' }))).not.toHaveProperty('inciting');
  });

  it('opens a scene read before any of this with four unanswered questions', () => {
    const { file, unitId } = scene();
    // A read stored by an older build: none of the four in it.
    const older = { ...verdict() } as Record<string, unknown>;
    delete older['inciting'];
    delete older['crisis'];
    delete older['climax'];
    delete older['resolution'];
    const next = setSceneRead(file, unitId, older as unknown as SceneVerdict);
    expect(next.units[0]?.aiRead).toMatchObject({
      inciting: null,
      crisis: null,
      climax: null,
      resolution: null,
    });
  });
});
