import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addEpisode,
  addSetupPayoff,
  addSetupPoint,
  addUnit,
  createProjectFile,
  deleteSetupPayoff,
  describeSetups,
  promisesIn,
  recordPayoff,
  ref,
  setupsBoard,
  timelineArcs,
  unresolvedSetupsPayoffs,
  workingSetups,
  type BeatId,
  type ProjectFile,
} from '../index.js';

/**
 * Everywhere a setup or a payoff is read, after it has been deleted
 * (addendum 24 §5i).
 *
 * The cast's fault in this module: four readings outside `setups.ts` wrote
 * `!record.archived` for themselves, so a deleted promise went on drawing its
 * arc on the timeline, counting as owed on the home page, riding into the next
 * episode and showing in the scene that carried it. This walks **every**
 * reading rather than the list the complaint came from.
 */

/** A series with a promise set up in scene 1 and paid off in scene 3. */
const promised = () => {
  let file: ProjectFile = createProjectFile({ title: 'The Gun', format: 'series' });
  const trackId = file.tracks[0]!.id;
  const beatIds: string[] = [];
  for (let at = 0; at < 3; at += 1) {
    const scene = addUnit(file, { trackId, title: `Scene ${at + 1}` });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
    file = beat.file;
    beatIds.push(beat.beat.id as string);
  }
  file = addSetupPayoff(file, { title: 'The gun in the drawer', description: '' });
  const recordId = file.setupsPayoffs[file.setupsPayoffs.length - 1]!.id;
  file = addSetupPoint(file, {
    setupPayoffId: recordId,
    description: 'She opens the drawer',
    location: ref('beat', beatIds[0] as string),
    strength: 'written',
    excerpt: 'She opens the drawer',
  });
  file = recordPayoff(file, {
    setupPayoffId: recordId,
    description: 'It fires',
    location: ref('beat', beatIds[2] as string),
  });
  return { file, gone: deleteSetupPayoff(file, recordId), recordId, beatIds };
};

describe('a deleted promise is off every reading that names one', () => {
  it('leaves the module’s own readings', () => {
    const { gone } = promised();
    expect(workingSetups(gone)).toEqual([]);
    expect(setupsBoard(gone)).toEqual([]);
    expect(describeSetups(gone)).toBe('Nothing set up yet.');
  });

  it('leaves the timeline’s arcs', () => {
    const { file, gone } = promised();
    // It was drawn before, so the absence afterwards is the reading working.
    expect(timelineArcs(file).some((arc) => arc.kind === 'setup')).toBe(true);
    expect(timelineArcs(gone).some((arc) => arc.kind === 'setup')).toBe(false);
  });

  it('leaves what the project still owes', () => {
    const { file, gone } = promised();
    let open = addSetupPayoff(file, { title: 'The letter', description: '' });
    const openId = open.setupsPayoffs[open.setupsPayoffs.length - 1]!.id;
    expect(unresolvedSetupsPayoffs(open).map((one) => one.title)).toContain('The letter');
    open = deleteSetupPayoff(open, openId);
    expect(unresolvedSetupsPayoffs(open).map((one) => one.title)).not.toContain('The letter');
    expect(unresolvedSetupsPayoffs(gone).map((one) => one.title)).not.toContain('The gun in the drawer');
  });

  it('leaves what the beat it was in says it carries', () => {
    const { file, gone, beatIds } = promised();
    const where = { beatId: beatIds[0] as BeatId };
    expect(promisesIn(file, where)).toHaveLength(1);
    expect(promisesIn(gone, where)).toEqual([]);
  });

  it('is not carried into a new episode', () => {
    const { file, gone } = promised();
    let open = addSetupPayoff(file, { title: 'The letter', description: '' });
    const openId = open.setupsPayoffs[open.setupsPayoffs.length - 1]!.id;

    const carried = addEpisode(open, { title: 'Two' });
    const notesWith = carried.file.markers.find((one) => one.kind === 'episode')!.notes;
    expect(notesWith).toContain('The letter');

    open = deleteSetupPayoff(open, openId);
    const after = addEpisode(open, { title: 'Two' });
    const notesWithout = after.file.markers.find((one) => one.kind === 'episode')!.notes;
    expect(notesWithout).not.toContain('The letter');

    // And the one that was deleted in the fixture never appears either.
    const later = addEpisode(gone, { title: 'Two' });
    expect(later.file.markers.find((one) => one.kind === 'episode')!.notes).not.toContain('the drawer');
  });

  it('is still in its collection, so restoring gives it back whole', () => {
    const { gone, recordId } = promised();
    const record = gone.setupsPayoffs.find((one) => one.id === recordId);
    expect(record).toBeDefined();
    expect(record!.setups).toHaveLength(1);
    expect(record!.payoff).not.toBeNull();
  });
});
